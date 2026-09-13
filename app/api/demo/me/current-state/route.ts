// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { NextResponse } from 'next/server';
import { setCurrentState } from '@/lib/db';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';
import { validateRecord } from '@/lib/present-self/record';

export async function POST(req: Request) {
  const uid = await getDemoSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  let record;
  try {
    record = validateRecord(await req.json());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof SyntaxError ? '请求格式不正确' : error instanceof Error ? error.message : '记录无效' }, { status: 400 });
  }
  try {
    const id = await setCurrentState(uid, record.text, record.mood);
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ ok: false, error: '保存失败，请稍后重试' }, { status: 500 });
  }
}
