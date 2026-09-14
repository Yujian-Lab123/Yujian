'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';

/** 演示版连接详情：开场问题与双方摘要，全部来自演示数据。 */
export default function DemoConnectPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/demo/connections/${encodeURIComponent(String(params.id))}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { window.location.href = '/demo'; return null; }
        return r.json();
      })
      .then((d) => {
        if (!d?.ok) throw new Error(d?.error || '加载失败');
        setData(d);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <main className="min-h-screen bg-[#fbf8f1]"><Nav tone="blue" tagline="演示模式 · 预置数据体验" /><p className="py-24 text-center text-sm text-sumi-400">加载中…</p></main>;
  }
  if (error) {
    return <main className="min-h-screen bg-[#fbf8f1]"><Nav tone="blue" tagline="演示模式 · 预置数据体验" /><p className="py-24 text-center text-sm text-[#a05a4a]">{error}</p></main>;
  }

  const question = data?.question || '从一篇你们都感兴趣的内容聊起？';
  async function copyQuestion() {
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* 剪贴板不可用时静默 */ }
  }

  return (
    <main className="min-h-screen bg-[#fbf8f1]">
      <Nav tone="blue" tagline="演示模式 · 预置数据体验" />
      <section className="mx-auto max-w-[640px] px-5 pb-24 pt-10">
        <Link href="/demo/connections" className="text-xs text-[#1769d7] underline underline-offset-4">‹ 返回连接</Link>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[data?.me, data?.other].filter(Boolean).map((person: any, index: number) => (
            <div key={person.id} className="rounded-2xl border border-[#d8cfbd] bg-white/85 p-5">
              <p className="text-[11px] tracking-[0.14em] text-[#a09a8e]">{index === 0 ? '演示身份（你）' : '演示人物'}</p>
              <p className="mt-1 font-display text-xl text-[#173e70]">{person.name}</p>
              <p className="mt-0.5 text-xs text-[#a09a8e]">{person.role}{person.city ? ` · ${person.city}` : ''}</p>
              {person.quote && <p className="mt-2 text-xs leading-5 text-[#77859a]">{person.quote}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {(person.tags || []).slice(0, 4).map((t: string) => (
                  <span key={t} className="rounded-full bg-[#f0ece3] px-2 py-0.5 text-[10px] text-[#6b665e]">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mo-rise mt-6 rounded-2xl border border-[#d8cfbd] bg-[#f7f1e7] p-6">
          <p className="text-[11px] tracking-[0.14em] text-[#a09a8e]">开场问题（演示）</p>
          <p className="mt-2 font-display text-lg leading-relaxed text-[#173e70]">{question}</p>
          <button type="button" onClick={copyQuestion}
            className="mt-4 rounded-lg border border-[#c8b998] px-4 py-2 text-xs text-[#173e70] transition-colors hover:border-[#1769d7]">
            {copied ? '已复制 ✓' : '复制开场问题'}
          </button>
        </div>
      </section>
    </main>
  );
}
