# 遇见 · 团队协作规范

开始任务前先阅读 `AGENTS.md`、`docs/OWNERSHIP.md`、`docs/DEVELOPMENT.md` 及自己的 `docs/workstreams/*.md`。

## 开发流程

1. 从 Issue 开始，确认责任角色和允许修改的路径。
2. 从最新 `main` 创建 `feat/a-*`、`feat/b-*`、`feat/c-*` 或 `feat/d-*` 分支。
3. 一个分支只完成一个 Issue；禁止直接开发或推送 `main`。
4. 每天执行 `git fetch origin`，在功能分支上同步 `origin/main`。
5. 提交前运行 `npm run check`；生产依赖变化还需运行 `npm run audit:prod`。
6. 使用 PR 模板说明范围、验证结果、截图、契约和迁移影响；默认 Squash Merge。

## Agent 任务模板

每次把任务交给 Agent 时必须包含：

```text
任务目标：
责任角色：A / B / C / D
允许修改的路径：
禁止修改的共享路径：
依赖的接口：
必须保持的行为：
验收标准：
必须执行的检查：
```

Agent 开始和结束前都要检查 `git status --short`。禁止修改范围外文件、全仓格式化、顺手重构、覆盖他人未提交修改，或自行安装依赖。

## 共享文件

`package.json`、锁文件、数据库 Schema/迁移、全局样式、公共组件、公共契约和框架配置均为冻结区。修改必须先建独立 Issue，由对应 CODEOWNER 审核；依赖升级必须单独 PR。

数据库迁移只由 C 创建。其他角色通过 Issue 描述字段和查询需求，不直接编辑 `lib/db/schema.ts` 或 `drizzle/`。

## 安全红线

- 禁止提交 `.env.local`、API Key、OAuth Token、Cookie、`browser_data/`、爬虫原始数据和人物画像产物。
- 不在 Issue、PR、聊天截图或日志中粘贴完整密钥。
- 真实人物数据只用于获授权的研究验证，不进入 Git。
