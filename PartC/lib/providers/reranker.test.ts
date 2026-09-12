import { describe, expect, it } from 'vitest';
import {
  buildRerankRequest,
  inferRerankApiStyle,
  parseRerankResponse,
  rerankTexts,
} from './reranker';

describe('RerankProvider', () => {
  it('supports qwen3 compatible request and restores input score order', async () => {
    let url = '';
    let body: Record<string, unknown> = {};
    const result = await rerankTexts('query', ['doc-a', 'doc-b'], {
      baseUrl: 'https://workspace.example/compatible-api/v1',
      apiKey: 'test-only',
      model: 'qwen3-rerank',
      apiStyle: 'compatible',
      instruct: 'Retrieve semantically similar text.',
      fetchImpl: async (input, init) => {
        url = String(input);
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          results: [
            { index: 1, relevance_score: 0.9 },
            { index: 0, relevance_score: 0.2 },
          ],
          usage: { total_tokens: 42 },
        }), { status: 200 });
      },
    });
    expect(url).toBe('https://workspace.example/compatible-api/v1/reranks');
    expect(body).toMatchObject({ model: 'qwen3-rerank', query: 'query', documents: ['doc-a', 'doc-b'], top_n: 2 });
    expect(body).not.toHaveProperty('input');
    expect(result).toMatchObject({ scores: [0.2, 0.9], ranking: [1, 0], apiStyle: 'compatible' });
  });

  it('supports nested DashScope request/response and omits unsupported gte instruction', () => {
    expect(inferRerankApiStyle('qwen3.7-text-rerank')).toBe('dashscope');
    expect(buildRerankRequest({
      model: 'gte-rerank-v2',
      apiStyle: 'dashscope',
      query: 'query',
      documents: ['a', 'b'],
      instruct: 'ignored',
    })).toEqual({
      model: 'gte-rerank-v2',
      input: { query: 'query', documents: ['a', 'b'] },
      parameters: { top_n: 2, return_documents: false },
    });
    expect(parseRerankResponse({
      output: { results: [{ index: 0, relevance_score: 0.8 }, { index: 1, relevance_score: 0.3 }] },
    }, 2).scores).toEqual([0.8, 0.3]);
  });

  it('rejects a partial or duplicate response instead of mixing model and mock scores', () => {
    expect(() => parseRerankResponse({ results: [{ index: 0, relevance_score: 0.8 }] }, 2)).toThrow(/数量不匹配/);
    expect(() => parseRerankResponse({ results: [
      { index: 0, relevance_score: 0.8 },
      { index: 0, relevance_score: 0.7 },
    ] }, 2)).toThrow(/重复 index/);
  });
});
