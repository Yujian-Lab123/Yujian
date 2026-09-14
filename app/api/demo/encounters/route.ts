// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { NextResponse } from 'next/server';
import { buildEncounters } from '@/lib/retrieval/matcher';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';
import { filterPoolByMode } from '@/lib/experience-mode/pool';

export async function GET() {
  const uid = await getDemoSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  // 演示模式：候选池仅保留 Mock 用户，绝不暴露真实用户。
  const cards = await filterPoolByMode(await buildEncounters(uid), 'demo');
  return NextResponse.json({ ok: true, encounters: cards });
}
