/** 候选过滤使用的最小用户字段，避免纯过滤逻辑依赖数据库实现。 */
export interface CandidateUser {
  id: string;
  encounter_enabled: number;
  intents: string[];
}

export type CandidateExclusionReason =
  | 'self'
  | 'encounter_disabled'
  | 'connected'
  | 'outgoing_pending'
  | 'not_interested'
  | 'blocked'
  | 'intent_incompatible';

export interface CandidateFilterContext {
  viewerId: string;
  viewerIntents: readonly string[];
  connectedUserIds: ReadonlySet<string>;
  outgoingPendingTargetIds: ReadonlySet<string>;
  ignoredTargetIds: ReadonlySet<string>;
  /** 当前 Schema 尚无拉黑表；先保留注入口，接入后无需重写过滤规则。 */
  blockedTargetIds?: ReadonlySet<string>;
}

export interface CandidateEligibility {
  eligible: boolean;
  reason: CandidateExclusionReason | null;
}

function normalizedIntents(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

/**
 * 空意愿代表“未设置”，不应让 OAuth 新用户永久无法被召回；
 * 双方都明确设置后，至少有一个交集才算兼容。
 */
export function intentsCompatible(viewerIntents: readonly string[], candidateIntents: readonly string[]): boolean {
  const viewer = normalizedIntents(viewerIntents);
  const candidate = normalizedIntents(candidateIntents);
  if (viewer.size === 0 || candidate.size === 0) return true;
  return [...candidate].some((intent) => viewer.has(intent));
}

export function evaluateCandidate(candidate: CandidateUser, context: CandidateFilterContext): CandidateEligibility {
  if (candidate.id === context.viewerId) return { eligible: false, reason: 'self' };
  if (candidate.encounter_enabled !== 1) return { eligible: false, reason: 'encounter_disabled' };
  if (context.connectedUserIds.has(candidate.id)) return { eligible: false, reason: 'connected' };
  if (context.outgoingPendingTargetIds.has(candidate.id)) return { eligible: false, reason: 'outgoing_pending' };
  if (context.ignoredTargetIds.has(candidate.id)) return { eligible: false, reason: 'not_interested' };
  if (context.blockedTargetIds?.has(candidate.id)) return { eligible: false, reason: 'blocked' };
  if (!intentsCompatible(context.viewerIntents, candidate.intents)) {
    return { eligible: false, reason: 'intent_incompatible' };
  }
  return { eligible: true, reason: null };
}

export function filterEligibleCandidates<T extends CandidateUser>(
  candidates: readonly T[],
  context: CandidateFilterContext,
): T[] {
  return candidates.filter((candidate) => evaluateCandidate(candidate, context).eligible);
}

