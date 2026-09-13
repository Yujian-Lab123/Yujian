import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import type { RecCard } from '@/lib/retrieval/contracts';

/**
 * 候选池模式隔离：真实推荐池绝不出现 Mock 用户（真实路由不展示演示数据），
 * 演示推荐池绝不出现真实用户（演示路由不暴露真实用户）。匹配算法层不感知模式，
 * 隔离在 API 出口统一执行。
 */
export async function filterPoolByMode(cards: RecCard[], mode: 'real' | 'demo'): Promise<RecCard[]> {
  if (cards.length === 0) return cards;
  const rows = await db.select({ id: users.id, isMock: users.isMock }).from(users);
  const mockIds = new Set(rows.filter((row) => row.isMock).map((row) => row.id));
  return cards.filter((card) => (mode === 'demo' ? mockIds.has(card.target.id) : !mockIds.has(card.target.id)));
}
