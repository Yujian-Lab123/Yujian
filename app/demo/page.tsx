'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';

/**
 * /demo —— 演示模式唯一入口。
 * 演示会话使用独立 Cookie（yj_demo_session）与 /demo 前缀路由，
 * 只展示 Mock 种子数据，与真实账号完全隔离。
 */
export default function DemoEntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/demo', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.demoSession) { setActive(true); router.replace('/demo/onboarding'); return; }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function start() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '演示模式暂不可用');
      router.push('/demo/onboarding');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络异常，请重试');
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
      <InkScene tone="warm" side="left" />
      <Nav tone="warm" tagline="演示模式 · 预置数据体验" />
      <section className="relative z-10 mx-auto max-w-xl px-6 pt-24 pb-16 text-center">
        <p className="font-display text-[13px] tracking-[0.24em] text-[#8a7a5c]">DEMO · 演示模式</p>
        <h1 className="fade-up mt-5 font-display text-4xl leading-snug text-sumi-800">用预置身份，<br />完整体验一次遇见</h1>
        <p className="fade-up-1 mx-auto mt-5 max-w-md text-sm leading-7 text-sumi-500">
          演示模式使用一套独立的预置人物与内容，与真实账号的数据完全隔离：
          你在这里看到和产生的任何数据，都不会影响真实用户，也不会进入真实推荐。
        </p>

        <div className="card-warm mx-auto mt-10 max-w-sm p-7 text-left">
          <ul className="space-y-3 text-[13px] leading-6 text-sumi-600">
            <li className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" />独立的演示身份与「此刻」记录，随日期轮换人物</li>
            <li className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" />推荐与连接仅发生在预置人物之间</li>
            <li className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" />真实账号登录后才使用你自己的数据</li>
          </ul>
        </div>

        {checking ? (
          <p className="mt-10 text-sm text-sumi-400">正在检查演示会话…</p>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="mt-10 inline-flex items-center gap-3 rounded-lg bg-[#173e70] px-10 py-3.5 text-[15px] text-white transition-colors hover:bg-[#1258bd] disabled:opacity-50"
          >
            {busy ? '正在进入演示…' : active ? '继续演示体验' : '开始演示体验'}
          </button>
        )}
        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}

        <p className="mt-8 text-xs text-sumi-400">
          想使用真实账号？<Link href="/about" className="text-[#1769d7] underline underline-offset-4">返回登录入口</Link>
        </p>
      </section>
    </main>
  );
}
