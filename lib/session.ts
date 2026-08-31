import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { getDb } from './db';

export const SESSION_COOKIE = 'yj_session';
export const OAUTH_STATE_COOKIE = 'yj_oauth_state';

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const row = getDb().prepare('SELECT user_id FROM sessions WHERE id = ?').get(id) as any;
  return row?.user_id ?? null;
}

export function createSession(userId: string): string {
  const id = randomBytes(18).toString('base64url');
  getDb().prepare('INSERT INTO sessions (id, user_id) VALUES (?,?)').run(id, userId);
  return id;
}
