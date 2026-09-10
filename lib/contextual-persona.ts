export interface ContextualPersonaInput {
  currentState?: {
    text?: string | null;
    mood?: string | null;
  } | null;
  understanding?: {
    topics?: string[] | null;
    coreQuestion?: string | null;
  } | null;
}

export type ContextualPersonaSource =
  | 'long-term-and-current'
  | 'current-only'
  | 'long-term-only'
  | 'unavailable';

export interface ContextualPersona {
  source: ContextualPersonaSource;
  title: string;
  summary: string;
  currentLabel: string;
  longTermLabel: string;
  conversationSuggestion: string;
  tags: string[];
  note: string;
}

type Moment = {
  label: string;
  title: string;
  suggestion: string;
  summary: string;
};

const MAX_STATE_PREVIEW = 76;

function compact(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function preview(value: string) {
  return value.length > MAX_STATE_PREVIEW ? `${value.slice(0, MAX_STATE_PREVIEW)}…` : value;
}

function resolveMoment(text: string, mood: string): Moment {
  const source = `${mood} ${text}`;
  const wantsOutside = /出去|走走|散步|户外|旅行|换个环境/.test(source);
  const lowEnergy = /疲惫|很累|脑子.*炸|压力|烦|倦/.test(source);

  if (wantsOutside && lowEnergy) {
    return {
      label: '需要换个环境',
      title: '此刻更像是在给自己留一段透气的空间',
      suggestion: '从轻松、具体的生活经验聊起，不必急着给结论。',
      summary: '记录里同时出现了压力和“走出去”的愿望；这只描述当下，不代表长期状态。',
    };
  }
  if (wantsOutside) {
    return {
      label: '向外探索',
      title: '此刻有一点想把注意力放到更开阔的地方',
      suggestion: '可以从最近想去的地方、一次散步或一个新鲜见闻开始。',
      summary: '记录里出现了向外行动或换个环境的意愿。',
    };
  }
  if (/疲惫|很累|脑子.*炸|压力|烦|倦/.test(source)) {
    return {
      label: '需要留白',
      title: '此刻更需要低压力、可以慢一点的交流',
      suggestion: '先关心具体近况，避免把对话变成追问或建议清单。',
      summary: '记录中提到了疲惫或压力；它只用于调整当下的交流节奏。',
    };
  }
  if (/迷茫|纠结|选择|不知道|毕业|离职|方向/.test(source)) {
    return {
      label: '正在梳理',
      title: '此刻正在把一些选择和感受慢慢理清',
      suggestion: '从一段具体经历聊起，比直接给建议更自然。',
      summary: '记录中出现了与选择、方向或不确定有关的表达。',
    };
  }
  if (/期待|开心|兴奋|想认识|朋友|聊聊/.test(source)) {
    return {
      label: '愿意连接',
      title: '此刻对新的交流保持着开放感',
      suggestion: '可以从共同兴趣或刚发生的一件小事开始，保持来回。',
      summary: '记录中出现了积极或愿意连接的表达。',
    };
  }
  if (/平静|安静|想想|思考|读书|写作|创作/.test(source)) {
    return {
      label: '安静观察',
      title: '此刻更适合从一个具体问题慢慢展开',
      suggestion: '分享一个正在想的细节，给彼此留出思考和回应的空间。',
      summary: '记录呈现出安静思考或专注投入的节奏。',
    };
  }
  return {
    label: mood || '此刻记录',
    title: '此刻的感受，为长期画像补上了一条新的线索',
    suggestion: '从你刚刚记录的内容出发，保持具体、真诚的交流。',
    summary: '这是一条当下记录，不会被当成固定的人格标签。',
  };
}

/**
 * 将「此刻记录」和已有的长期理解并列呈现。
 *
 * 这是一个纯规则解释层：不发起 LLM 请求、不写数据库，也不替代匹配器的向量计算。
 * 后续 C 只需要消费结构化信号，不应读取或传播 `currentState.text` 原文。
 */
export function buildContextualPersona({ currentState, understanding }: ContextualPersonaInput): ContextualPersona {
  const text = compact(currentState?.text);
  const mood = compact(currentState?.mood);
  const topics = (understanding?.topics || []).map(compact).filter(Boolean).slice(0, 3);
  const coreQuestion = compact(understanding?.coreQuestion);
  const hasCurrent = Boolean(text || mood);
  const hasLongTerm = Boolean(topics.length || coreQuestion);

  if (!hasCurrent && !hasLongTerm) {
    return {
      source: 'unavailable',
      title: '从一条此刻记录开始',
      summary: '先记下今天的状态；当长期理解完成后，这里会呈现两者之间的不同侧面。',
      currentLabel: '尚未记录',
      longTermLabel: '尚未生成',
      conversationSuggestion: '先不用定义自己，只记录当下真实的一个念头即可。',
      tags: [],
      note: '此刻侧面不是人格测评，也不会把一次记录固定成标签。',
    };
  }

  const moment = resolveMoment(text, mood);
  const longTermLabel = topics.length
    ? `长期关注：${topics.join('、')}`
    : coreQuestion
      ? `长期问题：${coreQuestion}`
      : '长期理解尚在生成中';
  const currentLabel = text ? preview(text) : mood;
  const tags = [...(mood ? [mood] : []), ...topics].filter((tag, index, values) => values.indexOf(tag) === index).slice(0, 4);

  if (hasCurrent && hasLongTerm) {
    return {
      source: 'long-term-and-current',
      title: moment.title,
      summary: `${moment.summary} 长期内容中，你持续关注${topics.length ? topics.join('、') : coreQuestion}。`,
      currentLabel,
      longTermLabel,
      conversationSuggestion: moment.suggestion,
      tags,
      note: '长期理解描述你反复表达的内容；此刻侧面只描述当前记录。两者并列，不互相覆盖。',
    };
  }

  if (hasCurrent) {
    return {
      source: 'current-only',
      title: moment.title,
      summary: `${moment.summary} 等长期理解完成后，这里会把两类线索并列展示。`,
      currentLabel,
      longTermLabel,
      conversationSuggestion: moment.suggestion,
      tags,
      note: '这是一条当下记录，不会被解释为长期的人格特征。',
    };
  }

  return {
    source: 'long-term-only',
    title: '长期底色已经清晰，等待今天的一条新线索',
    summary: `目前可见的是长期理解：${topics.length ? topics.join('、') : coreQuestion}。记录此刻状态后，才会出现与今天相关的侧面。`,
    currentLabel: '尚未记录此刻状态',
    longTermLabel,
    conversationSuggestion: '先写下一句今天的感受；不需要完整，也不需要正确。',
    tags,
    note: '长期理解与当下记录会被分开保留，避免把短期情绪写成固定结论。',
  };
}
