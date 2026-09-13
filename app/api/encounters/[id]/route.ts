import { NextResponse } from 'next/server';
import { getBridgeContents } from '@/lib/ai/bridge';
import { getUser } from '@/lib/db/users';
import { getRec } from '@/lib/retrieval/matcher';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const rec = await getRec(id);
  if (!rec || rec.viewer_id !== uid) return NextResponse.json({ ok: false, error: '推荐不存在' }, { status: 404 });
  const target = await getUser(rec.target_id);
  if (!target) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const reason: any = rec.reason || {};
  const bridge = rec.bridge as { anchor_snapshot?: { id?: string } | null } | null;
  const anchorId = rec.anchor_id || bridge?.anchor_snapshot?.id || null;
  const others = (await getBridgeContents(target.id)).filter((content) => content.id !== anchorId).slice(0, 3);
  return NextResponse.json({
    ok: true,
    rec: {
      id: rec.id,
      target: { id: target.id, name: target.name, role: target.role, city: target.city, quote: target.quote, tags: target.tags, zhihu_years: target.zhihu_years, upvotes: target.upvotes },
      shared: (reason.shared_ground || []).map((x: any) => x.label),
      difference: reason.interesting_difference,
      question: reason.conversation_question,
      whyForTarget: reason.why_for_target,
    },
    otherContents: others,
  });
}
