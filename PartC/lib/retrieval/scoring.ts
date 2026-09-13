import { AXES, cosine, topAxes } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import {
  directedCoverage,
  generalizedKLSimilarity,
  isConceptAxisVector,
} from './directional-similarity';
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
export const PAIR_WEIGHTS = { longTerm: 0.40, value: 0.30, conversation: 0.20, current: 0.10 } as const;

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
  forward: number;
  backward: number;
  mutual: number;
  final: number;
}

export interface PairScoreBreakdown {
  mode: 'concept-axis-directed' | 'embedding-cosine';
  score: number;
  long_term: number;
  value: number;
  conversation: number;
  current: number;
  coverage_long_term?: number;
  coverage_value?: number;
  gkl_long_term?: number;
  gkl_value?: number;
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
  if (!left.length || left.length !== right.length) return 0;
  if (!left.every(Number.isFinite) || !right.every(Number.isFinite)) return 0;
  const similarity = cosine(left, right);
  return Number.isFinite(similarity) ? clamp01(similarity) : 0;
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

/**
 * 单向配对分 A→B。只有 16 维非负概念轴使用 Coverage/GKL；
 * 通用 Embedding（包括 1024 维和负数）完整回退余弦，不能解释其单个维度。
 */
export function pairScoreBreakdown(a: UserVectors, b: UserVectors): PairScoreBreakdown {
  const directional = [a.long_term, b.long_term, a.value, b.value].every(isConceptAxisVector);
  const directionalDetails = directional ? {
    coverage_long_term: directedCoverage(a.long_term, b.long_term),
    coverage_value: directedCoverage(a.value, b.value),
    gkl_long_term: generalizedKLSimilarity(a.long_term, b.long_term),
    gkl_value: generalizedKLSimilarity(a.value, b.value),
  } : null;
  const longTerm = directionalDetails
    ? 0.5 * directionalDetails.coverage_long_term + 0.5 * directionalDetails.gkl_long_term
    : rankingSimilarity(a.long_term, b.long_term);
  const value = directionalDetails
    ? 0.5 * directionalDetails.coverage_value + 0.5 * directionalDetails.gkl_value
    : rankingSimilarity(a.value, b.value);
  const conversation = rankingSimilarity(a.conversation, b.conversation);
  const current = a.current && b.current ? rankingSimilarity(a.current, b.current) : 0;
  const score = clamp01(
    PAIR_WEIGHTS.longTerm * longTerm
    + PAIR_WEIGHTS.value * value
    + PAIR_WEIGHTS.conversation * conversation
    + PAIR_WEIGHTS.current * current,
  );
  return {
    mode: directional ? 'concept-axis-directed' : 'embedding-cosine',
    score,
    long_term: longTerm,
    value,
    conversation,
    current,
    ...(directionalDetails ?? {}),
  };
}

/** 保留旧导出，供 lib/ai/bridge.ts 和既有调用方兼容。 */
export function pairScore(a: UserVectors, b: UserVectors): number {
  return pairScoreBreakdown(a, b).score;
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
    const forward = pairScore(input.viewerVectors, candidate.vectors);
    const backward = pairScore(candidate.vectors, input.viewerVectors);
    const mutual = Math.min(forward, backward);
    return {
      user: candidate.user,
      vectors: candidate.vectors,
      lt, val, conv, cur, intent, novelty, diversity,
      coarse, rerank, forward, backward, mutual,
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
