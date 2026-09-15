import { NextResponse } from 'next/server';
import { getLatestProfileArtifactShareStatus, setLatestProfileArtifactShared } from '@/lib/profile/repository';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

export const dynamic = 'force-dynamic';

// GET —— 当前用户的分享状态（是否有画像产物 + 是否已公开到画像长廊）
export async function GET() {
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const meta = await getLatestProfileArtifactShareStatus(uid).catch(() => null);
  return NextResponse.json({
    ok: true,
    hasArtifact: Boolean(meta),
    shared: Boolean(meta?.sharedAt),
    slug: meta?.slug ?? null,
  });
}

// POST —— {shared: boolean} 本人开关：true 公开到画像长廊，false 撤下
export async function POST(req: Request) {
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  let body: { shared?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体必须是 JSON' }, { status: 400 });
  }
  if (typeof body.shared !== 'boolean') {
    return NextResponse.json({ ok: false, error: '缺少 shared 布尔值' }, { status: 400 });
  }
  const result = await setLatestProfileArtifactShared(uid, body.shared);
  if (!result) {
    return NextResponse.json({ ok: false, error: '还没有可公开的画像产物，请先生成' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, shared: body.shared, slug: result.slug });
}
