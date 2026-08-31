import { getDb } from './index';

export interface UserRow {
  id: string; zhihu_user_id: string; name: string; role: string; city: string; quote: string;
  tags: string[]; intents: string[]; zhihu_years: number; upvotes: string;
  encounter_enabled: number; auto_reciprocate: number; is_mock: number;
}

function mapUser(r: any): UserRow {
  return {
    id: r.id, zhihu_user_id: r.zhihu_user_id, name: r.name, role: r.role, city: r.city, quote: r.quote,
    tags: JSON.parse(r.tags || '[]'), intents: JSON.parse(r.intents || '[]'),
    zhihu_years: r.zhihu_years, upvotes: r.upvotes,
    encounter_enabled: r.encounter_enabled, auto_reciprocate: r.auto_reciprocate, is_mock: r.is_mock,
  };
}

export function getUser(id: string): UserRow | null {
  const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  return r ? mapUser(r) : null;
}

export function listUsers(): UserRow[] {
  return (getDb().prepare('SELECT * FROM users ORDER BY id').all() as any[]).map(mapUser);
}

export function setEncounterEnabled(id: string, enabled: boolean) {
  getDb().prepare('UPDATE users SET encounter_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}
