import { NextResponse } from 'next/server';
import { createSession, SESSION_COOKIE } from '@/lib/session';
import { getUser } from '@/lib/db/users';

// Demo 模式登录：Mock 知乎 OAuth。接入真实 OAuth 后，此路由仅用于比赛演示切换身份。
export async function POST(req: Request) {
  let userId = 'u0';
  try {
    const body = await req.json();
    if (body?.userId && getUser(body.userId)) userId = body.userId;
  } catch { /* 默认 u0 */ }
  const user = getUser(userId);
  if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const sid = createSession(userId);
  const res = NextResponse.json({ ok: true, user: { ...user, tags: user.tags, intents: user.intents }, demo: true });
  res.cookies.set(SESSION_COOKIE, sid, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
  return res;
}
