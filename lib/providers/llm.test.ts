import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractJsonPayload,
  jsonResponseFormatEnabled,
  sseEventText,
  streamCompletion,
  streamRequestEnabled,
} from './llm';

const previous = process.env.LLM_JSON_RESPONSE_FORMAT;
const previousStream = process.env.LLM_STREAM;

afterEach(() => {
  if (previous === undefined) delete process.env.LLM_JSON_RESPONSE_FORMAT;
  else process.env.LLM_JSON_RESPONSE_FORMAT = previous;
  if (previousStream === undefined) delete process.env.LLM_STREAM;
  else process.env.LLM_STREAM = previousStream;
  vi.unstubAllGlobals();
});

describe('llm json gateway compatibility', () => {
  it('parses bare json output', () => {
    expect(extractJsonPayload('{"a":1}')).toBe('{"a":1}');
  });

  it('strips markdown code fences', () => {
    const fenced = '以下是结果：\n```json\n{"reason":"内容很对味"}\n```\n';
    expect(extractJsonPayload(fenced)).toBe('{"reason":"内容很对味"}');
  });

  it('extracts the outermost object when prose wraps the payload', () => {
    const noisy = '结论 {"a":{"b":2}} 完毕';
    expect(extractJsonPayload(noisy)).toBe('{"a":{"b":2}}');
  });

  it('keeps arrays intact', () => {
    expect(extractJsonPayload('```json\n[1,2]\n```')).toBe('[1,2]');
  });

  it('response_format defaults to enabled and honors the off switch', () => {
    delete process.env.LLM_JSON_RESPONSE_FORMAT;
    expect(jsonResponseFormatEnabled()).toBe(true);
    process.env.LLM_JSON_RESPONSE_FORMAT = 'off';
    expect(jsonResponseFormatEnabled()).toBe(false);
    process.env.LLM_JSON_RESPONSE_FORMAT = 'ON';
    expect(jsonResponseFormatEnabled()).toBe(true);
  });
});

describe('llm streaming compatibility', () => {
  function sseResponse(chunks: Uint8Array[]): Response {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }

  it('stream defaults to enabled and honors the off switch', () => {
    delete process.env.LLM_STREAM;
    expect(streamRequestEnabled()).toBe(true);
    process.env.LLM_STREAM = 'off';
    expect(streamRequestEnabled()).toBe(false);
    process.env.LLM_STREAM = 'OFF';
    expect(streamRequestEnabled()).toBe(false);
    process.env.LLM_STREAM = 'on';
    expect(streamRequestEnabled()).toBe(true);
  });

  it('extracts delta content and ignores keep-alives, [DONE] and malformed events', () => {
    expect(sseEventText('{"choices":[{"delta":{"content":"你好"}}]}')).toBe('你好');
    expect(sseEventText(' [DONE] ')).toBe('');
    expect(sseEventText('')).toBe('');
    expect(sseEventText('not-json')).toBe('');
    // 思考分片只有 reasoning_content 时不应混入正文
    expect(sseEventText('{"choices":[{"delta":{"reasoning_content":"想想"}}]}')).toBe('');
    // 少数网关流式也返回 message
    expect(sseEventText('{"choices":[{"message":{"content":"整段"}}]}')).toBe('整段');
  });

  it('reassembles deltas even when chunks split SSE lines and multi-byte characters', async () => {
    const events = [
      'data: {"choices":[{"delta":{"content":"你好，"}}]}\n\n',
      ': keep-alive\n\n',
      'data: {"choices":[{"delta":{"content":"画像"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const bytes = new TextEncoder().encode(events.join(''));
    // 每 7 字节切一刀：会切断 SSE 行，也会把一个汉字切成两半
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.slice(i, i + 7));
    let capturedBody: unknown = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: { body?: string }) => {
      capturedBody = init?.body ? JSON.parse(init.body) : null;
      return sseResponse(chunks);
    }));

    expect(await streamCompletion('https://example.test/v1/chat/completions', {}, { model: 'm' })).toBe('你好，画像');
    // 必须真的带上 stream:true，否则网关仍按非流式超时
    expect(capturedBody).toMatchObject({ model: 'm', stream: true });
  });

  it('falls back to a plain json body when the gateway ignores the stream flag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: '整包返回' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    expect(await streamCompletion('https://example.test/v1/chat/completions', {}, {})).toBe('整包返回');
  });

  it('surfaces gateway timeouts instead of silently returning empty', async () => {
    // 中转站被 Cloudflare 掐断时正是这个形态：非 2xx + HTML
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>524: A timeout occurred</html>', {
      status: 524, headers: { 'content-type': 'text/html' },
    })));
    await expect(streamCompletion('https://example.test/v1/chat/completions', {}, {})).rejects.toThrow('LLM HTTP 524');
  });
});
