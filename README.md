# 遇见

> 发现一个值得聊一句的人。
> 知乎已经帮你发现值得看的内容；遇见帮你通过内容，发现一个值得聊一句的人。

知乎 Hackathon 项目 · Web Demo。

## 快速开始

```bash
npm install
npm run dev            # http://localhost:3000
# 或生产模式
npm run build && npm run start
```

首次访问自动初始化 SQLite（`data/yujian.db`）并写入 10 个 Mock 用户 / 27 篇内容。
点击「使用知乎继续」即可以演示身份（江树 · 产品经理）体验完整闭环：

Landing → AI 理解 → 推荐（今天想先给你看一篇东西）→ 看看 TA 怎么想 → 我有点想认识 TA → 双向成功 → 已遇见。

## 环境变量（全部可选，留空即 Mock）

复制 `.env.example` 为 `.env.local`：

- `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL`：OpenAI 兼容 chat（mimo 等），用于 Deep Match / Bridge；
- `EMBED_*`：真实向量模型（P4）；
- `ZHIHU_APP_ID / ZHIHU_OAUTH_APP_KEY / ZHIHU_ACCESS_SECRET / ZHIHU_REDIRECT_URI`：真实知乎 OAuth（P2 代码已接入）。四个变量齐备后，Landing 自动显示「使用知乎账号登录」。真实登录必须公网 HTTPS 部署且回调与开放平台登记值完全一致（本地 localhost 无法完成知乎登录）；联调诊断见 `GET /api/auth/zhihu/status`（脱敏输出）。
- `APP_ORIGIN`：反向代理后部署时的对外 origin，用于 OAuth 回调后的跳转。

## 文档

- `IMPLEMENTATION_PLAN.md`：能力清单与 Phase 计划
- `docs/ARCHITECTURE.md`：技术架构与安全边界
- `docs/MATCHING.md`：匹配算法与 Demo 复现
- `docs/PRODUCT.md`：产品逻辑
- `总体概览.txt`：产品总说明（上游需求）

## 演示提示

- 「我的」页可切换演示身份、写此刻状态（触发「此刻遇见」置顶）、开关遇见。
- Demo A：江树首推陈默（跨主题：自由与稳定）；Demo B：写“想出去走走”→ 阿屿置顶。
