'use client';

import Image from 'next/image';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Nav from '@/components/Nav';
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  FlagIcon,
  LightbulbIcon,
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
  canvasHeight: number;
};

const BASE_LAYOUT: MapLayout = {
  conversationTop: 350,
  decisionsTop: 468,
  valuesTop: 618,
  worksTop: 602,
  canvasHeight: 835,
};

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

function timelinePath(points: Point[]) {
  if (points.length < 2) return '';
  return points.slice(0, -1).reduce((path, point, index) => {
    const next = points[index + 1];
    // Each segment stays inside the rectangle formed by its two nodes. Unlike a
    // Catmull-Rom spline this cannot overshoot downward into the timeline copy.
    const middleX = point.x + (next.x - point.x) / 2;
    return `${path} C ${middleX.toFixed(1)} ${point.y.toFixed(1)}, ${middleX.toFixed(1)} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
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

export default function ProfileExperience({ artifact, avatarSrc }: { artifact: Artifact; avatarSrc?: string | null }) {
  const [selection, setSelection] = useState<EvidenceSelection>(null);
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([]);
  const [canvasScale, setCanvasScale] = useState(1);
  // 首帧防跳：useLayoutEffect 里才能算出真实缩放比，在那之前若按 scale=1 画出来，
  // 宽屏用户会看到内容先"撑满"再"缩回去"的一次抽动。用一个标记把首帧藏掉，
  // 等缩放落定再淡入 —— 用户看到的是"渐显"，而不是"先错后对"。
  const [scaleReady, setScaleReady] = useState(false);
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
  const works = profile.representative_contents;
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateScale = () => {
      const nextScale = window.innerWidth <= 1050 ? 1 : Math.min(1, stage.clientWidth / 1448);
      setCanvasScale((current) => Math.abs(current - nextScale) < .001 ? current : nextScale);
      setScaleReady(true);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    window.addEventListener('resize', updateScale);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateScale); };
  }, []);

  /*
   * 藤蔓生长时序（全进页编排，无需滚动触发）：
   *   intro 0ms → 头像 180ms（扎根）→ 五条分支线 420ms 起每条 110ms 阶梯生长
   *   → 各区块在对应线"长到"时浮现（线起点 + 约 0.55×生长时长）
   *   → 时间轴长线 + 底部区块收尾。全程约 1.6s。
   * 注意：本数组顺序 = 渲染顺序，render 里按 index 计算 delay。
   */
  const VINE_LINE_START = 420;
  const VINE_LINE_STEP = 110;

  /*
   * 为每条连接线写入真实长度：
   *   --dash-len  → mo-draw 描边生长动画精确从"整条隐藏"长到"整条显示"
   *   --flow-dash / --flow-cycle / --flow-dur → 流光按线长定制（一段光从头跑到尾）
   */
  useEffect(() => {
    if (!scaleReady) return;
    const svg = canvasRef.current?.querySelector('svg.reference-connector-graph');
    if (!svg) return;
    svg.querySelectorAll<SVGPathElement>('path.mo-draw').forEach((p) => {
      try {
        const len = p.getTotalLength();
        p.style.setProperty('--dash-len', String(Math.ceil(len)));
      } catch { /* jsdom 等无 getTotalLength 环境下跳过 */ }
    });
    svg.querySelectorAll<SVGPathElement>('path.mo-flow').forEach((p) => {
      try {
        const len = p.getTotalLength();
        p.style.setProperty('--flow-dash', String(Math.ceil(len * 0.14)));
        p.style.setProperty('--flow-cycle', String(Math.ceil(len * 1.14)));
        p.style.setProperty('--flow-dur', `${(2.2 + len / 420).toFixed(2)}s`);
      } catch { /* 同上 */ }
    });
  }, [scaleReady, connectorPaths]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const intro = introRef.current;
    const center = centerRef.current;
    const conversation = conversationRef.current;
    const concerns = concernsRef.current;
    const decisions = decisionsRef.current;
    const values = valuesRef.current;
    const worksSection = worksRef.current;
    if (!canvas || !intro || !center || !conversation || !concerns || !decisions || !values || !worksSection) return;

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
      // 区块间距增量整体放大（28/30/34/38/42 → 46/48/54/58/62），让整张地图更舒展；
      // BASE_LAYOUT 仅作下限保护，实际位置由内容高度动态推算。
      const conversationTop = Math.max(BASE_LAYOUT.conversationTop, Math.ceil(introBottom + 46));
      const decisionsTop = Math.max(BASE_LAYOUT.decisionsTop, Math.ceil(275 + visualHeight(concerns) + 48));
      const valuesTop = Math.max(BASE_LAYOUT.valuesTop, Math.ceil(decisionsTop + visualHeight(decisions) + 54));
      const worksTop = Math.max(BASE_LAYOUT.worksTop, Math.ceil(conversationTop + visualHeight(conversation) + 58), Math.ceil(centerBottom + 62));
      const canvasHeight = Math.max(BASE_LAYOUT.canvasHeight, Math.ceil(Math.max(worksTop + visualHeight(worksSection), valuesTop + visualHeight(values)) + 46));
      const next = { conversationTop, decisionsTop, valuesTop, worksTop, canvasHeight };
      setMapLayout((current) => Object.keys(next).every((key) => Math.abs(current[key as keyof MapLayout] - next[key as keyof MapLayout]) < 1) ? current : next);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    [intro, center, conversation, concerns, decisions, values, worksSection].forEach((element) => observer.observe(element));
    window.addEventListener('resize', updateLayout);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateLayout); };
  }, [canvasScale, profile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const center = centerRef.current;
    const timeline = timelineRef.current;
    const conversation = conversationRef.current;
    const concerns = concernsRef.current;
    const decisions = decisionsRef.current;
    const values = valuesRef.current;
    const works = worksRef.current;
    if (!canvas || !center || !timeline || !conversation || !concerns || !decisions || !values || !works) return;

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
      const timelineBadge = timeline.querySelector<HTMLElement>('.reference-dimension-title > b');
      const timelineEnd = toCanvas((timelineBadge || timeline).getBoundingClientRect(), .5, 1);
      const conversationEnd = badgePoint(conversation);
      const concernsEnd = badgePoint(concerns);
      const decisionsEnd = badgePoint(decisions);
      const valuesEnd = badgePoint(values);
      const worksEnd = badgePoint(works);
      const evidenceWeight = (counts: number[]) => Math.min(.62, .28 + counts.reduce((total, count) => total + count, 0) / 70);
      const timelineNodes = Array.from(timeline.querySelectorAll<HTMLElement>('.reference-timeline-item i')).map((node) => toCanvas(node.getBoundingClientRect(), .5, .5));

      /*
       * 布线拓扑：从中央头像放射状发出的 5 条"扇形"线。
       *
       * 为什么不用原来那种"每条线写死一组控制点偏移"的做法：
       *   节点位置随数据（多少条轨迹、多少个关切）变化，写死的偏移量没法适配，
       *   结果就是有的线拐弯穿过中央头像、有的和邻居相交。
       *
       * 这里的做法是让控制点按"出射方向 + 入射方向"自动算：
       *   - 每条线都从头像边缘朝目标方向发出（fan）
       *   - 中段走一条与目标连线垂直的外凸弧，保证彼此错开、不穿头像
       *   - 这样无论节点怎么变，5 条线都各走各的象限，天然不交错
       */
      const portraitCenter = toCanvas(portraitBox, .5, .5);
      const portraitRadius = portraitBox.width / 2 / canvasScale;
      const fan = (target: Point, lift: number) => {
        const dx = target.x - portraitCenter.x;
        const dy = target.y - portraitCenter.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len;
        const uy = dy / len;
        // 出射点：头像边缘
        const start = { x: portraitCenter.x + ux * portraitRadius, y: portraitCenter.y + uy * portraitRadius };
        // 控制点沿"出射方向"和"入射方向"各伸出一段，中间 lift 让弧线外凸错开
        const cA = { x: start.x + ux * len * 0.34 - uy * lift, y: start.y + uy * len * 0.34 + ux * lift };
        const cB = { x: target.x - ux * len * 0.3 - uy * lift, y: target.y - uy * len * 0.3 + ux * lift };
        return { start, d: cubic(start, cA, cB, target) };
      };

      const branches: Array<[Point, number]> = [
        [timelineEnd, -46],
        [conversationEnd, 38],
        [concernsEnd, -30],
        [decisionsEnd, 26],
        [valuesEnd, 40],
        [worksEnd, -76],
      ];
      const branchIds = ['trajectory', 'conversation', 'concerns', 'decisions', 'values', 'works'] as const;
      const branchEvidence = [
        profile.life_trajectory.map((item) => item.evidence_ids?.length || 0),
        profile.conversation_style.traits.map((item) => item.evidence_ids?.length || 0),
        profile.long_term_concerns.map((item) => item.evidence_ids?.length || 0),
        profile.decision_patterns.map((item) => item.evidence_ids?.length || 0),
        profile.value_preferences.map((item) => item.evidence_ids?.length || 0),
        profile.representative_contents.map(() => 1),
      ];

      setConnectorPaths([
        ...branches.map(([target, lift], i) => {
          const { start, d } = fan(target, lift);
          return { id: branchIds[i], kind: 'branch' as const, start, end: target, d, opacity: evidenceWeight(branchEvidence[i]) };
        }),
        /*
         * 时间轴长线：从标题徽标下沿直接串过每个亮点。
         * 每一段都用不越界的横向 S 曲线，既保留水墨藤蔓的起伏，也不会
         * 因样条过冲而回头或压到下方年份与说明文字。
         */
        ...(timelineNodes.length ? [{ id: 'timeline-journey', kind: 'timeline' as const, start: timelineEnd, end: timelineNodes[timelineNodes.length - 1], d: timelinePath([timelineEnd, ...timelineNodes]), opacity: .84 }] : []),
      ]);
    };
    updatePaths();
    const observer = new ResizeObserver(updatePaths);
    [canvas, center, timeline, conversation, concerns, decisions, values, works].forEach((element) => observer.observe(element));
    window.addEventListener('resize', updatePaths);
    return () => { observer.disconnect(); window.removeEventListener('resize', updatePaths); };
  }, [canvasScale, mapLayout, profile]);

  return (
    <main className="reference-profile-page" id="overview">
      <Nav tone="blue" tagline="在真实的生活里遇见有趣的灵魂" />

      <div
        ref={stageRef}
        className="reference-map-stage"
        style={{
          '--reference-scale': canvasScale,
          '--reference-height': `${mapLayout.canvasHeight}px`,
          '--conversation-top': `${mapLayout.conversationTop}px`,
          '--decisions-top': `${mapLayout.decisionsTop}px`,
          '--values-top': `${mapLayout.valuesTop}px`,
          '--works-top': `${mapLayout.worksTop}px`,
          // 缩放未落定前先不可见，避免"先撑满再缩回"的抽动被看见
          ...(scaleReady ? {} : { visibility: 'hidden' as const }),
        } as React.CSSProperties}>
      <section ref={canvasRef} className="reference-canvas" aria-label="人物理解地图">
        <svg className="reference-connector-graph" aria-hidden="true" viewBox={`0 0 1448 ${mapLayout.canvasHeight}`} preserveAspectRatio="none">
          {connectorPaths.map((path, index) => (
            <g key={path.id} className={`reference-connector-${path.kind}`} style={{ opacity: path.opacity }}>
              {/*
                藤蔓生长：底层描边从头像向外"抽条"（mo-draw），随后一段流光
                沿线循环（mo-flow）。分支按 index 排 110ms 阶梯，逐条蔓延。
              */}
              <path
                d={path.d}
                className="mo-draw"
                style={{ animationDelay: `${VINE_LINE_START + index * VINE_LINE_STEP}ms` }}
              />
              {path.kind === 'branch' && (
                <path
                  d={path.d}
                  className="mo-flow"
                  style={{ animationDelay: `${VINE_LINE_START + index * VINE_LINE_STEP + 600}ms` }}
                />
              )}
              {path.kind === 'branch' && <><circle cx={path.start.x} cy={path.start.y} r="3.4" /><circle cx={path.end.x} cy={path.end.y} r="4.2" /></>}
            </g>
          ))}
        </svg>
        <section ref={introRef} className="reference-intro mo-rise">
          <h1>一个人</h1>
          <p style={{ fontSize: '1.05rem', margin: '14px 0 12px' }}>由公开内容与长期表达生成的人物理解</p>
          <div style={{ fontSize: '.82rem', gap: '18px' }}><span><StackIcon size={16} /> 信息来源&nbsp; {artifact.meta.content_count}</span><span><ClockIcon size={16} /> 覆盖时间&nbsp; {period}</span></div>
          <EvidenceButton title="核心人物理解" description={profile.summary.core_insights[0]?.explanation || profile.summary.one_sentence} evidenceIds={profile.summary.core_insights[0]?.evidence_ids} onOpen={setSelection} className="reference-quote">
            <QuotesIcon size={21} weight="fill" /><p style={{ fontSize: '1.02rem', lineHeight: 1.7 }}>{mapSummary}</p><small style={{ fontSize: '.72rem' }}>查看依据</small>
          </EvidenceButton>
        </section>

        <section ref={timelineRef} id="trajectory" className="reference-timeline mo-rise" style={{ animationDelay: '850ms' }}>
          <DimensionTitle no="1" title="走过什么" note="人生轨迹" />
          <div className="reference-timeline-rail">
            {visibleTrajectory.map((item, index) => (
              <EvidenceButton key={item.period} title={item.period} description={`${item.event} ${item.change}`} evidenceIds={item.evidence_ids} onOpen={setSelection} className={`reference-timeline-item item-${index}`}>
                <i
                  aria-hidden="true"
                  className={`mo-node-pulse ${index === visibleTrajectory.length - 1 ? 'is-current' : ''}`}
                  style={{ '--timeline-index': index } as React.CSSProperties}
                />
                <b>{item.period}</b><span>{short(item.event, 28)}</span>
              </EvidenceButton>
            ))}
          </div>
        </section>

        <section ref={centerRef} className="reference-center mo-rise" style={{ animationDelay: '180ms' }}>
          <div className="reference-portrait mo-portrait"><Image src={avatarSrc || '/images/profile/ink-avatar-fallback-v1.png'} alt="人物头像" fill sizes="260px" priority /></div>
          <EvidenceButton title="一句话人物理解" description={profile.summary.one_sentence} evidenceIds={profile.summary.core_insights.flatMap((item) => item.evidence_ids || [])} onOpen={setSelection} className="reference-center-caption">
            <strong style={{ fontSize: '1.02rem', lineHeight: 1.6 }}>{mapClaim}</strong><small style={{ fontSize: '.72rem' }}>公开内容样本 · {period}</small>
          </EvidenceButton>
        </section>

        <section ref={conversationRef} className="reference-conversation mo-rise" style={{ animationDelay: '950ms' }}>
          <EvidenceButton title="怎么与人交流" description={profile.conversation_style.traits[0]?.explanation || ''} evidenceIds={profile.conversation_style.traits[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="5" title="怎么与人交流" note="对话风格" /></EvidenceButton>
          <div className="reference-trait-list">{visibleTraits.map((item, index) => <EvidenceButton key={item.trait} title={`交流线索 ${index + 1}`} description={item.explanation} evidenceIds={item.evidence_ids} onOpen={setSelection}><ChatCircleDotsIcon size={15} /><span>{short(item.trait, 17)}</span><CaretRightIcon size={13} /></EvidenceButton>)}</div>
          <div className="reference-entry-card"><b>适合怎么聊</b>{profile.conversation_style.good_entry_points.slice(0, 2).map((entry) => <p key={entry}>· {short(entry, 29)}</p>)}</div>
        </section>

        <section ref={concernsRef} className="reference-concerns mo-rise" style={{ animationDelay: '1050ms' }}>
          <EvidenceButton title="在追求什么" description={profile.long_term_concerns[0]?.explanation || ''} evidenceIds={profile.long_term_concerns[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="2" title="在追求什么" note="长期关切与驱动力" /></EvidenceButton>
          <div className="reference-driver-core">{profile.drivers.slice(0, 2).map((driver) => <EvidenceButton key={driver.driver} title="驱动力" description={driver.explanation} evidenceIds={driver.evidence_ids} onOpen={setSelection}>{short(driver.driver, 10)}</EvidenceButton>)}</div>
          <div className="reference-concern-tags">{profile.long_term_concerns.slice(0, 3).map((concern) => <EvidenceButton key={concern.question} title="长期关切" description={concern.explanation} evidenceIds={concern.evidence_ids} onOpen={setSelection}>{short(concern.question, 13)}</EvidenceButton>)}</div>
        </section>

        <section ref={decisionsRef} className="reference-decisions mo-rise" style={{ animationDelay: '1150ms' }}>
          <EvidenceButton title="通常怎么做" description={profile.decision_patterns[0]?.description || ''} evidenceIds={profile.decision_patterns[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="3" title="通常怎么做" note="决策模式" /></EvidenceButton>
          <div className="reference-decision-flow">{profile.decision_patterns.slice(0, 3).map((item, index) => <EvidenceButton key={item.name} title={item.name} description={item.description} evidenceIds={item.evidence_ids} onOpen={setSelection}><span>{index === 0 ? <EyeIcon size={19} /> : index === 1 ? <ScalesIcon size={19} /> : <FlagIcon size={19} />}</span><b>{short(item.name, 12)}</b><small>{short(item.process[0] || item.description, 13)}</small></EvidenceButton>)}</div>
        </section>

        <section ref={valuesRef} className="reference-values mo-rise" style={{ animationDelay: '1250ms' }}>
          <EvidenceButton title="重视什么" description={profile.value_preferences[0]?.explanation || ''} evidenceIds={profile.value_preferences[0]?.evidence_ids} onOpen={setSelection}><DimensionTitle no="4" title="重视什么" note="价值偏好" /></EvidenceButton>
          <div>{visibleValues.map((value) => <EvidenceButton key={value.left} title="价值取向" description={value.explanation} evidenceIds={value.evidence_ids} onOpen={setSelection}><span>{short(value.left, 10)}</span><i><b /></i><span>{short(value.right, 10)}</span></EvidenceButton>)}</div>
        </section>

        <section ref={worksRef} id="works" className="reference-works mo-rise" style={{ animationDelay: '1350ms' }}>
          <div className="reference-section-cap"><DimensionTitle no="6" title="代表内容" note="代表内容精选" /><span>依据 {profile.representative_contents.length}</span></div>
          <div className="reference-work-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>{works.slice(0, 3).map((work) => <EvidenceButton key={work.content_id} title={work.title} description={work.why_representative} evidenceIds={[work.content_id]} onOpen={setSelection}><small>{work.content_type} · {work.date}</small><b>{work.title === '(无标题)' ? '一则代表回答' : short(work.title, 22)}</b><p>{short(evidenceById.get(work.content_id)?.excerpt || work.why_representative, 66)}</p><span>查看依据 <ArrowSquareOutIcon size={12} /></span></EvidenceButton>)}</div>
        </section>
      </section>
      </div>

      {selection && <aside className="reference-evidence-drawer mo-slide-in" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><div onClick={() => setSelection(null)} /><section><button type="button" onClick={() => setSelection(null)} aria-label="关闭依据面板"><XIcon size={20} /></button><p>可追溯依据</p><h2 id="evidence-title">{selection.title}</h2><article>{selection.description}</article><div>{selection.evidenceIds.length ? selection.evidenceIds.map((id) => {
        const item = evidenceById.get(id); if (!item) return null;
        return <section key={id}><small>{item.type} · {item.date}</small><b>{item.title || '一则公开内容'}</b><p>{item.excerpt || '该内容被用于支持此处判断。'}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">打开原始内容 <ArrowSquareOutIcon size={14} /></a>}</section>;
      }) : <p>这项判断暂未附带可展示的内容编号。</p>}</div></section></aside>}
    </main>
  );
}
