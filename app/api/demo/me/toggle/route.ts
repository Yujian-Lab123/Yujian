// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { NextResponse } from 'next/server';
import { getUser, setEncounterEnabled } from '@/lib/db/users';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';

export async function POST(req: Request) {
  const uid = await getDemoSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: '连接意愿必须为布尔值' }, { status: 400 });
  }
  try {
    const user = await getUser(uid);
    if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
    await setEncounterEnabled(uid, body.enabled);
    return NextResponse.json({ ok: true, encounter_enabled: body.enabled ? 1 : 0 });
  } catch {
    return NextResponse.json({ ok: false, error: '更新失败，请稍后重试' }, { status: 500 });
  }
}
