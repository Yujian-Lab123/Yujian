import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { computeUserVectors } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

// 离线理解管线入口：OAuth 后“认真做一次”；增量阶段只处理新内容。
export async function POST() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  await computeUserVectors(uid);
  return NextResponse.json({ ok: true, understanding: await buildUnderstanding(uid) });
}
