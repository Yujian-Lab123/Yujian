import { describe, expect, it } from 'vitest';
import { buildMockCurrentStateSeeds } from './mock-history';
import { shanghaiMonthKey } from './history';

describe('mock Present Self history', () => {
  it('is deterministic, unique and isolated to the default mock user', () => {
    const now = new Date('2026-09-13T04:00:00.000Z');
    const first = buildMockCurrentStateSeeds(now);
    const second = buildMockCurrentStateSeeds(now);
    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
    expect(first.every((item) => item.userId === 'u0')).toBe(true);
    expect(first.every((item) => shanghaiMonthKey(item.createdAt) === '2026-09')).toBe(true);
  });

  it('stays inside the current month even on the first day', () => {
    const now = new Date('2026-09-01T02:00:00.000Z');
    expect(buildMockCurrentStateSeeds(now).every((item) => shanghaiMonthKey(item.createdAt) === '2026-09')).toBe(true);
  });
});
