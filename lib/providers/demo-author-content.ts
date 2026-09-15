import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { looseParseItems } from '@/lib/profile/store';

/**
 * 已获展示授权的爬虫输入。原始文件始终留在被 Git 忽略的 data/crawler 目录，
 * 此处只在服务端按需读取并向 Demo 返回必要的卡片字段。
 */
const AUTHORIZED_SOURCE_FILES = ['an-ling-91.json', 'he-wo-hui-jia.json'] as const;
const MAX_SAMPLES_PER_SOURCE = 3;
const EXCERPT_LENGTH = 180;

export interface DemoAuthorContent {
  id: string;
  author: string;
  title: string;
  excerpt: string;
  type: '回答' | '文章' | '想法';
  publishedAt: string | null;
  sourceUrl: string | null;
}

function displayType(value: string | undefined): DemoAuthorContent['type'] {
  if (value === 'article') return '文章';
  if (value === 'thought') return '想法';
  return '回答';
}

function toDisplayDate(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') {
    const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) || null : date.toISOString().slice(0, 10);
}

function publicZhihuUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' && (url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com')))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= EXCERPT_LENGTH) return normalized;
  return `${normalized.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

/** 仅供有效 Demo 会话调用；缺少本地授权数据时返回空数组，而不是伪造内容。 */
export function getDemoAuthorContents(root = process.cwd()): DemoAuthorContent[] {
  const dataDir = path.join(root, 'data', 'crawler');
  const samples: DemoAuthorContent[] = [];

  for (const file of AUTHORIZED_SOURCE_FILES) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const rows = looseParseItems(JSON.parse(fs.readFileSync(filePath, 'utf8')));
      const usable = rows.filter((row) => row.text.trim().length > 0).slice(0, MAX_SAMPLES_PER_SOURCE);
      usable.forEach((row, index) => {
        samples.push({
          id: `${file}:${row.id || index}`,
          author: row.author?.trim() || '公开答主',
          title: row.title?.trim() || '知乎回答',
          excerpt: excerpt(row.text),
          type: displayType(row.type),
          publishedAt: toDisplayDate(row.published_at),
          sourceUrl: publicZhihuUrl(row.url),
        });
      });
    } catch {
      // 单份本地输入损坏时不影响其他授权样本，也不暴露文件系统细节。
    }
  }

  return samples;
}
