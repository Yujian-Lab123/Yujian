import { z } from 'zod';

// ============ LLM Provider（OpenAI 兼容协议） ============
// 配置了 LLM_API_KEY 时调用真实模型（mimo / DashScope / DeepSeek 均可）；
// 未配置或调用失败时，调用方回退到 Mock 实现，保证 Demo 始终可跑（概览工程原则 5）。

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
}

export interface LLMLog { model: string; latencyMs: number; ok: boolean; error?: string; promptVersion: string }
export const llmLogs: LLMLog[] = [];

export async function chatCompletion(system: string, user: string, opts?: { json?: boolean; model?: string }): Promise<string | null> {
  if (!llmConfigured()) return null;
  const started = Date.now();
  const model = opts?.model || process.env.LLM_MODEL || 'default';
  try {
    const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
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
        temperature: 0.7,
        max_completion_tokens: 2000, // mimo 等推理模型需预留 reasoning 空间
        ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
      }),
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

/** 让 LLM 输出符合 zod schema 的 JSON；失败返回 null（调用方回退 Mock） */
export async function chatJSON<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T | null> {
  const raw = await chatCompletion(system, user, { json: true });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
