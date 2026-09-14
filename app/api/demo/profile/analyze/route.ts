// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { computeUserVectors } from '@/lib/db';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';

// 离线理解管线入口：OAuth 后“认真做一次”；增量阶段只处理新内容。
export async function POST() {
  const uid = await getDemoSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  await computeUserVectors(uid);
  return NextResponse.json({ ok: true, understanding: await buildUnderstanding(uid) });
}
