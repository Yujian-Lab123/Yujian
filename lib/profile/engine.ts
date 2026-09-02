import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CandidateBatchSchema,
  LIMITS,
  MINS,
  ProfileSchema,
  type Candidate,
  type EvidenceItem,
  type NormalizedContent,
  type Profile,
  type ProfileArtifact,
  type RawContent,
} from './schema.ts';
import { EXTRACT_SYSTEM, PROMPT_VERSION, SYNTH_SYSTEM, extractUserPrompt, synthesizeUserPrompt } from './prompt.ts';
import { chatCompletion, llmConfigured } from '../providers/llm.ts';

// ============ 人物画像分析引擎(离线管线) ============
// 原始内容 → 归一化 → [便宜模型]逐批提取候选线索(带缓存/并发/重试) → [主模型]压缩漏斗 → 综合画像 → 证据消毒。
// 对应《总体概览》"LLM 离线理解,只认真做一次,增量更新";与在线匹配管线(matcher)完全解耦。

const TYPE_ALIAS: Record<string, string> = {
  answer: '回答', article: '文章', post: '回答', pin: '想法', idea: '想法',
  comment: '评论', video: '视频', question: '提问', column: '文章',
};

const EXTRACT_OPTS = {
  json: true,
  model: process.env.LLM_CHEAP_MODEL || undefined,
  // 可选:抽取层走另一家更快的厂商(如 deepseek-chat / qwen-flash),留空则与主模型同源
  baseUrl: process.env.LLM_CHEAP_BASE_URL || undefined,
  maxTokens: 16_000, // mimo 是推理模型:max_completion_tokens 包含 reasoning,实测思考约占 4k,需给正文留足空间
  temperature: 0.2,
  timeoutMs: 180_000,
} as const;

const SYNTH_OPTS = {
  json: true,
  maxTokens: 32_000, // 推理空间 + 完整画像 JSON
  temperature: 0.2,
  timeoutMs: 300_000,
} as const;

export interface AnalyzeOptions {
  name?: string | null;
  batchSize?: number;      // 每批送抽取的内容条数
  maxTextChars?: number;   // 单条正文截断长度
  maxCandidates?: number;  // 候选线索总量上限
  maxItems?: number;       // 单人内容条数上限(超出的按时间均匀采样,保留跨年证据)
  cacheFile?: string;      // 抽取缓存文件路径;内容未变则跳过该条的 LLM 调用
}

// ---- 抽取缓存:键 = 提示词版本 + 模型 + 内容 id + 正文哈希;任一变化自动失效 ----

interface ExtractCache { version: 1; entries: Record<string, Candidate[]> }

function cacheKey(model: string, cheap: string, c: NormalizedContent): string {
  return createHash('sha1').update([PROMPT_VERSION, model, cheap, c.id, c.text].join('\u0000')).digest('hex');
}

function loadCache(file?: string): ExtractCache {
  if (!file) return { version: 1, entries: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw?.version === 1 && raw.entries) return raw as ExtractCache;
  } catch { /* 首次或损坏时从空开始 */ }
  return { version: 1, entries: {} };
}

function saveCache(file: string | undefined, cache: ExtractCache): void {
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache));
  } catch { /* 缓存写失败不影响主流程 */ }
}

// ---- 归一化:兼容 media-crawler / 知乎 API / 手写 JSON 的常见字段名 ----

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function normalizeDate(v: RawContent['published_at']): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

export function normalizeContents(raw: RawContent[]): NormalizedContent[] {
  const out: NormalizedContent[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const text = stripHtml(String(r.text || ''));
    if (!text.trim()) continue;
    const type = TYPE_ALIAS[String(r.type || '').toLowerCase()] || String(r.type || '内容');
    out.push({
      id: String(r.id || `c-${String(i + 1).padStart(3, '0')}`),
      title: String(r.title || '').trim(),
      text,
      type,
      url: r.url ? String(r.url) : null,
      published_at: normalizeDate(r.published_at),
    });
  }
  const dated = out.filter((c) => c.published_at);
  dated.sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)));
  return dated.concat(out.filter((c) => !c.published_at));
}

// ---- 第一阶段:逐批提取候选线索(并发 3,缓存跳过未变化内容,失败批次自动重试 1 次) ----

const EXTRACT_CONCURRENCY = 3;
const EXTRACT_RETRIES = 1;

async function extractCandidates(
  contents: NormalizedContent[],
  maxCandidates: number,
  cache: ExtractCache,
  cacheFile?: string,
): Promise<{ candidates: Candidate[]; warnings: string[]; cacheHits: number; cacheTotal: number }> {
  const model = process.env.LLM_MODEL || 'default';
  const cheap = process.env.LLM_CHEAP_MODEL || model;
  const warnings: string[] = [];

  // 命中缓存的直接取,未命中的才走 LLM
  const results: (Candidate[] | null)[] = contents.map((c) => cache.entries[cacheKey(model, cheap, c)] ?? null);
  const cacheHits = results.filter(Boolean).length;
  const pendingIdx = contents.map((_, i) => i).filter((i) => !results[i]);

  const batches: number[][] = [];
  for (let i = 0; i < pendingIdx.length; i += 8) batches.push(pendingIdx.slice(i, i + 8));
  const started = Date.now();
  let done = 0;
  let next = 0;

  async function extractBatchOnce(batchIdxs: number[]): Promise<{ ok: boolean; found: Candidate[] }> {
    const batch = batchIdxs.map((i) => contents[i]);
    const raw = await chatCompletion(EXTRACT_SYSTEM, extractUserPrompt(batch), { ...EXTRACT_OPTS });
    if (!raw) return { ok: false, found: [] };
    const parsed = CandidateBatchSchema.safeParse(safeJson(raw));
    if (!parsed.success) return { ok: false, found: [] };
    const validIds = new Set(batch.map((b) => b.id));
    return { ok: true, found: parsed.data.candidates.filter((c) => validIds.has(c.content_id)) };
  }

  async function worker(): Promise<void> {
    while (next < batches.length) {
      const idx = next++;
      const batchIdxs = batches[idx];
      let outcome = await extractBatchOnce(batchIdxs);
      for (let r = 0; !outcome.ok && r < EXTRACT_RETRIES; r++) outcome = await extractBatchOnce(batchIdxs);
      if (outcome.ok) {
        for (const i of batchIdxs) {
          results[i] = outcome.found.filter((c) => c.content_id === contents[i].id);
          cache.entries[cacheKey(model, cheap, contents[i])] = results[i] as Candidate[];
        }
      } else {
        warnings.push(`抽取批次 ${idx + 1} 重试后仍失败(LLM 未返回或输出不合 schema),该批 ${batchIdxs.length} 条内容的线索缺失。`);
      }
      done++;
      const secs = Math.round((Date.now() - started) / 1000);
      console.error(`[engine] 抽取进度 ${done}/${batches.length} 批(缓存命中 ${cacheHits}/${contents.length},累计 ${results.filter(Boolean).flat().length} 条线索,${secs}s)`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(EXTRACT_CONCURRENCY, batches.length) }, worker));
  saveCache(cacheFile, cache);

  const candidates = results.filter((r): r is Candidate[] => r !== null).flat();
  if (candidates.length > maxCandidates) candidates.length = maxCandidates;
  return { candidates, warnings, cacheHits, cacheTotal: contents.length };
}

// ---- 第二阶段:压缩漏斗 + 综合(校验失败带错误重试一次) ----

async function synthesizeProfile(
  name: string | null,
  contents: NormalizedContent[],
  candidates: Candidate[],
): Promise<{ profile: Profile; warnings: string[] }> {
  const warnings: string[] = [];
  const clues = candidates.map((c) => ({ content_id: c.content_id, kind: c.kind, note: c.note }));
  let resynthesisError: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await chatCompletion(SYNTH_SYSTEM, synthesizeUserPrompt({ name, contents, candidates: clues, resynthesisError }), SYNTH_OPTS);
    if (!raw) throw new Error('LLM 未返回综合结果(检查 LLM_* 配置或稍后重试)。');
    const parsed = ProfileSchema.safeParse(safeJson(raw));
    if (parsed.success) return { profile: parsed.data, warnings };
    resynthesisError = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 10).join('; ');
    warnings.push(`综合输出第 ${attempt} 次未通过 schema 校验。`);
  }
  throw new Error(`画像 JSON 两次校验均失败:${resynthesisError}`);
}

// ---- 证据消毒:evidence_ids 必须真实存在;无证据的结论删除;unknown 结论挪入 unknowns ----

function sanitizeProfile(profile: Profile, validIds: Set<string>, contents: NormalizedContent[]): { profile: Profile; warnings: string[] } {
  const warnings: string[] = [];
  const p: Profile = JSON.parse(JSON.stringify(profile));

  const okIds = (ids: string[]): string[] => ids.filter((id) => validIds.has(id));
  const dropped = (what: string, why: string) => warnings.push(`${what}${why}`);

  const withEvidence = <T extends { evidence_ids: string[] }>(items: T[], label: string, limit: number, min: number): T[] => {
    const kept = items
      .map((it) => ({ ...it, evidence_ids: okIds(it.evidence_ids) }))
      .filter((it) => {
        if (it.evidence_ids.length === 0) { dropped(`${label} 1 条「${(it as any).claim || (it as any).question || (it as any).event || (it as any).driver || (it as any).name || (it as any).trait || ''}」`, '因证据 id 无效被删除'); return false; }
        return true;
      })
      .slice(0, limit);
    if (kept.length < min) warnings.push(`${label} 仅 ${kept.length} 条(建议 ≥${min}),证据可能不足。`);
    return kept;
  };

  // summary:unknown 类型 → unknowns;无证据删除;去重;截断
  const movedUnknowns: string[] = [];
  const seenClaims = new Set<string>();
  const core = withEvidence(p.summary.core_insights, '核心结论', LIMITS.core_insights, MINS.core_insights)
    .filter((c) => {
      if (c.type === 'unknown') { movedUnknowns.push(c.claim); return false; }
      const key = c.claim.replace(/\s+/g, '');
      if (seenClaims.has(key)) { dropped('核心结论 1 条', '因与其他结论重复被合并删除'); return false; }
      seenClaims.add(key);
      return true;
    });
  p.summary.core_insights = core;

  p.life_trajectory = withEvidence(p.life_trajectory, '人生轨迹', LIMITS.life_trajectory, MINS.life_trajectory);
  p.long_term_concerns = withEvidence(p.long_term_concerns, '长期关切', LIMITS.long_term_concerns, MINS.long_term_concerns);
  p.drivers = withEvidence(p.drivers, '驱动力', LIMITS.drivers, MINS.drivers);
  p.decision_patterns = withEvidence(p.decision_patterns, '决策模式', LIMITS.decision_patterns, MINS.decision_patterns);
  p.value_preferences = withEvidence(p.value_preferences, '价值偏好', LIMITS.value_preferences, MINS.value_preferences);
  p.conversation_style.traits = withEvidence(p.conversation_style.traits, '对话风格', LIMITS.traits, MINS.traits);
  p.conversation_style.good_entry_points = p.conversation_style.good_entry_points.slice(0, LIMITS.good_entry_points);

  const before = p.representative_contents.length;
  p.representative_contents = p.representative_contents
    .filter((r) => validIds.has(r.content_id))
    .slice(0, LIMITS.representative_contents);
  if (p.representative_contents.length < before) dropped('代表内容部分条目', '因 content_id 无效被删除');
  if (p.representative_contents.length < MINS.representative_contents) warnings.push(`代表内容仅 ${p.representative_contents.length} 篇(建议 ≥${MINS.representative_contents})。`);

  p.unknowns = [...p.unknowns, ...movedUnknowns].map((s) => String(s).trim()).filter(Boolean).slice(0, LIMITS.unknowns);

  // 无日期内容占比提示
  const undated = contents.filter((c) => !c.published_at).length;
  if (undated > 0) warnings.push(`${undated} 条内容缺少发布时间,长期稳定性判断的证据力下降。`);
  return { profile: p, warnings };
}

// ---- 主入口 ----

export async function analyzeProfile(raw: RawContent[], opts: AnalyzeOptions = {}): Promise<ProfileArtifact> {
  if (!llmConfigured()) throw new Error('LLM 未配置:请在 .env.local 设置 LLM_BASE_URL / LLM_API_KEY。');
  let contents = normalizeContents(raw);
  if (contents.length === 0) throw new Error('没有可分析的内容(全部为空文本)。');

  // 条数上限:超出时按时间均匀采样(保头保尾,保留跨年证据),而不是只取最新
  const maxItems = opts.maxItems ?? 80;
  if (contents.length > maxItems) {
    const step = (contents.length - 1) / (maxItems - 1);
    contents = Array.from({ length: maxItems }, (_, i) => contents[Math.floor(i * step)]);
    console.error(`[engine] 内容 ${contents.length} 条超过上限,已按时间均匀采样至 ${maxItems} 条。`);
  }

  const maxText = opts.maxTextChars ?? 3000;
  const trimmed: NormalizedContent[] = contents.map((c) => ({ ...c, text: c.text.slice(0, maxText) }));

  const cache = loadCache(opts.cacheFile);
  const { candidates, warnings, cacheHits, cacheTotal } = await extractCandidates(trimmed, opts.maxCandidates ?? 400, cache, opts.cacheFile);
  if (candidates.length === 0) throw new Error('第一阶段未提取到任何候选线索,无法生成画像。');

  console.error(`[engine] 抽取完成,开始综合(压缩漏斗 → 六维画像,单次大调用,推理模型较慢,请耐心等待)…`);
  const { profile, warnings: synthWarnings } = await synthesizeProfile(opts.name ?? null, trimmed, candidates);
  const validIds = new Set(contents.map((c) => c.id));
  const sanitized = sanitizeProfile(profile, validIds, contents);

  const dated = contents.filter((c) => c.published_at).map((c) => String(c.published_at));
  const typeCounts: Record<string, number> = {};
  for (const c of contents) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;

  return {
    schema_version: 1,
    subject: { name: opts.name ?? null },
    meta: {
      generated_at: new Date().toISOString(),
      prompt_version: PROMPT_VERSION,
      models: { main: process.env.LLM_MODEL || 'default', cheap: process.env.LLM_CHEAP_MODEL || process.env.LLM_MODEL || 'default' },
      content_count: contents.length,
      time_range: dated.length ? { from: dated[0].slice(0, 10), to: dated[dated.length - 1].slice(0, 10) } : null,
      type_counts: typeCounts,
      warnings: [...warnings, ...synthWarnings, ...sanitized.warnings],
      cache: { hits: cacheHits, total: cacheTotal },
    },
    evidence_index: contents.map((c): EvidenceItem => ({
      id: c.id, title: c.title, type: c.type, url: c.url, date: c.published_at?.slice(0, 10) || null,
      excerpt: c.text.slice(0, 160),
    })),
    profile: sanitized.profile,
    candidates,
  };
}

function safeJson(text: string): unknown {
  // 兼容模型偶尔在 JSON 外包裹 ```json 围栏的情况
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  return JSON.parse(start > 0 ? body.slice(start) : body);
}
