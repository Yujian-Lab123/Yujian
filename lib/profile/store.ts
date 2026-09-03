import fs from 'node:fs';
import path from 'node:path';
import { renderReport } from './report.ts';
import type { ProfileArtifact, RawContent } from './schema.ts';

// ============ 画像产物存取(CLI 与 /profile API 共用) ============

/** 宽松字段映射:id/title/question_title/content/content_text/excerpt/desc/author/nickname/publish_time/created_at... */
export function looseExtract(obj: Record<string, unknown>): RawContent {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return undefined;
  };
  const dateRaw = pick('published_at', 'publish_time', 'created_at', 'created_time', 'date');
  const dateNum = dateRaw !== undefined && /^-?\d+(\.\d+)?$/.test(dateRaw) ? Number(dateRaw) : undefined;
  return {
    id: pick('id', 'content_id', 'cid'),
    title: pick('title', 'question_title', 'post_title', 'name'),
    text: pick('content', 'content_text', 'text', 'excerpt', 'desc', 'description', 'summary') ?? '',
    type: pick('type', 'content_type', 'kind'),
    url: pick('url', 'source_url', 'link'),
    published_at: dateNum ?? dateRaw ?? null,
    author: pick('author', 'author_name', 'nickname', 'user_name', 'url_token'),
  };
}

/** 解析输入文件内容:顶层数组或 {contents|items|data|answers|articles:[...]},字段宽松映射 */
export function looseParseItems(parsed: unknown): RawContent[] {
  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : (() => { const o = parsed as Record<string, unknown> | null; return [o?.contents, o?.items, o?.data, o?.answers, o?.articles].find((x) => Array.isArray(x)) || []; })();
  return arr
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map(looseExtract);
}

export function slugifyName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
}

export function saveArtifactFiles(artifact: ProfileArtifact, outDir: string): { slug: string; jsonPath: string; mdPath: string; candidatesPath: string | null } {
  const slug = slugifyName(artifact.subject.name || 'person');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${slug}.profile.json`);
  const mdPath = path.join(outDir, `${slug}.report.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(artifact, null, 2), 'utf8');
  fs.writeFileSync(mdPath, renderReport(artifact), 'utf8');
  let candidatesPath: string | null = null;
  if (artifact.candidates?.length) {
    candidatesPath = path.join(outDir, `${slug}.candidates.json`);
    fs.writeFileSync(candidatesPath, JSON.stringify(artifact.candidates, null, 2), 'utf8');
  }
  return { slug, jsonPath, mdPath, candidatesPath };
}

export interface ArtifactSummary { slug: string; name: string; contentCount: number; generatedAt: string; timeRange: string | null; mtime: string }

export function listArtifacts(outDir: string): ArtifactSummary[] {
  if (!fs.existsSync(outDir)) return [];
  const out: ArtifactSummary[] = [];
  for (const f of fs.readdirSync(outDir)) {
    if (!f.endsWith('.profile.json')) continue;
    try {
      const a = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')) as ProfileArtifact;
      out.push({
        slug: f.replace(/\.profile\.json$/, ''),
        name: a.subject?.name || f,
        contentCount: a.meta?.content_count ?? 0,
        generatedAt: a.meta?.generated_at || '',
        timeRange: a.meta?.time_range ? `${a.meta.time_range.from} ~ ${a.meta.time_range.to}` : null,
        mtime: fs.statSync(path.join(outDir, f)).mtime.toISOString(),
      });
    } catch { /* 单个产物损坏不阻塞列表 */ }
  }
  return out.sort((x, y) => y.mtime.localeCompare(x.mtime));
}

export function readArtifactFile(outDir: string, slug: string): ProfileArtifact | null {
  if (!/^[^\\/]+$/.test(slug)) return null; // 防路径穿越
  const p = path.join(outDir, `${slug}.profile.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as ProfileArtifact;
  } catch {
    return null;
  }
}

export interface CrawlerInput { file: string; name: string; count: number; timeRange: string | null }

/** 列出 data/crawler 下可分析的输入文件(宽松解析,只取统计信息) */
export function listCrawlerInputs(dataDir: string): CrawlerInput[] {
  if (!fs.existsSync(dataDir)) return [];
  const out: CrawlerInput[] = [];
  for (const f of fs.readdirSync(dataDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed?.contents, parsed?.items, parsed?.data].find(Array.isArray) || [];
      const dated = items.map((x: any) => Number(x?.published_at ?? x?.created_time ?? 0)).filter((n) => n > 0);
      const fmt = (n: number) => new Date(n * (n > 1e12 ? 1 : 1000)).toISOString().slice(0, 10);
      out.push({
        file: f,
        name: f.replace(/\.json$/, ''),
        count: items.length,
        timeRange: dated.length ? `${fmt(Math.min(...dated))} ~ ${fmt(Math.max(...dated))}` : null,
      });
    } catch { /* 跳过不可解析文件 */ }
  }
  return out.sort((x, y) => x.file.localeCompare(y.file));
}
