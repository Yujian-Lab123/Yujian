import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { db, connectionIntents, connections, feedback } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getRec } from '@/lib/retrieval/matcher';
import { getSessionUserId } from '@/lib/session';

// 双向确认：A 点击“想认识”后，B 不立即知道是谁；
// 只有 B 也选择“我也想认识 TA”才成立。Demo 阶段部分 Mock 用户会直接 reciprocate。
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const rec = await getRec(id);
  if (!rec || rec.viewer_id !== uid) return NextResponse.json({ ok: false, error: '推荐不存在' }, { status: 404 });
  const target = await getUser(rec.target_id);
  if (!target) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const reason: any = rec.reason || {};
  if (target.auto_reciprocate) {
    const pairKey = [uid, target.id].sort().join(':');
    const connId = await db.transaction(async (tx) => {
      await tx.insert(connectionIntents).values({ id: `ci-${randomBytes(6).toString('hex')}`, fromId: uid, toId: target.id, recommendationId: id, status: 'mutual' })
        .onConflictDoUpdate({ target: [connectionIntents.fromId, connectionIntents.toId], set: { recommendationId: id, status: 'mutual' } });
      await tx.insert(feedback).values({ id: `fb-${randomBytes(6).toString('hex')}`, recommendationId: id, viewerId: uid, type: 'want_to_meet' });
      const [connection] = await tx.insert(connections).values({
        id: `conn-${randomBytes(6).toString('hex')}`,
        pairKey,
        userA: uid,
        userB: target.id,
        shared: (reason.shared_ground || []).map((value: any) => value.label),
        questionContentId: rec.anchor_id,
        bridge: reason,
      }).onConflictDoUpdate({ target: connections.pairKey, set: { bridge: reason } }).returning({ id: connections.id });
      return connection.id;
    });
    return NextResponse.json({ ok: true, mutual: true, connectionId: connId });
  }
  await db.transaction(async (tx) => {
    await tx.insert(connectionIntents).values({ id: `ci-${randomBytes(6).toString('hex')}`, fromId: uid, toId: target.id, recommendationId: id, status: 'pending' })
      .onConflictDoUpdate({ target: [connectionIntents.fromId, connectionIntents.toId], set: { recommendationId: id, status: 'pending' } });
    await tx.insert(feedback).values({ id: `fb-${randomBytes(6).toString('hex')}`, recommendationId: id, viewerId: uid, type: 'want_to_meet' });
  });
  return NextResponse.json({
    ok: true, mutual: false,
    message: 'TA 会先读到最适合你的一篇内容。只有当 TA 也想认识你时，双方才会出现。',
  });
}
