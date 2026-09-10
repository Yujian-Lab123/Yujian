# GitHub 管理员设置：三人协作且仅 D 合并 main

> 本文件是 GitHub 后台的操作清单。`.github/CODEOWNERS` 和 CI 文件不能自行授予或撤销任何人的合并权限；必须由 Organization Owner 在 GitHub 网页端实际配置。

## 目标

- A、C 能各自在功能分支提交、开 PR、参与审阅。
- 只有 D（负责人）能把 PR 合并进 `main`。
- `main` 必须经过 PR、检查和审阅；禁止直接 push、强推、删除。

## 成员与 Team

先在 `Yujian-Lab123` 组织内建立/核对三个 Team，并授予仓库访问权：

| Team | 成员建议 | 仓库角色 | 对应目录 |
| --- | --- | --- | --- |
| `profile` | A + D | Write | `app/me/**`、`app/api/me/**`、`lib/useMe.ts` |
| `encounter` | C + D | Write | `app/encounter/**`、`app/connect/**`、`app/connections/**`、匹配模块 |
| `platform` | D + 一名可信审阅备用人 | Write（D 保持 Owner/Maintain） | `/side`、长期画像、数据库、认证、CI、Landing |

让 D 同时加入三个 Team 的作用是：A 或 C 的 PR 可以由 D 完成 Code Owner 审阅；备用审阅人可以审阅 D 自己的 `platform` PR。**Team 成员资格不等于 main 合并资格。**

## main 分支规则

仓库 → **Settings → Rules → Rulesets**（或 Branches / Branch protection rules）→ 新建/编辑匹配 `main` 的规则：

1. 开启 **Require a pull request before merging**。
2. 开启至少 **1 required approval**，并开启 **Dismiss stale approvals**。
3. 开启 **Require review from Code Owners**（前提是上表 Team 已建立且包含可审阅的第二人）。
4. 开启 **Require status checks**，选择 CI job `quality`。它已经覆盖 lint、typecheck、test、build 和生产依赖审计。
5. 开启 **Require conversation resolution**。
6. 开启 **Restrict updates / Restrict who can push to matching branches**，只添加 D 的 GitHub 账号。合并 PR 本质上也是对 `main` 的更新；这是“只有 D 能合并”的关键设置。
7. 关闭 **Allow force pushes** 和 **Allow deletions**。
8. 如果界面提供，开启 **Do not allow bypassing the above settings**；D 应作为被允许更新 `main` 的账号，而不是依赖绕过规则。
9. 仓库 → Settings → General → Pull Requests：保留 **Allow squash merging**，可关闭 merge commit/rebase merge 以统一历史。

## 如何验证

用 A、C 各创建一个只改自己目录的测试 PR：

- A/C 可以 push `feat/a-*` 或 `feat/c-*`，但 GitHub 不出现可合并按钮，或点击时被规则拒绝。
- CI `quality` 失败时，D 也不能合并。
- A 的 `/me` PR 需要 `profile` Code Owner 审阅；C 的相遇 PR 需要 `encounter` 审阅；D 的平台 PR 需要 `platform` 的另一位审阅人。
- 只有 D 账号能在所有要求满足后执行 **Squash and merge**。

## 如果没有“Restrict updates”选项

这通常意味着当前 GitHub 方案、组织设置或仓库类型不支持按人限制 `main` 更新。此时不能诚实地声称“只有 D 能合并”：任何拥有 Write/Maintain 且未被规则阻挡的人都可能合并。

可选处理顺序：先确认组织/仓库规则可用性；若仍不可用，再考虑升级方案、改为由 D 代为执行合并，或调整成员权限与协作方式。不要把“CODEOWNERS 文件存在”误认为已实现权限控制。
