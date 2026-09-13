import { NextResponse } from 'next/server';
import { buildEncounters } from '@/lib/retrieval/matcher';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

export async function GET() {
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const cards = await buildEncounters(uid);
  return NextResponse.json({ ok: true, encounters: cards });
}
