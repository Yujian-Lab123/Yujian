'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import { useMe } from '@/lib/useMe';
import PresentSelfForm from './PresentSelfForm';

const DEMO_IDS = [
  ['u0', '江树 · 产品经理（默认）'],
  ['u1', '远山与近海 · 研究员'],
  ['u3', '阿屿 · 户外领队'],
  ['u6', '老猫 · 价值投资者'],
];

export default function MePage() {
  const router = useRouter();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function toggle() {
    if (busy || saving || me.error) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/me/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: me.user?.encounter_enabled !== 1 }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.loginRequired ? '登录已失效，请重新登录。' : result.error || '更新失败，请重试。');
      try {
        await me.refresh();
        setMessage('连接意愿已更新。');
      } catch {
        setError('连接意愿已保存，但最新状态加载失败，请先重试加载。');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络异常，请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function switchUser(userId: string) {
    if (busy || saving) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/demo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '切换身份失败，请重试。');
      router.push('/onboarding');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络异常，请重试。');
      setBusy(false);
    }
  }

  if (me.loading) return <main className="min-h-screen bg-paper-100 px-6 pt-24 text-center" role="status">正在加载此刻的你…</main>;

  if (!me.loggedIn) return <main className="min-h-screen bg-paper-100 px-6 pt-24 text-center">
    {me.error ? <>
      <p role="alert" className="text-sumi-600">{me.error}</p>
      <button className="mt-4 text-ink-600 underline" onClick={() => { void me.refresh().catch(() => {}); }}>重新加载</button>
    </> : <>
      <h1 className="font-display text-3xl text-ink-800">记录此刻的自己</h1>
      <p className="mt-4 text-sumi-500">登录后，可以记录心情、当下想法和连接意愿。</p>
      <button className="mt-4 text-ink-600 underline" onClick={() => router.push('/')}>去首页登录</button>
    </>}
  </main>;

  return <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
    <InkScene tone="warm" side="both" />
    <Nav tone="warm" tagline="知乎孵化的人际连接产品" />
    {me.error && <div role="alert" className="relative z-10 mx-auto mb-4 max-w-6xl px-6 text-sm text-red-700">
      最新状态加载失败：{me.error} <button className="underline" onClick={() => { void me.refresh().catch(() => {}); }}>重试</button>
    </div>}
    <section className="relative z-10 mx-auto grid max-w-6xl items-start gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-2">
      <PresentSelfForm key={me.user.id} currentState={me.currentState} onSaved={me.refresh}
        disabled={busy} onSavingChange={setSaving} />
      <div className="card-warm fade-up-1 min-w-0 p-6 md:p-10">
        <h2 className="font-display text-3xl text-ink-800">连接意愿</h2>
        <p className="mt-3 text-sm leading-6 text-sumi-500">此刻想认识新朋友吗？你可以随时调整。</p>
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-paper-300 bg-white/50 p-4">
          <div className="min-w-0">
            <p id="encounter-label" className="text-sm text-sumi-700">{me.user.encounter_enabled === 1 ? '愿意遇见新朋友' : '暂时想独处'}</p>
            <p className="mt-2 text-xs leading-5 text-sumi-500">开启后，为你推荐可能聊得来的人。开关立即保存。</p>
          </div>
          <button type="button" role="switch" aria-checked={me.user.encounter_enabled === 1} aria-labelledby="encounter-label"
            disabled={busy || saving || Boolean(me.error)} onClick={toggle}
            className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${me.user.encounter_enabled === 1 ? 'bg-ink-700' : 'bg-paper-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${me.user.encounter_enabled === 1 ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <p role="status" className="mt-3 text-sm text-ink-700">{busy ? '正在更新…' : message}</p>
        <div className="mt-6 rounded-xl border border-paper-300 bg-white/50 p-5">
          <h3 className="text-sm text-sumi-700">AI 理解摘要</h3>
          {me.understanding ? <>
            <p className="mt-4 break-words font-display text-2xl leading-snug text-ink-800">{me.understanding.coreQuestion}</p>
            <p className="mt-3 text-xs leading-6 text-sumi-500">你长期在意的：{me.understanding.topics.join('、')}。</p>
            <button className="mt-3 text-xs text-ink-600 underline" onClick={() => router.push('/profile')}>查看完整画像 ›</button>
          </> : <p className="mt-3 text-sm text-sumi-500">还没有理解摘要。<button className="text-ink-600 underline" onClick={() => router.push('/onboarding')}>开始理解 →</button></p>}
        </div>
        <div className="mt-6 border-t border-paper-300 pt-4">
          <p className="text-xs text-sumi-500">演示身份切换（比赛演示用）</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_IDS.map(([id, label]) => <button key={id} disabled={busy || saving} onClick={() => switchUser(id)}
              className={`chip-warm disabled:opacity-50 ${me.user.id === id ? '!bg-gold-500 !text-white' : ''}`}>{label}</button>)}
          </div>
        </div>
      </div>
    </section>
    <footer className="relative z-10 px-6 pb-8 text-center text-xs text-sumi-400">遇见，连接真实的彼此</footer>
  </main>;
}
