import fs from 'node:fs';
import path from 'node:path';
import { renderReport } from './report.ts';
import type { ProfileArtifact, RawContent } from './schema.ts';

// ============ 画像产物存取(CLI 与 /profile API 共用) ============

/** 规范化字段名：小写并去掉下划线/空格/连字符，使 Content / content_text / Created-Time 互认。 */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, '');
}

/** 把嵌套对象（如知乎开放平台的 Target/Content 子对象）提升一层，不覆盖已有非空字段。 */
function flattenOneLevel(obj: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        const existing = flat[k2];
        if (existing === undefined || existing === null || existing === '') flat[k2] = v2;
      }
    } else {
      flat[k] = v;
    }
  }
  return flat;
}

/** 知乎正文常是 HTML 片段：仅当检测到标签时才清洗，避免误伤含 < > 的纯文本。 */
function cleanHtml(s: string): string {
  if (!/<\s*(p|div|br|img|span|a|section|li|h[1-6])[\s>/]/i.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 宽松字段映射:id/title/question_title/content/content_text/excerpt/desc/author/nickname/publish_time/created_at...
 *  兼容大小写/下划线差异（知乎开放平台返回 Content/Excerpt 等大写驼峰）与一层嵌套对象。 */
export function looseExtract(obj: Record<string, unknown>): RawContent {
  const flat = flattenOneLevel(obj);
  const norm = new Map<string, unknown>();
  for (const [k, v] of Object.entries(flat)) norm.set(normKey(k), v);
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = norm.get(normKey(k));
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return undefined;
  };
  const dateRaw = pick('published_at', 'publish_time', 'created_at', 'created_time', 'date');
  const dateNum = dateRaw !== undefined && /^-?\d+(\.\d+)?$/.test(dateRaw) ? Number(dateRaw) : undefined;
  const rawText = pick('content', 'content_text', 'text', 'excerpt', 'desc', 'description', 'summary', 'contenthtml', 'body') ?? '';
  return {
    id: pick('id', 'content_id', 'cid'),
    title: pick('title', 'question_title', 'post_title', 'name'),
    text: cleanHtml(rawText),
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

/**
 * 调试/对比用产物不该出现在展示端的切换列表里。
 *
 * 这些文件是调参过程中的中间产物（字数截断对比、小模型冒烟、虚构样本），
 * 保留在磁盘上供比对，但不作为正式画像对外展示。
 * 用显式模式匹配而不是宽泛通配，避免误伤真实用户 slug。
 */
const DEBUG_ARTIFACT_PATTERNS: RegExp[] = [
  /-smoke$/i,             // 冒烟测试产物（含 -qwen-smoke）
  /-\d+字$/,              // 字数截断对比（YY硕-6000字）
  /^林一舟\(测试样本\)$/,   // 虚构测试样本
  /^sample-/i,
];

export function isDebugArtifact(slug: string): boolean {
  return DEBUG_ARTIFACT_PATTERNS.some((re) => re.test(slug));
}

export function listArtifacts(outDir: string, options: { includeDebug?: boolean } = {}): ArtifactSummary[] {
  if (!fs.existsSync(outDir)) return [];
  const out: ArtifactSummary[] = [];
  for (const f of fs.readdirSync(outDir)) {
    if (!f.endsWith('.profile.json')) continue;
    const slug = f.replace(/\.profile\.json$/, '');
    if (!options.includeDebug && isDebugArtifact(slug)) continue;
    try {
      const a = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')) as ProfileArtifact;
      out.push({
        slug,
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

/** 可选的输入元数据:data/crawler/<同名>.meta.json → {name?, avatarUrl?, profileUrl?} */
export interface InputMeta { name?: string; avatarUrl?: string; profileUrl?: string }

export function readInputMeta(dataDir: string, jsonFile: string): InputMeta | null {
  const metaPath = path.join(dataDir, jsonFile.replace(/\.json$/, '.meta.json'));
  if (metaPath === path.join(dataDir, jsonFile)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return { name: parsed.name, avatarUrl: parsed.avatarUrl, profileUrl: parsed.profileUrl };
  } catch {
    return null;
  }
}

/** 本地头像解析:public/avatars/<slug>.(jpg|jpeg|png|webp),没有则返回 null(前端回退水墨兜底图) */
export function resolveLocalAvatar(publicDir: string, slug: string): string | null {
  if (!/^[^\\/]+$/.test(slug)) return null;
  const dir = path.join(publicDir, 'avatars');
  if (!fs.existsSync(dir)) return null;
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    if (fs.existsSync(path.join(dir, `${slug}.${ext}`))) return `/avatars/${slug}.${ext}`;
  }
  return null;
}

/** 列出 data/crawler 下可分析的输入文件(宽松解析,只取统计信息) */
export function listCrawlerInputs(dataDir: string): CrawlerInput[] {
  if (!fs.existsSync(dataDir)) return [];
  const out: CrawlerInput[] = [];
  for (const f of fs.readdirSync(dataDir)) {
    if (!f.endsWith('.json')) continue;
    // 点开头的都是引擎自建的缓存/中间态（.extract-cache*.json），不是用户投放的采集结果。
    // 放进去只会给"生成画像"下拉框添乱（count=0，点了必然失败）。
    if (f.startsWith('.')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed?.contents, parsed?.items, parsed?.data].find(Array.isArray) || [];
      if (items.length === 0) continue; // 空壳文件没有生成价值
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
