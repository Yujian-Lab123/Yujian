'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { useDemoMe } from '@/lib/experience-mode/useDemoMe';
import MomentSidebar from '@/app/me/MomentSidebar';
import { latestRecordsByDay, shanghaiDateKey, shanghaiMonthKey, type MomentHistoryRecord } from '@/lib/present-self/history';
import { EMPTY_PRESENT_SELF_DRAFT } from '@/lib/present-self/record';
import styles from '@/app/me/present-self.module.css';

const MOODS = ['平静', '有点累', '开心', '有点焦虑', '想散步', '想聊天', '想认识新的人', '想安静一下', '充满动力'];

/** 演示版「此刻」页：轻量记录卡 + 复用 MomentSidebar 展示演示身份的历史。 */
export default function DemoMePage() {
  const me = useDemoMe();
  const [records, setRecords] = useState<MomentHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [text, setText] = useState('');
  const [mood, setMood] = useState('');
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/demo/me/current-states?month=${encodeURIComponent(shanghaiMonthKey(new Date()))}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '历史记录加载失败。');
      setRecords(Array.isArray(result.records) ? result.records : []);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : '历史记录加载失败。');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (me.loggedIn) void loadHistory();
  }, [me.loggedIn, me.user?.id]);

  async function save() {
    if (saving || !text.trim()) return;
    setSaving(true); setPageError('');
    try {
      const response = await fetch('/api/demo/me/current-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), mood }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '保存失败，请重试。');
      setText(''); setMood('');
      await me.refresh();
      await loadHistory();
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : '网络异常，请重试。');
    } finally {
      setSaving(false);
    }
  }

  if (me.loading) {
    return <main className={styles.page}><Nav tone="warm" tagline="演示模式 · 预置数据体验" /><p className="py-24 text-center text-sm text-sumi-400">加载中…</p></main>;
  }

  if (!me.loggedIn) {
    return <main className={styles.page}><Nav tone="warm" tagline="演示模式 · 预置数据体验" />
      <div className={`${styles.loggedOut}`}>
        <h1>演示会话已结束</h1><p>重新开始一次演示体验即可继续。</p>
        <Link href="/demo">前往演示入口</Link>
      </div>
    </main>;
  }

  const byDay = latestRecordsByDay(records);

  return <main className={styles.page}>
    <Nav tone="warm" tagline="演示模式 · 预置数据体验" />
    <div className={styles.shell}>
      <div className={styles.demoBadge}>演示数据</div>
      {(pageError || me.error) && <div className={styles.pageError} role="alert">{pageError || me.error}</div>}
      <div className={styles.layout}>
        <section className={styles.card}>
          <h1 className={styles.cardTitle}>此刻的 {me.user?.name}</h1>
          <p className="mt-1 text-xs text-sumi-400">演示身份的此刻记录只保存在演示数据中。</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="此刻在做什么、想什么？（演示数据）"
            className="mt-4 min-h-[96px] w-full rounded-lg border border-[#d8d2c6] bg-white/80 p-3 text-sm outline-none focus:border-[#2c5f8a]"
            maxLength={500}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button key={m} type="button" onClick={() => setMood(mood === m ? '' : m)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${mood === m ? 'border-[#2c5f8a] bg-[#2c5f8a] text-white' : 'border-[#d8d2c6] text-sumi-500 hover:border-[#9dadc2]'}`}>
                {m}
              </button>
            ))}
          </div>
          <button type="button" onClick={save} disabled={saving || !text.trim()}
            className="mt-4 w-full rounded-lg bg-[#173e70] px-4 py-2.5 text-sm text-white disabled:opacity-50">
            {saving ? '保存中…' : '记下此刻（演示）'}
          </button>
          {me.currentState && (
            <p className="mt-3 text-xs text-sumi-400">最近一条：{me.currentState.mood || '（无心情）'} · {me.currentState.text.slice(0, 40)}</p>
          )}
        </section>
        <MomentSidebar
          month={shanghaiMonthKey(new Date())}
          records={records}
          loading={historyLoading}
          selectedDate={[...byDay.keys()].sort().at(-1) || shanghaiDateKey(new Date())}
          draft={{ ...EMPTY_PRESENT_SELF_DRAFT, thought: text }}
          understanding={me.understanding}
          isMock
          onSelect={() => {}}
          onMoveMonth={() => {}}
        />
      </div>
    </div>
  </main>;
}
