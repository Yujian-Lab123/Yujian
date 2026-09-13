# 遇见 · 目录导览

> 给第一次打开这个仓库的人。要跑起来看 `docs/DEVELOPMENT.md`，要搞清楚自己能改哪些文件看 `docs/OWNERSHIP.md`，这里只回答「东西都在哪」。

## 先读这四份

1. `README.md`：产品一句话 + 快速开始
2. `docs/DEVELOPMENT.md`：环境、命令、故障排查
3. `docs/OWNERSHIP.md` + 自己那条线的 `docs/workstreams/*.md`：你的修改边界和验收标准
4. `docs/ARCHITECTURE.md`：分层与安全边界

想理解业务再往下读：`总体概览.txt`（产品总说明，62 节）→ `docs/MATCHING.md`（匹配怎么算的）→ `docs/PROFILE_ENGINE.md`（画像引擎细节，规格来源是 `用户画像.txt`）。

## Web 层 `app/`

| 路径 | 内容 |
| --- | --- |
| `page.tsx` | Landing |
| `onboarding/` | 进入流程，四 facet + 核心问题 |
| `encounter/` | 今日推荐：先给一篇内容，再给一个人 |
| `connect/` | 双向确认成功页 |
| `connections/` | 已遇见 |
| `me/` | 我的：切换演示身份、此刻状态、开关 |
| `profile/` | 人物画像页（六维 + 证据抽屉） |
| `api/auth/` | 知乎 OAuth 与 demo 登录 |
| `api/encounters/`、`api/connections/` | 推荐、反馈、意向、连接 |
| `api/me/`、`api/profile/` | 当前用户；画像任务创建与进度查询 |
| `api/health/` | 健康检查，部署平台与环境自检用 |

`globals.css` 和 `layout.tsx` 属于冻结区，不要顺带改。

## 领域层 `lib/`

- **`profile/`（★ 核心）** 画像引擎：`schema.ts` 六维结构与产物类型、`prompt.ts` 两阶段提示词（改了必须 bump `PROMPT_VERSION`）、`engine.ts` 摘要 + 抽取 + 综合 + Embedding 管线、`incremental.ts` 内容哈希/分块/增量复用、`report.ts` Markdown 渲染与人工评析表、`jobs.ts` 与 `repository.ts` 任务落库与进度、`store.ts` 产物读写
- **`retrieval/matcher.ts`** 在线匹配：Hard Filter → 召回 → 粗排 → Rerank → Deep Match → Bridge
- **`current-state/privacy.ts`** “此刻”结构化白名单、版本化存储与旧版自由文本隔离契约
- **`ai/bridge.ts`** Deep Match / Content Bridge / Conversation Bridge；**`ai/profile.ts`** 是演示用的模板画像，不是真引擎
- **`axes.ts`** 16 维概念轴，旧 Mock 匹配在用，和画像引擎的六维**不是一回事**
- **`useMe.ts`** 前端取当前用户的 hook

## 数据与外部依赖

- **`db/`** `client.ts` 连接、`schema.ts` 表定义、`migrate.ts` 迁移、`seed.ts` 与 `seed-runner.ts` 幂等 Mock 种子、`users.ts` 查询、`index.ts` 门面
- **`db/schema.ts` 与 `drizzle/`** 冻结区：只有 C 能生成迁移，其他人提 Issue 描述字段需求
- **`providers/`** `llm.ts` OpenAI 兼容 LLM（分层便宜/主模型）、`zhihu.ts` 知乎 OAuth、`content-source.ts` 数据源抽象（隔离爬虫与官方接口）
- **`session.ts`** 会话：随机 id、8 小时过期、可撤销，生产 cookie 走 secure

## 脚本 `scripts/`

| 文件 | 用途 |
| --- | --- |
| `bootstrap.ts` | 一键起 PostgreSQL + 迁移 + 播种，可安全重复执行 |
| `db-migrate.ts` / `db-seed.ts` | 单独跑迁移 / 种子 |
| `profile-worker.ts` | 画像后台 worker，`npm run dev` 会一起拉起 |
| `analyze-profile.ts` | 画像 CLI，爬虫验证线入口（支持 `--peek` / `--fixture`） |
| `convert-crawler.mjs` | MediaCrawler jsonl → 画像输入，可 `--crawl` 一键抓取 |
| `fetch-avatar.mjs` / `fetch-avatar-browser.py` | 头像抓取，研究用途 |
| `fixtures/` | 测试样例；`*.local.json` 已 ignore，放真实人物数据别进 Git |

## 文档 `docs/`

`ARCHITECTURE`、`MATCHING`、`PROFILE_ENGINE`、`PRODUCT` 讲系统怎么设计；`CURRENT_STATE_PRIVACY` 说明“此刻”的匹配与私密数据边界；`API_CONTRACTS` 是跨模块稳定接口；`OWNERSHIP` + `workstreams/A-PROFILE.md`、`B-ENCOUNTER.md`、`C-PLATFORM.md`、`D-RELEASE.md` 讲谁改什么；`DEVELOPMENT` 讲怎么跑；`SECURITY` 是生产依赖基线。

## 不入仓的数据

`data/`（crawler 输入与 sqlite 残留）、`media-crawler/`（第三方副本，非商业许可）、`profile-output/`（画像产物）、`audit-output/`、`browser_data/` 全部在 `.gitignore` 里。爬虫数据属研究用途，不进 Git、不对外发布。

## 两条数据流

```text
爬虫验证线（当前主线）
  media-crawler → convert-crawler.mjs → data/crawler/<名>.json
    → analyze-profile.ts → profile-output/<名>.report.md

OAuth 正式线（等比赛方开放接口）
  /api/auth/zhihu → /api/auth/callback → 存档 raw_contents → 【断点】

请求链路
  页面 → app/api/* → lib/retrieval 或 lib/profile → lib/db → PostgreSQL
```

两线在画像引擎处汇合：引擎只认归一化的 `RawContent[]`，与数据来源解耦。
