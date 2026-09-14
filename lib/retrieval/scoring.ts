import { AXES, cosine, topAxes } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import { directedAxisSimilarity, isConceptAxisVector } from './directional-similarity';
import { intentCompatibilityScore } from './intent';
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
export const FINAL_WEIGHTS = { rerank: 0.55, compatibility: 0.45 } as const;

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
  compatibility: number;
  /** 方向性兼容分：观看者 → 候选。 */
  forward: number;
  /** 方向性兼容分：候选 → 观看者。 */
  backward: number;
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

function similarity(left: number[], right: number[]): number {
  if (!left.length || !right.length) return 0;
  return clamp01(cosine(left, right));
}

export function coarseScore(
  features: Pick<RankingFeatures, 'lt' | 'conv' | 'cur' | 'intent' | 'novelty' | 'diversity'>,
): number {
  return clamp01(
    COARSE_WEIGHTS.longTerm * features.lt
    + COARSE_WEIGHTS.conversation * features.conv
    + COARSE_WEIGHTS.current * features.cur
    + COARSE_WEIGHTS.intent * features.intent
    + COARSE_WEIGHTS.novelty * features.novelty
    + COARSE_WEIGHTS.diversity * features.diversity,
  );
}

export function fallbackRerankScore(coarse: number, value: number): number {
  return clamp01(RERANK_WEIGHTS.coarse * coarse + RERANK_WEIGHTS.value * value);
}

/**
 * 长期/价值层：16 维非负概念轴使用方向性算法（Directed Coverage + Generalized KL），
 * 通用高维 Embedding 自动回退余弦。方向性只体现在这一层；召回层始终使用余弦。
 */
function directionalOrCosine(from: number[], to: number[]): number {
  if (isConceptAxisVector(from) && isConceptAxisVector(to)) return directedAxisSimilarity(from, to);
  return similarity(from, to);
}

/** 单向画像兼容度：0.4 长期 + 0.3 价值 + 0.2 对话 + 0.1 此刻。 */
function pairScore(from: UserVectors, to: UserVectors): number {
  const current = from.current && to.current ? similarity(from.current, to.current) : 0;
  return clamp01(
    0.4 * directionalOrCosine(from.long_term, to.long_term)
    + 0.3 * directionalOrCosine(from.value, to.value)
    + 0.2 * similarity(from.conversation, to.conversation)
    + 0.1 * current,
  );
}

export interface CompatibilityBreakdown {
  /** concept-axis-directed：16 维概念轴，forward/backward 可能不同；embedding-cosine：高维回退，两者相等。 */
  mode: 'concept-axis-directed' | 'embedding-cosine';
  forward: number;
  backward: number;
  compatibility: number;
}

/** 分别计算 A→B 与 B→A 的画像兼容度，取较小者作为保守估计。 */
export function compatibilityBreakdown(left: UserVectors, right: UserVectors): CompatibilityBreakdown {
  const forward = pairScore(left, right);
  const backward = pairScore(right, left);
  const mode = isConceptAxisVector(left.long_term) && isConceptAxisVector(right.long_term)
    ? 'concept-axis-directed'
    : 'embedding-cosine';
  return { mode, forward, backward, compatibility: clamp01(Math.min(forward, backward)) };
}

/** 推荐前的画像兼容度估计，不代表任何一方已经表达认识意愿。 */
export function compatibilityScore(left: UserVectors, right: UserVectors): number {
  return compatibilityBreakdown(left, right).compatibility;
}

export function finalScore(rerank: number, compatibility: number): number {
  return clamp01(
    FINAL_WEIGHTS.rerank * rerank
    + FINAL_WEIGHTS.compatibility * compatibility,
  );
}

function dominantAxis(candidate: RankedCandidate): string | undefined {
  // 16 轴 Mock 向量可以解释主轴；通用 Embedding 没有相同维度语义。
  if (candidate.vectors.long_term.length !== AXES.length) return undefined;
  return topAxes(candidate.vectors.long_term, 1)[0]?.axis;
}

function withDiversity<TUser extends CandidateUser>(
  candidate: RankedCandidate<TUser>,
  pickedAxes: ReadonlySet<string>,
): RankedCandidate<TUser> {
  const dominant = dominantAxis(candidate);
  const diversity = dominant ? (pickedAxes.has(dominant) ? 0.4 : 1) : 0.4;
  const coarse = coarseScore({ ...candidate, diversity });
  const rerank = fallbackRerankScore(coarse, candidate.val);
  return {
    ...candidate,
    diversity,
    coarse,
    rerank,
    final: finalScore(rerank, candidate.compatibility),
  };
}

/**
 * 先生成稳定基线，再以贪心方式加入小幅主轴多样性奖励。
 * 每轮都在已经选中的轴集合上重新计算，避免“先加奖励、后排序”造成首位奖励错乱。
 */
export function rankRecalledCandidates<TUser extends CandidateUser>(input: {
  viewerVectors: UserVectors;
  viewerIntents: readonly string[];
  candidates: RecalledCandidate<TUser>[];
  seenTargetIds?: ReadonlySet<string>;
}): RankedCandidate<TUser>[] {
  const seen = input.seenTargetIds ?? new Set<string>();
  const remaining: RankedCandidate<TUser>[] = input.candidates.map((candidate) => {
    const lt = similarity(input.viewerVectors.long_term, candidate.vectors.long_term);
    const val = similarity(input.viewerVectors.value, candidate.vectors.value);
    const conv = similarity(input.viewerVectors.conversation, candidate.vectors.conversation);
    const cur = input.viewerVectors.current && candidate.vectors.current
      ? similarity(input.viewerVectors.current, candidate.vectors.current)
      : 0;
    const intent = intentCompatibilityScore(input.viewerIntents, candidate.user.intents);
    const novelty = seen.has(candidate.user.id) ? 0.3 : 1;
    const diversity = 0.4;
    const coarse = coarseScore({ lt, conv, cur, intent, novelty, diversity });
    const rerank = fallbackRerankScore(coarse, val);
    const compatibilityDetail = compatibilityBreakdown(input.viewerVectors, candidate.vectors);
    return {
      user: candidate.user,
      vectors: candidate.vectors,
      lt, val, conv, cur, intent, novelty, diversity,
      coarse, rerank,
      compatibility: compatibilityDetail.compatibility,
      forward: compatibilityDetail.forward,
      backward: compatibilityDetail.backward,
      final: finalScore(rerank, compatibilityDetail.compatibility),
      recall: {
        sources: [...candidate.recallSources],
        scores: { ...candidate.recallScores },
        max_score: candidate.recallScore,
      },
    };
  });

  const ranked: RankedCandidate<TUser>[] = [];
  const pickedAxes = new Set<string>();
  while (remaining.length) {
    const rescored = remaining
      .map((candidate) => withDiversity(candidate, pickedAxes))
      .sort((left, right) => right.final - left.final || left.user.id.localeCompare(right.user.id));
    const picked = rescored[0];
    ranked.push(picked);
    const dominant = dominantAxis(picked);
    if (dominant) pickedAxes.add(dominant);
    const index = remaining.findIndex((candidate) => candidate.user.id === picked.user.id);
    remaining.splice(index, 1);
  }
  return ranked;
}
