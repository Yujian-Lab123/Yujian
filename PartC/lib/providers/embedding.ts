import { createHash } from 'node:crypto';

// ============ Embedding Provider（OpenAI 兼容协议） ============
// P4 生成真实向量，P5 以固定维度同步到 pgvector / ANN 检索。
// 未配置或调用失败时返回 null，由画像管线保留可读产物并继续使用现有 Mock 匹配。

export interface EmbeddingLog {
  model: string;
  inputCount: number;
  dimensions: number | null;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface EmbeddingResult {
  provider: 'openai-compatible';
  model: string;
  spaceId: string;
  dimensions: number;
  vectors: number[][];
}

export interface EmbedOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  batchSize?: number;
  timeoutMs?: number;
  dimensions?: number;
  fetchImpl?: typeof fetch;
}

export const embeddingLogs: EmbeddingLog[] = [];
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export function embeddingConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.EMBED_BASE_URL && env.EMBED_API_KEY && env.EMBED_MODEL);
}

export function configuredEmbeddingDimensions(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.EMBED_DIMENSIONS || DEFAULT_EMBEDDING_DIMENSIONS);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 2_000
    ? parsed
    : DEFAULT_EMBEDDING_DIMENSIONS;
}

/** 服务端、模型或维度任一变化都视为不同向量空间，避免增量更新混用不可比较的向量。 */
export function embeddingSpaceId(baseUrl: string, model: string, dimensions = DEFAULT_EMBEDDING_DIMENSIONS): string {
  return createHash('sha256')
    .update(`${baseUrl.replace(/\/$/, '')}\u0000${model}\u0000${dimensions}`)
    .digest('hex')
    .slice(0, 24);
}

function finiteVector(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    && value.some((item) => item !== 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 批量生成向量。响应按 data[index] 复原输入顺序，并严格校验数量、维度和有限数值。
 * 日志只记录模型、耗时、数量和错误摘要，不记录输入文本或密钥。
 */
export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<EmbeddingResult | null> {
  if (texts.length === 0) return null;

  const baseUrl = (opts.baseUrl || process.env.EMBED_BASE_URL || '').replace(/\/$/, '');
  const apiKey = opts.apiKey || process.env.EMBED_API_KEY || '';
  const model = opts.model || process.env.EMBED_MODEL || '';
  if (!baseUrl || !apiKey || !model) return null;
  const requestedDimensions = opts.dimensions ?? configuredEmbeddingDimensions();
  if (!Number.isInteger(requestedDimensions) || requestedDimensions <= 0 || requestedDimensions > 2_000) return null;

  const started = Date.now();
  const fetchImpl = opts.fetchImpl || fetch;
  const requestedBatchSize = opts.batchSize ?? 64;
  const batchSize = Number.isFinite(requestedBatchSize)
    ? Math.max(1, Math.min(128, Math.floor(requestedBatchSize)))
    : 64;
  const vectors: number[][] = [];
  let dimensions: number | null = null;

  try {
    for (let offset = 0; offset < texts.length; offset += batchSize) {
      const input = texts.slice(offset, offset + batchSize);
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'api-key': apiKey,
        },
        body: JSON.stringify({ model, input, encoding_format: 'float', dimensions: requestedDimensions }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      });
      if (!response.ok) throw new Error(`Embedding HTTP ${response.status}`);

      const payload = await response.json() as { data?: Array<{ index?: number; embedding?: unknown }> };
      if (!Array.isArray(payload.data) || payload.data.length !== input.length) {
        throw new Error(`Embedding 响应数量不匹配：期望 ${input.length}，实际 ${payload.data?.length ?? 0}`);
      }

      const ordered = [...payload.data].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
      for (let index = 0; index < ordered.length; index++) {
        const item = ordered[index];
        if (item.index !== undefined && item.index !== index) {
          throw new Error(`Embedding 响应 index 不连续：期望 ${index}，实际 ${item.index}`);
        }
        if (!finiteVector(item.embedding)) throw new Error(`Embedding 响应第 ${index} 项不是有效向量`);
        if (dimensions === null) dimensions = item.embedding.length;
        if (item.embedding.length !== dimensions) {
          throw new Error(`Embedding 向量维度不一致：期望 ${dimensions}，实际 ${item.embedding.length}`);
        }
        if (item.embedding.length !== requestedDimensions) {
          throw new Error(`Embedding 向量维度不匹配：请求 ${requestedDimensions}，实际 ${item.embedding.length}`);
        }
        vectors.push(item.embedding);
      }
    }

    if (dimensions === null || vectors.length !== texts.length) throw new Error('Embedding 响应不完整');
    embeddingLogs.push({ model, inputCount: texts.length, dimensions, latencyMs: Date.now() - started, ok: true });
    return {
      provider: 'openai-compatible',
      model,
      spaceId: embeddingSpaceId(baseUrl, model, requestedDimensions),
      dimensions,
      vectors,
    };
  } catch (error) {
    embeddingLogs.push({
      model,
      inputCount: texts.length,
      dimensions,
      latencyMs: Date.now() - started,
      ok: false,
      error: errorMessage(error).slice(0, 200),
    });
    return null;
  }
}
