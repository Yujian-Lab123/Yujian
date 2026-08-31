import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { getDb } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getSessionUserId } from '@/lib/session';

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: '未登录', loginRequired: true }, { status: 401 });
  const user = getUser(uid);
  if (!user) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const cs = getDb().prepare('SELECT * FROM current_states WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(uid) as any;
  const analyzed = Boolean(getDb().prepare('SELECT 1 FROM user_vectors WHERE user_id = ?').get(uid));
  return NextResponse.json({
    ok: true,
    user,
    currentState: cs ? { text: cs.text, mood: cs.mood, created_at: cs.created_at } : null,
    understanding: analyzed ? buildUnderstanding(uid) : null,
  });
}
