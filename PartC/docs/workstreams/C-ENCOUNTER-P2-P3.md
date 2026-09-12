# C · Encounter 匹配算法：P2 / P3

本轮在 P0 稳定输出契约、P1 候选硬过滤的基础上，实现可运行的 Mock 多路召回与排序管线。当前项目仍使用 JSON 概念轴向量；模块边界已经为后续 pgvector、Embedding 服务和真实 Reranker 留出替换点。

## P2：多路召回

入口：`lib/retrieval/multi-recall.ts`

四条通道独立计算并取 Top-K：

1. `long_term`：长期兴趣与持续关注的问题；
2. `value`：价值问题与判断倾向；
3. `conversation`：表达方式和对话风格；
4. `current`：双方仍在有效期内的 Current State。

每条通道默认最多召回 200 人。结果按用户 ID 去重，保留：

- `recall_sources`：该用户被哪些通道召回；
- `recall_scores`：各通道的相似度；
- `recall`：所有命中通道中的最高分。

如果浏览者尚无任何画像向量，则把 P1 已通过硬过滤的候选作为冷启动集合交给排序，避免空结果。

## P3：粗排、Mock Rerank 与双向匹配

入口：`lib/retrieval/scoring.ts`

粗排分：

```text
0.30 × LongTerm
+ 0.25 × Conversation
+ 0.20 × CurrentState
+ 0.15 × IntentFit
+ 0.05 × Novelty
+ 0.05 × Diversity
```

Mock Rerank：

```text
0.70 × CoarseScore + 0.30 × ValueSimilarity
```

单向配对分：

```text
Pair(A→B) = 0.40 × LongTerm + 0.30 × Value
          + 0.20 × Conversation + 0.10 × CurrentState
```

双向分取 `min(Pair(A→B), Pair(B→A))`，防止只有一方高度匹配。最终分：

```text
0.55 × Rerank + 0.45 × Mutual
```

多样性以候选长期画像的主轴为簇：当前序列第一次出现的主轴得 1，重复主轴得 0.4。已推荐过的候选 `Novelty` 从 1 降为 0.3。

## 接入点与兼容性

- `lib/retrieval/matcher.ts` 现在按“P1 硬过滤 → P2 多路召回 → P3 排序 → Content Bridge”运行。
- 推荐表原有 `scores` JSON 增加 `val`、`diversity`、`recall`；原有字段不删除。
- 推荐表原有 `bridge` JSON 保存召回来源和通道分，不改数据库 Schema。
- `lib/ai/bridge.ts` 继续导出 `pairScore`，旧调用路径兼容；实现移动到纯排序模块。
- 页面/API 的 `RecCard` 增加对应的召回调试字段，原有展示字段保持不变。

## 本轮未伪装完成的生产能力

以下能力需要修改冻结的数据库/基础设施或需要真实模型凭据，因此仍是下一阶段工作：

- pgvector 索引、SQL ANN 检索与数据库迁移；
- 真实 Embedding 批处理和增量更新；
- 跨编码器或 LLM Reranker；
- 以内容 Anchor 为入口的独立召回索引；
- 更精细的 A→B / B→A 非对称特征。

当前实现的价值是把这些能力约束在清晰接口后面；替换底层召回或 Rerank 时，不必改页面契约和 Encounter 主流程。
