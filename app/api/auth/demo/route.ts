import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { revokeSession } from '@/lib/session';
import { pickDemoIdentity } from '@/lib/experience-mode/identity';
import {
  SESSION_COOKIE_DEMO, createDemoSession, getDemoSessionUserId,
} from '@/lib/experience-mode/session';

// Demo 模式登录：仅用于比赛演示与无凭证预览。
// 生产环境默认关闭（DEMO_AUTH_ENABLED !== 'true' 时 404）。
export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_AUTH_ENABLED !== 'true') {
    return NextResponse.json({ ok: false, error: 'Demo 登录未启用' }, { status: 404 });
  }
  // 安全要求：不接受客户端传入的 userId（防止任意切换/伪装人物）。
  // 演示身份由服务端从 Mock 用户池中按天确定性轮换。
  const rows = await db.select({ id: users.id, is_mock: users.isMock }).from(users).where(eq(users.isMock, true));
  const demoUserId = pickDemoIdentity(rows);
  if (!demoUserId) return NextResponse.json({ ok: false, error: '演示身份池为空，请先运行 db:seed' }, { status: 503 });

  const { id, options } = await createDemoSession(demoUserId);
  const res = NextResponse.json({ ok: true, demo: true, userId: demoUserId });
  res.cookies.set(SESSION_COOKIE_DEMO, id, options);
  return res;
}

// 退出演示模式：吊销演示会话并清除演示 Cookie（不影响真实会话）。
export async function DELETE() {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE_DEMO)?.value;
  if (sid) await revokeSession(sid);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_DEMO, '', { path: '/', maxAge: 0 });
  return res;
}

// 当前演示身份查询（供 /demo 页面免登录探测）。
export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_AUTH_ENABLED !== 'true') {
    return NextResponse.json({ ok: false, error: 'Demo 登录未启用' }, { status: 404 });
  }
  const userId = await getDemoSessionUserId();
  return NextResponse.json({ ok: true, demoSession: Boolean(userId), userId });
}
