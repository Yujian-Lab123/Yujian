import { NextResponse } from 'next/server';
import { desc, eq, or, and } from 'drizzle-orm';
import { connectionIntents, connections, db } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getSessionUserId } from '@/lib/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const [mutualRows, pendingRows] = await Promise.all([
    db.select().from(connections).where(or(eq(connections.userA, userId), eq(connections.userB, userId))).orderBy(desc(connections.createdAt)),
    db.select().from(connectionIntents).where(and(eq(connectionIntents.fromId, userId), eq(connectionIntents.status, 'pending'))).orderBy(desc(connectionIntents.createdAt)),
  ]);
  const mutual = await Promise.all(mutualRows.map(async (row) => {
    const otherId = row.userA === userId ? row.userB : row.userA;
    const other = await getUser(otherId);
    return { id: row.id, type: 'mutual', other, shared: row.shared, question: String(row.bridge.conversation_question || ''), created_at: row.createdAt.toISOString() };
  }));
  const pending = await Promise.all(pendingRows.map(async (row) => ({
    id: row.id,
    type: 'pending',
    other: await getUser(row.toId),
    created_at: row.createdAt.toISOString(),
  })));
  return NextResponse.json({ ok: true, connections: [...mutual, ...pending] });
}
