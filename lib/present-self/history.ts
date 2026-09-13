import { parseRecord } from './record';

export const PRESENT_SELF_TIME_ZONE = 'Asia/Shanghai';

export interface MomentHistoryRecord {
  id: string;
  mood: string;
  text: string;
  created_at: string;
}

export interface MonthlyMomentSummary {
  recordCount: number;
  activeDays: number;
  dominantMood: string;
  copy: string;
}

export function parseMonthKey(value: string | null): { year: number; month: number; key: string } | null {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(value || '');
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), key: `${match[1]}-${match[2]}` };
}

export function shanghaiMonthKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PRESENT_SELF_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(date);
}

export function shanghaiDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PRESENT_SELF_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function monthBounds(monthKey: string): { start: Date; end: Date } | null {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
  const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
  return {
    start: new Date(`${parsed.key}-01T00:00:00+08:00`),
    end: new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+08:00`),
  };
}

export function shiftMonth(monthKey: string, amount: number): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return shanghaiMonthKey();
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function latestRecordsByDay(records: MomentHistoryRecord[]): Map<string, MomentHistoryRecord> {
  const latest = new Map<string, MomentHistoryRecord>();
  [...records]
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .forEach((record) => latest.set(shanghaiDateKey(new Date(record.created_at)), record));
  return latest;
}

export function summarizeMonth(records: MomentHistoryRecord[]): MonthlyMomentSummary {
  const moodCounts = new Map<string, number>();
  records.forEach((record) => {
    const parsed = parseRecord(record.text, record.mood);
    parsed.moods.forEach((mood) => moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1));
  });
  const dominantMood = [...moodCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))[0]?.[0] || '';
  const activeDays = new Set(records.map((record) => shanghaiDateKey(new Date(record.created_at)))).size;
  const copy = records.length === 0
    ? '这个月还没有留下记录。写下一点此刻，月度脉络就会慢慢出现。'
    : `这个月你留下了 ${records.length} 条记录，分布在 ${activeDays} 天。${dominantMood ? `最常出现的感受是“${dominantMood}”。` : ''}这些片段不会定义你，只帮助你看见状态如何流动。`;
  return { recordCount: records.length, activeDays, dominantMood, copy };
}
