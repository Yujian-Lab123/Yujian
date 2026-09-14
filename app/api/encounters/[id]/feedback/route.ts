import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { db, feedback } from '@/lib/db';
import { getRec } from '@/lib/retrieval/matcher';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

// 反馈类型严格区分：喜欢内容 ≠ 想认识作者（概览 §三十三）
const TYPES = ['not_interested', 'content_interesting', 'learn_more', 'want_to_meet'];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const type = String(body.type || '');
  if (!TYPES.includes(type)) return NextResponse.json({ ok: false, error: '未知反馈类型' }, { status: 400 });
  const rec = await getRec(id);
  if (!rec || rec.viewer_id !== uid) return NextResponse.json({ ok: false, error: '推荐不存在' }, { status: 404 });
  await db.insert(feedback).values({ id: `fb-${randomBytes(6).toString('hex')}`, recommendationId: id, viewerId: uid, type });
  return NextResponse.json({ ok: true });
}
