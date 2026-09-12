import { describe, expect, it } from 'vitest';
import {
  CURRENT_STATE_TTL_HOURS,
  currentStateExpiresAt,
  isCurrentStateActive,
} from './current-state';

describe('Current State lifecycle', () => {
  const now = new Date('2026-09-08T00:00:00.000Z');

  it('expires new states after 72 hours', () => {
    expect(CURRENT_STATE_TTL_HOURS).toBe(72);
    expect(currentStateExpiresAt(now).toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });

  it('rejects expired states and accepts active or legacy states', () => {
    expect(isCurrentStateActive(new Date('2026-09-07T23:59:59.000Z'), now)).toBe(false);
    expect(isCurrentStateActive(new Date('2026-09-08T00:00:01.000Z'), now)).toBe(true);
    expect(isCurrentStateActive(null, now)).toBe(true);
  });
});

