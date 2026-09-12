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

export interface MultiRecallOptions {
  limits?: Partial<Record<RecallSource, number>>;
}

function hasSignal(vector: Vec | null): vector is Vec {
  return Boolean(vector?.some((value) => value !== 0));
}

function recallSimilarity(left: Vec | null, right: Vec | null): number | null {
  if (!hasSignal(left) || !hasSignal(right)) return null;
  return Math.max(0, Math.min(1, cosine(left, right)));
}

/**
 * P2 Mock 多路召回：四条通道各自 Top-K，再按用户去重合并。
 * 将来切换 pgvector 时，只需替换每条通道的候选获取方式，输出契约保持不变。
 */
export function multiRouteRecall<TUser extends CandidateUser>(
  viewer: UserVectors,
  candidates: RecallCandidate<TUser>[],
  options: MultiRecallOptions = {},
): RecalledCandidate<TUser>[] {
  const limits = { ...DEFAULT_RECALL_LIMITS, ...options.limits };
  const merged = new Map<string, RecalledCandidate<TUser>>();
  let activeRoutes = 0;

  for (const source of RECALL_SOURCES) {
    const viewerVector = viewer[source];
    if (!hasSignal(viewerVector)) continue;
    activeRoutes += 1;

    const route = candidates
      .map((candidate) => ({
        candidate,
        score: recallSimilarity(viewerVector, candidate.vectors[source]),
      }))
      .filter((item): item is { candidate: RecallCandidate<TUser>; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score || a.candidate.user.id.localeCompare(b.candidate.user.id))
      .slice(0, Math.max(0, limits[source]));

    for (const { candidate, score } of route) {
      const existing = merged.get(candidate.user.id);
      if (existing) {
        existing.recallSources.push(source);
        existing.recallScores[source] = score;
        existing.recallScore = Math.max(existing.recallScore, score);
      } else {
        merged.set(candidate.user.id, {
          ...candidate,
          recallSources: [source],
          recallScores: { [source]: score },
          recallScore: score,
        });
      }
    }
  }

  // 新用户或冷启动画像可能还没有任何向量；保留 P1 过滤后的候选，避免结果页空白。
  if (activeRoutes === 0 || merged.size === 0) {
    return candidates
      .map((candidate) => ({ ...candidate, recallSources: [], recallScores: {}, recallScore: 0 }))
      .sort((a, b) => a.user.id.localeCompare(b.user.id));
  }

  return [...merged.values()].sort(
    (a, b) => b.recallScore - a.recallScore || a.user.id.localeCompare(b.user.id),
  );
}
