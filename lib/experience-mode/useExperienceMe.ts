'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExperienceAdapter } from './adapter';

export interface ExperienceMeState {
  loading: boolean;
  loggedIn: boolean;
  user: any;
  understanding: any;
  currentState: { text: string; mood: string; created_at: string } | null;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 统一的身份 hook：真实 / 演示共用同一套加载、401、轮换请求保护逻辑，
 * 只按适配器切换 API 前缀。useMe / useDemoMe 均为本函数的薄包装，
 * 保证既有调用方（encounter/side 等页面）零改动。
 */
export function useExperienceMe(adapter: ExperienceAdapter): ExperienceMeState {
  const [state, setState] = useState<Omit<ExperienceMeState, 'error' | 'refresh'>>({
    loading: true, loggedIn: false, user: null, understanding: null, currentState: null,
  });
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const response = await fetch(`${adapter.apiBase}/me`, { cache: 'no-store' });
      if (id !== requestId.current) return;
      if (response.status === 401) {
        setState({ loading: false, loggedIn: false, user: null, understanding: null, currentState: null });
        setError(null);
        return;
      }
      const d = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok || !d?.ok || !d.user?.id) throw new Error(d?.error || '加载失败，请重试');
      setState({ loading: false, loggedIn: true, user: d.user || null, understanding: d.understanding || null, currentState: d.currentState || null });
      setError(null);
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : '网络异常，请重试');
      setState((previous) => ({ ...previous, loading: false }));
      throw cause;
    }
  }, [adapter.apiBase]);
  useEffect(() => { void refresh().catch(() => {}); return () => { requestId.current += 1; }; }, [refresh]);
  return { ...state, error, refresh };
}
