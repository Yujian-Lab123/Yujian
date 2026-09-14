# 交接：长期画像页收敛与真实 / Demo 隔离

日期：2026-09-14  
责任边界：D（`app/profile/**`、`app/demo/profile/**`）  
当前分支：`feat/c-encounter-portrait-preview`（注意：画像改动尚未另建/提交 D 分支）

## 本轮已经完成

1. 修复真实画像页的数据入口。

   `app/profile/page.tsx` 已改为只使用当前真实会话的 `userId` 调用
   `getLatestProfileArtifactForUser(userId)`。

   - `/profile` 不再枚举数据库全部画像。
   - `/profile` 不再回退读取 `profile-output/` 本地文件。
   - URL 的 `?name=` 不再能选择别人的画像。
   - 未登录或仅有 Demo 会话时，进入已有的产品化空状态，而不是展示预置画像。

2. 个人页改用全站共享导航。

   `app/profile/profile-experience.tsx` 已移除页面内自建 `ProfileHeader`，直接复用
   `components/Nav.tsx`。因此左上角“遇见”、红色印章、五项导航、演示徽章和右上角
   账号头像均由同一组件管理。

3. 去除个人画像页的重复内容区。

   - 保留 1–6 六个地图维度与现有连线/流光动效。
   - 移除了第二套“代表内容精选”和“适合如何认识 TA”底部块。
   - 第 6 块只保留 3 张代表内容卡，改为三列，接近设计参照的收束方式。
   - 中心标题恢复为地图原有的大层级“一个人”，符合参照图，不再使用之前的过小内联字号。

4. Demo 画像不再从本地研究素材任取头像。

   `app/demo/profile/page.tsx` 不再传入 `resolveLocalAvatar()` 结果，改用
   `ProfileExperience` 内置的水墨人物占位图：
   `public/images/profile/ink-avatar-fallback-v1.png`。

## 已完成验证

- `git diff --check`：通过。
- `npm run typecheck`：通过。
- `npm run test`：18 个测试文件、69 项测试全部通过。
- `npm run build`：Next.js 生产构建通过。
- `npm run lint`：通过（无 error）。
- 浏览器已验证：携带 Demo 会话访问真实 `/profile`，显示“你正在使用演示身份 / 回到演示模式”，没有泄露预置画像。
- 浏览器已验证：`/demo/profile` 可加载六维画像、统一导航、演示徽章与水墨占位头像。
- 未完成：本轮应用内浏览器的临时 390 × 844 视口覆盖未实际生效；移动端应在可用的设备/浏览器中复验，不能标为已验收。

截图（Git 已忽略，不会入库）：

- 实现：`audit-output/profile-redesign/demo-profile-final.png`（1264 × 894）。
- 对照：`audit-output/profile-redesign/comparison.png`（上方为用户图 2 的归一化参照、下方为实现）。
- 视觉参照原图：`C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-f36104de-be14-43aa-9f94-2bfb6dc18fab.png`。

## 必须继续做的事

按顺序执行：

1. 先完成移动端浏览器验证：

   - `/demo/profile`：390 × 844，检查单列、无横向溢出和第 6 节三张卡片。
   - `/profile`：访客、Demo 会话、真实有画像、真实无画像四种状态。
   - 更新根目录 `design-qa.md`：当前 Profile 章节为 `final result: blocked`，只因上述移动端实测缺失。

2. 如需要重新跑完整检查：

   ```powershell
   npm run check
   git diff --check
   ```

3. 视觉收尾建议（不要改匹配算法或数据库）：

   - 当前六维地图仍沿用旧的绝对定位画布；如果与参照图有明显字号/间距偏差，只调整
     `app/profile/profile-experience.tsx` 中的布局常量和该目录专属样式，不修改
     `app/globals.css`（冻结共享文件）。
   - 首屏截图应以动画完成后的状态为准；当前为避免“先撑满再缩回”，画布会在缩放计算前短暂隐藏。
   - 真实页的中心头像当前仍可读取当前用户自己对应的本地授权头像；Demo 固定使用通用水墨占位，避免身份误导。

4. Git：

   - 先确认 `scripts/article-aiwork.txt` 是用户未跟踪文件，不能加入提交。
   - 建议把本轮 3 个页面文件和本交接文档放入专用 D 分支，例如
     `feat/d-profile-isolation-and-map-cleanup`，不要混入当前 C 的相遇分支。
   - 做完 QA 后再提交、推送并开 PR；不要直接合并 `main`。

## 当前工作树

预期可提交改动：

- `app/profile/page.tsx`
- `app/profile/profile-experience.tsx`
- `app/demo/profile/page.tsx`
- `docs/HANDOFF_PROFILE_REDESIGN_2026-09-14.md`

必须保留、不属于本任务：

- `scripts/article-aiwork.txt`（未跟踪的用户文件）
