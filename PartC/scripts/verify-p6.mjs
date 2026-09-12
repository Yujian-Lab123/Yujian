import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
    return isRelative && !hasExtension
      ? nextResolve(`${specifier}.ts`, context)
      : nextResolve(specifier, context);
  },
});

const {
  buildRerankRequest,
  parseRerankResponse,
  rerankTexts,
} = await import('../lib/providers/reranker.ts');
const {
  applyModelRerankScores,
  buildRerankPersonText,
  selectRerankPool,
} = await import('../lib/retrieval/model-rerank.ts');

const compatible = buildRerankRequest({
  model: 'qwen3-rerank', apiStyle: 'compatible', query: 'query', documents: ['a', 'b'], instruct: 'similarity',
});
assert.equal(compatible.top_n, 2);
assert.equal(compatible.query, 'query');
assert.equal('input' in compatible, false);

const legacy = buildRerankRequest({
  model: 'gte-rerank-v2', apiStyle: 'dashscope', query: 'query', documents: ['a', 'b'], instruct: 'ignored',
});
assert.deepEqual(legacy, {
  model: 'gte-rerank-v2', input: { query: 'query', documents: ['a', 'b'] },
  parameters: { top_n: 2, return_documents: false },
});

const parsed = parseRerankResponse({
  results: [{ index: 1, relevance_score: 0.91 }, { index: 0, relevance_score: 0.32 }],
  usage: { total_tokens: 12 },
}, 2);
assert.deepEqual(parsed.scores, [0.32, 0.91]);
assert.deepEqual(parsed.ranking, [1, 0]);
assert.equal(parsed.totalTokens, 12);
assert.throws(() => parseRerankResponse({ results: [{ index: 0, relevance_score: 0.5 }] }, 2));

let calledUrl = '';
const provider = await rerankTexts('query', ['a', 'b'], {
  baseUrl: 'https://workspace.example/compatible-api/v1', apiKey: 'test-only',
  model: 'qwen3-rerank', apiStyle: 'compatible',
  fetchImpl: async (url) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ results: [
      { index: 1, relevance_score: 0.91 }, { index: 0, relevance_score: 0.32 },
    ] }), { status: 200 });
  },
});
assert.equal(calledUrl, 'https://workspace.example/compatible-api/v1/reranks');
assert.deepEqual(provider?.scores, [0.32, 0.91]);

const profileText = buildRerankPersonText({
  id: 'u0', name: '江树', role: '产品经理', quote: '关心人与技术',
  tags: ['AI', '长期主义'], intents: ['朋友'], encounter_enabled: 1,
}, null, '今晚想出去走走');
assert.match(profileText, /此刻状态：今晚想出去走走/);

const candidate = (id, mutual) => ({
  user: { id, name: id, role: '', quote: '', tags: [], intents: [], encounter_enabled: 1 },
  vectors: { long_term: [1], value: [1], conversation: [1], current: null },
  lt: 1, val: 1, conv: 1, cur: 0, intent: 1, novelty: 1, diversity: 0.4,
  coarse: 0.8, rerank: 0.8, mutual, final: 0.8,
  recall: { sources: ['long_term'], scores: { long_term: 1 }, max_score: 1 },
});
const rescored = applyModelRerankScores([candidate('a', 0.2), candidate('b', 0.9)], [0.95, 0.4]);
assert.deepEqual(rescored.map((item) => item.user.id), ['b', 'a']);
const moment = candidate('moment', 0.1);
moment.cur = 0.8;
assert.deepEqual(selectRerankPool([candidate('a', 0.9), candidate('b', 0.8), moment], 2).map((item) => item.user.id), ['a', 'moment']);

const matcher = fs.readFileSync(new URL('../lib/retrieval/matcher.ts', import.meta.url), 'utf8');
assert.match(matcher, /rerankWithModel\(currentViewer, algorithmicScored\)/);
assert.match(matcher, /rerank_mode/);

console.log('P6 verified: compatible/legacy payloads, strict response mapping, structured context, real-score fusion, and matcher fallback integration.');
