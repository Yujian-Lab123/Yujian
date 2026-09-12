import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { connections, db, getContent } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getSessionUserId } from '@/lib/session';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const [row] = await db.select().from(connections).where(eq(connections.id, id)).limit(1);
  if (!row || (row.userA !== userId && row.userB !== userId)) return NextResponse.json({ ok: false, error: '连接不存在' }, { status: 404 });
  const [me, other, anchor] = await Promise.all([
    getUser(userId),
    getUser(row.userA === userId ? row.userB : row.userA),
    row.questionContentId ? getContent(row.questionContentId) : Promise.resolve(null),
  ]);
  if (!me || !other) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  return NextResponse.json({
    ok: true,
    me: { id: me.id, name: me.name, role: me.role, city: me.city, quote: me.quote, tags: me.tags, zhihu_years: me.zhihu_years, upvotes: me.upvotes },
    other: { id: other.id, name: other.name, role: other.role, city: other.city, quote: other.quote, tags: other.tags, zhihu_years: other.zhihu_years, upvotes: other.upvotes },
    shared: row.shared,
    question: String(row.bridge.conversation_question || ''),
    difference: row.bridge.interesting_difference || null,
    anchor,
  });
}
