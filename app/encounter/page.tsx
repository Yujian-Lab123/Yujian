'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EncounterHub, { type EncounterCard } from './EncounterHub';
import { useMe } from '@/lib/useMe';

/** 真实相遇首页：只读取真实会话和 /api/encounters，绝不回退到 Mock 数据。 */
export default function EncounterPage() {
  const router = useRouter();
  const me = useMe();
  const [cards, setCards] = useState<EncounterCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoaded(false);
    setLoadError('');
    try {
      const response = await fetch('/api/encounters', { cache: 'no-store' });
      const data = await response.json();
      if (data.loginRequired) {
        router.replace('/about');
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || 'load failed');
      setCards(Array.isArray(data.encounters) ? data.encounters : []);
    } catch {
      setLoadError('暂时没能整理出新的相遇方向，请稍后再试。');
    } finally {
      setLoaded(true);
    }
  }, [router]);

  const start = useCallback(() => {
    if (started) return;
    setStarted(true);
    void load();
  }, [load, started]);

  return (
    <EncounterHub
      mode="real"
      cards={cards}
      loading={me.loading || (started && !loaded)}
      error={loadError || me.error || ''}
      profileReady={Boolean(me.understanding)}
      currentState={me.currentState}
      started={started}
      onStart={start}
      onRetry={() => void load()}
    />
  );
}
