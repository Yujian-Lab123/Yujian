'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, LockSimple, Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';
import Nav from '@/components/Nav';
import { useDemoMe } from '@/lib/experience-mode/useDemoMe';

const DEMO_SIDES = [
  { id: 'walk', title: '想散步的我', body: '最近想放慢一点，在城市里走走，也愿意和同样松弛的人聊聊。', image: '/images/side/walking-by-the-lake.webp', note: '来自演示身份的此刻与长期内容' },
  { id: 'life', title: '技术之外的我', body: '除了代码，也喜欢咖啡、书籍和城市里的慢生活。', image: '/images/side/coffee-and-book.webp', note: '来自 3 条演示内容依据' },
  { id: 'quiet', title: '只想轻轻说一句', body: '有些话不适合大声说，但依然希望被懂得。', image: '/images/side/plum-blossom.webp', note: '默认仅在演示中可见' },
];

/** 演示侧面页：只使用预置文案和 Demo 会话，永远不跳入真实 /side。 */
export default function DemoSidePage() {
  const me = useDemoMe();
  const [activeId, setActiveId] = useState('walk');
  const [saved, setSaved] = useState(false);
  const active = DEMO_SIDES.find((side) => side.id === activeId) ?? DEMO_SIDES[0];

  if (me.loading) {
    return <main className="min-h-screen bg-paper-100 paper-texture"><Nav tone="blue" tagline="演示模式 · 预置数据体验" /><p className="py-24 text-center text-sm text-sumi-400">正在读取演示侧面…</p></main>;
  }
  if (!me.loggedIn) {
    return <main className="min-h-screen bg-paper-100 paper-texture"><Nav tone="blue" tagline="演示模式 · 预置数据体验" /><div className="px-6 py-24 text-center"><p className="font-display text-2xl text-[#173e70]">演示会话已结束</p><Link href="/demo" className="mt-5 inline-flex rounded-full bg-[#173e70] px-5 py-2.5 text-sm text-white">回到演示入口</Link></div></main>;
  }

  return (
    <main className="min-h-screen bg-paper-100 paper-texture text-sumi-800">
      <Nav tone="blue" tagline="演示模式 · 预置数据体验" />
      <section className="mx-auto max-w-[1120px] px-5 pb-20 pt-10 lg:px-8 lg:pt-14">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-[#b8860b]/45 bg-[#fdf3d8] px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-[#8a6d1a]">演示模式 · 不会影响真实账号</span>
          <h1 className="mt-4 font-display text-4xl font-semibold text-[#173e70]">这次，想从哪一面被理解？</h1>
          <p className="mt-3 text-sm leading-7 text-[#63758b]">侧面不是第二个身份，而是你在一个语境下愿意主动带入相遇的观察窗口。</p>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="divide-y divide-[#e5ddcf] rounded-2xl border border-[#d8cfbd] bg-[#fffdf8]/90 px-5 shadow-[0_14px_34px_rgba(76,59,31,0.06)] sm:px-7">
            {DEMO_SIDES.map((side) => {
              const selected = side.id === activeId;
              return (
                <button key={side.id} type="button" onClick={() => { setActiveId(side.id); setSaved(false); }} className={`grid w-full grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-4 py-5 text-left transition ${selected ? 'bg-[#eff6ff]/65' : 'hover:bg-[#fbf8f1]'}`}>
                  <div className="relative h-[70px] w-[82px] overflow-hidden rounded-lg border border-[#d8cfbd]"><Image src={side.image} alt="" fill sizes="82px" className="object-cover" /></div>
                  <span className="min-w-0"><strong className="block font-display text-xl text-[#173e70]">{side.title}</strong><span className="mt-1 block text-xs leading-5 text-[#61748a]">{side.body}</span><span className="mt-1 block text-[11px] text-[#8b98a7]">{side.note}</span></span>
                  {selected ? <CheckCircle size={22} weight="fill" className="text-[#1769d7]" aria-label="当前选择" /> : <span className="h-5 w-5 rounded-full border border-[#bdc7d2]" aria-hidden />}
                </button>
              );
            })}
          </div>

          <aside className="h-fit rounded-2xl border border-[#d8cfbd] bg-[#fffdf8]/90 p-6 shadow-[0_14px_34px_rgba(76,59,31,0.06)] lg:sticky lg:top-4">
            <p className="text-[11px] font-medium tracking-[0.18em] text-[#a18a64]">THIS DEMO ENCOUNTER</p>
            <h2 className="mt-2 font-display text-2xl text-[#173e70]">本次演示选择</h2>
            <div className="relative mt-5 h-32 overflow-hidden rounded-xl"><Image src={active.image} alt="" fill sizes="300px" className="object-cover" /></div>
            <h3 className="mt-4 font-display text-xl text-[#173e70]">{active.title}</h3>
            <p className="mt-2 text-xs leading-6 text-[#61748a]">{active.body}</p>
            <div className="mt-5 flex gap-2 rounded-xl border border-[#dbe4ed] bg-[#f2f7fb] p-3 text-xs leading-5 text-[#496c90]"><LockSimple className="mt-0.5 shrink-0" size={16} weight="fill" />这项选择仅供演示流程体验，不会写入或影响真实用户资料。</div>
            <button type="button" onClick={() => setSaved(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1769d7] px-5 py-3 text-sm font-medium text-white hover:bg-[#0d5fc8]"><Sparkle size={17} weight="fill" />{saved ? '已用于本次演示' : '用于本次演示相遇'}</button>
            <Link href="/demo/encounter" className="mt-3 flex w-full items-center justify-center rounded-full border border-[#8eb7ea] bg-white/65 px-5 py-3 text-sm font-medium text-[#1769d7] hover:bg-[#edf5ff]">查看演示相遇</Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
