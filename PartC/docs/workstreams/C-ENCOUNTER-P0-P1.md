# C · Encounter P0/P1 基线

> 图片中的 C 对应本仓库原有的“B · 匹配产品”范围。本文件只冻结本轮 Encounter 输入输出和候选过滤行为，不改变其他成员的职责。

## P0：稳定边界

### 输入

- 当前用户：`userId`、`intents`。
- 长期信号：`long_term`、`value`、`conversation` 向量。
- 此刻信号：未过期的 `current` 向量。
- 关系状态：已连接对象、当前用户已经发出的 pending 意向、不感兴趣对象。
- 候选状态：`encounter_enabled`、`intents`。

### 输出

`lib/retrieval/contracts.ts` 中的 `RecCard` 是 Encounter 页面/API 的稳定输出：

- 候选人的有限预览信息；
- 一篇 Content Bridge 内容；
- 推荐理由、共同点、值得讨论的差异和开场问题；
- `long_term/current/intent/coarse/rerank/mutual/final` 等可调试分数；
- 可选 `moment` 标记。

算法内部以后可以换成 pgvector、真实 Reranker 或方向性模型，但不得无兼容方案地删除、重命名上述字段。

## P1：候选过滤顺序

`lib/retrieval/candidate-filter.ts` 按以下顺序给出第一个排除原因：

1. 排除自己；
2. 排除未开启“遇见”的候选；
3. 排除已经连接的候选；
4. 排除当前用户已经发出 pending 意向的候选；
5. 排除当前用户标记为“不感兴趣”的候选；
6. 排除拉黑候选（当前只预留集合注入口）；
7. 双方都设置了 Intent 时，要求至少一个交集。

Intent 空数组表示“尚未设置”，暂不作为硬拒绝，避免刚完成 OAuth 的用户无法进入候选池。

## Current State 生命周期

- 新状态默认有效 72 小时，并写入数据库已有的 `current_states.expires_at` 字段。
- 向量读取和“我的”页面只读取未过期状态。
- 历史 `expires_at = null` 数据继续视为有效，避免升级后旧演示数据突然失效。

## 固定回归场景

- Demo A：江树可以召回陈默，关键 Content Anchor 为《我为什么没有留在大厂》。
- Demo B：阿屿保留“想出去走走”的 Current State 输入，供后续排序阶段验证置顶。
- 候选过滤：自己、关闭遇见、已连接、已发出意向、不感兴趣、拉黑、Intent 不兼容均被排除。

## 当前 Schema 缺口

本轮没有修改冻结的 `lib/db/schema.ts` 和 `drizzle/**`。因此以下过滤仍等待独立契约/迁移任务：

- 拉黑关系表；
- 年龄、性别、城市等双方硬偏好；
- 入站 pending 的反向发现与真正双向确认。

## 本轮检查

- `lib/retrieval/candidate-filter.test.ts`
- `lib/retrieval/demo-contract.test.ts`
- `lib/db/current-state.test.ts`
- 完整门禁：`npm run check`（需要本地先有 `node_modules`）

