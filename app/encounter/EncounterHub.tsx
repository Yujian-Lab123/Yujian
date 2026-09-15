'use client';

import { useEffect, useState } from 'react';
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
  target?: { quote?: string; role?: string; tags?: string[] };
  difference?: { label?: string; note?: string } | null;
  question?: string;
};

type EncounterHubProps = {
  mode: 'real' | 'demo';
  cards: EncounterCard[];
  loading: boolean;
  error: string;
  profileReady: boolean;
  currentState: CurrentState;
  started: boolean;
  onStart: () => void;
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

/** 把目标区块带入视野；尊重系统的「减少动态效果」偏好。 */
function scrollToSection(id: string) {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  });
}

/** 请求超过该时长仍未结束，就在界面上说明情况，避免用户面对静止页面反复点击。 */
const SLOW_RESPONSE_MS = 12000;

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
  started,
  onStart,
  onRetry,
}: EncounterHubProps) {
  const isDemo = mode === 'demo';
  // 点击「开始整理今日相遇」但前置条件不满足时，必须留下可见反馈，不能静默中断。
  const [blockedHint, setBlockedHint] = useState(false);
  // 请求长时间没有结果时给出说明，避免页面看起来像"点了没反应"。
  const [slowResponse, setSlowResponse] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlowResponse(false);
      return;
    }
    const timer = setTimeout(() => setSlowResponse(true), SLOW_RESPONSE_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const currentUpdated = isTodayInShanghai(currentState?.created_at);
  const hasRecommendations = started && cards.length > 0;
  const profileHref = routeFor(mode, '/profile');
  const momentHref = routeFor(mode, '/me');
  const sideHref = routeFor(mode, '/side');
  const primaryHref = !profileReady ? profileHref : started ? '#encounter-recommendations' : undefined;
  const primaryLabel = !profileReady ? '先完成长期画像' : loading && started ? '正在整理相遇' : started && !hasRecommendations ? '查看相遇状态' : '查看今日相遇';
  const encounterStatus = !profileReady
    ? '长期理解完成后才能开始整理候选。'
    : started && loading
      ? '请求已开始，正在整理允许公开的候选…'
      : started && error
        ? '整理失败，请查看下方原因并重试。'
        : started && !hasRecommendations
          ? isDemo ? '演示候选暂时没有新方向。' : '本次已完成查询，目前没有可供相遇的真实候选。'
          : started
            ? '相遇方向已整理好，继续查看下方结果。'
            : '先确认这次想如何被看见；主动开始后才会整理候选。';

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

  const whyToday = currentUpdated
    ? `你今天的「${currentState?.mood || '此刻'}」会与长期表达共同成为方向线索。系统只参考结构化特征，不展示你的状态原文。`
    : '长期表达让相遇有基础。补充今天的状态或一个侧面，会让这一次的推荐更贴近真实的你。';
  const featuredCard = cards[0];
  const otherDirections = cards.slice(1, 3);

  const startEncounter = () => {
    // 前置条件不满足时不再静默 return：给出明确提示，并把人送到能补全的入口。
    if (!profileReady) {
      setBlockedHint(true);
      scrollToSection('readiness-heading');
      return;
    }
    setBlockedHint(false);
    onStart();
    // 请求状态原本只出现在首屏下方；点击后立即把反馈带入视野。
    scrollToSection('encounter-recommendations');
  };

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
          <p className="mt-3 text-[11px] tracking-[0.27em] text-[#7c725f]">{started && loading ? '正在整理今日相遇' : started && error ? '今日相遇暂未完成' : started && !hasRecommendations ? '今日相遇已查询' : '今日相遇已准备'}</p>
          <h1 className="mt-1.5 font-display text-[38px] font-semibold leading-tight tracking-[0.075em] text-[#0d3765] sm:text-[48px]">今天，和谁聊一句？</h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-[#52677c] sm:text-[15px]">长期表达是基础；此刻与主动选择的侧面，决定这次相遇会参考什么。</p>
          {primaryHref ? (
            <a href={primaryHref} className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#16466f] px-7 text-sm font-medium text-white shadow-[0_10px_20px_rgba(17,58,94,0.22)] transition hover:bg-[#0e385e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1769d7]">
              {primaryLabel}<ArrowRight size={17} weight="bold" />
            </a>
          ) : (
            <button type="button" onClick={startEncounter} className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#16466f] px-7 text-sm font-medium text-white shadow-[0_10px_20px_rgba(17,58,94,0.22)] transition hover:bg-[#0e385e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1769d7]">
              {primaryLabel}<ArrowRight size={17} weight="bold" />
            </button>
          )}
          <p className="mt-3 text-xs text-[#647487]" role="status" aria-live="polite">{encounterStatus}</p>
          {blockedHint && (
            <p className="mt-2 rounded-full bg-[#fdf5e5] px-3 py-1.5 text-xs text-[#967034]" role="alert">
              还不能开始整理相遇：需要先完成长期画像。已为你定位到下方「长期画像」入口。
            </p>
          )}
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
                {slowResponse && (
                  <p className="mt-2 max-w-md text-xs leading-5 text-[#a05a4a]">
                    这次响应明显偏慢。你可以继续等待，也可以
                    <button type="button" onClick={onRetry} className="mx-1 font-medium text-[#1c5d9d] underline">重新尝试</button>
                    一次。
                  </p>
                )}
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

            {!loading && !error && profileReady && !started && (
              <div className="py-9 text-center">
                <p className="font-display text-xl text-[#173e70]">准备好以后，再开始今天的相遇</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#68788d]">系统不会在你打开页面时自动展示任何人；确认准备后，才会从允许公开的长期画像中整理候选。</p>
                <button type="button" onClick={startEncounter} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#16466f] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0e385e]">开始整理今日相遇 <ArrowRight size={16} weight="bold" /></button>
              </div>
            )}

            {!loading && !error && profileReady && started && !hasRecommendations && (
              <div className="py-8 text-center">
                <p className="font-display text-xl text-[#173e70]">{isDemo ? '今天还没有新的相遇方向' : '目前没有可供相遇的真实候选'}</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#68788d]">{isDemo
                  ? '更新一下此刻，或选择一个想被看见的侧面；出现合适的人时，会从一篇真实内容开始认识 TA。'
                  : '查询已完成，但当前真实候选池还没有合适的人。此刻状态已经参与判断，无需反复填写；演示身份不会混入真实推荐。'}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={onRetry} className="rounded-full bg-[#16466f] px-4 py-2 text-xs font-medium text-white hover:bg-[#0e385e]">重新查询</button>
                  <Link href={isDemo ? sideHref : profileHref} className="rounded-full border border-[#bfcadd] bg-white px-4 py-2 text-xs font-medium text-[#244e7d] hover:border-[#4773a0]">{isDemo ? '选择侧面' : '返回画像'}</Link>
                </div>
              </div>
            )}

            {!loading && !error && profileReady && hasRecommendations && featuredCard && (
              <div className="mt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full border border-[#d9cba9] bg-[#fdf5e5] px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-[#967034]">{isDemo ? '演示候选 · 预置画像' : '今日相遇候选 · 尚未发送认识意愿'}</span>
                  <p className="text-xs text-[#718096]">先看公开画像摘要，再决定是否继续了解 TA</p>
                </div>
                <article className="grid overflow-hidden rounded-xl border border-[#e1d7c6] bg-[#fffdfa] md:grid-cols-[160px_minmax(0,1fr)_230px]">
                  <div className="relative min-h-44 bg-[#edf0ee] md:min-h-full">
                    <Image src="/images/encounter/public-portrait-preview-v1.webp" alt="公开画像缩略图" fill sizes="(max-width: 768px) 100vw, 160px" className="object-cover" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-[#fffdf9]/90 px-2.5 py-1 text-[10px] font-medium text-[#526b84]">仅为公开画像缩略图</span>
                  </div>
                  <div className="p-5">
                    <span className="inline-flex rounded-full bg-[#f5ead4] px-2.5 py-1 text-[11px] font-medium text-[#9a7338]">{featuredCard.shared?.[0] || '长期共鸣'}</span>
                    <h3 className="mt-3 font-display text-[22px] font-semibold leading-8 text-[#143d6c]">{featuredCard.target?.quote || featuredCard.target?.role || '一个值得从长期表达开始了解的人'}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#61738a]">{featuredCard.reason || '你们的长期关注与交流方式之间，出现了一条值得慢慢读下去的线索。'}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(featuredCard.target?.tags?.slice(0, 3) || featuredCard.shared?.slice(0, 3) || ['长期表达']).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f2f0ea] px-3 py-1 text-xs text-[#52708b]">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#e7dfd2] bg-[#fcfaf5] p-5 md:border-l md:border-t-0">
                    <dl className="space-y-3 text-sm">
                      <div className="border-b border-[#e6ded2] pb-3"><dt className="font-medium text-[#204d78]">反复思考</dt><dd className="mt-1 text-xs leading-5 text-[#66788c]">{featuredCard.shared?.[0] || '从公开表达中继续了解'}</dd></div>
                      <div className="border-b border-[#e6ded2] pb-3"><dt className="font-medium text-[#204d78]">重视什么</dt><dd className="mt-1 text-xs leading-5 text-[#66788c]">{featuredCard.difference?.label || featuredCard.shared?.[1] || '真实的表达与持续的成长'}</dd></div>
                      <div><dt className="font-medium text-[#204d78]">交流方式</dt><dd className="mt-1 text-xs leading-5 text-[#66788c]">{featuredCard.question || '从一篇代表内容开始，慢慢聊开。'}</dd></div>
                    </dl>
                    <Link href={`${routeFor(mode, '/encounter')}/${encodeURIComponent(featuredCard.id)}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#16466f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0e385e]">查看公开画像 <ArrowRight size={16} weight="bold" /></Link>
                    <Link href={`${routeFor(mode, '/encounter')}/${encodeURIComponent(featuredCard.id)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1c5d9d] hover:underline">从代表内容继续了解 <ArrowRight size={13} /></Link>
                  </div>
                </article>
                <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-[#6e7e90]"><Info size={16} className="shrink-0 text-[#547493]" aria-hidden />仅展示 TA 主动公开的画像摘要；证据原文、此刻记录与完整身份不会在初见时展示。</p>
                {otherDirections.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-[#ece4d8] pt-4 sm:flex-row sm:items-center">
                    <p className="shrink-0 text-sm font-medium text-[#234c78]">还有 {otherDirections.length} 个可能的相遇方向</p>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      {otherDirections.map((card) => (
                        <Link key={card.id} href={`${routeFor(mode, '/encounter')}/${encodeURIComponent(card.id)}`} className="group flex min-w-0 items-center gap-3 rounded-lg border border-[#e6ded2] bg-[#fffefa] px-3 py-2.5 transition hover:border-[#9eb7ce]">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2f2] text-[#4d6a85]"><Leaf size={16} /></span>
                          <span className="min-w-0 flex-1 truncate text-xs text-[#5b7087]">{card.shared?.[0] || card.anchor?.title || '从另一种视角开始了解'}</span>
                          <ArrowRight size={15} className="shrink-0 text-[#245b91] transition group-hover:translate-x-0.5" />
                        </Link>
                      ))}
                    </div>
                    <button type="button" onClick={onRetry} className="shrink-0 text-xs font-medium text-[#1c5d9d] hover:underline">换一批</button>
                  </div>
                )}
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
                      <p className="text-sm font-medium text-[#244c78]">{item.label}：{item.active ? item.tag : item.label === '侧面' ? '由你选择' : item.label === '此刻' && currentState ? '已有记录，可更新' : item.label === '长期画像' ? '待完成' : '尚未记录'}</p>
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
                <Link href={isDemo ? '/demo' : '/about'} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#1c5d9d] hover:underline">了解更多 <ArrowRight size={15} /></Link>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
