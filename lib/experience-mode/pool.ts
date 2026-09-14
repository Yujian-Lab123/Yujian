import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import type { RecCard } from '@/lib/retrieval/contracts';
import { filterCardsByMockIds } from './pool-filter';

export { filterCardsByMockIds };

/** API 出口统一执行池隔离（匹配算法层不感知模式）。 */
export async function filterPoolByMode(cards: RecCard[], mode: 'real' | 'demo'): Promise<RecCard[]> {
  if (cards.length === 0) return cards;
  const rows = await db.select({ id: users.id, isMock: users.isMock }).from(users);
  const mockIds = new Set(rows.filter((row) => row.isMock).map((row) => row.id));
  return filterCardsByMockIds(cards, mockIds, mode);
}
