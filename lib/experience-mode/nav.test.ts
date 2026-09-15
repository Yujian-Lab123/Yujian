import { describe, expect, it } from 'vitest';
import { resolveNav, isDemoPathname, isNavItemActive, DEMO_NAV, REAL_NAV } from './nav';

/** 路由与导航隔离：/demo/** 下导航必须整体切换且保持 /demo 前缀。 */
describe('experience-mode navigation isolation', () => {
  it('real routes resolve to the real nav', () => {
    for (const path of ['/', '/profile', '/me', '/side', '/encounter', '/encounter/rec-1', '/about']) {
      const resolved = resolveNav(path);
      expect(resolved.isDemo).toBe(false);
      expect(resolved.items).toBe(REAL_NAV);
    }
  });

  it('demo routes resolve to the demo nav', () => {
    for (const path of ['/demo', '/demo/', '/demo/profile', '/demo/me', '/demo/encounter', '/demo/encounter/rec-1', '/demo/connections']) {
      const resolved = resolveNav(path);
      expect(resolved.isDemo).toBe(true);
      expect(resolved.items).toBe(DEMO_NAV);
    }
  });

  it('every demo nav link keeps the /demo prefix', () => {
    for (const [, href] of DEMO_NAV) {
      expect(href.startsWith('/demo')).toBe(true);
    }
  });

  it('demo nav never links to real-only routes and vice versa', () => {
    const demoHrefs = DEMO_NAV.map(([, href]) => href);
    const realHrefs = REAL_NAV.map(([, href]) => href);
    expect(demoHrefs).not.toContain('/profile');
    expect(demoHrefs).not.toContain('/me');
    expect(demoHrefs).not.toContain('/side');
    expect(demoHrefs).not.toContain('/encounter');
    expect(demoHrefs).not.toContain('/gallery');
    expect(demoHrefs).not.toContain('/about');
    expect(demoHrefs).not.toContain('/demo/content');
    expect(realHrefs).not.toContain('/demo/profile');
    expect(realHrefs).not.toContain('/demo/encounter');
  });

  it('isDemoPathname guards edge cases', () => {
    expect(isDemoPathname('/demo')).toBe(true);
    expect(isDemoPathname('/demo/anything')).toBe(true);
    expect(isDemoPathname('/democracy')).toBe(false); // 前缀不得误伤相似路径
    expect(isDemoPathname(null)).toBe(false);
    expect(isDemoPathname(undefined)).toBe(false);
  });

  it('encounter nav item is prefix-active', () => {
    expect(isNavItemActive('/encounter', '/encounter')).toBe(true);
    expect(isNavItemActive('/encounter', '/encounter/rec-1')).toBe(true);
    expect(isNavItemActive('/profile', '/profile')).toBe(true);
    expect(isNavItemActive('/profile', '/me')).toBe(false);
  });
});
