import { AXIS_LABELS, CORE_QUESTIONS, topAxes, type Axis } from '../axes';
import { getContents, getUserVectors } from '../db';
import { getUser } from '../db/users';

// ============ 离线理解管线：Content Profile（非人格测试） ============
// 只总结“写过什么、经常讨论什么、明确表达过什么”，区分 explicit / inferred。

export interface Facet { icon: string; title: string; text: string; tags: string[]; evidence: string[] }
export interface Understanding {
  topics: string[];
  coreQuestion: string;
  facets: Facet[];
  progress: number;
  note: string;
}

export async function buildUnderstanding(userId: string): Promise<Understanding> {
  const [user, vectors, contents] = await Promise.all([getUser(userId), getUserVectors(userId), getContents(userId)]);
  const top = topAxes(vectors.long_term, 5);
  const topics = top.map((t) => AXIS_LABELS[t.axis]);

  const valueTop = topAxes(vectors.value, 1)[0];
  const coreQuestion = (valueTop && CORE_QUESTIONS[valueTop.axis]) || CORE_QUESTIONS.meaning || '什么才值得长期投入？';

  const anchors = contents.filter((c) => c.is_anchor);
  const ev = (axis: Axis) => {
    const i = (Object.keys(AXIS_LABELS) as Axis[]).indexOf(axis);
    const c = [...contents].sort((a, b) => (b.vec[i] || 0) - (a.vec[i] || 0))[0];
    return c ? [c.title] : [];
  };

  const interestTop = top.filter((t) => !['meaning', 'career', 'longterm'].includes(t.axis)).slice(0, 3);
  const styleTags: string[] = [];
  const wi = vectors.long_term[7]; // writing
  const pi = vectors.long_term[5]; // psycho
  if (wi >= 0.5) styleTags.push('真诚细腻');
  if (pi >= 0.5) styleTags.push('逻辑清晰');
  if (wi < 0.5 && pi < 0.5) styleTags.push('直接朴素');
  styleTags.push('善用故事和例子');

  const facets: Facet[] = [
    {
      icon: '💡', title: '思想观念',
      text: `你长期在思考「${coreQuestion}」，并习惯把具体经历上升为可复用的判断。`,
      tags: top.slice(0, 2).map((t) => AXIS_LABELS[t.axis]),
      evidence: ev(valueTop?.axis || 'meaning'),
    },
    {
      icon: '⭐', title: '兴趣偏好',
      text: interestTop.length
        ? `你经常讨论${interestTop.map((t) => AXIS_LABELS[t.axis]).join('、')}，喜欢深度分析与讨论。`
        : '你的兴趣分布比较均衡。',
      tags: interestTop.map((t) => AXIS_LABELS[t.axis]),
      evidence: ev(interestTop[0]?.axis || 'tech'),
    },
    {
      icon: '🖋', title: '表达风格',
      text: '你的表达细腻真诚、逻辑清晰，擅长用故事和例子传递观点。',
      tags: styleTags.slice(0, 2),
      evidence: anchors[0] ? [anchors[0].title] : [],
    },
    {
      icon: '❤️', title: '价值取向',
      text: '你重视真诚、成长与创造，愿意尝试与探索更好的可能性。',
      tags: topAxes(vectors.value, 3).map((t) => AXIS_LABELS[t.axis]),
      evidence: ev(topAxes(vectors.value, 1)[0]?.axis || 'longterm'),
    },
  ];

  return {
    topics,
    coreQuestion,
    facets,
    progress: Math.min(96, 60 + contents.length * 3),
    note: '所有分析仅你可见，不会用于推荐或对外展示',
  };
}
