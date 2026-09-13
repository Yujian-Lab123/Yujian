import { describe, expect, it } from 'vitest';
import { multiRouteRecall } from './multi-recall';
import type { CandidateUser } from './candidate-filter';
import type { UserVectors } from '../db';

const user = (id: string): CandidateUser => ({ id, intents: [], encounter_enabled: 1 });
const vectors = (overrides: Partial<UserVectors>): UserVectors => ({
  long_term: [], value: [], conversation: [], current: null, ...overrides,
});

describe('multi-route recall', () => {
  it('merges candidates from independent routes and records provenance', () => {
    const result = multiRouteRecall(
      vectors({ long_term: [1, 0], value: [0, 1] }),
      [
        { user: user('long'), vectors: vectors({ long_term: [1, 0], value: [1, 0] }) },
        { user: user('value'), vectors: vectors({ long_term: [0, 1], value: [0, 1] }) },
      ],
      { long_term: 1, value: 1 },
    );

    expect(result.map((item) => item.user.id)).toEqual(['long', 'value']);
    expect(result.find((item) => item.user.id === 'long')?.recallSources).toContain('long_term');
    expect(result.find((item) => item.user.id === 'value')?.recallSources).toContain('value');
  });

  it('returns filtered candidates deterministically when no vector route is active', () => {
    const result = multiRouteRecall(vectors({}), [
      { user: user('b'), vectors: vectors({}) },
      { user: user('a'), vectors: vectors({}) },
    ]);
    expect(result.map((item) => item.user.id)).toEqual(['a', 'b']);
  });
});
