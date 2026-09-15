'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';

const STEPS = ['回答', '文章', '话题', '长期问题'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [inventory, setInventory] = useState<Array<{ id: string; title: string; type: string; url: string }>>([]);
  const [phase, setPhase] = useState<'reading' | 'result'>('reading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const meRes = await fetch('/api/me').then((r) => r.json());
      if (!meRes.ok) return router.push('/');
      // 依次播放“正在读你允许我们看到的内容”
      for (let i = 1; i <= STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 550));
        if (!alive) return;
        setStep(i);
      }
      // analyze 现在返回 inventory（已采集的真实内容清单），不再生成规则模板文案
      const res = await fetch('/api/profile/analyze', { method: 'POST' }).then((r) => r.json());
      if (!alive) return;
      if (res.ok) {
        setInventory(res.inventory || []);
        await new Promise((r) => setTimeout(r, 400));
        setPhase('result');
      }
    })();
    return () => { alive = false; };
  }, [router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
      <InkScene tone="warm" side="left" />
      <Nav tone="warm" tagline="真实的人，真诚的连接" />

      {phase === 'reading' && (
        <section className="relative z-10 mx-auto max-w-xl px-6 pt-24 text-center">
          <h1 className="fade-up font-display text-4xl text-sumi-800">你不需要重新写一份自我介绍</h1>
          <p className="fade-up-1 mt-4 text-sumi-500">你过去留下的那些东西，本身就是。</p>
          <div className="card-warm mx-auto mt-12 max-w-sm p-8 text-left">
            <p className="text-sm text-sumi-500">正在读一些你允许我们看到的内容……</p>
            <ul className="mt-6 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sumi-700">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${step > i ? 'border-gold-500 bg-gold-500 text-white' : 'border-paper-400 text-transparent'}`}>✓</span>
                  <span className={step > i ? '' : 'text-sumi-400'}>{s}</span>
                  {step === i && <span className="pulse-soft text-xs text-gold-500">读取中…</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {phase === 'result' && (
        <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-10">
          <p className="text-center text-sm tracking-widest2 text-gold-500">遇 见 · 内 容 采 集 完 成</p>
          <h1 className="fade-up mt-4 text-center font-display text-4xl text-sumi-800">
            已采集你的 {inventory.length} 篇知乎内容
          </h1>
          <p className="fade-up-1 mt-4 text-center text-sumi-500">
            这些是你公开写下的真实内容——完整画像与匹配都以它们为原料。
          </p>

          <div className="fade-up-2 mx-auto mt-10 max-w-2xl divide-y divide-[#e5dfd3] overflow-hidden rounded-xl border border-[#d8d2c6]/60 bg-[#fbf8f1]">
            {inventory.slice(0, 50).map((item) => (
              <a key={item.id || item.title} href={item.url || '#'} target="_blank" rel="noreferrer"
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-[#f4ecdf]/60">
                <span className="min-w-0 truncate text-sm text-sumi-700">{item.title}</span>
                <span className="shrink-0 text-[11px] text-sumi-400">{item.type}</span>
              </a>
            ))}
            {inventory.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-sumi-400">暂未采集到内容，可稍后重新授权。</p>
            )}
          </div>

          <div className="mt-12 text-center">
            <button onClick={() => router.push('/profile')} className="btn-primary-dark px-14 text-lg">
              去生成完整画像 <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-[11px] text-sumi-400">画像基于以上内容生成，仅你可见，不会用于对外展示</p>
          </div>
        </section>
      )}
    </main>
  );
}
