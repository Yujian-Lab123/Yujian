import { NextResponse } from 'next/server';
import path from 'node:path';
import { listArtifacts, listCrawlerInputs } from '@/lib/profile/store';

export const dynamic = 'force-dynamic';

// GET /api/profile/inputs —— 可分析的爬虫输入文件 + 已有画像产物列表
export async function GET() {
  const root = process.cwd();
  return NextResponse.json({
    ok: true,
    inputs: listCrawlerInputs(path.join(root, 'data', 'crawler')),
    artifacts: listArtifacts(path.join(root, 'profile-output')),
  });
}
