/** 画像页空状态选择（纯函数，可测试）：
 * 真实路由的空状态必须产品化——按访客状态给出下一步引导，不出现开发口吻文案或白屏。
 */
export type ProfileEmptyState = 'demo-visitor' | 'real-understanding-ready' | 'real-pending' | 'guest';

export function resolveProfileEmptyState(input: {
  hasArtifact: boolean;
  hasUnderstanding: boolean;
  loggedIn: boolean;
  demoSession: boolean;
}): ProfileEmptyState | null {
  if (input.hasArtifact) return null;
  if (input.demoSession) return 'demo-visitor';
  // “可用于相遇的长期理解”与“可视化证据画像产物”是两条不同的管线。
  // 已有向量时不能继续显示“生成中”，否则会把用户送回每次重播的 onboarding 动画。
  if (input.loggedIn && input.hasUnderstanding) return 'real-understanding-ready';
  if (input.loggedIn) return 'real-pending';
  return 'guest';
}
