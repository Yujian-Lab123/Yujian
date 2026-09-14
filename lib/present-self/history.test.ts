import { describe, expect, it } from 'vitest';
import { latestRecordsByDay, monthBounds, parseMonthKey, shiftMonth, summarizeMonth } from './history';

describe('Present Self history', () => {
  it('validates month keys and creates Shanghai boundaries', () => {
    expect(parseMonthKey('2026-09')).toEqual({ year: 2026, month: 9, key: '2026-09' });
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('../2026-09')).toBeNull();
    expect(monthBounds('2026-09')?.start.toISOString()).toBe('2026-08-31T16:00:00.000Z');
    expect(monthBounds('2026-12')?.end.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('keeps the latest record per Shanghai calendar day', () => {
    const records = [
      { id: 'a', mood: '平静', text: '早上', created_at: '2026-09-01T01:00:00.000Z' },
      { id: 'b', mood: '开心', text: '晚上', created_at: '2026-09-01T12:00:00.000Z' },
    ];
    expect(latestRecordsByDay(records).get('2026-09-01')?.id).toBe('b');
  });

  it('summarizes frequency without presenting it as personality', () => {
    const summary = summarizeMonth([
      { id: 'a', mood: '平静', text: '今日心情：平静、想散步', created_at: '2026-09-01T01:00:00.000Z' },
      { id: 'b', mood: '平静', text: '今日心情：平静', created_at: '2026-09-02T01:00:00.000Z' },
    ]);
    expect(summary.dominantMood).toBe('平静');
    expect(summary.copy).toContain('不会定义你');
  });
});
