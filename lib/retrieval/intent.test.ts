import { describe, expect, it } from 'vitest';
import { areIntentsCompatible, intentCompatibilityScore } from './intent';

describe('encounter intent semantics', () => {
  it('treats an unset preference as unknown rather than perfect agreement', () => {
    expect(areIntentsCompatible([], ['朋友'])).toBe(true);
    expect(intentCompatibilityScore([], ['朋友'])).toBe(0.6);
  });

  it('filters two explicit but incompatible preference sets', () => {
    expect(areIntentsCompatible(['同行'], ['户外搭子'])).toBe(false);
    expect(intentCompatibilityScore(['同行'], ['户外搭子'])).toBe(0);
  });

  it('rewards more overlap without calling it pair-specific willingness', () => {
    const partial = intentCompatibilityScore(['朋友', '同行'], ['朋友', '随便聊聊']);
    const exact = intentCompatibilityScore(['朋友', '同行'], ['朋友', '同行']);
    expect(partial).toBeGreaterThan(0.5);
    expect(exact).toBe(1);
    expect(exact).toBeGreaterThan(partial);
  });
});
