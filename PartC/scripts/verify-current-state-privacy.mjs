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
  buildCurrentStateMatchText,
  decodeCurrentState,
  encodeCurrentState,
  parseCurrentStateSelection,
} = await import('../lib/current-state/privacy.ts');

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const selection = { mood: '疲惫', activity: '想走走', connectionMode: '找同伴' };
const sentinel = 'PRIVATE_NOTE_SENTINEL_只允许临时交给LLM';

assert.deepEqual(parseCurrentStateSelection(selection), selection);
assert.equal(parseCurrentStateSelection({ ...selection, mood: '任意自由输入' }), null);
assert.equal(
  buildCurrentStateMatchText(selection),
  '心情：疲惫；活动：想走走；交流：找同伴',
);

const envelope = encodeCurrentState(selection, {
  status: 'understood',
  understanding: { themes: ['work', 'rest'], supportNeed: 'companion', summary: sentinel },
});
assert.equal(envelope.includes(sentinel), false);
assert.equal(envelope.includes('summary'), false);
assert.deepEqual(decodeCurrentState(envelope)?.match, selection);
assert.equal(decodeCurrentState('今晚想找个人走走'), null);

const stateApi = read('../app/api/me/current-state/route.ts');
assert.match(stateApi, /understandPrivateCurrentNote\(privateNote\)/);
assert.match(stateApi, /setCurrentState\(uid, selection, noteProcessing\)/);
assert.doesNotMatch(stateApi, /setCurrentState\(uid,\s*(text|privateNote)/);

const meApi = read('../app/api/me/route.ts');
assert.match(meApi, /getLatestStructuredCurrentState/);
assert.doesNotMatch(meApi, /text:\s*cs\.text/);

const dbIndex = read('../lib/db/index.ts');
assert.match(dbIndex, /matchTextFromStoredCurrentState\(activeState\.text\)/);
assert.match(dbIndex, /syncCurrentStateVector\(userId, matchText, expiresAt\)/);

const vectorIndex = read('../lib/db/vector-index.ts');
assert.match(vectorIndex, /sourceId = `structured:\$\{userId\}`/);
assert.match(vectorIndex, /source_id = 'structured:' \|\| user_id/);
assert.doesNotMatch(vectorIndex, /embedTexts\(\[privateNote\]/);

const rerankPipeline = read('../lib/retrieval/rerank-pipeline.ts');
assert.match(rerankPipeline, /buildCurrentStateMatchText\(currentState\.selection\)/);
assert.doesNotMatch(rerankPipeline, /currentState\?\.text/);

const seed = read('../lib/db/seed.ts');
assert.match(seed, /current_state: \{ mood: '疲惫', activity: '想走走', connectionMode: '找同伴' \}/);
assert.doesNotMatch(seed, /current_state:\s*\{\s*text:/);

const mePage = read('../app/me/page.tsx');
assert.match(mePage, /不参与匹配、推荐理由或任何页面展示/);
assert.match(mePage, /me\.currentState\.selection\.mood/);
assert.doesNotMatch(mePage, /me\.currentState\.text/);

const encounterPage = read('../app/encounter/page.tsx');
assert.match(encounterPage, /基于双方选择的此刻标签/);

console.log('Current State privacy verified: only allow-listed selections reach matching; private note plaintext is not stored, returned, reranked, or displayed.');
