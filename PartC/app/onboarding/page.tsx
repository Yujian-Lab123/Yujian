'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import styles from './p7-motion.module.css';

const STEPS = ['回答', '文章', '话题', '长期问题'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [understanding, setUnderstanding] = useState<any>(null);
  const [phase, setPhase] = useState<'reading' | 'result' | 'error'>('reading');
  const progress = Math.round((Math.min(step, STEPS.length) / STEPS.length) * 100);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meRes = await fetch('/api/me').then((r) => r.json());
        if (!meRes.ok) return router.push('/');
        // 依次播放“正在读你允许我们看到的内容”
        for (let i = 1; i <= STEPS.length; i++) {
          await new Promise((r) => setTimeout(r, 550));
          if (!alive) return;
          setStep(i);
        }
        const res = await fetch('/api/profile/analyze', { method: 'POST' }).then((r) => r.json());
        if (!alive) return;
        if (!res.ok) throw new Error('profile analysis failed');
        setUnderstanding(res.understanding);
        await new Promise((r) => setTimeout(r, 400));
        if (alive) setPhase('result');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [router]);

  return (
    <main className={`relative min-h-[100dvh] overflow-hidden bg-paper-100 paper-texture ${styles.page}`}>
      <InkScene tone="warm" side="left" />
      <Nav tone="warm" tagline="真实的人，真诚的连接" />

      {phase === 'reading' && (
        <section className="relative z-10 mx-auto max-w-xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-16" aria-labelledby="understanding-title">
          <h1 id="understanding-title" className="fade-up font-display text-3xl leading-tight text-sumi-800 sm:text-4xl">你不需要重新写一份自我介绍</h1>
          <p className="fade-up-1 mt-4 text-sumi-500">你过去留下的那些东西，本身就是。</p>
          <div className={`card-warm mx-auto mt-8 max-w-md overflow-hidden p-5 text-left sm:mt-12 sm:p-8 ${styles.loadingCard}`}>
            <div className={styles.inkStage} aria-hidden="true">
              <span className={`${styles.inkWash} ${styles.inkWashLeft}`} />
              <span className={`${styles.inkWash} ${styles.inkWashRight}`} />
              <svg className={styles.inkLandscape} viewBox="0 0 420 150" fill="none">
                <path className={styles.mountainBack} d="M-8 124 C38 107 58 58 103 95 C144 128 170 55 216 92 C253 120 285 64 330 91 C360 108 388 89 430 73" />
                <path className={styles.mountainFront} d="M-10 142 C46 110 82 131 122 112 C165 92 184 135 229 116 C278 96 307 135 355 111 C382 98 405 104 430 91" />
                <path className={styles.riverStroke} d="M116 137 C174 120 224 139 289 119 C330 106 362 113 405 103" />
                <path className={styles.birdStroke} d="M305 41 Q315 31 325 41 M332 35 Q342 25 352 35" />
              </svg>
              <span className={styles.inkPulse} />
              <span className={styles.loaderSeal}>遇</span>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-sm text-sumi-500" role="status" aria-live="polite">
                {step < STEPS.length ? `正在理解你的${STEPS[step]}…` : '正在把线索整理成一幅完整的你…'}
              </p>
              <span className="shrink-0 font-display text-sm text-gold-600">{progress}%</span>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-1 sm:gap-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sumi-700">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${step > i ? `border-gold-500 bg-gold-500 text-white ${styles.stepDone}` : 'border-paper-400 text-transparent'}`}>✓</span>
                  <span className={step > i ? '' : 'text-sumi-400'}>{s}</span>
                  {step === i && <span className="pulse-soft hidden text-xs text-gold-500 sm:inline">读取中…</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {phase === 'error' && (
        <section className="relative z-10 mx-auto max-w-lg px-4 pb-20 pt-16 text-center sm:px-6" role="alert">
          <div className="card-warm p-8 sm:p-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/40 font-display text-gold-600">遇</span>
            <h1 className="mt-5 font-display text-3xl text-sumi-800">这次理解停在了半路</h1>
            <p className="mt-3 text-sm leading-6 text-sumi-500">内容没有丢失，可以重新试一次。</p>
            <button className="btn-primary-dark mt-7" onClick={() => window.location.reload()}>重新理解</button>
          </div>
        </section>
      )}

      {phase === 'result' && understanding && (
        <section className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
          <p className="text-center text-sm tracking-widest2 text-gold-500">遇 见 · AI 理 解 完 成</p>
          <h1 className="fade-up mt-4 text-center font-display text-3xl leading-tight text-sumi-800 sm:text-4xl">
            你最近长期在意的，不只是「{understanding.topics[0] ?? 'AI'}」
          </h1>
          <p className="fade-up-1 mt-4 text-center text-sumi-500">
            过去的内容里，你经常讨论：{understanding.topics.join('、')}
          </p>

          <div className="card-warm fade-up-2 mx-auto mt-8 max-w-2xl p-6 text-center sm:mt-10 sm:p-10">
            <p className="text-xs tracking-widest2 text-gold-500">但这些内容背后，反复出现的一个问题是</p>
            <p className="mt-4 font-display text-2xl leading-snug text-sumi-800 sm:text-3xl">“{understanding.coreQuestion}”</p>
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
            <button onClick={() => router.push('/encounter')} className="btn-primary-dark w-full px-10 text-lg sm:w-auto sm:px-14">
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
