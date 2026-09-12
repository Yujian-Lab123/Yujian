import { describe, expect, it } from 'vitest';
import { embedTexts } from './embedding';

describe('EmbeddingProvider', () => {
  it('batches requests and restores data[index] order', async () => {
    let request = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { input: string[]; dimensions: number };
      expect(body.dimensions).toBe(2);
      const base = request++ * 10;
      const data = body.input.map((_, index) => ({ index, embedding: [base + index + 1, 1] })).reverse();
      return new Response(JSON.stringify({ data }), { status: 200 });
    };

    const result = await embedTexts(['a', 'b', 'c'], {
      baseUrl: 'https://embedding.example/v1', apiKey: 'test-only', model: 'embed-test', batchSize: 2,
      dimensions: 2, fetchImpl,
    });

    expect(request).toBe(2);
    expect(result?.vectors).toEqual([[1, 1], [2, 1], [11, 1]]);
    expect(result?.dimensions).toBe(2);
    expect(result?.spaceId).toHaveLength(24);
  });

  it('rejects mixed dimensions instead of returning a partial index', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      data: [{ index: 0, embedding: [1, 2] }, { index: 1, embedding: [1, 2, 3] }],
    }), { status: 200 });
    await expect(embedTexts(['a', 'b'], {
      baseUrl: 'https://embedding.example/v1', apiKey: 'test-only', model: 'embed-test', dimensions: 2, fetchImpl,
    })).resolves.toBeNull();
  });
});
