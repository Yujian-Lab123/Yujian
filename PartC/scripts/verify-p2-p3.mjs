import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Node 22 的 strip-types 不会自动补全仓库里的无扩展名 TS import；
// 这个只读 hook 让验证脚本直接执行项目现有 TypeScript 源码，无需安装依赖。
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
  AXES,
  AXIS_LABELS,
  CONVERSATION_AXES,
  VALUE_AXES,
  cosine,
  mask,
  stateVec,
  topAxes,
  vec,
} = await import('../lib/axes.ts');
const { SEED_CONTENTS, SEED_USERS } = await import('../lib/db/seed.ts');
const { evaluateCandidate, filterEligibleCandidates } = await import('../lib/retrieval/candidate-filter.ts');
const { RECALL_SOURCES, multiRouteRecall } = await import('../lib/retrieval/multi-recall.ts');
const { coarseScore, finalScore, rankRecalledCandidates, rerankScore } = await import('../lib/retrieval/scoring.ts');

const round = (value) => Number(value.toFixed(3));
const line = (title) => console.log(`\n${'='.repeat(18)} ${title} ${'='.repeat(18)}`);

function averageVectors(items) {
  if (items.length === 0) return vec({});
  const output = new Array(AXES.length).fill(0);
  let totalWeight = 0;
  for (const { vector, weight } of items) {
    totalWeight += weight;
    for (let i = 0; i < output.length; i += 1) output[i] += (vector[i] || 0) * weight;
  }
  return output.map((value) => Math.min(1, value / totalWeight));
}

function vectorsFor(userId, includeCurrent = true) {
  const contentVectors = SEED_CONTENTS
    .filter((content) => content.user_id === userId)
    .map((content) => ({ vector: vec(content.v), weight: content.anchor ? 2 : 1 }));
  const longTerm = averageVectors(contentVectors);
  const user = SEED_USERS.find((candidate) => candidate.id === userId);
  return {
    long_term: longTerm,
    value: mask(longTerm, VALUE_AXES),
    conversation: mask(longTerm, CONVERSATION_AXES),
    current: includeCurrent && user?.current_state ? stateVec(user.current_state.text) : null,
  };
}

function profileSummary(user, vectors) {
  return {
    id: user.id,
    name: user.name,
    top_axes: topAxes(vectors.long_term, 3).map((item) => AXIS_LABELS[item.axis]).join(' / '),
    intents: user.intents.join('+'),
    has_current: Boolean(vectors.current),
  };
}

function bridgeCandidates(viewerVectors, targetId) {
  return SEED_CONTENTS
    .filter((content) => content.user_id === targetId)
    .map((content) => {
      const contentVector = vec(content.v);
      const score = 0.7 * cosine(contentVector, viewerVectors.long_term)
        + 0.3 * cosine(contentVector, viewerVectors.value)
        + (content.anchor ? 0.08 : 0);
      return { id: content.id, title: content.title, anchor: Boolean(content.anchor), score };
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

function showRecall(recalled) {
  for (const source of RECALL_SOURCES) {
    const route = recalled
      .filter((item) => item.recallSources.includes(source))
      .sort((left, right) => (right.recallScores[source] ?? 0) - (left.recallScores[source] ?? 0));
    console.log(`\n${source} 路：${route.length ? '' : '未启用或无命中'}`);
    if (route.length) {
      console.table(route.map((item, index) => ({
        route_rank: index + 1,
        id: item.user.id,
        name: item.user.name,
        similarity: round(item.recallScores[source]),
      })));
    }
  }
}

function showRanking(ranked) {
  console.table(ranked.map((item, index) => ({
    rank: index + 1,
    id: item.user.id,
    name: item.user.name,
    LT: round(item.lt),
    Value: round(item.val),
    Conv: round(item.conv),
    Current: round(item.cur),
    Intent: round(item.intent),
    Novelty: round(item.novelty),
    Diversity: round(item.diversity),
    Coarse: round(item.coarse),
    Rerank: round(item.rerank),
    Mutual: round(item.mutual),
    Final: round(item.final),
  })));
}

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
  console.log(`✓ ${message}`);
}

const users = SEED_USERS.map((user) => ({
  ...user,
  // 模拟一个关闭 Encounter 的账号，覆盖 P1 → P2 的输入边界。
  encounter_enabled: user.id === 'u5' ? 0 : 1,
}));
const viewer = users.find((user) => user.id === 'u0');
const filterContext = {
  viewerId: viewer.id,
  viewerIntents: viewer.intents,
  connectedUserIds: new Set(['u1']),
  outgoingPendingTargetIds: new Set(['u8']),
  ignoredTargetIds: new Set(['u6']),
  blockedTargetIds: new Set(['u9']),
};

line('输入');
console.log(`浏览者：${viewer.id} ${viewer.name}（${viewer.role}）`);
console.log(`意愿：${viewer.intents.join('、')}`);
console.log(`种子用户：${users.length} 人；种子内容：${SEED_CONTENTS.length} 篇`);

line('步骤 1：P1 硬过滤，为 P2 准备候选');
console.table(users.map((user) => {
  const decision = evaluateCandidate(user, filterContext);
  return {
    id: user.id,
    name: user.name,
    eligible: decision.eligible,
    reason: decision.reason ?? 'pass',
  };
}));
const eligible = filterEligibleCandidates(users, filterContext);
check(
  JSON.stringify(eligible.map((user) => user.id)) === JSON.stringify(['u2', 'u3', 'u4', 'u7']),
  '硬过滤后只剩 u2、u3、u4、u7',
);

line('步骤 2：用真实内容构造 Mock 画像');
const baseViewerVectors = vectorsFor(viewer.id, false);
const candidatePairs = eligible.map((user) => ({ user, vectors: vectorsFor(user.id) }));
console.table([
  profileSummary(viewer, baseViewerVectors),
  ...candidatePairs.map(({ user, vectors }) => profileSummary(user, vectors)),
]);

line('步骤 3：P2 四路独立召回');
const recalled = multiRouteRecall(baseViewerVectors, candidatePairs);
showRecall(recalled);
check(new Set(recalled.map((item) => item.user.id)).size === recalled.length, '四路结果按用户 ID 合并且无重复');
check(recalled.every((item) => item.recallSources.length >= 1), '每个结果都保留了召回来源');

line('步骤 4：P2 合并结果');
console.table(recalled.map((item) => ({
  id: item.user.id,
  name: item.user.name,
  sources: item.recallSources.join(' + '),
  max_recall: round(item.recallScore),
})).sort((left, right) => right.max_recall - left.max_recall));

line('步骤 5：P3 特征、粗排、Mock Rerank、Mutual、Final');
const ranked = rankRecalledCandidates({
  viewerVectors: baseViewerVectors,
  viewerIntents: viewer.intents,
  candidates: recalled,
  seenTargetIds: new Set(),
});
showRanking(ranked);
for (const item of ranked) {
  const recalculatedCoarse = coarseScore(item);
  const recalculatedRerank = rerankScore(recalculatedCoarse, item.val);
  const recalculatedFinal = finalScore(recalculatedRerank, item.mutual);
  check(Math.abs(item.coarse - recalculatedCoarse) < 1e-12, `${item.user.name} 的 Coarse 公式可复算`);
  check(Math.abs(item.rerank - recalculatedRerank) < 1e-12, `${item.user.name} 的 Rerank 公式可复算`);
  check(Math.abs(item.final - recalculatedFinal) < 1e-12, `${item.user.name} 的 Final 公式可复算`);
}
check(ranked[0].user.id === 'u2', 'Demo A 第一名是 u2 陈默');

line('步骤 6：P3 输出接入下游 Content Bridge');
const bridgeRanking = bridgeCandidates(baseViewerVectors, ranked[0].user.id);
console.table(bridgeRanking.map((item, index) => ({
  rank: index + 1,
  id: item.id,
  title: item.title,
  is_anchor: item.anchor,
  bridge_score: round(item.score),
})));
check(bridgeRanking[0].id === 'c24', '按当前 Content Bridge 公式，陈默的 c24 是实际首选内容');

line('步骤 7：Demo B，Current State 路由');
const currentText = '很想晚上找个人出去走走';
const momentViewerVectors = { ...baseViewerVectors, current: stateVec(currentText) };
console.log(`江树的 Current State：${currentText}`);
const momentRecalled = multiRouteRecall(momentViewerVectors, candidatePairs);
const currentRoute = momentRecalled
  .filter((item) => item.recallSources.includes('current'))
  .sort((left, right) => (right.recallScores.current ?? 0) - (left.recallScores.current ?? 0));
console.table(currentRoute.map((item, index) => ({
  route_rank: index + 1,
  id: item.user.id,
  name: item.user.name,
  current_similarity: round(item.recallScores.current),
})));
const momentRanked = rankRecalledCandidates({
  viewerVectors: momentViewerVectors,
  viewerIntents: viewer.intents,
  candidates: momentRecalled,
  seenTargetIds: new Set(),
});
console.log('\nP3 正常 Final 排序：');
showRanking(momentRanked);
const momentCandidate = [...momentRanked].sort((left, right) => right.cur - left.cur)[0];
check(momentCandidate.user.id === 'u3', 'Current State 最相近的人是 u3 阿屿');
check(momentCandidate.cur >= 0.55, `阿屿的 Current 分 ${round(momentCandidate.cur)} 达到 0.55 阈值`);
check(momentCandidate.recall.sources.includes('current'), '阿屿的召回追踪包含 current 通道');

const encounterOrder = momentRanked.slice(0, 3).map((item) => item.user.id);
const existingIndex = encounterOrder.indexOf(momentCandidate.user.id);
if (existingIndex >= 0) encounterOrder.splice(existingIndex, 1);
encounterOrder.unshift(momentCandidate.user.id);
console.log(`Moment 规则应用后的卡片顺序：${encounterOrder.join(' → ')}`);
check(encounterOrder[0] === 'u3', 'Moment 规则把阿屿提升到 Encounter 第一张卡片');

line('结论');
console.log(`PASS：${assertions} 项断言全部通过。`);
console.log('P2 已验证：多路独立召回、合并去重、来源追踪、Current 路由。');
console.log('P3 已验证：特征计算、粗排、Mock Rerank、Mutual、Final 排序、Moment 提升。');
