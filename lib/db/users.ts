import { getDb } from './index';

export interface UserRow {
  id: string; zhihu_user_id: string; name: string; role: string; city: string; quote: string;
  tags: string[]; intents: string[]; zhihu_years: number; upvotes: string;
  encounter_enabled: number; auto_reciprocate: number; is_mock: number;
}

function mapUser(r: any): UserRow {
  return {
    id: r.id, zhihu_user_id: r.zhihu_user_id, name: r.name, role: r.role, city: r.city, quote: r.quote,
    tags: JSON.parse(r.tags || '[]'), intents: JSON.parse(r.intents || '[]'),
    zhihu_years: r.zhihu_years, upvotes: r.upvotes,
    encounter_enabled: r.encounter_enabled, auto_reciprocate: r.auto_reciprocate, is_mock: r.is_mock,
  };
}

export function getUser(id: string): UserRow | null {
  const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  return r ? mapUser(r) : null;
}

export function listUsers(): UserRow[] {
  return (getDb().prepare('SELECT * FROM users ORDER BY id').all() as any[]).map(mapUser);
}

export function setEncounterEnabled(id: string, enabled: boolean) {
  getDb().prepare('UPDATE users SET encounter_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

// ============ 真实知乎用户（P2 OAuth 接入） ============

export function findUserIdByZhihuId(zhihuUserId: string): string | null {
  const row = getDb().prepare('SELECT user_id FROM zhihu_identities WHERE zhihu_user_id = ?').get(zhihuUserId) as any;
  return row?.user_id ?? null;
}

/** OAuth 成功后落库：已有身份则更新资料，否则创建 is_mock=0 的真实用户 */
export function upsertRealUser(p: { zhihuUserId: string; name: string; headline: string | null; avatarUrl: string | null; profileUrl: string | null }): string {
  const d = getDb();
  const existing = findUserIdByZhihuId(p.zhihuUserId);
  if (existing) {
    d.prepare('UPDATE users SET name = ?, quote = ? WHERE id = ?').run(p.name, p.headline || '', existing);
    return existing;
  }
  const id = `real-${p.zhihuUserId}`.slice(0, 60);
  d.prepare(`INSERT INTO users (id, zhihu_user_id, name, role, city, quote, tags, intents, encounter_enabled, auto_reciprocate, is_mock)
    VALUES (?,?,?,?,?,?,?,?,1,0,0)`)
    .run(id, p.zhihuUserId, p.name, p.headline || '知乎用户', '', p.headline || '', '[]', '[]');
  d.prepare('INSERT OR REPLACE INTO zhihu_identities (zhihu_user_id, user_id) VALUES (?,?)').run(p.zhihuUserId, id);
  return id;
}

export function saveZhihuAuth(userId: string, zhihuUserId: string, accessToken: string, expiresAt: number | null, profile: unknown, rawContents: string | null) {
  getDb().prepare(`UPDATE zhihu_identities SET access_token = ?, expires_at = ?, profile = ?, raw_contents = ?, updated_at = datetime('now')
    WHERE zhihu_user_id = ?`)
    .run(accessToken, expiresAt, JSON.stringify(profile), rawContents, zhihuUserId);
}
