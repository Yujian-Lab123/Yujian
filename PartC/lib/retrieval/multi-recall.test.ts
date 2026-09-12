import { describe, expect, it } from 'vitest';
import type { UserVectors } from '../db';
import { multiRouteRecall } from './multi-recall';

const empty: UserVectors = { long_term: [], value: [], conversation: [], current: null };

function candidate(id: string, vectors: UserVectors) {
  return { user: { id, encounter_enabled: 1, intents: [] }, vectors };
}

describe('multi-route recall', () => {
  it('recalls each route independently and merges duplicate users with trace data', () => {
    const viewer: UserVectors = {
      long_term: [1, 0], value: [0, 1], conversation: [1, 1], current: [0.2, 0.8],
    };
    const result = multiRouteRecall(viewer, [
      candidate('long', { ...empty, long_term: [1, 0] }),
      candidate('value', { ...empty, value: [0, 1] }),
      candidate('conversation', { ...empty, conversation: [1, 1] }),
      candidate('current', { ...empty, current: [0.2, 0.8] }),
      candidate('multi', { long_term: [1, 0], value: [0, 1], conversation: [], current: null }),
    ], { limits: { long_term: 2, value: 2, conversation: 1, current: 1 } });

    expect(result.map((item) => item.user.id).sort()).toEqual([
      'conversation', 'current', 'long', 'multi', 'value',
    ]);
    const multi = result.find((item) => item.user.id === 'multi')!;
    expect(multi.recallSources).toEqual(['long_term', 'value']);
    expect(multi.recallScores).toEqual({ long_term: 1, value: 1 });
    expect(multi.recallScore).toBe(1);
  });

  it('keeps hard-filtered candidates during a vector cold start', () => {
    const result = multiRouteRecall(empty, [
      candidate('b', empty),
      candidate('a', empty),
    ]);
    expect(result.map((item) => item.user.id)).toEqual(['a', 'b']);
    expect(result[0]).toMatchObject({ recallSources: [], recallScores: {}, recallScore: 0 });

    const candidatesNotEmbeddedYet = multiRouteRecall(
      { ...empty, long_term: [1, 0] },
      [candidate('pending-embedding', empty)],
    );
    expect(candidatesNotEmbeddedYet.map((item) => item.user.id)).toEqual(['pending-embedding']);
  });
});
