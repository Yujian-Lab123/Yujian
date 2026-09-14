'use client';

import Link from 'next/link';
import {
  CaretLeftIcon, CaretRightIcon, ChatCircleDotsIcon, HeartIcon, LeafIcon,
  SmileyIcon, SparkleIcon, UsersIcon,
} from '@phosphor-icons/react';
import {
  latestRecordsByDay, parseMonthKey, shanghaiDateKey, summarizeMonth,
  type MomentHistoryRecord,
} from '@/lib/present-self/history';
import { parseRecord, type PresentSelfDraft } from '@/lib/present-self/record';
import styles from './present-self.module.css';

function Calendar({ month, records, selectedDate, onSelect, onMoveMonth }: {
  month: string;
  records: MomentHistoryRecord[];
  selectedDate: string;
  onSelect: (date: string) => void;
  onMoveMonth: (amount: number) => void;
}) {
  const parsed = parseMonthKey(month)!;
  const days = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).getUTCDay();
  const blanks = (firstDay + 6) % 7;
  const byDay = latestRecordsByDay(records);
  const monthly = summarizeMonth(records);
  const counts = records.reduce((map, record) => {
    const day = shanghaiDateKey(new Date(record.created_at));
    map.set(day, (map.get(day) || 0) + 1); return map;
  }, new Map<string, number>());
  return <section className={styles.sideCard}>
    <div className={styles.cardHeading}>
      <h2>我的此刻 · {parsed.month}月</h2>
      <div className={styles.monthControls}>
        <button type="button" aria-label="上一个月" onClick={() => onMoveMonth(-1)}><CaretLeftIcon size={17} aria-hidden /></button>
        <span>{parsed.year}年{parsed.month}月</span>
        <button type="button" aria-label="下一个月" onClick={() => onMoveMonth(1)}><CaretRightIcon size={17} aria-hidden /></button>
      </div>
    </div>
    <div className={styles.weekdays}>{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className={styles.calendarGrid}>
      {Array.from({ length: blanks }).map((_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
        const key = `${month}-${String(day).padStart(2, '0')}`;
        const hasRecord = byDay.has(key);
        const selected = selectedDate === key;
        return <button type="button" key={key} disabled={!hasRecord} aria-pressed={selected}
          aria-label={`${parsed.month}月${day}日${hasRecord ? `，${counts.get(key)}条记录` : '，无记录'}`}
          className={`${hasRecord ? styles.hasRecord : ''} ${selected ? styles.selectedDay : ''}`}
          onClick={() => onSelect(key)}><span>{day}</span>{hasRecord && <i />}{(counts.get(key) || 0) > 1 && <sup>{counts.get(key)}</sup>}</button>;
      })}
    </div>
    <div className={styles.calendarInsight}><LeafIcon size={22} weight="fill" aria-hidden />
      <p>这个月你最常感受到：<strong>{monthly.dominantMood || '等待第一条记录'}</strong><br />记录不是结论，只帮你看见状态如何流动。</p>
    </div>
  </section>;
}

export default function MomentSidebar({ month, records, loading, selectedDate, draft, understanding, isMock, onSelect, onMoveMonth }: {
  month: string;
  records: MomentHistoryRecord[];
  loading: boolean;
  selectedDate: string;
  draft: PresentSelfDraft;
  understanding: { topics?: string[] } | null;
  isMock: boolean;
  onSelect: (date: string) => void;
  onMoveMonth: (amount: number) => void;
}) {
  const byDay = latestRecordsByDay(records);
  const selected = byDay.get(selectedDate) || null;
  const selectedParsed = selected ? parseRecord(selected.text, selected.mood) : null;
  const today = shanghaiDateKey(new Date());
  const live = selectedDate === today ? draft : null;
  const moods = live?.moods.length ? live.moods : selectedParsed?.moods || [];
  const thought = live?.thought || selectedParsed?.thought || selectedParsed?.legacyText || '';
  const activities = live?.activities.length ? live.activities : selectedParsed?.activities || [];
  const person = live?.personPreference || selectedParsed?.personPreference || '';
  const monthly = summarizeMonth(records);

  return <aside className={styles.sidebar}>
    <section className={styles.sideCard}>
      <div className={styles.cardHeading}><div><h2>{selectedDate === today ? '今日状态摘要' : `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8, 10))}日摘要`}</h2><small>{selectedDate}</small></div>
        <p>此刻的你，<br />已经很好了。</p></div>
      <div className={styles.summaryRows}>
        <div><SmileyIcon size={24} aria-hidden /><strong>心情</strong><span>{moods.join(' · ') || '还没有记录'}</span></div>
        <div><LeafIcon size={24} aria-hidden /><strong>状态</strong><span>{thought || '写下一点今天在想的事'}</span></div>
        <div><UsersIcon size={24} aria-hidden /><strong>社交意愿</strong><span>{activities.length ? `今天想${activities.join('、')}` : '还没有选择今天想做的事'}</span></div>
        <div><HeartIcon size={24} aria-hidden /><strong>期待遇见</strong><span>{person || '还没有描述想认识的人'}</span></div>
      </div>
    </section>

    <Calendar month={month} records={records} selectedDate={selectedDate} onSelect={onSelect} onMoveMonth={onMoveMonth} />

    <section className={`${styles.sideCard} ${styles.monthlyCard}`}>
      <div className={styles.cardHeading}><h2>{parseMonthKey(month)!.month}月的你</h2><span className={styles.aiBadge}>{isMock ? '理解预览' : 'AI 生成'}</span></div>
      {loading ? <p>正在整理这个月的片段…</p> : <p>{monthly.copy}</p>}
      {understanding?.topics?.length ? <p>你长期在意的主题仍然是：{understanding.topics.slice(0, 3).join('、')}。此刻会补充状态，不会覆盖长期画像。</p> : <p>完成长期画像后，月度状态会与稳定主题一起参与真实相遇。</p>}
      <div className={styles.monthlyFooter}><SparkleIcon size={19} weight="fill" aria-hidden />这些记录只属于你。</div>
      <Link href="/profile">查看完整画像 <span aria-hidden>→</span></Link>
    </section>

    {isMock && <div className={styles.demoNotice}><ChatCircleDotsIcon size={18} aria-hidden /><span><strong>演示数据</strong>：当前记录用于体验流程，与真实账号完全隔离。</span></div>}
  </aside>;
}
