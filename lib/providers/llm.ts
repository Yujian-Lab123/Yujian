import { z } from 'zod';

// ============ LLM Provider（OpenAI 兼容协议） ============
// 配置了 LLM_API_KEY 时调用真实模型（mimo / DashScope / DeepSeek 均可）；
// 未配置或调用失败时，调用方回退到 Mock 实现，保证 Demo 始终可跑（概览工程原则 5）。

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
}

/**
 * 部分网关（如 Sealos 实测）不支持 response_format，会直接 400。
 * 设 LLM_JSON_RESPONSE_FORMAT=off 时不发送该字段，改由提示词约束 + chatJSON 容错解析。
 */
export function jsonResponseFormatEnabled(): boolean {
  return (process.env.LLM_JSON_RESPONSE_FORMAT ?? 'on').trim().toLowerCase() !== 'off';
}

export interface LLMLog { model: string; latencyMs: number; ok: boolean; error?: string; promptVersion: string }
export const llmLogs: LLMLog[] = [];

export interface ChatOpts {
  json?: boolean;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  baseUrl?: string;
  /** Qwen 等混合思考模型可显式关闭思考，减少结构化抽取的延迟和费用。 */
  thinking?: boolean;
}

export async function chatCompletion(system: string, user: string, opts?: ChatOpts): Promise<string | null> {
  if (!llmConfigured()) return null;
  const started = Date.now();
  const model = opts?.model || process.env.LLM_MODEL || 'default';
  const base = (opts?.baseUrl || process.env.LLM_BASE_URL || '').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        'api-key': String(process.env.LLM_API_KEY), // MiMo curl 协议兼容
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: opts?.temperature ?? 0.7,
        // 双字段兼容:MiMo 等认 max_completion_tokens,DeepSeek/Qwen 等认 max_tokens;多余字段多数服务端忽略
        max_completion_tokens: opts?.maxTokens ?? 2000, // mimo 等推理模型需预留 reasoning 空间
        max_tokens: opts?.maxTokens ?? 2000,
        ...(typeof opts?.thinking === 'boolean' ? { enable_thinking: opts.thinking } : {}),
        ...(opts?.json && jsonResponseFormatEnabled() ? { response_format: { type: 'json_object' } } : {}),
      }),
      ...(opts?.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('LLM 响应缺少 content');
    llmLogs.push({ model, latencyMs: Date.now() - started, ok: true, promptVersion: 'v1' });
    return text;
  } catch (e: any) {
    llmLogs.push({ model, latencyMs: Date.now() - started, ok: false, error: String(e?.message || e), promptVersion: 'v1' });
    return null;
  }
}

/** 兼容模型不带 response_format 时的输出：剥离 ```json 围栏，回退取首个 {...} 块。 */
export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (body.startsWith('{') || body.startsWith('[')) return body;
  const start = body.search(/[{[]/);
  if (start === -1) return body;
  const openChar = body[start];
  const closeChar = openChar === '{' ? '}' : ']';
  const end = body.lastIndexOf(closeChar);
  return end > start ? body.slice(start, end + 1) : body;
}

/** 让 LLM 输出符合 zod schema 的 JSON；失败返回 null（调用方回退 Mock） */
export async function chatJSON<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T | null> {
  const raw = await chatCompletion(system, user, { json: true });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(extractJsonPayload(raw));
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
