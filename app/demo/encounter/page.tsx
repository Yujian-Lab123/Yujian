'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EncounterHub, { type EncounterCard } from '@/app/encounter/EncounterHub';
import { useDemoMe } from '@/lib/experience-mode/useDemoMe';

/** 演示相遇首页：与真实页共用布局，但仅使用 /api/demo/** 的预置身份与候选池。 */
export default function DemoEncounterPage() {
  const router = useRouter();
  const me = useDemoMe();
  const [cards, setCards] = useState<EncounterCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await fetch('/api/demo/encounters', { cache: 'no-store' });
      if (response.status === 401) { router.replace('/demo'); return; }
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'load failed');
      setCards(Array.isArray(data.encounters) ? data.encounters : []);
    } catch {
      setLoadError('暂时没能整理出演示相遇方向，请稍后再试。');
    } finally {
      setLoaded(true);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <EncounterHub
        mode="demo"
        cards={cards}
        loading={!loaded || me.loading}
        error={loadError || me.error || ''}
        profileReady={Boolean(me.understanding)}
        currentState={me.currentState}
        started={true}
        onStart={() => void load()}
        onRetry={() => void load()}
      />
      <div className="bg-[#fbf8f1] px-5 pb-12 text-center">
        <Link href="/demo/content" className="text-xs text-[#1769d7] underline underline-offset-4">浏览已授权的真实答主内容样本</Link>
      </div>
    </>
  );
}
