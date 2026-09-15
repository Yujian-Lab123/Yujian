'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';

const STEPS = ['回答', '文章', '话题', '长期问题'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [understanding, setUnderstanding] = useState<any>(null);
  const [phase, setPhase] = useState<'reading' | 'result'>('reading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const meRes = await fetch('/api/me').then((r) => r.json());
      if (!meRes.ok) return router.push('/');
      // 已有向量说明长期理解已经完成。直接展示结果，不能每次查看都再播放一次“读取”动画。
      if (meRes.understanding) {
        if (alive) {
          setUnderstanding(meRes.understanding);
          setPhase('result');
        }
        return;
      }
      // 依次播放“正在读你允许我们看到的内容”
      for (let i = 1; i <= STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 550));
        if (!alive) return;
        setStep(i);
      }
      const res = await fetch('/api/profile/analyze', { method: 'POST' }).then((r) => r.json());
      if (!alive) return;
      if (res.ok) {
        setUnderstanding(res.understanding);
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

      {phase === 'result' && understanding && (
        <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-10">
          <p className="text-center text-sm tracking-widest2 text-gold-500">遇 见 · AI 理 解 完 成</p>
          <h1 className="fade-up mt-4 text-center font-display text-4xl text-sumi-800">
            你最近长期在意的，不只是「{understanding.topics[0] ?? 'AI'}」
          </h1>
          <p className="fade-up-1 mt-4 text-center text-sumi-500">
            过去的内容里，你经常讨论：{understanding.topics.join('、')}
          </p>

          <div className="card-warm fade-up-2 mx-auto mt-10 max-w-2xl p-10 text-center">
            <p className="text-xs tracking-widest2 text-gold-500">但这些内容背后，反复出现的一个问题是</p>
            <p className="mt-4 font-display text-3xl leading-snug text-sumi-800">“{understanding.coreQuestion}”</p>
            <svg className="mx-auto mt-4 w-40 opacity-60" viewBox="0 0 160 12" fill="none">
              <path d="M4 8 Q60 2 156 6" stroke="#a9834a" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="fade-up-3 mt-8 grid gap-4 sm:grid-cols-2">
            {understanding.facets.map((f: any) => (
              <div key={f.title} className="card-warm flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-200 text-lg">{f.icon}</span>
                <div>
                  <p className="font-medium text-sumi-800">{f.title}</p>
                  <p className="mt-1 text-sm leading-6 text-sumi-500">{f.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.tags.map((t: string) => <span key={t} className="chip-warm">{t}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button onClick={() => router.push('/encounter')} className="btn-primary-dark px-14 text-lg">
              开始遇见 <span aria-hidden>→</span>
            </button>
            <div className="mt-4">
              <button className="btn-ghost" onClick={() => alert('谢谢反馈！理解会随你新增的内容持续更新。')}>有点不准</button>
            </div>
            <p className="mt-2 text-[11px] text-sumi-400">{understanding.note}</p>
          </div>
        </section>
      )}
    </main>
  );
}
