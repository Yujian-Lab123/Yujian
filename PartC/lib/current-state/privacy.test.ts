import { describe, expect, it } from 'vitest';
import {
  buildCurrentStateMatchText,
  decodeCurrentState,
  encodeCurrentState,
  parseCurrentStateSelection,
  type CurrentStateSelection,
} from './privacy';

const selection: CurrentStateSelection = {
  mood: '疲惫',
  activity: '想走走',
  connectionMode: '找同伴',
};

describe('Current State privacy contract', () => {
  it('accepts only allow-listed structured selections', () => {
    expect(parseCurrentStateSelection(selection)).toEqual(selection);
    expect(parseCurrentStateSelection({ ...selection, mood: '随便填的心情' })).toBeNull();
    expect(parseCurrentStateSelection({ mood: '疲惫', activity: '想走走' })).toBeNull();
  });

  it('builds matching input only from structured selections', () => {
    expect(buildCurrentStateMatchText(selection)).toBe('心情：疲惫；活动：想走走；交流：找同伴');
  });

  it('stores LLM-derived understanding without storing the private note', () => {
    const privateNote = '这是只允许发给 LLM 的私密原文';
    const encoded = encodeCurrentState(selection, {
      status: 'understood',
      understanding: {
        themes: ['work', 'rest'],
        supportNeed: 'companion',
        summary: privateNote,
      },
    } as Parameters<typeof encodeCurrentState>[1]);
    expect(encoded).not.toContain(privateNote);
    expect(encoded).not.toContain('summary');
    expect(decodeCurrentState(encoded)?.match).toEqual(selection);
  });

  it('rejects legacy free-text rows instead of matching or displaying them', () => {
    expect(decodeCurrentState('今晚很想找个人出去走走')).toBeNull();
  });
});
