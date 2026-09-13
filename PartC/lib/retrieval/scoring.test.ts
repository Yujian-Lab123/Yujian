import { describe, expect, it } from 'vitest';
import { AXES } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import type { RecalledCandidate } from './multi-recall';
import {
  COARSE_WEIGHTS,
  FINAL_WEIGHTS,
  PAIR_WEIGHTS,
  RERANK_WEIGHTS,
  coarseScore,
  pairScoreBreakdown,
  rankRecalledCandidates,
} from './scoring';

function concept(...values: number[]): number[] {
  return Array.from({ length: AXES.length }, (_, index) => values[index] ?? 0);
}

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
    expect(Object.values(PAIR_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
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

  it('computes genuinely different directional pair scores on concept axes', () => {
    const strong = concept(0.9, 0.1);
    const weak = concept(0.09, 0.01);
    const viewerVectors: UserVectors = {
      long_term: strong, value: strong, conversation: strong, current: null,
    };
    const result = rankRecalledCandidates({
      viewerVectors,
      viewerIntents: ['朋友'],
      candidates: [recalled('weak', weak)],
    })[0];
    expect(result.forward).not.toBeCloseTo(result.backward);
    expect(result.mutual).toBe(Math.min(result.forward, result.backward));
    expect(pairScoreBreakdown(viewerVectors, recalled('weak', weak).vectors).mode).toBe('concept-axis-directed');
  });

  it('keeps 1024-D embeddings on the symmetric cosine fallback', () => {
    const left = Array.from({ length: 1024 }, (_, index) => (index % 3 === 0 ? -0.2 : 0.4));
    const right = Array.from({ length: 1024 }, (_, index) => (index % 5 === 0 ? -0.1 : 0.3));
    const a: UserVectors = { long_term: left, value: left, conversation: left, current: null };
    const b: UserVectors = { long_term: right, value: right, conversation: right, current: null };
    const forward = pairScoreBreakdown(a, b);
    const backward = pairScoreBreakdown(b, a);
    expect(forward.mode).toBe('embedding-cosine');
    expect(forward.coverage_long_term).toBeUndefined();
    expect(forward.gkl_long_term).toBeUndefined();
    expect(forward.score).toBeCloseTo(backward.score);
  });

  it('keeps malformed fallback vectors finite instead of leaking NaN', () => {
    const a: UserVectors = { long_term: [1, 0], value: [1, 0], conversation: [1, 0], current: null };
    const b: UserVectors = { long_term: [1], value: [1], conversation: [1], current: null };
    const result = pairScoreBreakdown(a, b);
    expect(result.mode).toBe('embedding-cosine');
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
