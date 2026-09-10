# C · 相遇 Encounter + Matching

## 负责什么

负责“内容先行 → 了解 TA → 想认识 → 双向确认 → 已遇见”的完整闭环。核心目标不是堆相似度，而是让用户理解“为什么现在值得聊一句”。

## 允许修改的路径

- `app/encounter/**`
- `app/connect/**`
- `app/connections/**`
- `app/api/encounters/**`
- `app/api/connections/**`
- `lib/retrieval/**`
- `lib/ai/bridge.ts`

## 禁止修改的共享路径

- `app/me/**`、`app/side/**`、`app/profile/**`
- `lib/contextual-persona.ts`、`lib/profile/**`
- 数据库 Schema/迁移、会话、OAuth/Provider、全局样式、公共组件、依赖和框架配置

## 依赖的接口

- 画像摘要与内容向量（只读）
- `GET /api/me` 的已登录身份
- 现有推荐、反馈、意向和连接 API

## 必须保持的行为

- 推荐理由必须来自内容桥梁和结构化信号，不能虚构共同经历。
- `current` 只能作为排序信号；不能在卡片、详情、连接消息或日志中回显 `currentState.text` 原文。
- 重复点击不会产生重复意向或连接；已连接、待确认、不感兴趣对象不再重复推荐。

## 验收标准

- 空候选、无当前状态、已有连接和失败请求都有可理解的 UI。
- Demo A（跨主题连接）和 Demo B（此刻遇见置顶）都可跑通。
- 每个候选有内容入口、推荐理由和可执行的下一步。

## 必须执行的检查

`npm run check`；附从 `/encounter` 到 `/connections` 的流程截图。

## Agent 任务外壳

```text
任务目标：
责任角色：C
允许修改的路径：app/encounter/**、app/connect/**、app/connections/**、匹配 API、lib/retrieval/**、lib/ai/bridge.ts
禁止修改的共享路径：/me、/side、/profile、数据库、OAuth、全局样式、公共组件
依赖的接口：画像摘要、内容向量、当前登录身份、推荐/连接 API
必须保持的行为：不回显状态原文；幂等；推荐理由可追溯
验收标准：Demo A/B 和异常状态可跑通
必须执行的检查：npm run check
```
