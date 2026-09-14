import { SEED_USERS } from '../db/seed';
import { listProfileArtifacts, listSharedProfileArtifacts, getProfileArtifact } from '../profile/repository';
import { slugifyName } from '../profile/store';

/**
 * 画像长廊数据层（纯组装，可测试）：
 * - 预览条目：来自种子用户（虚构人设，比赛演示用），是长廊的常驻内容；
 * - 真实条目：仅 isMock=false 且本人自愿公开（sharedAt 非空）的画像。
 * Mock 预览条目永远不会混入真实用户；真实用户不开启分享则长廊不展示。
 */

export interface GalleryEntry {
  id: string;
  name: string;
  role: string;
  city: string;
  /** 卡片引言：优先画像 one_sentence，回退用户签名。 */
  quote: string;
  tags: string[];
  zhihuYears: number;
  summary: string;
  hasArtifact: boolean;
  slug: string;
  profileHref: string;
  /** 卡片封面路径；文件可缺省，前端用素色底 + 水墨纹样占位。 */
  cover: string;
  isMock: boolean;
}

function fallbackSummary(quote: string, fallback: string): string {
  const text = (quote || fallback || '').trim();
  return text.length > 64 ? `${text.slice(0, 63)}…` : text;
}

/** 预览条目：种子用户 + 数据库里已有的画像产物摘要（有则用 one_sentence）。 */
async function buildPreviewEntries(): Promise<GalleryEntry[]> {
  let artifactBySlug = new Map<string, { oneSentence: string | null }>();
  try {
    const summaries = await listProfileArtifacts();
    const enriched = await Promise.all(summaries.map(async (item) => {
      const artifact = await getProfileArtifact(item.slug).catch(() => null);
      return [item.slug, { oneSentence: artifact?.profile?.summary?.one_sentence ?? null }] as const;
    }));
    artifactBySlug = new Map(enriched);
  } catch { /* 数据库未就绪时回退签名文案 */ }

  return SEED_USERS.map((user) => {
    const slug = slugifyName(user.name);
    const artifactInfo = artifactBySlug.get(slug);
    const oneSentence = artifactInfo?.oneSentence ?? null;
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      city: user.city,
      quote: user.quote,
      tags: user.tags.slice(0, 3),
      zhihuYears: user.zhihu_years,
      summary: oneSentence ?? fallbackSummary(user.quote, user.role),
      hasArtifact: Boolean(oneSentence),
      slug,
      profileHref: `/gallery/${encodeURIComponent(slug)}`,
      cover: `/images/gallery/cover-${user.id}.png`,
      isMock: true,
    };
  });
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
        summary: oneSentence ?? fallbackSummary('', item.slug),
        hasArtifact: true,
        slug: item.slug,
        profileHref: `/gallery/${encodeURIComponent(item.slug)}`,
        cover: `/images/gallery/cover-${item.userId || item.slug}.png`,
        isMock: false,
      };
    });
  } catch {
    return [];
  }
}

export async function buildGalleryEntries(): Promise<{ preview: GalleryEntry[]; shared: GalleryEntry[] }> {
  const [preview, shared] = await Promise.all([buildPreviewEntries(), buildSharedEntries()]);
  return { preview, shared };
}
