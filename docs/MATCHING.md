# 遇见 · 匹配算法

核心优化目标不是“相似度”，而是 **Conversation Potential**：两个人之间是否存在值得开始一次对话的东西。

## 用户表示：多层向量（非单一 Embedding）

| 层 | 来源 | 用途 |
| --- | --- | --- |
| long_term | 内容向量加权平均（anchor ×2） | 长期兴趣/主题 |
| value | long_term 在价值轴上的掩码（career/longterm/meaning/psycho/society/invest/edu） | “反复思考的问题”是否类似 |
| conversation | 掩码（writing/psycho/meaning/society/anxiety/life） | 是否聊得下去 |
| current | 此刻状态文本 → 向量（Mock：stateVec 关键词；真实：Embedding） | 此刻遇见 |
| content_anchor[] | 每篇内容一个向量 | Content Bridge |

Mock 阶段向量由种子数据人工标注在 16 维概念轴上；接入 Embedding 后仅替换 `lib/axes.stateVec` 与内容向量来源，管线不变。

## 在线漏斗（禁止 O(N²) LLM 全文比较）

1. **Hard Filter（SQL）**：encounter_enabled、intent 兼容。几乎零成本。
2. **Vector Recall**：long_term / value / conversation / current 多维余弦各取 Top，合并去重。不调 LLM。
3. **Algorithmic Ranking**：`0.30·long_term + 0.25·conversation + 0.20·current + 0.15·intent + 0.05·novelty + 0.05·diversity`。novelty=未曝光；diversity=主轴与已选候选不同。
4. **Reranker**：Mock `0.7·coarse + 0.3·value_cos`；真实阶段换 Qwen/gte rerank，只给结构化 Profile。
5. **LLM Deep Match（仅 Top 5）**：判断双向为什么值得认识、共同点、值得讨论的差异、开场问题。Zod 校验，失败回退 Mock。
6. **MutualScore**：`min(A→B, B→A)`；`final = 0.55·rerank + 0.45·mutual`。单边高分不优先。
7. **Content Bridge**：从 TA 的锚定内容里选 `0.7·cos(c, viewer.long_term) + 0.3·cos(c, viewer.value) + anchor_bonus` 最高的一篇——“认识 TA 最自然的入口”。
8. **Conversation Bridge**：开场问题由“桥接内容”驱动——在双方交集中选与锚定内容最贴近的轴，从问题库取问（真实阶段由 LLM 严格引用双方内容生成）。
9. **此刻遇见**：用户有当前状态时，current 余弦 ≥ 0.55 的人置顶并打 `moment` 标——Present Self 改变推荐。

## 反馈与指标

feedback 严格四类：`not_interested / content_interesting / learn_more / want_to_meet`。
核心实验指标 **Person Curiosity Rate** = learn_more ÷ 推荐曝光；Content Interest ≠ Person Curiosity。

## Demo 复现

- **Demo A 跨主题连接**：默认身份江树（AI/产品）→ 首推陈默（摄影师），共享「自由与稳定/意义与价值」，开场问题：“如果收入下降 30%，但每周多两天完全属于自己的时间，你会接受吗？”
- **Demo B 此刻状态**：/me 写“很想晚上找个人出去走走”→ 阿屿以「此刻遇见」置顶。
- **Demo C 喜欢内容≠想认识**：推荐卡上“内容有意思”与“想认识 TA”是两个独立按钮，分别落库。
