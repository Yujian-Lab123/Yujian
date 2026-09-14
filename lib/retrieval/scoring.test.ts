import { describe, expect, it } from 'vitest';
import { AXES } from '../axes';
import type { UserVectors } from '../db';
import type { CandidateUser } from './candidate-filter';
import type { RecalledCandidate } from './multi-recall';
import { compatibilityBreakdown, compatibilityScore, rankRecalledCandidates } from './scoring';

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

  it('keeps identical concept vectors symmetric at the same score', () => {
    const identical = vectors(axisVector(0));
    const result = compatibilityBreakdown(identical, identical);
    expect(result.mode).toBe('concept-axis-directed');
    expect(result.forward).toBeCloseTo(result.backward);
    expect(result.compatibility).toBeCloseTo(0.9);
  });

  it('produces directional forward/backward on concept axes', () => {
    const strong = vectors(axisVector(0, 0.9));
    const weak = vectors(axisVector(0, 0.09));
    const forward = compatibilityBreakdown(strong, weak);
    const backward = compatibilityBreakdown(weak, strong);
    expect(forward.mode).toBe('concept-axis-directed');
    expect(forward.forward).toBeLessThan(forward.backward);
    expect(backward.forward).toBeGreaterThan(backward.backward);
    expect(forward.compatibility).toBeCloseTo(Math.min(forward.forward, forward.backward));
  });

  it('falls back to symmetric cosine for non-concept-axis vectors', () => {
    const wide = Array.from({ length: 20 }, (_, index) => (index === 0 ? 0.9 : 0));
    const left = vectors(wide);
    const right = vectors(wide.map((value) => value * 0.1));
    const result = compatibilityBreakdown(left, right);
    expect(result.mode).toBe('embedding-cosine');
    expect(result.forward).toBeCloseTo(result.backward);
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
