// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { getLatestCurrentState, hasUserVectors } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';

export async function GET() {
  const uid = await getDemoSessionUserId();
  if (!uid) {
    return NextResponse.json({ ok: false, error: '未登录', loginRequired: true, demoSession: false }, { status: 401 });
  }
  const user = await getUser(uid);
  if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const [cs, analyzed] = await Promise.all([getLatestCurrentState(uid), hasUserVectors(uid)]);
  return NextResponse.json({
    ok: true,
    user,
    currentState: cs ? { text: cs.text, mood: cs.mood, created_at: cs.createdAt.toISOString() } : null,
    understanding: analyzed ? await buildUnderstanding(uid) : null,
  });
}
