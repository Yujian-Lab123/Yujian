import { areIntentsCompatible } from './intent';

/** 候选过滤使用的最小用户字段，避免纯过滤规则依赖数据库实现。 */
export interface CandidateUser {
  id: string;
  encounter_enabled: number;
  intents: string[];
}

/** 候选在召回/排序/落库之前按体验模式隔离，不能只在 API 返回时过滤。 */
export function filterCandidatesByExperienceMode<T extends { is_mock: number }>(
  candidates: readonly T[],
  mode: 'real' | 'demo',
): T[] {
  return candidates.filter((candidate) => Boolean(candidate.is_mock) === (mode === 'demo'));
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
  /** 当前 Schema 尚无拉黑表；保留注入口，接入后无需重写过滤规则。 */
  blockedTargetIds?: ReadonlySet<string>;
}

export interface CandidateEligibility {
  eligible: boolean;
  reason: CandidateExclusionReason | null;
}

export function evaluateCandidate(candidate: CandidateUser, context: CandidateFilterContext): CandidateEligibility {
  if (candidate.id === context.viewerId) return { eligible: false, reason: 'self' };
  if (candidate.encounter_enabled !== 1) return { eligible: false, reason: 'encounter_disabled' };
  if (context.connectedUserIds.has(candidate.id)) return { eligible: false, reason: 'connected' };
  if (context.outgoingPendingTargetIds.has(candidate.id)) return { eligible: false, reason: 'outgoing_pending' };
  if (context.ignoredTargetIds.has(candidate.id)) return { eligible: false, reason: 'not_interested' };
  if (context.blockedTargetIds?.has(candidate.id)) return { eligible: false, reason: 'blocked' };
  if (!areIntentsCompatible(context.viewerIntents, candidate.intents)) {
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
