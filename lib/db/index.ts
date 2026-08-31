import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { AXES, cosine, mask, vec, CONVERSATION_AXES, VALUE_AXES, stateVec, type Vec } from '../axes';
import { SEED_CONTENTS, SEED_USERS } from './seed';

// ============ 存储层 ============
// 比赛阶段：node:sqlite（零依赖）+ 内存向量粗排。
// 接口抽象保留：赛后换 PostgreSQL + pgvector 只改本文件与 lib/retrieval。

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, 'yujian.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  initSchema(db);
  ensureSeed(db);
  return db;
}

function initSchema(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      zhihu_user_id TEXT,
      name TEXT NOT NULL,
      role TEXT, city TEXT, quote TEXT,
      tags TEXT, intents TEXT,
      zhihu_years INTEGER DEFAULT 0,
      upvotes TEXT,
      encounter_enabled INTEGER DEFAULT 1,
      auto_reciprocate INTEGER DEFAULT 0,
      is_mock INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      content_type TEXT, title TEXT, chars INTEGER, minutes INTEGER,
      summary TEXT, excerpt TEXT, url TEXT, topics TEXT,
      vec TEXT, is_anchor INTEGER DEFAULT 0, published_at TEXT
    );
    CREATE TABLE IF NOT EXISTS user_vectors (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      long_term TEXT, value TEXT, conversation TEXT, current TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS current_states (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      text TEXT, mood TEXT,
      created_at TEXT DEFAULT (datetime('now')), expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      viewer_id TEXT NOT NULL, target_id TEXT NOT NULL,
      scores TEXT, anchor_id TEXT, reason TEXT, bridge TEXT,
      status TEXT DEFAULT 'fresh',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, rec_id TEXT NOT NULL, viewer_id TEXT, type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS connection_intents (
      id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, rec_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, user_a TEXT NOT NULL, user_b TEXT NOT NULL,
      shared TEXT, question TEXT, bridge TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function ensureSeed(d: DatabaseSync) {
  const row = d.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (row.n > 0) return;
  for (const u of SEED_USERS) {
    d.prepare(`INSERT INTO users (id, zhihu_user_id, name, role, city, quote, tags, intents, zhihu_years, upvotes, encounter_enabled, auto_reciprocate, is_mock)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`)
      .run(u.id, `zhihu-${u.id}`, u.name, u.role, u.city, u.quote, JSON.stringify(u.tags), JSON.stringify(u.intents), u.zhihu_years, u.upvotes, 1, u.auto_reciprocate);
    if (u.current_state) {
      d.prepare('INSERT INTO current_states (id, user_id, text, mood) VALUES (?,?,?,?)')
        .run(`cs-${u.id}`, u.id, u.current_state.text, u.current_state.mood);
    }
  }
  for (const c of SEED_CONTENTS) {
    d.prepare(`INSERT INTO contents (id, user_id, content_type, title, chars, minutes, summary, excerpt, url, topics, vec, is_anchor, published_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(c.id, c.user_id, c.type, c.title, c.chars, c.minutes, c.summary, c.excerpt,
        `https://zhihu.com/mock/${c.id}`, JSON.stringify(c.topics), JSON.stringify(vec(c.v)), c.anchor ? 1 : 0, c.published_at);
  }
  // 预计算每个用户的长期向量
  for (const u of SEED_USERS) computeUserVectors(u.id);
}

// ============ 向量计算（离线理解管线核心） ============

export interface ContentRow {
  id: string; user_id: string; content_type: string; title: string; chars: number; minutes: number;
  summary: string; excerpt: string; url: string; topics: string[]; vec: Vec; is_anchor: number; published_at: string;
}

export function getContents(userId: string): ContentRow[] {
  const rows = getDb().prepare('SELECT * FROM contents WHERE user_id = ? ORDER BY published_at DESC').all(userId) as any[];
  return rows.map((r) => ({ ...r, topics: JSON.parse(r.topics || '[]'), vec: JSON.parse(r.vec || '[]') }));
}

export function getContent(id: string): ContentRow | null {
  const r = getDb().prepare('SELECT * FROM contents WHERE id = ?').get(id) as any;
  if (!r) return null;
  return { ...r, topics: JSON.parse(r.topics || '[]'), vec: JSON.parse(r.vec || '[]') };
}

function avgVec(vecs: { v: Vec; w: number }[]): Vec {
  if (vecs.length === 0) return vec({});
  const out = new Array(AXES.length).fill(0);
  let tw = 0;
  for (const { v, w } of vecs) {
    tw += w;
    for (let i = 0; i < out.length; i++) out[i] += v[i] * w;
  }
  return out.map((x) => Math.min(1, x / tw));
}

/** 离线理解：由内容向量汇总出 long_term / value / conversation 三层向量 */
export function computeUserVectors(userId: string): { long_term: Vec; value: Vec; conversation: Vec } {
  const contents = getContents(userId);
  const weighted = contents.map((c) => ({ v: c.vec, w: c.is_anchor ? 2 : 1 }));
  const long_term = avgVec(weighted);
  const value = mask(long_term, VALUE_AXES);
  const conversation = mask(long_term, CONVERSATION_AXES);
  const d = getDb();
  d.prepare('INSERT INTO user_vectors (user_id, long_term, value, conversation) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET long_term=excluded.long_term, value=excluded.value, conversation=excluded.conversation, updated_at=datetime(\'now\')')
    .run(userId, JSON.stringify(long_term), JSON.stringify(value), JSON.stringify(conversation));
  return { long_term, value, conversation };
}

export interface UserVectors { long_term: Vec; value: Vec; conversation: Vec; current: Vec | null }

export function getUserVectors(userId: string): UserVectors {
  const d = getDb();
  let row = d.prepare('SELECT * FROM user_vectors WHERE user_id = ?').get(userId) as any;
  if (!row) {
    const c = computeUserVectors(userId);
    row = { user_id: userId, long_term: JSON.stringify(c.long_term), value: JSON.stringify(c.value), conversation: JSON.stringify(c.conversation), current: null };
  }
  const cs = d.prepare('SELECT * FROM current_states WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId) as any;
  return {
    long_term: JSON.parse(row.long_term || '[]'),
    value: JSON.parse(row.value || '[]'),
    conversation: JSON.parse(row.conversation || '[]'),
    current: cs ? stateVec(cs.text || '') : null,
  };
}

export function setCurrentState(userId: string, text: string, mood: string) {
  const d = getDb();
  const id = `cs-${userId}-${Date.now()}`;
  d.prepare('INSERT INTO current_states (id, user_id, text, mood) VALUES (?,?,?,?)').run(id, userId, text, mood);
  d.prepare('UPDATE user_vectors SET current = ? WHERE user_id = ?').run(JSON.stringify(stateVec(text)), userId);
  return id;
}

export function cosineSim(a: Vec, b: Vec): number {
  return cosine(a, b);
}
