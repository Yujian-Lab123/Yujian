import { NextResponse } from 'next/server';
import path from 'node:path';
import { startProfileJob, startProfileJobForUser } from '@/lib/profile/jobs';
import { getUser } from '@/lib/db/users';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

export const dynamic = 'force-dynamic';

// POST /api/profile/generate —— 启动画像生成后台任务
//   { source: 'zhihu' } → 用当前登录用户的知乎采集内容（真实用户默认路径）
//   { file, name }      → 用 data/crawler 下的爬虫文件（开发/调试路径）
export async function POST(req: Request) {
  const userId = await getRealSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  let body: { file?: string; name?: string; source?: string; maxItems?: number; maxChars?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体必须是 JSON' }, { status: 400 });
  }
  try {
    if (body.source === 'zhihu') {
      const user = await getUser(userId);
      const job = await startProfileJobForUser({
        userId,
        name: (body.name || user?.name || '我').slice(0, 60),
        maxItems: Number.isFinite(body.maxItems) ? Number(body.maxItems) : undefined,
        maxChars: Number.isFinite(body.maxChars) ? Number(body.maxChars) : undefined,
        requestedBy: userId,
      });
      return NextResponse.json({ ok: true, jobId: job.id });
    }
    if (!body.file || typeof body.file !== 'string') {
      return NextResponse.json({ ok: false, error: '缺少 file(data/crawler 下的文件名) 或 source=zhihu' }, { status: 400 });
    }
    const job = await startProfileJob({
      file: body.file,
      name: (body.name || body.file.replace(/\.json$/, '')).slice(0, 60),
      maxItems: Number.isFinite(body.maxItems) ? Number(body.maxItems) : undefined,
      maxChars: Number.isFinite(body.maxChars) ? Number(body.maxChars) : undefined,
      root: process.cwd(),
      requestedBy: userId,
    });
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
