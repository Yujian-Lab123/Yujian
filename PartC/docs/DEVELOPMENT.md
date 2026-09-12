# 本地开发与故障排查

## 环境要求

- Git
- Node.js 24+
- Docker Desktop，并启用 `docker compose`

## 首次启动

```bash
git clone https://github.com/Yujian-Lab123/Yujian.git
cd Yujian
npm ci
npm run bootstrap
npm run dev
```

`bootstrap` 会按需创建 `.env.local`、启动 PostgreSQL、等待健康检查、执行 Drizzle 迁移、写入幂等 Mock 数据，并复制一份可用于画像测试的虚构样例。它可以安全重复执行。

访问：

- Web：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`
- PostgreSQL：`localhost:54329`

`npm run dev` 同时启动 Next.js 和画像 Worker。未配置 LLM/OAuth 时使用 Mock；新成员不需要任何密钥即可开发。

目录结构和「从哪里读起」见 `docs/STRUCTURE.md`。

## 常用命令

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:down
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

只有 C 可以运行 `npm run db:generate` 并提交新迁移。`db:down` 保留数据卷；任何删除数据卷的操作都必须先确认目标和备份需求。

## 常见问题

- `54329` 被占用：联系 C 统一调整 compose 与 `.env.example`，不要个人提交不同端口。
- 数据库连接失败：确认 Docker Desktop 已启动，再重复执行 `npm run bootstrap`。
- 页面可开但画像任务不动：确认终端中同时存在 `web` 和 `worker` 输出，并查看 `/api/health`。
- 改 Schema 后报错：不要手改数据库；让 C 生成并合并迁移，然后重新同步 `main`。
