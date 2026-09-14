import { listSharedProfileArtifacts } from '../profile/repository';

/**
 * 画像长廊数据层（纯组装，可测试）：
 * - 预览条目：8 位虚构人设（比赛演示，封面为 Image2.5 生成的水墨意境图，图内无文字）；
 * - 真实条目：仅 isMock=false 且本人自愿公开（sharedAt 非空）的画像。
 * 两条互不混列；真实用户不开启分享则不出现在长廊。
 */

export interface GalleryEntry {
  id: string;
  name: string;
  role: string;
  city: string;
  /** 卡片引言：真实条目优先画像 one_sentence。 */
  quote: string;
  tags: string[];
  zhihuYears: number;
  summary: string;
  hasArtifact: boolean;
  slug: string;
  profileHref: string;
  cover: string;
  isMock: boolean;
}

/** 封面路径约定：/images/gallery/mock-covers/<slug>-v1.png（图内无文字，文案由代码渲染）。 */
function coverOf(slug: string): string {
  return `/images/gallery/mock-covers/${slug}-v1.png`;
}

/** 预览人设（虚构，比赛演示数据；与相遇池的种子用户无冲突）。 */
const GALLERY_PERSONAS: ReadonlyArray<Omit<GalleryEntry, 'slug' | 'profileHref' | 'cover' | 'isMock' | 'hasArtifact'>> = [
  { id: 'linchuan', name: '林川', role: '产品经理', city: '杭州', quote: '把复杂讲简单，是我唯一坚持了十年的手艺。', tags: ['产品设计', '长期主义', '旅行'], zhihuYears: 9, summary: '写过 400 篇产品复盘，相信好品味来自笨功夫。' },
  { id: 'suwan', name: '苏晚', role: '独立插画师', city: '成都', quote: '画了三百张废稿之后，我才敢说自己会画画。', tags: ['插画', '创作', '生活'], zhihuYears: 6, summary: '在菜市场和人潮里找构图，把日常画成作品。' },
  { id: 'chenmo', name: '陈默', role: '自由摄影师', city: '大理', quote: '离开格子间以后，我反而更认真了。', tags: ['摄影', '自由职业', '旅行'], zhihuYears: 8, summary: '拍过 200 组普通人肖像，想理解「认真生活」长什么样。' },
  { id: 'yezi', name: '叶子', role: '环境工程研究生', city: '南京', quote: '捡垃圾这件事，我打算做一辈子。', tags: ['环保', '校园', '户外'], zhihuYears: 4, summary: '沿长江做了一年的水质记录，相信数据之外还有故事。' },
  { id: 'momo', name: 'Momo', role: '播客主播', city: '上海', quote: '我在城市里收集普通人的废话，都是金子。', tags: ['播客', '城市观察', '音乐'], zhihuYears: 5, summary: '做了 80 期街头访谈，专注那些没被写进履历的人生。' },
  { id: 'xiaoman', name: '小满', role: '乡村教师', city: '黔东南', quote: '山里的孩子教我的，比我教他们的多。', tags: ['教育', '乡村', '记录'], zhihuYears: 3, summary: '带孩子们把课文改成山歌，记录正在消失的方言课堂。' },
  { id: 'zhouyu', name: '周屿', role: '心理咨询师', city: '深圳', quote: '倾听不产生费用的时候，才最贵。', tags: ['心理', '倾听', '成长'], zhihuYears: 7, summary: '写了六年匿名咨询手记，研究人如何自我修复。' },
  { id: 'aze', name: '阿泽', role: '独立开发者', city: '广州', quote: '我的产品只有十三个用户，但每个我都认识。', tags: ['独立开发', 'AI', '效率'], zhihuYears: 6, summary: '辞掉大厂工作第三年，在做一个没人看好的工具。' },
];

/** 预览条目：虚构人设，静态数据（详情页仅对真实公开画像开放，人设卡不外链）。 */
function buildPersonaEntries(): GalleryEntry[] {
  return GALLERY_PERSONAS.map((persona) => ({
    ...persona,
    hasArtifact: false,
    slug: persona.id,
    profileHref: `/gallery/${encodeURIComponent(persona.id)}`,
    cover: coverOf(persona.id),
    isMock: true,
  }));
}

/** 真实条目：本人自愿公开（sharedAt 非空）的真实用户画像。 */
async function buildSharedEntries(): Promise<GalleryEntry[]> {
  try {
    const shared = await listSharedProfileArtifacts();
    return shared.map((item) => {
      const oneSentence = item.artifact.profile?.summary?.one_sentence ?? null;
      const insights = item.artifact.profile?.summary?.core_insights ?? [];
      return {
        id: item.userId || item.slug,
        name: item.artifact.subject?.name || item.slug,
        role: '知乎用户',
        city: '',
        quote: oneSentence ?? '',
        tags: insights.slice(0, 2).map((insight) => insight.claim.slice(0, 12)),
        zhihuYears: item.artifact.meta?.content_count ?? 0,
        summary: oneSentence ?? item.slug,
        hasArtifact: true,
        slug: item.slug,
        profileHref: `/gallery/${encodeURIComponent(item.slug)}`,
        cover: coverOf(item.slug),
        isMock: false,
      };
    });
  } catch {
    return [];
  }
}

export async function buildGalleryEntries(): Promise<{ preview: GalleryEntry[]; shared: GalleryEntry[] }> {
  const [preview, shared] = await Promise.all([Promise.resolve(buildPersonaEntries()), buildSharedEntries()]);
  return { preview, shared };
}
