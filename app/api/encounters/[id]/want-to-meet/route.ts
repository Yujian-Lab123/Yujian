import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getDb } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getRec } from '@/lib/retrieval/matcher';
import { getSessionUserId } from '@/lib/session';

// 双向确认：A 点击“想认识”后，B 不立即知道是谁；
// 只有 B 也选择“我也想认识 TA”才成立。Demo 阶段部分 Mock 用户会直接 reciprocate。
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const rec = getRec(id);
  if (!rec || rec.viewer_id !== uid) return NextResponse.json({ ok: false, error: '推荐不存在' }, { status: 404 });
  const target = getUser(rec.target_id);
  if (!target) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const d = getDb();

  d.prepare('INSERT INTO connection_intents (id, from_id, to_id, rec_id, status) VALUES (?,?,?,?,\'pending\')')
    .run(`ci-${randomBytes(6).toString('hex')}`, uid, target.id, id);
  d.prepare('INSERT INTO feedback (id, rec_id, viewer_id, type) VALUES (?,?,?,\'want_to_meet\')')
    .run(`fb-${randomBytes(6).toString('hex')}`, id, uid);

  const reason = JSON.parse(rec.reason || '{}');
  if (target.auto_reciprocate) {
    const connId = `conn-${randomBytes(6).toString('hex')}`;
    d.prepare('INSERT INTO connections (id, user_a, user_b, shared, question, bridge) VALUES (?,?,?,?,?,?)')
      .run(connId, uid, target.id, JSON.stringify((reason.shared_ground || []).map((x: any) => x.label)), rec.anchor_id, JSON.stringify(reason));
    d.prepare('UPDATE connection_intents SET status = \'mutual\' WHERE rec_id = ?').run(id);
    return NextResponse.json({ ok: true, mutual: true, connectionId: connId });
  }
  return NextResponse.json({
    ok: true, mutual: false,
    message: 'TA 会先读到最适合你的一篇内容。只有当 TA 也想认识你时，双方才会出现。',
  });
}
