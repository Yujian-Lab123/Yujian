import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { checkDatabase, db } from '@/lib/db/client';
import { serviceHeartbeats } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const database = await checkDatabase();
  let worker: { ok: boolean; lastSeenAt: string | null; status: string } = { ok: false, lastSeenAt: null, status: 'not_started' };
  if (database.ok) {
    const [heartbeat] = await db.select().from(serviceHeartbeats).where(eq(serviceHeartbeats.name, 'profile-worker')).limit(1);
    if (heartbeat) {
      const ageMs = Date.now() - heartbeat.lastSeenAt.getTime();
      worker = { ok: ageMs < 15_000, lastSeenAt: heartbeat.lastSeenAt.toISOString(), status: ageMs < 15_000 ? 'healthy' : 'stale' };
    }
  }
  const ok = database.ok && worker.ok;
  return NextResponse.json({ ok, web: { ok: true }, database, worker }, { status: ok ? 200 : 503 });
}
