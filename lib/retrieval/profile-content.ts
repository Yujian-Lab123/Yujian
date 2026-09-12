import { stateVec } from '../axes';
import type { ContentRow } from '../db';
import type { ProfileArtifact } from '../profile/schema';

export interface ProfileArtifactContent extends ContentRow {
  source: 'profile_artifact';
}

/** 将画像证据转成只读内容快照，不伪造 contents 表外键。 */
export function profileArtifactContents(userId: string, artifact: ProfileArtifact): ProfileArtifactContent[] {
  const evidenceById = new Map(artifact.evidence_index.map((item) => [item.id, item] as const));
  return artifact.profile.representative_contents.map((representative) => {
    const evidence = evidenceById.get(representative.content_id);
    const excerpt = evidence?.excerpt?.trim() || representative.why_representative.trim();
    const summary = representative.why_representative.trim() || excerpt;
    const chars = Math.max(excerpt.length, summary.length);
    return {
      id: `artifact:${userId}:${representative.content_id}`,
      user_id: userId,
      content_type: representative.content_type || evidence?.type || '',
      title: representative.title || evidence?.title || '代表内容',
      chars,
      minutes: Math.max(1, Math.ceil(chars / 500)),
      summary,
      excerpt,
      url: evidence?.url || '',
      topics: representative.supports.slice(0, 4),
      vec: stateVec([representative.title, representative.why_representative, ...representative.supports, excerpt].join(' ')),
      is_anchor: 1,
      published_at: representative.date || evidence?.date || '',
      source: 'profile_artifact',
    };
  });
}
