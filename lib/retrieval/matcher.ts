import { and, eq, or } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { topAxes } from '../axes';
import { contentBridge, deepMatch, profileCompatibility } from '../ai/bridge';
import { db, getUserVectors, recommendations, connections, connectionIntents, feedback, type ContentRow } from '../db';
import { getUser, listUsers, type UserRow } from '../db/users';
import { areIntentsCompatible, intentCompatibilityScore } from './intent';

export interface RecCard {
  id: string;
  target: {
    id: string; name: string; role: string; city: string; quote: string;
    tags: string[]; zhihu_years: number; upvotes: string;
  };
  anchor: ContentRow;
  reason: string;
  shared: string[];
  difference: { label: string; note: string } | null;
  question: string;
  scores: { long_term: number; conversation: number; current: number; intent: number; novelty: number; coarse: number; rerank: number; compatibility: number; final: number };
  status: string;
  moment?: boolean;
}

interface Scored {
  u: UserRow;
  lt: number; val: number; conv: number; cur: number;
  intent: number; novelty: number; diversity: number;
  coarse: number; rerank: number; compatibility: number; final: number;
}

export async function buildEncounters(viewerId: string): Promise<RecCard[]> {
  const [viewer, viewerVectors, allUsers, existingRecs, existingConnections, existingIntents, ignored] = await Promise.all([
    getUser(viewerId),
    getUserVectors(viewerId),
    listUsers(),
    db.select({ targetId: recommendations.targetId }).from(recommendations).where(eq(recommendations.viewerId, viewerId)),
    db.select({ userA: connections.userA, userB: connections.userB }).from(connections)
      .where(or(eq(connections.userA, viewerId), eq(connections.userB, viewerId))),
    db.select({ fromId: connectionIntents.fromId, toId: connectionIntents.toId }).from(connectionIntents)
      .where(and(eq(connectionIntents.fromId, viewerId), eq(connectionIntents.status, 'pending'))),
    db.select({ targetId: recommendations.targetId }).from(feedback)
      .innerJoin(recommendations, eq(feedback.recommendationId, recommendations.id))
      .where(and(eq(feedback.viewerId, viewerId), eq(feedback.type, 'not_interested'))),
  ]);
  if (!viewer) return [];
  const currentViewer = viewer;

  const excluded = new Set<string>([
    ...existingConnections.map((item) => item.userA === viewerId ? item.userB : item.userA),
    ...existingIntents.map((item) => item.toId),
    ...ignored.map((item) => item.targetId),
  ]);
  let candidates = allUsers.filter((user) => user.id !== viewerId && user.encounter_enabled === 1 && !excluded.has(user.id));
  candidates = candidates.filter((user) => areIntentsCompatible(viewer.intents, user.intents));

  const vectorPairs = await Promise.all(candidates.map(async (user) => ({ user, vectors: await getUserVectors(user.id) })));
  const seen = new Set(existingRecs.map((item) => item.targetId));
  const scored: Scored[] = vectorPairs.map(({ user, vectors }) => ({
    u: user,
    lt: Math.max(0, cos0(viewerVectors.long_term, vectors.long_term)),
    val: cos0(viewerVectors.value, vectors.value),
    conv: cos0(viewerVectors.conversation, vectors.conversation),
    cur: viewerVectors.current && vectors.current ? cos0(viewerVectors.current, vectors.current) : 0,
    intent: intentCompatibilityScore(viewer.intents, user.intents),
    novelty: seen.has(user.id) ? 0.3 : 1,
    diversity: 0,
    coarse: 0,
    rerank: 0,
    compatibility: 0,
    final: 0,
  }));

  scored.sort((a, b) => b.lt - a.lt);
  const pickedAxes: string[] = [];
  for (const item of scored) {
    const vectors = vectorPairs.find((pair) => pair.user.id === item.u.id)!.vectors;
    const dominant = topAxes(vectors.long_term, 1)[0]?.axis || '';
    item.diversity = pickedAxes.length === 0 || !pickedAxes.includes(dominant) ? 1 : 0.4;
    pickedAxes.push(dominant);
    item.coarse = 0.3 * item.lt + 0.25 * item.conv + 0.2 * item.cur + 0.15 * item.intent + 0.05 * item.novelty + 0.05 * item.diversity;
    item.rerank = 0.7 * item.coarse + 0.3 * item.val;
    item.compatibility = profileCompatibility(viewerVectors, vectors);
    item.final = 0.55 * item.rerank + 0.45 * item.compatibility;
  }
  scored.sort((a, b) => b.final - a.final);

  async function makeCard(item: Scored): Promise<RecCard | null> {
    const bridge = await contentBridge(viewerId, item.u.id);
    if (!bridge) return null;
    const [existing] = await db.select().from(recommendations).where(and(
      eq(recommendations.viewerId, viewerId), eq(recommendations.targetId, item.u.id), eq(recommendations.status, 'fresh'),
    )).limit(1);
    const reason = existing?.reason && Object.keys(existing.reason).length
      ? existing.reason as any
      : { ...(await deepMatch(currentViewer, item.u, bridge.anchor.vec)), bridge_reason: bridge.reason };
    const proposedId = existing?.id || `rec-${randomBytes(6).toString('hex')}`;
    const scores = { lt: item.lt, conv: item.conv, cur: item.cur, intent: item.intent, novelty: item.novelty, coarse: item.coarse, rerank: item.rerank, compatibility: item.compatibility, final: item.final };
    const anchorId = bridge.anchor.source === 'contents' ? bridge.anchor.id : null;
    const bridgeMetadata = {
      anchor_source: bridge.anchor.source,
      anchor_snapshot: bridge.anchor.source === 'profile_artifact' ? bridge.anchor : null,
    };
    const [saved] = await db.insert(recommendations).values({
      id: proposedId, viewerId, targetId: item.u.id, scores, anchorId, reason, bridge: bridgeMetadata, status: 'fresh',
    }).onConflictDoUpdate({
      target: [recommendations.viewerId, recommendations.targetId, recommendations.status],
      set: { scores, anchorId, reason, bridge: bridgeMetadata },
    }).returning({ id: recommendations.id });
    return {
      id: saved.id,
      target: { id: item.u.id, name: item.u.name, role: item.u.role, city: item.u.city, quote: item.u.quote, tags: item.u.tags, zhihu_years: item.u.zhihu_years, upvotes: item.u.upvotes },
      anchor: bridge.anchor,
      reason: reason.bridge_reason || reason.why_for_viewer || '',
      shared: (reason.shared_ground || []).map((value: any) => value.label),
      difference: reason.interesting_difference || null,
      question: reason.conversation_question || '',
      scores: { long_term: item.lt, conversation: item.conv, current: item.cur, intent: item.intent, novelty: item.novelty, coarse: item.coarse, rerank: item.rerank, compatibility: item.compatibility, final: item.final },
      status: 'fresh',
    };
  }

  const cards = (await Promise.all(scored.slice(0, 3).map(makeCard))).filter((card): card is RecCard => Boolean(card));
  if (viewerVectors.current) {
    const momentCandidate = [...scored].sort((a, b) => b.cur - a.cur)[0];
    if (momentCandidate?.cur >= 0.55) {
      const existing = cards.find((card) => card.target.id === momentCandidate.u.id);
      if (existing) {
        existing.moment = true;
        cards.splice(cards.indexOf(existing), 1);
        cards.unshift(existing);
      } else {
        const card = await makeCard(momentCandidate);
        if (card) { card.moment = true; cards.unshift(card); }
      }
    }
  }
  return cards;
}

function cos0(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  let dot = 0; let left = 0; let right = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] || 0) * (b[i] || 0);
    left += (a[i] || 0) ** 2;
    right += (b[i] || 0) ** 2;
  }
  return left && right ? dot / (Math.sqrt(left) * Math.sqrt(right)) : 0;
}

export async function getRec(id: string) {
  const [row] = await db.select().from(recommendations).where(eq(recommendations.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    viewer_id: row.viewerId,
    target_id: row.targetId,
    scores: row.scores,
    anchor_id: row.anchorId,
    reason: row.reason,
    bridge: row.bridge,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}
