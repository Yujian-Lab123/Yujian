'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type ArtifactSummary = { slug: string; name: string; contentCount: number; timeRange: string | null };
type Input = { file: string; name: string; count: number; timeRange: string | null };

interface Job {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  message: string;
  progress: { stage: string; batchDone?: number; batchTotal?: number; clues?: number; cacheHits?: number; cacheTotal?: number } | null;
  slug?: string;
  error?: string;
}

/** 右下角浮层:切换人物 + 生成新画像。收起时是一颗小圆钮,不占页面版面。 */
export default function ProfileCorner({
  artifacts,
  inputs,
  activeSlug,
}: {
  artifacts: ArtifactSummary[];
  inputs: Input[];
  activeSlug: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'switch' | 'generate'>('switch');
  const [file, setFile] = useState(inputs[0]?.file || '');
  const [name, setName] = useState(inputs[0]?.name || '');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function pick(f: string) {
    setFile(f);
    setName(f.replace(/\.json$/, ''));
  }

  async function generate(source?: 'zhihu') {
    setError('');
    setBusy(true);
    setJob(null);
    try {
      const res = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source === 'zhihu' ? { source: 'zhihu' } : { file, name }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '启动失败');
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/profile/jobs/${data.jobId}`);
        const d = await r.json();
        if (d.ok) {
          setJob(d.job);
          if (!['queued', 'running'].includes(d.job.status) && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setBusy(false);
            if (d.job.status === 'succeeded' && d.job.slug) {
              setTimeout(() => router.push(`/profile?name=${encodeURIComponent(d.job.slug)}`), 800);
            }
          }
        }
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const pct = job?.progress?.batchTotal ? Math.round(((job.progress.batchDone || 0) / job.progress.batchTotal) * 100) : null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="mo-expand w-72 origin-bottom-right rounded-xl border border-[#d8d2c6] bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTab('switch')}
              className={`flex-1 rounded-md px-2 py-1 ${tab === 'switch' ? 'bg-[#2c5f8a] text-white' : 'bg-[#f0ece3] text-[#6b665e]'}`}
            >
              切换人物
            </button>
            <button
              type="button"
              onClick={() => setTab('generate')}
              className={`flex-1 rounded-md px-2 py-1 ${tab === 'generate' ? 'bg-[#2c5f8a] text-white' : 'bg-[#f0ece3] text-[#6b665e]'}`}
            >
              生成画像
            </button>
          </div>

          {tab === 'switch' && (
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {artifacts.length === 0 && <li className="px-1 text-xs text-[#8a857c]">还没有产物,先去「生成画像」。</li>}
              {artifacts.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/profile?name=${encodeURIComponent(a.slug)}`}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md px-2 py-1.5 transition-colors ${
                      a.slug === activeSlug ? 'bg-[#2c5f8a] text-white' : 'hover:bg-[#f0ece3]'
                    }`}
                    title={`${a.contentCount} 篇 · ${a.timeRange || '时间未知'}`}
                  >
                    {a.name}
                    <span className={`ml-1 text-[10px] ${a.slug === activeSlug ? 'text-white/70' : 'text-[#a09a8e]'}`}>
                      {a.contentCount} 篇
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {tab === 'generate' && (
            <div className="space-y-2 text-sm">
              <button
                type="button"
                onClick={() => generate('zhihu')}
                disabled={busy}
                className="w-full rounded-md bg-[#173e70] px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                {busy ? '生成中…' : '用我的知乎内容生成画像'}
              </button>
              <p className="text-[10px] leading-4 text-[#8a857c]">
                基于你授权采集的知乎内容生成完整证据画像（约 1–3 分钟，可离开页面）
              </p>
              <p className="pt-1 text-[10px] text-[#a09a8e]">或使用预置数据集（开发调试）：</p>
              <select
                value={file}
                onChange={(e) => pick(e.target.value)}
                className="w-full rounded-md border border-[#d8d2c6] bg-white px-2 py-1.5 text-xs"
                aria-label="选择输入文件"
              >
                {inputs.map((i) => (
                  <option key={i.file} value={i.file}>
                    {i.file}({i.count} 篇)
                  </option>
                ))}
              </select>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="人物名称"
                className="w-full rounded-md border border-[#d8d2c6] px-2 py-1.5 text-xs"
                aria-label="人物名称"
              />
              <button
                type="button"
                onClick={() => generate()}
                disabled={busy || !file}
                className="w-full rounded-md bg-[#2c5f8a] px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {busy ? '生成中…' : '开始生成'}
              </button>
              {error && <p className="text-xs text-red-600">{error}</p>}
              {job && (
                <div className="rounded-md bg-[#f7f4ee] p-2 text-xs">
                  <p>{['queued', 'running'].includes(job.status) ? '⏳ ' : job.status === 'succeeded' ? '✅ ' : '❌ '}{job.message}</p>
                  {job.progress?.batchTotal ? (
                    <>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded bg-[#e5dfd3]">
                        <div className="h-full bg-[#2c5f8a] transition-all" style={{ width: `${pct || 0}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-[#8a857c]">
                        {job.progress.batchDone}/{job.progress.batchTotal} 批 · 线索 {job.progress.clues} · 缓存 {job.progress.cacheHits}/{job.progress.cacheTotal}
                      </p>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? '收起画像切换' : '切换或生成人物画像'}
        aria-expanded={open}
        className="mo-breathe flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d2c6] bg-white/95 text-lg text-[#2c5f8a] shadow-md backdrop-blur transition-transform duration-200 hover:scale-105"
      >
        {open ? '×' : '⇄'}
      </button>
    </div>
  );
}
