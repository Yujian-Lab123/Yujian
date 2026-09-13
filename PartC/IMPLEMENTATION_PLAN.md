# 遇见 · IMPLEMENTATION_PLAN

> Phase 0 产物：现有能力 / 缺失能力 / 开发顺序。遵循《总体概览》六十二节执行要求。

## 一、现有能力（本仓库）

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 知乎 Hackathon 官方资料 | ✅ 已有 | `zhihu-hackathon/`：SKILL、OAuth 边界、部署凭证、hello-world 脚手架（含官方 OAuth 协议实现） |
| 产品总说明 | ✅ 已有 | `总体概览.txt`（62 节完整产品/算法/工程要求） |
| Web 全栈骨架 | ✅ 本轮完成 | Next.js 16 + TS + Tailwind，页面与 Route Handlers 同仓 |
| 存储层 | ✅ 团队基座 | PostgreSQL 17 + Drizzle，迁移、索引、唯一约束与幂等 Mock 种子 |
| Mock 种子 | ✅ 本轮完成 | 10 个不同职业用户、27 篇内容、16 维概念轴人工标注向量 |
| 匹配管线 | ✅ 本轮完成 | Hard Filter → 多维召回 → 启发式粗排 → Qwen Rerank（可选，Mock 回退）→ Deep Match（LLM 可选）→ Content/Conversation Bridge → 此刻遇见置顶 |
| 双向确认 | ✅ 本轮完成 | want-to-meet → pending / mutual；Mock 用户可 auto_reciprocate |
| Provider 抽象 | ✅ 本轮完成 | LLM（当前 Qwen 分层）；`ContentSource` 隔离爬虫与未来知乎 OAuth 数据源 |
| P2 知乎 OAuth | ✅ 本轮完成 | RealZhihuProvider：authorize → access_token → 用户接口（双凭证头）；`/api/auth/zhihu` + `/api/auth/callback` + 脱敏诊断 `/api/auth/zhihu/status`；四个 `ZHIHU_*` 环境变量齐备后 Landing 自动切换真实登录入口。真实联调需公网 HTTPS 回调（官方边界） |

## 二、缺失能力（按 Phase 推进）

| Phase | 内容 | 依赖 |
| --- | --- | --- |
| P2 知乎 OAuth | ✅ 代码完成（见上表）；真实联调待：申请 app_id/app_key/Access Secret + 部署公网 HTTPS 并配置回调 | 部署平台 |
| P3 内容获取实测 | 解析 `/api/auth/callback` 存档的 raw_contents（`zhihu_identities` 表），产出 `docs/ZHIHU_API_FINDINGS.md` | P2 联调 |
| P4 真实 Profile 管线 | ✅ 代码完成：真实 Embedding Adapter + 便宜模型摘要/提取（Zod 校验）+ 长文分块 + 增量更新；真实服务联调待 Key | Embedding API key |
| P5 真实检索 | ✅ 代码完成：1024 维统一索引、HNSW 四路 ANN、画像/此刻状态同步、自动回退内存召回；迁移与真实数据联调待执行 | pgvector 迁移 + Embedding API key |
| P6 Reranker | ✅ 代码完成：Qwen 双协议 Provider、结构化画像 Top-N 精排、严格响应校验、整批 Mock 回退；真实服务联调待 Key | rerank API key |
| P7 动画与展示 | ✅ 代码完成：Loading 水墨动画、内容卡纸张转场、Content → Person Reveal、双向成功动画、Landing 与核心链路手机适配；运行时视觉复核待依赖可用 | 参考图 |

补充隐私约束已完成：“此刻”仅用心情 / 活动 / 交流意图三个结构化字段匹配；选填自由文本只临时交给 LLM，原文不保存、不回传、不参与推荐展示。

## 三、本轮已完成验收（对照概览六十一节）

- A 30 秒知道是什么：Landing 一句话定位 ✅
- B 无需填资料进入：一键 Demo 登录 ✅
- C 合理 Content Profile：onboarding 四 facet + 核心问题 ✅
- D 不同类型候选：种子覆盖摄影/户外/医学/教育/投资/文学/心理/社会学 ✅
- E 解释为什么是 TA：shared + difference + reason ✅
- F 选哪篇内容先给：Content Bridge（锚定内容驱动） ✅
- G 与双方内容相关的 Conversation Bridge：轴向问题库 / LLM ✅
- H 区分喜欢内容 vs 想认识作者：feedback 四类严格分离 ✅
- I 双向确认：want-to-meet → mutual → 连接成功页 ✅
- J 手机与桌面：Landing、AI 理解、推荐、作者揭示、双向成功与已遇见页面完成核心断点精修 ✅

## 四、运行方式

```bash
npm install
npm run dev      # 或 npm run build && npm run start
# 打开 http://localhost:3000
```

详见 README.md。
