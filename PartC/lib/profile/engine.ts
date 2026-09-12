import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ContentAnalysisBatchSchema,
  LIMITS,
  MINS,
  ProfileSchema,
  type Candidate,
  type ContentAnalysis,
  type ContentAnalysisRecord,
  type EvidenceItem,
  type NormalizedContent,
  type Profile,
  type ProfileArtifact,
  type RawContent,
} from './schema.ts';
import { EXTRACT_SYSTEM, PROMPT_VERSION, SYNTH_SYSTEM, extractUserPrompt, synthesizeUserPrompt } from './prompt.ts';
import { chatCompletion, llmConfigured } from '../providers/llm.ts';
import {
  configuredEmbeddingDimensions,
  embedTexts,
  embeddingConfigured,
  embeddingSpaceId,
} from '../providers/embedding.ts';
import { analysisEmbeddingText, contentSourceHash, diffContentAnalyses } from './incremental.ts';

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
  // Qwen Flash 在关闭思考后只需覆盖候选线索 JSON；较低上限避免爬虫小样本产生失控费用。
  maxTokens: 4_096,
  temperature: 0.2,
  timeoutMs: 180_000,
  thinking: false,
} as const;

const SYNTH_OPTS = {
  json: true,
  // 六维画像完整 JSON 正常远低于此上限，保留余量以避免截断。
  maxTokens: 8_192,
  temperature: 0.2,
  timeoutMs: 300_000,
  thinking: false,
} as const;

export interface AnalyzeOptions {
  name?: string | null;
  batchSize?: number;      // 每批送抽取的内容条数
  maxTextChars?: number;   // 单条正文参与分析的总长度上限
  chunkChars?: number;     // 长文分块大小；同一内容的片段在便宜模型内合并摘要
  maxCandidates?: number;  // 候选线索总量上限
  maxItems?: number;       // 单人内容条数上限(超出的取最新 N 篇)
  cacheFile?: string;      // 抽取缓存文件路径;内容未变则跳过该条的 LLM 调用
  previousArtifact?: ProfileArtifact | null; // 上一次产物；内容未变时复用画像，变化时只重做新增/修改内容
  onProgress?: (p: { stage: 'extract' | 'synthesize' | 'embed'; message: string; batchDone?: number; batchTotal?: number; clues?: number; cacheHits?: number; cacheTotal?: number }) => void;
}

// ---- 抽取缓存:键 = 提示词版本 + 模型 + 内容 id + 正文哈希;任一变化自动失效 ----

interface ExtractCache { version: 2; entries: Record<string, ContentAnalysis> }

function cacheKey(model: string, cheap: string, chunkChars: number, content: NormalizedContent): string {
  return createHash('sha1')
    .update([PROMPT_VERSION, model, cheap, String(chunkChars), contentSourceHash(content)].join('\u0000'))
    .digest('hex');
}

function loadCache(file?: string): ExtractCache {
  if (!file) return { version: 2, entries: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw?.version === 2 && raw.entries) return raw as ExtractCache;
  } catch { /* 首次或损坏时从空开始 */ }
  return { version: 2, entries: {} };
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
  // 合并回答/文章输入时可能重复出现同一 content id；以最后一份为准，避免重复花费。
  const deduplicated = [...new Map(out.map((content) => [content.id, content] as const)).values()];
  const dated = deduplicated.filter((c) => c.published_at);
  dated.sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)));
  return dated.concat(deduplicated.filter((c) => !c.published_at));
}

// ---- 第一阶段:逐内容摘要 + 候选线索(并发 3,缓存/上次产物跳过未变化内容,失败重试 1 次) ----

const EXTRACT_CONCURRENCY = 3;
const EXTRACT_RETRIES = 1;

async function extractContentAnalyses(
  contents: NormalizedContent[],
  maxCandidates: number,
  cache: ExtractCache,
  previous: ContentAnalysisRecord[],
  chunkChars: number,
  cacheFile?: string,
  onProgress?: AnalyzeOptions['onProgress'],
): Promise<{ analyses: ContentAnalysisRecord[]; candidates: Candidate[]; warnings: string[]; cacheHits: number; cacheTotal: number }> {
  const model = process.env.LLM_MODEL || 'default';
  const cheap = process.env.LLM_CHEAP_MODEL || model;
  const warnings: string[] = [];
  const previousById = new Map(previous.map((item) => [item.content_id, item] as const));

  // 上次产物或磁盘缓存命中的直接取，未命中的才走 LLM。
  const results: (ContentAnalysis | null)[] = contents.map((content) => {
    const old = previousById.get(content.id);
    if (old?.source_hash === contentSourceHash(content)) {
      return {
        content_id: old.content_id,
        summary: old.summary,
        topics: old.topics,
        key_questions: old.key_questions,
        candidates: old.candidates,
      };
    }
    return cache.entries[cacheKey(model, cheap, chunkChars, content)] ?? null;
  });
  const cacheHits = results.filter(Boolean).length;
  const pendingIdx = contents.map((_, i) => i).filter((i) => !results[i]);

  const batches: number[][] = [];
  for (let i = 0; i < pendingIdx.length; i += 6) batches.push(pendingIdx.slice(i, i + 6));
  const started = Date.now();
  let done = 0;
  let next = 0;

  async function extractBatchOnce(batchIdxs: number[]): Promise<{ ok: boolean; found: ContentAnalysis[] }> {
    const batch = batchIdxs.map((i) => contents[i]);
    const raw = await chatCompletion(EXTRACT_SYSTEM, extractUserPrompt(batch, chunkChars), { ...EXTRACT_OPTS });
    if (!raw) return { ok: false, found: [] };
    const parsed = ContentAnalysisBatchSchema.safeParse(safeJson(raw));
    if (!parsed.success) return { ok: false, found: [] };
    const validIds = new Set(batch.map((b) => b.id));
    return {
      ok: true,
      found: parsed.data.analyses
        .filter((analysis) => validIds.has(analysis.content_id))
        .map((analysis) => ({
          ...analysis,
          candidates: analysis.candidates.filter((candidate) => candidate.content_id === analysis.content_id),
        })),
    };
  }

  async function worker(): Promise<void> {
    while (next < batches.length) {
      const idx = next++;
      const batchIdxs = batches[idx];
      let outcome = await extractBatchOnce(batchIdxs);
      for (let r = 0; !outcome.ok && r < EXTRACT_RETRIES; r++) outcome = await extractBatchOnce(batchIdxs);
      if (outcome.ok) {
        const foundById = new Map(outcome.found.map((analysis) => [analysis.content_id, analysis] as const));
        for (const i of batchIdxs) {
          const content = contents[i];
          const analysis = foundById.get(content.id);
          if (!analysis) {
            warnings.push(`内容 ${content.id} 的摘要在模型输出中缺失，该条未进入画像综合。`);
            continue;
          }
          results[i] = analysis;
          cache.entries[cacheKey(model, cheap, chunkChars, content)] = analysis;
        }
      } else {
        warnings.push(`摘要/抽取批次 ${idx + 1} 重试后仍失败(LLM 未返回或输出不合 schema),该批 ${batchIdxs.length} 条内容未进入画像综合。`);
      }
      done++;
      const secs = Math.round((Date.now() - started) / 1000);
      const clues = results.filter((item): item is ContentAnalysis => item !== null)
        .reduce((sum, item) => sum + item.candidates.length, 0);
      const message = `抽取进度 ${done}/${batches.length} 批(缓存命中 ${cacheHits}/${contents.length},累计 ${clues} 条线索,${secs}s)`;
      console.error(`[engine] ${message}`);
      onProgress?.({ stage: 'extract', message, batchDone: done, batchTotal: batches.length, clues, cacheHits, cacheTotal: contents.length });
    }
  }

  await Promise.all(Array.from({ length: Math.min(EXTRACT_CONCURRENCY, batches.length) }, worker));
  saveCache(cacheFile, cache);

  const analyses = results
    .map((analysis, index): ContentAnalysisRecord | null => analysis ? {
      ...analysis,
      source_hash: contentSourceHash(contents[index]),
    } : null)
    .filter((analysis): analysis is ContentAnalysisRecord => analysis !== null);
  const candidates = analyses.flatMap((analysis) => analysis.candidates);
  if (candidates.length > maxCandidates) candidates.length = maxCandidates;
  return { analyses, candidates, warnings, cacheHits, cacheTotal: contents.length };
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

type ArtifactEmbeddings = NonNullable<ProfileArtifact['embeddings']>;
type EmbeddingMeta = NonNullable<ProfileArtifact['meta']['embedding']>;

function profileEmbeddingDocuments(profile: Profile): [string, string, string] {
  const longTerm = [
    profile.summary.one_sentence,
    ...profile.summary.core_insights.map((item) => item.claim),
    ...profile.long_term_concerns.map((item) => item.question),
    ...profile.drivers.map((item) => item.driver),
  ].join('\n');
  const value = profile.value_preferences
    .map((item) => `${item.left} ↔ ${item.right}：${item.lean}。${item.explanation}`)
    .join('\n');
  const conversation = [
    ...profile.conversation_style.traits.map((item) => `${item.trait}：${item.explanation}`),
    ...profile.conversation_style.good_entry_points.map((item) => `适合的对话入口：${item}`),
  ].join('\n');
  return [longTerm, value || longTerm, conversation || longTerm];
}

async function generateEmbeddings(input: {
  profile: Profile;
  analyses: ContentAnalysisRecord[];
  previous?: ArtifactEmbeddings;
  profileChanged: boolean;
  onProgress?: AnalyzeOptions['onProgress'];
}): Promise<{ embeddings?: ArtifactEmbeddings; meta: EmbeddingMeta; warning?: string; reused: number }> {
  const configured = embeddingConfigured();
  const model = process.env.EMBED_MODEL || null;
  const baseUrl = process.env.EMBED_BASE_URL || '';
  const dimensions = configuredEmbeddingDimensions();
  const currentSpaceId = model && baseUrl ? embeddingSpaceId(baseUrl, model, dimensions) : null;
  const compatible = Boolean(input.previous && model && currentSpaceId
    && input.previous.model === model && input.previous.space_id === currentSpaceId);

  if (!configured) {
    if (input.previous && !input.profileChanged) {
      return {
        embeddings: input.previous,
        meta: {
          status: 'reused', provider: input.previous.provider,
          model: input.previous.model, dimensions: input.previous.dimensions,
        },
        reused: input.previous.contents.length + 3,
      };
    }
    return {
      meta: { status: 'not_configured', provider: null, model, dimensions: null },
      warning: '未配置 EMBED_BASE_URL / EMBED_API_KEY / EMBED_MODEL；本次保留画像产物，不生成真实向量。',
      reused: 0,
    };
  }

  const reusableContents = compatible && input.previous ? input.previous.contents : [];
  const previousContents = new Map(reusableContents.map((item) => [item.content_id, item] as const));
  const reusableProfile = Boolean(compatible && !input.profileChanged && input.previous);
  const profileDocs = profileEmbeddingDocuments(input.profile);
  const pendingTexts: string[] = [];
  const pendingTargets: Array<{ kind: 'profile'; index: number } | { kind: 'content'; contentId: string }> = [];
  let reused = 0;

  if (!reusableProfile) {
    profileDocs.forEach((text, index) => {
      pendingTexts.push(text);
      pendingTargets.push({ kind: 'profile', index });
    });
  } else {
    reused += 3;
  }

  for (const analysis of input.analyses) {
    const old = previousContents.get(analysis.content_id);
    if (old?.source_hash === analysis.source_hash) {
      reused += 1;
      continue;
    }
    pendingTexts.push(analysisEmbeddingText(analysis));
    pendingTargets.push({ kind: 'content', contentId: analysis.content_id });
  }

  input.onProgress?.({
    stage: 'embed',
    message: `开始生成真实向量：新增 ${pendingTexts.length} 个，复用 ${reused} 个。`,
    cacheHits: reused,
    cacheTotal: input.analyses.length + 3,
  });

  const generated = pendingTexts.length ? await embedTexts(pendingTexts, { dimensions }) : null;
  if (pendingTexts.length && !generated) {
    return {
      meta: { status: 'failed', provider: 'openai-compatible', model, dimensions: null },
      warning: 'Embedding 调用失败或响应未通过校验；画像仍已生成，但本次不保存不完整向量。',
      reused,
    };
  }

  const profileVectors = reusableProfile && input.previous
    ? [input.previous.profile.long_term, input.previous.profile.value, input.previous.profile.conversation]
    : [[], [], []] as number[][];
  const contentVectors = new Map<string, { content_id: string; source_hash: string; vector: number[] }>();
  for (const analysis of input.analyses) {
    const old = previousContents.get(analysis.content_id);
    if (old?.source_hash === analysis.source_hash) contentVectors.set(analysis.content_id, old);
  }

  generated?.vectors.forEach((vector, index) => {
    const target = pendingTargets[index];
    if (target.kind === 'profile') profileVectors[target.index] = vector;
    else {
      const analysis = input.analyses.find((item) => item.content_id === target.contentId);
      if (analysis) contentVectors.set(target.contentId, { content_id: target.contentId, source_hash: analysis.source_hash, vector });
    }
  });

  const outputDimensions = generated?.dimensions || input.previous?.dimensions || 0;
  const allVectors = [...profileVectors, ...contentVectors.values()].map((item) => Array.isArray(item) ? item : item.vector);
  const complete = profileVectors.every((vector) => vector.length === outputDimensions)
    && input.analyses.every((analysis) => contentVectors.get(analysis.content_id)?.vector.length === outputDimensions)
    && allVectors.every((vector) => vector.every((value) => Number.isFinite(value)));
  if (!outputDimensions || !complete) {
    return {
      meta: { status: 'failed', provider: 'openai-compatible', model, dimensions: outputDimensions || null },
      warning: 'Embedding 新旧向量维度不一致或结果不完整；为避免污染索引，本次不保存向量。',
      reused,
    };
  }

  const embeddings: ArtifactEmbeddings = {
    provider: 'openai-compatible',
    model: model as string,
    space_id: generated?.spaceId || currentSpaceId as string,
    dimensions: outputDimensions,
    generated_at: new Date().toISOString(),
    profile: {
      long_term: profileVectors[0],
      value: profileVectors[1],
      conversation: profileVectors[2],
    },
    contents: input.analyses.map((analysis) => contentVectors.get(analysis.content_id) as ArtifactEmbeddings['contents'][number]),
  };
  return {
    embeddings,
    meta: { status: pendingTexts.length ? 'generated' : 'reused', provider: embeddings.provider, model: embeddings.model, dimensions: outputDimensions },
    reused,
  };
}

// ---- 主入口 ----

export async function analyzeProfile(raw: RawContent[], opts: AnalyzeOptions = {}): Promise<ProfileArtifact> {
  let contents = normalizeContents(raw);
  if (contents.length === 0) throw new Error('没有可分析的内容(全部为空文本)。');

  // 条数上限:超出时取最新的 N 篇(内容已按时间升序)
  const maxItems = Number.isFinite(opts.maxItems) ? Math.max(1, Math.floor(opts.maxItems as number)) : 80;
  if (contents.length > maxItems) {
    contents = contents.slice(-maxItems);
    console.error(`[engine] 内容超过上限,取最新 ${maxItems} 篇参与分析。`);
  }

  // 默认最多保留 4 个 3000 字片段；避免只看文章开头，也限制单篇成本。
  const maxText = Number.isFinite(opts.maxTextChars) ? Math.max(400, Math.floor(opts.maxTextChars as number)) : 12_000;
  const chunkChars = Number.isFinite(opts.chunkChars) ? Math.max(400, Math.floor(opts.chunkChars as number)) : 3_000;
  const trimmed: NormalizedContent[] = contents.map((c) => ({ ...c, text: c.text.slice(0, maxText) }));
  const previous = opts.previousArtifact || null;
  const previousAnalyses = previous?.meta.prompt_version === PROMPT_VERSION
    ? previous.content_analyses || []
    : [];
  const diff = diffContentAnalyses(trimmed, previousAnalyses);
  const profileChanged = !previous || diff.added.length > 0 || diff.changed.length > 0 || diff.removed.length > 0;

  let analyses: ContentAnalysisRecord[];
  let candidates: Candidate[];
  let profile: Profile;
  let warnings: string[] = [];
  let synthWarnings: string[] = [];
  let sanitizedWarnings: string[] = [];
  let cacheHits = 0;
  let cacheTotal = trimmed.length;

  if (!profileChanged && previous) {
    const byId = new Map(previousAnalyses.map((item) => [item.content_id, item] as const));
    analyses = trimmed.map((content) => byId.get(content.id)).filter((item): item is ContentAnalysisRecord => Boolean(item));
    candidates = previous.candidates?.slice() || analyses.flatMap((analysis) => analysis.candidates);
    profile = previous.profile;
    cacheHits = analyses.length;
  } else {
    if (!llmConfigured()) throw new Error('检测到新增或修改内容，但 LLM 未配置：请设置 LLM_BASE_URL / LLM_API_KEY；旧画像不会被覆盖。');
    const cache = loadCache(opts.cacheFile);
    const extracted = await extractContentAnalyses(
      trimmed,
      opts.maxCandidates ?? 400,
      cache,
      previousAnalyses,
      chunkChars,
      opts.cacheFile,
      opts.onProgress,
    );
    ({ analyses, candidates, warnings, cacheHits, cacheTotal } = extracted);
    if (candidates.length === 0) throw new Error('第一阶段未提取到任何候选线索,无法生成画像；旧画像不会被覆盖。');

    const synthMsg = `摘要/抽取完成(${analyses.length} 篇、${candidates.length} 条线索),开始综合(压缩漏斗 → 六维画像)…`;
    console.error(`[engine] ${synthMsg}`);
    opts.onProgress?.({ stage: 'synthesize', message: synthMsg, clues: candidates.length });
    const synthesized = await synthesizeProfile(opts.name ?? previous?.subject.name ?? null, trimmed, candidates);
    profile = synthesized.profile;
    synthWarnings = synthesized.warnings;
    const validIds = new Set(contents.map((c) => c.id));
    const sanitized = sanitizeProfile(profile, validIds, contents);
    profile = sanitized.profile;
    sanitizedWarnings = sanitized.warnings;
  }

  const embedded = await generateEmbeddings({
    profile,
    analyses,
    previous: previous?.embeddings,
    profileChanged,
    onProgress: opts.onProgress,
  });
  if (embedded.warning) warnings.push(embedded.warning);

  const dated = contents.filter((c) => c.published_at).map((c) => String(c.published_at));
  const typeCounts: Record<string, number> = {};
  for (const c of contents) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;

  return {
    schema_version: 1,
    subject: {
      name: opts.name ?? previous?.subject.name ?? null,
      ...(previous?.subject.avatarUrl ? { avatarUrl: previous.subject.avatarUrl } : {}),
    },
    meta: {
      generated_at: new Date().toISOString(),
      prompt_version: PROMPT_VERSION,
      models: { main: process.env.LLM_MODEL || 'default', cheap: process.env.LLM_CHEAP_MODEL || process.env.LLM_MODEL || 'default' },
      content_count: contents.length,
      time_range: dated.length ? { from: dated[0].slice(0, 10), to: dated[dated.length - 1].slice(0, 10) } : null,
      type_counts: typeCounts,
      warnings: [...warnings, ...synthWarnings, ...sanitizedWarnings],
      cache: { hits: cacheHits, total: cacheTotal },
      incremental: {
        added: diff.added.length,
        changed: diff.changed.length,
        unchanged: diff.unchanged.length,
        removed: diff.removed.length,
        reused_analyses: diff.unchanged.length,
        reused_embeddings: embedded.reused,
        profile_reused: !profileChanged,
      },
      embedding: embedded.meta,
    },
    evidence_index: contents.map((c): EvidenceItem => ({
      id: c.id, title: c.title, type: c.type, url: c.url, date: c.published_at?.slice(0, 10) || null,
      excerpt: c.text.slice(0, 160),
    })),
    profile,
    candidates,
    content_analyses: analyses,
    ...(embedded.embeddings ? { embeddings: embedded.embeddings } : {}),
  };
}

function safeJson(text: string): unknown {
  // 兼容模型偶尔在 JSON 外包裹 ```json 围栏的情况
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  return JSON.parse(start > 0 ? body.slice(start) : body);
}
