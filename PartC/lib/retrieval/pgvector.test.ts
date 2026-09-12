import { describe, expect, it } from 'vitest';
import {
  isFiniteVector,
  mergeAnnMatches,
  parsePgvectorLiteral,
  toPgvectorLiteral,
} from './pgvector';

describe('pgvector recall helpers', () => {
  it('validates dimensions and safely round-trips a vector literal', () => {
    expect(isFiniteVector([0.5, -0.25], 2)).toBe(true);
    expect(isFiniteVector([0.5, Number.NaN], 2)).toBe(false);
    expect(isFiniteVector([0, 0], 2)).toBe(false);
    expect(isFiniteVector([0.5], 2)).toBe(false);
    expect(toPgvectorLiteral([0.5, -0.25])).toBe('[0.5,-0.25]');
    expect(parsePgvectorLiteral('[0.5,-0.25]')).toEqual([0.5, -0.25]);
    expect(parsePgvectorLiteral('[0,"oops"]')).toBeNull();
  });

  it('merges multi-route ANN hits with clamped trace scores', () => {
    const result = mergeAnnMatches([
      { userId: 'u2', source: 'long_term', score: 0.8 },
      { userId: 'u1', source: 'value', score: 1.2 },
      { userId: 'u2', source: 'current', score: 0.9 },
    ]);
    expect(result.map((item) => item.userId)).toEqual(['u1', 'u2']);
    expect(result[0]).toMatchObject({ recallScore: 1, recallScores: { value: 1 } });
    expect(result[1]).toMatchObject({
      recallSources: ['long_term', 'current'],
      recallScores: { long_term: 0.8, current: 0.9 },
      recallScore: 0.9,
    });
  });
});
