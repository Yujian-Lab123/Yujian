# P6 · Qwen Reranker 真实精排

## 交付结论

P6 代码已经完成：P3 算法粗排后的候选会在配置真实服务时送入 Qwen 文本排序模型，模型相关性分替换原来的 Mock Rerank 分，再按既有契约计算：

```text
Final = 0.55 × ModelRerank + 0.45 × Mutual
```

未配置、画像读取失败、HTTP 超时、模型报错、响应缺项、索引重复或分数越界时，整批保留原来的 Mock Rerank，不会混用部分真实分数。现有页面字段和 Demo A / B 均保持兼容。

本轮没有安装依赖，也没有调用真实付费接口。

## Provider 协议

`lib/providers/reranker.ts` 同时兼容百炼当前两类文本排序 HTTP 协议：

| 模型 | API 风格 | 请求路径 | 响应结果位置 |
| --- | --- | --- | --- |
| `qwen3-rerank` | `compatible` | `/compatible-api/v1/reranks` | 顶层 `results` |
| `qwen3.7-text-rerank` | `dashscope` | `/api/v1/services/rerank/text-rerank/text-rerank` | `output.results` |
| `gte-rerank-v2` | `dashscope` 兼容 | 同上 | `output.results` |

当前优先推荐 `qwen3-rerank`。阿里云官方文档已提示 GTE Rerank 下线，因此项目只保留旧配置兼容，不建议新接入继续使用。

## 输入与隐私边界

Reranker 只接收：

- 用户角色、自述、标签和认识意愿；
- P4 结构化画像中的一句话概述、核心观察、长期关切、驱动力、价值取舍和对话风格；
- 浏览者仍有效的此刻状态。

不会发送原始知乎正文、证据摘录、URL、内部向量、用户 ID 或密钥。每个 Query/Document 截断至 1,800 字符。

默认只精排 P3 前 20 名，可通过 `RERANK_CANDIDATE_LIMIT` 调整，代码硬上限为 50。若粗排 Top-N 之外存在 `current >= 0.55` 的强“此刻遇见”候选，会替换最后一个席位进入模型精排。

## 配置

在服务器端 `.env.local` 手动追加以下配置，不要提交真实密钥（本轮没有改动冻结的 `.env.example`）：

```text
RERANK_BASE_URL=https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-api/v1
RERANK_API_KEY=
RERANK_MODEL=qwen3-rerank
RERANK_API_STYLE=compatible
RERANK_CANDIDATE_LIMIT=20
```

使用 `qwen3.7-text-rerank` 时，将 Base URL 改为对应地域的 `/api/v1`，并将 `RERANK_API_STYLE` 设为 `dashscope`。未填写 API Style 时，代码会按模型自动推断。

## 在线链路

```text
P1 Hard Filter
  → P5 ANN / 内存多路召回
  → P3 Algorithmic Ranking
  → P6 结构化画像 Top-N Rerank
  → 0.55 × Rerank + 0.45 × Mutual
  → Deep Match / Content Bridge
```

推荐输出及数据库 `bridge` 调试信息新增：

- `rerank_mode: "model" | "mock"`
- `rerank_model`：真实模型成功时返回
- `rerank_api_style`：只保存在服务端调试字段

模型官方说明指出 `relevance_score` 是单次请求内的相对分数，不用于跨请求绝对比较。本实现只在同一批候选内排序和融合。协议依据：[阿里云百炼文本排序 API](https://help.aliyun.com/zh/model-studio/text-rerank-api)；模型选择依据：[向量与重排序模型](https://help.aliyun.com/zh/model-studio/embedding-rerank-model)。

## 关键文件

- `lib/providers/reranker.ts`：双协议 Provider、超时、严格响应校验、脱敏日志。
- `lib/retrieval/model-rerank.ts`：结构化文本压缩、候选池和模型分融合纯函数。
- `lib/retrieval/profile-context.ts`：按用户读取最新 P4 画像。
- `lib/retrieval/rerank-pipeline.ts`：真实精排与整批 Mock 回退编排。
- `lib/retrieval/matcher.ts`：接入主链并输出精排模式。
- `scripts/verify-p6.mjs`：无需依赖和真实 API 的离线验收。

## 验收边界

离线验证：

```bash
node --experimental-strip-types scripts/verify-p6.mjs
```

覆盖两类请求体、两类响应、原索引对齐、异常拒绝、结构化画像隐私边界、模型分融合和 Current State 精排席位。完整 `npm run check` 仍需要项目先安装 `node_modules`；真实接口的延迟、费用、限流和排序效果需要在取得用户授权及 API Key 后单独联调。
