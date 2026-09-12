// 遇见 · 概念轴向系统
// 用户与内容都用一组“概念轴”上的强度来描述。
// Mock 阶段轴向向量由种子数据手工标注；接入真实 Embedding 后由向量模型替换，管线不变。

export const AXES = [
  'tech', 'product', 'invest', 'career', 'longterm', 'psycho', 'society', 'writing',
  'photo', 'travel', 'outdoor', 'edu', 'medic', 'anxiety', 'meaning', 'life',
] as const;

export type Axis = (typeof AXES)[number];
export type Vec = number[];

export const AXIS_LABELS: Record<Axis, string> = {
  tech: '技术 / AI',
  product: '产品与设计',
  invest: '价值投资',
  career: '自由与稳定',
  longterm: '长期主义',
  psycho: '心理学与心智模型',
  society: '社会观察',
  writing: '阅读与写作',
  photo: '摄影与美学',
  travel: '旅行与行走',
  outdoor: '户外与身体',
  edu: '教育与公平',
  medic: '医学与生死',
  anxiety: '焦虑与心理健康',
  meaning: '意义与价值',
  life: '人生阶段与关系',
};

/** 从部分标注构建完整向量（未标注轴为 0） */
export function vec(p: Partial<Record<Axis, number>>): Vec {
  return AXES.map((a) => p[a] ?? 0);
}

export function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 价值/长期问题层：匹配“反复思考的问题”是否类似 */
export const VALUE_AXES: Axis[] = ['career', 'longterm', 'meaning', 'psycho', 'society', 'invest', 'edu'];
/** 对话风格层：是否聊得下去 */
export const CONVERSATION_AXES: Axis[] = ['writing', 'psycho', 'meaning', 'society', 'anxiety', 'life'];

export function mask(v: Vec, axes: Axis[]): Vec {
  return AXES.map((a, i) => (axes.includes(a) ? v[i] : 0));
}

export function topAxes(v: Vec, n = 4): { axis: Axis; score: number }[] {
  return AXES.map((axis, i) => ({ axis, score: v[i] }))
    .filter((x) => x.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/** 每个轴对应的“值得开始的问题”库（Conversation Bridge 的 Mock 来源） */
export const QUESTION_BANK: Record<Axis, string[]> = {
  tech: ['你觉得 AI 会先改变你生活里最不起眼、但最重要的哪件事？'],
  product: ['你见过最“克制”的好设计是什么？它克制住了什么？'],
  invest: ['如果十年不能卖出，你现在还会买什么（不限于股票）？'],
  career: ['如果收入下降 30%，但每周多两天完全属于自己的时间，你会接受吗？'],
  longterm: ['有没有一件事，你明知短期没有回报，还是愿意持续投入？'],
  psycho: ['你第一次意识到“别人觉得正确”和“自己真正想要”不是一回事，是什么时候？'],
  society: ['最近有没有一个很小的社会细节，让你想了很久？'],
  writing: ['有没有一本书，在你做某个重要决定时，其实在背后起了作用？'],
  photo: ['你拍过最舍不得删的一张“废片”，拍的是什么？'],
  travel: ['有没有一个地方，你去过之后，对“生活在哪里”这件事改了主意？'],
  outdoor: ['身体最累的那次经历，为什么反而记得最清楚？'],
  edu: ['你身上有没有哪种能力，是学校完全没教、但后来发现最重要的？'],
  medic: ['近距离见过生死之后，你对“优先级”这三个字的理解变了吗？'],
  anxiety: ['你和自己的焦虑，现在是哪种关系？'],
  meaning: ['有没有一个时刻，你突然觉得自己正在做的事“值得”？'],
  life: ['最近一次改变你对某个人看法的瞬间，是因为什么？'],
};

/** 每个价值轴对应的“核心问题”（AI 理解页展示） */
export const CORE_QUESTIONS: Partial<Record<Axis, string>> = {
  career: '怎样做出真正属于自己的选择？',
  meaning: '什么才值得长期投入？',
  psycho: '如何诚实地理解自己？',
  longterm: '如何在短期噪音里坚持长期？',
  society: '个体如何与更大的世界相处？',
  invest: '如何与不确定性做朋友？',
  edu: '一个人的出身，在多大程度上定义了他？',
  medic: '有限的生命里，什么最重要？',
  anxiety: '如何与不完美的自己共处？',
  writing: '写作如何改变了一个人的思考？',
};

export const MOODS = ['平静', '期待', '开心', '疲惫', '迷茫'];
export const STATES = ['学习中', '工作中', '创作中', '休息中', '其他'];

/** Mock：把一句“此刻状态”映射到轴向向量（真实阶段由 Embedding 模型替换） */
export function stateVec(text: string): Vec {
  const v = vec({});
  const set = (axis: Axis, s: number) => {
    const i = AXES.indexOf(axis);
    v[i] = Math.max(v[i], s);
  };
  if (/走|散步|户外|爬山|逛/.test(text)) { set('outdoor', 0.9); set('travel', 0.7); }
  if (/累|疲惫|炸|烦|压力/.test(text)) set('anxiety', 0.8);
  if (/朋友|认识|聊/.test(text)) set('life', 0.7);
  if (/纠结|选择|毕业|城市|工作|离职/.test(text)) { set('career', 0.8); set('meaning', 0.6); }
  if (/安静|想想|思考|平静/.test(text)) set('psycho', 0.6);
  if (/写|读|书|学习|创作/.test(text)) set('writing', 0.6);
  if (/期待|开心|休息/.test(text)) set('life', 0.6);
  if (/疲惫|迷茫|工作/.test(text)) { set('anxiety', 0.5); set('career', 0.5); }
  if (v.every((x) => x === 0)) { set('life', 0.5); set('psycho', 0.4); }
  return v;
}
