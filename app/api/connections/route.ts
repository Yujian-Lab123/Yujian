import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getSessionUserId } from '@/lib/session';

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const d = getDb();
  const mutual = (d.prepare('SELECT * FROM connections WHERE user_a = ? OR user_b = ? ORDER BY created_at DESC').all(uid, uid) as any[])
    .map((r) => {
      const otherId = r.user_a === uid ? r.user_b : r.user_a;
      const other = getUser(otherId);
      return { id: r.id, type: 'mutual', other, shared: JSON.parse(r.shared || '[]'), question: (JSON.parse(r.bridge || '{}')).conversation_question || '', created_at: r.created_at };
    });
  const pending = (d.prepare("SELECT * FROM connection_intents WHERE from_id = ? AND status = 'pending' ORDER BY created_at DESC").all(uid) as any[])
    .map((r) => ({ id: r.id, type: 'pending', other: getUser(r.to_id), created_at: r.created_at }));
  return NextResponse.json({ ok: true, connections: [...mutual, ...pending] });
}
