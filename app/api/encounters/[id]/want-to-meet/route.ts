import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import { db, connectionIntents, connections, feedback } from '@/lib/db';
import { getUser } from '@/lib/db/users';
import { getRec } from '@/lib/retrieval/matcher';
import { getSessionUserId } from '@/lib/session';

// 双向确认：A 点击“想认识”后只产生 A→B 单向意愿；
// 只有 B→A 也存在才成立。Demo 阶段部分 Mock 用户会自动 reciprocate。
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const rec = await getRec(id);
  if (!rec || rec.viewer_id !== uid) return NextResponse.json({ ok: false, error: '推荐不存在' }, { status: 404 });
  const target = await getUser(rec.target_id);
  if (!target) return NextResponse.json({ ok: false, error: '用户不存在' }, { status: 404 });
  const reason: any = rec.reason || {};
  const pairKey = [uid, target.id].sort().join(':');
  const result = await db.transaction(async (tx) => {
    // 同一对用户的两个方向必须串行判断，否则 A/B 同时点击可能留下两条 pending。
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${pairKey}))`);

    const [existingConnection] = await tx.select({ id: connections.id }).from(connections)
      .where(or(
        and(eq(connections.userA, uid), eq(connections.userB, target.id)),
        and(eq(connections.userA, target.id), eq(connections.userB, uid)),
      )).limit(1);
    if (existingConnection) return { mutual: true as const, connectionId: existingConnection.id };

    const [reverseIntent] = await tx.select({ id: connectionIntents.id }).from(connectionIntents)
      .where(and(eq(connectionIntents.fromId, target.id), eq(connectionIntents.toId, uid)))
      .limit(1);
    const mutual = Boolean(reverseIntent) || Boolean(target.auto_reciprocate);
    const status = mutual ? 'mutual' : 'pending';

    await tx.insert(connectionIntents).values({
      id: `ci-${randomBytes(6).toString('hex')}`,
      fromId: uid,
      toId: target.id,
      recommendationId: id,
      status,
    }).onConflictDoUpdate({
      target: [connectionIntents.fromId, connectionIntents.toId],
      set: { recommendationId: id, status },
    });

    if (reverseIntent) {
      await tx.update(connectionIntents).set({ status: 'mutual' }).where(eq(connectionIntents.id, reverseIntent.id));
    }

    const [existingFeedback] = await tx.select({ id: feedback.id }).from(feedback).where(and(
      eq(feedback.recommendationId, id),
      eq(feedback.viewerId, uid),
      eq(feedback.type, 'want_to_meet'),
    )).limit(1);
    if (!existingFeedback) {
      await tx.insert(feedback).values({
        id: `fb-${randomBytes(6).toString('hex')}`,
        recommendationId: id,
        viewerId: uid,
        type: 'want_to_meet',
      });
    }

    if (!mutual) return { mutual: false as const };

    const [connection] = await tx.insert(connections).values({
      id: `conn-${randomBytes(6).toString('hex')}`,
      pairKey,
      userA: uid,
      userB: target.id,
      shared: (reason.shared_ground || []).map((value: any) => value.label),
      questionContentId: rec.anchor_id,
      bridge: reason,
    }).onConflictDoUpdate({
      target: connections.pairKey,
      set: { bridge: reason },
    }).returning({ id: connections.id });
    return { mutual: true as const, connectionId: connection.id };
  });

  if (result.mutual) {
    return NextResponse.json({ ok: true, mutual: true, connectionId: result.connectionId });
  }
  return NextResponse.json({
    ok: true, mutual: false,
    message: 'TA 会先读到最适合你的一篇内容。只有当 TA 也想认识你时，双方才会出现。',
  });
}
