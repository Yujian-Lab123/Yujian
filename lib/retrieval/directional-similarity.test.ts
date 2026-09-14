import { describe, expect, it } from 'vitest';
import { AXES, cosine } from '../axes';
import {
  directedAxisSimilarity,
  directedCoverage,
  generalizedKLDivergence,
  generalizedKLSimilarity,
  isConceptAxisVector,
} from './directional-similarity';

function concept(...values: number[]): number[] {
  return Array.from({ length: AXES.length }, (_, index) => values[index] ?? 0);
}

describe('directional concept-axis similarity', () => {
  it('returns one for identical non-zero vectors', () => {
    const vector = concept(0.9, 0.4, 0.1);
    expect(directedCoverage(vector, vector)).toBe(1);
    expect(generalizedKLDivergence(vector, vector)).toBeCloseTo(0, 12);
    expect(generalizedKLSimilarity(vector, vector)).toBe(1);
    expect(directedAxisSimilarity(vector, vector)).toBe(1);
  });

  it('preserves directional intensity differences hidden by cosine', () => {
    const strong = concept(0.9, 0.1);
    const weak = concept(0.09, 0.01);
    expect(cosine(strong, weak)).toBeCloseTo(1);
    expect(directedCoverage(strong, weak)).toBeCloseTo(0.1);
    expect(directedCoverage(weak, strong)).toBe(1);
  });

  it('penalizes important source axes missing in the target', () => {
    const source = concept(0.8, 0.8);
    const target = concept(0.8, 0);
    expect(directedCoverage(source, target)).toBeCloseTo(0.5);
  });

  it('keeps generalized KL directional and finite with many zeros', () => {
    const strong = concept(0.9, 0.1);
    const weak = concept(0.09, 0.01);
    expect(generalizedKLDivergence(strong, weak)).not.toBeCloseTo(generalizedKLDivergence(weak, strong));
    expect(Number.isFinite(generalizedKLDivergence(concept(1), concept(0)))).toBe(true);
    expect(Number.isFinite(generalizedKLSimilarity(concept(1), concept(0)))).toBe(true);
  });

  it('returns zero when the source has no signal', () => {
    expect(directedCoverage(concept(), concept(1))).toBe(0);
    expect(generalizedKLSimilarity(concept(), concept(1))).toBe(0);
    expect(directedAxisSimilarity(concept(), concept(1))).toBe(0);
  });

  it('rejects negative and wrong-dimensional vectors', () => {
    expect(isConceptAxisVector(concept(1))).toBe(true);
    expect(isConceptAxisVector([1, 0])).toBe(false);
    expect(isConceptAxisVector(concept(-0.1))).toBe(false);
    expect(() => directedCoverage([1, 0], [1, 0])).toThrow(RangeError);
    expect(() => generalizedKLDivergence(concept(-0.1), concept(0.1))).toThrow(RangeError);
  });
});
