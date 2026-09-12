# 模块所有权与冲突边界

## 默认所有权

| 角色 | 可独立修改 | 只读依赖 |
| --- | --- | --- |
| A 画像产品 | `app/profile/**`、`app/me/**`、`lib/profile/**`、`lib/ai/profile.ts` | 数据库、Provider、匹配模块 |
| B 匹配产品 | `app/encounter/**`、`app/connect/**`、`app/connections/**`、`app/api/encounters/**`、`app/api/connections/**`、`lib/retrieval/**`、`lib/ai/bridge.ts` | 画像引擎、认证、数据库 Schema |
| C 平台后端 | `lib/db/**`、`lib/providers/**`、`lib/session.ts`、`app/api/auth/**`、`drizzle/**`、平台脚本 | 页面视觉与品牌资产 |
| D 发布展示 | `app/page.tsx`、`app/onboarding/**`、`public/**`、`.github/**`、演示与发布文档 | 业务算法、数据库实现 |

## 冻结区

以下路径不能作为业务任务的附带修改：

- `package.json`、`package-lock.json`、`tsconfig.json`、`next.config.mjs`
- `app/globals.css`、`components/**`
- `lib/contracts/**`、`lib/db/schema.ts`、`drizzle/**`
- `.env.example`、`docker-compose.yml`、`.github/**`

确需修改时，先建独立契约/基础设施 Issue，由 C 和受影响模块共同审阅。功能专属组件放在对应路由目录，验证复用价值后再迁入公共组件。

## 接口变更流程

1. 在 Issue 中写出现有输入输出、目标输入输出和兼容策略。
2. 先合并只包含契约/迁移的 PR。
3. 各业务分支同步 `main` 后再实现。
4. 删除或重命名字段必须经过负责人确认，并在同一轮更新文档和测试。

代码所有权由 `.github/CODEOWNERS` 强制；Organization Team 名称固定为 `platform/profile/encounter/release`。
