export const CURRENT_STATE_TTL_HOURS = 72;
export const CURRENT_STATE_TTL_MS = CURRENT_STATE_TTL_HOURS * 60 * 60 * 1000;

export function currentStateExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + CURRENT_STATE_TTL_MS);
}

/** null 是旧数据兼容值；新状态均会写入明确的 expiresAt。 */
export function isCurrentStateActive(expiresAt: Date | null, now = new Date()): boolean {
  return expiresAt === null || expiresAt.getTime() > now.getTime();
}

