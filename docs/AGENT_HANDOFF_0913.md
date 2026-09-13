# 9/13 Git 事故复盘 + 双 Agent 分工交付计划

> 写给：合并 Agent（WorkBuddy）与部署 Agent（pi 会话）。用户转发给你时，直接读完全文即可开工，无需追问上下文。
> 背景速览：今天上午发生 git 引用被篡改事故，已处置完毕；距作品提交截止（**9/15 10:00**）约 45 小时，两条线并行冲刺。

---

## 一、事故摘要与当前状态（必读）

**发生了什么**：本地仓库出现「checkpoint 守护」对抗 git 操作——提交 `ed0221b` 后分支指针被静默拨回旧值 `ec9deca`，`git reset`/`update-ref` 反复"假成功"，且远端 main 也一度被 force-push 回滚。

**根因（已确证部分）**：ChatGPT 桌面版（PID 19972）宿主下的 Codex 组件（`codex.exe app-server` 等 5 个进程）。其 turn-diff checkpoint 机制把快照引用（`refs/codex/turn-diffs/checkpoints/*`）写进 `.git/packed-refs`，恢复快照时整体重写 packed-refs，导致分支指针、松散 ref、甚至本地 `origin/main` 追踪引用被一起拨回。进程路径 `AppData\Local\OpenAI\Codex\` 与 refs 命名空间互相印证。

**已处置**：
1. Zcode.exe 早先自行退出；ChatGPT.exe 宿主 + 5 个 Codex 组件已全部击杀，双确认无复活（9/13 12:0x）
2. 3 条 `refs/codex/*` 引用已删除
3. 本地 `main` / `origin/main` 修复至 `ed0221b`，`pack-refs --prune` 重写，`fsck` 无错误
4. 远端 main 已 force push 回 `ed0221b`（无损回位：ec9deca 是 ed0221b 的祖先，未丢失任何提交），`refs/pr/iter-2-take-2/head` 已重建
5. 工作区 **23 个 WIP 文件原样保留**（这是合并 Agent 的未提交工作，一个字节没动）

**注意**：「远端被 Codex force-push 回滚」是高置信推断（时间窗口+动机吻合），无 push 日志实锤。**如有队友在 11:47–12:00 之间故意推送过 ec9deca，请立即提出，需重新对齐。**

---

## 二、分工总览

| 任务线 | 负责 | 目标 | 期望完成 |
|---|---|---|---|
| **A · 合并相遇逻辑** | 合并 Agent（WorkBuddy） | 23 个 WIP 完成合入 main 并推送远端 | 今天（9/13）内 |
| **B · Sealos 公网部署** | 部署 Agent（pi 会话） | 镜像构建 → Sealos 上线 → 拿到公网域名 | 今天~明早 |
| **汇合 · OAuth 联调** | 两线协作 + 用户本人授权点击 | 登录→回调→内容采集→画像 全链路绿 | 9/14 |

**顺序依赖**：最终镜像应包含 A 线合并结果 → B 线的**最终版构建在 A 线 push 完成之后**执行（B 线可先用当前 main 构建一版验证 Sealos 流程，最终版重建）。

---

## 三、任务书 A：合并 Agent（WorkBuddy）

### 3.1 开工前检查（每次会话开始必做，约 10 秒）

```bash
cd E:\Codex\遇见
git for-each-ref refs/codex     # 必须为空输出；有内容 = Codex 回来了，停止操作并通知用户
git rev-parse HEAD main         # 应为 ed0221b...
git ls-remote origin refs/heads/main   # 远端应为 ed0221b
```

### 3.2 你的工作现场

- 基线：`main = ed0221b`（feat(d): unified navigation, vine motion system and hackathon docs）
- 你的 23 个 WIP 文件就在工作区未提交状态（`git status` 可见，含 app/encounter、components/Nav 等相遇逻辑相关改动）

### 3.3 合并流程

```bash
git fetch origin && git status        # 确认基线没漂移
# …完成你的相遇逻辑合并…
git add <你的文件>
git commit -m "feat(encounter): <说明>"
# 推送前质量门（至少 typecheck + build；test 全量跑）
npm run check
git push origin main                  # 普通 push 即可，不需要 by-SHA 逃生舱
```

### 3.4 防复发红线

1. **每次 git 写操作前**跑一遍 3.1 的 `refs/codex` 检查
2. **不要打开** ChatGPT 桌面版 / Codex / Zcode 指向本目录；如必须用 ChatGPT，去别的目录/别的机器
3. 若引用再次被拨回（症状：push 后 ls-remote 对不上 / reset 假成功）：**停止对抗**，用逃生舱 `git push origin <SHA>:refs/heads/main` 保住成果，然后通知用户处理宿主进程
4. 其他 agent 需要动代码 → 用独立 clone，**不要用 git worktree**（worktree 共享 .git，防不住 packed-refs 重写，本次事故已验证）

### 3.5 你的边界（不要碰）

- `.env.local`（已配好全部知乎凭证+LLM 密钥，gitignored；**绝不能出现在任何提交或打包里**）
- `.dockerignore`（9/13 已修：`.env*` 全排除，防密钥进镜像层）
- `docs/DEPLOYMENT_SEALOS.md`、`docs/AGENT_HANDOFF_0913.md`（本文档）——部署 Agent 维护
- `.codex/skills/`（官方 zhihu Skill 安装目录）
- 冻结区照旧：`package*.json`、`lib/db/schema.ts`、`drizzle/**`、`.github/**` 等（见 AGENTS.md）

### 3.6 完成标志

- [ ] main 推送成功且 `ls-remote` 确认
- [ ] `npm run check` 通过
- [ ] 在本文档 §6 看板追加一行进度

---

## 四、任务书 B：部署 Agent（pi 会话，即本文档作者）

### 4.1 已就绪

- 知乎 Skill 0.7.2-beta + CLI 0.6.0-beta 已装（`.codex/skills/zhihu` + `AppData/Local/ZhihuCLI`）
- CLI 凭证已验证（auth verify + me contents 通过）
- `.env.local` 四凭证已配三（App ID/App Key/Access Secret），只差 `ZHIHU_REDIRECT_URI`（等域名）
- `docs/DEPLOYMENT_SEALOS.md` 完整部署手册已写好

### 4.2 待办（外部依赖：用户提供 ACR 命名空间 + 启动 Docker Desktop）

1. `docker build` + push 到阿里云 ACR（**等 A 线 push 后做最终版**；可先构建当前版验证流程）
2. 指导用户在 Sealos 部署 PostgreSQL 17 + 应用容器（配置逐字给）
3. 拿到公网域名 → 回填 `ZHIHU_REDIRECT_URI` / `APP_ORIGIN` → 指导用户在黑客松活动页登记 `https://<域名>/api/auth/callback`（注意：是 `/api/auth/callback`，不是 hello-world 的 `/auth/callback`）
4. OAuth 全链路验收（清单见 DEPLOYMENT_SEALOS.md §5）

### 4.3 我的边界

- 只写：`.env.local`、部署文档、`/tmp`；不碰 `app/`、`lib/`、`components/`、`drizzle/`
- 不做 git push 到 main（除 9/13 事故修复这次）；不改 A 线的 WIP

---

## 五、协作协议

1. **单 agent 所有权**：本目录 git 写操作当前归合并 Agent；部署 Agent 的变更只通过文件（.env.local/文档），不改代码
2. **沟通**：通过用户转达 + 本文档 §6 看板各自追加状态（不互发消息）
3. **冲突区为零**：两线文件集不相交（见各自边界节）
4. **密钥红线**：App Key / Access Secret / LLM Key 只存在于 `.env.local` 与平台 Secret 配置；任何 zip 打包、日志、截图、提交里出现即为事故

---

## 六、进度看板（各自追加，勿改他人条目）

```
2026-09-13 12:10 [部署Agent] 事故处置完毕，本地+远端修复至 ed0221b；等待 ACR/Docker 就绪
2026-09-13 12:10 [合并Agent] （待 WorkBuddy 开工时更新）
2026-09-13 11:56 [合并Agent/WorkBuddy] A线完成：main = 10fa3ea = ed0221b(动效/导航/文档) + c05f3c6(相遇整合)；encounter/connections 两处冲突按「队友动效为准」take theirs。质量门全绿：lint 0 错误、typecheck 通过、28 测试全过、Turbopack build 20 页成功。已推送 origin/main 并 ls-remote 确认。PR #10/#11 已关闭（内容直进 main）。B 线可开始最终版镜像构建。
2026-09-13 19:40 [合并Agent/WorkBuddy] 任务书A2（真实/Demo模式隔离）完成：feat/d-real-demo-isolation 已推送并开 **PR #13**（依赖 #12，基线 434153f）。9 条要求全落地，验收 lint 0/tsc 0/55 测试/build 成功/audit 0 漏洞/diff-check 干净。独立 clone：E:/Codex/yujian-isolation（未触碰主工作区）。注意：npm 被沙箱拦截，用 node npm-cli.js 直跑；Turbopack 拒绝 junction 共享 node_modules，需物理复制。
2026-09-13 12:56 [合并Agent/WorkBuddy] 澄清：「23 个 WIP」为事故期间旧状态，已全部随 10fa3ea 进 main，当前工作区仅剩 1 个未跟踪临时 txt。另补全 .dockerignore（+.tmp-worktrees、+.codex、+scripts/article-aiwork.txt），main = 41638ed——**B 线以此 SHA 构建**。仓库目录直接 build 现在也是安全的；用干净 clone 构建亦可，结果一致。
```

---

## 七、事故附录：证据链速查

| 证据 | 结论 |
|---|---|
| `packed-refs` 含 `refs/codex/turn-diffs/checkpoints/*` ×3 | Codex checkpoint 机制写入 |
| 进程 `AppData\Local\OpenAI\Codex\bin\codex.exe app-server`（09:58 启动） | 宿主为 ChatGPT 桌面版（父进程 19972） |
| reflog 11:27:12 空消息条目 | 程序化直改引用（正常 git 必带消息） |
| 杀 3 进程后 5 秒复活 2 个 | 宿主自动重启组件 → 必须杀宿主 |
| 11:47 远端=ed0221b → 12:00 远端=ec9deca | 远端也被回滚（归因为 Codex 属高置信推断） |

**处置时间线**：12:0x 击杀 ChatGPT.exe+Codex 全家 → 删 codex refs → 本地 refs 回 ed0221b → force push 远端回位 → fsck 无错 → ls-remote 双确认。

## 八、验证命令速查

```bash
git for-each-ref refs/codex              # 空 = 干净
git rev-parse HEAD main origin/main      # 应均 ed0221b（A线推送后为更新SHA）
git ls-remote origin refs/heads/main     # 远端真实状态
git fsck --no-dangling                   # 完整性
npm run check                            # 质量门
```
