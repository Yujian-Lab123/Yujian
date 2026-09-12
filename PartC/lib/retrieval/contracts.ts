import type { ContentRow } from '../db';
import type { RecallSource } from './multi-recall';

/**
 * Encounter 对页面/API 的稳定输出契约。
 *
 * P0 先冻结现有字段名，后续召回、Rerank 和真实 Embedding 可以替换内部实现，
 * 不要求页面跟着算法重构。
 */
export interface EncounterScores {
  long_term: number;
  value: number;
  conversation: number;
  current: number;
  intent: number;
  novelty: number;
  diversity: number;
  recall: number;
  coarse: number;
  rerank: number;
  mutual: number;
  final: number;
}

export interface EncounterTargetPreview {
  id: string;
  name: string;
  role: string;
  city: string;
  quote: string;
  tags: string[];
  zhihu_years: number;
  upvotes: string;
}

export interface RecCard {
  id: string;
  target: EncounterTargetPreview;
  anchor: ContentRow;
  reason: string;
  shared: string[];
  difference: { label: string; note: string } | null;
  question: string;
  scores: EncounterScores;
  recall_sources: RecallSource[];
  recall_scores: Partial<Record<RecallSource, number>>;
  retrieval_mode?: 'pgvector' | 'memory';
  rerank_mode?: 'model' | 'mock';
  rerank_model?: string;
  status: string;
  moment?: boolean;
}
