import { AXES } from '../axes';

export const DIRECTIONAL_EPSILON = 1e-9;
export const GKL_EPSILON = 1e-6;
export const GKL_TEMPERATURE = 1;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 方向性算法只接受 16 维、有限、非负且不超过 1 的可解释概念轴。 */
export function isConceptAxisVector(vector: number[]): boolean {
  return vector.length === AXES.length
    && vector.every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
}

function assertConceptAxisPair(source: number[], target: number[]): void {
  if (!isConceptAxisVector(source) || !isConceptAxisVector(target)) {
    throw new RangeError('方向性相似度只接受 16 维、[0,1] 范围内的概念轴向量');
  }
}

function signal(vector: number[]): number {
  return vector.reduce((sum, value) => sum + value, 0);
}

/** source 所重视的总强度中，有多少被 target 覆盖。 */
export function directedCoverage(source: number[], target: number[]): number {
  assertConceptAxisPair(source, target);
  const sourceTotal = signal(source);
  if (sourceTotal <= DIRECTIONAL_EPSILON) return 0;
  const overlap = source.reduce((sum, value, index) => sum + Math.min(value, target[index]), 0);
  // 让完整覆盖严格等于 1，同时保留公式中的 epsilon 数值保护。
  if (sourceTotal - overlap <= DIRECTIONAL_EPSILON) return 1;
  return clamp01(overlap / (sourceTotal + DIRECTIONAL_EPSILON));
}

/** 非负、未归一化概念轴上的 Generalized KL / I-divergence。 */
export function generalizedKLDivergence(source: number[], target: number[]): number {
  assertConceptAxisPair(source, target);
  return source.reduce((total, sourceValue, index) => {
    const x = sourceValue + GKL_EPSILON;
    const y = target[index] + GKL_EPSILON;
    return total + x * Math.log(x / y) - x + y;
  }, 0);
}

export function generalizedKLSimilarity(source: number[], target: number[]): number {
  assertConceptAxisPair(source, target);
  if (signal(source) <= DIRECTIONAL_EPSILON) return 0;
  const divergence = generalizedKLDivergence(source, target);
  const score = Math.exp(-Math.max(0, divergence) / (AXES.length * GKL_TEMPERATURE));
  return Number.isFinite(score) ? clamp01(score) : 0;
}

export function directedAxisSimilarity(source: number[], target: number[]): number {
  const coverage = directedCoverage(source, target);
  const gkl = generalizedKLSimilarity(source, target);
  return clamp01(0.5 * coverage + 0.5 * gkl);
}
