import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// ============ 知乎 Provider：真实 OAuth（P2） ============
// 协议依据 zhihu-hackathon/references/{oauth-boundary,deployment-credentials}.md 与官方 hello-world-oauth 脚手架：
// - 授权：GET openapi.zhihu.com/authorize?redirect_uri&app_id&response_type=code&state
// - 换 Token：POST openapi.zhihu.com/access_token，表单 app_id/app_key/grant_type=authorization_code/redirect_uri/code
//   （回调参数实测为 authorization_code，此处兼容 code；grant_type 是固定枚举值，不从回调读取）
// - 用户接口：GET developer.zhihu.com/api/v1/...，双凭证头：
//   Authorization: Bearer <开放平台 Access Secret> + X-OAuth-Token: <OAuth access_token>
// 已知协议缺口（官方记录）：回调可能不返回 state；无 PKCE / refresh token / 撤销。仅作黑客松联调基线。
// 三类凭证严格分开：ZHIHU_APP_ID（公开）≠ ZHIHU_OAUTH_APP_KEY（换 Token）≠ ZHIHU_ACCESS_SECRET（调接口）。

export const AUTHORIZE_URL = 'https://openapi.zhihu.com/authorize';
export const TOKEN_URL = 'https://openapi.zhihu.com/access_token';
export const OPEN_PROFILE_URL = 'https://openapi.zhihu.com/user';
export const DEVELOPER_API = 'https://developer.zhihu.com';

export interface ZhihuCredentials { appId: string; appKey: string; accessSecret: string; redirectUri: string }

export function zhihuCredentials(): ZhihuCredentials {
  return {
    appId: process.env.ZHIHU_APP_ID || '',
    appKey: process.env.ZHIHU_OAUTH_APP_KEY || '',
    accessSecret: process.env.ZHIHU_ACCESS_SECRET || '',
    redirectUri: process.env.ZHIHU_REDIRECT_URI || '',
  };
}

export function zhihuConfigured(): boolean {
  const c = zhihuCredentials();
  return Boolean(c.appId && c.appKey && c.accessSecret && c.redirectUri && process.env.TOKEN_ENCRYPTION_KEY);
}

export function newOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

export function stateEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- 脱敏诊断（上线前核对 + 线上排障；绝不输出完整密钥/授权码/Token，概览安全红线） ----

function fingerprint(value: string): string | null {
  return value ? createHash('sha256').update(value).digest('hex').slice(0, 12) : null;
}

export interface CredentialDiag {
  source: string; configured: boolean; length: number; sha256Prefix: string | null;
}

export function credentialDiagnostics() {
  const c = zhihuCredentials();
  return {
    appId: { configured: Boolean(c.appId), value: c.appId },
    appKey: {
      source: process.env.ZHIHU_OAUTH_APP_KEY ? 'env:ZHIHU_OAUTH_APP_KEY' : 'missing',
      configured: Boolean(c.appKey), length: c.appKey.length, sha256Prefix: fingerprint(c.appKey),
    } as CredentialDiag,
    accessSecret: {
      source: process.env.ZHIHU_ACCESS_SECRET ? 'env:ZHIHU_ACCESS_SECRET' : 'missing',
      configured: Boolean(c.accessSecret), length: c.accessSecret.length, sha256Prefix: fingerprint(c.accessSecret),
    } as CredentialDiag,
    redirectUri: c.redirectUri || null,
  };
}

/** 凭证误填检查（deployment-credentials.md：App ID ≠ App Key ≠ Access Secret） */
export function credentialWarnings(): { code: string; message: string }[] {
  const d = credentialDiagnostics();
  const warnings: { code: string; message: string }[] = [];
  if (d.appKey.configured && d.appKey.length <= 8) {
    warnings.push({ code: 'APP_KEY_TOO_SHORT', message: 'ZHIHU_OAUTH_APP_KEY 看起来过短，请确认没有填成 App ID。' });
  }
  if (d.appKey.configured && d.appKey.sha256Prefix && d.appKey.sha256Prefix === fingerprint(String(zhihuCredentials().appId))) {
    warnings.push({ code: 'APP_ID_USED_AS_APP_KEY', message: 'OAuth app_key 看起来等于 App ID。' });
  }
  if (d.appKey.configured && d.accessSecret.configured && d.appKey.sha256Prefix === d.accessSecret.sha256Prefix) {
    warnings.push({ code: 'APP_KEY_USED_AS_ACCESS_SECRET', message: 'ZHIHU_ACCESS_SECRET 看起来等于 OAuth App Key。' });
  }
  if (zhihuConfigured() && !d.redirectUri?.startsWith('https://')) {
    warnings.push({ code: 'REDIRECT_NOT_HTTPS', message: '回调地址必须为公网 HTTPS，本地地址无法完成知乎登录。' });
  }
  const c = zhihuCredentials();
  if (c.appId && c.appKey && c.accessSecret && c.redirectUri && !process.env.TOKEN_ENCRYPTION_KEY) {
    warnings.push({ code: 'TOKEN_KEY_MISSING', message: '缺少 TOKEN_ENCRYPTION_KEY，OAuth token 无法安全落库。' });
  }
  return warnings;
}

// ---- 最近一次授权交换的脱敏调试记录（供 /api/auth/zhihu/status 排障） ----

export interface OAuthDebug {
  at: string; stage: string; failedStage?: string; error?: string;
  codeReceived?: boolean; codeLength?: number;
  tokenExchange?: Record<string, unknown>;
  stateReturned?: boolean; stateVerified?: boolean;
  profileFetched?: boolean; contentsFetched?: boolean;
}

export let lastOAuthDebug: OAuthDebug | null = null;

export function recordDebug(patch: Partial<OAuthDebug>) {
  lastOAuthDebug = { ...(lastOAuthDebug || { at: new Date().toISOString(), stage: 'init' }), ...patch, at: new Date().toISOString() };
}

export function resetDebug() {
  lastOAuthDebug = { at: new Date().toISOString(), stage: 'authorize_started' };
}

// ---- 授权链接 ----

export function authorizeUrl(state: string): string {
  const { appId, redirectUri } = zhihuCredentials();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

// ---- Token 交换 ----

function nested(payload: any, key: string): any {
  return payload?.[key] ?? payload?.data?.[key] ?? payload?.Data?.[key];
}

export interface TokenResult { accessToken: string; expiresIn: number | null }

export async function exchangeToken(code: string): Promise<TokenResult> {
  const { appId, appKey, redirectUri } = zhihuCredentials();
  const form = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  }).toString();
  recordDebug({ stage: 'token_exchange_started', codeReceived: true, codeLength: code.length });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await res.json().catch(() => null);
  const token = nested(payload, 'access_token');
  if (!res.ok || !token) {
    const message = payload?.message || payload?.error_description || payload?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(`未获得 OAuth access token：${String(message).slice(0, 200)}`), { code: 'TOKEN_EXCHANGE_FAILED' });
  }
  const expiresInRaw = nested(payload, 'expires_in');
  const expiresIn = Number.isFinite(Number(expiresInRaw)) ? Number(expiresInRaw) : null;
  recordDebug({ stage: 'token_exchange_succeeded' });
  return { accessToken: String(token), expiresIn };
}

// ---- 开放平台用户接口（双凭证头） ----

function userHeaders(accessToken: string): HeadersInit {
  const { accessSecret } = zhihuCredentials();
  return {
    Authorization: `Bearer ${accessSecret}`,
    'X-OAuth-Token': accessToken,
    'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    'Content-Type': 'application/json',
  };
}

export interface ZhihuProfile {
  zhihuUserId: string; name: string; avatarUrl: string | null;
  headline: string | null; profileUrl: string | null;
}

/** /user 无正式响应 schema（官方记录），字段取实测并做多形态兼容 */
export async function fetchZhihuProfile(accessToken: string): Promise<ZhihuProfile> {
  const res = await fetch(OPEN_PROFILE_URL, { headers: userHeaders(accessToken), signal: AbortSignal.timeout(20_000) });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(`获取知乎用户信息失败：HTTP ${res.status}`), { code: 'PROFILE_FAILED' });
  const source = payload?.data || payload?.Data || payload?.user || payload;
  const name = source?.name || source?.Fullname || source?.fullname || '';
  const profileUrl = source?.url || source?.Url || null;
  // 稳定 ID：个人主页 URL 的 url_token（/people/<url_token>），拿不到则退回昵称
  const urlToken = profileUrl ? String(profileUrl).split('/people/')[1]?.split(/[/?]/)[0] : '';
  const zhihuUserId = urlToken || String(name) || `anon-${createHash('sha256').update(accessToken).digest('hex').slice(0, 8)}`;
  return {
    zhihuUserId,
    name: String(name || '知乎用户'),
    avatarUrl: source?.avatar_url || source?.AvatarUrl || null,
    headline: source?.headline || source?.Headline || null,
    profileUrl,
  };
}

/** 创作内容接口（P3 实测入口；P2 先取回原始 Items 存档） */
export async function fetchZhihuContents(accessToken: string, limit = 20): Promise<{ ok: boolean; items: any[]; message?: string }> {
  try {
    const qs = new URLSearchParams({ Limit: String(limit), ContentType: 'all', Offset: '0', SortField: 'ts', SortOrder: 'desc' });
    const res = await fetch(`${DEVELOPER_API}/api/v1/user/contents?${qs}`, {
      headers: userHeaders(accessToken), signal: AbortSignal.timeout(20_000),
    });
    const payload = await res.json().catch(() => null);
    if (payload?.Code !== 0 && payload?.code !== 0) {
      const message = payload?.Message || payload?.message || `HTTP ${res.status}`;
      return { ok: false, items: [], message: String(message).slice(0, 200) };
    }
    const data = payload?.Data || payload?.data || {};
    const items = Array.isArray(data?.Items) ? data.Items : Array.isArray(data) ? data : [];
    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, items: [], message: String(e?.message || e).slice(0, 200) };
  }
}
