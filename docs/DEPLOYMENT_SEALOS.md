# 部署指南（Sealos · 黑客松公网方案）

> 目标：9/15 10:00 截止前，把「遇见」以公网 HTTPS 地址跑起来，完成知乎 OAuth 登录与内容采集联调。
> 选型依据：Sealos 是知乎官方 Skill 文档点名的部署平台；容器原生（仓库 `Dockerfile` 零改造）；平台默认域名自带 HTTPS、免 ICP 备案；国内地域评委访问快。
> 阿里云 ECS 大陆方案的备案问题见 `docs/DEPLOYMENT.md` 第 6 节，比赛期间不采用。

## 架构映射（compose 4 服务 → Sealos 2 个实例）

| docker-compose.prod.yml | Sealos 上 | 说明 |
| --- | --- | --- |
| `postgres` | 数据库市场一键部署 PostgreSQL 17 | 内网地址直连，数据卷自动管理 |
| `migrate`（一次性） | 并入应用启动命令 | 迁移 + 种子幂等，可随容器每次启动重复执行 |
| `web` + `worker` | **同一个容器**（镜像默认 CMD `npm run start:all`） | web 与画像 worker 本就共用镜像 |

## 0. 前置准备（约 10 分钟）

1. **Sealos 账号**：`https://sealos.run` 注册，选国内地域（延迟低）。
2. **镜像仓库**：阿里云容器镜像服务 **ACR 个人版**（免费）— `cr.console.aliyun.com` → 开通个人版 → 创建命名空间（如 `yujian`）→ 设置 Registry 登录密码。
3. 本机 **Docker Desktop**（本地开发 `npm run db:up` 已在用）。

## 1. 构建并推送镜像（首次约 15–25 分钟，之后有层缓存）

仓库根目录执行（`<ns>` 换成你的 ACR 命名空间，地域按实际选择）：

```bash
docker login registry.cn-hangzhou.aliyuncs.com
docker build --platform linux/amd64 -t registry.cn-hangzhou.aliyuncs.com/<ns>/yujian:20260913 .
docker push registry.cn-hangzhou.aliyuncs.com/<ns>/yujian:20260913
```

- `.dockerignore` 已排除 `.env*`（含 `.env.prod`），密钥不进镜像；runner 阶段也不 COPY 源码。
- Windows 构建必须带 `--platform linux/amd64`。
- 更新版本：换新 tag 重复 build + push，再到 Sealos 改镜像 tag 重启。

## 2. Sealos 部署 PostgreSQL（约 5 分钟）

1. 控制台 → 数据库 → **PostgreSQL 17** → 部署。
2. 设置库名 `yujian`、用户名、密码（记下来，下面要用）。
3. 部署完成后，在数据库**连接信息**页复制**内网连接地址**（控制台展示为准，形如 `xxx.ns-xxx.svc.cluster.local:5432`）。

## 3. Sealos 部署应用（约 10 分钟）

控制台 → 应用部署 → 创建，关键配置：

| 项 | 值 |
| --- | --- |
| 镜像 | `registry.cn-hangzhou.aliyuncs.com/<ns>/yujian:20260913` |
| 规格 | 1 核 / 2 GiB（演示够用；构建在本地完成，容器只跑运行时） |
| 启动命令（高级设置） | `sh -c "npm run db:migrate && npm run db:seed && npm run start:all"` |
| 外网访问 | 开启 → 获得 `https://<自动分配域名>`（自带 TLS） |

**环境变量**（逐条粘贴；前两项部署完拿到域名后回填再重启）：

```text
DATABASE_URL=postgresql://yujian:<PG密码>@<PG内网地址>:5432/yujian
NODE_ENV=production
TOKEN_ENCRYPTION_KEY=<取自 .env.local 同名项>
ZHIHU_APP_ID=415
ZHIHU_OAUTH_APP_KEY=<取自 .env.local 同名项>
ZHIHU_ACCESS_SECRET=<取自 .env.local 同名项>
ZHIHU_REDIRECT_URI=https://<Sealos域名>/api/auth/callback
APP_ORIGIN=https://<Sealos域名>
ZHIHU_ALLOW_MISSING_STATE=false
LLM_BASE_URL=<取自 .env.local 同名项>
LLM_API_KEY=<取自 .env.local 同名项>
LLM_MODEL=qwen3.8-flash
LLM_CHEAP_MODEL=qwen3.7-flash
DEMO_AUTH_ENABLED=true
```

> 若当前界面版本不支持覆盖启动命令：先按镜像默认命令启动应用，另建一个一次性任务（CronJob，同镜像，命令 `npm run db:migrate && npm run db:seed`）跑一次即可。

## 4. 登记 OAuth 回调（约 5 分钟，决定登录能否走通）

1. 黑客松活动页 → 我的项目 → 创建/编辑项目 → **知乎登录回调地址**填：
   `https://<Sealos域名>/api/auth/callback`
2. ⚠️ 三处完全一致才能过：活动页登记值 = `ZHIHU_REDIRECT_URI` = 实际路由。注意是 `/api/auth/callback`（本仓库路由），不是 hello-world Demo 的 `/auth/callback`；协议、域名、路径、结尾不得多斜杠。
3. 登录确认页必须**本人亲自点击**（官方要求，Agent 不得代点）。

## 5. 验收清单（全绿才算完成）

- [ ] `https://<域名>/api/health` 返回 ok
- [ ] `https://<域名>/api/auth/zhihu/status`：appKey / accessSecret 均 `configured: true`，`warnings: []`
- [ ] Landing 页出现「使用知乎账号登录」按钮（四凭证齐备时自动显示）
- [ ] 本人完成：授权 → 回调 → 进入 `/onboarding?src=zhihu`，「我的」页显示知乎昵称头像
- [ ] 登录后画像正常生成（worker 工作）：「我的」理解地图 / `/profile` 有内容
- [ ] 无痕窗口 + Demo 登录，走通评委视角：Landing → AI 理解 → 推荐 → 连接 → 已遇见

## 6. 常见问题

| 症状 | 排查 |
| --- | --- |
| 容器起来又重启 | 看 Sealos 应用日志；多为 `DATABASE_URL` 拼错或 PG 未就绪（migrate 在启动命令里会等失败即退，重启策略会自动重试） |
| 登录回调跳 `?oauth=error` | 看 `/api/auth/zhihu/status` 的 `failedStage`：`token_exchange_*` → 回调地址不一致或 App Key 串位；`profile_*` → Access Secret 问题；`state_*` → 检查浏览器是否拦截了 Cookie |
| 画像一直「生成中」 | worker 未起：确认启动命令含 `start:all`，或单独跑 worker；看应用日志有无 LLM 报错 |
| 想省费用 | 演示间隙可把应用规格调小；赛后**停止/删除应用**（数据库数据卷如需保留先导出） |

## 7. 费用预估（演示期）

- Sealos：按量计费（CPU/内存/流量），演示期约 ¥5–20；新用户通常有赠送额度，以平台实际为准。
- ACR 个人版：免费。
- 合计一般 < ¥30。
