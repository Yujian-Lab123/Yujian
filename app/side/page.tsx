'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Circle,
  LockSimple,
  Plus,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { buildContextualPersona } from '@/lib/contextual-persona';
import { useMe } from '@/lib/useMe';
import { useMemo, useRef, useState } from 'react';
import Nav from '@/components/Nav';

type Visibility = 'private' | 'candidates' | 'mutual';

type Facet = {
  id: string;
  title: string;
  description: string;
  evidence: string;
  image: string;
  visibility: Visibility;
};

const initialFacets: Facet[] = [
  {
    id: 'walk',
    title: '想散步的我',
    description: '最近想放慢一点，在城市里走走，也愿意和同样松弛的人聊聊。',
    evidence: '来自 2 条长期内容 · 1 条此刻记录',
    image: '/images/side/walking-by-the-lake.webp',
    visibility: 'mutual',
  },
  {
    id: 'life',
    title: '技术之外的我',
    description: '除了代码，也喜欢咖啡、书籍和城市里的慢生活。',
    evidence: '3 条内容依据',
    image: '/images/side/coffee-and-book.webp',
    visibility: 'private',
  },
  {
    id: 'uncertain',
    title: '最近有点迷茫的我',
    description: '面对一些选择，还在慢慢梳理方向。',
    evidence: '2 条内容依据',
    image: '/images/side/misty-path.webp',
    visibility: 'private',
  },
  {
    id: 'quiet',
    title: '只想轻轻说一句',
    description: '有些话不适合大声说，但依然希望被懂得。',
    evidence: '2 条内容依据',
    image: '/images/side/plum-blossom.webp',
    visibility: 'mutual',
  },
];

const visibilityLabels: Record<Visibility, string> = {
  private: '仅自己',
  candidates: '匹配候选',
  mutual: '双方同意后可见',
};

function SideSkeleton() {
  // 骨架版式与真实页保持一致（左 2.15fr / 右 0.85fr 两栏），
  // 否则 me.loading 结束后真实内容涌入，还会再跳一次。
  return (
    <main
      className="min-h-screen bg-[#f7f1e7] bg-[length:max(1680px,100%)_auto] bg-top bg-no-repeat"
      style={{ backgroundImage: "url('/images/profile/ink-landscape-bg-v1.png')" }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">正在读取侧面</span>

      <Nav tone="warm" tagline="在真实的生活里，遇见有趣的灵魂" />

      <div className="mo-page-in mx-auto grid max-w-[1280px] gap-3 px-4 pb-12 pt-3 lg:grid-cols-[minmax(0,2.15fr)_minmax(320px,0.85fr)] lg:px-8">
        <section className="overflow-hidden rounded-xl border border-[#b8ab94]/30 bg-[#fffdf8]/95">
          <div className="border-b border-[#d3c6b0]/45 px-6 pb-6 pt-7 sm:px-8 lg:px-9">
            <div className="mo-skeleton-warm h-3 w-32" />
            <div className="mt-5 mo-skeleton-warm h-8 w-[min(420px,80%)]" />
            <div className="mt-5 mo-skeleton-warm h-4 w-[min(360px,70%)]" />
          </div>
          <div className="px-6 pb-6 pt-5 sm:px-8 lg:px-9">
            <div className="mo-skeleton-warm h-5 w-32" />
            <div className="mt-3 flex flex-col gap-5 rounded-xl border border-[#438dfa]/40 bg-[#eef6ff]/50 p-4 sm:flex-row sm:items-center">
              <div className="mo-skeleton-warm h-[132px] w-full sm:h-[112px] sm:w-[150px]" />
              <div className="flex-1 space-y-3">
                <div className="mo-skeleton-warm h-6 w-40" />
                <div className="mo-skeleton-warm h-4 w-full" />
                <div className="mo-skeleton-warm h-4 w-3/4" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 py-3">
                  <div className="mo-skeleton-warm h-[70px] w-[88px]" />
                  <div className="space-y-2.5">
                    <div className="mo-skeleton-warm h-5 w-36" />
                    <div className="mo-skeleton-warm h-3.5 w-full" />
                    <div className="mo-skeleton-warm h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-[#b8ab94]/30 bg-[#fffdf8]/95 p-6">
          <div className="mo-skeleton-warm h-6 w-36" />
          <div className="mt-5 flex gap-4">
            <div className="mo-skeleton-warm h-[102px] w-[92px]" />
            <div className="flex-1 space-y-2.5 pt-1">
              <div className="mo-skeleton-warm h-5 w-28" />
              <div className="mo-skeleton-warm h-3.5 w-full" />
              <div className="mo-skeleton-warm h-3.5 w-4/5" />
            </div>
          </div>
          <div className="mt-8 space-y-3 border-t border-[#cfc5b3]/45 pt-6">
            <div className="mo-skeleton-warm h-5 w-24" />
            <div className="mo-skeleton-warm h-4 w-full" />
            <div className="mo-skeleton-warm h-10 w-full" />
          </div>
        </aside>
      </div>
    </main>
  );
}

function FacetImage({ facet, className = '' }: { facet: Facet; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg border border-[#cfbea0]/35 bg-[#ebe3d5] ${className}`}>
      <Image src={facet.image} alt="" fill sizes="160px" className="object-cover" />
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-8 w-14 shrink-0 rounded-full border p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769d7] ${
        checked ? 'border-[#1769d7] bg-[#1769d7]' : 'border-[#b7b5ad] bg-[#d8d6cf]'
      }`}
    >
      <span className={`block h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function Pill({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${active ? 'border-[#82b4ff] bg-[#eaf3ff] text-[#1769d7]' : 'border-[#cfd5dc] bg-white/55 text-[#627083]'}`}>
      {active ? <CheckCircle size={15} weight="fill" /> : <Circle size={13} weight="fill" />}
      {children}
    </span>
  );
}

export default function SidePage() {
  const me = useMe();
  const [facets, setFacets] = useState(initialFacets);
  const [activeId, setActiveId] = useState('walk');
  const [selectedId, setSelectedId] = useState('walk');
  const [recommendEnabled, setRecommendEnabled] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('mutual');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [message, setMessage] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const persona = useMemo(() => buildContextualPersona({ currentState: me.currentState, understanding: me.understanding }), [me.currentState, me.understanding]);
  const activeFacet = facets.find((facet) => facet.id === activeId) ?? facets[0];
  const selectedFacet = facets.find((facet) => facet.id === selectedId) ?? activeFacet;
  const previewMode = process.env.NODE_ENV !== 'production'
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('preview') === '1';

  function descriptionFor(facet: Facet) {
    return facet.id === 'walk' && persona.source !== 'unavailable' ? persona.summary : facet.description;
  }

  if (me.loading) {
    return <SideSkeleton />;
  }

  if (!me.loggedIn && !previewMode) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f1e7] px-6 text-center">
        <div className="max-w-md rounded-2xl border border-[#cdbd9e]/40 bg-white/65 p-10 shadow-[0_18px_55px_rgba(63,50,29,0.08)]">
          <LockSimple className="mx-auto text-[#9b7847]" size={28} />
          <h1 className="mt-5 font-display text-3xl text-[#173e70]">先登录，再看见你的不同侧面</h1>
          <p className="mt-4 text-sm leading-7 text-[#687181]">侧面包含只属于你的选择和隐私设置，需要登录后查看。</p>
          <Link href="/" className="mt-7 inline-flex rounded-full bg-[#1769d7] px-7 py-3 text-sm font-medium text-white">返回首页</Link>
        </div>
      </main>
    );
  }

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2200);
  }

  function activateFacet() {
    setActiveId(selectedFacet.id);
    setRecommendEnabled(true);
    showMessage(`已启用“${selectedFacet.title}”参与相遇`);
  }

  function createFacet() {
    if (!newTitle.trim() || !newDescription.trim()) return;
    const created: Facet = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      evidence: '由你主动创建',
      image: '/images/side/plum-blossom.webp',
      visibility: 'private',
    };
    setFacets((current) => [...current, created]);
    setSelectedId(created.id);
    setVisibility('private');
    setDrawerOpen(false);
    setNewTitle('');
    setNewDescription('');
    showMessage('新侧面已创建，默认仅自己可见');
  }

  return (
    <main
      className="min-h-screen bg-[#f7f1e7] bg-[length:max(1680px,100%)_auto] bg-top bg-no-repeat text-[#1a416f]"
      style={{ backgroundImage: "url('/images/profile/ink-landscape-bg-v1.png')" }}
    >
      <Nav tone="warm" tagline="在真实的生活里，遇见有趣的灵魂" />

      <div className="mx-auto grid max-w-[1280px] gap-3 px-4 pb-12 pt-3 lg:grid-cols-[minmax(0,2.15fr)_minmax(320px,0.85fr)] lg:px-8">
        <section className="overflow-hidden rounded-xl border border-[#b8ab94]/30 bg-[#fffdf8]/95 shadow-[0_14px_40px_rgba(54,46,31,0.08)] backdrop-blur-sm">
          <div className="relative overflow-hidden border-b border-[#d3c6b0]/45 px-6 pb-5 pt-6 sm:px-8 lg:px-9">
            <div className="pointer-events-none absolute -bottom-20 right-[-30px] h-[220px] w-[320px] opacity-20">
              <Image src="/images/side/misty-path.webp" alt="" fill sizes="320px" loading="eager" className="object-cover" />
            </div>
            <div className="relative flex items-start justify-between gap-5">
              <div className="min-w-0 md:max-w-[72%]">
                <p className="font-display text-[10px] tracking-[0.42em] text-[#6682a4]">CONTEXTUAL SELF</p>
                <h1 className="mt-4 font-display text-[clamp(1.8rem,3.3vw,2.65rem)] font-semibold leading-[1.18] tracking-[0.04em] text-[#153f75]">今天，想从哪一面被理解？</h1>
                <span className="mt-4 block h-px w-7 bg-[#b9873d]" />
                <p className="mt-3 text-sm leading-7 text-[#365f8e] sm:text-[15px]">侧面不是人设，而是你在不同语境下真实存在的一部分。</p>
                <p className="mt-3 font-display text-sm tracking-[0.08em] text-[#2e5d93] md:hidden">“不同的我，都是真实的。”</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="relative hidden shrink-0 items-center gap-2 rounded-xl bg-[#1769d7] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_20px_rgba(23,105,215,0.24)] transition hover:bg-[#0d5fc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769d7] sm:inline-flex"
              >
                <Plus size={18} weight="bold" />创建侧面
              </button>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-8 hidden w-36 -rotate-6 text-center font-display text-[15px] leading-7 tracking-[0.12em] text-[#2e5d93] md:block" aria-hidden="true">
              <p>不同的我，</p>
              <p>都是真实的。</p>
              <span className="mx-auto mt-1 block h-px w-5 bg-[#b9873d]" />
            </div>
          </div>

          <div className="px-6 pb-5 pt-4 sm:px-8 lg:px-9">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-xl font-semibold text-[#173e70]">当前参与相遇</p>
                <p className="mt-1 text-xs text-[#8190a0]">一次只启用一个侧面，匹配时只读取结构化线索。</p>
              </div>
              <button type="button" onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="hidden items-center gap-1 text-xs text-[#1769d7] hover:underline sm:inline-flex">
                更换侧面 <ArrowRight size={14} />
              </button>
            </div>

            <article className="mt-3 flex flex-col gap-5 rounded-xl border border-[#438dfa] bg-[#eef6ff]/74 p-3 sm:flex-row sm:items-center sm:p-4">
              <FacetImage facet={activeFacet} className="h-[132px] w-full sm:h-[112px] sm:w-[150px]" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl font-semibold text-[#173e70]">{activeFacet.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#355f8e]">{descriptionFor(activeFacet)}</p>
                <p className="mt-1 text-xs text-[#758aa4]">{activeFacet.evidence}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill active>当前启用</Pill>
                  <button type="button" onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="inline-flex items-center gap-1.5 rounded-full border border-[#c8d2df] bg-white/70 px-3 py-1 text-xs text-[#294f7c] hover:border-[#7e9ec2]">
                    <ArrowsClockwise size={14} />更换
                  </button>
                </div>
              </div>
            </article>

            <div ref={listRef} className="mt-5 scroll-mt-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold text-[#173e70]">全部侧面</h2>
                <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-1 text-xs text-[#1769d7] sm:hidden"><Plus size={15} />新建</button>
              </div>

              <div className="mt-2 divide-y divide-[#cfc5b3]/45 border-y border-[#cfc5b3]/45">
                {facets.filter((facet) => facet.id !== activeId).map((facet) => {
                  const selected = facet.id === selectedId;
                  return (
                    <button
                      type="button"
                      key={facet.id}
                      onClick={() => {
                        setSelectedId(facet.id);
                        setVisibility(facet.visibility);
                      }}
                      className={`grid w-full grid-cols-[76px_minmax(0,1fr)] items-center gap-4 px-1 py-3 text-left transition sm:grid-cols-[88px_minmax(0,1fr)_auto] ${selected ? 'bg-[#edf5ff]/65' : 'hover:bg-white/55'}`}
                    >
                      <FacetImage facet={facet} className="h-[68px] w-[76px] sm:h-[70px] sm:w-[88px]" />
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-[#173e70]">{facet.title}</h3>
                        <p className="mt-1 truncate text-xs text-[#45698f] sm:text-sm">{descriptionFor(facet)}</p>
                        <p className="mt-1 text-[11px] text-[#8493a4]">{facet.evidence}</p>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                        <Pill>未启用</Pill>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#d2d8de] bg-white/55 px-3 py-1 text-xs text-[#617187]">
                          <LockSimple size={13} />{visibilityLabels[facet.visibility]}
                        </span>
                        <span className="ml-1 inline-flex items-center gap-1 text-xs text-[#245d9d]">管理 <ArrowRight size={14} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="button" onClick={() => setDrawerOpen(true)} className="mt-4 flex w-full items-center gap-4 rounded-xl border border-[#cfbd9d]/25 bg-[#f8f3e8]/75 px-5 py-3.5 text-left transition hover:border-[#c1a97d]/50 hover:bg-[#f8f0df]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff9ee] text-[#bd8731]"><Sparkle size={23} weight="fill" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block font-display text-sm text-[#244d79]">从近期内容中，发现一个可能的新侧面</strong>
                <span className="mt-1 block truncate text-xs text-[#7f8a96]">我们从你的记录中发现了一些新线索，可能属于另一个值得被看见的你。</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[#1769d7]">查看建议 <ArrowRight size={15} /></span>
            </button>
          </div>
        </section>

        <aside className="relative h-fit overflow-hidden rounded-xl border border-[#b8ab94]/30 bg-[#fffdf8]/95 shadow-[0_14px_40px_rgba(54,46,31,0.08)] backdrop-blur-sm lg:sticky lg:top-3 lg:min-h-[calc(100vh-98px)]">
          <div className="relative z-10 overflow-hidden border-b border-[#cfc5b3]/45 px-6 pb-6 pt-7">
            <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-60 opacity-20">
              <Image src="/images/side/misty-path.webp" alt="" fill sizes="240px" className="object-cover" />
            </div>
            <h2 className="relative font-display text-2xl font-semibold text-[#173e70]">这面如何被使用</h2>
            <span className="relative mt-3 block h-px w-7 bg-[#b9873d]" />
            <div className="relative mt-5 flex gap-4">
              <FacetImage facet={selectedFacet} className="h-[102px] w-[92px]" />
              <div className="min-w-0 pt-1">
                <h3 className="font-display text-lg font-semibold text-[#173e70]">{selectedFacet.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#4c6d91]">{descriptionFor(selectedFacet)}</p>
                <p className="mt-2 text-[11px] text-[#8493a4]">{selectedFacet.evidence}</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 border-b border-[#cfc5b3]/45 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#173e70]">参与推荐</h3>
                <p className="mt-2 text-xs leading-5 text-[#748398]">允许系统用这个侧面的结构化线索寻找合适的人。</p>
              </div>
              <Toggle checked={recommendEnabled} onChange={() => setRecommendEnabled((value) => !value)} label="是否使用此侧面参与推荐" />
            </div>
          </div>

          <div className="relative z-10 px-6 py-6">
            <h3 className="font-display text-lg font-semibold text-[#173e70]">展示时机</h3>
            <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-[#b9c7d7] bg-white/40">
              {(['private', 'candidates', 'mutual'] as Visibility[]).map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setVisibility(option)}
                  className={`min-h-10 border-r border-[#cbd4df] px-2 text-[11px] transition last:border-r-0 ${visibility === option ? 'bg-[#e8f2ff] font-medium text-[#1769d7] shadow-[inset_0_0_0_1px_#3f8df2]' : 'text-[#67778b] hover:bg-white/60'}`}
                >
                  {visibilityLabels[option]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-[#748398]">
              {visibility === 'private' && '这个侧面只用于你自己的整理，不会向他人展示。'}
              {visibility === 'candidates' && '匹配时可作为候选线索，但不会直接展示记录原文。'}
              {visibility === 'mutual' && '只有双方都愿意认识彼此后，才会看到这个侧面。'}
            </p>

            <div className="mt-5 flex gap-3 rounded-lg border border-[#d9e1ea] bg-[#f0f5fa]/80 p-4 text-[#315b88]">
              <LockSimple className="mt-0.5 shrink-0" size={19} weight="fill" />
              <p className="text-xs leading-5"><strong className="block">你的侧面记录原文不会展示给别人。</strong>我们只会使用结构化的主题、关键词等信息进行匹配。</p>
            </div>

            {selectedFacet.id !== activeId && (
              <button type="button" onClick={activateFacet} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-[#1769d7] bg-white/60 px-5 py-3 text-sm font-medium text-[#1769d7] transition hover:bg-[#eef6ff]">
                <Check size={17} weight="bold" />设为当前侧面
              </button>
            )}
            <button type="button" onClick={() => showMessage('设置已保存')} className="mt-3 w-full rounded-full bg-[#1769d7] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_20px_rgba(23,105,215,0.22)] transition hover:bg-[#0d5fc8]">保存设置</button>
          </div>
          <div className="pointer-events-none absolute -bottom-16 -right-20 h-64 w-80 opacity-[0.12]">
            <Image src="/images/side/misty-path.webp" alt="" fill sizes="320px" className="object-cover" />
          </div>
        </aside>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="new-side-title">
          <button type="button" aria-label="关闭创建侧面" className="absolute inset-0 bg-[#172333]/30 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <section className="absolute bottom-0 right-0 top-0 w-full max-w-[480px] overflow-y-auto border-l border-[#c8b998] bg-[#fbf7ee] p-7 shadow-[-20px_0_60px_rgba(31,41,55,0.16)] sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-[#7890aa]">CREATE A SIDE</p>
                <h2 id="new-side-title" className="mt-3 font-display text-3xl font-semibold text-[#173e70]">创建新的侧面</h2>
                <p className="mt-3 text-sm leading-6 text-[#69798c]">给不同语境下的自己一个名字。它不会改变你的长期画像。</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#ccd3da] text-[#53677e] hover:bg-white" aria-label="关闭"><X size={18} /></button>
            </div>

            <label className="mt-8 block text-sm font-medium text-[#244d79]">
              侧面名称
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value.slice(0, 20))} className="mt-2 w-full rounded-lg border border-[#c9d2dc] bg-white/70 px-4 py-3 text-sm font-normal text-[#2d4f74] outline-none transition focus:border-[#438dfa] focus:ring-2 focus:ring-[#438dfa]/15" placeholder="例如：想散步的我" />
              <span className="mt-1 block text-right text-[11px] font-normal text-[#8b98a7]">{newTitle.length}/20</span>
            </label>

            <label className="mt-5 block text-sm font-medium text-[#244d79]">
              用几句话描述这个侧面的你
              <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value.slice(0, 180))} className="mt-2 min-h-[140px] w-full resize-none rounded-lg border border-[#c9d2dc] bg-white/70 px-4 py-3 text-sm font-normal leading-6 text-[#2d4f74] outline-none transition focus:border-[#438dfa] focus:ring-2 focus:ring-[#438dfa]/15" placeholder="可以写喜欢的事情、最近的状态，或一段想分享的故事。" />
              <span className="mt-1 block text-right text-[11px] font-normal text-[#8b98a7]">{newDescription.length}/180</span>
            </label>

            <div className="mt-6 rounded-xl border border-[#d4c9b5] bg-white/45 p-4">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="font-display text-base font-semibold text-[#244d79]">默认仅自己可见</p>
                  <p className="mt-1 text-xs leading-5 text-[#788698]">创建后再决定是否参与推荐，以及何时向他人展示。</p>
                </div>
                <LockSimple size={22} className="shrink-0 text-[#9b7847]" />
              </div>
            </div>

            <button type="button" disabled={!newTitle.trim() || !newDescription.trim()} onClick={createFacet} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#1769d7] px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#0d5fc8] disabled:cursor-not-allowed disabled:bg-[#aeb9c7]">
              创建这个侧面 <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}

      {message && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#173e70] px-5 py-3 text-sm text-white shadow-xl">
          <CheckCircle size={18} weight="fill" />{message}
        </div>
      )}

      <span className="sr-only">{persona.note}</span>
    </main>
  );
}
