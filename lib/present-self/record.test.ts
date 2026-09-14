import { describe, expect, it } from 'vitest';
import {
  composeRecord,
  MAX_RECORD_LENGTH,
  parseRecord,
  validateRecord,
  type PresentSelfDraft,
} from './record';

const draft: PresentSelfDraft = {
  moods: ['平静', '有点累', '想散步', '想聊天'],
  thought: '比赛接近结束，心里有点空落落的。\n想在晚上出去走走。',
  activities: ['散步', '看书'],
  conversationStyle: '轻松随意',
  personPreference: '有自己的生活节奏，愿意分享小小灵感的人。',
};

describe('Present Self record boundary', () => {
  it('round-trips the labelled compatibility record', () => {
    const text = composeRecord(draft);
    expect(parseRecord(text, '平静')).toMatchObject(draft);
    expect(validateRecord({ text, mood: '平静' })).toEqual({ text, mood: '平静' });
  });

  it('keeps multiline thoughts inside their labelled section', () => {
    const parsed = parseRecord(composeRecord(draft), '平静');
    expect(parsed.thought).toContain('\n想在晚上出去走走。');
    expect(parsed.activities).toEqual(['散步', '看书']);
  });

  it('preserves legacy free text without inventing structured values', () => {
    expect(parseRecord('今天只是想安静一下。', '疲惫')).toEqual({
      moods: ['疲惫'], thought: '', activities: [], conversationStyle: '', personPreference: '',
      legacyText: '今天只是想安静一下。',
    });
  });

  it('maps the previous labelled format conservatively', () => {
    const parsed = parseRecord('当前状态：学习中\n最近困惑：下一步做什么？\n活动意愿：散步走走\n社交需求：想被倾听', '平静');
    expect(parsed.thought).toContain('下一步做什么？');
    expect(parsed.activities).toEqual(['散步走走']);
    expect(parsed.conversationStyle).toBe('想被倾听');
  });

  it('rejects empty, malformed and oversized records', () => {
    for (const body of [null, [], 'text', {}, { text: ' ', mood: ' ' }, { text: 123 }, { mood: {} }]) {
      expect(() => validateRecord(body)).toThrow();
    }
    expect(validateRecord({ text: '字'.repeat(MAX_RECORD_LENGTH), mood: '' }).text).toHaveLength(MAX_RECORD_LENGTH);
    expect(() => validateRecord({ text: '字'.repeat(MAX_RECORD_LENGTH + 1), mood: '' })).toThrow(String(MAX_RECORD_LENGTH));
    expect(() => validateRecord({ mood: '字'.repeat(21) })).toThrow('20');
  });
});
