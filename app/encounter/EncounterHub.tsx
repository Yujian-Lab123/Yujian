'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  Info,
  Leaf,
  LockSimple,
  Sparkle,
} from '@phosphor-icons/react';
import { InkCover } from '@/components/Ink';
import Nav from '@/components/Nav';

type CurrentState = { text: string; mood: string; created_at: string } | null;

export type EncounterCard = {
  id: string;
  reason?: string;
  shared?: string[];
  moment?: boolean;
  anchor?: { id?: string; title?: string; topics?: string[]; excerpt?: string };
};

type EncounterHubProps = {
  mode: 'real' | 'demo';
  cards: EncounterCard[];
  loading: boolean;
  error: string;
  profileReady: boolean;
  currentState: CurrentState;
  onRetry: () => void;
};

function isTodayInShanghai(value: string | undefined): boolean {
  if (!value) return false;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(value)) === formatter.format(new Date());
}

function routeFor(mode: 'real' | 'demo', route: '/profile' | '/me' | '/side' | '/encounter') {
  return mode === 'demo' ? `/demo${route}` : route;
}

/**
 * 相遇中枢：真实与演示共用同一 UI；路由、会话和数据由 mode 注入。
 * 侧面在这里始终以“可选准备”呈现，直到匹配契约正式支持持久化选择。
 */
export default function EncounterHub({
  mode,
  cards,
  loading,
  error,
  profileReady,
  currentState,
  onRetry,
}: EncounterHubProps) {
  const isDemo = mode === 'demo';
  const currentUpdated = isTodayInShanghai(currentState?.created_at);
  const hasRecommendations = cards.length > 0;
  const profileHref = routeFor(mode, '/profile');
  const momentHref = routeFor(mode, '/me');
  const sideHref = routeFor(mode, '/side');
  const primaryHref = !profileReady
    ? profileHref
    : hasRecommendations
      ? '#encounter-recommendations'
      : momentHref;
  const primaryLabel = !profileReady ? '先完成长期画像' : hasRecommendations ? '查看今日相遇' : '更新此刻，等待相遇';

  const readinessRows = [
    {
      label: '长期画像',
      detail: profileReady ? '长期表达会作为本次相遇的基础理解。' : '完成长期画像后，才会开始组织真实候选。',
      tag: profileReady ? '基础参考' : '等待完成',
      href: profileHref,
      action: profileReady ? '查看画像' : '去完成',
      icon: BookOpen,
      active: profileReady,
    },
    {
      label: '此刻',
      detail: currentUpdated
        ? '今天的状态会参与本次相遇的方向判断。'
        : currentState
          ? '已有记录；更新今天的状态会更贴近现在的你。'
          : '还没有今天的状态；你可以选择先记录。',
      tag: currentUpdated ? '参与匹配' : '可选更新',
      href: momentHref,
      action: currentUpdated ? '查看此刻' : '更新此刻',
      icon: Clock,
      active: currentUpdated,
    },
    {
      label: '侧面',
      detail: isDemo
        ? '演示中可选择一个侧面，查看它如何影响呈现。'
        : '从一个特定兴趣或处境出发，决定这次想被如何认识。',
      tag: isDemo ? '演示选择' : '可选参与',
      href: sideHref,
      action: '选择侧面',
      icon: Leaf,
      active: false,
    },
  ];

  const directionCards = cards.slice(0, 3);
  const whyToday = currentUpdated
    ? `你今天的「${currentState?.mood || '此刻'}」会与长期表达共同成为方向线索。系统只参考结构化特征，不展示你的状态原文。`
    : '长期表达让相遇有基础。补充今天的状态或一个侧面，会让这一次的推荐更贴近真实的你。';

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-paper-100 paper-texture text-sumi-800">
      <Nav tone={isDemo ? 'blue' : 'warm'} tagline={isDemo ? '演示模式 · 预置数据体验' : '在真实的生活里，遇见有趣的灵魂'} />

      <section className="relative isolate min-h-[272px] overflow-hidden border-b border-[#ddd6c8]/75 sm:min-h-[300px]">
        <Image src="/images/encounter/encounter-hero-wash-v1.png" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-center" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#fffdf7]/[0.10]" />
        <div className="relative mx-auto flex min-h-[272px] max-w-[1280px] flex-col items-center justify-center px-5 pb-7 pt-8 text-center sm:min-h-[300px] sm:pb-8">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] ${
            isDemo
              ? 'border-[#bb9856]/45 bg-[#fff6df]/85 text-[#906714]'
              : 'border-[#6d91ba]/40 bg-[#f6fbff]/85 text-[#24588b]'
          }`}>
            {isDemo ? '演示模式 · 预置数据' : '真实使用中 · 仅使用你的数据'}
          </span>
          <p className="mt-3 text-[11px] tracking-[0.27em] text-[#7c725f]">今日相遇已准备</p>
          <h1 className="mt-1.5 font-display text-[38px] font-semibold leading-tight tracking-[0.075em] text-[#0d3765] sm:text-[48px]">今天，和谁聊一句？</h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-[#52677c] sm:text-[15px]">长期表达是基础；此刻与主动选择的侧面，决定这次相遇会参考什么。</p>
          <a href={primaryHref} className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#16466f] px-7 text-sm font-medium text-white shadow-[0_10px_20px_rgba(17,58,94,0.22)] transition hover:bg-[#0e385e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1769d7]">
            {primaryLabel}<ArrowRight size={17} weight="bold" />
          </a>
          <p className="mt-3 text-xs text-[#647487]">今天只先为你准备相遇方向，读完内容后再决定要不要认识 TA。</p>
        </div>
      </section>

      <div className="relative mx-auto grid max-w-[1280px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-8">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="readiness-heading" className="rounded-2xl border border-[#ded5c5] bg-[#fffdf9]/95 p-4 shadow-[0_12px_28px_rgba(76,59,31,0.06)] sm:p-6">
            <div className="flex flex-col gap-2 border-b border-[#e9e0d2] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-medium tracking-[0.16em] text-[#a17a3b]">THIS TIME</p>
                <h2 id="readiness-heading" className="mt-1 font-display text-[25px] font-semibold text-[#143d6c]">这一次，我想这样被遇见</h2>
              </div>
              <p className="text-xs leading-5 text-[#7a8190]">这些内容将共同影响你在「遇见」中的呈现方式</p>
            </div>

            <div className="divide-y divide-[#e9e1d5]">
              {readinessRows.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="grid gap-3 py-4 sm:grid-cols-[34px_94px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                    <Icon className="hidden text-[#204d78] sm:block" size={24} weight="regular" aria-hidden />
                    <p className="font-display text-lg font-semibold text-[#163e6d]">{item.label}</p>
                    <p className="text-sm leading-6 text-[#65758a]">{item.detail}</p>
                    <div className="flex items-center gap-2 sm:justify-self-end">
                      <span className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs ${item.active ? 'bg-[#edf4e9] text-[#527849]' : 'bg-[#f6efe3] text-[#94744a]'}`}>{item.tag}</span>
                      <Link href={item.href} className="whitespace-nowrap rounded-md border border-[#b7c1cc] bg-white/75 px-2.5 py-1 text-xs font-medium text-[#244e7d] transition hover:border-[#4773a0] hover:bg-[#f0f7ff]">{item.action}</Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#e9e1d5] pt-3 text-xs leading-5 text-[#697a8e]">
              <Info size={17} className="shrink-0 text-[#547493]" aria-hidden />
              <span>初见时，对方只会先看到你选择参与的线索，不会直接看到完整身份与原始记录。</span>
              <Link href={sideHref} className="ml-auto inline-flex items-center gap-1 font-medium text-[#1c5d9d] hover:underline">调整披露方式 <ArrowRight size={13} /></Link>
            </div>
          </section>

          <section id="encounter-recommendations" aria-labelledby="recommendations-heading" className="rounded-2xl border border-[#ded5c5] bg-[#fffdf9]/95 p-4 shadow-[0_12px_28px_rgba(76,59,31,0.06)] sm:p-6">
            <div className="flex flex-col gap-2 border-b border-[#e9e0d2] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-medium tracking-[0.16em] text-[#a17a3b]">POSSIBLE DIRECTIONS</p>
                <h2 id="recommendations-heading" className="mt-1 font-display text-[25px] font-semibold text-[#143d6c]">这一次，可能值得遇见</h2>
              </div>
              {hasRecommendations && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-medium text-[#2563a2] hover:underline">换一批 <ArrowRight size={13} /></button>}
            </div>

            {loading && (
              <div className="flex min-h-44 flex-col items-center justify-center text-center" role="status" aria-live="polite">
                <Clock className="animate-pulse text-[#b18443]" size={27} />
                <p className="mt-3 text-sm text-[#68788d]">正在整理今天可能聊得来的方向…</p>
              </div>
            )}

            {!loading && error && (
              <div className="py-8 text-center" role="alert">
                <p className="text-sm text-[#a05a4a]">{error}</p>
                <button type="button" onClick={onRetry} className="mt-3 rounded-full border border-[#bfcadd] bg-white px-4 py-2 text-xs font-medium text-[#244e7d] hover:border-[#4773a0]">重新尝试</button>
              </div>
            )}

            {!loading && !error && !profileReady && (
              <div className="py-8 text-center">
                <p className="font-display text-xl text-[#173e70]">先让遇见理解长期的你</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#68788d]">长期画像完成后，才会开始组织真实候选，避免用不完整的信息替你作判断。</p>
                <Link href={profileHref} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1c5d9d] hover:underline">前往长期画像 <ArrowRight size={15} /></Link>
              </div>
            )}

            {!loading && !error && profileReady && !hasRecommendations && (
              <div className="py-8 text-center">
                <p className="font-display text-xl text-[#173e70]">今天还没有新的相遇方向</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#68788d]">更新一下此刻，或选择一个想被看见的侧面；出现合适的人时，会从一篇真实内容开始认识 TA。</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href={momentHref} className="rounded-full bg-[#16466f] px-4 py-2 text-xs font-medium text-white hover:bg-[#0e385e]">更新此刻</Link>
                  <Link href={sideHref} className="rounded-full border border-[#bfcadd] bg-white px-4 py-2 text-xs font-medium text-[#244e7d] hover:border-[#4773a0]">选择侧面</Link>
                </div>
              </div>
            )}

            {!loading && !error && profileReady && hasRecommendations && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {directionCards.map((card, index) => {
                  const label = card.shared?.[0] || card.anchor?.topics?.[0] || '值得停下来读的问题';
                  const title = card.anchor?.title || '一篇值得读的内容';
                  return (
                    <Link key={card.id} href={`${routeFor(mode, '/encounter')}/${encodeURIComponent(card.id)}`} className="group relative min-h-36 overflow-hidden rounded-xl border border-[#e5ddcf] bg-[#faf7f0] p-4 transition hover:-translate-y-0.5 hover:border-[#8eb1d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769d7]">
                      <div className="absolute inset-0 opacity-65"><InkCover seed={card.anchor?.id || card.id} /></div>
                      <div className="relative flex h-full min-h-28 flex-col">
                        <p className="text-[11px] font-medium tracking-[0.1em] text-[#9a7338]">相遇方向 {index + 1}</p>
                        <h3 className="mt-2 font-display text-lg font-semibold leading-6 text-[#143d6c]">{label}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#587086]">从《{title}》开始读起</p>
                        <span className="mt-auto ml-auto grid h-8 w-8 place-items-center rounded-full bg-[#16466f] text-white shadow transition group-hover:translate-x-0.5"><ArrowRight size={16} weight="bold" /></span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-5 lg:self-start">
          <section className="rounded-2xl border border-[#ded5c5] bg-[#fffdf9]/95 p-5 shadow-[0_12px_28px_rgba(76,59,31,0.06)]">
            <div className="flex items-center justify-between border-b border-[#e9e0d2] pb-3">
              <h2 className="font-display text-2xl font-semibold text-[#143d6c]">本次相遇方式</h2>
              <Sparkle size={20} className="text-[#9b7840]" weight="fill" aria-hidden />
            </div>
            <ul className="mt-4 space-y-4">
              {readinessRows.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label} className="flex gap-3">
                    <Icon size={21} className="mt-0.5 shrink-0 text-[#28547e]" aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-[#244c78]">{item.label}：{item.active ? item.tag : item.label === '侧面' ? '由你选择' : '等待更新'}</p>
                      <p className="mt-0.5 text-xs leading-5 text-[#718096]">{item.label === '长期画像' ? '作为基础理解' : item.label === '此刻' ? '今天的状态可参与方向判断' : '决定想从哪一面开始相识'}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href={sideHref} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#16466f] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#0e385e]">调整我的准备 <ArrowRight size={17} /></Link>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-[#ded5c5] bg-[#f7fbfc] p-5 shadow-[0_12px_28px_rgba(76,59,31,0.05)]">
            <div className="absolute -bottom-8 -right-6 h-36 w-48 opacity-25"><InkCover seed="why-today" tone="blue" /></div>
            <div className="relative">
              <p className="text-[11px] font-medium tracking-[0.16em] text-[#9a7338]">WHY TODAY</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-[#143d6c]">为什么是今天</h2>
              <p className="mt-3 text-sm leading-7 text-[#5a7088]">{whyToday}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ded5c5] bg-[#fffdf9]/95 p-5 shadow-[0_12px_28px_rgba(76,59,31,0.05)]">
            <div className="flex gap-3">
              <LockSimple size={23} className="shrink-0 text-[#9b7840]" weight="fill" aria-hidden />
              <div>
                <h2 className="font-display text-xl font-semibold text-[#143d6c]">关于「遇见」</h2>
                <p className="mt-2 text-sm leading-6 text-[#66788c]">不是刷人，而是先看见一句话、一种状态、一个侧面，再决定是否要真正认识 TA。</p>
                <Link href="/about" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#1c5d9d] hover:underline">了解更多 <ArrowRight size={15} /></Link>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
