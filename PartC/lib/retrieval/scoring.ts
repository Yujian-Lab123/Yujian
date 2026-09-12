import { AXES, cosine, topAxes } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import type { RecallSource, RecalledCandidate } from './multi-recall';

export const COARSE_WEIGHTS = {
  longTerm: 0.30,
  conversation: 0.25,
  current: 0.20,
  intent: 0.15,
  novelty: 0.05,
  diversity: 0.05,
} as const;

export const RERANK_WEIGHTS = { coarse: 0.70, value: 0.30 } as const;
export const FINAL_WEIGHTS = { rerank: 0.55, mutual: 0.45 } as const;

export interface RankingFeatures {
  lt: number;
  val: number;
  conv: number;
  cur: number;
  intent: number;
  novelty: number;
  diversity: number;
  coarse: number;
  rerank: number;
  mutual: number;
  final: number;
}

export interface RecallDebug {
  sources: RecallSource[];
  scores: Partial<Record<RecallSource, number>>;
  max_score: number;
}

export interface RankedCandidate<TUser extends CandidateUser = CandidateUser> extends RankingFeatures {
  user: TUser;
  vectors: UserVectors;
  recall: RecallDebug;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rankingSimilarity(left: number[], right: number[]): number {
  if (!left.length || !right.length) return 0;
  return clamp01(cosine(left, right));
}

function intentFit(viewerIntents: string[], targetIntents: string[]): number {
  if (viewerIntents.length === 0 || targetIntents.length === 0) return 1;
  return targetIntents.some((intent) => viewerIntents.includes(intent)) ? 1 : 0.5;
}

export function coarseScore(features: Pick<RankingFeatures, 'lt' | 'conv' | 'cur' | 'intent' | 'novelty' | 'diversity'>): number {
  return clamp01(
    COARSE_WEIGHTS.longTerm * features.lt
    + COARSE_WEIGHTS.conversation * features.conv
    + COARSE_WEIGHTS.current * features.cur
    + COARSE_WEIGHTS.intent * features.intent
    + COARSE_WEIGHTS.novelty * features.novelty
    + COARSE_WEIGHTS.diversity * features.diversity,
  );
}

/** P3 Mock Rerank：P6 未配置或失败时的确定性回退。 */
export function rerankScore(coarse: number, value: number): number {
  return clamp01(RERANK_WEIGHTS.coarse * coarse + RERANK_WEIGHTS.value * value);
}

/** 单向配对分 A→B：长期 0.4 + 价值问题 0.3 + 对话风格 0.2 + 此刻 0.1。 */
export function pairScore(a: UserVectors, b: UserVectors): number {
  const current = a.current && b.current ? rankingSimilarity(a.current, b.current) : 0;
  return clamp01(
    0.4 * rankingSimilarity(a.long_term, b.long_term)
    + 0.3 * rankingSimilarity(a.value, b.value)
    + 0.2 * rankingSimilarity(a.conversation, b.conversation)
    + 0.1 * current,
  );
}

export function finalScore(rerank: number, mutual: number): number {
  return clamp01(FINAL_WEIGHTS.rerank * rerank + FINAL_WEIGHTS.mutual * mutual);
}

/**
 * P3 排序：先生成可回退基线，再按候选主轴给予小幅多样性奖励；P6 在此结果上做 Top-N 模型精排。
 */
export function rankRecalledCandidates<TUser extends CandidateUser>(input: {
  viewerVectors: UserVectors;
  viewerIntents: string[];
  candidates: RecalledCandidate<TUser>[];
  seenTargetIds?: ReadonlySet<string>;
}): RankedCandidate<TUser>[] {
  const seen = input.seenTargetIds ?? new Set<string>();
  const ranked: RankedCandidate<TUser>[] = input.candidates.map((candidate) => {
    const lt = rankingSimilarity(input.viewerVectors.long_term, candidate.vectors.long_term);
    const val = rankingSimilarity(input.viewerVectors.value, candidate.vectors.value);
    const conv = rankingSimilarity(input.viewerVectors.conversation, candidate.vectors.conversation);
    const cur = input.viewerVectors.current && candidate.vectors.current
      ? rankingSimilarity(input.viewerVectors.current, candidate.vectors.current)
      : 0;
    const intent = intentFit(input.viewerIntents, candidate.user.intents);
    const novelty = seen.has(candidate.user.id) ? 0.3 : 1;
    const diversity = 0.4;
    const coarse = coarseScore({ lt, conv, cur, intent, novelty, diversity });
    const rerank = rerankScore(coarse, val);
    const mutual = Math.min(pairScore(input.viewerVectors, candidate.vectors), pairScore(candidate.vectors, input.viewerVectors));
    return {
      user: candidate.user,
      vectors: candidate.vectors,
      lt, val, conv, cur, intent, novelty, diversity,
      coarse, rerank, mutual,
      final: finalScore(rerank, mutual),
      recall: {
        sources: [...candidate.recallSources],
        scores: { ...candidate.recallScores },
        max_score: candidate.recallScore,
      },
    };
  });

  ranked.sort((a, b) => b.rerank - a.rerank || a.user.id.localeCompare(b.user.id));
  const pickedAxes = new Set<string>();
  for (const item of ranked) {
    // Mock 轴向量可解释“主轴”；通用 Embedding 没有同样的维度语义，使用中性奖励。
    const dominant = item.vectors.long_term.length === AXES.length
      ? topAxes(item.vectors.long_term, 1)[0]?.axis
      : undefined;
    item.diversity = dominant ? (pickedAxes.has(dominant) ? 0.4 : 1) : 0.4;
    if (dominant) pickedAxes.add(dominant);
    item.coarse = coarseScore(item);
    item.rerank = rerankScore(item.coarse, item.val);
    item.final = finalScore(item.rerank, item.mutual);
  }

  return ranked.sort((a, b) => b.final - a.final || a.user.id.localeCompare(b.user.id));
}
