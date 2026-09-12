import { describe, expect, it } from 'vitest';
import type { ProfileArtifact } from '../profile/schema';
import { profileArtifactContents } from './profile-content';

describe('profile artifact content bridge', () => {
  it('builds a stable display snapshot from representative content and evidence', () => {
    const artifact = {
      evidence_index: [{
        id: 'answer-42',
        title: '为什么我仍然愿意长期写作',
        type: 'answer',
        url: 'https://www.zhihu.com/question/1/answer/42',
        date: '2026-01-02',
        excerpt: '写作让我把模糊的感受变成可以讨论的问题。',
      }],
      profile: {
        representative_contents: [{
          content_id: 'answer-42',
          title: '长期写作',
          content_type: 'answer',
          date: '2026-01-02',
          why_representative: '体现了持续表达与反思。',
          supports: ['长期主义', '阅读与写作'],
        }],
      },
    } as unknown as ProfileArtifact;

    const [content] = profileArtifactContents('real-user', artifact);
    expect(content.id).toBe('artifact:real-user:answer-42');
    expect(content.source).toBe('profile_artifact');
    expect(content.excerpt).toContain('模糊的感受');
    expect(content.topics).toEqual(['长期主义', '阅读与写作']);
    expect(content.vec).toHaveLength(16);
  });
});
