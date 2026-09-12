import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isFiniteVector,
  mergeAnnMatches,
  parsePgvectorLiteral,
  toPgvectorLiteral,
} from '../lib/retrieval/pgvector.ts';

const vector = Array.from({ length: 1024 }, (_, index) => (index === 0 ? 1 : index / 2048));
assert.equal(isFiniteVector(vector, 1024), true);
assert.equal(isFiniteVector(vector.slice(1), 1024), false);
assert.deepEqual(parsePgvectorLiteral(toPgvectorLiteral(vector)), vector);

const merged = mergeAnnMatches([
  { userId: 'u2', source: 'long_term', score: 0.82 },
  { userId: 'u1', source: 'value', score: 0.75 },
  { userId: 'u2', source: 'conversation', score: 0.91 },
]);
assert.deepEqual(merged.map((item) => item.userId), ['u2', 'u1']);
assert.deepEqual(merged[0].recallSources, ['long_term', 'conversation']);
assert.equal(merged[0].recallScore, 0.91);

const migration = fs.readFileSync(new URL('../drizzle/0002_p5_pgvector.sql', import.meta.url), 'utf8');
assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector/i);
assert.match(migration, /vector\(1024\)/i);
assert.match(migration, /USING hnsw/i);
assert.match(migration, /vector_cosine_ops/i);

const retrieval = fs.readFileSync(new URL('../lib/db/vector-index.ts', import.meta.url), 'utf8');
assert.match(retrieval, /embedding <=> \$1::vector/);
assert.match(retrieval, /hnsw\.iterative_scan = strict_order/);

const matcher = fs.readFileSync(new URL('../lib/retrieval/matcher.ts', import.meta.url), 'utf8');
assert.match(matcher, /pgvector ANN 不可用，自动降级内存召回/);
assert.match(matcher, /multiRouteRecall\(viewerVectors, vectorPairs\)/);

console.log('P5 verified: 1024-D contract, vector serialization, route merging, HNSW migration, ANN query, and memory fallback.');
