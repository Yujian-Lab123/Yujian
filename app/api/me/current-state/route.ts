import { NextResponse } from 'next/server';
import { setCurrentState } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').slice(0, 200);
  const mood = String(body.mood || '');
  if (!text && !mood) return NextResponse.json({ ok: false, error: '内容不能为空' }, { status: 400 });
  const id = setCurrentState(uid, text || mood, mood);
  return NextResponse.json({ ok: true, id });
}
