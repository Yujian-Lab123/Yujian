'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import styles from '@/app/encounter/encounter-motion.module.css';

/** 演示版相遇详情：展示推荐理由与对方内容摘要，「想认识」仅写入演示数据。 */
export default function DemoEncounterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'pending' | 'mutual' | ''>('');

  useEffect(() => {
    fetch(`/api/demo/encounters/${encodeURIComponent(String(params.id))}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { window.location.href = '/demo'; return null; }
        return r.json();
      })
      .then((d) => {
        if (!d?.ok) throw new Error(d?.error || '加载失败');
        setDetail(d);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function wantToMeet() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/demo/encounters/${encodeURIComponent(String(params.id))}/want-to-meet`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '操作失败');
      setResult(data.mutual ? 'mutual' : 'pending');
      if (data.mutual && data.connectionId) {
        setTimeout(() => router.push(`/demo/connect/${encodeURIComponent(data.connectionId)}`), 900);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络异常，请重试');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#fbf8f1]"><Nav tone="blue" tagline="演示模式 · 预置数据体验" /><p className="py-24 text-center text-sm text-sumi-400">加载中…</p></main>;
  }
  if (error && !detail) {
    return <main className="min-h-screen bg-[#fbf8f1]"><Nav tone="blue" tagline="演示模式 · 预置数据体验" /><p className="py-24 text-center text-sm text-[#a05a4a]">{error}</p></main>;
  }

  const rec = detail?.rec;
  return (
    <main className="min-h-screen bg-[#fbf8f1]">
      <Nav tone="blue" tagline="演示模式 · 预置数据体验" />
      <section className="mx-auto max-w-[680px] px-5 pb-24 pt-10">
        <Link href="/demo/encounter" className="text-xs text-[#1769d7] underline underline-offset-4">‹ 返回遇见</Link>
        <h1 className="mt-4 font-display text-3xl text-[#173e70]">{rec?.target?.name}</h1>
        <p className="mt-1 text-xs tracking-[0.14em] text-[#a09a8e]">{rec?.target?.role}{rec?.target?.city ? ` · ${rec.target.city}` : ''}</p>
        {rec?.target?.quote && <p className="mt-3 border-l-2 border-[#c8b998] pl-3 text-sm leading-6 text-[#536a84]">{rec.target.quote}</p>}

        <div className={`${styles.card} mo-rise mt-6 rounded-2xl border border-[#d8cfbd] bg-white/85 p-6`}>
          <p className="text-[11px] tracking-[0.14em] text-[#a09a8e]">为什么推荐 TA</p>
          <p className="mt-2 text-[13px] leading-6 text-[#536a84]">{rec?.reason}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(rec?.shared || []).map((s: string) => (
              <span key={s} className="rounded-full bg-[#f0ece3] px-2.5 py-0.5 text-[11px] text-[#6b665e]">{s}</span>
            ))}
          </div>
          {rec?.difference && (
            <p className="mt-3 text-[13px] leading-6 text-[#627083]"><strong className="text-[#173e70]">有趣的差异：</strong>{rec.difference.label} —— {rec.difference.note}</p>
          )}
        </div>

        {Array.isArray(detail?.otherContents) && detail.otherContents.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-[11px] tracking-[0.14em] text-[#a09a8e]">TA 写过的内容</p>
            {detail.otherContents.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-[#e6ddcc] bg-white/70 p-4">
                <p className="text-sm text-[#173e70]">{c.title || '(无标题)'}</p>
                {c.excerpt && <p className="mt-1 text-xs leading-5 text-[#77859a]">{String(c.excerpt).slice(0, 90)}…</p>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          {result === '' && (
            <button type="button" onClick={wantToMeet} disabled={busy}
              className="w-full rounded-lg bg-[#173e70] px-6 py-3.5 text-[15px] text-white transition-colors hover:bg-[#1258bd] disabled:opacity-50">
              {busy ? '…' : '想认识 TA（演示）'}
            </button>
          )}
          {result === 'pending' && (
            <p className="rounded-lg bg-[#f0ece3] px-4 py-3 text-center text-sm text-[#6b665e]">已记下你的意愿（演示数据）。对方回应后连接才会建立。</p>
          )}
          {result === 'mutual' && (
            <p className="rounded-lg bg-[#e8f0e4] px-4 py-3 text-center text-sm text-[#3c6b3a]">双向意愿达成！正在进入连接…</p>
          )}
          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        </div>
      </section>
    </main>
  );
}
