'use client';
import { useCallback, useEffect, useState } from 'react';

export interface MeState {
  loading: boolean;
  loggedIn: boolean;
  user: any;
  understanding: any;
  currentState: any;
  refresh: () => void;
}

export function useMe(): MeState {
  const [state, setState] = useState<{ loading: boolean; loggedIn: boolean; user: any; understanding: any; currentState: any }>({
    loading: true, loggedIn: false, user: null, understanding: null, currentState: null,
  });
  const refresh = useCallback(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => {
      setState({ loading: false, loggedIn: d.ok, user: d.user || null, understanding: d.understanding || null, currentState: d.currentState || null });
    }).catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}
