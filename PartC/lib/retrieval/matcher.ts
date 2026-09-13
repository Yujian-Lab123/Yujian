import { and, eq, or } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { contentBridge, deepMatch } from '../ai/bridge';
import { db, getUserVectors, recommendations, connections, connectionIntents, feedback } from '../db';
import { annRecallProfiles } from '../db/vector-index';
import { getUser, listUsers } from '../db/users';
import { filterEligibleCandidates } from './candidate-filter';
import type { RecCard } from './contracts';
import { multiRouteRecall, type RecalledCandidate } from './multi-recall';
import { rerankWithModel } from './rerank-pipeline';
import { pairScoreBreakdown, rankRecalledCandidates, type RankedCandidate } from './scoring';

export type { RecCard } from './contracts';

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

  const candidates = filterEligibleCandidates(allUsers, {
    viewerId,
    viewerIntents: viewer.intents,
    connectedUserIds: new Set(existingConnections.map((item) => item.userA === viewerId ? item.userB : item.userA)),
    outgoingPendingTargetIds: new Set(existingIntents.map((item) => item.toId)),
    ignoredTargetIds: new Set(ignored.map((item) => item.targetId)),
  });

  const seen = new Set(existingRecs.map((item) => item.targetId));
  let rankingViewerVectors = viewerVectors;
  let retrievalMode: 'pgvector' | 'memory' = 'memory';
  let recalled: RecalledCandidate<typeof candidates[number]>[] | null = null;

  // P5 增强路径：索引或真实向量未就绪时，自动保留原有 Demo 召回，页面/API 不降级为空。
  try {
    const indexed = await annRecallProfiles(viewerId, candidates.map((candidate) => candidate.id));
    if (indexed?.candidates.length) {
      const usersById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
      recalled = indexed.candidates.flatMap((candidate) => {
        const user = usersById.get(candidate.userId);
        return user ? [{ user, ...candidate }] : [];
      });
      if (recalled.length) {
        rankingViewerVectors = indexed.viewerVectors;
        retrievalMode = 'pgvector';
      }
    }
  } catch (error) {
    console.warn('[matcher] pgvector ANN 不可用，自动降级内存召回：', error);
  }

  if (!recalled?.length) {
    const vectorPairs = await Promise.all(candidates.map(async (user) => ({ user, vectors: await getUserVectors(user.id) })));
    recalled = multiRouteRecall(viewerVectors, vectorPairs);
  }
  const algorithmicScored = rankRecalledCandidates({
    viewerVectors: rankingViewerVectors,
    viewerIntents: viewer.intents,
    candidates: recalled,
    seenTargetIds: seen,
  });
  const reranked = await rerankWithModel(currentViewer, algorithmicScored);
  const scored = reranked.candidates;

  async function makeCard(item: RankedCandidate<typeof candidates[number]>): Promise<RecCard | null> {
    const bridge = await contentBridge(viewerId, item.user.id);
    if (!bridge) return null;
    const [existing] = await db.select().from(recommendations).where(and(
      eq(recommendations.viewerId, viewerId), eq(recommendations.targetId, item.user.id), eq(recommendations.status, 'fresh'),
    )).limit(1);
    const reason = existing?.reason && Object.keys(existing.reason).length
      ? existing.reason as any
      : { ...(await deepMatch(currentViewer, item.user, bridge.anchor.vec)), bridge_reason: bridge.reason };
    const id = existing?.id || `rec-${randomBytes(6).toString('hex')}`;
    const scores = {
      lt: item.lt, val: item.val, conv: item.conv, cur: item.cur,
      intent: item.intent, novelty: item.novelty, diversity: item.diversity,
      recall: item.recall.max_score, coarse: item.coarse, rerank: item.rerank,
      forward: item.forward, backward: item.backward, mutual: item.mutual, final: item.final,
    };
    const directionalityMode = pairScoreBreakdown(rankingViewerVectors, item.vectors).mode;
    const bridgeDebug = {
      recall_sources: item.recall.sources,
      recall_scores: item.recall.scores,
      retrieval_mode: retrievalMode,
      rerank_mode: reranked.mode,
      directionality_mode: directionalityMode,
      forward: item.forward,
      backward: item.backward,
      ...(reranked.model ? { rerank_model: reranked.model } : {}),
      ...(reranked.apiStyle ? { rerank_api_style: reranked.apiStyle } : {}),
    };
    await db.insert(recommendations).values({
      id, viewerId, targetId: item.user.id, scores, anchorId: bridge.anchor.id, reason, bridge: bridgeDebug, status: 'fresh',
    }).onConflictDoUpdate({
      target: [recommendations.viewerId, recommendations.targetId, recommendations.status],
      set: { scores, anchorId: bridge.anchor.id, reason, bridge: bridgeDebug },
    });
    return {
      id,
      target: { id: item.user.id, name: item.user.name, role: item.user.role, city: item.user.city, quote: item.user.quote, tags: item.user.tags, zhihu_years: item.user.zhihu_years, upvotes: item.user.upvotes },
      anchor: bridge.anchor,
      reason: reason.bridge_reason || reason.why_for_viewer || '',
      shared: (reason.shared_ground || []).map((value: any) => value.label),
      difference: reason.interesting_difference || null,
      question: reason.conversation_question || '',
      scores: {
        long_term: item.lt, value: item.val, conversation: item.conv, current: item.cur,
        intent: item.intent, novelty: item.novelty, diversity: item.diversity,
        recall: item.recall.max_score, coarse: item.coarse, rerank: item.rerank,
        forward: item.forward, backward: item.backward, mutual: item.mutual, final: item.final,
      },
      recall_sources: item.recall.sources,
      recall_scores: item.recall.scores,
      retrieval_mode: retrievalMode,
      rerank_mode: reranked.mode,
      ...(reranked.model ? { rerank_model: reranked.model } : {}),
      status: 'fresh',
    };
  }

  const cards = (await Promise.all(scored.slice(0, 3).map(makeCard))).filter((card): card is RecCard => Boolean(card));
  if (rankingViewerVectors.current) {
    const momentCandidate = [...scored].sort((a, b) => b.cur - a.cur)[0];
    if (momentCandidate?.cur >= 0.55) {
      const existing = cards.find((card) => card.target.id === momentCandidate.user.id);
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
