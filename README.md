# 遇见

> 发现一个值得聊一句的人。
> 知乎已经帮你发现值得看的内容；遇见帮你通过内容，发现一个值得聊一句的人。

知乎 Hackathon 项目 · Next.js 16 + PostgreSQL 团队开发基座。

## 快速开始

```bash
git clone https://github.com/Yujian-Lab123/Yujian.git
cd Yujian
npm ci
npm run bootstrap
npm run dev            # http://localhost:3000
```

要求 Node.js 24、Git 和 Docker Desktop。`bootstrap` 会启动 PostgreSQL、执行 Drizzle 迁移并写入 10 个 Mock 用户 / 27 篇内容；可安全重复执行。Next.js 与画像 Worker 由 `npm run dev` 同时启动。
点击「使用知乎继续」即可以演示身份（江树 · 产品经理）体验完整闭环：

Landing → AI 理解 → 推荐（今天想先给你看一篇东西）→ 看看 TA 怎么想 → 我有点想认识 TA → 双向成功 → 已遇见。

## 环境变量（全部可选，留空即 Mock）

复制 `.env.example` 为 `.env.local`：

- `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL`：OpenAI 兼容 chat；当前画像管线默认以 `qwen3.7-flash` 逐批解析、`qwen3.8-flash` 最终汇总。密钥只放 `.env.local`；
- `EMBED_*`：真实向量模型（P4）；
- `ZHIHU_APP_ID / ZHIHU_OAUTH_APP_KEY / ZHIHU_ACCESS_SECRET / ZHIHU_REDIRECT_URI`：真实知乎 OAuth（P2 代码已接入）。四个变量齐备后，Landing 自动显示「使用知乎账号登录」。真实登录必须公网 HTTPS 部署且回调与开放平台登记值完全一致（本地 localhost 无法完成知乎登录）；联调诊断见 `GET /api/auth/zhihu/status`（脱敏输出）。
- `APP_ORIGIN`：反向代理后部署时的对外 origin，用于 OAuth 回调后的跳转。

## 文档

- `CONTRIBUTING.md`：分支、PR、Agent 与安全规范
- `docs/DEVELOPMENT.md`：Clone、启动、测试和故障排查
- `docs/STRUCTURE.md`：目录导览与新成员阅读顺序
- `docs/OWNERSHIP.md`：A/B/C/D 的文件所有权与共享冻结区
- `docs/TEAM_TASKS_SIMPLE.md`：可直接发给团队的页面分工通俗版
- `docs/workstreams/`：四名成员各自的交付和验收边界
- `docs/API_CONTRACTS.md`：跨模块稳定接口
- `IMPLEMENTATION_PLAN.md`：能力清单与 Phase 计划
- `docs/ARCHITECTURE.md`：技术架构与安全边界
- `docs/MATCHING.md`：匹配算法与 Demo 复现
- `docs/PRODUCT.md`：产品逻辑
- `docs/PROFILE_ENGINE.md`：人物画像分析引擎（爬虫验证线：六维画像 + 证据可溯）
- `总体概览.txt`：产品总说明（上游需求）

## 质量门

```bash
npm run check
npm run audit:prod
```

所有 PR 必须通过 lint、typecheck、test 和 build。禁止提交 `.env.local`、Cookie、`browser_data/`、爬虫数据或画像产物。

## 演示提示

- 「我的」页可切换演示身份、写此刻状态（触发「此刻遇见」置顶）、开关遇见。
- Demo A：江树首推陈默（跨主题：自由与稳定）；Demo B：写“想出去走走”→ 阿屿置顶；`/side` 可查看“长期理解”和“此刻记录”并列的侧面解释。
