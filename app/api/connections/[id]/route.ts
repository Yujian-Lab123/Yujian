import { NextResponse } from 'next/server';
import { getContent } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getDb } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const r = getDb().prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
  if (!r || (r.user_a !== uid && r.user_b !== uid)) return NextResponse.json({ ok: false, error: '连接不存在' }, { status: 404 });
  const me = getUser(uid)!;
  const other = getUser(r.user_a === uid ? r.user_b : r.user_a)!;
  const bridge = JSON.parse(r.bridge || '{}');
  return NextResponse.json({
    ok: true,
    me: { id: me.id, name: me.name, role: me.role, city: me.city, quote: me.quote, tags: me.tags, zhihu_years: me.zhihu_years, upvotes: me.upvotes },
    other: { id: other.id, name: other.name, role: other.role, city: other.city, quote: other.quote, tags: other.tags, zhihu_years: other.zhihu_years, upvotes: other.upvotes },
    shared: JSON.parse(r.shared || '[]'),
    question: bridge.conversation_question || '',
    difference: bridge.interesting_difference || null,
    anchor: getContent(r.question) || null,
  });
}
