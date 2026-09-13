export type RerankApiStyle = 'compatible' | 'dashscope';

export interface RerankLog {
  model: string;
  apiStyle: RerankApiStyle;
  inputCount: number;
  latencyMs: number;
  ok: boolean;
  totalTokens?: number;
  error?: string;
}

export interface RerankResult {
  provider: 'dashscope-rerank';
  model: string;
  apiStyle: RerankApiStyle;
  scores: number[];
  ranking: number[];
}

export interface RerankOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  apiStyle?: RerankApiStyle;
  instruct?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const rerankLogs: RerankLog[] = [];

export function inferRerankApiStyle(model: string): RerankApiStyle {
  return model === 'qwen3-rerank' ? 'compatible' : 'dashscope';
}

function configuredApiStyle(env: NodeJS.ProcessEnv, model: string): RerankApiStyle | null {
  const value = env.RERANK_API_STYLE;
  if (!value) return inferRerankApiStyle(model);
  return value === 'compatible' || value === 'dashscope' ? value : null;
}

export function rerankerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const model = env.RERANK_MODEL || '';
  return Boolean(env.RERANK_BASE_URL && env.RERANK_API_KEY && model && configuredApiStyle(env, model));
}

export function rerankEndpoint(baseUrl: string, apiStyle: RerankApiStyle): string {
  const base = baseUrl.replace(/\/$/, '');
  if (base.endsWith('/reranks') || base.endsWith('/services/rerank/text-rerank/text-rerank')) return base;
  return apiStyle === 'compatible'
    ? `${base}/reranks`
    : `${base}/services/rerank/text-rerank/text-rerank`;
}

export function buildRerankRequest(input: {
  model: string;
  apiStyle: RerankApiStyle;
  query: string;
  documents: string[];
  instruct?: string;
}): Record<string, unknown> {
  const instruction = input.model.startsWith('qwen') && input.instruct
    ? { instruct: input.instruct }
    : {};
  if (input.apiStyle === 'compatible') {
    return {
      model: input.model,
      query: input.query,
      documents: input.documents,
      top_n: input.documents.length,
      ...instruction,
    };
  }
  return {
    model: input.model,
    input: { query: input.query, documents: input.documents },
    parameters: {
      top_n: input.documents.length,
      ...(input.model === 'gte-rerank-v2' || input.model === 'qwen3-vl-rerank'
        ? { return_documents: false }
        : {}),
      ...instruction,
    },
  };
}

interface RawRerankItem {
  index?: unknown;
  relevance_score?: unknown;
}

interface RawRerankPayload {
  results?: RawRerankItem[];
  output?: { results?: RawRerankItem[] };
  usage?: { total_tokens?: unknown };
}

export function parseRerankResponse(
  payload: unknown,
  documentCount: number,
): { scores: number[]; ranking: number[]; totalTokens?: number } {
  const body = payload as RawRerankPayload;
  const results = body?.results ?? body?.output?.results;
  if (!Array.isArray(results) || results.length !== documentCount) {
    throw new Error(`Rerank 响应数量不匹配：期望 ${documentCount}，实际 ${results?.length ?? 0}`);
  }

  const scores: Array<number | null> = new Array(documentCount).fill(null);
  const ranking: number[] = [];
  for (const item of results) {
    const { index, relevance_score: score } = item;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= documentCount) {
      throw new Error(`Rerank 响应包含越界 index：${String(index)}`);
    }
    if (scores[index] !== null) throw new Error(`Rerank 响应包含重复 index：${index}`);
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error(`Rerank 响应包含无效分数：${String(score)}`);
    }
    scores[index] = score;
    ranking.push(index);
  }
  if (scores.some((score) => score === null)) throw new Error('Rerank 响应缺少候选分数');
  const totalTokens = body.usage?.total_tokens;
  return {
    scores: scores.map((score) => score as number),
    ranking,
    ...(typeof totalTokens === 'number' && Number.isFinite(totalTokens) && totalTokens >= 0 ? { totalTokens } : {}),
  };
}

/** 配置缺失、网络失败或响应不完整时返回 null，由匹配管线整批回退。 */
export async function rerankTexts(
  query: string,
  documents: string[],
  options: RerankOptions = {},
): Promise<RerankResult | null> {
  if (!query.trim() || documents.length === 0 || documents.length > 500 || documents.some((item) => !item.trim())) return null;
  const baseUrl = options.baseUrl || process.env.RERANK_BASE_URL || '';
  const apiKey = options.apiKey || process.env.RERANK_API_KEY || '';
  const model = options.model || process.env.RERANK_MODEL || '';
  const apiStyle = options.apiStyle || configuredApiStyle(process.env, model);
  if (!baseUrl || !apiKey || !model || !apiStyle) return null;

  const started = Date.now();
  try {
    const response = await (options.fetchImpl || fetch)(rerankEndpoint(baseUrl, apiStyle), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildRerankRequest({ model, apiStyle, query, documents, instruct: options.instruct })),
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    });
    if (!response.ok) throw new Error(`Rerank HTTP ${response.status}`);
    const parsed = parseRerankResponse(await response.json(), documents.length);
    rerankLogs.push({
      model, apiStyle, inputCount: documents.length, latencyMs: Date.now() - started, ok: true,
      ...(parsed.totalTokens === undefined ? {} : { totalTokens: parsed.totalTokens }),
    });
    return { provider: 'dashscope-rerank', model, apiStyle, scores: parsed.scores, ranking: parsed.ranking };
  } catch (error) {
    rerankLogs.push({
      model, apiStyle, inputCount: documents.length, latencyMs: Date.now() - started, ok: false,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 200),
    });
    return null;
  }
}
