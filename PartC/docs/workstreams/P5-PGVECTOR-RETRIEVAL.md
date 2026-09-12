# P5 · pgvector / ANN 真实检索

## 交付结论

P5 的仓库代码已经完成：P4 生成的 1024 维真实 Embedding 会幂等写入统一向量表，在线匹配优先使用 PostgreSQL + pgvector 的 HNSW 余弦 ANN 多路召回；扩展、迁移、向量或外部服务尚未就绪时自动回退原有 16 维内存召回，现有 Demo A / B 保持可运行。

本轮只提交代码和迁移文件，没有安装依赖、启动容器、执行迁移或调用真实 Embedding 服务。

## 数据契约

`retrieval_embeddings` 统一保存五类向量：

| kind | 来源 | 生命周期 |
| --- | --- | --- |
| `profile_long_term` | P4 长期画像文档 | 画像更新时覆盖 |
| `profile_value` | P4 价值问题文档 | 画像更新时覆盖 |
| `profile_conversation` | P4 对话风格文档 | 画像更新时覆盖 |
| `profile_current` | 用户此刻状态文本 | 与状态相同，默认 72 小时 |
| `content` | P4 逐内容摘要、主题与关键问题 | 内容删除后同步清理 |

- 固定维度：1024；`EMBED_DIMENSIONS` 必须保持为 `1024`。
- `space_id` 由服务地址、模型名和维度共同计算，防止不同模型空间混排。
- `(user_id, kind, source_id)` 唯一，画像 Worker 可安全重复同步。
- HNSW 使用 `vector_cosine_ops`；`space_id / kind / user_id` 另有 B-tree 过滤索引。

## 在线链路

```text
P1 Hard Filter
  → 读取浏览者可用的真实画像向量
  → long_term / value / conversation / current 各自 HNSW Top-K
  → 按用户合并 recall_sources / recall_scores
  → 读取命中候选的同空间向量
  → P3 Ranking / Mutual / Bridge
```

只有真实 ANN 至少命中一个候选时才切换为 `retrieval_mode: "pgvector"`；否则使用 `retrieval_mode: "memory"`。模式与每路召回轨迹同时写入推荐记录的 `bridge` 调试字段，并通过 `RecCard` 返回。

## 关键文件

- `drizzle/0002_p5_pgvector.sql`：安装 vector 扩展、建表、约束和 HNSW 索引。
- `lib/db/schema.ts`：Drizzle 的固定维度向量列契约。
- `lib/db/vector-index.ts`：画像/此刻状态同步，以及四路 ANN 查询。
- `lib/retrieval/pgvector.ts`：安全向量序列化与 ANN 多路合并纯函数。
- `lib/retrieval/matcher.ts`：优先 ANN、失败自动回退的在线编排。
- `scripts/verify-p5.mjs`：无需数据库的 P5 静态与纯函数验收。

## 启用真实链路

由维护者在具备 Node.js 24、Docker 与真实密钥的环境中执行：

```bash
npm ci
npm run db:up
npm run db:migrate
npm run dev
```

随后配置 `EMBED_BASE_URL / EMBED_API_KEY / EMBED_MODEL / EMBED_DIMENSIONS=1024`，重新生成有关联用户的 P4 画像。Worker 会在保存画像后同步向量索引；新提交的此刻状态也会同步并带过期时间。

## 验收与边界

已通过：

```bash
node --experimental-strip-types scripts/verify-p4.mjs
node --experimental-strip-types scripts/verify-p5.mjs
```

未执行完整 `npm run check`，原因是当前副本没有 `node_modules`；未运行数据库集成测试，因为本轮明确不安装依赖、不执行迁移。P5 只替换候选召回；真实 Reranker 属于 P6，现有 Content Bridge 仍保留 Mock 轴向量兼容路径。

实现依据：Drizzle 的 pgvector 扩展说明要求在自定义迁移中显式创建扩展；pgvector 官方文档定义了 HNSW、余弦距离 `<=>`、`vector_cosine_ops` 与 iterative scan。
