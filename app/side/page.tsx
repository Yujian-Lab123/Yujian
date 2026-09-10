'use client';

import Link from 'next/link';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import { buildContextualPersona } from '@/lib/contextual-persona';
import { useMe } from '@/lib/useMe';

function StatusLine({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-paper-300 bg-white/60 p-5">
      <p className="text-[11px] tracking-widest2 text-gold-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-sumi-700">{children}</p>
    </div>
  );
}

export default function SidePage() {
  const me = useMe();

  if (me.loading) {
    return <main className="min-h-screen bg-paper-100" aria-label="正在读取此刻侧面" />;
  }

  if (!me.loggedIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-paper-100 px-6 text-center">
        <p className="font-display text-3xl text-sumi-800">先从你自己的此刻开始</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-sumi-500">此刻侧面仅向本人展示，需要登录后读取你的长期理解和主动记录。</p>
        <Link href="/" className="btn-primary-dark mt-7 px-8">返回首页</Link>
      </main>
    );
  }

  const persona = buildContextualPersona({
    currentState: me.currentState,
    understanding: me.understanding,
  });
  const hasCurrent = persona.source === 'long-term-and-current' || persona.source === 'current-only';
  const hasLongTerm = persona.source === 'long-term-and-current' || persona.source === 'long-term-only';

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
      <InkScene tone="warm" side="right" />
      <Nav tone="warm" tagline="长期的你，也有今天这一面" />

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-10 md:pt-16">
        <p className="text-center text-xs tracking-widest2 text-gold-500">SIDE · CONTEXTUAL PERSONA</p>
        <h1 className="mt-4 text-center font-display text-4xl text-sumi-800 md:text-5xl">此刻的侧面</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-sumi-500">
          不是给你增加一个标签，而是把长期表达与今天主动记录的状态分开看。
        </p>

        <section className="card-warm mx-auto mt-10 max-w-3xl overflow-hidden p-0">
          <div className="border-b border-paper-300 bg-white/40 px-7 py-6 md:px-10">
            <p className="text-[11px] tracking-widest2 text-gold-500">此刻的解释</p>
            <h2 className="mt-3 font-display text-2xl leading-snug text-sumi-800 md:text-3xl">{persona.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-sumi-600">{persona.summary}</p>
            {persona.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {persona.tags.map((tag) => <span key={tag} className="chip-warm">{tag}</span>)}
              </div>
            )}
          </div>

          <div className="grid gap-4 p-7 md:grid-cols-2 md:p-10">
            <StatusLine title="PRESENT SELF · 此刻记录">
              {hasCurrent ? persona.currentLabel : '还没有记录。写下一句今天的状态后，这里才会有属于今天的内容。'}
            </StatusLine>
            <StatusLine title="LONG-TERM · 长期理解">
              {hasLongTerm ? persona.longTermLabel : '长期理解仍在生成；它不会从一条此刻记录中被推断出来。'}
            </StatusLine>
          </div>

          <div className="mx-7 mb-7 rounded-xl border border-ink-100 bg-ink-50/45 p-5 md:mx-10 md:mb-10">
            <p className="text-[11px] tracking-widest2 text-ink-600">此刻相处方式</p>
            <p className="mt-2 text-sm leading-7 text-sumi-700">{persona.conversationSuggestion}</p>
          </div>
        </section>

        <section className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-[1fr_auto]">
          <p className="rounded-xl border border-paper-300 bg-white/45 px-5 py-4 text-xs leading-6 text-sumi-500">{persona.note}</p>
          <div className="flex gap-3 md:items-center">
            <Link href="/me" className="btn-primary-dark whitespace-nowrap px-5 py-2.5 text-sm">{hasCurrent ? '更新此刻' : '记录此刻'}</Link>
            <Link href="/profile" className="btn-ghost whitespace-nowrap text-sm">看长期画像</Link>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-3xl rounded-xl border border-paper-300 bg-white/35 p-6">
          <p className="font-display text-xl text-sumi-800">边界说明</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-sumi-500">
            <li>此页不写入新数据，也不调用新的大模型；它只解释已有的长期理解与此刻记录。</li>
            <li>“今天遇见”只应使用必要的结构化信号进行排序，不能展示或传播这段此刻记录的原文。</li>
            <li>当状态变化时，更新记录即可；长期画像和此刻侧面不会互相覆盖。</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
