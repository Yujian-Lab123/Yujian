import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { profileJobs, serviceHeartbeats } from '../db/schema';
import { analyzeProfile } from './engine.ts';
import { getZhihuRawContents } from '../db/users';
import { saveProfileArtifact } from './repository';
import { looseParseItems, saveArtifactFiles } from './store.ts';

export type ProfileJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export interface ProfileJobProgress {
  stage: string;
  batchDone?: number;
  batchTotal?: number;
  clues?: number;
  cacheHits?: number;
  cacheTotal?: number;
}

export interface ProfileJob {
  id: string;
  status: ProfileJobStatus;
  file: string;
  name: string;
  message: string;
  progress: ProfileJobProgress | null;
  slug?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

function publicJob(row: typeof profileJobs.$inferSelect): ProfileJob {
  return {
    id: row.id,
    status: row.status,
    file: row.inputFile,
    name: row.subjectName,
    message: row.message,
    progress: row.progress as ProfileJobProgress | null,
    slug: row.artifactSlug || undefined,
    error: row.error || undefined,
    startedAt: row.startedAt?.toISOString(),
    finishedAt: row.finishedAt?.toISOString(),
  };
}

export async function getJob(id: string): Promise<ProfileJob | null> {
  const [row] = await db.select().from(profileJobs).where(eq(profileJobs.id, id)).limit(1);
  return row ? publicJob(row) : null;
}

export async function startProfileJob(opts: {
  file: string;
  name: string;
  maxItems?: number;
  maxChars?: number;
  root: string;
  requestedBy?: string | null;
}): Promise<ProfileJob> {
  const safeFile = path.basename(opts.file);
  const filePath = path.join(opts.root, 'data', 'crawler', safeFile);
  if (!fs.existsSync(filePath)) throw new Error(`输入文件不存在：${safeFile}`);
  const raws = looseParseItems(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  if (!raws.length) throw new Error('输入文件没有内容。');

  const id = `job-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const [row] = await db.insert(profileJobs).values({
    id,
    requestedBy: opts.requestedBy || null,
    status: 'queued',
    inputFile: safeFile,
    subjectName: opts.name,
    options: { maxItems: opts.maxItems, maxChars: opts.maxChars },
    message: '已进入队列，等待画像 Worker',
  }).returning();
  return publicJob(row);
}

/** 真实登录用户的内容源标记：以 zhihu:<userId> 作为 profile_jobs.input_file 的哨兵值。
 *  OAuth 采集到的内容存在数据库里，不落 data/crawler 文件，因此不能用文件校验。 */
export const ZHIHU_SOURCE_PREFIX = 'zhihu:';

export function isZhihuSourceJob(inputFile: string): boolean {
  return inputFile.startsWith(ZHIHU_SOURCE_PREFIX);
}

/** 用「已登录用户的知乎采集内容」启动画像任务（真实用户链路，无需 data/crawler 文件）。 */
export async function startProfileJobForUser(opts: {
  userId: string;
  name: string;
  maxItems?: number;
  maxChars?: number;
  requestedBy?: string | null;
}): Promise<ProfileJob> {
  const contents = await getZhihuRawContents(opts.userId);
  if (!contents.length) {
    throw new Error('还没有采集到你的知乎内容，请先完成一次知乎登录授权。');
  }
  const id = `job-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const [row] = await db.insert(profileJobs).values({
    id,
    requestedBy: opts.requestedBy || opts.userId,
    status: 'queued',
    inputFile: `${ZHIHU_SOURCE_PREFIX}${opts.userId}`,
    subjectName: opts.name,
    options: { maxItems: opts.maxItems, maxChars: opts.maxChars },
    message: '已进入队列，等待画像 Worker',
  }).returning();
  return publicJob(row);
}

export async function heartbeatWorker(): Promise<void> {
  await db.insert(serviceHeartbeats).values({ name: 'profile-worker', metadata: { pid: process.pid } })
    .onConflictDoUpdate({ target: serviceHeartbeats.name, set: { lastSeenAt: new Date(), metadata: { pid: process.pid } } });
}

export async function claimNextProfileJob(): Promise<(typeof profileJobs.$inferSelect) | null> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(`
      select * from profile_jobs
      where status = 'queued'
         or (status = 'running' and heartbeat_at < now() - interval '10 minutes')
      order by created_at asc
      for update skip locked
      limit 1
    `);
    if (!result.rows[0]) {
      await client.query('commit');
      return null;
    }
    const row = result.rows[0];
    const updated = await client.query(`
      update profile_jobs
      set status = 'running', started_at = coalesce(started_at, now()), heartbeat_at = now(),
          attempts = attempts + 1, message = 'Worker 已领取任务，准备解析输入'
      where id = $1 returning *
    `, [row.id]);
    await client.query('commit');
    const claimed = updated.rows[0];
    return {
      id: claimed.id,
      requestedBy: claimed.requested_by,
      status: claimed.status,
      inputFile: claimed.input_file,
      subjectName: claimed.subject_name,
      options: claimed.options || {},
      message: claimed.message,
      progress: claimed.progress,
      artifactSlug: claimed.artifact_slug,
      error: claimed.error,
      attempts: claimed.attempts,
      createdAt: claimed.created_at,
      startedAt: claimed.started_at,
      finishedAt: claimed.finished_at,
      heartbeatAt: claimed.heartbeat_at,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function processProfileJob(job: typeof profileJobs.$inferSelect, root: string): Promise<void> {
  try {
    let raws;
    let cacheFile: string | undefined;
    if (isZhihuSourceJob(job.inputFile)) {
      // 真实用户链路：内容来自数据库（OAuth 采集），复用同一套宽松解析与引擎。
      const userId = job.inputFile.slice(ZHIHU_SOURCE_PREFIX.length);
      const stored = await getZhihuRawContents(userId);
      raws = looseParseItems({ items: stored });
      if (!raws.length) throw new Error('数据库中没有可用的知乎内容，请重新授权采集一次。');
      // 容器内可能没有 data/crawler 目录：缓存放到系统临时目录，避免写盘失败。
      cacheFile = path.join(os.tmpdir(), `yujian-extract-cache-${userId}.json`);
    } else {
      const filePath = path.join(root, 'data', 'crawler', path.basename(job.inputFile));
      raws = looseParseItems(JSON.parse(fs.readFileSync(filePath, 'utf8')));
      cacheFile = path.join(root, 'data', 'crawler', '.extract-cache.json');
    }
    const options = job.options || {};
    const artifact = await analyzeProfile(raws, {
      name: job.subjectName,
      maxItems: options.maxItems,
      maxTextChars: options.maxChars,
      cacheFile,
      onProgress: (progress) => {
        void db.update(profileJobs).set({
          progress,
          message: progress.message,
          heartbeatAt: new Date(),
        }).where(eq(profileJobs.id, job.id));
      },
    });
    const outDir = path.join(root, 'profile-output');
    fs.mkdirSync(outDir, { recursive: true });
    const { slug } = saveArtifactFiles(artifact, outDir);
    await saveProfileArtifact(artifact, slug, job.requestedBy);
    await db.update(profileJobs).set({
      status: 'succeeded',
      artifactSlug: slug,
      message: `完成：核心结论 ${artifact.profile.summary.core_insights.length} 条，告警 ${artifact.meta.warnings.length} 条`,
      finishedAt: new Date(),
      heartbeatAt: new Date(),
    }).where(eq(profileJobs.id, job.id));
  } catch (error) {
    await db.update(profileJobs).set({
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      message: '生成失败',
      finishedAt: new Date(),
      heartbeatAt: new Date(),
    }).where(eq(profileJobs.id, job.id));
  }
}
