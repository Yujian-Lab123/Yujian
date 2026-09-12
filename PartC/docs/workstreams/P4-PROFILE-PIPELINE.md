# P4 · 真实 Profile Pipeline

P4 在既有两阶段画像引擎上补齐以下链路：

```text
Raw Content
  → 清洗 / 归一化
  → 长文分块
  → 便宜模型逐内容摘要 + 线索提取（Zod 校验）
  → 主模型六维画像综合（Zod 校验 + 证据消毒）
  → 真实 Embedding
  → 文件 / profile_artifacts 保存
```

## 实现范围

- `lib/providers/embedding.ts`：OpenAI 兼容 `/embeddings` Adapter；支持批量请求、超时、顺序恢复、数量/维度/有限数值校验和脱敏日志。
- `lib/profile/incremental.ts`：内容稳定哈希、added/changed/unchanged/removed 差异检测、无损分块和内容向量输入构造。
- `lib/profile/prompt.ts`：抽取阶段升级为“逐内容摘要 + topics + key questions + candidates”，提示词版本升级为 `profile-v2-p4`。
- `lib/profile/engine.ts`：复用旧产物中未变化内容的摘要/线索和向量；内容全部未变时跳过 LLM 综合；内容变化时只重新摘要新增/修改项，然后基于完整证据重新综合画像。
- CLI 和画像 Worker 会按人物 slug 自动读取上一版产物，再执行增量更新。

## 产物兼容性

`ProfileArtifact.schema_version` 仍为 1，新增字段均为可选字段：

- `content_analyses`：逐内容摘要、主题、关键问题、线索和 `source_hash`；
- `embeddings`：`long_term/value/conversation` 三个 Profile 向量，以及每篇内容向量；`space_id` 防止切换服务端后误复用同名模型的旧向量；
- `meta.incremental`：本轮新增、修改、未变、删除和复用统计；
- `meta.embedding`：generated/reused/not_configured/failed 状态，不包含密钥和输入正文。

旧画像产物仍可读取。第一次以 P4 提示词运行时会重建摘要缓存；后续运行才进入增量复用。

## 配置与降级

真实向量沿用已有服务器端环境变量：

```text
EMBED_BASE_URL
EMBED_API_KEY
EMBED_MODEL
```

未配置 Embedding 时，画像生成仍完成，并明确记录 `not_configured`；当前 16 维 Mock 匹配保持不变。调用失败、响应数量不一致、向量非有限数或维度混杂时，不保存不完整向量，状态记录为 `failed`。

P4 只产出并保存真实向量。将真实向量写入 pgvector、ANN 召回和线上匹配属于 P5，避免真实高维向量与现有 16 维 Mock 概念轴混用。

## 增量规则

内容哈希覆盖 id、类型、标题、日期、URL 和参与分析的正文。再次分析时：

- 未变化内容：直接复用摘要、候选线索和同模型向量；
- 新增/修改内容：只调用便宜模型处理这些内容；
- 删除内容：从新产物移除，并触发画像重新综合；
- 全部未变：跳过抽取与主模型综合；
- 提示词版本改变：旧摘要不复用，防止新旧口径混杂。

若内容发生变化但 LLM 未配置或抽取失败，任务失败且不会覆盖上一版画像。

## 验证

无需安装依赖的离线验证：

```bash
node --experimental-strip-types scripts/verify-p4.mjs
```

覆盖：内容差异检测、长文无损分块、Embedding 分批与响应顺序恢复、混杂维度拒绝。另有 Vitest 用例：

- `lib/profile/incremental.test.ts`
- `lib/providers/embedding.test.ts`

完整 `npm run check` 仍要求先存在 `node_modules`，本轮没有安装依赖。
