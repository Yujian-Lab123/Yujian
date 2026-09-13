# 相遇算法与体验整合交接（2026-09-13）

## 一、当前结论

本轮采用“小步集成、暂不迁移数据库”的方案：在最新 `origin/main` 上吸收 C 分支中安全、可验证的匹配思路和动效，同时保留主线已经修正的单向意愿、双向确认、事务幂等和内容桥接逻辑。

当前工作位于独立工作树与分支：

- 分支：`feat/d-encounter-integration`
- 工作树：`E:\Codex\遇见\.tmp-worktrees\encounter-integration`
- 基线：`origin/main` 的 `ec9deca`
- 原开发目录 `E:\Codex\遇见` 中的未提交前端修改未被覆盖。

产品口径已冻结为：

1. 长期画像必须参与匹配。
2. “此刻”作为排序信号参与匹配，但不得向候选人、推荐卡、日志或模型请求泄露状态原文。
3. 用户以后可创建多个“侧面”，并选择其中一个或多个参与匹配；本 PR 尚未接入侧面持久化和权重。
4. 推荐前只有认识偏好和画像兼容度，不能称为“双向意愿”。用户看见具体对象并点击“想认识 TA”后才产生单向意愿；双方分别点击后才建立连接。
5. 真实产品必须先完成画像整理才进入相遇；Mock 演示可以直接使用预置数据。

## 二、本轮已经完成

### 1. 候选过滤

新增 `lib/retrieval/candidate-filter.ts`，过滤：

- 用户自己；
- 未开启相遇的人；
- 已连接的人；
- 已发出待确认意愿的人；
- 已标记“不感兴趣”的人；
- 认识偏好不兼容的人；
- 为未来拉黑集合预留注入口，但没有伪造当前 Schema 中不存在的拉黑表。

### 2. 多路召回

新增 `lib/retrieval/multi-recall.ts`，当前在内存中分别按以下信号召回，再按用户去重：

- `long_term`：长期画像；
- `value`：价值偏好；
- `conversation`：对话风格；
- `current`：此刻状态向量。

本轮没有引入 pgvector、向量数据库或迁移。数据量扩大后再把召回层替换为数据库/向量服务，页面与评分契约不需要随之重写。

### 3. 可解释排序

新增 `lib/retrieval/scoring.ts`，当前粗排为：

```text
0.30 × long_term
+ 0.25 × conversation
+ 0.20 × current
+ 0.15 × intent
+ 0.05 × novelty
+ 0.05 × diversity
```

本地回退精排为：

```text
rerank = 0.70 × coarse + 0.30 × value
final  = 0.55 × rerank + 0.45 × compatibility
```

`compatibility` 只是推荐前的画像兼容估计，绝不表示双方已经愿意认识。多样性采用逐轮重新计算的贪心选择，避免奖励落在错误候选上。

### 4. 可选真实 Rerank

新增：

- `lib/providers/reranker.ts`
- `lib/retrieval/model-rerank.ts`
- `lib/retrieval/profile-context.ts`
- `lib/retrieval/rerank-pipeline.ts`

行为：

- 未配置凭证时自动使用本地排序，Mock 流程不受影响；
- 支持阿里云百炼 `qwen3-rerank` 的兼容接口，以及 `qwen3.7-text-rerank` / `gte-rerank-v2` 的 DashScope 接口形态；
- 只向外部精排服务发送压缩后的长期结构字段；不发送姓名、此刻原文、证据摘录、公开内容正文或内部向量；
- 网络失败、配置错误或响应不完整时整批回退本地结果；
- 只精排 Top-N，Top-N 之外候选继续保留，不能被静默丢弃。

可选配置已写入 `.env.example`，真实 Key 只能放 `.env.local` 或部署 Secret。

### 5. Matcher 集成

`lib/retrieval/matcher.ts` 已接入上述漏斗，同时保留主线能力：

- `contentBridge`；
- 正式内容缺失时使用画像产物的只读 anchor 快照；
- 快照不写入内容外键；
- 推荐记录继续幂等 upsert；
- `current` 高匹配候选可标记为 `moment` 并置顶；
- 评分、召回来源和实际 rerank 模式写入调试元数据，便于比赛演示解释。

### 6. 页面动效与状态修正

已修改：

- `app/encounter/page.tsx`
- `app/encounter/[id]/page.tsx`
- `app/connect/[id]/page.tsx`
- `app/connections/page.tsx`

新增页面专属 CSS Module：

- `app/encounter/encounter-motion.module.css`
- `app/connect/[id]/connect-motion.module.css`

保留了 C 的水墨等待、卡片进入、人物揭示和连接曲线动效，并补充：

- 防止连续点击造成重复请求；
- 加载与失败状态；
- 连接成功后延迟跳转；
- 移动端排版；
- 复制开场问题失败提示；
- 去掉没有数据依据的“已互相关注”“已开始交流”“对方已收到邀请”等文案。

## 三、已经完成的验证

在独立工作树执行：

- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run test`：10 个测试文件、28 项测试通过，包含“外部精排不得发送姓名/自述”和“Top-N 外候选不得丢失”的断言；
- `npx next build --webpack`：通过，19 个页面/接口成功构建。

标准 `npm run build` 使用 Turbopack 时失败，原因不是源码：该隔离工作树的 `node_modules` 是指向主工作区的目录链接，Next 16 拒绝指向项目根外的依赖目录。回到普通 Clone 或在工作树内执行独立 `npm ci` 后，应再次运行标准 `npm run build`。

## 四、提交前必须完成

按顺序执行：

```powershell
cd E:\Codex\遇见\.tmp-worktrees\encounter-integration
npm run lint
npm run typecheck
npm run test
npx next build --webpack
git diff --check
git status --short
```

然后人工检查：

1. `.env.local`、Key、Cookie、爬虫原始数据、画像输出均未进入 Git；
2. diff 只包含本交接文档列出的相遇/匹配文件和 `.env.example`；
3. 不直接合并 `main`；提交到 `feat/d-encounter-integration` 并发起 PR；
4. PR 中说明 `.env.example` 属于冻结共享文件，由 D 作为集成负责人提交；
5. 从常规 Clone 环境补跑 `npm run check`，截图验证 `/encounter → /encounter/:id → /connections → /connect/:id`。

建议提交信息：

```text
feat(encounter): integrate explainable matching and motion
```

## 五、下一轮开发顺序

### PR 2：侧面选择参与匹配

不要直接复用当前页面内存对象。先提交契约/Schema PR，再提交业务实现。

建议最小数据模型：

- `side_profiles`：侧面定义、结构化摘要、向量、可见性、是否启用；
- `encounter_preferences`：长期画像是否参与（当前产品决定固定为 true）、当前状态是否参与、被选中的侧面 ID、更新时间；
- 若支持多个侧面同时参与，另建关系表，不把 ID 数组硬塞进字符串字段。

推荐的第一版规则：

- 长期画像固定权重，不允许关闭；
- 此刻有有效记录时自动参与；
- 侧面默认不参与，用户明确选择后才加入；
- 用户每次最多选 1 个侧面进入匹配，先降低解释和调参难度；页面仍允许创建多个侧面；
- 所有权重通过单一配置函数计算并归一化，不在页面和查询中散落常量。

### PR 3：此刻有效期

当前 `getUserVectors()` 会读取历史上最新一条此刻记录，即使已经很旧。建议将此刻信号限定为 24 小时或“当天”，过期后返回 `current: null`。必须同时补测试，且不能删除用户原始记录。

### PR 4：真实画像完成门槛

真实用户只有在画像任务 `succeeded`、关键结构完整、向量准备完成后才开放相遇入口。等待阶段用“遇见如何工作”、隐私说明、画像生成进度和轻量水墨动效承接，不生成虚假候选。Mock 身份保留直接体验入口。

### PR 5：分享闭环

优先做服务端生成的分享图，而不是分享完整画像：

- 网站分享页使用不可猜测的短链接和明确可撤销权限；
- 默认分享一句洞察、3 个关键词和一张水墨封面，不放敏感证据和完整时间线；
- 知乎侧分享采用 1200×1600 左右的竖版卡片，附站点入口/二维码；
- 分享前必须预览，并区分“仅自己”“持链接可见”“公开”；
- 撤销后链接立即失效。

## 六、尚未解决的产品/算法问题

1. **6 维画像与 16 轴 Mock 并没有真正合并成一个概念。** 当前 16 轴只是 Mock 检索特征；页面的 6 个画像章节是解释结构。真实阶段应由 Profile → Embedding/可比较特征层完成映射，不能把页面章节数直接当作向量维数。
2. **当前权重没有人工评测证据。** 比赛前来不及做大规模标注，可先制作 8–12 个匿名、合成的黄金案例，检查候选过滤、跨主题连接、此刻置顶、差异解释和隐私边界，而不是声称算法已经最优。
3. **外部 Rerank 只解决“语义排序”，不代表人与人真实适配。** 需要用点击了解、内容感兴趣、想认识、双向确认等漏斗指标迭代，不能把模型分数当真值。
4. **此刻原文仍保存在数据库并由本人接口返回。** 这是现有产品行为；匹配侧只使用派生向量。上线前仍需确定保留周期、删除入口和隐私政策。
5. **拉黑/举报尚未建表。** 候选过滤器只有预留参数，正式开放陌生人连接前必须补齐安全能力。

## 七、给下一位 AI 的固定任务提示

```text
任务目标：完成并提交相遇算法与动效整合 PR，不扩展到侧面 Schema。
责任角色：D 集成负责人，代码主体属于 C 的相遇模块。
工作目录：E:\Codex\遇见\.tmp-worktrees\encounter-integration
工作分支：feat/d-encounter-integration
允许修改的路径：app/encounter/**、app/connect/**、app/connections/**、lib/retrieval/**、lib/providers/reranker*、.env.example、本交接文档。
禁止修改的共享路径：package*.json、数据库 Schema/迁移、app/globals.css、components/**、lib/contracts/**、A 的 /me、D 的 /side 和 /profile。
必须保持的行为：长期画像必选；此刻只使用派生向量且不回显原文；侧面本 PR 不接入；单向意愿与双向确认严格区分；请求幂等；Mock 无凭证可运行。
验收标准：lint/typecheck/test/build 通过；Top-N 外候选不丢失；外部 rerank 不发送姓名/此刻原文/证据正文；页面完整跑通。
必须执行的检查：npm run lint、npm run typecheck、npm run test、标准 npm run build（常规 Clone 中）、git diff --check、git status --short。
提交方式：只推送功能分支并创建 PR，不直接合并 main。
```
