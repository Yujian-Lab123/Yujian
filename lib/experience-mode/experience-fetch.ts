'use client';
import { apiUrl, type ExperienceAdapter } from './adapter';

/**
 * 统一的业务请求入口。
 *
 * 演示模式遇到 401 时，静默重进演示（POST /api/auth/demo，免交互、服务端按日期
 * 确定性轮换身份）并重试一次请求——演示会话过期对用户应当无感，避免"频繁要求登录"。
 * 重进失败（演示关闭 / 池为空 / 网络异常）时原样返回 401 响应，由调用方走统一的
 * 会话失效出口。
 *
 * 真实模式不做自动恢复：重新登录必须走知乎 OAuth，直接交给上层跳转 /about。
 */
export async function experienceFetch(adapter: ExperienceAdapter, path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(apiUrl(adapter, path), init);
  if (adapter.mode !== 'demo' || response.status !== 401) return response;
  try {
    const reentered = await fetch('/api/auth/demo', { method: 'POST' });
    if (!reentered.ok) return response;
  } catch {
    return response;
  }
  return fetch(apiUrl(adapter, path), init);
}
