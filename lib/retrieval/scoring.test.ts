import { describe, expect, it } from 'vitest';
import { AXES } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import type { RecalledCandidate } from './multi-recall';
import { compatibilityScore, rankRecalledCandidates } from './scoring';

function axisVector(index: number, value = 1): number[] {
  return AXES.map((_, current) => current === index ? value : 0);
}

function vectors(longTerm: number[], current: number[] | null = null): UserVectors {
  return { long_term: longTerm, value: longTerm, conversation: longTerm, current };
}

function recalled(id: string, userVectors: UserVectors): RecalledCandidate<CandidateUser> {
  return {
    user: { id, intents: ['轻松交流'], encounter_enabled: 1 },
    vectors: userVectors,
    recallSources: ['long_term'],
    recallScores: { long_term: 1 },
    recallScore: 1,
  };
}

describe('retrieval scoring', () => {
  it('names pre-recommendation model output compatibility, not mutual willingness', () => {
    const left = vectors(axisVector(0));
    const right = vectors(axisVector(0));
    expect(compatibilityScore(left, right)).toBeCloseTo(0.9);
  });

  it('assigns diversity in final selection order', () => {
    const viewer = vectors(axisVector(0));
    const result = rankRecalledCandidates({
      viewerVectors: viewer,
      viewerIntents: ['轻松交流'],
      candidates: [
        recalled('best', vectors(axisVector(0))),
        recalled('same-axis', vectors(axisVector(0, 0.85))),
        recalled('other-axis', vectors(axisVector(1, 0.7))),
      ],
    });

    expect(result[0].user.id).toBe('best');
    expect(result[0].diversity).toBe(1);
    expect(result.find((item) => item.user.id === 'same-axis')?.diversity).toBe(0.4);
    expect(result.find((item) => item.user.id === 'other-axis')?.diversity).toBe(1);
  });

  it('marks an already recommended target as less novel', () => {
    const viewer = vectors(axisVector(0));
    const [result] = rankRecalledCandidates({
      viewerVectors: viewer,
      viewerIntents: [],
      candidates: [recalled('seen', vectors(axisVector(0)))],
      seenTargetIds: new Set(['seen']),
    });
    expect(result.novelty).toBe(0.3);
  });
});
