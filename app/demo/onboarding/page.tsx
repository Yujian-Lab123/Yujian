'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import { useDemoMe } from '@/lib/experience-mode/useDemoMe';

const STEPS = ['回答', '文章', '话题', '长期问题'];

/** 演示版 onboarding：与真实流程同构，但只读取/生成演示身份的数据。 */
export default function DemoOnboardingPage() {
  const router = useRouter();
  const me = useDemoMe();
  const [step, setStep] = useState(0);
  const [understanding, setUnderstanding] = useState<any>(null);
  const [phase, setPhase] = useState<'reading' | 'result'>('reading');

  useEffect(() => {
    if (me.loading) return;
    if (!me.loggedIn) { router.replace('/demo'); return; }
    let alive = true;
    (async () => {
      // 演示身份已完成理解时直接复用结果，避免用户每次点回本页都触发动画与重复写入。
      if (me.understanding) {
        setUnderstanding(me.understanding);
        setPhase('result');
        return;
      }
      for (let i = 1; i <= STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 550));
        if (!alive) return;
        setStep(i);
      }
      const res = await fetch('/api/demo/profile/analyze', { method: 'POST' }).then((r) => r.json());
      if (!alive) return;
      if (res.ok) {
        setUnderstanding(res.understanding);
        await new Promise((r) => setTimeout(r, 400));
        setPhase('result');
      }
    })();
    return () => { alive = false; };
  }, [me.loading, me.loggedIn, me.understanding, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
      <InkScene tone="warm" side="left" />
      <Nav tone="warm" tagline="演示模式 · 预置数据体验" />

      {phase === 'reading' && (
        <section className="relative z-10 mx-auto max-w-xl px-6 pt-24 text-center">
          <h1 className="fade-up font-display text-4xl text-sumi-800">你不需要重新写一份自我介绍</h1>
          <p className="fade-up-1 mt-4 text-sumi-500">演示身份过去留下的那些东西，本身就是。</p>
          <div className="card-warm mx-auto mt-12 max-w-sm p-8 text-left">
            <p className="text-sm text-sumi-500">正在读一些演示身份允许我们看到的内容……</p>
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
          <p className="text-center font-display text-[13px] tracking-[0.24em] text-[#8a7a5c]">演示身份 · 理解画像</p>
          <h2 className="mt-4 text-center font-display text-3xl text-sumi-800">{understanding.coreQuestion || '一个仍在追问的人'}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {(understanding.topics || []).map((t: string) => (
              <span key={t} className="rounded-full border border-[#cfd5dc] bg-white/70 px-3 py-1 text-xs text-sumi-600">{t}</span>
            ))}
          </div>
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => router.push('/demo/encounter')}
              className="rounded-lg bg-[#173e70] px-10 py-3.5 text-[15px] text-white transition-colors hover:bg-[#1258bd]"
            >
              开始遇见
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
