// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { NextResponse } from 'next/server';
import { desc, eq, or, and } from 'drizzle-orm';
import { connectionIntents, connections, db } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';

export async function GET() {
  const userId = await getDemoSessionUserId();
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
