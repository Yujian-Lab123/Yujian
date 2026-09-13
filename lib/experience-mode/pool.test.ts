import { describe, expect, it } from 'vitest';
import { filterCardsByMockIds } from './pool-filter';
import { SESSION_COOKIE_REAL, SESSION_COOKIE_DEMO } from './cookies';

/** 数据隔离：真实池不出现 Mock 用户，演示池不出现真实用户。 */
function card(id: string) {
  return { target: { id } };
}

describe('experience-mode data isolation', () => {
  const mockIds = new Set(['u0', 'u1', 'u2']);

  it('real pool drops every mock candidate', () => {
    const cards = [card('real-a'), card('u0'), card('real-b'), card('u1')];
    const kept = filterCardsByMockIds(cards, mockIds, 'real');
    expect(kept.map((c) => c.target.id)).toEqual(['real-a', 'real-b']);
  });

  it('demo pool keeps only mock candidates', () => {
    const cards = [card('real-a'), card('u0'), card('real-b'), card('u2')];
    const kept = filterCardsByMockIds(cards, mockIds, 'demo');
    expect(kept.map((c) => c.target.id)).toEqual(['u0', 'u2']);
  });

  it('empty pool stays empty', () => {
    expect(filterCardsByMockIds([], mockIds, 'real')).toEqual([]);
    expect(filterCardsByMockIds([], mockIds, 'demo')).toEqual([]);
  });

  /** Cookie 隔离：两种会话使用不同的 Cookie 名，互不覆盖。 */
  it('real and demo sessions use distinct cookie names', () => {
    expect(SESSION_COOKIE_REAL).toBe('yj_session');
    expect(SESSION_COOKIE_DEMO).toBe('yj_demo_session');
    expect(SESSION_COOKIE_REAL).not.toBe(SESSION_COOKIE_DEMO);
  });
});
