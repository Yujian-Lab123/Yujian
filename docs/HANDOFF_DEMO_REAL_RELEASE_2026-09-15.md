# 2026-09-15 交接：Demo / 真实体验与 `9323643` 镜像

> 给下一位 AI：本轮按用户要求只写交接文档；没有继续修改业务代码、推送镜像或变更线上配置。用户要的是正常的画像页、可理解的完整演示过程，同时绝不能让 Demo 数据进入真实体验。另一个 agent 正在做「画像长廊」，不要编辑它的目录或覆盖它的未提交改动。

## 1. 当前结论（事实、推论分开）

- **已核实（高）**：本地 `main` 的 HEAD 是 `9323643`，但许多 Demo/相遇改动仍在未提交工作区。已存在并曾推送的 ACR 镜像 `crpi-pk0qcn2xowwtj265.cn-shenzhen.personal.cr.aliyuncs.com/seeseeyou/seeseeyou-web:9323643` 于 2026-09-15 16:02 CST 构建，image ID / digest 为 `sha256:fac288527c9e95c856a619031936adf8cbfa1443bed6b8db06f96352d6c6c6ac`。只读容器检查显示镜像含当前 `demo-author-profiles.ts`、匹配前模式过滤和相遇按钮反馈；镜像**不是纯 Git `9323643` 源码构建**，版本溯源不可靠。
- **已核实（高）**：线上 `/demo/profile` 是新版，但展示「当前没有可展示的完整画像」。本轮在应用内浏览器复现了 `/demo/profile` → `/demo/side` → `/demo/encounter`：侧面页点击「用于本次演示相遇」变为「已用于本次演示」；相遇页仍显示通用「侧面：由你选择」，没有刚选的「想散步的我」。点击「查看今日相遇」后线上返回了 **3 个预置候选**，并滚动到结果卡片。因此不是这一条路径上的“请求完全无反应”，而是交互过程及侧面联动缺失。
- **已核实（高）**：点击首张「查看公开画像」进入 Demo 候选详情，出现 Mock 人物「陈默」和 3 条 Mock 内容；「为什么推荐 TA」标题下为空白。Demo 详情页没有正式详情页的 `personReveal`、`avatarReveal` 和双向意愿 `mutualOverlay` 演出，仅有普通内容/状态文案。没有测试「想认识 TA」的写入或双向连接，不要宣称已验收闭环。
- **合理推论（中）**：用户感觉“点了没有反应、原来的模拟动画没了”主要由三个问题叠加：开始后几乎直接跳到卡片、Demo 侧面选择没有传入相遇、Demo 详情是另写的简版而未复用正式详情的动效。线上健康 API 检查在当前环境遇 SSL 错误，不能据此判断线上服务是否健康；浏览器确实能打开并使用上述 Demo 流程。
- **当前未完成**：没有新镜像构建/推送，没有 Sealos 换镜像，没有公开完整真人画像。不要把这份交接称作已上线验收。

## 2. 为什么画像空白，而相遇又显示“长期画像：基础参考”

`app/demo/profile/page.tsx` 用 `getDemoAuthorProfiles()` 读取真人采集画像，必要时再读当前 Demo 身份的数据库画像。`lib/providers/demo-author-profiles.ts` 对两个白名单 ID 分别要求：

1. 运行容器有 `data/crawler/<id>.json`；
2. 有 `profile-output/<id>.profile.json`，且代表内容、证据索引不为空；
3. 生产环境 `DEMO_PUBLIC_PROFILE_IDS` 显式包含该 ID。

`.dockerignore` 排除 `data`、`profile-output`；`Dockerfile` 只创建空目录。所以仅换 `9323643` 镜像不会把画像变出来。**更重要的是**，公开原文不等于答主同意公开整份 AI 推断画像。仓库安全红线禁止将爬虫原始数据和画像产物提交 Git；在确认逐人、逐范围授权前，不要挂载真人完整画像或打开生产白名单。用户要求“正常画像页”，明确不想做「内容样本」替身页。

当前 `/demo/encounter` 的 `profileReady` 仅检查 `Boolean(me.understanding)`，即 Demo seed 的理解摘要；`/demo/profile` 却检查完整 artifact。两者标准不同，因此线上可以出现“长期画像已准备”但画像页仍为空。这是演示层一致性 bug，不应用真实用户数据兜底。

## 3. 关键代码断点与建议范围

| 问题 | 证据/位置 | 建议 | 边界 |
| --- | --- | --- | --- |
| Demo 侧面按钮是假保存 | `app/demo/side/page.tsx`：`saved` 只是局部 `useState`；`DEMO_SIDES` 是硬编码 | 要么实现只在 Demo 会话内的选择状态，并在相遇页明确显示及影响演示呈现；要么改成诚实的「预览这个侧面」，删除“已用于匹配”的承诺 | 不得写真实 `/side`、真实用户推荐或共享 Schema；另一个 agent 做画像长廊，不碰其路径 |
| 相遇主动作反馈不等于过程演示 | `app/demo/encounter/page.tsx`、`app/encounter/EncounterHub.tsx`：请求状态与共用 UI，开始后滚动到结果 | 在 Demo 中做确定性的可见步骤：选定侧面 → 正在阅读可公开内容 → 整理共同线索 → 展示候选；失败/空候选给明确结束态。真实模式只展示真实请求进度，绝不播放虚构“已经匹配”的结论 | Demo 和真实页复用布局可保留，但数据源/API 始终分离 |
| Demo 详情与正式详情不统一 | `app/demo/encounter/[id]/page.tsx` vs `app/encounter/[id]/page.tsx`、`app/encounter/encounter-motion.module.css` | 先找回 Demo 详情理由为空的 API/字段原因；再由 C 审阅后把可复用的“认识 TA / 双向确认”交互和动效统一，保留 Demo 路由及文案差异 | 不复制真人敏感字段到 Demo，也不让 Demo POST 写真实连接 |
| Demo 画像入口空状态与准备态冲突 | `app/demo/profile/page.tsx`、`app/demo/encounter/page.tsx` | 统一“理解摘要可用于预置匹配”和“完整画像可展示”两种状态的文案与入口；不能以理解摘要假装已有完整画像 | 真正完整真人画像要单独逐人授权、运行时挂载、白名单开关 |
| 真实相遇需保证诚实空候选 | `app/encounter/page.tsx`、`app/api/encounters/route.ts`、`lib/retrieval/matcher.ts` | 真实候选池不足时给明确空状态与等待说明；只要用户点击，应有加载/成功/失败反馈，不再要求反复填写此刻 | 匹配前过滤非 Mock + API 出口第二道过滤必须保留；真实不能回退 Mock |

## 4. 模式隔离与协作纪律（下一位 AI 必须先读）

开工前完整阅读 `AGENTS.md`、`CONTRIBUTING.md`、`docs/OWNERSHIP.md`、`docs/workstreams/C-ENCOUNTER.md`、`docs/workstreams/D-PRODUCT-INTEGRATION.md`，修改 Next.js 代码前读 `node_modules/next/dist/docs/` 的相关指南。先后运行 `git status --short`；保留所有既有未提交改动。当前三人分工是 **A Present Self、C Encounter/Matching、D Side/长期画像/平台**，不存在 B。C 路径要 C 审阅，D 路径由 D 负责，跨边界先拆 Issue/审批；当前已同时存在 C/D 相关脏改动，不要直接在 `main` 提交或推送。

冻结区：`package*.json`、框架配置、`app/globals.css`、`components/**`、`lib/contracts/**`、`lib/db/schema.ts`、`drizzle/**`、`.env.example`、`.github/**` 等。不要装依赖、造迁移、全仓格式化。不要编辑画像长廊 agent 所在目录。每个真正准备发布的分支运行 `npm run check`，按影响补 Demo/真实端到端截图；若全仓检查被 `.next.stale/` 干扰，先说明并用有界替代检查，不要删除用户文件。

当前工作树（交接前检查）：

```text
main / HEAD 9323643
M  app/api/demo/encounters/route.ts, app/api/encounters/route.ts
M  app/demo/content/page.tsx, app/demo/encounter/page.tsx, app/demo/profile/page.tsx
M  app/encounter/EncounterHub.tsx, app/encounter/page.tsx, app/profile/profile-experience.tsx
M  docs/EXPERIENCE_MODE.md, lib/experience-mode/nav.ts, lib/experience-mode/nav.test.ts
D  lib/providers/demo-author-content.ts
M  lib/retrieval/candidate-filter.ts, lib/retrieval/candidate-filter.test.ts, lib/retrieval/matcher.ts
?? lib/providers/demo-author-profiles.ts
?? .next.stale/, scripts/article-aiwork.txt  # 已有无关未跟踪文件，勿清理/提交
```

## 5. 建议执行顺序与验收口径

1. **先拆修复任务并保护工作区**：确认上一位 agent 的已改文件归属、另一个 agent 的长廊路径；从最新 `main` 做有界分支，不把未提交代码当成 `9323643` 的正式源码。先修理由空白和侧面假保存，再做过程演示，不要先重新 build 同样镜像。
2. **Demo 流程**：同一演示会话实际走 `/demo/profile` → `/demo/side` → `/demo/encounter` → `/demo/encounter/[id]` → Demo 意愿/连接。画像不可展示时不承诺完整画像；侧面选完返回仍能看到所选项；开始相遇有可见步骤、可结束状态；详情推荐理由、代表内容、动效与连接下一步不空、不绕回 onboarding。
3. **真实流程**：真实 `/profile` 只读本人，真实 `/encounter` 只读非 Mock；真实候选为空也能看见查询完成反馈，绝不借用 Demo 的候选或虚构相遇动画。测试 Demo Cookie 访问真实 API、真实 Cookie 访问 Demo API 均失败。
4. **画像发布另设隐私验收**：逐人确认“整份 AI 推断画像可公开演示”的同意和范围；仅在此条件满足后，把指定采集输入及产物作为运行时私有卷挂载，设置对应 `DEMO_PUBLIC_PROFILE_IDS`，验证只显示白名单人，且不把原始文件写入镜像/Git。未获授权就保留关闭并展示清楚的产品空状态，或使用真正预置、非真人的 Demo 完整画像，但不得伪称其为真实答主。
5. **最后发布**：修复完成且 `npm run check` / 浏览器 Demo+真实验收通过、C/D 审阅后，用可追溯的新 Git SHA 构建 amd64 镜像、推 ACR、再换 Sealos tag；核对 `/api/health`、镜像 digest、空状态/成功状态、回滚 tag。不要覆盖 `latest` 或生产配置来“试试看”。

本轮浏览器捕获的本机截图在临时目录 `C:\Users\ADMINI~1\AppData\Local\Temp\yujian-demo-audit-0915\`：`01-profile-empty.png`、`02-side-before.png`、`03-encounter-before.png`、`04-encounter-results.png`。这些是当前线上会话截图，目录可能随清理消失；下一位 AI 应重新截图验收，不要用旧截图声称新版本已通过。
