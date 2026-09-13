'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { latestRecordsByDay, shanghaiDateKey, shanghaiMonthKey, shiftMonth, type MomentHistoryRecord } from '@/lib/present-self/history';
import { EMPTY_PRESENT_SELF_DRAFT, type PresentSelfDraft } from '@/lib/present-self/record';
import { useMe } from '@/lib/useMe';
import MomentSidebar from './MomentSidebar';
import MeLoading from './loading';
import PresentSelfForm from './PresentSelfForm';
import styles from './present-self.module.css';

export default function MePage() {
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [draft, setDraft] = useState<PresentSelfDraft>(EMPTY_PRESENT_SELF_DRAFT);
  const [month, setMonth] = useState(() => shanghaiMonthKey(new Date()));
  const [records, setRecords] = useState<MomentHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => shanghaiDateKey(new Date()));

  const loadHistory = useCallback(async (monthKey: string, chooseDate = false) => {
    setHistoryLoading(true); setPageError('');
    try {
      const response = await fetch(`/api/me/current-states?month=${encodeURIComponent(monthKey)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.loginRequired ? '登录已失效，请重新登录。' : result.error || '历史记录加载失败。');
      const nextRecords = Array.isArray(result.records) ? result.records : [];
      setRecords(nextRecords);
      if (chooseDate) {
        const today = shanghaiDateKey(new Date());
        const byDay = latestRecordsByDay(nextRecords);
        setSelectedDate(monthKey === shanghaiMonthKey(new Date()) ? today : [...byDay.keys()].sort().at(-1) || `${monthKey}-01`);
      }
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : '历史记录加载失败。');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me.loggedIn) void loadHistory(month, true);
  }, [me.loggedIn, me.user?.id, month, loadHistory]);

  async function toggleEncounter() {
    if (busy || saving || !me.user) return;
    setBusy(true); setPageError('');
    try {
      const response = await fetch('/api/me/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: me.user.encounter_enabled !== 1 }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.loginRequired ? '登录已失效，请重新登录。' : result.error || '更新失败，请重试。');
      await me.refresh();
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : '网络异常，请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function afterSaved() {
    await Promise.all([me.refresh(), loadHistory(shanghaiMonthKey(new Date()), true)]);
    setMonth(shanghaiMonthKey(new Date()));
  }

  if (me.loading) return <MeLoading />;

  if (!me.loggedIn) return <main className={styles.loggedOut}>
    <h1>记录此刻的自己</h1><p>{me.error || '登录后，可以记录心情、当下想法和连接意愿。'}</p>
    <Link href="/about">选择知乎登录或演示体验</Link>
  </main>;

  return <main className={styles.page}>
    <Nav tone="warm" tagline="在真实的生活里，遇见有趣的灵魂" />
    <div className={styles.sideVerseLeft}>每一个此刻<br />都是新的相遇</div>
    <div className={styles.sideVerseRight}>把日常过成<br />值得相遇的时刻</div>
    <div className={styles.shell}>
      {me.user.is_mock === 1 && <div className={styles.demoBadge}>演示数据</div>}
      {(pageError || me.error) && <div className={styles.pageError} role="alert">{pageError || me.error} <button onClick={() => void loadHistory(month)}>重新加载</button></div>}
      {!me.understanding && <div className={styles.profileNotice}>你仍然可以记录此刻；完成长期画像后，才会进入真实相遇。<Link href="/onboarding">开始理解自己 →</Link></div>}
      <div className={styles.layout}>
        <PresentSelfForm key={me.user.id} currentState={me.currentState}
          encounterEnabled={me.user.encounter_enabled === 1} understanding={me.understanding}
          disabled={busy} onToggle={toggleEncounter} onSaved={afterSaved}
          onSavingChange={setSaving} onDraftChange={setDraft} />
        <MomentSidebar month={month} records={records} loading={historyLoading} selectedDate={selectedDate}
          draft={draft} understanding={me.understanding} isMock={me.user.is_mock === 1}
          onSelect={setSelectedDate} onMoveMonth={(amount) => setMonth((current) => shiftMonth(current, amount))} />
      </div>
    </div>
  </main>;
}
