import { describe, expect, it } from 'vitest';
import { buildContextualPersona } from './contextual-persona';

describe('buildContextualPersona', () => {
  it('keeps long-term understanding and current state as two distinct signals', () => {
    const persona = buildContextualPersona({
      currentState: { mood: '想出去走走', text: '刚结束一个大项目，脑子快炸了，很想晚上找个人出去走走。' },
      understanding: { topics: ['技术 / AI', '产品与设计'], coreQuestion: '怎样做出真正属于自己的选择？' },
    });

    expect(persona.source).toBe('long-term-and-current');
    expect(persona.currentLabel).toContain('刚结束一个大项目');
    expect(persona.longTermLabel).toContain('技术 / AI');
    expect(persona.title).toContain('透气');
    expect(persona.note).toContain('并列');
  });

  it('does not fabricate a long-term conclusion from a one-off state', () => {
    const persona = buildContextualPersona({ currentState: { mood: '迷茫', text: '最近有点纠结下一步怎么走。' } });

    expect(persona.source).toBe('current-only');
    expect(persona.longTermLabel).toBe('长期理解尚在生成中');
    expect(persona.note).toContain('当下记录');
  });

  it('asks for a current record when only long-term understanding is available', () => {
    const persona = buildContextualPersona({ understanding: { topics: ['阅读与写作'] } });

    expect(persona.source).toBe('long-term-only');
    expect(persona.currentLabel).toBe('尚未记录此刻状态');
    expect(persona.title).toContain('等待今天');
  });
});
