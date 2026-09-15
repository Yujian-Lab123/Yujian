import { describe, expect, it } from 'vitest';
import { looseExtract } from './store';

describe('looseExtract 字段宽松映射', () => {
  it('兼容知乎开放平台的大写驼峰字段（Content/Excerpt/Title）', () => {
    const item = {
      Id: 'z-1',
      Title: '我的回答',
      Content: '<p>第一段正文</p><p>第二段</p>',
      Excerpt: '第一段正文',
      Type: 'answer',
      Url: 'https://zhihu.com/a',
      CreatedAt: 1726000000,
      Author: '某人',
    };
    const r = looseExtract(item);
    expect(r.id).toBe('z-1');
    expect(r.title).toBe('我的回答');
    expect(r.text).toContain('第一段正文');
    expect(r.text).not.toContain('<p>');
    expect(r.type).toBe('answer');
    expect(r.published_at).toBe(1726000000);
    expect(r.author).toBe('某人');
  });

  it('兼容一层嵌套对象（字段包在 Target 里）', () => {
    const item = { Id: 'z-2', Target: { Title: '问题标题', Excerpt: '目标摘要', Content: '目标正文' } };
    const r = looseExtract(item);
    expect(r.title).toBe('问题标题');
    expect(r.text).toBe('目标正文');
  });

  it('下划线/连字符命名互认', () => {
    const r = looseExtract({ content_id: 'c-9', content_text: '正文', publish_time: '2026-09-14' });
    expect(r.id).toBe('c-9');
    expect(r.text).toBe('正文');
    expect(r.published_at).toBe('2026-09-14');
  });

  it('含 < > 的纯文本不被误当 HTML 清洗', () => {
    const r = looseExtract({ content: '当 a < b 且 c > 3 时成立' });
    expect(r.text).toBe('当 a < b 且 c > 3 时成立');
  });

  it('全空字段返回空 text（供上层报「没有可分析的内容」）', () => {
    const r = looseExtract({ Id: 'z-3', Type: 'answer' });
    expect(r.text).toBe('');
  });
});
