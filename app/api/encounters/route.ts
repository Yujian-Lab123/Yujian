import { NextResponse } from 'next/server';
import { buildEncounters } from '@/lib/retrieval/matcher';
import { getRealSessionUserId } from '@/lib/experience-mode/session';
import { filterPoolByMode } from '@/lib/experience-mode/pool';

export async function GET() {
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  // 真实模式：候选池过滤掉全部 Mock 用户，绝不向真实用户展示演示数据。
  const cards = await filterPoolByMode(await buildEncounters(uid, 'real'), 'real');
  return NextResponse.json({ ok: true, encounters: cards });
}
