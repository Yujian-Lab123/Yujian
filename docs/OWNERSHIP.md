# 模块所有权与冲突边界

## 产品边界优先于技术边界

`/profile`（长期人物画像）、`/me`（Present Self）、`/side`（Contextual Persona）和 `/encounter`（相遇）是四个独立体验。它们可以读取同一用户的已授权数据，但不能通过复制 UI、跨目录编辑或共享原文来“强行整合”。

当前 B 暂时离开，D 临时代管 B 的目录；恢复人员后只需把 B 的目录交接出去，不需要拆页面或改数据库。

| 角色 | 负责页面 / 模块 | 可以独立修改 | 只读依赖 |
| --- | --- | --- | --- |
| A：Present Self | `/me`、当前状态 | `app/me/**`、`app/api/me/**`、`lib/useMe.ts`、`lib/present-self/**` | 长期画像、侧面、匹配、数据库 Schema |
| B：Contextual Persona（当前由 D 代管） | `/side` | `app/side/**`、`lib/contextual-persona.ts`、`lib/contextual-persona.test.ts` | `/me`、`/profile`、匹配器、数据库 |
| C：Encounter + Matching | `/encounter`、了解 TA、连接闭环 | `app/encounter/**`、`app/connect/**`、`app/connections/**`、`app/api/encounters/**`、`app/api/connections/**`、`lib/retrieval/**`、`lib/ai/bridge.ts` | 状态原文、画像引擎、认证、数据库 Schema |
| D：产品总控 / 基座 / 集成 | Landing、引导、长期画像、共享平台 | `app/page.tsx`、`app/onboarding/**`、`app/profile/**`、`app/api/profile/**`、`lib/profile/**`、`lib/db/**`、`lib/providers/**`、`lib/session.ts`、`app/api/auth/**`、`drizzle/**`、`public/**`、发布文档 | A/B/C 的业务页面细节 |

## 明确禁止的重叠

- A 不修改 `/side` 的解释规则；B/D 不修改 `/me` 的记录表单和状态写入接口。
- C 可读取 `current` 向量参与匹配，但不读取、存储到推荐表或展示 `currentState.text` 原文。
- D 维护 `/profile` 的长期画像；`/side` 只消费长期理解摘要，不能把一整套画像地图复制过去。
- 任何角色需要新字段、新接口、新依赖或迁移时，先开一个只讨论契约的 Issue，由 D 合并。

## 冻结区

以下路径不能作为业务功能的附带修改：

- `package.json`、`package-lock.json`、`tsconfig.json`、`next.config.mjs`
- `app/globals.css`、`components/**`
- `lib/contracts/**`、`lib/db/schema.ts`、`drizzle/**`
- `.env.example`、`docker-compose.yml`、`.github/**`

确需变更时，由 D 新建独立基础设施/契约 Issue；受影响模块必须审阅。功能专属组件优先留在对应路由目录，验证复用价值后再迁入 `components/**`。

## GitHub CODEOWNERS 对应关系

仓库当前使用的 Team 名称为 `profile / encounter / platform / release`：

| 产品角色 | 临时 GitHub Team | 备注 |
| --- | --- | --- |
| A：Present Self | `profile` | Team 名称沿用，不代表可修改长期画像页 |
| B：Contextual Persona | `release` | D 暂代；B 加入后应创建或改为专用 Team |
| C：Encounter + Matching | `encounter` | 只覆盖相遇流程 |
| D：共享平台 | `platform` | D 是最终合并人 |
| D：Landing / 长期画像 / 演示 | `release` | 独立于 A/B/C 的业务交付 |

在 GitHub 中启用“Require review from Code Owners”前，组织管理员必须先确认上述 Teams 已创建、已获得仓库访问权限且包含对应成员；否则 CODEOWNERS 只是文档化映射，不是有效保护。

## 接口变更流程

1. 在 Issue 写出现有输入输出、目标输入输出、隐私影响和兼容策略。
2. 先合并只包含契约/迁移的 PR。
3. 各业务分支同步 `main` 后再实现。
4. 删除或重命名字段必须经过 D 确认，并在同一轮更新文档和测试。
