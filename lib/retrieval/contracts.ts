import type { ContentRow } from '../db';
import type { RecallSource } from './multi-recall';

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
  compatibility: number;
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

/** 页面/API 的稳定输出；算法可替换而无需页面同步重构。 */
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
  rerank_mode: 'model' | 'fallback';
  rerank_model?: string;
  status: string;
  moment?: boolean;
}
