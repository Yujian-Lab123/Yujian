import { desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '../db/client';
import { profileArtifacts } from '../db/schema';
import type { ProfileArtifact } from './schema';
import type { ArtifactSummary } from './store';

export async function saveProfileArtifact(artifact: ProfileArtifact, slug: string, userId?: string | null): Promise<void> {
  await db.insert(profileArtifacts).values({
    id: `artifact-${randomBytes(8).toString('hex')}`,
    slug,
    userId: userId || null,
    subjectName: artifact.subject.name || slug,
    artifact: artifact as unknown as Record<string, unknown>,
  }).onConflictDoUpdate({
    target: profileArtifacts.slug,
    set: {
      userId: userId || null,
      subjectName: artifact.subject.name || slug,
      artifact: artifact as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    },
  });
}

export async function listProfileArtifacts(): Promise<ArtifactSummary[]> {
  const rows = await db.select().from(profileArtifacts).orderBy(desc(profileArtifacts.updatedAt));
  return rows.map((row) => {
    const artifact = row.artifact as unknown as ProfileArtifact;
    return {
      slug: row.slug,
      name: row.subjectName,
      contentCount: artifact.meta.content_count,
      generatedAt: artifact.meta.generated_at,
      timeRange: artifact.meta.time_range ? `${artifact.meta.time_range.from} ~ ${artifact.meta.time_range.to}` : null,
      mtime: row.updatedAt.toISOString(),
    };
  });
}

export async function getProfileArtifact(slug: string): Promise<ProfileArtifact | null> {
  const [row] = await db.select({ artifact: profileArtifacts.artifact }).from(profileArtifacts)
    .where(eq(profileArtifacts.slug, slug)).limit(1);
  return row ? row.artifact as unknown as ProfileArtifact : null;
}
