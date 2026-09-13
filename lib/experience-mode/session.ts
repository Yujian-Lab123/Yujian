import { cookies } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sessions, users } from '@/lib/db/schema';
import { SESSION_MAX_AGE_SECONDS, createSession, sessionCookieOptions } from '@/lib/session';

/**
 * 体验模式会话层（真实 / Demo 隔离）。
 *
 * 隔离原则：
 * - 真实会话 Cookie：yj_session（沿用原名，真实 OAuth 登录写入，仅认 is_mock=0 用户）。
 * - 演示会话 Cookie：yj_demo_session（Demo 登录写入，仅认 is_mock=1 用户）。
 * - 两种 Cookie 名不同、互相不读取：真实 API 永远不解析演示会话，反之亦然。
 * - 即使有人把真实 session id 手工塞进演示 Cookie（或反之），交叉校验 is_mock
 *   也会拒绝——身份永远跟随「哪个 Cookie + 该 Cookie 绑定的用户类型」。
 */

export const SESSION_COOKIE_REAL = 'yj_session';
export const SESSION_COOKIE_DEMO = 'yj_demo_session';

export type ExperienceMode = 'real' | 'demo';

export interface ExperienceIdentity {
  userId: string;
  isMock: boolean;
}

async function loadSessionUser(cookieName: string, expectMock: boolean): Promise<ExperienceIdentity | null> {
  const store = await cookies();
  const id = store.get(cookieName)?.value;
  if (!id) return null;
  const [row] = await db.select({ userId: sessions.userId, isMock: users.isMock })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt)))
    .limit(1);
  if (!row) return null;
  // 交叉校验：真实会话必须绑定真实用户，演示会话必须绑定 Mock 用户。
  if (Boolean(row.isMock) !== expectMock) return null;
  return { userId: row.userId, isMock: Boolean(row.isMock) };
}

/** 真实模式身份：只认 yj_session，且用户必须是真实账号（is_mock=0）。 */
export async function getRealSessionUserId(): Promise<string | null> {
  const identity = await loadSessionUser(SESSION_COOKIE_REAL, false);
  return identity?.userId ?? null;
}

/** 演示模式身份：只认 yj_demo_session，且用户必须是 Mock 账号（is_mock=1）。 */
export async function getDemoSessionUserId(): Promise<string | null> {
  const identity = await loadSessionUser(SESSION_COOKIE_DEMO, true);
  return identity?.userId ?? null;
}

/** 当前请求是否携带有效的演示会话（用于真实 API 对演示用户的产品化引导）。 */
export async function hasDemoSession(): Promise<boolean> {
  return (await loadSessionUser(SESSION_COOKIE_DEMO, true)) !== null;
}

/** 创建演示会话并返回 Cookie 赋值所需信息（复用 sessions 表，靠 Cookie 名隔离）。 */
export async function createDemoSession(userId: string): Promise<{ id: string; options: typeof sessionCookieOptions }> {
  const id = await createSession(userId);
  return { id, options: sessionCookieOptions };
}

export const DEMO_SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS;
