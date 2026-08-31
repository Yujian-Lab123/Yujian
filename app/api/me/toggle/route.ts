import { NextResponse } from 'next/server';
import { getUser, setEncounterEnabled } from '@/lib/db/users';
import { getSessionUserId } from '@/lib/session';

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  setEncounterEnabled(uid, Boolean(body.enabled));
  const user = getUser(uid);
  return NextResponse.json({ ok: true, encounter_enabled: user?.encounter_enabled });
}
