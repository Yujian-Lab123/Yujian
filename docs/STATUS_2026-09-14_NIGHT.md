# 2026-09-14 深夜工作总结与交接

> 写给三位队友与下一个 AI 会话。当前 GitHub main = `55a01af`，**所有工作已推送**。
> 截止：9/15 10:00。剩余关键路径是**材料**（占位提交 / 产品说明 / 录屏），不是代码。

## 一、今晚落地了什么（按提交，自旧到新）

| 提交 | 内容 | 状态 |
| --- | --- | --- |
| `c125a3e` | Dockerfile 移除 `# syntax` 指令（国内构建机不再依赖 auth.docker.io） | 已验证 |
| `6e80f6d` | **画像长廊骨架**：`profile_artifacts` 加 `shared_at` 列（迁移 0002）、`/gallery` 卡片墙（左右箭头翻页，8 张/页）、`/gallery/[slug]` 详情页、导航双模式入口 | 已验证 |
| `f78538e` | **相遇/画像打磨（Codex 线）**：肖像优先预览、`/profile` 隐私收口（`?name=` 任意查看已移除）、时间线平滑曲线/亮点峰闪/连接线补齐 | 已验证 |
| `54361d9` | **LLM 流式开关**：`LLM_STREAM`（默认 on），画像综合层走 SSE，规避中转站对非流式请求约 100s 的硬超时（HTTP 524） | 代码完成，网关实测待做 |
| `ebec629` | 长廊视觉资产：Hero 横卷 / 边缘植物 ×2 / 宣纸纹理 / 8 位人设封面（Image2.5 生成，图内无文字） | 已验证 |
| `55a01af` | **体验模式适配器重构（进行时）**，见下文第三节 | 编译/测试通过，视觉回归未做 |

## 二、画像长廊的产品语义（重要，别做歪）

- **人人可逛**：`/gallery` 是公开页。
- **上墙需本人同意**：数据库标记 `profile_artifacts.shared_at`（null = 私有）。真实用户只有本人开启分享后才会出现。
- **两列互不混排**：预览条目 = 8 位虚构人设（比赛演示，封面已生成）；真实条目 = `isMock=false` 且 `sharedAt` 非空。
- **详情页**：`/gallery/[slug]` 服务端强制校验 `sharedAt`——未公开的画像返回产品化提示，不泄露内容。`/profile` 只读本人（Codex 已收口，不要恢复 `?name=`）。
- **已知留白**：8 位人设卡目前无画像产物，卡片显示「完整画像整理中」且不外链。补法：给每位人设手写一份 Mock 画像产物灌库，详情页即可点开（约 1 小时）。

## 三、进行时：体验模式适配器重构（`55a01af`，思路说明）

**为什么改**：真实页与 `/demo` 页此前各自维护一套近似页面代码——`/connections` 与 `/demo/connections`、`/me` 与 `/demo/me` 结构 90% 相同但互相复制，改一处漏一处。

**怎么改的**：
1. 抽出共享 Screen 组件：`app/connections/ConnectionsScreen.tsx`、`app/me/PresentSelfScreen.tsx`——所有真正的 UI 与数据逻辑都在这里；
2. 新增 `lib/experience-mode/adapter.ts` 导出 `EXPERIENCE_ADAPTERS`：按模式注入差异（API 前缀、空态文案、身份来源），`experience-fetch.ts` / `useExperienceMe.ts` 负责统一的取数；
3. 页面文件变成约 10 行的薄壳：`/connections/page.tsx` 只做「取适配器 → 渲染 Screen」。

**当前状态**：`tsc` 0 错误、74 项测试全部通过。
**还差**：浏览器视觉回归（四态：`/connections`、`/demo/connections`、`/me`、`/demo/me`）。
**后续有偏差怎么改**：只改 Screen 组件与 adapter，**不要**往页面薄壳里加逻辑。

## 四、线上部署（公网）——后续还能继续改的部分

当前 Sealos 跑的是旧镜像（`7fa761d` 时代，三项健康），**落后 main 六个提交**：长廊、画像打磨、LLM 流式、体验模式重构都还没上线。

上线三步（部署 Agent 或负责人执行）：

```bash
# 1. 任意有 Docker 的机器，基于 main 978b6ef+ 构建（注意 git 提交后回读验证，见第六节）
docker build -t crpi-pk0qcn2xowwtj265.cn-shenzhen.personal.cr.aliyuncs.com/seeseeyou/seeseeyou-web:<NEW_SHA> \
             -t crpi-pk0qcn2xowwtj265.cn-shenzhen.personal.cr.aliyuncs.com/seeseeyou/seeseeyou-web:latest .
docker push ...（两个 tag 都推）
# 2. Sealos 应用更新镜像 tag → 重启 Pod
# 3. 容器终端：npm run db:migrate && npm run db:seed   （迁移 0002：shared_at 列）
```

环境变量（Sealos 控制台）：`LLM_JSON_RESPONSE_FORMAT=off`（JSON 模式 400 规避）；`LLM_STREAM` 默认 on 不用设。

**公网后续可迭代清单（均不阻塞提交）**：
- 域名 + HTTPS（OAuth 回调正式化；当前 IP/平台域名演示够用）
- ICP 备案（7–20 天，走阿里云）
- 真实用户分享流程打磨（分享开关 UI 目前只有后端，缺画像页角落的开关按钮）
- 长廊人设详情开放（见第二节留白）
- 每日推荐配额等产品化项（明确决定：暂不做）

## 五、材料硬截止（9/15 10:00，唯一不能推迟的事）

1. **比赛页占位提交**（今晚）：一句话介绍 + Demo 链接（`https://fgfrmkscfzog.sealoshzh.site`）+ GitHub 链接 + 3 张截图
2. **产品说明**：叙事主线 = 不是根据标签猜你和谁合适，而是先理解一个人长期写过什么、此刻处于什么状态、愿意从哪一面被看见，再用一篇真实内容开启一次双方都可以拒绝的相遇。AI 管线重点：两阶段画像、Content Bridge、方向性双向意愿（`forward/backward` 非对称建模）、此刻/侧面、隐私边界
3. **3 分钟录屏**：`/about` → 预览身份 → `/profile` → `/me` 写此刻 → `/side` → `/encounter` → 表达想认识 → 双向成功；手机宽度过一遍

## 六、工程注意事项（血泪教训，务必遵守）

1. **ChatGPT 桌面版（Codex 宿主）的 checkpoint 机制会重写 `.git` 引用**：提交后分支指针可能被静默拨回。9/13 与 9/14 两次事故同源。已处置两次（进程确认 0、`refs/codex` 清零、`pack-refs --prune`）。**提交后务必 `git log --oneline -1` 回读验证**；重要工作在干净克隆里做（9/13 起的成熟打法）。
2. 本机 shim 环境禁用了 MSYS 路径转换：git 的路径参数必须写 `E:/...` 风格；中文路径不能作为 git 参数（用 `git clone . 目标` 规避）。
3. `mock-covers/`、`scripts/article-aiwork.txt`、`scripts/.diag-synth*.mjs` 是用户/素材文件，不要 `git add`。
4. 冻结区照旧：`package*.json`、`app/globals.css`、`components/**`、`lib/db/schema.ts`、`drizzle/**`、`.env.example`、`.github/**`——本次 `schema.ts`（shared_at）与 `.env.example`（一行文档）的变更已经由负责人追认。
