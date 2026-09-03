'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Input = { file: string; name: string; count: number; timeRange: string | null };

interface Job {
  id: string;
  status: 'running' | 'done' | 'error';
  message: string;
  progress: { stage: string; batchDone?: number; batchTotal?: number; clues?: number; cacheHits?: number; cacheTotal?: number } | null;
  slug?: string;
  error?: string;
}

export default function GeneratePanel({ inputs }: { inputs: Input[] }) {
  const router = useRouter();
  const [file, setFile] = useState(inputs[0]?.file || '');
  const [name, setName] = useState(inputs[0]?.name || '');
  const [advanced, setAdvanced] = useState(false);
  const [maxItems, setMaxItems] = useState('');
  const [maxChars, setMaxChars] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function pick(f: string) {
    setFile(f);
    setName(f.replace(/\.json$/, ''));
  }

  async function generate() {
    setError('');
    setBusy(true);
    setJob(null);
    try {
      const res = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file,
          name,
          ...(maxItems ? { maxItems: Number(maxItems) } : {}),
          ...(maxChars ? { maxChars: Number(maxChars) } : {}),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '启动失败');
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/profile/jobs/${data.jobId}`);
        const d = await r.json();
        if (d.ok) {
          setJob(d.job);
          if (d.job.status !== 'running' && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setBusy(false);
            if (d.job.status === 'done' && d.job.slug) {
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
    <section className="mb-6 rounded-xl border border-[#d8d2c6] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">从爬虫数据生成新画像</h2>
      {inputs.length === 0 ? (
        <p className="text-sm text-[#8a857c]">
          data/crawler/ 下还没有输入文件——先跑 <code className="rounded bg-[#f0ece3] px-1">node scripts/convert-crawler.mjs --crawl --name &quot;某人&quot;</code>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={file}
            onChange={(e) => pick(e.target.value)}
            className="rounded-lg border border-[#d8d2c6] bg-white px-3 py-2 text-sm"
            aria-label="选择输入文件"
          >
            {inputs.map((i) => (
              <option key={i.file} value={i.file}>
                {i.file}({i.count} 篇{i.timeRange ? ` · ${i.timeRange}` : ''})
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="人物名称"
            className="w-40 rounded-lg border border-[#d8d2c6] px-3 py-2 text-sm"
            aria-label="人物名称"
          />
          <button
            onClick={() => setAdvanced((v) => !v)}
            className="text-xs text-[#2c5f8a] underline-offset-2 hover:underline"
            type="button"
          >
            {advanced ? '收起高级选项' : '高级选项'}
          </button>
          <button
            onClick={generate}
            disabled={busy || !file}
            className="rounded-lg bg-[#2c5f8a] px-4 py-2 text-sm text-white transition-opacity disabled:opacity-50"
            type="button"
          >
            {busy ? '生成中…' : '生成画像'}
          </button>
        </div>
      )}

      {advanced && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#8a857c]">
          <label>
            最多分析条数
            <input value={maxItems} onChange={(e) => setMaxItems(e.target.value)} placeholder="默认 80" className="ml-2 w-24 rounded border border-[#d8d2c6] px-2 py-1" />
          </label>
          <label>
            单篇截断字数
            <input value={maxChars} onChange={(e) => setMaxChars(e.target.value)} placeholder="默认 3000" className="ml-2 w-24 rounded border border-[#d8d2c6] px-2 py-1" />
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {job && (
        <div className="mt-3 rounded-lg bg-[#f7f4ee] p-3 text-sm">
          <p>
            {job.status === 'running' && '⏳ '}
            {job.status === 'done' && '✅ '}
            {job.status === 'error' && '❌ '}
            {job.message}
            {job.error && ` — ${job.error}`}
          </p>
          {job.progress?.batchTotal ? (
            <>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[#e5dfd3]">
                <div className="h-full bg-[#2c5f8a] transition-all" style={{ width: `${pct || 0}%` }} />
              </div>
              <p className="mt-1 text-xs text-[#8a857c]">
                抽取 {job.progress.batchDone}/{job.progress.batchTotal} 批 · 线索 {job.progress.clues} 条 · 缓存命中 {job.progress.cacheHits}/{job.progress.cacheTotal}
              </p>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
