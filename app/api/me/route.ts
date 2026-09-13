import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { getLatestCurrentState, hasUserVectors } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getRealSessionUserId, hasDemoSession } from '@/lib/experience-mode/session';

export async function GET() {
  const uid = await getRealSessionUserId();
  if (!uid) {
    // 真实路由不展示任何演示数据；若用户携带演示会话，透出标记供页面引导前往 /demo。
    const demoSession = await hasDemoSession();
    return NextResponse.json({ ok: false, error: '未登录', loginRequired: true, demoSession }, { status: 401 });
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
