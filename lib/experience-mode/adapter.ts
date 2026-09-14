// ============ 体验模式适配器 ============
// 真实模式与演示模式的唯一差异面：身份、API 前缀、路由前缀与文案。
// 页面主体（Screen 组件）必须复用同一份，只允许通过本适配器切换模式，
// 避免再次出现 /demo/** 手写简化页面导致的视觉与交互漂移。

export type ExperienceMode = 'real' | 'demo';

export interface ExperienceAdapter {
  mode: ExperienceMode;
  /** 该模式所有业务 API 的前缀 */
  apiBase: '/api' | '/api/demo';
  /** 该模式所有页面路由的前缀 */
  routeBase: '' | '/demo';
  /** 会话失效/未进入时统一跳转的出口 */
  loginRoute: '/about' | '/demo';
}

export const EXPERIENCE_ADAPTERS: Record<ExperienceMode, ExperienceAdapter> = {
  real: {
    mode: 'real',
    apiBase: '/api',
    routeBase: '',
    loginRoute: '/about',
  },
  demo: {
    mode: 'demo',
    apiBase: '/api/demo',
    routeBase: '/demo',
    loginRoute: '/demo',
  },
};

/** 拼接当前模式的业务 API 地址，如 apiUrl(adapter, '/me/current-state')。 */
export function apiUrl(adapter: ExperienceAdapter, path: string): string {
  return `${adapter.apiBase}${path}`;
}

/** 拼接当前模式的页面路由，如 modeRoute(adapter, '/onboarding')。 */
export function modeRoute(adapter: ExperienceAdapter, path: string): string {
  return `${adapter.routeBase}${path}`;
}
