import { describe, expect, it } from 'vitest';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import type { RecalledCandidate } from './multi-recall';
import {
  COARSE_WEIGHTS,
  FINAL_WEIGHTS,
  RERANK_WEIGHTS,
  coarseScore,
  rankRecalledCandidates,
} from './scoring';

function recalled(id: string, vector: number[]): RecalledCandidate<CandidateUser> {
  const vectors: UserVectors = {
    long_term: vector,
    value: vector,
    conversation: vector,
    current: null,
  };
  return {
    user: { id, encounter_enabled: 1, intents: ['朋友'] },
    vectors,
    recallSources: ['long_term'],
    recallScores: { long_term: 1 },
    recallScore: 1,
  };
}

describe('Encounter scoring', () => {
  it('keeps every documented weight group normalized', () => {
    expect(Object.values(COARSE_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(Object.values(RERANK_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(Object.values(FINAL_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it('ranks the stronger semantic match first and keeps scores bounded', () => {
    const viewerVectors: UserVectors = {
      long_term: [1, 0], value: [1, 0], conversation: [1, 0], current: null,
    };
    const result = rankRecalledCandidates({
      viewerVectors,
      viewerIntents: ['朋友'],
      candidates: [recalled('weak', [0, 1]), recalled('strong', [1, 0])],
    });
    expect(result[0].user.id).toBe('strong');
    for (const item of result) {
      expect(item.coarse).toBeGreaterThanOrEqual(0);
      expect(item.final).toBeLessThanOrEqual(1);
    }
  });

  it('applies novelty and diversity before final ordering', () => {
    expect(coarseScore({ lt: 1, conv: 1, cur: 1, intent: 1, novelty: 1, diversity: 1 })).toBe(1);
    const viewerVectors: UserVectors = {
      long_term: [1, 0], value: [1, 0], conversation: [1, 0], current: null,
    };
    const result = rankRecalledCandidates({
      viewerVectors,
      viewerIntents: ['朋友'],
      candidates: [recalled('seen', [1, 0]), recalled('fresh', [1, 0])],
      seenTargetIds: new Set(['seen']),
    });
    expect(result[0].user.id).toBe('fresh');
    expect(result[0].novelty).toBe(1);
    expect(result[1].novelty).toBe(0.3);
    expect(result[0].diversity).toBe(1);
    expect(result[1].diversity).toBe(0.4);
  });
});
