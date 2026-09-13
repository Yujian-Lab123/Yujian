/**
 * Demo 身份选择（纯函数，可测试）。
 *
 * 安全要求：客户端不得指定 userId（防止任意切换人物 / 伪装他人）。
 * 演示身份由服务端从 Mock 用户池中确定性轮换：
 * - 同一天内所有访客看到同一个演示身份（便于讲解与录屏对齐）；
 * - 跨天轮换，避免每次演示永远是同一个人。
 */

export interface MockIdentityCandidate {
  id: string;
  is_mock: number | boolean;
}

export function filterMockUsers(rows: MockIdentityCandidate[]): MockIdentityCandidate[] {
  return rows.filter((row) => Number(row.is_mock) === 1);
}

/** 按 UTC 日期序号在 Mock 池中确定性轮换选人；池为空返回 null。 */
export function pickDemoIdentity(mockUsers: MockIdentityCandidate[], now: Date = new Date()): string | null {
  const pool = filterMockUsers(mockUsers);
  if (pool.length === 0) return null;
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  return pool[dayIndex % pool.length].id;
}
