import { NextResponse } from 'next/server';
import { getJob } from '@/lib/profile/jobs';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

export const dynamic = 'force-dynamic';

// GET /api/profile/jobs/[id] —— 轮询后台任务状态
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getRealSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const job = await getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: '任务不存在' }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
