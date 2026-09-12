import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { profileJobs, serviceHeartbeats } from '../db/schema';
import { syncProfileVectorIndex } from '../db/vector-index';
import { analyzeProfile } from './engine.ts';
import { getProfileArtifact, saveProfileArtifact } from './repository';
import { looseParseItems, readArtifactFile, saveArtifactFiles, slugifyName } from './store.ts';

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
    const filePath = path.join(root, 'data', 'crawler', path.basename(job.inputFile));
    const raws = looseParseItems(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    const options = job.options || {};
    const outputDir = path.join(root, 'profile-output');
    const expectedSlug = slugifyName(job.subjectName || 'person');
    const previousArtifact = await getProfileArtifact(expectedSlug).catch(() => null)
      || readArtifactFile(outputDir, expectedSlug);
    const artifact = await analyzeProfile(raws, {
      name: job.subjectName,
      maxItems: options.maxItems,
      maxTextChars: options.maxChars,
      cacheFile: path.join(root, 'data', 'crawler', '.extract-cache.json'),
      previousArtifact,
      onProgress: (progress) => {
        void db.update(profileJobs).set({
          progress,
          message: progress.message,
          heartbeatAt: new Date(),
        }).where(eq(profileJobs.id, job.id));
      },
    });
    const { slug } = saveArtifactFiles(artifact, outputDir);
    await saveProfileArtifact(artifact, slug, job.requestedBy);
    let vectorIndexStatus = '未关联用户';
    if (job.requestedBy) {
      try {
        vectorIndexStatus = await syncProfileVectorIndex(job.requestedBy, artifact) === 'indexed'
          ? '已同步'
          : '未生成兼容向量';
      } catch (error) {
        vectorIndexStatus = '待迁移或稍后重试';
        console.warn('[profile-worker] pgvector 索引同步失败，画像产物已保留：', error);
      }
    }
    await db.update(profileJobs).set({
      status: 'succeeded',
      artifactSlug: slug,
      message: `完成：核心结论 ${artifact.profile.summary.core_insights.length} 条，Embedding ${artifact.meta.embedding?.status || '未执行'}，向量索引 ${vectorIndexStatus}，告警 ${artifact.meta.warnings.length} 条`,
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
