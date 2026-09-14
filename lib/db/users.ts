import { and, eq } from 'drizzle-orm';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { db } from './client';
import { externalIdentities, users } from './schema';

export interface UserRow {
  id: string;
  zhihu_user_id: string;
  name: string;
  role: string;
  city: string;
  quote: string;
  tags: string[];
  intents: string[];
  zhihu_years: number;
  upvotes: string;
  encounter_enabled: number;
  auto_reciprocate: number;
  is_mock: number;
}

function mapUser(row: typeof users.$inferSelect): UserRow {
  return {
    id: row.id,
    zhihu_user_id: row.zhihuUserId || '',
    name: row.name,
    role: row.role,
    city: row.city,
    quote: row.quote,
    tags: row.tags,
    intents: row.intents,
    zhihu_years: row.zhihuYears,
    upvotes: row.upvotes,
    encounter_enabled: row.encounterEnabled ? 1 : 0,
    auto_reciprocate: row.autoReciprocate ? 1 : 0,
    is_mock: row.isMock ? 1 : 0,
  };
}

export async function getUser(id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? mapUser(row) : null;
}

export async function listUsers(): Promise<UserRow[]> {
  const rows = await db.select().from(users).orderBy(users.id);
  return rows.map(mapUser);
}

export async function setEncounterEnabled(id: string, enabled: boolean): Promise<void> {
  await db.update(users).set({ encounterEnabled: enabled }).where(eq(users.id, id));
}

export async function findUserIdByZhihuId(zhihuUserId: string): Promise<string | null> {
  const [row] = await db.select({ userId: externalIdentities.userId }).from(externalIdentities)
    .where(and(eq(externalIdentities.provider, 'zhihu'), eq(externalIdentities.externalUserId, zhihuUserId))).limit(1);
  return row?.userId || null;
}

export async function upsertRealUser(profile: {
  zhihuUserId: string;
  name: string;
  headline: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
}): Promise<string> {
  const existing = await findUserIdByZhihuId(profile.zhihuUserId);
  if (existing) {
    await db.update(users).set({ name: profile.name, quote: profile.headline || '' }).where(eq(users.id, existing));
    return existing;
  }
  const id = `real-${profile.zhihuUserId}`.slice(0, 60);
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      zhihuUserId: profile.zhihuUserId,
      name: profile.name,
      role: profile.headline || '知乎用户',
      quote: profile.headline || '',
      isMock: false,
      encounterEnabled: true,
    }).onConflictDoUpdate({ target: users.id, set: { name: profile.name, quote: profile.headline || '' } });
    await tx.insert(externalIdentities).values({
      provider: 'zhihu', externalUserId: profile.zhihuUserId, userId: id, profile: { ...profile },
    }).onConflictDoNothing();
  });
  return id;
}

function encryptToken(token: string): string {
  const source = process.env.TOKEN_ENCRYPTION_KEY;
  if (!source) throw new Error('OAuth 已启用，但缺少 TOKEN_ENCRYPTION_KEY');
  const key = createHash('sha256').update(source).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export async function saveZhihuAuth(
  userId: string,
  zhihuUserId: string,
  accessToken: string,
  expiresAt: number | null,
  profile: Record<string, unknown>,
  rawContents: unknown[],
): Promise<void> {
  const encryptedAccessToken = encryptToken(accessToken);
  await db.insert(externalIdentities).values({
    provider: 'zhihu', externalUserId: zhihuUserId, userId, encryptedAccessToken,
    tokenExpiresAt: expiresAt ? new Date(expiresAt) : null, profile, rawContents, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [externalIdentities.provider, externalIdentities.externalUserId],
    set: { userId, encryptedAccessToken, tokenExpiresAt: expiresAt ? new Date(expiresAt) : null, profile, rawContents, updatedAt: new Date() },
  });
}

/** 身份附加信息（头像/主页/一句话），来自 external_identities.profile，
 *  供 /api/me 等接口在用户对象上附带展示字段（users 表本身不存头像列）。 */
export async function getIdentityExtras(userId: string): Promise<{ avatarUrl: string | null; profileUrl: string | null; headline: string | null } | null> {
  const [row] = await db.select({ profile: externalIdentities.profile }).from(externalIdentities)
    .where(and(eq(externalIdentities.provider, 'zhihu'), eq(externalIdentities.userId, userId))).limit(1);
  if (!row) return null;
  const p = (row.profile || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return { avatarUrl: str(p.avatarUrl), profileUrl: str(p.profileUrl), headline: str(p.headline) };
}
