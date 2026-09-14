'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 演示模式版 useMe：只请求 /api/demo/**，永远不触达真实会话数据。 */
export interface DemoMeState {
  loading: boolean;
  loggedIn: boolean;
  user: any;
  understanding: any;
  currentState: { text: string; mood: string; created_at: string } | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDemoMe(): DemoMeState {
  const [state, setState] = useState<Omit<DemoMeState, 'error' | 'refresh'>>({
    loading: true, loggedIn: false, user: null, understanding: null, currentState: null,
  });
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const response = await fetch('/api/demo/me', { cache: 'no-store' });
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
    }
  }, []);
  useEffect(() => { void refresh().catch(() => {}); return () => { requestId.current += 1; }; }, [refresh]);
  return { ...state, error, refresh };
}
