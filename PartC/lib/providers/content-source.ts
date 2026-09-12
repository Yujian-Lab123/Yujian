import type { RawContent } from '../profile/schema';
import { fetchZhihuContents, fetchZhihuProfile } from './zhihu';

export interface ExternalIdentity {
  provider: string;
  externalUserId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  profileUrl: string | null;
}

export interface ContentPage {
  items: RawContent[];
  nextCursor: string | null;
}

export interface ContentSource {
  getIdentity(): Promise<ExternalIdentity>;
  listContents(cursor?: string): Promise<ContentPage>;
  refreshCredential?(): Promise<void>;
}

export class CrawlerContentSource implements ContentSource {
  constructor(private readonly identity: ExternalIdentity, private readonly items: RawContent[]) {}
  async getIdentity() { return this.identity; }
  async listContents(cursor?: string): Promise<ContentPage> {
    return cursor ? { items: [], nextCursor: null } : { items: this.items, nextCursor: null };
  }
}

/**
 * 官方接口适配器占位。分页字段须以比赛方最终文档为准；在此之前只复用现有首屏接口，
 * 不把未确认的 Offset/Cursor 语义扩散到画像和匹配模块。
 */
export class ZhihuOAuthContentSource implements ContentSource {
  constructor(private readonly accessToken: string) {}

  async getIdentity(): Promise<ExternalIdentity> {
    const profile = await fetchZhihuProfile(this.accessToken);
    return { provider: 'zhihu', externalUserId: profile.zhihuUserId, ...profile };
  }

  async listContents(cursor?: string): Promise<ContentPage> {
    if (cursor) return { items: [], nextCursor: null };
    const result = await fetchZhihuContents(this.accessToken, 20);
    if (!result.ok) throw new Error(result.message || '知乎内容获取失败');
    return { items: result.items as RawContent[], nextCursor: null };
  }
}
