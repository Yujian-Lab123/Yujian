'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowSquareOutIcon,
  CaretDownIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  FlagIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  QuotesIcon,
  ScalesIcon,
  StackIcon,
  XIcon,
} from '@phosphor-icons/react';

type Evidence = { id: string; title: string; type: string; url?: string | null; date?: string | null; excerpt?: string | null };
type WithEvidence = { evidence_ids?: string[] };
type Artifact = {
  meta: { content_count: number; time_range?: { from?: string; to?: string } | null };
  evidence_index: Evidence[];
  profile: {
    summary: { one_sentence: string; core_insights: Array<{ claim: string; explanation: string } & WithEvidence> };
    life_trajectory: Array<{ period: string; event: string; change: string } & WithEvidence>;
    long_term_concerns: Array<{ question: string; explanation: string } & WithEvidence>;
    drivers: Array<{ driver: string; explanation: string } & WithEvidence>;
    decision_patterns: Array<{ name: string; description: string; process: string[] } & WithEvidence>;
    value_preferences: Array<{ left: string; right: string; explanation: string } & WithEvidence>;
    conversation_style: { traits: Array<{ trait: string; explanation: string } & WithEvidence>; good_entry_points: string[] };
    representative_contents: Array<{ content_id: string; title: string; content_type: string; date: string; why_representative: string; supports: string[] }>;
    unknowns: string[];
  };
};

type EvidenceSelection = { title: string; description: string; evidenceIds: string[] } | null;
type Point = { x: number; y: number };
type ConnectorPath = { id: string; d: string; start: Point; end: Point; opacity: number; kind: 'branch' | 'timeline' };
type MapLayout = {
  conversationTop: number;
  decisionsTop: number;
  valuesTop: number;
  worksTop: number;
  bottomTop: number;
  canvasHeight: number;
};

const BASE_LAYOUT: MapLayout = {
  conversationTop: 350,
  decisionsTop: 468,
  valuesTop: 618,
  worksTop: 602,
  bottomTop: 840,
  canvasHeight: 1020,
};

const productNav = [
  ['个人', '/profile'],
  ['此刻', '/me'],
  ['侧面', '/side'],
  ['遇见', '/encounter'],
  ['关于遇见', '/'],
] as const;

function range(from?: string, to?: string) { return [from?.slice(0, 4), to?.slice(0, 4)].filter(Boolean).join('–'); }
function short(value: string, length: number) { return value.length > length ? `${value.slice(0, length)}…` : value; }
function selectVisualSlots<T>(items: T[], limit: number) {
  if (items.length <= limit) return items;
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * (items.length - 1) / (limit - 1))]);
}

function pointInCanvas(rect: DOMRect, canvas: DOMRect, logicalWidth: number, logicalHeight: number, x: number, y: number): Point {
  return {
    x: (rect.left - canvas.left + rect.width * x) * logicalWidth / canvas.width,
    y: (rect.top - canvas.top + rect.height * y) * logicalHeight / canvas.height,
  };
}

function cubic(start: Point, controlA: Point, controlB: Point, end: Point) {
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${controlA.x.toFixed(1)} ${controlA.y.toFixed(1)}, ${controlB.x.toFixed(1)} ${controlB.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function windingPath(points: Point[]) {
  if (points.length < 2) return '';
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] || point;
    const next = points[index + 1];
    const after = points[index + 2] || next;
    const controlA = { x: point.x + (next.x - previous.x) / 6, y: point.y + (next.y - previous.y) / 6 };
    const controlB = { x: next.x - (after.x - point.x) / 6, y: next.y - (after.y - point.y) / 6 };
    return `${path} C ${controlA.x.toFixed(1)} ${controlA.y.toFixed(1)}, ${controlB.x.toFixed(1)} ${controlB.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }, `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
}

function EvidenceButton({ children, title, description, evidenceIds, onOpen, className = '' }: {
  children: React.ReactNode; title: string; description: string; evidenceIds?: string[];
  onOpen: (next: EvidenceSelection) => void; className?: string;
}) {
  return <button type="button" className={`reference-evidence ${className}`} onClick={() => onOpen({ title, description, evidenceIds: evidenceIds || [] })}>{children}</button>;
}

function DimensionTitle({ no, title, note }: { no: string; title: string; note: string }) {
  return <div className="reference-dimension-title"><b>{no}</b><span><strong>{title}</strong><small>{note}</small></span></div>;
}

function ProfileHeader({ query, onQueryChange }: { query: string; onQueryChange: (value: string) => void }) {
  return (
    <header className="relative z-30 border-b border-[#b7a98e]/20 bg-[#fbf8f1]/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[74px] max-w-[1280px] items-center gap-8 px-5 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-4" aria-label="返回遇见首页">
          <span className="font-display text-[28px] font-bold tracking-[0.16em] text-[#173e70]">遇见</span>
          <span className="hidden border-l border-[#c8b998] pl-4 text-[11px] leading-5 tracking-[0.08em] text-[#65758a] sm:block">
            在真实的生活里<br />遇见有趣的灵魂
          </span>
        </Link>

        <nav className="ml-auto hidden h-[74px] items-stretch lg:flex" aria-label="主要导航">
          {productNav.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center border-b-2 px-6 font-display text-[15px] font-semibold tracking-[0.08em] transition-colors ${
                href === '/profile'
                  ? 'border-[#1769d7] text-[#1258bd]'
                  : 'border-transparent text-[#173e70] hover:border-[#b7c8df] hover:text-[#1258bd]'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <label className="ml-auto hidden w-[250px] items-center gap-2 rounded-full border border-[#9dadc2]/35 bg-white/55 px-4 py-2 text-[#77859a] xl:flex">
          <MagnifyingGlassIcon size={18} aria-hidden />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#8f99a7]"
            placeholder="搜索人、话题或内容…"
            aria-label="搜索代表内容"
          />
        </label>

        <Link href="/me" className="flex shrink-0 items-center gap-2 text-[#173e70]" aria-label="打开我的页面">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#c8b998]/70 bg-[#e6dcc9] font-display text-sm">遇</span>
          <CaretDownIcon size={14} aria-hidden />
        </Link>
      </div>
      <nav className="mx-auto flex max-w-[1280px] overflow-x-auto border-t border-[#b7a98e]/15 px-3 lg:hidden" aria-label="移动端主要导航">
        {productNav.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className={`shrink-0 border-b-2 px-4 py-2.5 font-display text-sm ${
              href === '/profile' ? 'border-[#1769d7] text-[#1258bd]' : 'border-transparent text-[#536a84]'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default function ProfileExperience({ artifact, avatarSrc }: { artifact: Artifact; avatarSrc?: string | null }) {
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<EvidenceSelection>(null);
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([]);
  const [canvasScale, setCanvasScale] = useState(1);
  const [mapLayout, setMapLayout] = useState<MapLayout>(BASE_LAYOUT);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const centerRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const conversationRef = useRef<HTMLElement>(null);
  const concernsRef = useRef<HTMLElement>(null);
  const decisionsRef = useRef<HTMLElement>(null);
  const valuesRef = useRef<HTMLElement>(null);
  const worksRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLElement>(null);
  const connectRef = useRef<HTMLElement>(null);
  const profile = artifact.profile;
  const period = range(artifact.meta.time_range?.from, artifact.meta.time_range?.to);
  // The map is a bounded visual summary rather than an unrestricted document flow.
  // Preserve the whole time span while fitting generated content into stable semantic slots.
  const visibleTrajectory = selectVisualSlots(profile.life_trajectory, 5);
  const visibleTraits = profile.conversation_style.traits.slice(0, 3);
  const visibleValues = profile.value_preferences.slice(0, 4);
  const mapSummary = profile.summary.one_sentence;
  const mapClaim = profile.summary.core_insights[0]?.claim || profile.summary.one_sentence;
  const evidenceById = useMemo(() => new Map(artifact.evidence_index.map((item) => [item.id, item])), [artifact.evidence_index]);
  const works = profile.representative_contents.filter((work) => `${work.title} ${work.why_representative}`.toLowerCase().includes(query.toLowerCase()));
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateScale = () => {
      const nextScale = window.innerWidth <= 1050 ? 1 : Math.min(1, stage.clientWidth / 1448);
      setCanvasScale((current) => Math.abs(current - nextScale) < .001 ? current : nextScale);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    window.addEventListener('resize', updateScale);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateScale); };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const intro = introRef.current;
    const center = centerRef.current;
    const conversation = conversationRef.current;
    const concerns = concernsRef.current;
    const decisions = decisionsRef.current;
    const values = valuesRef.current;
    const worksSection = worksRef.current;
    const featured = featuredRef.current;
    const connect = connectRef.current;
    if (!canvas || !intro || !center || !conversation || !concerns || !decisions || !values || !worksSection || !featured || !connect) return;

    const updateLayout = () => {
      if (window.innerWidth <= 1050) {
        setMapLayout(BASE_LAYOUT);
        return;
      }
      const canvasBox = canvas.getBoundingClientRect();
      const scale = canvasBox.width / canvas.clientWidth || 1;
      const visualHeight = (element: HTMLElement) => {
        const boxes = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))].map((node) => node.getBoundingClientRect());
        const top = element.getBoundingClientRect().top;
        return (Math.max(...boxes.map((box) => box.bottom)) - top) / scale;
      };
      const logicalBottom = (element: HTMLElement) => (element.getBoundingClientRect().top - canvasBox.top) / scale + visualHeight(element);
      const introBottom = logicalBottom(intro);
      const centerBottom = 220 + visualHeight(center);
      const conversationTop = Math.max(BASE_LAYOUT.conversationTop, Math.ceil(introBottom + 28));
      const decisionsTop = Math.max(BASE_LAYOUT.decisionsTop, Math.ceil(275 + visualHeight(concerns) + 30));
      const valuesTop = Math.max(BASE_LAYOUT.valuesTop, Math.ceil(decisionsTop + visualHeight(decisions) + 34));
      const worksTop = Math.max(BASE_LAYOUT.worksTop, Math.ceil(conversationTop + visualHeight(conversation) + 38), Math.ceil(centerBottom + 42));
      const bottomTop = Math.max(BASE_LAYOUT.bottomTop, Math.ceil(worksTop + visualHeight(worksSection) + 42), Math.ceil(valuesTop + visualHeight(values) + 42));
      const canvasHeight = Math.max(BASE_LAYOUT.canvasHeight, Math.ceil(bottomTop + Math.max(visualHeight(featured), visualHeight(connect)) + 22));
      const next = { conversationTop, decisionsTop, valuesTop, worksTop, bottomTop, canvasHeight };
      setMapLayout((current) => Object.keys(next).every((key) => Math.abs(current[key as keyof MapLayout] - next[key as keyof MapLayout]) < 1) ? current : next);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    [intro, center, conversation, concerns, decisions, values, worksSection, featured, connect].forEach((element) => observer.observe(element));
    window.addEventListener('resize', updateLayout);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateLayout); };
  }, [canvasScale, profile, query]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const center = centerRef.current;
    const timeline = timelineRef.current;
    const conversation = conversationRef.current;
    const concerns = concernsRef.current;
    const decisions = decisionsRef.current;
    const values = valuesRef.current;
    if (!canvas || !center || !timeline || !conversation || !concerns || !decisions || !values) return;

    const updatePaths = () => {
      if (window.innerWidth <= 1050) { setConnectorPaths([]); return; }
      const canvasBox = canvas.getBoundingClientRect();
      const logicalWidth = canvas.clientWidth;
      const logicalHeight = canvas.clientHeight;
      const portraitBox = center.querySelector<HTMLElement>('.reference-portrait')?.getBoundingClientRect() || center.getBoundingClientRect();
      const toCanvas = (rect: DOMRect, x: number, y: number) => pointInCanvas(rect, canvasBox, logicalWidth, logicalHeight, x, y);
      const badgePoint = (section: HTMLElement) => {
        const badge = section.querySelector<HTMLElement>('.reference-dimension-title > b');
        return toCanvas((badge || section).getBoundingClientRect(), .5, .5);
      };
      const timelineEnd = badgePoint(timeline);
      const conversationEnd = badgePoint(conversation);
      const concernsEnd = badgePoint(concerns);
      const decisionsEnd = badgePoint(decisions);
      const valuesEnd = badgePoint(values);
      const evidenceWeight = (counts: number[]) => Math.min(.62, .28 + counts.reduce((total, count) => total + count, 0) / 70);
      const timelineStart = toCanvas(portraitBox, .30, .04);
      const conversationStart = toCanvas(portraitBox, .03, .54);
      const concernsStart = toCanvas(portraitBox, .97, .28);
      const decisionsStart = toCanvas(portraitBox, .97, .70);
      const valuesStart = toCanvas(portraitBox, .91, .82);
      const timelineNodes = Array.from(timeline.querySelectorAll<HTMLElement>('.reference-timeline-item i')).map((node) => toCanvas(node.getBoundingClientRect(), .5, .5));
      setConnectorPaths([
        { id: 'trajectory', kind: 'branch', start: timelineStart, end: timelineEnd, d: cubic(timelineStart, { x: timelineStart.x - 82, y: timelineStart.y - 118 }, { x: timelineEnd.x - 88, y: timelineEnd.y + 24 }, timelineEnd), opacity: evidenceWeight(profile.life_trajectory.map((item) => item.evidence_ids?.length || 0)) },
        { id: 'conversation', kind: 'branch', start: conversationStart, end: conversationEnd, d: cubic(conversationStart, { x: conversationStart.x - 155, y: conversationStart.y - 92 }, { x: conversationEnd.x + 120, y: conversationEnd.y - 82 }, conversationEnd), opacity: evidenceWeight(profile.conversation_style.traits.map((item) => item.evidence_ids?.length || 0)) },
        { id: 'concerns', kind: 'branch', start: concernsStart, end: concernsEnd, d: cubic(concernsStart, { x: concernsStart.x + 82, y: concernsStart.y - 58 }, { x: concernsEnd.x - 62, y: concernsEnd.y + 20 }, concernsEnd), opacity: evidenceWeight(profile.long_term_concerns.map((item) => item.evidence_ids?.length || 0)) },
        { id: 'decisions', kind: 'branch', start: decisionsStart, end: decisionsEnd, d: cubic(decisionsStart, { x: decisionsStart.x + 105, y: decisionsStart.y + 36 }, { x: decisionsEnd.x - 64, y: decisionsEnd.y - 18 }, decisionsEnd), opacity: evidenceWeight(profile.decision_patterns.map((item) => item.evidence_ids?.length || 0)) },
        { id: 'values', kind: 'branch', start: valuesStart, end: valuesEnd, d: cubic(valuesStart, { x: valuesStart.x + 82, y: valuesStart.y + 34 }, { x: valuesEnd.x - 50, y: valuesEnd.y - 58 }, valuesEnd), opacity: evidenceWeight(profile.value_preferences.map((item) => item.evidence_ids?.length || 0)) },
        ...(timelineNodes.length ? [{ id: 'timeline-lead', kind: 'timeline' as const, start: timelineEnd, end: timelineNodes[0], d: cubic(timelineEnd, { x: timelineEnd.x - 18, y: timelineEnd.y + 48 }, { x: timelineNodes[0].x - 65, y: timelineNodes[0].y - 8 }, timelineNodes[0]), opacity: .84 }] : []),
        ...(timelineNodes.length > 1 ? [{ id: 'timeline-journey', kind: 'timeline' as const, start: timelineNodes[0], end: timelineNodes[timelineNodes.length - 1], d: windingPath(timelineNodes), opacity: .84 }] : []),
      ]);
    };
    updatePaths();
    const observer = new ResizeObserver(updatePaths);
    [canvas, center, timeline, conversation, concerns, decisions, values].forEach((element) => observer.observe(element));
    window.addEventListener('resize', updatePaths);
    return () => { observer.disconnect(); window.removeEventListener('resize', updatePaths); };
  }, [canvasScale, mapLayout, profile]);

  return (
    <main className="reference-profile-page" id="overview">
      <ProfileHeader query={query} onQueryChange={setQuery} />

      <div ref={stageRef} className="reference-map-stage" style={{
        '--reference-scale': canvasScale,
        '--reference-height': `${mapLayout.canvasHeight}px`,
        '--conversation-top': `${mapLayout.conversationTop}px`,
        '--decisions-top': `${mapLayout.decisionsTop}px`,
        '--values-top': `${mapLayout.valuesTop}px`,
        '--works-top': `${mapLayout.worksTop}px`,
        '--bottom-top': `${mapLayout.bottomTop}px`,
      } as React.CSSProperties}>
      <section ref={canvasRef} className="reference-canvas" aria-label="人物理解地图">
        <svg className="reference-connector-graph" aria-hidden="true" viewBox={`0 0 1448 ${mapLayout.canvasHeight}`} preserveAspectRatio="none">
          {connectorPaths.map((path) => <g key={path.id} className={`reference-connector-${path.kind}`} style={{ opacity: path.opacity }}><path d={path.d} />{path.kind === 'branch' && <><circle cx={path.start.x} cy={path.start.y} r="3.4" /><circle cx={path.end.x} cy={path.end.y} r="4.2" /></>}</g>)}
        </svg>
        <section ref={introRef} className="reference-intro">
          <h1>一个人</h1>
          <p>由公开内容与长期表达生成的人物理解</p>
          <div><span><StackIcon size={16} /> 信息来源&nbsp; {artifact.meta.content_count}</span><span><ClockIcon size={16} /> 覆盖时间&nbsp; {period}</span></div>
          <EvidenceButton title="核心人物理解" description={profile.summary.core_insights[0]?.explanation || profile.summary.one_sentence} evidenceIds={profile.summary.core_insights[0]?.evidence_ids} onOpen={setSelection} className="reference-quote">
            <QuotesIcon size={21} weight="fill" /><p>{mapSummary}</p><small>查看依据</small>
          </EvidenceButton>
        </section>

        <section ref={timelineRef} id="trajectory" className="reference-timeline">
          <DimensionTitle no="1" title="走过什么" note="人生轨迹" />
          <div className="reference-timeline-rail">
            {visibleTrajectory.map((item, index) => (
              <EvidenceButton key={item.period} title={item.period} description={`${item.event} ${item.change}`} evidenceIds={item.evidence_ids} onOpen={setSelection} className={`reference-timeline-item item-${index}`}>
                <i className={index === visibleTrajectory.length - 1 ? 'is-current' : ''} />
                <b>{item.period}</b><span>{short(item.event, 28)}</span>
              </EvidenceButton>
            ))}
          </div>
        </section>

        <section ref={centerRef} className="reference-center">
          <div className="reference-portrait"><Image src={avatarSrc || '/images/profile/ink-avatar-fallback-v1.png'} alt="人物头像" fill sizes="260px" priority /></div>
          <EvidenceButton title="一句话人物理解" description={profile.summary.one_sentence} evidenceIds={profile.summary.core_insights.flatMap((item) => item.evidence_ids || [])} onOpen={setSelection} className="reference-center-caption">
            <strong>{mapClaim}</strong><small>公开内容样本 · {period}</small>
          </EvidenceButton>
        </section>

        <section ref={conversationRef} className="reference-conversation">
          <EvidenceButton title="怎么与人交流" description={profile.conversation_style.traits[0]?.explanation || ''} evidenceIds={profile.conversation_style.traits[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="5" title="怎么与人交流" note="对话风格" /></EvidenceButton>
          <div className="reference-trait-list">{visibleTraits.map((item, index) => <EvidenceButton key={item.trait} title={`交流线索 ${index + 1}`} description={item.explanation} evidenceIds={item.evidence_ids} onOpen={setSelection}><ChatCircleDotsIcon size={15} /><span>{short(item.trait, 17)}</span><CaretRightIcon size={13} /></EvidenceButton>)}</div>
          <div className="reference-entry-card"><b>适合怎么聊</b>{profile.conversation_style.good_entry_points.slice(0, 2).map((entry) => <p key={entry}>· {short(entry, 29)}</p>)}</div>
        </section>

        <section ref={concernsRef} className="reference-concerns">
          <EvidenceButton title="在追求什么" description={profile.long_term_concerns[0]?.explanation || ''} evidenceIds={profile.long_term_concerns[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="2" title="在追求什么" note="长期关切与驱动力" /></EvidenceButton>
          <div className="reference-driver-core">{profile.drivers.slice(0, 2).map((driver) => <EvidenceButton key={driver.driver} title="驱动力" description={driver.explanation} evidenceIds={driver.evidence_ids} onOpen={setSelection}>{short(driver.driver, 10)}</EvidenceButton>)}</div>
          <div className="reference-concern-tags">{profile.long_term_concerns.slice(0, 3).map((concern) => <EvidenceButton key={concern.question} title="长期关切" description={concern.explanation} evidenceIds={concern.evidence_ids} onOpen={setSelection}>{short(concern.question, 13)}</EvidenceButton>)}</div>
        </section>

        <section ref={decisionsRef} className="reference-decisions">
          <EvidenceButton title="通常怎么做" description={profile.decision_patterns[0]?.description || ''} evidenceIds={profile.decision_patterns[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="3" title="通常怎么做" note="决策模式" /></EvidenceButton>
          <div className="reference-decision-flow">{profile.decision_patterns.slice(0, 3).map((item, index) => <EvidenceButton key={item.name} title={item.name} description={item.description} evidenceIds={item.evidence_ids} onOpen={setSelection}><span>{index === 0 ? <EyeIcon size={19} /> : index === 1 ? <ScalesIcon size={19} /> : <FlagIcon size={19} />}</span><b>{short(item.name, 12)}</b><small>{short(item.process[0] || item.description, 13)}</small></EvidenceButton>)}</div>
        </section>

        <section ref={valuesRef} className="reference-values">
          <EvidenceButton title="重视什么" description={profile.value_preferences[0]?.explanation || ''} evidenceIds={profile.value_preferences[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="4" title="重视什么" note="价值偏好" /></EvidenceButton>
          <div>{visibleValues.map((value) => <EvidenceButton key={value.left} title="价值取向" description={value.explanation} evidenceIds={value.evidence_ids} onOpen={setSelection}><span>{short(value.left, 10)}</span><i><b /></i><span>{short(value.right, 10)}</span></EvidenceButton>)}</div>
        </section>

        <section ref={worksRef} id="works" className="reference-works">
          <div className="reference-section-cap"><DimensionTitle no="6" title="代表内容" note="代表内容精选" /><span>依据 {profile.representative_contents.length}</span></div>
          <div className="reference-work-row">{works.slice(0, 4).map((work) => <EvidenceButton key={work.content_id} title={work.title} description={work.why_representative} evidenceIds={[work.content_id]} onOpen={setSelection}><small>{work.content_type} · {work.date}</small><b>{work.title === '(无标题)' ? '一则代表回答' : short(work.title, 18)}</b><p>{short(evidenceById.get(work.content_id)?.excerpt || work.why_representative, 54)}</p><span>查看依据 <ArrowSquareOutIcon size={12} /></span></EvidenceButton>)}</div>
        </section>

        <section ref={featuredRef} className="reference-featured">
          <b>代表内容精选</b><small>来自公开内容的精选片段</small>
          <div>{works.slice(0, 4).map((work) => <EvidenceButton key={work.content_id} title={work.title} description={work.why_representative} evidenceIds={[work.content_id]} onOpen={setSelection}><small>{work.content_type} · {work.date}</small><strong>{work.title === '(无标题)' ? '一则代表回答' : short(work.title, 20)}</strong><p>{short(work.why_representative, 55)}</p></EvidenceButton>)}</div>
        </section>

        <section ref={connectRef} id="connect" className="reference-connect">
          <b>适合如何认识 TA</b>{profile.conversation_style.good_entry_points.map((entry, index) => <EvidenceButton key={entry} title="认识建议" description={entry} evidenceIds={profile.conversation_style.traits[index]?.evidence_ids} onOpen={setSelection}><span>0{index + 1}</span>{short(entry, 32)}</EvidenceButton>)}
        </section>
      </section>
      </div>

      {selection && <aside className="reference-evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><div onClick={() => setSelection(null)} /><section><button type="button" onClick={() => setSelection(null)} aria-label="关闭依据面板"><XIcon size={20} /></button><p>可追溯依据</p><h2 id="evidence-title">{selection.title}</h2><article>{selection.description}</article><div>{selection.evidenceIds.length ? selection.evidenceIds.map((id) => {
        const item = evidenceById.get(id); if (!item) return null;
        return <section key={id}><small>{item.type} · {item.date}</small><b>{item.title || '一则公开内容'}</b><p>{item.excerpt || '该内容被用于支持此处判断。'}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">打开原始内容 <ArrowSquareOutIcon size={14} /></a>}</section>;
      }) : <p>这项判断暂未附带可展示的内容编号。</p>}</div></section></aside>}
    </main>
  );
}
