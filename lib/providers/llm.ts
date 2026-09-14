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

/**
 * 流式长任务开关（默认 on）。
 * 背景：部分网关（如 Cloudflare 前置的中转站）对**非流式**请求有约 100 秒硬超时，
 * 超时返回 524 HTML 错误页而非 JSON。改走 SSE 后首个分块很快返回，连接即被保住，
 * 总时长不再受限，因此长输出（如画像综合层）必须走流式。
 * 网关不支持 SSE 时设 LLM_STREAM=off 可全局回退非流式。
 */
export function streamRequestEnabled(): boolean {
  return (process.env.LLM_STREAM ?? 'on').trim().toLowerCase() !== 'off';
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
  /** 走 SSE 流式累积输出，规避网关的非流式时长上限。长输出任务应开启。 */
  stream?: boolean;
}

// ---- 流式（SSE）----
// 目的：绕过网关对非流式请求的时长上限（中转站实测约 100s 后被 Cloudflare 以 524 掐断）。
// 首块很快到达即保住连接，总时长由模型本身决定，因此长输出任务（画像综合层）可稳定跑完。

/** 取单条 SSE 事件的增量文本（OpenAI 兼容：choices[0].delta.content）。心跳/注释/非 JSON 分片返回空串。 */
export function sseEventText(event: string): string {
  const payload = event.trim();
  if (!payload || payload === '[DONE]') return '';
  try {
    const data = JSON.parse(payload);
    const choice = data?.choices?.[0];
    // 少数网关即使流式也用 message 而不用 delta，一并兼容
    const piece = choice?.delta ?? choice?.message;
    return typeof piece?.content === 'string' ? piece.content : '';
  } catch {
    return '';
  }
}

/**
 * 消费 SSE 流并拼接正文。
 * 分块边界可能切断 SSE 行、甚至切断一个多字节汉字，因此按行缓冲 + TextDecoder stream 模式解码。
 * 网关忽略 stream 参数直接返回整包 JSON 时走 JSON 兜底。
 */
export async function streamCompletion(url: string, init: RequestInit, payload: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(url, { ...init, body: JSON.stringify({ ...payload, stream: true }) });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('event-stream')) {
    const data = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text : null;
  }

  const reader = res.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ''; // 末行可能被截断，留到下一块再处理
      for (const line of lines) if (line.startsWith('data:')) text += sseEventText(line.slice(5));
    }
    buffer += decoder.decode();
    if (buffer.startsWith('data:')) text += sseEventText(buffer.slice(5));
  } finally {
    try { reader.releaseLock(); } catch { /* 流已异常终止 */ }
  }
  return text || null;
}

function logSuccess(model: string, started: number, text: string): string {
  llmLogs.push({ model, latencyMs: Date.now() - started, ok: true, promptVersion: 'v1' });
  return text;
}

export async function chatCompletion(system: string, user: string, opts?: ChatOpts): Promise<string | null> {
  if (!llmConfigured()) return null;
  const started = Date.now();
  const model = opts?.model || process.env.LLM_MODEL || 'default';
  const base = (opts?.baseUrl || process.env.LLM_BASE_URL || '').replace(/\/$/, '');
  const url = `${base}/chat/completions`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    'api-key': String(process.env.LLM_API_KEY), // MiMo curl 协议兼容
  };
  // 一次请求的共享预算：流式与非流式回退合计不超过 timeoutMs
  const signal = opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;
  const payload: Record<string, unknown> = {
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
  };
  const streamFailures: string[] = [];

  try {
    if (opts?.stream && streamRequestEnabled()) {
      try {
        const text = await streamCompletion(url, { method: 'POST', headers, signal }, payload);
        if (text) return logSuccess(model, started, text);
        streamFailures.push('流式响应无内容');
      } catch (e: unknown) {
        // 网关不支持 SSE 或流中途中止时回退非流式，避免整体失败
        streamFailures.push(String((e as Error)?.message || e));
      }
    }

    const res = await fetch(url, { method: 'POST', headers, signal, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('LLM 响应缺少 content');
    return logSuccess(model, started, text);
  } catch (e: any) {
    const message = String(e?.message || e);
    llmLogs.push({
      model,
      latencyMs: Date.now() - started,
      ok: false,
      error: streamFailures.length ? `${message}（流式先失败:${streamFailures.join('；')}）` : message,
      promptVersion: 'v1',
    });
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
