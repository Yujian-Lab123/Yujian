import assert from 'node:assert/strict';
import { embedTexts } from '../lib/providers/embedding.ts';
import { chunkText, contentSourceHash, diffContentAnalyses } from '../lib/profile/incremental.ts';
import { extractUserPrompt } from '../lib/profile/prompt.ts';

const source = (id, text) => ({ id, text, title: id, type: '文章', url: null, published_at: null });
const oldSame = source('same', 'unchanged');
const oldChanged = source('changed', 'before');
const oldRemoved = source('removed', 'gone');
const record = (item) => ({
  content_id: item.id,
  source_hash: contentSourceHash(item),
  summary: item.text,
  topics: [],
  key_questions: [],
  candidates: [],
});

const diff = diffContentAnalyses(
  [oldSame, source('changed', 'after'), source('added', 'new')],
  [record(oldSame), record(oldChanged), record(oldRemoved)],
);
assert.deepEqual(diff, {
  added: ['added'], changed: ['changed'], unchanged: ['same'], removed: ['removed'],
});

const longText = '遇'.repeat(950);
const chunks = chunkText(longText, 400);
assert.deepEqual(chunks.map((item) => item.length), [400, 400, 150]);
assert.equal(chunks.join(''), longText);
const chunkedPrompt = extractUserPrompt([source('long', longText)], 400);
assert.match(chunkedPrompt, /\[片段 1\/3\]/);
assert.match(chunkedPrompt, /\[片段 3\/3\]/);

let requestCount = 0;
const fakeFetch = async (_url, init) => {
  const { input } = JSON.parse(String(init.body));
  const base = requestCount++ * 10;
  const data = input.map((_, index) => ({ index, embedding: [base + index + 1, 1] })).reverse();
  return new Response(JSON.stringify({ data }), { status: 200 });
};
const embedded = await embedTexts(['a', 'b', 'c'], {
  baseUrl: 'https://embedding.example/v1', apiKey: 'test-only', model: 'embed-test', batchSize: 2,
  dimensions: 2, fetchImpl: fakeFetch,
});
assert.equal(requestCount, 2);
assert.deepEqual(embedded?.vectors, [[1, 1], [2, 1], [11, 1]]);
assert.equal(embedded?.spaceId.length, 24);

const invalid = await embedTexts(['a', 'b'], {
  baseUrl: 'https://embedding.example/v1', apiKey: 'test-only', model: 'embed-test',
  dimensions: 2,
  fetchImpl: async () => new Response(JSON.stringify({
    data: [{ index: 0, embedding: [1, 2] }, { index: 1, embedding: [1, 2, 3] }],
  }), { status: 200 }),
});
assert.equal(invalid, null);

console.log('P4 verified: content diff, lossless chunking, embedding batching/order, and invalid-dimension rejection.');
