import { z } from 'zod';
import { AXES, AXIS_LABELS, QUESTION_BANK, cosine, topAxes, type Axis, type Vec } from '../axes';
import { getContents, getUserVectors, type ContentRow, type UserVectors } from '../db';
import { getUser, type UserRow } from '../db/users';
import { chatJSON } from '../providers/llm';

export { pairScore } from '../retrieval/scoring';

// ============ Deep Match / Content Bridge / Conversation Bridge ============

export const DeepMatchSchema = z.object({
  why_for_viewer: z.string(),
  why_for_target: z.string(),
  shared_ground: z.array(z.object({ axis: z.string(), label: z.string() })),
  interesting_difference: z.object({ label: z.string(), note: z.string() }).nullable(),
  conversation_question: z.string(),
});
export type DeepMatch = z.infer<typeof DeepMatchSchema>;

export function sharedAxes(a: Vec, b: Vec, n = 3): { axis: Axis; label: string; score: number }[] {
  return AXES.map((axis, i) => ({ axis, score: Math.min(a[i] || 0, b[i] || 0) }))
    .filter((x) => x.score >= 0.4)
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((x) => ({ ...x, label: AXIS_LABELS[x.axis] }));
}

export function interestingDifference(a: Vec, b: Vec): { axis: Axis; label: string; note: string } | null {
  const cand = AXES.map((axis, i) => ({ axis, a: a[i] || 0, b: b[i] || 0 }))
    .filter((x) => Math.abs(x.a - x.b) >= 0.25 && Math.min(x.a, x.b) >= 0.25)
    .sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))[0];
  if (!cand) return null;
  const hi = cand.a > cand.b ? '你' : 'TA';
  const lo = cand.a > cand.b ? 'TA' : '你';
  return {
    axis: cand.axis,
    label: AXIS_LABELS[cand.axis],
    note: `在「${AXIS_LABELS[cand.axis]}」上，${hi}投入了更多思考，而${lo}提供了另一种视角——这个差异可能正是值得聊一句的地方。`,
  };
}

function mockDeepMatch(viewer: UserRow, target: UserRow, av: UserVectors, bv: UserVectors, anchorVec?: Vec): DeepMatch {
  const shared = sharedAxes(av.value, bv.value, 3);
  const sharedAny = shared.length ? shared : sharedAxes(av.long_term, bv.long_term, 3);
  const diff = interestingDifference(av.long_term, bv.long_term);
  // 开场问题由“桥接内容”驱动：在交集中选与锚定内容最贴近的轴，让问题落在双方真正的入口上
  let qAxis = (sharedAny[0]?.axis || 'meaning') as Axis;
  if (anchorVec && sharedAny.length > 0) {
    qAxis = [...sharedAny].sort((x, y) => (anchorVec[AXES.indexOf(y.axis)] || 0) - (anchorVec[AXES.indexOf(x.axis)] || 0))[0].axis;
  }
  const bank = QUESTION_BANK[qAxis] || QUESTION_BANK.meaning;
  const question = bank[0];
  return {
    why_for_viewer: `你们写的是完全不同的事情，但都反复思考过：${sharedAny.map((s) => s.label).join('、')}。${target.name} 在「${topAxes(bv.long_term, 1)[0] ? AXIS_LABELS[topAxes(bv.long_term, 1)[0].axis] : '自己的领域'}」里的真实经历，可能正是你想听到的另一种答案。`,
    why_for_target: `${viewer.name} 长期关注${topAxes(av.long_term, 2).map((t) => AXIS_LABELS[t.axis]).join('与')}，而${target.name} 的内容里恰好有这些问题留下的痕迹。`,
    shared_ground: sharedAny.map((s) => ({ axis: s.axis, label: s.label })),
    interesting_difference: diff ? { label: diff.label, note: diff.note } : null,
    conversation_question: question,
  };
}

/** Deep Match：优先真实 LLM（仅 Top 候选才调用），失败回退 Mock */
export async function deepMatch(viewer: UserRow, target: UserRow, anchorVec?: Vec): Promise<DeepMatch> {
  const [av, bv] = await Promise.all([getUserVectors(viewer.id), getUserVectors(target.id)]);
  const mock = mockDeepMatch(viewer, target, av, bv, anchorVec);
  if (!process.env.LLM_API_KEY) return mock;

  const fmt = (u: UserRow, v: UserVectors) => ({
    name: u.name, role: u.role, quote: u.quote,
    long_term_topics: topAxes(v.long_term, 5).map((t) => AXIS_LABELS[t.axis]),
    value_questions: topAxes(v.value, 3).map((t) => AXIS_LABELS[t.axis]),
    anchors: [] as string[],
  });
  const [viewerContents, targetContents] = await Promise.all([getContents(viewer.id), getContents(target.id)]);
  const payload = (u: UserRow, v: UserVectors, items: ContentRow[]) => ({
    ...fmt(u, v),
    anchors: items.filter((c) => c.is_anchor).map((c) => `${c.title}：${c.summary}`),
  });
  const real = await chatJSON(
    DeepMatchSchema,
    '你是「遇见」的匹配引擎。只根据提供的真实内容做判断，不得编造观点；不要输出 MBTI/灵魂伴侣等伪心理学；只输出 JSON。',
    `用户A：${JSON.stringify(payload(viewer, av, viewerContents))}\n用户B：${JSON.stringify(payload(target, bv, targetContents))}\n请判断：A 为什么可能想认识 B？B 为什么可能想认识 A？最重要的共同点（shared_ground，用轴向标签）；一个值得讨论的差异（interesting_difference）；一个两人真的聊得下去的开场问题（conversation_question，必须同时结合两人的真实内容）。`,
  );
  return real ?? mock;
}

/** Content Bridge：从 target 的 Content Anchors 中选最适合 viewer 的一篇 */
export async function contentBridge(viewerId: string, targetId: string): Promise<{ anchor: ContentRow; reason: string } | null> {
  const [vv, contents] = await Promise.all([getUserVectors(viewerId), getContents(targetId)]);
  const scored = contents
    .map((c) => ({
      c,
      s: 0.7 * cosine(c.vec, vv.long_term) + 0.3 * cosine(c.vec, vv.value) + (c.is_anchor ? 0.08 : 0),
    }))
    .sort((a, b) => b.s - a.s);
  const best = scored[0];
  const anchor = best?.c || contents[0];
  if (!anchor) return null;
  const shared = sharedAxes(anchor.vec, vv.value, 2);
  const reason = shared.length
    ? `你们写的是完全不同的事情，但过去都反复思考过：${shared.map((s) => s.label).join('、')}。`
    : '这篇文章背后反复出现的问题，也许和你此刻关心的问题有关。';
  return { anchor, reason };
}
