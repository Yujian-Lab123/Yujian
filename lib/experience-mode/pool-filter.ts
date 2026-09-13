/** 候选池模式隔离（纯函数，零依赖，可测试）：
 * 真实推荐池绝不出现 Mock 用户（真实路由不展示演示数据），
 * 演示推荐池绝不出现真实用户（演示路由不暴露真实用户）。
 */
export function filterCardsByMockIds<T extends { target: { id: string } }>(
  cards: T[],
  mockIds: Set<string>,
  mode: 'real' | 'demo',
): T[] {
  return cards.filter((card) => (mode === 'demo' ? mockIds.has(card.target.id) : !mockIds.has(card.target.id)));
}
