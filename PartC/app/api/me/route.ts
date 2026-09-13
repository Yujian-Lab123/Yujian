import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { getLatestStructuredCurrentState, hasUserVectors } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getSessionUserId } from '@/lib/session';

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: '未登录', loginRequired: true }, { status: 401 });
  const user = await getUser(uid);
  if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const [cs, analyzed] = await Promise.all([getLatestStructuredCurrentState(uid), hasUserVectors(uid)]);
  return NextResponse.json({
    ok: true,
    user,
    currentState: cs ? {
      selection: cs.selection,
      private_note_status: cs.privateNoteStatus,
      created_at: cs.createdAt.toISOString(),
    } : null,
    understanding: analyzed ? await buildUnderstanding(uid) : null,
  });
}
