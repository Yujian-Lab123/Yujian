# 非对称相似度改造：新窗口实施交接

更新时间：2026-09-09

## 1. 任务目标

把当前名义上的 `Pair(A→B)` / `Pair(B→A)` 从纯余弦对称分数升级为真正的方向性分数，同时保持以下行为：

- P2/P5 的向量召回继续使用余弦，不降低召回率、不破坏 pgvector HNSW；
- P3 才加入方向性特征；
- P6 真实 Reranker 和 Mock 回退继续可用；
- Demo A、Demo B 和无真实服务时的降级链路继续运行；
- 不修改数据库 Schema、不生成迁移、不安装依赖。

项目根目录：

```text
C:\Users\Lenovo\Desktop\知乎黑客松\Yujian-main\Yujian-main
```

所有更改和新文件只能放在桌面“知乎黑客松”文件夹内。

## 2. 当前状态，实施前必须重新核对

当前系统同时存在两个完全不同的向量空间：

| 向量空间 | 特征 | 当前用途 |
| --- | --- | --- |
| 16维概念轴 | 每一维语义明确、非负、通常在 0～1 | Mock/内存召回、可解释排序 |
| 1024维真实 Embedding | 潜在维度不可解释、可能包含负数 | P5 pgvector/HNSW 召回与排序输入 |

重要边界：Coverage、KLD、Entropy 等“把维度当类别”的方法只能用于16维概念轴，不能直接用于1024维通用 Embedding。

当前调用链：

```text
P1 Hard Filter
  → P5 pgvector ANN（不可用时 P2 内存召回）
  → P3 rankRecalledCandidates
  → P6 Qwen Reranker（不可用时 Mock Rerank）
  → Mutual / Final
  → Content Bridge
```

当前对称来源位于 `lib/retrieval/scoring.ts`：

```ts
pairScore(A, B)
  = 0.4 × cosine(long_term)
  + 0.3 × cosine(value)
  + 0.2 × cosine(conversation)
  + 0.1 × cosine(current)

mutual = min(pairScore(A, B), pairScore(B, A))
```

余弦对称，因此当前两个 `pairScore` 实际相等。

## 3. 已确定的设计决策

### 3.1 P2/P5 召回不改

以下代码继续使用余弦：

- `lib/retrieval/multi-recall.ts`
- `lib/retrieval/pgvector.ts`
- `lib/db/vector-index.ts`

原因：召回目标是高覆盖地找候选；余弦适合 ANN 索引。方向性判断放在候选规模已经缩小的 P3。

### 3.2 只对16维非负概念轴启用方向性算法

新增判定：

```ts
isConceptAxisVector(vector)
  = vector.length === AXES.length
  && 每一维是有限数
  && 0 <= value <= 1
```

如果任一向量不是16维概念轴，方向性层必须自动回退当前余弦，不能对真实 Embedding 做 Softmax、截断负数或 KLD。

## 4. 新增的两个方向性指标

### 4.1 Directed Coverage

令 A 是“需求/观察方向”，B 是“候选供给方向”：

```text
Coverage(A→B) = Σ min(Ai, Bi) / (Σ Ai + ε)
```

语义：A 所重视的总强度，有多少被 B 覆盖。

要求：

- `ε = 1e-9`；
- A 无有效信号时返回 0；
- 相同非零向量返回 1；
- 结果限制在 `[0, 1]`。

方向性测试样例：

```text
A = [0.9, 0.1, 其余为 0]
B = [0.09, 0.01, 其余为 0]

cosine(A, B) = 1
Coverage(A→B) = 0.1
Coverage(B→A) = 1
```

该样例证明它保留了归一化会丢失的强度差异。

### 4.2 Generalized KL / I-divergence

不要先把向量归一化为概率分布。对非负、未归一化的概念轴使用：

```text
x = Ai + ε
y = Bi + ε

D_GKL(A || B) = Σ [x × ln(x / y) - x + y]
```

其中 `ε = 1e-6`。为把距离转成 `[0,1]` 相似分：

```text
GKLScore(A→B) = exp(-max(0, D_GKL) / (16 × τ))
```

第一版固定 `τ = 1`，后续再用行为数据校准。

要求：

- 相同非零向量的距离为 0、相似分为 1；
- 输出必须有限；
- A/B 交换后通常不同；
- A 没有信号时，方向性相似分返回 0；
- 不接受负数或非16维向量。

### 4.3 方向性轴分

第一版固定：

```text
AxisDirectional(A→B)
  = 0.5 × Coverage(A→B)
  + 0.5 × GKLScore(A→B)
```

不要在第一版把 Entropy 放入主排序。Entropy 只能说明分布集中程度，不能直接代表画像可靠度；画像置信度应以后结合内容数量、证据数量和跨内容一致性。

## 5. P3 的具体改法

保留原来的四层权重，只替换长期和价值层的内部相似度：

```text
Pair(A→B)
  = 0.4 × LayerLongTerm(A→B)
  + 0.3 × LayerValue(A→B)
  + 0.2 × CosineConversation(A, B)
  + 0.1 × CosineCurrent(A, B)
```

其中：

```text
如果是16维概念轴：
  LayerLongTerm = AxisDirectional(A.long_term → B.long_term)
  LayerValue    = AxisDirectional(A.value → B.value)

如果是通用高维 Embedding：
  LayerLongTerm = Cosine(A.long_term, B.long_term)
  LayerValue    = Cosine(A.value, B.value)
```

Conversation 暂时继续使用余弦，因为表达风格兼容更接近对称关系；Current 暂时继续使用余弦，因为“此刻是否同频”也适合作为对称信号。

分别计算：

```ts
forward = Pair(viewer → candidate);
backward = Pair(candidate → viewer);
mutual = Math.min(forward, backward);
final = 0.55 * rerank + 0.45 * mutual;
```

第一版继续使用 `min`，不要同时改成调和平均，避免一次提交改变过多变量。调和平均可作为后续独立实验。

## 6. 推荐的代码结构

新增：

```text
lib/retrieval/directional-similarity.ts
lib/retrieval/directional-similarity.test.ts
```

建议导出：

```ts
export const DIRECTIONAL_EPSILON = 1e-9;
export const GKL_EPSILON = 1e-6;
export const GKL_TEMPERATURE = 1;

export function isConceptAxisVector(vector: number[]): boolean;
export function directedCoverage(source: number[], target: number[]): number;
export function generalizedKLDivergence(source: number[], target: number[]): number;
export function generalizedKLSimilarity(source: number[], target: number[]): number;
export function directedAxisSimilarity(source: number[], target: number[]): number;
```

在 `lib/retrieval/scoring.ts` 中增加带明细的计算结果：

```ts
interface PairScoreBreakdown {
  mode: 'concept-axis-directed' | 'embedding-cosine';
  score: number;
  long_term: number;
  value: number;
  conversation: number;
  current: number;
  coverage_long_term?: number;
  coverage_value?: number;
  gkl_long_term?: number;
  gkl_value?: number;
}

pairScoreBreakdown(A, B): PairScoreBreakdown
pairScore(A, B): number // 保留旧导出，返回 breakdown.score
```

`lib/ai/bridge.ts` 目前重导出 `pairScore`，必须保持兼容。

## 7. 输出与调试字段

在 `RankingFeatures` 中增加：

```ts
forward: number;
backward: number;
```

`mutual`、`final` 和所有原字段不得删除或重命名。

在 `lib/retrieval/contracts.ts` 的 `EncounterScores` 中增加：

```ts
forward: number;
backward: number;
```

并在 `lib/retrieval/matcher.ts` 写入推荐记录和 RecCard。

建议在原有 `bridge` 调试 JSON 中保存：

```json
{
  "directionality_mode": "concept-axis-directed",
  "forward": 0.68,
  "backward": 0.70
}
```

如果当前使用 P5 的1024维真实 Embedding，则模式应为：

```text
embedding-cosine
```

这时 forward/backward 可能仍相等，必须如实记录，不能声称真实高维 Embedding 已经实现方向性。

## 8. 预计修改范围

允许修改：

```text
lib/retrieval/directional-similarity.ts       新增
lib/retrieval/directional-similarity.test.ts  新增
lib/retrieval/scoring.ts
lib/retrieval/scoring.test.ts
lib/retrieval/model-rerank.test.ts            只补新必填测试字段
lib/retrieval/contracts.ts
lib/retrieval/matcher.ts
scripts/verify-p2-p3.mjs                      更新验证输出和断言
docs/DIRECTIONAL-SIMILARITY-VERIFICATION.md   新增验证结果
```

原则上不需要修改：

```text
lib/retrieval/multi-recall.ts
lib/retrieval/pgvector.ts
lib/db/vector-index.ts
lib/providers/embedding.ts
lib/providers/reranker.ts
lib/db/schema.ts
drizzle/**
package*.json
```

如果实际实现发现必须修改“不需要修改”列表中的文件，应先停止并向用户解释原因。

## 9. 必须覆盖的测试

### 数学性质

1. 相同非零概念轴：Coverage、GKLScore、AxisDirectional 都为 1。
2. 比例相同但强度不同：余弦为 1，Coverage 有方向差。
3. A 的重要轴在 B 中缺失：`Coverage(A→B)` 明显降低。
4. `GKL(A→B) !== GKL(B→A)` 的非对称样例。
5. 包含大量 0 时不产生 `NaN` 或 `Infinity`。
6. 空 source 返回 0。
7. 非法负数向量和维度不匹配不能被当作概念轴处理。

### 回归兼容

8. 1024维、可含负数的通用 Embedding 自动走 cosine fallback。
9. `forward` 与 `backward` 在16维方向样例中不同。
10. `mutual === min(forward, backward)`。
11. P6 模型 Rerank 只更新 `rerank/final`，保留 forward/backward/mutual。
12. P2/P5 召回逻辑和来源追踪不变。
13. Current State Moment 阈值仍为 0.55。

### Demo 回归

用 `scripts/verify-p2-p3.mjs` 重新跑真实种子数据：

- Demo A 第一名仍应为 `u2 陈默`；
- 预演采用本文件公式时，排序仍为 `u2 → u7 → u4 → u3`；
- Demo B 中 `u3 阿屿` 的 Current 相似度仍约为 `0.819`，并被 Moment 规则提到首卡；
- 输出 forward/backward，证明16维路径不再只是名义双向。

## 10. 验收标准

- P2/P5 召回代码未发生行为变化；
- 16维概念轴产生真实不同的 forward/backward；
- 1024维真实 Embedding 不执行 KLD/Coverage；
- 所有分数有限且位于 `[0,1]`；
- 原有字段和 API 行为向后兼容；
- Demo A/B 通过；
- 新增可复现验证报告，列出公式、输入、forward、backward、mutual、final；
- 若 `npm run check` 因没有 `node_modules` 无法执行，要如实报告，禁止擅自安装依赖。

## 11. 暂不做的事情

- 不直接对通用 Embedding 维度做 Softmax/KLD；
- 不把负数 Embedding 强行截断成 0；
- 不修改 pgvector 索引距离；
- 不更改 P6 Reranker Provider；
- 不训练新模型；
- 不把 Entropy 直接当作画像置信度；
- 不同时调整 `FINAL_WEIGHTS` 或 `mutual=min(...)` 聚合策略；
- 不修改数据库 Schema或创建迁移。

## 12. 可直接粘贴到新窗口的提示词

```text
请在“遇见”项目中实施非对称相似度改造。

项目根目录：
C:\Users\Lenovo\Desktop\知乎黑客松\Yujian-main\Yujian-main

请先完整阅读：
1. AGENTS.md
2. CONTRIBUTING.md
3. docs/OWNERSHIP.md
4. docs/workstreams/B-ENCOUNTER.md
5. docs/DIRECTIONAL-SIMILARITY-HANDOFF.md

严格按照交接文档实施和验收。关键边界是：P2/P5 召回继续使用余弦；Directed Coverage 和 Generalized KL 只用于16维非负可解释概念轴；1024维真实 Embedding 必须回退余弦，不能对其维度做 KLD。分别输出 forward、backward，并继续用 min 得到 mutual。

所有更改和新文件只能放在桌面“知乎黑客松”文件夹内。不要安装依赖，不要运行迁移，不要修改 package、数据库 Schema、drizzle、全局样式或公共组件。保留现有 P4/P5/P6 和用户改动。

完成后运行交接文档列出的数学测试、回归测试和 Demo A/B，给出实际 forward/backward/mutual/final 结果；如果完整 npm run check 因环境缺依赖无法运行，请如实报告，不要擅自安装。
```
