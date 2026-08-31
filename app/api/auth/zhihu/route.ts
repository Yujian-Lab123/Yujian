import { NextResponse } from 'next/server';
import { authorizeUrl, newOAuthState, recordDebug, zhihuConfigured } from '@/lib/providers/zhihu';
import { OAUTH_STATE_COOKIE } from '@/lib/session';

// P2 真实知乎 OAuth：重定向到知乎授权页。
// 回调地址必须是开放平台登记的公网 HTTPS（本地 localhost 只能预览，无法完成登录）。
export async function GET(req: Request) {
  const origin = process.env.APP_ORIGIN || new URL(req.url).origin;
  if (!zhihuConfigured()) {
    return NextResponse.redirect(new URL('/?oauth=error&reason=not_configured', origin));
  }
  const state = newOAuthState();
  recordDebug({ stage: 'authorize_started' });
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
