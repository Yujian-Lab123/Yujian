import { describe, expect, it } from 'vitest';
import { SEED_CONTENTS, SEED_USERS } from '../db/seed';
import { filterEligibleCandidates } from './candidate-filter';

describe('Encounter demo contracts', () => {
  const viewer = SEED_USERS.find((user) => user.id === 'u0')!;
  const candidates = SEED_USERS.map((user) => ({
    id: user.id,
    encounter_enabled: 1,
    intents: user.intents,
  }));

  it('Demo A keeps 陈默 eligible and preserves the cross-domain anchor', () => {
    const eligible = filterEligibleCandidates(candidates, {
      viewerId: viewer.id,
      viewerIntents: viewer.intents,
      connectedUserIds: new Set(),
      outgoingPendingTargetIds: new Set(),
      ignoredTargetIds: new Set(),
    });
    expect(eligible.some((user) => user.id === 'u2')).toBe(true);
    expect(SEED_CONTENTS.find((content) => content.id === 'c21')).toMatchObject({
      user_id: 'u2',
      title: '我为什么没有留在大厂',
      anchor: true,
    });
  });

  it('Demo B preserves 阿屿 and the walking Current State signal', () => {
    const ayu = SEED_USERS.find((user) => user.id === 'u3');
    expect(ayu?.current_state?.text).toMatch(/走走/);
    expect(ayu?.current_state?.mood).toBe('想出去走走');
  });
});

