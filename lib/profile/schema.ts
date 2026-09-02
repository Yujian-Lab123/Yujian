import { z } from 'zod';

// ============ 人物画像分析引擎 · Schema ============
// 依据《用户画像.txt》:六维结论 + 证据贯穿(explicit/inferred/unknown)+ 高度压缩。
// 前台数量约束(LIMITS/MINS)不放进 zod(避免模型少给一条就整体失败),由 engine.sanitize 裁剪并告警。

// ---- 输入:原始内容(与爬虫/知乎 API 解耦的归一化格式) ----

export interface RawContent {
  id?: string;
  title?: string;
  text: string;
  type?: string;
  url?: string;
  published_at?: string | number | null;
  author?: string; // 供 CLI --author 过滤;引擎本身不使用
}

export interface NormalizedContent {
  id: string;
  title: string;
  text: string;
  type: string;
  url: string | null;
  published_at: string | null; // ISO 日期或原始可读字符串
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  date: string | null;
  excerpt: string;
}

// ---- 第一阶段:候选事实与线索(便宜模型,逐批提取) ----

export const CandidateKind = z.enum(['fact', 'opinion', 'behavior', 'event', 'value_tradeoff', 'style']);

export const CandidateSchema = z.object({
  content_id: z.string(),
  kind: CandidateKind,
  note: z.string().min(1),
  quote: z.string().optional(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const CandidateBatchSchema = z.object({ candidates: z.array(CandidateSchema) });

// ---- 最终画像(《用户画像.txt》第十节 JSON Schema) ----

export const ClaimType = z.enum(['explicit', 'inferred', 'unknown']); // unknown 类型结论会被挪进 unknowns
export const Confidence = z.enum(['high', 'medium', 'low']);
export const Lean = z.enum(['left', 'slightly_left', 'neutral', 'slightly_right', 'right', 'unknown']);

export const ClaimSchema = z.object({
  claim: z.string().min(1),
  explanation: z.string(),
  type: ClaimType,
  confidence: Confidence,
  evidence_ids: z.array(z.string()),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const TrajectoryNodeSchema = z.object({
  period: z.string(),
  event: z.string(),
  change: z.string(),
  later_impact: z.string(),
  evidence_ids: z.array(z.string()),
});
export type TrajectoryNode = z.infer<typeof TrajectoryNodeSchema>;

export const ConcernSchema = z.object({ question: z.string(), explanation: z.string(), evidence_ids: z.array(z.string()) });
export type Concern = z.infer<typeof ConcernSchema>;

export const DriverSchema = z.object({ driver: z.string(), explanation: z.string(), evidence_ids: z.array(z.string()) });
export type Driver = z.infer<typeof DriverSchema>;

export const DecisionPatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  process: z.array(z.string()),
  evidence_ids: z.array(z.string()),
});
export type DecisionPattern = z.infer<typeof DecisionPatternSchema>;

export const ValuePreferenceSchema = z.object({
  left: z.string(),
  right: z.string(),
  lean: Lean,
  explanation: z.string(),
  evidence_ids: z.array(z.string()),
});
export type ValuePreference = z.infer<typeof ValuePreferenceSchema>;

export const ConversationTraitSchema = z.object({ trait: z.string(), explanation: z.string(), evidence_ids: z.array(z.string()) });
export type ConversationTrait = z.infer<typeof ConversationTraitSchema>;

export const RepresentativeContentSchema = z.object({
  content_id: z.string(),
  title: z.string(),
  content_type: z.string(),
  date: z.string(),
  why_representative: z.string(),
  supports: z.array(z.string()), // 支持哪些画像结论(结论原文或其 id)
});
export type RepresentativeContent = z.infer<typeof RepresentativeContentSchema>;

export const ProfileSchema = z.object({
  summary: z.object({ one_sentence: z.string(), core_insights: z.array(ClaimSchema) }),
  life_trajectory: z.array(TrajectoryNodeSchema),
  long_term_concerns: z.array(ConcernSchema),
  drivers: z.array(DriverSchema),
  decision_patterns: z.array(DecisionPatternSchema),
  value_preferences: z.array(ValuePreferenceSchema),
  conversation_style: z.object({
    traits: z.array(ConversationTraitSchema),
    good_entry_points: z.array(z.string()),
  }),
  representative_contents: z.array(RepresentativeContentSchema),
  unknowns: z.array(z.string()),
});
export type Profile = z.infer<typeof ProfileSchema>;

// ---- 前台数量约束:《用户画像.txt》各维度 3~5 条(轨迹 4~7、驱动力 2~4、入口 1~3、锚点 3~5) ----

export const LIMITS = {
  core_insights: 5,
  life_trajectory: 7,
  long_term_concerns: 5,
  drivers: 4,
  decision_patterns: 5,
  value_preferences: 5,
  traits: 5,
  good_entry_points: 3,
  representative_contents: 5,
  unknowns: 8,
} as const;

export const MINS = {
  core_insights: 3,
  life_trajectory: 4,
  long_term_concerns: 3,
  drivers: 2,
  decision_patterns: 3,
  value_preferences: 3,
  traits: 3,
  representative_contents: 3,
} as const;

// ---- 产物:画像 + 证据索引(Level 3 需要)+ 元信息 ----

export interface ProfileArtifact {
  schema_version: 1;
  subject: { name: string | null };
  meta: {
    generated_at: string;
    prompt_version: string;
    models: { main: string; cheap: string };
    content_count: number;
    time_range: { from: string; to: string } | null;
    type_counts: Record<string, number>;
    warnings: string[];
    cache?: { hits: number; total: number };
  };
  evidence_index: EvidenceItem[];
  profile: Profile;
  /** 第一阶段候选线索(调试/透明用:画像每条结论的上游原料) */
  candidates?: Candidate[];
}
