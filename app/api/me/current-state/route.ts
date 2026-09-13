import { NextResponse } from 'next/server';
import { setCurrentState } from '@/lib/db';
import { getRealSessionUserId } from '@/lib/experience-mode/session';
import { validateRecord } from '@/lib/present-self/record';

export async function POST(req: Request) {
  const uid = await getRealSessionUserId();
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
