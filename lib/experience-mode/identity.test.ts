import { describe, expect, it } from 'vitest';
import { pickDemoIdentity, filterMockUsers } from './identity';

/** 演示身份选择：服务端确定性轮换，客户端无法指定人物。 */
describe('experience-mode demo identity', () => {
  const pool = [
    { id: 'real-a', is_mock: 0 },
    { id: 'u0', is_mock: 1 },
    { id: 'u1', is_mock: 1 },
    { id: 'u2', is_mock: 1 },
  ];

  it('never returns a real (non-mock) identity', () => {
    for (let day = 0; day < 30; day++) {
      const picked = pickDemoIdentity(pool, new Date(Date.UTC(2026, 8, 13) + day * 86_400_000));
      expect(picked).toMatch(/^u\d+$/);
    }
  });

  it('is deterministic within the same day', () => {
    const a = pickDemoIdentity(pool, new Date('2026-09-13T00:00:00Z'));
    const b = pickDemoIdentity(pool, new Date('2026-09-13T23:59:59Z'));
    expect(a).toBe(b);
  });

  it('rotates across days', () => {
    const picks = new Set<string | null>();
    for (let day = 0; day < 9; day++) {
      picks.add(pickDemoIdentity(pool, new Date(Date.UTC(2026, 8, 13) + day * 86_400_000)));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it('returns null for an empty or all-real pool', () => {
    expect(pickDemoIdentity([], new Date())).toBeNull();
    expect(pickDemoIdentity([{ id: 'real-a', is_mock: 0 }], new Date())).toBeNull();
  });

  it('filterMockUsers keeps only is_mock rows', () => {
    const kept = filterMockUsers(pool).map((row) => row.id);
    expect(kept).toEqual(['u0', 'u1', 'u2']);
  });
});
