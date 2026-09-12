import type { ProfileArtifact } from '../profile/schema';
import { finalScore, type RankedCandidate } from './scoring';

export const DEFAULT_RERANK_CANDIDATE_LIMIT = 20;
export const MAX_RERANK_CANDIDATE_LIMIT = 50;
export const MAX_RERANK_TEXT_CHARS = 1_800;
export const CONVERSATION_RERANK_INSTRUCTION = [
  "Given one person's structured profile, rank candidate profiles by mutual conversation potential.",
  'Prefer shared enduring questions, compatible conversation styles, and constructive differences.',
  'Do not prioritize superficial demographic similarity.',
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

export function configuredRerankCandidateLimit(env: NodeJS.ProcessEnv = process.env): number {
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

/** 仅压缩结构化画像字段；不包含原始知乎正文、证据摘录、URL 或内部向量。 */
export function buildRerankPersonText(
  user: RerankUser,
  artifact?: ProfileArtifact | null,
  currentStateText?: string | null,
): string {
  const profile = artifact?.profile;
  const parts = [
    `姓名：${cleaned(user.name) || '未提供'}`,
    `角色：${cleaned(user.role) || '未提供'}`,
    cleaned(user.quote) ? `自述：${cleaned(user.quote)}` : '',
    user.tags.length ? `标签：${joined(user.tags, 6)}` : '',
    user.intents.length ? `认识意愿：${joined(user.intents, 4)}` : '',
    currentStateText ? `此刻状态：${cleaned(currentStateText)}` : '',
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

export function buildRerankQuery(user: RerankUser, artifact?: ProfileArtifact | null, currentStateText?: string | null): string {
  return `请为下面这位用户寻找最值得开始一次对话的人：\n${buildRerankPersonText(user, artifact, currentStateText)}`;
}

export function buildRerankDocument(user: RerankUser, artifact?: ProfileArtifact | null): string {
  return `候选用户：\n${buildRerankPersonText(user, artifact)}`;
}

/** Top-N 之外为强 Current 命中保留一个席位，确保“此刻遇见”规则不会被付费池截断。 */
export function selectRerankPool<TUser extends RerankUser>(
  candidates: RankedCandidate<TUser>[],
  limit: number,
): RankedCandidate<TUser>[] {
  const bounded = Math.max(1, Math.min(Math.floor(limit), MAX_RERANK_CANDIDATE_LIMIT));
  // 真实模型路径按 Algorithmic Coarse 选池，避免由待替换的 Mock Rerank 决定谁能进入精排。
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

/** 用模型分替换 Mock Rerank，并沿用已经冻结的 Mutual/Final 组合契约。 */
export function applyModelRerankScores<TUser extends RerankUser>(
  candidates: RankedCandidate<TUser>[],
  scores: number[],
): RankedCandidate<TUser>[] {
  if (scores.length !== candidates.length) throw new Error('Rerank 分数数量与候选数量不一致');
  return candidates.map((candidate, index) => {
    const rerank = scores[index];
    if (!Number.isFinite(rerank) || rerank < 0 || rerank > 1) throw new Error(`无效 Rerank 分数：${String(rerank)}`);
    return { ...candidate, rerank, final: finalScore(rerank, candidate.mutual) };
  }).sort((left, right) => right.final - left.final || left.user.id.localeCompare(right.user.id));
}
