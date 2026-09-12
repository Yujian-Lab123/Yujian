import type { RecallSource } from './multi-recall';

export interface AnnRouteMatch {
  userId: string;
  source: RecallSource;
  score: number;
}

export interface MergedAnnMatch {
  userId: string;
  recallSources: RecallSource[];
  recallScores: Partial<Record<RecallSource, number>>;
  recallScore: number;
}

export function isFiniteVector(value: unknown, dimensions?: number): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && (dimensions === undefined || value.length === dimensions)
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    && value.some((item) => item !== 0);
}

/** node-postgres 不原生编码 pgvector，使用校验后的数值字面量再交给 PostgreSQL cast。 */
export function toPgvectorLiteral(vector: number[]): string {
  if (!isFiniteVector(vector)) throw new Error('无效向量，无法生成 pgvector 字面量');
  return `[${vector.join(',')}]`;
}

export function parsePgvectorLiteral(value: unknown): number[] | null {
  if (Array.isArray(value)) return isFiniteVector(value) ? value : null;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return isFiniteVector(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clampSimilarity(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 合并各 ANN 通道的 Top-K，保留命中来源及每路分数，契约与内存召回一致。 */
export function mergeAnnMatches(matches: AnnRouteMatch[]): MergedAnnMatch[] {
  const merged = new Map<string, MergedAnnMatch>();
  for (const match of matches) {
    const score = clampSimilarity(match.score);
    const current = merged.get(match.userId);
    if (current) {
      if (!current.recallSources.includes(match.source)) current.recallSources.push(match.source);
      current.recallScores[match.source] = score;
      current.recallScore = Math.max(current.recallScore, score);
    } else {
      merged.set(match.userId, {
        userId: match.userId,
        recallSources: [match.source],
        recallScores: { [match.source]: score },
        recallScore: score,
      });
    }
  }
  return [...merged.values()].sort(
    (left, right) => right.recallScore - left.recallScore || left.userId.localeCompare(right.userId),
  );
}
