'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';

/** 演示版连接列表：pending 与 mutual 均只含演示人物。 */
export default function DemoConnectionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/demo/connections', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { window.location.href = '/demo'; return null; }
        return r.json();
      })
      .then((d) => {
        if (!d?.ok) throw new Error(d?.error || '加载失败');
        setItems(d.connections || []);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#fbf8f1]">
      <Nav tone="blue" tagline="演示模式 · 预置数据体验" />
      <section className="mx-auto max-w-[680px] px-5 pb-24 pt-10">
        <p className="font-display text-[13px] tracking-[0.24em] text-[#8a7a5c]">DEMO · 连接</p>
        <h1 className="mt-3 font-display text-3xl text-[#173e70]">已遇见的人</h1>

        {loading && <p className="mt-16 text-center text-sm text-sumi-400">加载中…</p>}
        {error && <p className="mt-16 text-center text-sm text-[#a05a4a]">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="mt-16 text-center">
            <p className="font-display text-xl text-[#173e70]">还没有连接</p>
            <p className="mt-2 text-sm text-[#77859a]">从遇见里挑一个感兴趣的人，表达想认识。</p>
            <Link href="/demo/encounter" className="mt-5 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">去遇见</Link>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <Link key={item.id} href={`/demo/connect/${encodeURIComponent(item.id)}`}
              className="block rounded-2xl border border-[#d8cfbd] bg-white/85 p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-[#173e70]">{item.other?.name || '（演示人物）'}</p>
                  <p className="mt-0.5 text-xs text-[#a09a8e]">{item.other?.role || ''}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${item.type === 'mutual' ? 'bg-[#e8f0e4] text-[#3c6b3a]' : 'bg-[#fdf3d8] text-[#8a6d1a]'}`}>
                  {item.type === 'mutual' ? '已连接' : '等待回应'}
                </span>
              </div>
              {item.question && <p className="mt-3 border-l-2 border-[#c8b998] pl-3 text-[13px] leading-6 text-[#536a84]">{item.question}</p>}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
