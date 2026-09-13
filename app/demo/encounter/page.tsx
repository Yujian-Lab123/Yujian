'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import styles from '@/app/encounter/encounter-motion.module.css';

/** 演示版遇见流：数据仅来自 /api/demo/encounters（Mock 候选池）。 */
export default function DemoEncounterPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await fetch('/api/demo/encounters', { cache: 'no-store' });
      if (response.status === 401) { window.location.href = '/demo'; return; }
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'load failed');
      setCards(data.encounters || []);
    } catch {
      setLoadError('暂时没能找到新的遇见，请稍后再试。');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="relative min-h-screen bg-[#fbf8f1]">
      <Nav tone="blue" tagline="演示模式 · 预置数据体验" />
      <section className="mx-auto max-w-[720px] px-5 pb-24 pt-10">
        <p className="font-display text-[13px] tracking-[0.24em] text-[#8a7a5c]">DEMO · 相遇</p>
        <h1 className="mt-3 font-display text-3xl text-[#173e70]">从一篇内容开始</h1>
        <p className="mt-2 text-sm text-[#77859a]">以下推荐全部来自演示预置人物，与真实用户无关。</p>

        {!loaded && <p className="mt-16 text-center text-sm text-sumi-400">正在遇见…</p>}

        {loaded && loadError && (
          <div className="mt-16 text-center">
            <p className="text-sm text-[#a05a4a]">{loadError}</p>
            <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-[#c8b998] px-5 py-2 text-sm text-[#173e70]">重试</button>
          </div>
        )}

        {loaded && !loadError && cards.length === 0 && (
          <div className="mt-16 text-center">
            <p className="font-display text-xl text-[#173e70]">演示池暂时没有新的遇见</p>
            <p className="mt-2 text-sm text-[#77859a]">换个演示身份再来，或稍后刷新。</p>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {cards.map((card, index) => (
            <Link
              key={card.id}
              href={`/demo/encounter/${encodeURIComponent(card.id)}`}
              className={`${styles.card} mo-rise block rounded-2xl border border-[#d8cfbd] bg-white/85 p-6 shadow-sm transition-shadow hover:shadow-md`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              {card.moment && <span className="mb-3 inline-block rounded-full bg-[#fdf3d8] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#8a6d1a]">此刻同频</span>}
              <p className="text-[11px] tracking-[0.14em] text-[#a09a8e]">{card.target?.role || ''}{card.target?.city ? ` · ${card.target.city}` : ''}</p>
              <h2 className="mt-1 font-display text-xl text-[#173e70]">{card.target?.name}</h2>
              <p className="mt-3 border-l-2 border-[#c8b998] pl-3 text-sm leading-6 text-[#536a84]">
                「{card.anchor?.title || card.anchor?.question || '一篇值得读的内容'}」
              </p>
              <p className="mt-3 text-[13px] leading-6 text-[#627083]">{card.reason}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(card.shared || []).map((s: string) => (
                  <span key={s} className="rounded-full bg-[#f0ece3] px-2.5 py-0.5 text-[11px] text-[#6b665e]">{s}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {loaded && !loadError && cards.length > 0 && (
          <p className="mt-8 text-center text-xs text-[#a09a8e]">—— 演示池到底啦 ——</p>
        )}
      </section>
    </main>
  );
}
