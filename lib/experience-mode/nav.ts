/** 导航模式解析（纯函数，可测试）：
 * /demo/** 下全部导航保持 /demo 前缀（路由隔离），且演示导航不出现真实专属入口。
 */

export const REAL_NAV: ReadonlyArray<readonly [string, string]> = [
  ['我', '/profile'],
  ['此刻', '/me'],
  ['侧面', '/side'],
  ['遇见', '/encounter'],
  ['画像长廊', '/gallery'],
  ['关于遇见', '/about'],
];

export const DEMO_NAV: ReadonlyArray<readonly [string, string]> = [
  ['我', '/demo/profile'],
  ['此刻', '/demo/me'],
  ['侧面', '/demo/side'],
  ['遇见', '/demo/encounter'],
  ['内容样本', '/demo/content'],
  ['演示说明', '/demo'],
];

export interface ResolvedNav {
  isDemo: boolean;
  items: ReadonlyArray<readonly [string, string]>;
}

export function isDemoPathname(pathname: string | null | undefined): boolean {
  const path = pathname || '/';
  return path === '/demo' || path.startsWith('/demo/');
}

export function resolveNav(pathname: string | null | undefined): ResolvedNav {
  const isDemo = isDemoPathname(pathname);
  return { isDemo, items: isDemo ? DEMO_NAV : REAL_NAV };
}

/** 判断导航项是否激活：遇见项按前缀匹配，其余精确匹配。 */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || (href.endsWith('/encounter') && pathname.startsWith(href));
}
