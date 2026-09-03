import { NextResponse } from 'next/server';
import path from 'node:path';
import { startProfileJob } from '@/lib/profile/jobs';

export const dynamic = 'force-dynamic';

// POST /api/profile/generate —— 启动画像生成后台任务 {file, name, maxItems?, maxChars?}
export async function POST(req: Request) {
  let body: { file?: string; name?: string; maxItems?: number; maxChars?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体必须是 JSON' }, { status: 400 });
  }
  if (!body.file || typeof body.file !== 'string') {
    return NextResponse.json({ ok: false, error: '缺少 file(data/crawler 下的文件名)' }, { status: 400 });
  }
  try {
    const job = startProfileJob({
      file: body.file,
      name: (body.name || body.file.replace(/\.json$/, '')).slice(0, 60),
      maxItems: Number.isFinite(body.maxItems) ? Number(body.maxItems) : undefined,
      maxChars: Number.isFinite(body.maxChars) ? Number(body.maxChars) : undefined,
      root: process.cwd(),
    });
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
