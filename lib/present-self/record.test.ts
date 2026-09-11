import { describe, expect, it } from 'vitest';
import { composeRecord, validateRecord } from './record';

describe('Present Self record boundary', () => {
  it('rejects empty records and invalid JSON shapes without writing data', () => {
    for (const body of [null, [], 'text', {}, { text: ' \n ', mood: ' ' }, { text: 123 }, { mood: {} }]) {
      expect(() => validateRecord(body)).toThrow();
    }
  });

  it('accepts mood-only records and legacy free text', () => {
    expect(validateRecord({ mood: ' 平静 ' })).toEqual({ text: '平静', mood: '平静' });
    expect(validateRecord({ text: ' 今天想走走 ' })).toEqual({ text: '今天想走走', mood: '' });
  });

  it('rejects oversized records instead of silently truncating the user input', () => {
    expect(validateRecord({ text: '字'.repeat(200) }).text).toHaveLength(200);
    expect(() => validateRecord({ text: '字'.repeat(201) })).toThrow('200');
    expect(() => validateRecord({ mood: '字'.repeat(21) })).toThrow('20');
  });

  it('preserves selected needs and multiline thoughts in the existing text contract', () => {
    const text = composeRecord({ mood: '平静', state: '学习中', confusion: ' 换工作？\n还是继续学习？ ', activity: '散步走走', socialNeed: '想被倾听' });
    expect(text).toContain('最近困惑：换工作？\n还是继续学习？');
    expect(text).toContain('活动意愿：散步走走');
    expect(text).toContain('社交需求：想被倾听');
    expect(validateRecord({ text, mood: '平静' })).toEqual({ text, mood: '平静' });
    expect(composeRecord({ mood: '', state: '', confusion: ' ', activity: '', socialNeed: '' })).toBe('');
  });
});
