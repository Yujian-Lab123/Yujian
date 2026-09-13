# 遇见 · 匹配算法

核心优化目标不是“相似度”，而是 **Conversation Potential**：两个人之间是否存在值得开始一次对话的东西。

## 用户表示：多层向量（非单一 Embedding）

| 层 | 来源 | 用途 |
| --- | --- | --- |
| long_term | 内容向量加权平均（anchor ×2） | 长期兴趣/主题 |
| value | long_term 在价值轴上的掩码（career/longterm/meaning/psycho/society/invest/edu） | “反复思考的问题”是否类似 |
| conversation | 掩码（writing/psycho/meaning/society/anxiety/life） | 是否聊得下去 |
| current | 心情 / 活动 / 交流意图三个白名单结构化标签 → 规范文本 → 向量 | 此刻遇见 |
| content_anchor[] | 每篇内容一个向量 | Content Bridge |

Mock 阶段向量由种子数据人工标注在 16 维概念轴上。P5 已增加独立的 1024 维真实向量空间：画像 Worker 将 P4 产物同步到 pgvector，在线召回优先走 HNSW；真实索引冷启动、迁移未执行或查询失败时自动回退 16 维内存链路，不混合两个空间计算相似度。

## 在线漏斗（禁止 O(N²) LLM 全文比较）

1. **Hard Filter（SQL）**：encounter_enabled、intent 兼容。几乎零成本。
2. **Vector Recall**：long_term / value / conversation / current 分别用 pgvector HNSW 余弦 ANN 取 Top-K，再合并去重。不调 LLM；真实索引未命中时回退同契约的内存召回。
3. **Algorithmic Ranking**：`0.30·long_term + 0.25·conversation + 0.20·current + 0.15·intent + 0.05·novelty + 0.05·diversity`。novelty=未曝光；diversity=主轴与已选候选不同。
4. **Reranker**：P6 配置后把算法粗排 Top-N 的压缩结构化 Profile 送入 Qwen 文本排序模型，以返回的 0–1 相关性替换 Mock 分；默认 20 人、硬上限 50。未配置或响应不完整时整批回退 `0.7·coarse + 0.3·value_cos`。
5. **LLM Deep Match（仅 Top 5）**：判断双向为什么值得认识、共同点、值得讨论的差异、开场问题。Zod 校验，失败回退 Mock。
6. **MutualScore**：`min(A→B, B→A)`；`final = 0.55·rerank + 0.45·mutual`。单边高分不优先。
7. **Content Bridge**：从 TA 的锚定内容里选 `0.7·cos(c, viewer.long_term) + 0.3·cos(c, viewer.value) + anchor_bonus` 最高的一篇——“认识 TA 最自然的入口”。
8. **Conversation Bridge**：开场问题由“桥接内容”驱动——在双方交集中选与锚定内容最贴近的轴，从问题库取问（真实阶段由 LLM 严格引用双方内容生成）。
9. **此刻遇见**：用户有当前状态时，current 余弦 ≥ 0.55 的人置顶并打 `moment` 标——Present Self 改变推荐。

P5 的调试契约会返回 `retrieval_mode: pgvector | memory`，并保留 `recall_sources` 与 `recall_scores`。真实 Embedding 为通用高维语义空间，因此不把单个维度误解释为 16 维概念轴；多样性项使用中性值，后续可改为聚类或 MMR。

P6 的调试契约返回 `rerank_mode: model | mock`，真实调用成功时附带 `rerank_model`。模型只接收画像结论和仍有效的结构化此刻标签，不接收用户私密记录、原始内容或证据摘录；真实分只在单次候选批次内比较，继续通过 `0.55·rerank + 0.45·mutual` 保留双向价值约束。

## 反馈与指标

feedback 严格四类：`not_interested / content_interesting / learn_more / want_to_meet`。
核心实验指标 **Person Curiosity Rate** = learn_more ÷ 推荐曝光；Content Interest ≠ Person Curiosity。

## Demo 复现

- **Demo A 跨主题连接**：默认身份江树（AI/产品）→ 首推陈默（摄影师），共享「自由与稳定/意义与价值」，开场问题：“如果收入下降 30%，但每周多两天完全属于自己的时间，你会接受吗？”
- **Demo B 此刻状态**：/me 选择“疲惫 / 想走走 / 找同伴”→ 阿屿以「此刻遇见」置顶；选填私密文字不参与匹配或展示。
- **Demo C 喜欢内容≠想认识**：推荐卡上“内容有意思”与“想认识 TA”是两个独立按钮，分别落库。
