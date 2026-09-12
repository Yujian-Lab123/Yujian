'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { InkCover, InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';

export default function EncounterPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [detail, setDetail] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/encounters').then((r) => r.json());
    if (!res.ok) return router.push('/');
    setCards(res.encounters || []);
    setLoaded(true);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const card = cards[idx];
  useEffect(() => {
    setDetail(null);
    if (card) fetch(`/api/encounters/${card.id}`).then((r) => r.json()).then((d) => d.ok && setDetail(d));
  }, [card]);

  const feedback = async (type: string) => {
    if (!card) return;
    await fetch(`/api/encounters/${card.id}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
    if (idx < cards.length - 1) setIdx(idx + 1);
    else load();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
      <InkScene tone="warm" side="right" />
      <Nav tone="warm" tagline="真实的人，真诚的连接" />

      {!loaded && <p className="pt-24 text-center text-sumi-400">正在为你寻找……</p>}

      {loaded && !card && (
        <p className="pt-24 text-center text-sumi-500">今天暂时没有新的遇见。去「我的」写一句此刻状态，会让遇见更准。</p>
      )}

      {card && (
        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="fade-up font-display text-4xl text-gold-600">今天想先给你看一篇东西</h1>
            <span className="fade-up hidden shrink-0 font-display text-sm text-gold-500 sm:inline">✦ 用心推荐</span>
          </div>
          <p className="fade-up-1 mt-3 text-sumi-500">一篇 TA 写的真实经历或思考，也许能让你们的遇见更有意义。</p>
          {card.moment && (
            <p className="fade-up-1 mt-3 inline-block rounded-full bg-gold-500/15 px-4 py-1.5 text-sm text-gold-600">
              ✨ 此刻遇见：你们现在，可能正想着同一件事
            </p>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* 主卡：内容优先，人逐渐出现 */}
            <article className="card-warm fade-up-2 p-7 md:p-9">
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="h-52 md:h-full"><InkCover seed={card.anchor.id} /></div>
                <div>
                  <h2 className="font-display text-2xl text-sumi-800">{card.anchor.title}</h2>
                  <p className="mt-2 text-xs text-sumi-400">
                    {card.anchor.chars?.toLocaleString()} 字 · {card.anchor.minutes} 分钟阅读
                    <span className="chip-warm ml-3">{card.anchor.topics?.[0]}</span>
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
                <button onClick={() => router.push(`/encounter/${card.id}`)} className="btn-primary-dark w-full max-w-md">
                  <span>看看 TA 怎么想</span>
                  <span className="block text-[11px] font-normal opacity-70">进入全文，解锁更多内容</span>
                </button>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => feedback('content_interesting')}> 内容有意思</button>
                  <button className="btn-ghost" onClick={() => feedback('not_interested')}>不太感兴趣</button>
                  {cards.length > 1 && <button className="btn-ghost" onClick={() => setIdx((idx + 1) % cards.length)}>下一篇 →</button>}
                </div>
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
          <footer className="mt-14 grid gap-6 text-center md:grid-cols-3">
            {[['🙋', '真实表达', 'AI 帮助理解彼此的思考'], ['💞', '双向确认', '双方都表达认识意愿后才会连接'], ['🛡', '安全放心', '隐私保护贯穿整个过程']].map(([i, t, s]) => (
              <div key={t} className="flex items-center justify-center gap-3 text-left">
                <span className="text-xl">{i}</span>
                <div><p className="text-sm font-medium text-sumi-700">{t}</p><p className="text-xs text-sumi-400">{s}</p></div>
              </div>
            ))}
          </footer>
          <p className="mt-12 flex items-center justify-center gap-4 text-xs tracking-widest2 text-sumi-400">
            <span className="h-px w-16 bg-paper-400" />⛰ 人与人的连接，始于理解<span className="h-px w-16 bg-paper-400" />
          </p>
          <p className="mt-6 text-center font-display text-lg text-gold-500">先看见思想，<br className="md:hidden" />再遇见彼此。</p>
        </section>
      )}
    </main>
  );
}
