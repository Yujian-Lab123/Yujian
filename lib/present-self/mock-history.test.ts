import { describe, expect, it } from 'vitest';
import { SEED_USERS } from '../db/seed';
import { buildMockCurrentStateSeeds } from './mock-history';
import { shanghaiMonthKey } from './history';

describe('mock Present Self history', () => {
  it('is deterministic and id-unique', () => {
    const now = new Date('2026-09-13T04:00:00.000Z');
    expect(buildMockCurrentStateSeeds(now)).toEqual(buildMockCurrentStateSeeds(now));
    const records = buildMockCurrentStateSeeds(now);
    expect(new Set(records.map((item) => item.id)).size).toBe(records.length);
  });

  it('gives EVERY rotatable demo identity a full current-month history', () => {
    const records = buildMockCurrentStateSeeds(new Date('2026-09-13T04:00:00.000Z'));
    for (const user of SEED_USERS) {
      const own = records.filter((item) => item.userId === user.id);
      expect(own.length, `${user.id} 应有至少 8 条当月记录`).toBeGreaterThanOrEqual(8);
      expect(own.every((item) => shanghaiMonthKey(item.createdAt) === '2026-09'), `${user.id} 应全部落在当月`).toBe(true);
    }
  });

  it('stays inside the current month even on the first day, at any hour', () => {
    for (const iso of ['2026-09-01T02:00:00.000Z', '2026-09-01T12:00:00.000Z', '2026-09-01T23:30:00.000Z', '2026-08-31T16:05:00.000Z']) {
      // 最后一个用例 = 上海时间 9 月 1 日 00:05，跨天钳制不得把记录带回 8 月
      const records = buildMockCurrentStateSeeds(new Date(iso));
      expect(records.every((item) => shanghaiMonthKey(item.createdAt) === '2026-09'), iso).toBe(true);
    }
  });

  it('never references real users', () => {
    const records = buildMockCurrentStateSeeds(new Date('2026-09-13T04:00:00.000Z'));
    const mockIds = new Set(SEED_USERS.map((user) => user.id));
    expect(records.every((item) => mockIds.has(item.userId))).toBe(true);
  });
});
