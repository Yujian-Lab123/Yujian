import { desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '../db/client';
import { profileArtifacts, users } from '../db/schema';
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

/**
 * 匹配模块只按用户读取最新画像，不依赖文件名或展示 slug。
 * 同一用户可能重复生成画像，因此必须以更新时间而不是插入顺序为准。
 */
export async function getLatestProfileArtifactForUser(userId: string): Promise<ProfileArtifact | null> {
  const [row] = await db.select({ artifact: profileArtifacts.artifact }).from(profileArtifacts)
    .where(eq(profileArtifacts.userId, userId))
    .orderBy(desc(profileArtifacts.updatedAt))
    .limit(1);
  return row ? row.artifact as unknown as ProfileArtifact : null;
}

/** 画像可见性元数据：供画像广场与 /profile?name= 的权限收口使用。 */
export interface ProfileArtifactMeta {
  slug: string;
  userId: string | null;
  isMock: boolean;
  sharedAt: Date | null;
}

export async function getProfileArtifactMeta(slug: string): Promise<ProfileArtifactMeta | null> {
  const [row] = await db.select({
    slug: profileArtifacts.slug,
    userId: profileArtifacts.userId,
    sharedAt: profileArtifacts.sharedAt,
    isMock: users.isMock,
  }).from(profileArtifacts)
    .leftJoin(users, eq(profileArtifacts.userId, users.id))
    .where(eq(profileArtifacts.slug, slug))
    .limit(1);
  if (!row) return null;
  return { slug: row.slug, userId: row.userId, isMock: row.isMock ?? true, sharedAt: row.sharedAt };
}

/** 画像广场列表：仅真实用户（非 Mock）且本人自愿公开的画像。 */
export async function listSharedProfileArtifacts(): Promise<Array<ProfileArtifactMeta & { artifact: ProfileArtifact }>> {
  const rows = await db.select({
    slug: profileArtifacts.slug,
    userId: profileArtifacts.userId,
    sharedAt: profileArtifacts.sharedAt,
    isMock: users.isMock,
    artifact: profileArtifacts.artifact,
  }).from(profileArtifacts)
    .innerJoin(users, eq(profileArtifacts.userId, users.id))
    .where(eq(users.isMock, false))
    .orderBy(desc(profileArtifacts.updatedAt));
  return rows
    .filter((row) => row.sharedAt !== null)
    .map((row) => ({
      slug: row.slug,
      userId: row.userId,
      isMock: row.isMock ?? false,
      sharedAt: row.sharedAt,
      artifact: row.artifact as unknown as ProfileArtifact,
    }));
}

/** 设置/取消画像的公开分享状态（仅本人画像生效）。 */
export async function setProfileArtifactShared(slug: string, userId: string, shared: boolean): Promise<boolean> {
  const [row] = await db.select({ id: profileArtifacts.id }).from(profileArtifacts)
    .where(eq(profileArtifacts.slug, slug)).limit(1);
  if (!row) return false;
  await db.update(profileArtifacts)
    .set({ sharedAt: shared ? new Date() : null, updatedAt: new Date() })
    .where(eq(profileArtifacts.id, row.id));
  return true;
}

/** 用户最新画像的可见性元数据（分享开关用）。 */
export async function getLatestProfileArtifactShareStatus(
  userId: string,
): Promise<{ slug: string; sharedAt: Date | null } | null> {
  const [row] = await db.select({ slug: profileArtifacts.slug, sharedAt: profileArtifacts.sharedAt }).from(profileArtifacts)
    .where(eq(profileArtifacts.userId, userId))
    .orderBy(desc(profileArtifacts.updatedAt)).limit(1);
  return row ?? null;
}

/** 设置用户最新画像的公开状态（仅本人画像生效）：shared=true 进入画像长廊，false 撤下。 */
export async function setLatestProfileArtifactShared(
  userId: string,
  shared: boolean,
): Promise<{ slug: string } | null> {
  const meta = await getLatestProfileArtifactShareStatus(userId);
  if (!meta) return null;
  await db.update(profileArtifacts)
    .set({ sharedAt: shared ? new Date() : null, updatedAt: new Date() })
    .where(eq(profileArtifacts.slug, meta.slug));
  return { slug: meta.slug };
}
