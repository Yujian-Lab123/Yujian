export const MAX_THOUGHT_LENGTH = 500;
export const MAX_PERSON_PREFERENCE_LENGTH = 300;
export const MAX_RECORD_LENGTH = 900;
export const MAX_MOOD_SELECTIONS = 4;
export const MAX_ACTIVITY_SELECTIONS = 3;

export interface PresentSelfDraft {
  moods: string[];
  thought: string;
  activities: string[];
  conversationStyle: string;
  personPreference: string;
}

export interface ParsedPresentSelfRecord extends PresentSelfDraft {
  legacyText: string;
}

export const EMPTY_PRESENT_SELF_DRAFT: PresentSelfDraft = {
  moods: [],
  thought: '',
  activities: [],
  conversationStyle: '',
  personPreference: '',
};

const LABELS = ['今日心情', '最近在想', '今天想做', '交流方式', '期待遇见', '当前状态', '最近困惑', '活动意愿', '社交需求'] as const;
const LABEL_PATTERN = new RegExp(`(?:^|\\n)(${LABELS.join('|')})：`, 'g');

function clean(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function splitChoices(value: string): string[] {
  return unique(value.split(/[、，,·]/));
}

/**
 * Keep the existing `{ text, mood }` API contract while giving the UI a reversible,
 * labelled representation. This is a compatibility bridge, not the final schema.
 */
export function composeRecord(draft: PresentSelfDraft): string {
  const rows: Array<[string, string]> = [
    ['今日心情', unique(draft.moods).slice(0, MAX_MOOD_SELECTIONS).join('、')],
    ['最近在想', clean(draft.thought).slice(0, MAX_THOUGHT_LENGTH)],
    ['今天想做', unique(draft.activities).slice(0, MAX_ACTIVITY_SELECTIONS).join('、')],
    ['交流方式', clean(draft.conversationStyle)],
    ['期待遇见', clean(draft.personPreference).slice(0, MAX_PERSON_PREFERENCE_LENGTH)],
  ];
  return rows.filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}：${value}`).join('\n');
}

function labelledSections(text: string): Map<string, string> {
  const normalized = text.replace(/\r\n/g, '\n');
  const matches = [...normalized.matchAll(LABEL_PATTERN)];
  const sections = new Map<string, string>();
  matches.forEach((match, index) => {
    const label = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    sections.set(label, clean(normalized.slice(start, end)));
  });
  return sections;
}

/** Parses new labelled records and keeps old free-text records readable without guessing. */
export function parseRecord(text: string, mood = ''): ParsedPresentSelfRecord {
  const sections = labelledSections(text);
  const hasKnownLabels = sections.size > 0;
  const moods = splitChoices(sections.get('今日心情') || mood);
  const thoughtParts = [sections.get('最近在想'), sections.get('最近困惑'), sections.get('当前状态')]
    .filter((value): value is string => Boolean(value));
  return {
    moods,
    thought: unique(thoughtParts).join('\n'),
    activities: splitChoices(sections.get('今天想做') || sections.get('活动意愿') || ''),
    conversationStyle: sections.get('交流方式') || sections.get('社交需求') || '',
    personPreference: sections.get('期待遇见') || '',
    legacyText: hasKnownLabels ? '' : clean(text),
  };
}

export function validateRecord(body: unknown): { text: string; mood: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求格式不正确');
  const { text = '', mood = '' } = body as Record<string, unknown>;
  if (typeof text !== 'string' || typeof mood !== 'string') throw new Error('内容和心情必须为文字');
  if (!text.trim() && !mood.trim()) throw new Error('内容不能为空');
  if (text.trim().length > MAX_RECORD_LENGTH) throw new Error(`记录不能超过 ${MAX_RECORD_LENGTH} 字`);
  if (mood.trim().length > 20) throw new Error('心情不能超过 20 字');
  return { text: text.trim() || mood.trim(), mood: mood.trim() };
}
