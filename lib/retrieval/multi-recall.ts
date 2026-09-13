import { cosine, type Vec } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';

export const RECALL_SOURCES = ['long_term', 'value', 'conversation', 'current'] as const;
export type RecallSource = (typeof RECALL_SOURCES)[number];

export const DEFAULT_RECALL_LIMITS: Record<RecallSource, number> = {
  long_term: 200,
  value: 200,
  conversation: 200,
  current: 200,
};

export interface RecallCandidate<TUser extends CandidateUser = CandidateUser> {
  user: TUser;
  vectors: UserVectors;
}

export interface RecalledCandidate<TUser extends CandidateUser = CandidateUser> extends RecallCandidate<TUser> {
  recallSources: RecallSource[];
  recallScores: Partial<Record<RecallSource, number>>;
  recallScore: number;
}

function hasSignal(vector: Vec | null): vector is Vec {
  return Boolean(vector?.some((value) => value !== 0));
}

function recallSimilarity(left: Vec | null, right: Vec | null): number | null {
  if (!hasSignal(left) || !hasSignal(right)) return null;
  return Math.max(0, Math.min(1, cosine(left, right)));
}

/** 四条内存召回通道各自 Top-K，再按用户去重合并。 */
export function multiRouteRecall<TUser extends CandidateUser>(
  viewer: UserVectors,
  candidates: RecallCandidate<TUser>[],
  limits: Partial<Record<RecallSource, number>> = {},
): RecalledCandidate<TUser>[] {
  const routeLimits = { ...DEFAULT_RECALL_LIMITS, ...limits };
  const merged = new Map<string, RecalledCandidate<TUser>>();
  let activeRoutes = 0;

  for (const source of RECALL_SOURCES) {
    const viewerVector = viewer[source];
    if (!hasSignal(viewerVector)) continue;
    activeRoutes += 1;
    const route = candidates
      .map((item) => ({ item, score: recallSimilarity(viewerVector, item.vectors[source]) }))
      .filter((entry): entry is { item: RecallCandidate<TUser>; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score || left.item.user.id.localeCompare(right.item.user.id))
      .slice(0, Math.max(0, routeLimits[source]));

    for (const { item, score } of route) {
      const existing = merged.get(item.user.id);
      if (existing) {
        if (!existing.recallSources.includes(source)) existing.recallSources.push(source);
        existing.recallScores[source] = score;
        existing.recallScore = Math.max(existing.recallScore, score);
      } else {
        merged.set(item.user.id, {
          ...item,
          recallSources: [source],
          recallScores: { [source]: score },
          recallScore: score,
        });
      }
    }
  }

  if (activeRoutes === 0 || merged.size === 0) {
    return candidates
      .map((item) => ({ ...item, recallSources: [], recallScores: {}, recallScore: 0 }))
      .sort((left, right) => left.user.id.localeCompare(right.user.id));
  }

  return [...merged.values()].sort(
    (left, right) => right.recallScore - left.recallScore || left.user.id.localeCompare(right.user.id),
  );
}
