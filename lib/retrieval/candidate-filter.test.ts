import { describe, expect, it } from 'vitest';
import { evaluateCandidate, filterCandidatesByExperienceMode, filterEligibleCandidates, type CandidateFilterContext, type CandidateUser } from './candidate-filter';

const candidate = (id: string, intents = ['轻松交流'], enabled = 1): CandidateUser => ({
  id,
  intents,
  encounter_enabled: enabled,
});

const context = (overrides: Partial<CandidateFilterContext> = {}): CandidateFilterContext => ({
  viewerId: 'viewer',
  viewerIntents: ['轻松交流'],
  connectedUserIds: new Set(),
  outgoingPendingTargetIds: new Set(),
  ignoredTargetIds: new Set(),
  ...overrides,
});

describe('candidate filter', () => {
  it('separates real and demo candidates before matching', () => {
    const mixed = [{ id: 'real', is_mock: 0 }, { id: 'demo', is_mock: 1 }];
    expect(filterCandidatesByExperienceMode(mixed, 'real').map((item) => item.id)).toEqual(['real']);
    expect(filterCandidatesByExperienceMode(mixed, 'demo').map((item) => item.id)).toEqual(['demo']);
  });
  it('keeps only eligible candidates', () => {
    const result = filterEligibleCandidates([
      candidate('viewer'),
      candidate('disabled', ['轻松交流'], 0),
      candidate('connected'),
      candidate('pending'),
      candidate('ignored'),
      candidate('blocked'),
      candidate('incompatible', ['深入交流']),
      candidate('eligible'),
    ], context({
      connectedUserIds: new Set(['connected']),
      outgoingPendingTargetIds: new Set(['pending']),
      ignoredTargetIds: new Set(['ignored']),
      blockedTargetIds: new Set(['blocked']),
    }));

    expect(result.map((item) => item.id)).toEqual(['eligible']);
  });

  it('reports a stable exclusion reason', () => {
    expect(evaluateCandidate(candidate('viewer'), context()).reason).toBe('self');
    expect(evaluateCandidate(candidate('target', ['深入交流']), context()).reason).toBe('intent_incompatible');
  });

  it('keeps cold-start users when either side has not set intents', () => {
    expect(evaluateCandidate(candidate('target', []), context()).eligible).toBe(true);
    expect(evaluateCandidate(candidate('target', ['深入交流']), context({ viewerIntents: [] })).eligible).toBe(true);
  });
});
