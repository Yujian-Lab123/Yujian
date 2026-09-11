export const MAX_RECORD_LENGTH = 200;

export interface PresentSelfDraft {
  mood: string;
  state: string;
  confusion: string;
  activity: string;
  socialNeed: string;
}

// Keep the existing text/mood contract. Structured persistence awaits D's contract PR.
export function composeRecord(draft: PresentSelfDraft): string {
  return [
    ['当前状态', draft.state],
    ['最近困惑', draft.confusion],
    ['活动意愿', draft.activity],
    ['社交需求', draft.socialNeed],
  ].filter(([, value]) => value.trim()).map(([label, value]) => `${label}：${value.trim()}`).join('\n');
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
