import { describe, expect, it } from 'vitest';
import { CrawlerContentSource } from './content-source';

describe('CrawlerContentSource', () => {
  it('exposes crawler pages without OAuth', async () => {
    const source = new CrawlerContentSource({
      provider: 'crawler', externalUserId: 'fixture', name: '测试人物', avatarUrl: null, headline: null, profileUrl: null,
    }, [{ id: 'c1', title: '内容', text: '正文' }]);
    expect((await source.getIdentity()).externalUserId).toBe('fixture');
    expect((await source.listContents()).items).toHaveLength(1);
    expect((await source.listContents('done')).items).toHaveLength(0);
  });
});
