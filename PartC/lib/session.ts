import { cookies } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from './db/client';
import { sessions } from './db/schema';

export const SESSION_COOKIE = 'yj_session';
export const OAUTH_STATE_COOKIE = 'yj_oauth_state';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const [row] = await db.select({ userId: sessions.userId }).from(sessions).where(and(
    eq(sessions.id, id),
    gt(sessions.expiresAt, new Date()),
    isNull(sessions.revokedAt),
  )).limit(1);
  return row?.userId || null;
}

export async function createSession(userId: string): Promise<string> {
  const id = randomBytes(18).toString('base64url');
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
  return id;
}

export async function revokeSession(id: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};
