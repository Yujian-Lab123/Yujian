'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InkAvatar, InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';

function daysSince(iso: string): number {
  const t = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function fmtDate(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export default function ConnectionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/connections').then((r) => r.json()).then((d) => {
      if (d.ok) setItems(d.connections);
      setLoaded(true);
    });
  }, []);

  const mutual = items.filter((i) => i.type === 'mutual');
  const pending = items.filter((i) => i.type === 'pending');

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f5f7] ink-texture-blue">
      <InkScene tone="blue" side="right" />
      <Nav tone="blue" tagline="在知乎，遇见欣赏你的人" />

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        {/* 头部：标题 + 统计 */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4">
              <span className="h-10 w-0.5 bg-ink-700" />
              <h1 className="fade-up font-display text-5xl font-bold text-ink-900">已遇见</h1>
            </div>
            <p className="fade-up-1 mt-3 pl-6 text-sumi-500">那些已经彼此愿意靠近的人</p>
          </div>
          <div className="fade-up-1 flex items-center gap-6 font-display">
            <p><span className="text-4xl font-bold text-ink-700">{mutual.length}</span><span className="ml-1 text-sm text-sumi-500">次遇见</span></p>
            <span className="h-8 w-px bg-ink-200" />
            <p><span className="text-4xl font-bold text-ink-700">{pending.length}</span><span className="ml-1 text-sm text-sumi-500">位正在等待</span></p>
          </div>
        </div>

        {!loaded && <p className="mt-16 text-center text-sumi-400">加载中……</p>}
        {loaded && items.length === 0 && (
          <div className="card-blue mt-12 p-14 text-center text-sumi-500">
            还没有遇见。<Link className="text-ink-600 underline" href="/encounter">去看看今天的第一篇内容 →</Link>
          </div>
        )}

        <div className="mt-10 space-y-5">
          {items.map((it) => (
            <div key={it.id} className="card-blue flex flex-col gap-5 p-6 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-5">
                <InkAvatar name={it.other?.name || '?'} tone="blue" size={72} />
                <div className="min-w-0">
                  <p className="font-display text-xl text-ink-900">
                    {it.other?.name}
                    <span className="ml-2 text-sm font-normal text-sumi-400">· {it.other?.role}</span>
                  </p>
                  {it.type === 'mutual' ? (
                    <>
                      <p className="mt-1.5 text-xs text-gold-500">你们开始的话题</p>
                      <p className="mt-0.5 truncate text-sm text-sumi-600">{it.question || '从彼此的内容开始。'}</p>
                      <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-sumi-400">
                        <span>🔗 已互相关注</span>·<span>📅 已连接 {daysSince(it.created_at)} 天</span>·<span>💬 已开始交流</span>
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-sumi-400">TA 会先读到最适合你的一篇内容。只有双向愿意，你们才会出现。</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-5 md:flex-col md:items-end md:gap-2">
                <p className="text-xs text-sumi-400">{fmtDate(it.created_at)}</p>
                {it.type === 'mutual' ? (
                  <Link href={`/connect/${it.id}`} className="btn-primary-blue !rounded-lg !px-7 !py-2.5 text-sm">再次见面</Link>
                ) : (
                  <span className="flex flex-col items-center rounded-lg border border-ink-200 px-6 py-2 text-sm text-sumi-400">
                    等待中
                    <span className="text-[10px] text-sumi-300">对方已收到邀请</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-16 text-center font-display text-sm text-sumi-400">
          <span className="text-gold-400">“</span>
          <span className="mx-2">愿你我在这里，遇见思想，遇见温度，遇见更多的可能。</span>
          <span className="text-gold-400">”</span>
        </p>
      </section>
    </main>
  );
}
