import fs from 'node:fs';
import path from 'node:path';
import { analyzeProfile } from './engine.ts';
import { looseParseItems, saveArtifactFiles } from './store.ts';
import type { ProfileArtifact } from './schema.ts';

// ============ 画像生成后台任务(进程内注册表;/profile 页通过 API 轮询) ============
// 仅适用于自托管 Node 常驻进程(next start);serverless 环境需换队列,这里刻意保持零依赖。

export interface ProfileJob {
  id: string;
  status: 'running' | 'done' | 'error';
  file: string;
  name: string;
  message: string;
  progress: { stage: string; batchDone?: number; batchTotal?: number; clues?: number; cacheHits?: number; cacheTotal?: number } | null;
  slug?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

interface JobInternal extends ProfileJob {
  artifact?: ProfileArtifact;
}

const g = globalThis as unknown as { __profileJobs?: Map<string, JobInternal> };
const jobs: Map<string, JobInternal> = (g.__profileJobs ??= new Map());

export function getJob(id: string): ProfileJob | null {
  const j = jobs.get(id);
  if (!j) return null;
  const pub = { ...j } as Partial<JobInternal>;
  delete pub.artifact;
  return pub as ProfileJob;
}

export function getJobArtifact(id: string): ProfileArtifact | null {
  return jobs.get(id)?.artifact ?? null;
}

export function startProfileJob(opts: { file: string; name: string; maxItems?: number; maxChars?: number; root: string }): ProfileJob {
  const dataDir = path.join(opts.root, 'data', 'crawler');
  const safeFile = path.basename(opts.file); // 防路径穿越:只允许 data/crawler 下的文件名
  const filePath = path.join(dataDir, safeFile);
  if (!fs.existsSync(filePath)) throw new Error(`输入文件不存在:${safeFile}`);

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const raws = looseParseItems(parsed);
  if (!raws.length) throw new Error('输入文件没有内容。');

  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: JobInternal = {
    id, status: 'running', file: safeFile, name: opts.name,
    message: '已启动,等待首批抽取…', progress: null, startedAt: new Date().toISOString(),
  };
  jobs.set(id, job);

  void (async () => {
    try {
      const artifact = await analyzeProfile(raws, {
        name: opts.name,
        maxItems: opts.maxItems,
        maxTextChars: opts.maxChars,
        cacheFile: path.join(opts.root, 'data', 'crawler', '.extract-cache.json'),
        onProgress: (p) => {
          job.progress = { stage: p.stage, batchDone: p.batchDone, batchTotal: p.batchTotal, clues: p.clues, cacheHits: p.cacheHits, cacheTotal: p.cacheTotal };
          job.message = p.message;
        },
      });
      job.artifact = artifact;
      const { slug } = saveArtifactFiles(artifact, path.join(opts.root, 'profile-output'));
      job.slug = slug;
      job.status = 'done';
      job.message = `完成:核心结论 ${artifact.profile.summary.core_insights.length} 条,告警 ${artifact.meta.warnings.length} 条`;
    } catch (e) {
      job.status = 'error';
      job.error = e instanceof Error ? e.message : String(e);
      job.message = '生成失败';
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  })();

  return job;
}
