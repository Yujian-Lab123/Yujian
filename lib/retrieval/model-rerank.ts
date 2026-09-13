import type { ProfileArtifact } from '../profile/schema';
import { finalScore, type RankedCandidate } from './scoring';

export const DEFAULT_RERANK_CANDIDATE_LIMIT = 20;
export const MAX_RERANK_CANDIDATE_LIMIT = 50;
export const MAX_RERANK_TEXT_CHARS = 1_800;
export const CONVERSATION_RERANK_INSTRUCTION = [
  'Rank candidate profiles by conversation compatibility.',
  'Prefer shared enduring questions, compatible conversation styles, and constructive differences.',
  'Do not infer mutual willingness and do not prioritize superficial demographic similarity.',
].join(' ');

export interface RerankUser {
  id: string;
  name: string;
  role: string;
  quote: string;
  tags: string[];
  intents: string[];
  encounter_enabled: number;
}

type RerankLimitEnv = { RERANK_CANDIDATE_LIMIT?: string };

export function configuredRerankCandidateLimit(
  env: RerankLimitEnv = { RERANK_CANDIDATE_LIMIT: process.env.RERANK_CANDIDATE_LIMIT },
): number {
  const parsed = Number(env.RERANK_CANDIDATE_LIMIT || DEFAULT_RERANK_CANDIDATE_LIMIT);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_RERANK_CANDIDATE_LIMIT)
    : DEFAULT_RERANK_CANDIDATE_LIMIT;
}

function cleaned(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function joined(values: unknown[], limit = 4): string {
  return values.map(cleaned).filter(Boolean).slice(0, limit).join('；');
}

/** 只发送压缩后的长期结构化画像；不接收“此刻”原文、证据摘录、URL 或内部向量。 */
export function buildRerankPersonText(user: RerankUser, artifact?: ProfileArtifact | null): string {
  const profile = artifact?.profile;
  const parts = [
    `角色：${cleaned(user.role) || '未提供'}`,
    user.tags.length ? `标签：${joined(user.tags, 6)}` : '',
    user.intents.length ? `认识偏好：${joined(user.intents, 4)}` : '',
    profile?.summary?.one_sentence ? `画像概述：${cleaned(profile.summary.one_sentence)}` : '',
    profile?.summary?.core_insights?.length
      ? `核心观察：${joined(profile.summary.core_insights.map((item) => item.claim), 4)}`
      : '',
    profile?.long_term_concerns?.length
      ? `长期关切：${joined(profile.long_term_concerns.map((item) => item.question), 4)}`
      : '',
    profile?.drivers?.length
      ? `驱动力：${joined(profile.drivers.map((item) => item.driver), 3)}`
      : '',
    profile?.value_preferences?.length
      ? `价值取舍：${joined(profile.value_preferences.map((item) => `${item.left}与${item.right}：${item.lean}`), 4)}`
      : '',
    profile?.conversation_style?.traits?.length
      ? `对话风格：${joined(profile.conversation_style.traits.map((item) => item.trait), 4)}`
      : '',
    profile?.conversation_style?.good_entry_points?.length
      ? `适合话题：${joined(profile.conversation_style.good_entry_points, 3)}`
      : '',
  ].filter(Boolean);
  return parts.join('\n').slice(0, MAX_RERANK_TEXT_CHARS);
}

export function buildRerankQuery(user: RerankUser, artifact?: ProfileArtifact | null): string {
  return `请为下面这位用户寻找最值得开始一次对话的人：\n${buildRerankPersonText(user, artifact)}`;
}

export function buildRerankDocument(user: RerankUser, artifact?: ProfileArtifact | null): string {
  return `候选用户：\n${buildRerankPersonText(user, artifact)}`;
}

export function selectRerankPool<TUser extends RerankUser>(
  candidates: RankedCandidate<TUser>[],
  limit: number,
): RankedCandidate<TUser>[] {
  const bounded = Math.max(1, Math.min(Math.floor(limit), MAX_RERANK_CANDIDATE_LIMIT));
  const pool = [...candidates]
    .sort((left, right) => right.coarse - left.coarse || left.user.id.localeCompare(right.user.id))
    .slice(0, bounded);
  const moment = candidates.reduce<RankedCandidate<TUser> | null>(
    (best, candidate) => candidate.cur > (best?.cur ?? 0) ? candidate : best,
    null,
  );
  if (moment && moment.cur >= 0.55 && !pool.some((candidate) => candidate.user.id === moment.user.id)) {
    pool[pool.length - 1] = moment;
  }
  return pool;
}

export function applyModelRerankScores<TUser extends RerankUser>(
  candidates: RankedCandidate<TUser>[],
  scores: number[],
): RankedCandidate<TUser>[] {
  if (scores.length !== candidates.length) throw new Error('Rerank 分数数量与候选数量不一致');
  return candidates.map((candidate, index) => {
    const rerank = scores[index];
    if (!Number.isFinite(rerank) || rerank < 0 || rerank > 1) {
      throw new Error(`无效 Rerank 分数：${String(rerank)}`);
    }
    return { ...candidate, rerank, final: finalScore(rerank, candidate.compatibility) };
  }).sort((left, right) => right.final - left.final || left.user.id.localeCompare(right.user.id));
}

/** 精排只覆盖付费 Top-N；未送入模型的候选保留本地分数，不能被静默丢弃。 */
export function mergeRerankedPool<TUser extends RerankUser>(
  allCandidates: RankedCandidate<TUser>[],
  pool: RankedCandidate<TUser>[],
  scores: number[],
): RankedCandidate<TUser>[] {
  const reranked = applyModelRerankScores(pool, scores);
  const poolIds = new Set(pool.map((candidate) => candidate.user.id));
  return [...reranked, ...allCandidates.filter((candidate) => !poolIds.has(candidate.user.id))]
    .sort((left, right) => right.final - left.final || left.user.id.localeCompare(right.user.id));
}
