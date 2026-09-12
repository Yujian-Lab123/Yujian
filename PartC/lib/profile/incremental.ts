import { createHash } from 'node:crypto';
import type { ContentAnalysis, ContentAnalysisRecord, NormalizedContent } from './schema.ts';

export interface IncrementalDiff {
  added: string[];
  changed: string[];
  unchanged: string[];
  removed: string[];
}

export function contentSourceHash(content: NormalizedContent): string {
  return createHash('sha256')
    .update([
      content.id,
      content.type,
      content.title,
      content.published_at || '',
      content.url || '',
      content.text,
    ].join('\u0000'))
    .digest('hex');
}

export function diffContentAnalyses(
  contents: NormalizedContent[],
  previous: ContentAnalysisRecord[] = [],
): IncrementalDiff {
  const old = new Map(previous.map((item) => [item.content_id, item.source_hash] as const));
  const currentIds = new Set(contents.map((content) => content.id));
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const content of contents) {
    const before = old.get(content.id);
    if (before === undefined) added.push(content.id);
    else if (before === contentSourceHash(content)) unchanged.push(content.id);
    else changed.push(content.id);
  }

  const removed = [...old.keys()].filter((id) => !currentIds.has(id));
  return { added, changed, unchanged, removed };
}

/** 简单、稳定的长文分块；边界语义由后续 LLM 摘要合并，不重叠以避免重复证据。 */
export function chunkText(text: string, chunkChars = 3_000): string[] {
  const size = Number.isFinite(chunkChars) ? Math.max(400, Math.floor(chunkChars)) : 3_000;
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += size) chunks.push(text.slice(offset, offset + size));
  return chunks;
}

export function analysisEmbeddingText(analysis: ContentAnalysis): string {
  return [
    analysis.summary,
    analysis.topics.length ? `主题：${analysis.topics.join('、')}` : '',
    analysis.key_questions.length ? `关键问题：${analysis.key_questions.join('；')}` : '',
  ].filter(Boolean).join('\n');
}
