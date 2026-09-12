# 遇见 · 技术架构

## 技术栈

- **框架**：Next.js 16（App Router，TypeScript strict），前后端同仓，使用 Node.js Runtime 自托管。
- **样式**：Tailwind CSS 3；双视觉系统——外蓝（知乎蓝墨，Landing/连接成功/已遇见）+ 内暖（米纸暖色，理解/推荐/我的）。
- **存储**：PostgreSQL 17 + pgvector 0.8.6 + Drizzle；本地由 Docker Compose 提供，迁移和 Mock 种子均可重复执行。
- **AI**：OpenAI 兼容协议 adapter（当前画像验证用 Qwen；亦兼容 DashScope / DeepSeek 等）；未配置 key 时全部回退 Mock，Demo 永不崩。

## 目录

```
app/                  # 页面 + API Routes
  page.tsx            # Landing（蓝）
  onboarding/         # OAuth 后：读取动画 → AI 理解结果（暖）
  encounter/          # 推荐主页：今天想先给你看一篇东西（暖）
  encounter/[id]/     # 深入了解作者
  connect/[id]/       # 连接成功（蓝）
  connections/        # 已遇见
  me/                 # 我的：此刻状态 / 遇见开关 / 演示身份
  profile/            # 公开内容画像：六维理解地图 + 可追溯证据抽屉
  api/…               # 见下
lib/
  axes.ts             # 16 维概念轴、问题库、核心问题库、stateVec
  db/                 # PostgreSQL/Drizzle schema + 种子 + pgvector 同步/ANN
  providers/llm.ts    # LLM adapter（chatJSON + zod 校验 + 日志）
  providers/embedding.ts # P4/P5 OpenAI 兼容 Embedding adapter（固定维度 + 严格校验）
  providers/reranker.ts # P6 Qwen compatible / DashScope 双协议精排
  providers/zhihu.ts  # 真实知乎 OAuth（authorize/token/用户接口 + 脱敏诊断）
  ai/profile.ts       # 离线理解：Content Profile（explicit/inferred 区分，非人格测试）
  ai/bridge.ts        # Deep Match / Content Bridge / Conversation Bridge
  retrieval/matcher.ts# P5 ANN 优先 + P6 模型精排/Mock 回退 + 此刻遇见
  session.ts          # 带过期与撤销能力的 cookie 会话
scripts/
  bootstrap.ts        # Clone 后的一键本地初始化
  profile-worker.ts   # 数据库持久化画像任务 Worker
drizzle/              # 受版本控制的数据库迁移（仅 C 修改）
components/           # Nav / 水墨场景 / 头像 / 封面
docs/                 # 架构 / 匹配 / 产品文档
```

## API（与概览三十四节对齐）

| 路由 | 说明 |
| --- | --- |
| POST /api/auth/demo | Demo 登录（比赛演示切换身份） |
| GET /api/auth/zhihu、/api/auth/callback | 真实知乎 OAuth（P2 已接入，协议对齐官方 hello-world-oauth）；回调 param 为 `authorization_code`（兼容 `code`），可能不返回 `state` |
| GET /api/auth/zhihu/status | OAuth 脱敏诊断：凭证长度 / sha256 前缀 / 误填警告 / 最近一次交换阶段，绝不输出完整密钥 |
| GET /api/me | 用户 + 理解 + 此刻状态 |
| POST /api/me/current-state | 此刻状态（进入 current_state 向量，自动衰减待 P9） |
| POST /api/me/toggle | 遇见开关 |
| POST /api/profile/analyze | Onboarding 快速理解入口（现有 16 维 Mock）；完整 P4 画像由下方任务入口异步生成 |
| POST /api/profile/generate | P4 真实 Profile 任务入口；Worker 执行摘要/提取/综合/Embedding，并自动复用上一版产物 |
| GET /api/encounters | 在线匹配漏斗 |
| GET /api/encounters/:id | 作者详情 + TA 还写过 |
| POST /api/encounters/:id/feedback | not_interested / content_interesting / learn_more / want_to_meet |
| POST /api/encounters/:id/want-to-meet | 双向确认 |
| GET /api/connections、/api/connections/:id | 已遇见 / 连接成功页 |

## 安全边界（官方红线）

- app_key / Access Secret 只放服务器端环境变量（`.env.local` / 部署平台 Secret），不进前端、不进 Git。
- 真实 OAuth：`openapi.zhihu.com/authorize` → `/access_token`（表单 `grant_type=authorization_code`，字段 `code` 承载 `authorization_code`）；用户 API 同时带 `Authorization: Bearer <Access Secret>` 与 `X-OAuth-Token`。
- 回调必须公网 HTTPS 且与开放平台登记值完全一致；本地仅预览。

## 成本策略

- LLM 只碰 Top 5 候选（Deep Match / Bridge）；P6 Reranker 默认只看算法粗排 Top 20（硬上限 50），只发送压缩结构化画像；摘要、提取、embedding、rerank 用便宜层。P4 按归一化内容哈希复用逐内容摘要/向量，匹配解释按 pair 缓存，同一输入不重复花 token。
- `lib/providers/llm.ts` 记录 model / latency / 错误 / prompt version，便于调试。
