import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { ProfileArtifact } from '@/lib/profile/schema';
import { readArtifactFile } from '@/lib/profile/store';

/** 只展示已确认可在演示中使用的采集输入对应的完整画像。 */
const AUTHORIZED_PROFILES = [
  { id: 'yyss2037', label: '公开答主' },
  { id: 'an-ling-91', label: '公开答主 A' },
  { id: 'he-wo-hui-jia', label: '公开答主 B' },
] as const;

export interface DemoAuthorProfile {
  id: string;
  label: string;
  contentCount: number;
  artifact: ProfileArtifact;
}

function publicZhihuUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com'))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function getDemoAuthorProfiles(root = process.cwd()): DemoAuthorProfile[] {
  // 本地可进行研究预览；线上必须逐人显式确认整份推断画像可公开展示。
  // 公开发表内容的许可不自动等同于公开 AI 画像的许可。
  const productionApprovedIds = new Set((process.env.DEMO_PUBLIC_PROFILE_IDS || '').split(',').map((id) => id.trim()));
  return AUTHORIZED_PROFILES.flatMap(({ id, label }) => {
    if (process.env.NODE_ENV === 'production' && !productionApprovedIds.has(id)) return [];
    // 原始输入和画像产物均不进仓库；两者缺一就不展示该人物。
    if (!fs.existsSync(path.join(root, 'data', 'crawler', `${id}.json`))) return [];
    const artifact = readArtifactFile(path.join(root, 'profile-output'), id);
    if (!artifact || !artifact.profile?.representative_contents?.length || !artifact.evidence_index?.length) return [];
    return [{
      id,
      label,
      contentCount: artifact.meta.content_count,
      artifact: {
        ...artifact,
        subject: { ...artifact.subject, name: label, avatarUrl: null },
        evidence_index: artifact.evidence_index.map((item) => ({ ...item, url: publicZhihuUrl(item.url) })),
      },
    }];
  });
}
