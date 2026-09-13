import { redirect } from 'next/navigation';

/**
 * 根路径 `/` 只负责跳转，不再承载产品介绍。
 *
 * 旧 Landing 的理念、隐私说明与登录入口统一收在 `/about`（见 docs/USER_FLOW.md）。
 * 用服务端 redirect 而不是页面内跳转，保证直接访问 `/` 不会有闪烁，也不需要额外的客户端 JS。
 */
export default function RootPage() {
  redirect('/about');
}
