import { describe, expect, it } from 'vitest';
import type { ProfileArtifact } from '../profile/schema';
import {
  applyModelRerankScores,
  buildRerankPersonText,
  configuredRerankCandidateLimit,
  MAX_RERANK_CANDIDATE_LIMIT,
  mergeRerankedPool,
  selectRerankPool,
  type RerankUser,
} from './model-rerank';
import type { RankedCandidate } from './scoring';

const user: RerankUser = {
  id: 'u1', name: '测试用户', role: '设计师', quote: '关心城市与人的关系',
  tags: ['城市', '阅读'], intents: ['朋友'], encounter_enabled: 1,
};

function ranked(id: string, compatibility: number): RankedCandidate<RerankUser> {
  return {
    user: { ...user, id },
    vectors: { long_term: [1], value: [1], conversation: [1], current: null },
    lt: 1, val: 1, conv: 1, cur: 0, intent: 1, novelty: 1, diversity: 0.4,
    coarse: 0.8, rerank: 0.8, compatibility, forward: compatibility, backward: compatibility, final: 0.8,
    recall: { sources: ['long_term'], scores: { long_term: 1 }, max_score: 1 },
  };
}

describe('model rerank helpers', () => {
  it('serializes only compressed structured profile fields', () => {
    const artifact = {
      profile: {
        summary: { one_sentence: '持续观察城市生活', core_insights: [{ claim: '重视长期关系' }] },
        long_term_concerns: [{ question: '城市怎样影响人的连接？' }],
        drivers: [{ driver: '理解真实生活' }],
        value_preferences: [{ left: '效率', right: '关系', lean: 'right' }],
        conversation_style: { traits: [{ trait: '愿意倾听' }], good_entry_points: ['城市散步'] },
      },
      evidence_index: [{ excerpt: '这段原始证据不应发送' }],
    } as unknown as ProfileArtifact;
    const text = buildRerankPersonText(user, artifact);
    expect(text).toContain('长期关切：城市怎样影响人的连接？');
    expect(text).not.toContain('测试用户');
    expect(text).not.toContain('关心城市与人的关系');
    expect(text).not.toContain('这段原始证据不应发送');
    expect(text).not.toContain('此刻状态');
  });

  it('replaces fallback scores without inventing mutual willingness', () => {
    const result = applyModelRerankScores([ranked('a', 0.2), ranked('b', 0.9)], [0.95, 0.4]);
    expect(result.map((item) => item.user.id)).toEqual(['b', 'a']);
    expect(result.find((item) => item.user.id === 'a')?.final).toBeCloseTo(0.55 * 0.95 + 0.45 * 0.2);
  });

  it('bounds paid candidate pool configuration', () => {
    expect(configuredRerankCandidateLimit({ RERANK_CANDIDATE_LIMIT: '999' })).toBe(MAX_RERANK_CANDIDATE_LIMIT);
    expect(configuredRerankCandidateLimit({ RERANK_CANDIDATE_LIMIT: 'invalid' })).toBe(20);
  });

  it('reserves a pool slot for a strong current-state vector match', () => {
    const candidates = [ranked('a', 0.9), ranked('b', 0.8), ranked('c', 0.7)];
    candidates[2].cur = 0.8;
    expect(selectRerankPool(candidates, 2).map((item) => item.user.id)).toEqual(['a', 'c']);
  });

  it('keeps candidates outside the paid rerank pool', () => {
    const candidates = [ranked('a', 0.4), ranked('b', 0.3), ranked('c', 0.2)];
    const result = mergeRerankedPool(candidates, candidates.slice(0, 2), [0.9, 0.1]);
    expect(result.map((item) => item.user.id).sort()).toEqual(['a', 'b', 'c']);
    expect(result.find((item) => item.user.id === 'c')?.rerank).toBe(0.8);
  });
});
