# 遇见 · 现状交接文档（2026-09-13 晚）

> 写给下一位接手的 AI / 队友。读完即可开工，无需追问历史。
> 截止：**9/15 10:00**（剩余约 36 小时）。

## 一、当前系统状态（全部已验证）

| 项 | 状态 |
| --- | --- |
| 公网地址 | https://fgfrmkscfzog.sealoshzh.site （HTTPS，Sealos 自动分配） |
| 线上版本 | 镜像 `seeseeyou-web:cf77d12`（已含全部功能） |
| `/api/health` | web/database/worker 全绿 |
| main 分支 | `e05faab`（PR #12 #13 均已合并） |
| 知乎 OAuth | 回调已在活动页登记，真实登录链路已验证走通 |
| 演示模式 | `/demo` 完整可用（独立 Cookie + Mock 池隔离） |
| LLM | 黑客松官方平台 key，模型 `qwen3.5-flash`（双模型同配） |

## 二、今天完成的工作（时间线）

1. **上午**：git 事故处置（ChatGPT 桌面版宿主的 Codex checkpoint 组件篡改 refs，进程已全杀）；
   PR #10/#11 内容经 main 直推收拢（ed0221b 动效 + c05f3c6 相遇整合 → 10fa3ea）。
2. **下午**：PR #13（feat/d-real-demo-isolation）交付——真实/Demo 双模式完全隔离：
   双 Cookie（yj_session / yj_demo_session）+ is_mock 交叉校验 + /demo 前缀路由 +
   候选池隔离 + 服务端轮换演示身份（防客户端指定）+ 产品化空状态。
   架构详见 `docs/EXPERIENCE_MODE.md`。
3. **晚上**：PR #12（A 的 /me 双模式）与 #13 审阅合并（merge commit）→ main = cf77d12；
   本机构建镜像并推送 ACR（tag cf77d12）→ Sealos 已换版本。

## 三、用户看到的「画像正在生成」——设计内现状，非故障

`/profile`（真实路由）展示的是**画像产物**（profile_artifacts 表，6 维画像文档）。
当前产物生成管线的输入是 `data/crawler/*.json`（爬虫采集文件）——即演示/开发数据源。

**真实用户的画像产物自动生成链路尚未接入**（`profileJobs` 目前只由
`/api/profile/generate` 从爬虫文件创建，没有「为 real-xxx 用户用其
externalIdentities.rawContents 生成画像」的路径）。
这正是交接文档 `docs/ENCOUNTER_INTEGRATION_HANDOFF_2026-09-13.md` 中
**PR 4「真实画像完成门槛」** 的范畴，是下一个开发任务。

真实用户当前可用的能力：/me 记录此刻 + 理解地图（userVectors + understanding）、
/encounter 真实推荐（若向量就绪）、/side、/connections。
`/profile` 对无产物真实用户显示产品化空状态（`resolveProfileEmptyState`，非白屏）。

## 四、下一步建议（按优先级）

1. **PR 4：真实画像完成门槛与生成链路**（核心空缺）
   - 为真实用户创建画像 job：输入改用 `externalIdentities.rawContents`（而非 crawler 文件），
     复用 `lib/profile/engine.ts` 两阶段管线；worker 消费后写 profile_artifacts。
   - `/profile` 空状态接入真实进度（job 状态查询）。
   - 相遇入口按 PR 4 口径加门槛（画像 succeeded 才开放，Mock 不受限）。
2. **端到端验收**：无痕窗口真实登录 → /onboarding → /me → /encounter → 双向连接 → /connections。
3. **提交材料**（明天）：3 分钟演示脚本、录屏（20s 问题 / 40s 画像 / 30s 此刻侧面 / 70s 相遇闭环 / 20s 架构隐私）、PPT/说明、社区长帖。主叙事见 `docs/SPRINT_48H.md` §6。
4. **PR 2/3/5**（侧面参与匹配、此刻有效期、分享闭环）：比赛后再做，说明文档可作为 roadmap 展示。

## 五、环境与凭据要点

- Sealos 应用环境变量已配齐（DATABASE_URL 内网地址 / 知乎三凭证 / LLM 官方平台 key /
  TOKEN_ENCRYPTION_KEY / DEMO_AUTH_ENABLED=true / ZHIHU_REDIRECT_URI 与 APP_ORIGIN 均指向 sealos 域名）。
- ⚠️ `DEMO_AUTH_ENABLED=true` 为比赛演示开启；**正式提交前评估是否改为 false**
  （关闭后 /demo 入口 404，真实登录不受影响）。
- 镜像构建在本机：Docker Desktop + `docker build --platform linux/amd64` → push ACR（登录态在 ~/.docker/config.json）。
  ⚠️ Dockerfile 首行 `# syntax=docker/dockerfile:1` 在 docker.io 网络差时会构建失败（本地构建可临时移除该行）。
- 依赖：隔离工作副本不要用 junction/symlink 共享 node_modules（Turbopack 拒绝），物理复制或容器内 npm ci。
- **密钥红线**：知乎 App Key/Access Secret/LLM Key 只存在于 .env.local 与 Sealos Secret；任何提交/打包/截图出现即为事故。

## 六、已知坑速查

- Sealos「启动命令」表单会把命令按空格拆碎（带引号的 sh -c 必坏）——用镜像默认 CMD，
  一次性任务（migrate/seed）走容器终端或 CronJob。
- 本机沙箱内 npm 命令被拦（转发 wsl.exe）——用 `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ...` 直跑。
- Turbopack 拒绝指向项目根外的 node_modules 链接——独立工作副本需物理复制依赖。
- git：本机部分目录 loose ref 写入会静默失败（gc 竞争），commit 后用 `git ls-remote` 验证；
  遇见主工作区历史上发生过 AI 工具 checkpoint 篡改 refs 的事故（已根治：禁止 ChatGPT/Codex/Zcode 打开该目录）。
