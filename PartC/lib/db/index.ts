import { desc, eq } from 'drizzle-orm';
import { AXES, cosine, mask, vec, CONVERSATION_AXES, VALUE_AXES, stateVec, type Vec } from '../axes';
import {
  buildCurrentStateMatchText,
  decodeCurrentState,
  encodeCurrentState,
  matchTextFromStoredCurrentState,
  type CurrentStateSelection,
  type PrivateNoteProcessing,
} from '../current-state/privacy';
import { db } from './client';
import { currentStateExpiresAt, isCurrentStateActive } from './current-state';
import { contents, currentStates, userVectors } from './schema';
import { syncCurrentStateVector } from './vector-index';

export { db } from './client';
export * from './schema';

export interface ContentRow {
  id: string;
  user_id: string;
  content_type: string;
  title: string;
  chars: number;
  minutes: number;
  summary: string;
  excerpt: string;
  url: string;
  topics: string[];
  vec: Vec;
  is_anchor: number;
  published_at: string;
}

function mapContent(row: typeof contents.$inferSelect): ContentRow {
  return {
    id: row.id,
    user_id: row.userId,
    content_type: row.contentType,
    title: row.title,
    chars: row.chars,
    minutes: row.minutes,
    summary: row.summary,
    excerpt: row.excerpt,
    url: row.url,
    topics: row.topics,
    vec: row.vec,
    is_anchor: row.isAnchor ? 1 : 0,
    published_at: row.publishedAt?.toISOString() || '',
  };
}

export async function getContents(userId: string): Promise<ContentRow[]> {
  const rows = await db.select().from(contents).where(eq(contents.userId, userId)).orderBy(desc(contents.publishedAt));
  return rows.map(mapContent);
}

export async function getContent(id: string): Promise<ContentRow | null> {
  const [row] = await db.select().from(contents).where(eq(contents.id, id)).limit(1);
  return row ? mapContent(row) : null;
}

function avgVec(vecs: { v: Vec; w: number }[]): Vec {
  if (vecs.length === 0) return vec({});
  const out = new Array(AXES.length).fill(0);
  let totalWeight = 0;
  for (const { v, w } of vecs) {
    totalWeight += w;
    for (let i = 0; i < out.length; i += 1) out[i] += (v[i] || 0) * w;
  }
  return out.map((value) => Math.min(1, value / totalWeight));
}

export async function computeUserVectors(userId: string): Promise<{ long_term: Vec; value: Vec; conversation: Vec }> {
  const userContents = await getContents(userId);
  const weighted = userContents.map((content) => ({ v: content.vec, w: content.is_anchor ? 2 : 1 }));
  const longTerm = avgVec(weighted);
  const value = mask(longTerm, VALUE_AXES);
  const conversation = mask(longTerm, CONVERSATION_AXES);
  await db.insert(userVectors).values({ userId, longTerm, value, conversation }).onConflictDoUpdate({
    target: userVectors.userId,
    set: { longTerm, value, conversation, updatedAt: new Date() },
  });
  return { long_term: longTerm, value, conversation };
}

export interface UserVectors {
  long_term: Vec;
  value: Vec;
  conversation: Vec;
  current: Vec | null;
}

export async function getUserVectors(userId: string): Promise<UserVectors> {
  let [row] = await db.select().from(userVectors).where(eq(userVectors.userId, userId)).limit(1);
  if (!row) {
    const computed = await computeUserVectors(userId);
    row = {
      userId,
      longTerm: computed.long_term,
      value: computed.value,
      conversation: computed.conversation,
      current: null,
      updatedAt: new Date(),
    };
  }
  const now = new Date();
  const [latestState] = await db.select().from(currentStates)
    .where(eq(currentStates.userId, userId)).orderBy(desc(currentStates.createdAt)).limit(1);
  const activeState = latestState && isCurrentStateActive(latestState.expiresAt, now) ? latestState : null;
  const currentMatchText = activeState ? matchTextFromStoredCurrentState(activeState.text) : null;
  return {
    long_term: row.longTerm,
    value: row.value,
    conversation: row.conversation,
    current: currentMatchText ? stateVec(currentMatchText) : null,
  };
}

export async function setCurrentState(
  userId: string,
  selection: CurrentStateSelection,
  privateNote: PrivateNoteProcessing,
): Promise<string> {
  const id = `cs-${userId}-${Date.now()}`;
  const storedText = encodeCurrentState(selection, privateNote);
  const matchText = buildCurrentStateMatchText(selection);
  const current = stateVec(matchText);
  const expiresAt = currentStateExpiresAt();
  await db.transaction(async (tx) => {
    await tx.insert(currentStates).values({
      id,
      userId,
      text: storedText,
      mood: selection.mood,
      expiresAt,
    });
    await tx.update(userVectors).set({ current, updatedAt: new Date() }).where(eq(userVectors.userId, userId));
  });
  // P5 是增强路径：未配置 Embedding、尚未迁移或外部调用失败都不影响原有状态提交。
  try {
    await syncCurrentStateVector(userId, matchText, expiresAt);
  } catch (error) {
    console.warn('[current-state] pgvector 同步失败，继续使用内存向量：', error);
  }
  return id;
}

export async function getLatestCurrentState(userId: string) {
  const now = new Date();
  const [state] = await db.select().from(currentStates)
    .where(eq(currentStates.userId, userId)).orderBy(desc(currentStates.createdAt)).limit(1);
  return state && isCurrentStateActive(state.expiresAt, now) ? state : null;
}

/** 面向应用层的脱敏读取；旧版自由文本状态会被视为不可用。 */
export async function getLatestStructuredCurrentState(userId: string) {
  const state = await getLatestCurrentState(userId);
  if (!state) return null;
  const decoded = decodeCurrentState(state.text);
  if (!decoded) return null;
  return {
    id: state.id,
    userId: state.userId,
    selection: decoded.match,
    privateNoteStatus: decoded.privateNote.status,
    expiresAt: state.expiresAt,
    createdAt: state.createdAt,
  };
}

export async function hasUserVectors(userId: string): Promise<boolean> {
  const [row] = await db.select({ userId: userVectors.userId }).from(userVectors).where(eq(userVectors.userId, userId)).limit(1);
  return Boolean(row);
}

export function cosineSim(a: Vec, b: Vec): number {
  return cosine(a, b);
}
