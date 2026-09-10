# D · 产品总控、基座与集成

## 负责什么

负责产品总体验与共享平台：Side、Landing、引导、独立的长期画像、数据库/认证/Worker、部署和 CI。D 是 `/side` 的正式负责人。

## 允许修改的路径

- `app/page.tsx`、`app/onboarding/**`、`app/profile/**`、`app/api/profile/**`
- `app/side/**`、`lib/contextual-persona.ts`、`lib/contextual-persona.test.ts`
- `lib/profile/**`、`lib/db/**`、`lib/providers/**`、`lib/session.ts`、`app/api/auth/**`、`drizzle/**`
- `public/**`、`.github/**`、部署与架构文档

## 禁止修改的共享路径

- 未经 A/C 确认，不修改 `/me` 和相遇流程的业务逻辑。
- 未经独立 Issue，不做依赖升级、全局样式重写或跨模块重构。

## 依赖的接口

- 所有 `docs/API_CONTRACTS.md` 中的稳定接口
- A 的当前状态语义、C 的推荐与连接语义

## 必须保持的行为

- 新成员 Clone 后，无真实 OAuth/LLM 凭证也能通过 Mock 跑通。
- `/profile` 保持为长期人物画像；`/side` 是独立页面，不相互承载内容。
- 数据库迁移、任务 Worker 和 OAuth 改动必须单独 PR，并附回滚说明。

## 验收标准

- `npm run bootstrap` 可重复执行。
- `/api/health`、`npm run check` 和生产依赖审计可通过。
- 每日集成不破坏 A/C 已验收流程；公共契约有更新记录。

## 必须执行的检查

`npm run check`；涉及依赖时加 `npm run audit:prod`；涉及数据库时重复执行 bootstrap 并检查 `/api/health`。

## Agent 任务外壳

```text
任务目标：
责任角色：D
允许修改的路径：本文件列出的产品/平台路径，包括 /side 和 contextual-persona
禁止修改的共享路径：未经确认的 /me 和相遇业务逻辑；无 Issue 的依赖/全局样式/跨模块重构
依赖的接口：docs/API_CONTRACTS.md；A/C 已冻结的接口
必须保持的行为：Mock 可运行；/profile 与 /side 不合并；迁移可回滚
验收标准：bootstrap、health、check 通过，集成不破坏 A/C
必须执行的检查：npm run check；按影响补充 audit/bootstrap/health
```
