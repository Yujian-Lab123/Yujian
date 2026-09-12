import { desc, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { profileArtifacts } from '../db/schema';
import type { ProfileArtifact } from '../profile/schema';

/** 同一用户可能有多个历史 slug；按更新时间取最新画像。 */
export async function loadLatestProfileArtifacts(userIds: string[]): Promise<Map<string, ProfileArtifact>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await db.select({
    userId: profileArtifacts.userId,
    artifact: profileArtifacts.artifact,
  }).from(profileArtifacts)
    .where(inArray(profileArtifacts.userId, ids))
    .orderBy(desc(profileArtifacts.updatedAt));
  const result = new Map<string, ProfileArtifact>();
  for (const row of rows) {
    if (row.userId && !result.has(row.userId)) {
      result.set(row.userId, row.artifact as unknown as ProfileArtifact);
    }
  }
  return result;
}
