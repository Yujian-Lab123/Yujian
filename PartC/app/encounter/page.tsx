'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { InkCover, InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import styles from './p7-motion.module.css';

type CardMotion = 'enter' | 'idle' | 'leave' | 'dismiss';

function after(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function EncounterPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [detail, setDetail] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [motion, setMotion] = useState<CardMotion>('enter');
  const [busy, setBusy] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/encounters').then((r) => r.json());
    if (!res.ok) return router.push('/');
    setCards(res.encounters || []);
    setIdx(0);
    setLoaded(true);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const card = cards[idx];
  useEffect(() => {
    setDetail(null);
    if (card) fetch(`/api/encounters/${card.id}`).then((r) => r.json()).then((d) => d.ok && setDetail(d));
  }, [card]);

  const transitionToNext = async (kind: Exclude<CardMotion, 'enter' | 'idle'>) => {
    setMotion(kind);
    await after(320);
    if (idx < cards.length - 1) setIdx((current) => current + 1);
    else await load();
    setMotion('enter');
    await after(560);
    setMotion('idle');
  };

  const feedback = async (type: string) => {
    if (!card || busy) return;
    setBusy(true);
    setFeedbackStatus('正在记下你的感受…');
    try {
      const response = await fetch(`/api/encounters/${card.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!response.ok) throw new Error('feedback failed');
      setFeedbackStatus(type === 'not_interested' ? '已略过，正在换一篇。' : '已记下，正在继续寻找。');
      await transitionToNext(type === 'not_interested' ? 'dismiss' : 'leave');
    } catch {
      setFeedbackStatus('这次没有记下来，请稍后再试。');
      setMotion('idle');
    } finally {
      setBusy(false);
    }
  };

  const nextCard = async () => {
    if (busy) return;
    setBusy(true);
    setFeedbackStatus('正在展开下一篇…');
    try {
      await transitionToNext('leave');
      setFeedbackStatus('');
    } catch {
      setMotion('idle');
      setFeedbackStatus('暂时没能展开下一篇，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  const motionClass = motion === 'enter'
    ? styles.cardEnter
    : motion === 'leave'
      ? styles.cardLeave
      : motion === 'dismiss'
        ? styles.cardDismiss
        : '';

  return (
    <main className={`relative min-h-[100dvh] overflow-hidden bg-paper-100 paper-texture ${styles.page}`}>
      <InkScene tone="warm" side="right" />
      <Nav tone="warm" tagline="真实的人，真诚的连接" />

      {!loaded && (
        <div className={styles.searching} role="status" aria-live="polite">
          <span aria-hidden="true" />
          <p>正在为你寻找一篇值得停下来的文字……</p>
        </div>
      )}

      {loaded && !card && (
        <p className="mx-auto max-w-lg px-6 pt-20 text-center leading-7 text-sumi-500">今天暂时没有新的遇见。去「我的」选择几个此刻标签，会让遇见更准。</p>
      )}

      {card && (
        <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="fade-up font-display text-3xl leading-tight text-gold-600 sm:text-4xl">今天想先给你看一篇东西</h1>
              <p className="mt-2 text-xs tracking-widest2 text-sumi-400">第 {idx + 1} / {cards.length} 篇</p>
            </div>
            <span className="fade-up hidden shrink-0 font-display text-sm text-gold-500 sm:inline">✦ 用心推荐</span>
          </div>
          <p className="fade-up-1 mt-3 text-sumi-500">一篇 TA 写的真实经历或思考，也许能让你们的遇见更有意义。</p>
          {card.moment && (
            <p className="fade-up-1 mt-3 inline-block rounded-full bg-gold-500/15 px-4 py-1.5 text-sm text-gold-600">
              ✨ 此刻遇见：基于双方选择的此刻标签，你们现在的状态有一些重合
            </p>
          )}

          <div key={card.id} className={`mt-7 grid gap-6 lg:grid-cols-[1fr_340px] ${styles.cardStage} ${motionClass}`} aria-busy={busy}>
            {/* 主卡：内容优先，人逐渐出现 */}
            <article className="card-warm p-5 sm:p-7 md:p-9">
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="h-44 sm:h-52 md:h-full"><InkCover seed={card.anchor.id} /></div>
                <div>
                  <h2 className="font-display text-xl leading-snug text-sumi-800 sm:text-2xl">{card.anchor.title}</h2>
                  <p className="mt-2 text-xs text-sumi-400">
                    {card.anchor.chars?.toLocaleString()} 字 · {card.anchor.minutes} 分钟阅读
                    {card.anchor.topics?.[0] && <span className="chip-warm ml-3">{card.anchor.topics[0]}</span>}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-sumi-600">“{card.anchor.excerpt}”</p>
                  <div className="mt-4 rounded-xl bg-paper-200/70 p-4">
                    <p className="text-xs font-medium text-gold-600"> AI 总结</p>
                    <p className="mt-1.5 text-sm leading-6 text-sumi-600">{card.anchor.summary}</p>
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <p className="font-medium text-sumi-800">😊 为什么给你看？</p>
                <p className="mt-2 text-sm text-sumi-500">因为我们在你的回应中，感受到你们可能有一些相似的思考与关注：</p>
                <div className="mt-3 rounded-xl bg-paper-200/70 p-5">
                  <p className="font-display text-lg text-sumi-800">“{card.reason}”</p>
                  <p className="mt-4 text-xs text-sumi-500">🔖 你们可能感兴趣的交集</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {card.shared.map((s: string) => <span key={s} className="chip-warm">✦ {s}</span>)}
                  </div>
                  {card.difference && (
                    <p className="mt-3 text-xs leading-5 text-sumi-500">有意思的不同：{card.difference.note}</p>
                  )}
                </div>
              </div>

              <div className="mt-7 flex flex-col items-center gap-3">
                <button onClick={() => router.push(`/encounter/${card.id}`)} disabled={busy} className="btn-primary-dark w-full max-w-md">
                  <span>看看 TA 怎么想</span>
                  <span className="block text-[11px] font-normal opacity-70">进入全文，解锁更多内容</span>
                </button>
                <div className="grid w-full max-w-lg grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <button disabled={busy} className="btn-ghost min-h-11" onClick={() => feedback('content_interesting')}>内容有意思</button>
                  <button disabled={busy} className="btn-ghost min-h-11" onClick={() => feedback('not_interested')}>不太感兴趣</button>
                  {cards.length > 1 && <button disabled={busy} className="btn-ghost col-span-2 min-h-11 sm:col-span-1" onClick={nextCard}>下一篇 →</button>}
                </div>
                <p className="min-h-5 text-center text-xs text-gold-600" role="status" aria-live="polite">{feedbackStatus}</p>
              </div>
            </article>

            {/* 侧栏 */}
            <aside className="space-y-6">
              <div className="card-warm fade-up-3 p-6">
                <p className="font-display font-medium text-sumi-800">✍️ TA 的其他文字</p>
                <div className="mt-4 space-y-4">
                  {(detail?.otherContents || []).map((c: any) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="h-16 w-16 shrink-0"><InkCover seed={c.id} /></div>
                      <div>
                        <p className="text-sm leading-5 text-sumi-700">{c.title}</p>
                        <p className="mt-1 text-[11px] text-sumi-400">{c.chars?.toLocaleString()} 字 · {c.minutes} 分钟阅读</p>
                      </div>
                    </div>
                  ))}
                  {detail && detail.otherContents.length === 0 && <p className="text-xs text-sumi-400">TA 的代表内容就是给你看的那篇。</p>}
                </div>
              </div>
              <div className="card-warm fade-up-3 p-6">
                <p className="text-sm text-gold-600">💬 如果真的聊起来，可以从这里开始</p>
                <p className="mt-3 font-display text-lg leading-7 text-sumi-800">“{card.question}”</p>
                <p className="mt-2 text-xs text-sumi-400">或许你们会有一段很深的对话。</p>
              </div>
            </aside>
          </div>

          {/* 底部三原则 */}
          <footer className="mt-12 grid gap-5 text-center sm:grid-cols-3 sm:gap-6">
            {[['🙋', '真实表达', 'AI 帮助理解彼此的思考'], ['💞', '双向喜欢', '只有互相喜欢才会开启对话'], ['🛡', '安全放心', '隐私保护贯穿整个过程']].map(([i, t, s]) => (
              <div key={t} className="flex items-center justify-center gap-3 text-left">
                <span className="text-xl">{i}</span>
                <div><p className="text-sm font-medium text-sumi-700">{t}</p><p className="text-xs text-sumi-400">{s}</p></div>
              </div>
            ))}
          </footer>
          <p className="mt-12 flex items-center justify-center gap-3 text-center text-xs tracking-widest2 text-sumi-400 sm:gap-4">
            <span className="h-px w-8 bg-paper-400 sm:w-16" />⛰ 人与人的连接，始于理解<span className="h-px w-8 bg-paper-400 sm:w-16" />
          </p>
          <p className="mt-6 text-center font-display text-lg text-gold-500">先看见思想，<br className="md:hidden" />再遇见彼此。</p>
        </section>
      )}
    </main>
  );
}
