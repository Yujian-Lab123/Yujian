function normalize(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

/**
 * “认识偏好”是推荐前的筛选条件，不是针对某个具体人的意愿。
 * 任一方尚未填写偏好时保持开放，避免新用户永远没有候选人。
 */
export function areIntentsCompatible(viewerValues: readonly string[], targetValues: readonly string[]): boolean {
  const viewer = normalize(viewerValues);
  const target = normalize(targetValues);
  if (viewer.size === 0 || target.size === 0) return true;
  return [...viewer].some((value) => target.has(value));
}

/**
 * 返回推荐前的“偏好兼容度”。0.6 表示信息不足，而不是虚构成完全匹配。
 */
export function intentCompatibilityScore(viewerValues: readonly string[], targetValues: readonly string[]): number {
  const viewer = normalize(viewerValues);
  const target = normalize(targetValues);
  if (viewer.size === 0 || target.size === 0) return 0.6;
  const intersection = [...viewer].filter((value) => target.has(value)).length;
  if (intersection === 0) return 0;
  const union = new Set([...viewer, ...target]).size;
  return 0.5 + 0.5 * (intersection / union);
}
