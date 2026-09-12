import { describe, expect, it } from 'vitest';
import {
  evaluateCandidate,
  filterEligibleCandidates,
  intentsCompatible,
  type CandidateFilterContext,
  type CandidateUser,
} from './candidate-filter';

const baseContext: CandidateFilterContext = {
  viewerId: 'viewer',
  viewerIntents: ['朋友'],
  connectedUserIds: new Set(),
  outgoingPendingTargetIds: new Set(),
  ignoredTargetIds: new Set(),
};

function candidate(overrides: Partial<CandidateUser> = {}): CandidateUser {
  return { id: 'candidate', encounter_enabled: 1, intents: ['朋友'], ...overrides };
}

describe('candidate eligibility', () => {
  it.each([
    ['self', candidate({ id: 'viewer' }), baseContext],
    ['encounter_disabled', candidate({ encounter_enabled: 0 }), baseContext],
    ['connected', candidate(), { ...baseContext, connectedUserIds: new Set(['candidate']) }],
    ['outgoing_pending', candidate(), { ...baseContext, outgoingPendingTargetIds: new Set(['candidate']) }],
    ['not_interested', candidate(), { ...baseContext, ignoredTargetIds: new Set(['candidate']) }],
    ['blocked', candidate(), { ...baseContext, blockedTargetIds: new Set(['candidate']) }],
    ['intent_incompatible', candidate({ intents: ['同行'] }), baseContext],
  ] as const)('excludes %s candidates', (reason, user, context) => {
    expect(evaluateCandidate(user, context)).toEqual({ eligible: false, reason });
  });

  it('keeps an eligible candidate', () => {
    expect(evaluateCandidate(candidate(), baseContext)).toEqual({ eligible: true, reason: null });
  });

  it('treats an empty intent list as unspecified', () => {
    expect(intentsCompatible([], ['朋友'])).toBe(true);
    expect(intentsCompatible(['朋友'], [])).toBe(true);
    expect(intentsCompatible(['朋友'], ['同行'])).toBe(false);
  });

  it('returns only eligible users', () => {
    const result = filterEligibleCandidates([
      candidate({ id: 'viewer' }),
      candidate({ id: 'connected' }),
      candidate({ id: 'eligible' }),
      candidate({ id: 'disabled', encounter_enabled: 0 }),
    ], { ...baseContext, connectedUserIds: new Set(['connected']) });
    expect(result.map((user) => user.id)).toEqual(['eligible']);
  });
});

