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

## 此刻侧面（V1）

- 页面路由为 `/side`；它只消费既有的 `GET /api/me` 返回的 `currentState` 与 `understanding`，不新增接口、表或模型调用。
- 纯规则层位于 `lib/contextual-persona.ts`，将长期理解和一次此刻记录**并列解释**；不得把一次状态推断成长期人格结论。
- 当前状态的原文仅向本人返回。匹配模块如需使用，只能消费现有的 `current` 结构化向量信号，不得在推荐、详情或日志中回显原文。

## 兼容规则

- 前端当前使用的 snake_case 展示字段暂不重命名。
- 新字段默认只能追加；删除、重命名和语义改变需要负责人确认。
- API 错误统一包含 `ok: false`，登录失效额外包含 `loginRequired: true`。
