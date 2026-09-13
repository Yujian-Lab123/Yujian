/** 画像页空状态选择（纯函数，可测试）：
 * 真实路由的空状态必须产品化——按访客状态给出下一步引导，不出现开发口吻文案或白屏。
 */
export type ProfileEmptyState = 'demo-visitor' | 'real-pending' | 'guest';

export function resolveProfileEmptyState(input: {
  hasArtifact: boolean;
  loggedIn: boolean;
  demoSession: boolean;
}): ProfileEmptyState | null {
  if (input.hasArtifact) return null;
  if (input.demoSession) return 'demo-visitor';
  if (input.loggedIn) return 'real-pending';
  return 'guest';
}
