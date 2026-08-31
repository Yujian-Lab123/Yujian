import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { computeUserVectors } from '@/lib/db';
import { saveZhihuAuth, upsertRealUser } from '@/lib/db/users';
import { createSession, OAUTH_STATE_COOKIE, SESSION_COOKIE } from '@/lib/session';
import {
  exchangeToken, fetchZhihuContents, fetchZhihuProfile, lastOAuthDebug,
  recordDebug, stateEqual, zhihuConfigured,
} from '@/lib/providers/zhihu';

function fail(origin: string, errorCode: string) {
  recordDebug({ failedStage: lastOAuthDebug?.stage || 'unknown', error: errorCode });
  return NextResponse.redirect(new URL(`/?oauth=error&reason=${encodeURIComponent(errorCode)}`, origin));
}

// GET /api/auth/callback?authorization_code=...&state=...
// 官方实测：回调参数为 authorization_code（兼容 code）；可能不返回 state，缺失时不中断、只标记未校验。
export async function GET(req: Request) {
  const origin = process.env.APP_ORIGIN || new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get('authorization_code') || url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (!zhihuConfigured()) return fail(origin, 'not_configured');
  if (!code) return fail(origin, 'code_missing');

  const stateCookie = (await cookies()).get(OAUTH_STATE_COOKIE)?.value || null;
  if (returnedState) {
    if (!stateEqual(returnedState, stateCookie)) return fail(origin, 'state_mismatch');
    recordDebug({ stateReturned: true, stateVerified: true });
  } else {
    recordDebug({ stateReturned: false, stateVerified: false });
  }

  try {
    recordDebug({
      stage: 'token_exchange_started',
      tokenExchange: {
        url: 'https://openapi.zhihu.com/access_token', method: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        grantType: 'authorization_code', codeField: 'code', codeLength: code.length,
      },
    });
    const { accessToken, expiresIn } = await exchangeToken(code);

    recordDebug({ stage: 'profile_fetch_started' });
    const profile = await fetchZhihuProfile(accessToken);
    const userId = upsertRealUser(profile);

    // P3 实测入口：尽力拉取创作内容原文存档；失败不阻断登录
    recordDebug({ stage: 'contents_fetch_started' });
    const contents = await fetchZhihuContents(accessToken, 20);
    recordDebug({ stage: 'authorized', profileFetched: true, contentsFetched: contents.ok });

    saveZhihuAuth(
      userId, profile.zhihuUserId, accessToken,
      expiresIn ? Date.now() + expiresIn * 1000 : null,
      { ...profile }, contents.ok ? JSON.stringify(contents.items).slice(0, 500_000) : null,
    );
    computeUserVectors(userId);

    const res = NextResponse.redirect(new URL('/onboarding?src=zhihu', origin));
    res.cookies.set(SESSION_COOKIE, createSession(userId), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (e: any) {
    recordDebug({ failedStage: lastOAuthDebug?.stage || 'unknown', error: String(e?.message || e).slice(0, 200) });
    return fail(origin, String(e?.code || 'oauth_failed'));
  }
}
