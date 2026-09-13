export const CURRENT_STATE_VERSION = 2 as const;

export const CURRENT_MOODS = ['平静', '期待', '开心', '疲惫', '迷茫'] as const;
export const CURRENT_ACTIVITIES = ['学习中', '工作中', '创作中', '休息中', '想走走'] as const;
export const CURRENT_CONNECTION_MODES = ['想深聊', '轻松聊聊', '找同伴', '只想看看'] as const;
export const PRIVATE_NOTE_THEMES = ['work', 'study', 'creation', 'rest', 'relationships', 'uncertainty', 'other'] as const;

export type CurrentMood = (typeof CURRENT_MOODS)[number];
export type CurrentActivity = (typeof CURRENT_ACTIVITIES)[number];
export type CurrentConnectionMode = (typeof CURRENT_CONNECTION_MODES)[number];
export type PrivateNoteTheme = (typeof PRIVATE_NOTE_THEMES)[number];

export interface CurrentStateSelection {
  mood: CurrentMood;
  activity: CurrentActivity;
  connectionMode: CurrentConnectionMode;
}

export interface PrivateCurrentUnderstanding {
  themes: PrivateNoteTheme[];
  supportNeed: 'none' | 'listen' | 'discuss' | 'companion';
}

export type PrivateNoteStatus = 'not_provided' | 'understood' | 'discarded_unavailable';

export interface PrivateNoteProcessing {
  status: PrivateNoteStatus;
  understanding?: PrivateCurrentUnderstanding;
}

export interface CurrentStateEnvelope {
  version: typeof CURRENT_STATE_VERSION;
  match: CurrentStateSelection;
  privateNote: PrivateNoteProcessing;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function oneOf<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

function sanitizePrivateNoteProcessing(value: unknown): PrivateNoteProcessing {
  if (!isRecord(value)) return { status: 'discarded_unavailable' };
  const status = value.status;
  if (!oneOf(['not_provided', 'understood', 'discarded_unavailable'] as const, status)) {
    return { status: 'discarded_unavailable' };
  }
  if (status !== 'understood') return { status };

  const candidate = value.understanding;
  if (!isRecord(candidate)) return { status: 'discarded_unavailable' };
  const themes = Array.isArray(candidate.themes)
    ? [...new Set(candidate.themes.filter((item): item is PrivateNoteTheme => oneOf(PRIVATE_NOTE_THEMES, item)))].slice(0, 4)
    : [];
  const supportNeed = candidate.supportNeed;
  if (!themes.length || !oneOf(['none', 'listen', 'discuss', 'companion'] as const, supportNeed)) {
    return { status: 'discarded_unavailable' };
  }
  return { status, understanding: { themes, supportNeed } };
}

export function parseCurrentStateSelection(value: unknown): CurrentStateSelection | null {
  if (!isRecord(value)) return null;
  const mood = value.mood;
  const activity = value.activity;
  const connectionMode = value.connectionMode;
  if (!oneOf(CURRENT_MOODS, mood)
    || !oneOf(CURRENT_ACTIVITIES, activity)
    || !oneOf(CURRENT_CONNECTION_MODES, connectionMode)) return null;
  return { mood, activity, connectionMode };
}

/** 这是 Current 唯一允许进入 Mock 向量、Embedding 和 Reranker 的文本。 */
export function buildCurrentStateMatchText(selection: CurrentStateSelection): string {
  return `心情：${selection.mood}；活动：${selection.activity}；交流：${selection.connectionMode}`;
}

/** 数据库兼容封装：只保存结构化选择和 LLM 派生理解，绝不保存用户自由文本原文。 */
export function encodeCurrentState(
  selection: CurrentStateSelection,
  privateNote: PrivateNoteProcessing = { status: 'not_provided' },
): string {
  return JSON.stringify({
    version: CURRENT_STATE_VERSION,
    match: selection,
    privateNote: sanitizePrivateNoteProcessing(privateNote),
  });
}

export function decodeCurrentState(value: string): CurrentStateEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== CURRENT_STATE_VERSION) return null;
    const selection = parseCurrentStateSelection(parsed.match);
    if (!selection || !isRecord(parsed.privateNote)) return null;
    const privateNote = sanitizePrivateNoteProcessing(parsed.privateNote);
    return {
      version: CURRENT_STATE_VERSION,
      match: selection,
      privateNote,
    };
  } catch {
    // 旧版行保存的是自由文本。为满足新隐私边界，不再展示或参与匹配。
    return null;
  }
}

export function matchTextFromStoredCurrentState(value: string): string | null {
  const decoded = decodeCurrentState(value);
  return decoded ? buildCurrentStateMatchText(decoded.match) : null;
}
