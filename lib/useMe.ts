'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface MeState {
  loading: boolean;
  loggedIn: boolean;
  user: any;
  understanding: any;
  currentState: { text: string; mood: string; created_at: string } | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMe(): MeState {
  const [state, setState] = useState<Omit<MeState, 'error' | 'refresh'>>({
    loading: true, loggedIn: false, user: null, understanding: null, currentState: null,
  });
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
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
  }, []);
  useEffect(() => { void refresh().catch(() => {}); return () => { requestId.current += 1; }; }, [refresh]);
  return { ...state, error, refresh };
}
