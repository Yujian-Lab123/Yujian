import { describe, expect, it } from 'vitest';
import { resolveProfileEmptyState } from './empty-state';

/** 空状态：真实路由无数据时必须产品化引导，绝不白屏或使用开发口吻。 */
describe('experience-mode profile empty state', () => {
  it('hasArtifact wins over everything', () => {
    expect(resolveProfileEmptyState({ hasArtifact: true, hasUnderstanding: false, loggedIn: false, demoSession: true })).toBeNull();
    expect(resolveProfileEmptyState({ hasArtifact: true, hasUnderstanding: true, loggedIn: true, demoSession: false })).toBeNull();
  });

  it('demo visitor gets guidance back to demo mode', () => {
    expect(resolveProfileEmptyState({ hasArtifact: false, hasUnderstanding: false, loggedIn: false, demoSession: true })).toBe('demo-visitor');
  });

  it('keeps understanding readiness separate from a full profile artifact', () => {
    expect(resolveProfileEmptyState({ hasArtifact: false, hasUnderstanding: true, loggedIn: true, demoSession: false })).toBe('real-understanding-ready');
  });

  it('only a user without understanding gets pending guidance', () => {
    expect(resolveProfileEmptyState({ hasArtifact: false, hasUnderstanding: false, loggedIn: true, demoSession: false })).toBe('real-pending');
  });

  it('guest gets the dual-entry guidance', () => {
    expect(resolveProfileEmptyState({ hasArtifact: false, hasUnderstanding: false, loggedIn: false, demoSession: false })).toBe('guest');
  });

  it('demo session takes precedence when both cookies exist', () => {
    // 同时携带真实与演示 Cookie 时，真实路由因真实会话有效不会走空状态；
    // 若真实会话无效而演示会话有效，则必须按演示访客引导（不展示真实数据，也不误导去登录）。
    expect(resolveProfileEmptyState({ hasArtifact: false, hasUnderstanding: false, loggedIn: false, demoSession: true })).toBe('demo-visitor');
  });
});
