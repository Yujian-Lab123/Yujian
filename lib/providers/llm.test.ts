import { afterEach, describe, expect, it } from 'vitest';
import { extractJsonPayload, jsonResponseFormatEnabled } from './llm';

const previous = process.env.LLM_JSON_RESPONSE_FORMAT;

afterEach(() => {
  if (previous === undefined) delete process.env.LLM_JSON_RESPONSE_FORMAT;
  else process.env.LLM_JSON_RESPONSE_FORMAT = previous;
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
