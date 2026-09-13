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

---

## 七、22:30 增量（真实身份修复 + 头像链路 + LLM 接入调整）

### 7.1 知乎用户信息接口的正确用法（重要）

`GET https://openapi.zhihu.com/user` **只需** `Authorization: Bearer <用户 access_token>`；
**不要**加 Access Secret / `X-OAuth-Token` / 时间戳（旧实现误加，导致接口返回
`{"code":..,"data":"Access token is not valid"}` 被兜底成匿名「知乎用户」+ anon-xxxx 身份）。

返回字段：`uid`（int64，**必须用正则从原文无损提取**，JSON.parse 会丢精度）、
`hash_id`、`fullname`（昵称）、`avatar_path`（头像）、`headline`、`description`、`url`。
鉴权失败时接口返回 HTTP 200 + 错误串，**必须检查响应体再建会话**。
创作内容接口（developer.zhihu.com）仍用双凭证头，两者不可混用。

### 7.2 已修复并上线（main = 1198f26）

- `lib/providers/zhihu.ts`：正确鉴权头 + 官方字段 + uid 无损解析 + 鉴权失败不建会话。
- `lib/db/users.ts`：`getIdentityExtras()` 从 external_identities.profile 读头像/简介（零迁移）。
- `/api/me`、`/api/demo/me`：user 对象附带 `avatarUrl / profileUrl / headline`。
- `components/Nav.tsx`：右上角优先显示知乎头像（`referrerPolicy="no-referrer"`），回退姓名首字。

### 7.3 数据侧现状（生产库）

- 库名是 `postgres`（不是 `test-db`）；Sealos PG 外网为 `dbconn.sealoshzh.site:45671`（用完记得关）。
- 3 个真实账号（real-anon-6d60f1be / 769a5d5d / e4723f6b）**同属一位用户**（三次测试登录），
  已回填真实身份：昵称「飞鸟」+ 头像 + headline；3 份画像产物已按新 slug（`飞鸟-<id>`）重跑并入库。
- `/profile` 公开页已能看到画像内容（读数据库，不需要新镜像）。

### 7.4 运维脚本（scripts/）

- `analyze-real-user.ts`：真实用户内容（OAuth rawContents，含知乎大写字段适配）→ 画像产物 → 写库。
- `refresh-zhihu-identity.ts`：用已存 token 重新拉取并回填真实昵称/头像（`--dry-run` 支持）。
- 运行方式（本地直连生产库时）：`node --env-file=<含 DATABASE_URL 与 LLM_* 的 env> node_modules/tsx/dist/cli.mjs scripts/<name>.ts`。

### 7.5 LLM 接入现状（★ 换模型必须先验证存在性）

- 生产 Sealos 环境变量：改用中转站 `https://api.openai-next.com/v1`，模型 `deepseek-v4-flash`
  （实测可用；中文理解正常）。**注意中转站模型列表里没有 `qwen3.5-flash`/`qwen3.8-flash`**，
  旧配置实际不可用；`LLM_CHEAP_MODEL` 必须同样使用存在的模型名。
- 本地 `.env.local`：阿里云百炼官方 `https://dashscope.aliyuncs.com/compatible-mode/v1` + `qwen3.8-flash`。
- 排查手法：`GET <BASE_URL>/models` 验证 key 与模型存在性；`POST /chat/completions` 实测。
  （直接打接口时需带正常 User-Agent，否则可能被 Cloudflare 以 1010 拒绝。）

### 7.6 待办（更新）

1. 确认 Sealos 应用镜像 tag 是否为 **1198f26**（若仍是 cf77d12，右上角头像不会出现）。
2. 真实画像自动生成链路（PR 4）仍是最核心的产品空缺：目前依赖脚本人工触发。
3. `DEMO_AUTH_ENABLED=true` 正式提交前评估关闭。
4. Sealos PG 外网访问用完即关。
