# C · 平台后端（负责人）

目标：维护 PostgreSQL、认证、外部数据源、任务系统和共享接口，保障其他角色可并行开发。

- 可修改：`lib/db/**`、`lib/providers/**`、`lib/session.ts`、认证 API、`drizzle/**` 和平台脚本。
- 独占：数据库迁移、依赖变更、环境变量和公共契约合并。
- 责任：审阅共享文件 PR；维护 Mock 与真实数据源兼容；保证迁移幂等；处理跨模块集成。
- 验收：Clone 可运行；会话有过期/撤销；Token 加密；任务可恢复；接口错误不泄露密钥。
- 检查：`npm run check`、`npm run audit:prod`、重复执行 bootstrap，并验证 `/api/health`。
