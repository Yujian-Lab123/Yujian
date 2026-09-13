import { NextResponse } from 'next/server';
import { understandPrivateCurrentNote } from '@/lib/ai/current-state';
import { parseCurrentStateSelection } from '@/lib/current-state/privacy';
import { setCurrentState } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const parsedBody: unknown = await req.json().catch(() => ({}));
  const body = parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
    ? parsedBody as Record<string, unknown>
    : {};
  const selection = parseCurrentStateSelection({
    mood: body.mood,
    activity: body.activity,
    connectionMode: body.connectionMode,
  });
  if (!selection) {
    return NextResponse.json({ ok: false, error: '请完整选择心情、活动和交流状态' }, { status: 400 });
  }

  // 自由文本只在本次请求内交给 LLM；数据库永远只接收结构化选择和派生结果。
  const privateNote = typeof body.privateNote === 'string' ? body.privateNote.slice(0, 300) : '';
  const noteProcessing = await understandPrivateCurrentNote(privateNote);
  const id = await setCurrentState(uid, selection, noteProcessing);
  return NextResponse.json({ ok: true, id, note_status: noteProcessing.status });
}
