import { describe, expect, it } from 'vitest';
import { buildRerankRequest, parseRerankResponse, rerankTexts } from './reranker';

describe('reranker provider', () => {
  it('supports compatible requests and restores input score order', async () => {
    let body: Record<string, unknown> = {};
    const result = await rerankTexts('query', ['doc-a', 'doc-b'], {
      baseUrl: 'https://workspace.example/compatible-api/v1',
      apiKey: 'test-only',
      model: 'qwen3-rerank',
      apiStyle: 'compatible',
      fetchImpl: async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          results: [
            { index: 1, relevance_score: 0.9 },
            { index: 0, relevance_score: 0.2 },
          ],
        }), { status: 200 });
      },
    });
    expect(body).toMatchObject({ query: 'query', documents: ['doc-a', 'doc-b'], top_n: 2 });
    expect(result?.scores).toEqual([0.2, 0.9]);
  });

  it('supports DashScope request shape', () => {
    expect(buildRerankRequest({
      model: 'gte-rerank-v2', apiStyle: 'dashscope', query: 'query', documents: ['a', 'b'],
    })).toEqual({
      model: 'gte-rerank-v2',
      input: { query: 'query', documents: ['a', 'b'] },
      parameters: { top_n: 2, return_documents: false },
    });
  });

  it('rejects partial or duplicate responses', () => {
    expect(() => parseRerankResponse({ results: [{ index: 0, relevance_score: 0.8 }] }, 2)).toThrow(/数量不匹配/);
    expect(() => parseRerankResponse({ results: [
      { index: 0, relevance_score: 0.8 },
      { index: 0, relevance_score: 0.7 },
    ] }, 2)).toThrow(/重复 index/);
  });
});
