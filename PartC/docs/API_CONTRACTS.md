# 共享接口契约

此文件记录跨模块稳定边界。任何变更先走契约 PR。

## 数据源

`ContentSource` 位于 `lib/providers/content-source.ts`：

- `getIdentity()` 返回统一外部身份。
- `listContents(cursor?)` 返回归一化 `RawContent[]` 与下一页游标。
- 当前有爬虫适配器；知乎 OAuth 的正式分页语义待官方文档开放后补齐。

## 画像任务

- `POST /api/profile/generate`：创建任务，返回 `{ ok, jobId }`。
- `GET /api/profile/jobs/:id`：返回任务。
- 状态只能是 `queued / running / succeeded / failed`。
- 成功任务提供 `slug`；失败任务提供脱敏 `error`。

## 健康检查

`GET /api/health` 返回 Web、PostgreSQL、画像 Worker 状态；数据库或 Worker 不健康时 HTTP 503。

## Encounter 推荐

`GET /api/encounters` 的卡片保持 P0 展示字段，并追加以下可选调试字段：

- `retrieval_mode: "pgvector" | "memory"`：P5 召回来源；
- `rerank_mode: "model" | "mock"`：P6 精排来源；
- `rerank_model`：仅真实模型成功时出现；
- `recall_sources / recall_scores`：多路召回轨迹。

模型、索引或外部服务不可用时字段明确标记回退模式，不删除原字段、不返回部分模型结果。

## “此刻”隐私契约

- `POST /api/me/current-state` 接收必填 `mood / activity / connectionMode` 白名单值，以及选填、最长 300 字的 `privateNote`。
- 只有三个结构化字段参与 Mock 向量、Embedding 和 Reranker。`privateNote` 只在请求期间交给 LLM，原文不持久化、不回传、不展示。
- 成功响应为 `{ ok, id, note_status }`；`note_status` 为 `not_provided / understood / discarded_unavailable`。
- `GET /api/me` 的 `currentState` 只包含 `selection / private_note_status / created_at`，不包含原文或 LLM 派生理解。
- 旧版纯文本状态不再返回或参与匹配。完整边界见 `docs/CURRENT_STATE_PRIVACY.md`。

## 兼容规则

- 前端当前使用的 snake_case 展示字段暂不重命名。
- 新字段默认只能追加；删除、重命名和语义改变需要负责人确认。
- API 错误统一包含 `ok: false`，登录失效额外包含 `loginRequired: true`。
