# P7 · 动画与比赛展示

## 目标与产品边界

P7 为核心演示链路补齐四个视觉节点：AI 理解 Loading、推荐卡转场、Content → Person Reveal、双向成功动画，并对 Landing 到已遇见的手机体验做精修。

产品约束保持不变：内容优先、人逐渐出现、不做左右滑、不做头像墙、不使用传统婚恋产品的心形/配对语汇。动效只解释状态变化，不改变匹配、反馈、意愿或连接 API 契约。

## 已实现

### 1. AI 理解 Loading

- 四步展示进度继续沿“回答 → 文章 → 话题 → 长期问题”推进，并在进入模型整理阶段后保持 100%。当前四步是前端演示节奏，不冒充后台任务的细粒度实时进度。
- CSS/SVG 绘制两层水墨山形、河流、飞鸟、墨晕与印章；模型整理阶段保持 100% 并更新状态文案。
- 分析失败时展示可恢复的重试界面，不再无限停在加载态。
- 进度文案使用 `role="status"` 与 `aria-live="polite"`。

### 2. 推荐卡转场

- 新卡以“纸张展开”方式进入；普通下一篇向上淡出；不感兴趣以去色、水墨消散退出。
- 明确没有实现横向滑卡或拖拽手势。
- 反馈提交期间禁用重复操作，显示写入/切换状态；请求失败时保留当前卡并可重试。
- 列表重新加载会复位索引，避免最后一张卡刷新后落在越界位置。

### 3. Content → Person Reveal

- 从内容进入作者页时，身份文字缓入，水墨头像使用圆形墨迹展开。
- “我有点想认识 TA”提交增加 busy 状态，避免重复意愿请求。
- 双向成功时先出现两个人物印记汇合的全屏过渡，再进入完整连接成功页。

### 4. 双向成功动画

- 连接成功页用两个人物印记从两侧出现、淡金曲线绘制和节点绽放表达“双向成立”。
- 动画语言是“建立连接”，没有使用爱心、匹配百分比或婚恋暗示。
- 手机端先并列展示双方，再展示共同话题与开场问题；极窄屏自动改为单列。

### 5. 手机适配

- 核心页面改用 `min-height: 100dvh`，减少移动浏览器地址栏导致的高度跳动。
- 精修 380px / 600px / 720px 窄屏下的标题、边距、卡片内距、CTA 宽度、导航密度和底部安全留白。
- 推荐反馈按钮最小高度为 44px；连接页 CTA 在手机上为全宽。
- 已遇见列表在手机上允许问题文案换行，统计与操作区不再依赖桌面宽度。

## 可访问性与性能

- 三组动画样式均实现 `@media (prefers-reduced-motion: reduce)`，关闭循环、位移、描边和揭示动画，保留完整信息。
- 动画只使用 `transform`、`opacity`、`filter`、`stroke-dashoffset` 与 `clip-path`，没有引入 JS 动画库或新依赖。
- 装饰 SVG 标记为 `aria-hidden`；加载、反馈与连接成功状态可被辅助技术读取。

## 文件范围

修改：

- `app/page.tsx`
- `app/onboarding/page.tsx`
- `app/encounter/page.tsx`
- `app/encounter/[id]/page.tsx`
- `app/connect/[id]/page.tsx`
- `app/connections/page.tsx`
- `IMPLEMENTATION_PLAN.md`
- `README.md`
- `docs/HANDOFF-NEXT-WINDOW.md`

新增：

- `app/p7-landing.module.css`
- `app/onboarding/p7-motion.module.css`
- `app/encounter/p7-motion.module.css`
- `app/connect/[id]/p7-motion.module.css`
- `app/connections/p7-motion.module.css`
- `scripts/verify-p7.mjs`
- `docs/workstreams/P7-MOTION-DISPLAY.md`

冻结区 `app/globals.css`、`components/**`、框架配置、包清单、数据库与迁移均未修改。

## 验收方式

当前源码目录没有 `node_modules`，且系统 Node 为 22、项目要求 Node 24，因此本阶段不安装依赖、不启动 Next.js，也不声称完成浏览器截图回归。

此外，`/api/profile/analyze` 目前没有返回分阶段任务事件，因此 Loading 的四个内容类别是演示状态；若后续接入画像后台任务流，应改为消费服务端阶段事件。

本地静态验收：

```bash
node scripts/verify-p7.mjs
```

无需安装依赖的交互演示：

```bash
node scripts/serve-p7-preview.mjs
# 浏览器打开 http://127.0.0.1:4173
```

演示文件是 `design-qa/p7-motion-preview.html`，包含水墨理解、卡片转场和双向成功三个可切换场景，使用本地 Mock 数据且不调用业务 API。它用于快速展示动画语言，不替代 Next.js 页面在依赖就绪后的正式视觉回归。

依赖就绪后还应执行：

```bash
npm run check
```

并人工复核 375 × 812、768 × 1024、1440 × 900 三个视口，依次走完 Loading → 推荐换卡 → 人物揭示 → 双向成功。
