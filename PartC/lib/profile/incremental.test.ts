import { describe, expect, it } from 'vitest';
import { chunkText, contentSourceHash, diffContentAnalyses } from './incremental';
import type { ContentAnalysisRecord, NormalizedContent } from './schema';

const content = (id: string, text: string): NormalizedContent => ({
  id, text, title: id, type: '文章', url: null, published_at: '2026-09-09T00:00:00.000Z',
});

const analysis = (source: NormalizedContent): ContentAnalysisRecord => ({
  content_id: source.id,
  source_hash: contentSourceHash(source),
  summary: source.text,
  topics: [],
  key_questions: [],
  candidates: [],
});

describe('P4 incremental profile helpers', () => {
  it('distinguishes added, changed, unchanged and removed content ids', () => {
    const same = content('same', 'unchanged');
    const changedBefore = content('changed', 'before');
    const removed = content('removed', 'gone');
    const diff = diffContentAnalyses(
      [same, content('changed', 'after'), content('added', 'new')],
      [analysis(same), analysis(changedBefore), analysis(removed)],
    );
    expect(diff).toEqual({
      added: ['added'], changed: ['changed'], unchanged: ['same'], removed: ['removed'],
    });
  });

  it('chunks long text without loss or overlap', () => {
    const text = 'x'.repeat(950);
    const chunks = chunkText(text, 400);
    expect(chunks.map((item) => item.length)).toEqual([400, 400, 150]);
    expect(chunks.join('')).toBe(text);
  });
});
