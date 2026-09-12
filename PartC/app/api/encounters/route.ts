import { NextResponse } from 'next/server';
import { buildEncounters } from '@/lib/retrieval/matcher';
import { getSessionUserId } from '@/lib/session';

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const cards = await buildEncounters(uid);
  return NextResponse.json({ ok: true, encounters: cards });
}
