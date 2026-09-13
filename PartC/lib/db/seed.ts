import type { Axis } from '../axes';
import type { CurrentStateSelection } from '../current-state/privacy';

// ============ 遇见 · Mock 种子数据 ============
// 设计原则（概览 §54）：不同专业 / 兴趣 / 人生阶段，避免所有人都是 AI/编程/产品。
// 向量由人工标注在概念轴上，保证 Demo A（跨主题连接）/ Demo B（此刻状态）可复现。

export interface SeedUser {
  id: string;
  name: string;
  role: string;
  city: string;
  quote: string;
  tags: string[];
  intents: string[];
  auto_reciprocate: 0 | 1;
  zhihu_years: number;
  upvotes: string;
  current_state?: CurrentStateSelection;
}

export interface SeedContent {
  id: string;
  user_id: string;
  type: 'answer' | 'article' | 'thought';
  title: string;
  chars: number;
  minutes: number;
  summary: string;
  excerpt: string;
  topics: string[];
  v: Partial<Record<Axis, number>>;
  published_at: string;
  anchor?: boolean;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'u0', name: '江树', role: '产品经理', city: '北京',
    quote: '好奇心驱动，相信用心的提问能靠近真相。',
    tags: ['长期主义', '哲学思考', '行走与观察'], intents: ['朋友', '随便聊聊'],
    auto_reciprocate: 0, zhihu_years: 6, upvotes: '1.2 万',
  },
  {
    id: 'u1', name: '远山与近海', role: '研究员', city: '杭州',
    quote: '理性与感性并不矛盾，世界的复杂值得温柔以待。',
    tags: ['心理学', '社会学', '写作'], intents: ['朋友', '同行'],
    auto_reciprocate: 1, zhihu_years: 5, upvotes: '8,976',
  },
  {
    id: 'u2', name: '陈默', role: '自由摄影师', city: '大理',
    quote: '离开格子间以后，我反而更认真了。',
    tags: ['摄影', '旅行', '职业选择'], intents: ['朋友', '随便聊聊'],
    auto_reciprocate: 1, zhihu_years: 7, upvotes: '2.3 万',
  },
  {
    id: 'u3', name: '阿屿', role: '户外领队', city: '成都',
    quote: '山不会回答你，但山会听。',
    tags: ['户外', '徒步', '城市行走'], intents: ['户外搭子', '朋友'],
    auto_reciprocate: 1, zhihu_years: 3, upvotes: '4,120',
    current_state: { mood: '疲惫', activity: '想走走', connectionMode: '找同伴' },
  },
  {
    id: 'u4', name: '林医生', role: '住院医师', city: '上海',
    quote: '医学教人面对极限，叙事教人面对彼此。',
    tags: ['医学', '生死', '叙事医学'], intents: ['同行', '朋友'],
    auto_reciprocate: 0, zhihu_years: 4, upvotes: '9,540',
  },
  {
    id: 'u5', name: '周老师', role: '乡村教师', city: '云南',
    quote: '教育是把一个人心里本来就有的东西，慢慢点亮。',
    tags: ['教育', '公平', '乡村'], intents: ['朋友', '合作伙伴'],
    auto_reciprocate: 0, zhihu_years: 5, upvotes: '6,800',
  },
  {
    id: 'u6', name: '老猫', role: '价值投资者', city: '深圳',
    quote: '慢就是快，少就是多。',
    tags: ['价值投资', '长期主义'], intents: ['同行', '随便聊聊'],
    auto_reciprocate: 0, zhihu_years: 9, upvotes: '3.1 万',
  },
  {
    id: 'u7', name: '青灯', role: '书评人', city: '南京',
    quote: '读书是为了在别人的句子里，认出自己。',
    tags: ['阅读', '写作', '文学'], intents: ['朋友'],
    auto_reciprocate: 0, zhihu_years: 8, upvotes: '1.8 万',
  },
  {
    id: 'u8', name: '半月', role: '心理编辑', city: '广州',
    quote: '焦虑不是敌人，是信使。',
    tags: ['焦虑', '心理健康', '自我认知'], intents: ['朋友', '随便聊聊'],
    auto_reciprocate: 1, zhihu_years: 4, upvotes: '7,300',
  },
  {
    id: 'u9', name: '何溯', role: '社会学博士生', city: '武汉',
    quote: '理解先于评判。',
    tags: ['社会学', '观察', '写作'], intents: ['同行', '朋友'],
    auto_reciprocate: 0, zhihu_years: 3, upvotes: '5,210',
  },
];

export const SEED_CONTENTS: SeedContent[] = [
  // ---- u0 江树（Demo 登录身份）----
  {
    id: 'c01', user_id: 'u0', type: 'answer', title: '怎样才算是「会提问」？', chars: 4200, minutes: 10,
    summary: '作者从产品工作的经验出发，认为好问题不是技巧，而是一种对他人真实处境的尊重。好的提问会把对方从“立场”带回“经历”。',
    excerpt: '很多人把提问当成获取信息的工具，但我越来越觉得，提问首先是一种态度：你愿意承认自己不知道，并且真的想知道。',
    topics: ['提问', '产品思维', '沟通'], v: { product: 0.85, psycho: 0.6, society: 0.45, writing: 0.5 }, published_at: '2024-11-02', anchor: true,
  },
  {
    id: 'c02', user_id: 'u0', type: 'article', title: '我的长期主义清单：三年后依然重要的事', chars: 3100, minutes: 8,
    summary: '作者列出自己反复验证过的长期事项：健康、写作、深度关系、可迁移的能力。文章的核心不是清单本身，而是“如何抵抗短期噪音”的思考。',
    excerpt: '每年年底我都会问自己：这件事三年后还重要吗？大多数让我焦虑的事，都过不了这一问。',
    topics: ['长期主义', '自我成长', '选择'], v: { longterm: 0.9, career: 0.65, meaning: 0.7, invest: 0.5 }, published_at: '2025-01-12', anchor: true,
  },
  {
    id: 'c03', user_id: 'u0', type: 'article', title: '走路是我最好的思考方式', chars: 2400, minutes: 6,
    summary: '作者记录自己用城市行走消化工作压力的习惯，认为身体的节奏会改变思考的质量。',
    excerpt: '想不通的事，走五公里往往就松动了。不是想通了，是它回到了合适的尺寸。',
    topics: ['行走', '思考', '生活方式'], v: { travel: 0.6, outdoor: 0.45, meaning: 0.55, psycho: 0.5 }, published_at: '2025-03-08',
  },
  {
    id: 'c04', user_id: 'u0', type: 'answer', title: '在「稳定」和「自由」之间，你是怎么做选择的？', chars: 3600, minutes: 9,
    summary: '作者坦诚自己仍在两者之间摇摆，但提出了一个自己的框架：不比较两种生活的好坏，只比较“哪种遗憾我更愿意承担”。',
    excerpt: '我后来不再问“哪个更好”，而是问“十年后，我更后悔没选哪一个”。答案立刻就清楚了。',
    topics: ['职业选择', '自由', '稳定'], v: { career: 0.85, meaning: 0.75, longterm: 0.6 }, published_at: '2024-08-21', anchor: true,
  },

  // ---- u1 远山与近海 ----
  {
    id: 'c11', user_id: 'u1', type: 'answer', title: '人是在什么时候意识到自己的心智模型的？', chars: 5200, minutes: 12,
    summary: '作者结合心理学研究与个人经历，认为心智模型往往在“预测失败”时才显形：当世界没有按我们以为的方式回应我们。',
    excerpt: '我们不是通过成功认识自己，而是通过那些“我以为会这样，结果不是”的瞬间。',
    topics: ['心理学', '心智模型', '自我认知'], v: { psycho: 0.9, meaning: 0.7, society: 0.6, writing: 0.6 }, published_at: '2024-10-15', anchor: true,
  },
  {
    id: 'c12', user_id: 'u1', type: 'article', title: '我们为什么需要「被看见」', chars: 3800, minutes: 9,
    summary: '作者讨论“被看见”与“被关注”的区别：被看见是对方理解了你的意图，而不只是注意到了你的行为。',
    excerpt: '被关注很容易，被看见很难。前者需要流量，后者需要耐心。',
    topics: ['社会学', '关系', '心理学'], v: { society: 0.75, psycho: 0.8, life: 0.6, meaning: 0.6 }, published_at: '2025-02-01', anchor: true,
  },
  {
    id: 'c13', user_id: 'u1', type: 'article', title: '写作是慢思考：我为什么坚持手写初稿', chars: 2600, minutes: 6,
    summary: '作者分享手写初稿的习惯，认为速度会影响诚实：写得越慢，越难骗自己。',
    excerpt: '键盘太快了，快到来不及羞愧。手写的时候，每一个夸张的词都要多写一遍，于是就删了。',
    topics: ['写作', '思考', '习惯'], v: { writing: 0.85, psycho: 0.6, meaning: 0.55 }, published_at: '2024-12-10',
  },
  {
    id: 'c14', user_id: 'u1', type: 'answer', title: '理性与感性冲突时，你听谁的？', chars: 3300, minutes: 8,
    summary: '作者认为理性与感性不是两个声音，而是同一个人对不同时间尺度的关心：感性关心此刻，理性关心以后。',
    excerpt: '我不再让它们投票，而是让它们分工：感性告诉我什么重要，理性告诉我怎么走到那里。',
    topics: ['理性', '感性', '决策'], v: { psycho: 0.8, meaning: 0.7, career: 0.5 }, published_at: '2025-04-02',
  },

  // ---- u2 陈默（跨主题连接 Demo A 的关键人物）----
  {
    id: 'c21', user_id: 'u2', type: 'article', title: '我为什么没有留在大厂', chars: 3216, minutes: 8,
    summary: '这篇文章讲述了作者在大厂工作的经历与思考，探讨了稳定与自由、他人期待与自我选择之间的拉扯。作者最终选择离开，并开始构建更符合自己价值观的生活与工作方式。文章真诚、细腻，也许能让你在某些时刻产生共鸣。',
    excerpt: '很多人问我：大厂、多数人羡慕的资源、稳定的收入，我为什么要放弃？',
    topics: ['职场选择', '自由', '稳定'], v: { career: 0.9, meaning: 0.75, longterm: 0.55, photo: 0.3 }, published_at: '2024-09-18', anchor: true,
  },
  {
    id: 'c22', user_id: 'u2', type: 'answer', title: '如何选择 35mm 镜头？', chars: 4600, minutes: 11,
    summary: '一篇扎实的器材长文，但作者真正想说的是：限制你的从来不是镜头，而是你是否清楚自己想拍什么。',
    excerpt: '先想清楚你要讲什么故事，再决定用哪只镜头。器材问题大多是主题问题的替身。',
    topics: ['摄影', '器材', '创作'], v: { photo: 0.9, product: 0.3, meaning: 0.35 }, published_at: '2024-06-30',
  },
  {
    id: 'c23', user_id: 'u2', type: 'article', title: '一次西藏旅行：在海拔五千米想通的事', chars: 2900, minutes: 7,
    summary: '作者记录一次高原旅行，身体的极限让很多城市里的纠结自动缩小。',
    excerpt: '在垭口上喘气的时候，我发现过去一年让我失眠的事，没有一件值得带到这里来想。',
    topics: ['旅行', '摄影', '人生思考'], v: { travel: 0.85, photo: 0.7, meaning: 0.5, outdoor: 0.5 }, published_at: '2024-11-25',
  },
  {
    id: 'c24', user_id: 'u2', type: 'article', title: '自由职业第三年：关于收入不稳定的诚实回答', chars: 3500, minutes: 9,
    summary: '作者公开了三年的收入曲线与心理变化，不美化自由，也不后悔离开。核心观点：自由的代价是持续的不确定，而确定的代价是持续的让步。',
    excerpt: '自由不是舒服，是你要亲自承担所有后果。我付得起，所以我留下。',
    topics: ['自由职业', '收入', '选择'], v: { career: 0.85, invest: 0.45, longterm: 0.6, meaning: 0.6 }, published_at: '2025-02-20', anchor: true,
  },

  // ---- u3 阿屿 ----
  {
    id: 'c31', user_id: 'u3', type: 'answer', title: '徒步的时候，人为什么会突然哭出来？', chars: 2800, minutes: 7,
    summary: '作者作为领队观察到的瞬间：身体的疲惫会拆掉情绪的堤坝，而山里的安全感让人终于允许自己崩溃一次。',
    excerpt: '我不是带人爬山，我是陪人把背了很久的东西，找个安全的地方放下来。',
    topics: ['户外', '情绪', '徒步'], v: { outdoor: 0.9, psycho: 0.55, life: 0.5, anxiety: 0.4 }, published_at: '2025-01-30', anchor: true,
  },
  {
    id: 'c32', user_id: 'u3', type: 'thought', title: '城市行走指南：下班后的两小时', chars: 900, minutes: 3,
    summary: '作者分享在城市里“无目的行走”的路线设计方法：不导航、不打卡、允许迷路。',
    excerpt: '把通勤路线反过来走一遍，你会看见一个没见过的城市。',
    topics: ['城市行走', '生活'], v: { outdoor: 0.7, travel: 0.75, life: 0.5 }, published_at: '2025-04-15',
  },

  // ---- u4 林医生 ----
  {
    id: 'c41', user_id: 'u4', type: 'answer', title: '作为医生，你经历过哪些「教科书没写」的时刻？', chars: 4800, minutes: 11,
    summary: '作者写了三个病房里的瞬间，讨论医学的极限与人的温度：技术能回答“能不能”，只有人能回答“要不要”。',
    excerpt: '教科书教我如何治疗疾病，没教我如何面对一个知道自己在告别的人。',
    topics: ['医学', '生死', '叙事'], v: { medic: 0.9, meaning: 0.8, psycho: 0.55, writing: 0.5 }, published_at: '2024-10-08', anchor: true,
  },
  {
    id: 'c42', user_id: 'u4', type: 'article', title: '值完夜班后，我为什么开始写日记', chars: 2500, minutes: 6,
    summary: '作者用写作消化职业带来的情绪负荷，认为记录是一种“把经历变成经验”的方式。',
    excerpt: '不写下来，那些时刻就只是消耗；写下来，它们才成为我的一部分。',
    topics: ['写作', '职业', '情绪'], v: { medic: 0.7, writing: 0.65, anxiety: 0.5, meaning: 0.6 }, published_at: '2025-03-12',
  },

  // ---- u5 周老师 ----
  {
    id: 'c51', user_id: 'u5', type: 'answer', title: '乡村教育最缺的到底是什么？', chars: 4100, minutes: 10,
    summary: '作者认为最缺的不是硬件，而是“见过更多可能性的人”。一个老师能给的最大的东西，是让孩子知道人生不止一种答案。',
    excerpt: '孩子们不缺聪明，缺的是样本。他们没见过的那些活法，才是我要带进来的。',
    topics: ['教育', '公平', '乡村'], v: { edu: 0.9, society: 0.7, meaning: 0.7, longterm: 0.55 }, published_at: '2024-12-01', anchor: true,
  },
  {
    id: 'c52', user_id: 'u5', type: 'article', title: '一个学生教会我的事', chars: 2200, minutes: 5,
    summary: '作者记录一个“后进生”如何在他差点放弃时，反过来教会他什么是耐心。',
    excerpt: '我以为我在教他，后来发现他在教我：慢一点，再慢一点。',
    topics: ['教育', '成长'], v: { edu: 0.8, life: 0.6, psycho: 0.5 }, published_at: '2025-04-20',
  },

  // ---- u6 老猫 ----
  {
    id: 'c61', user_id: 'u6', type: 'answer', title: '价值投资最难的不是分析，是等待', chars: 3900, minutes: 9,
    summary: '作者认为投资的本质是性格的外化：你如何对待波动，就是你如何对待人生里的不确定性。',
    excerpt: '市场不奖励聪明，奖励的是能忍受无聊的人。生活好像也是。',
    topics: ['投资', '长期主义', '性格'], v: { invest: 0.9, longterm: 0.85, meaning: 0.5, career: 0.45 }, published_at: '2024-09-05', anchor: true,
  },
  {
    id: 'c62', user_id: 'u6', type: 'article', title: '我如何决定“不做什么”', chars: 2700, minutes: 7,
    summary: '作者分享自己的“反向清单”：用排除法保护注意力，把有限的人生押在少数事情上。',
    excerpt: '机会清单越列越长的人，往往什么都没做成。我的清单是反过来的。',
    topics: ['决策', '长期主义'], v: { invest: 0.7, longterm: 0.8, career: 0.55, meaning: 0.55 }, published_at: '2025-01-25',
  },

  // ---- u7 青灯 ----
  {
    id: 'c71', user_id: 'u7', type: 'article', title: '重读《活着》：苦难不值得赞美，值得赞美的是人', chars: 3400, minutes: 8,
    summary: '作者反对对苦难的浪漫化，认为福贵最动人的不是忍受，而是他始终没有把痛苦转嫁给他人。',
    excerpt: '我们赞美活着，不是赞美苦难，是赞美一个具体的人如何没有被苦难改写心地。',
    topics: ['文学', '阅读', '人生'], v: { writing: 0.9, meaning: 0.75, society: 0.5, psycho: 0.5 }, published_at: '2024-11-11', anchor: true,
  },
  {
    id: 'c72', user_id: 'u7', type: 'answer', title: '有哪些书改变了你的人生轨迹？', chars: 2900, minutes: 7,
    summary: '作者列出三本书与三个决定，认为书的作用不是给答案，而是在关键时刻提供一个“可以这样活”的样本。',
    excerpt: '书没有替我做决定，书只是让我知道，有人这样活过，而且活得诚实。',
    topics: ['阅读', '选择'], v: { writing: 0.85, meaning: 0.7, career: 0.45 }, published_at: '2025-02-14',
  },

  // ---- u8 半月 ----
  {
    id: 'c81', user_id: 'u8', type: 'article', title: '关于焦虑，我想说的 5 件事', chars: 1512, minutes: 5,
    summary: '作者以编辑与亲历者双重身份，写下与焦虑相处的五条经验：不消灭、不美化、记录它、给它时间、找人说话。',
    excerpt: '焦虑不是要打败的敌人，它是一个跑得很快、想提醒你什么的信使。',
    topics: ['焦虑', '心理健康', '自我关怀'], v: { anxiety: 0.9, psycho: 0.75, meaning: 0.55, writing: 0.55 }, published_at: '2025-03-28', anchor: true,
  },
  {
    id: 'c82', user_id: 'u8', type: 'article', title: '人生不是用来规划的，是用来体验的', chars: 2451, minutes: 7,
    summary: '作者反思“规划崇拜”，认为过度规划让人把人生过成 KPI，而体验的不可控恰恰是它的价值。',
    excerpt: '我删掉了五年计划，只留下三个问题：什么让我好奇？什么让我安心？谁让我想靠近？',
    topics: ['人生', '选择', '体验'], v: { anxiety: 0.6, meaning: 0.75, career: 0.6, life: 0.6 }, published_at: '2024-12-22', anchor: true,
  },
  {
    id: 'c83', user_id: 'u8', type: 'answer', title: '我在 30 岁重新定义了成功', chars: 1987, minutes: 6,
    summary: '作者把成功从“被羡慕”改写为“可持续”：睡得着、有人聊、有事做、不害人。',
    excerpt: '三十岁以后，我的成功标准朴素得可笑，但每一条都很难。',
    topics: ['成功', '价值观', '年龄'], v: { meaning: 0.8, career: 0.65, anxiety: 0.5, life: 0.6 }, published_at: '2025-01-05',
  },

  // ---- u9 何溯 ----
  {
    id: 'c91', user_id: 'u9', type: 'answer', title: '社会学教给我的第一件事：先理解，再评判', chars: 3700, minutes: 9,
    summary: '作者用几个田野调查的例子说明：很多“不可理喻”的行为，放进当事人的处境里都完全合理。',
    excerpt: '评判让人安心，理解让人不安。但只有理解，才真的改变看法。',
    topics: ['社会学', '方法论', '观察'], v: { society: 0.9, psycho: 0.6, writing: 0.6, meaning: 0.55 }, published_at: '2024-10-28', anchor: true,
  },
  {
    id: 'c92', user_id: 'u9', type: 'article', title: '在县城做田野调查的三十天', chars: 4300, minutes: 10,
    summary: '作者记录县城调研中的细节：人情、面子、机会与限制，如何共同塑造普通人的选择。',
    excerpt: '在大城市我们谈“选择自由”，在县城我看见“选择的条件”。',
    topics: ['田野调查', '县城', '社会'], v: { society: 0.85, edu: 0.5, career: 0.5, writing: 0.55 }, published_at: '2025-02-08',
  },
];
