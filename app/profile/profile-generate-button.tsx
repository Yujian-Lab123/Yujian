'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileJob } from '@/lib/profile/jobs';

const ACTIVE = ['queued', 'running'];

interface JobProgress {
  stage?: 'extract' | 'synthesize';
  batchDone?: number;
  batchTotal?: number;
  message?: string;
}

/** 阶段文案：把 worker 的进度翻译成用户能懂的话。 */
function stageText(job: ProfileJob | null): string {
  const p = (job?.progress ?? {}) as JobProgress;
  if (p.stage === 'synthesize') return '正在综合你的画像…';
  if (p.stage === 'extract' && p.batchTotal) {
    return `正在逐篇阅读你的内容（${p.batchDone}/${p.batchTotal} 批）`;
  }
  return job?.message || '正在准备…';
}

function extractPct(job: ProfileJob | null): number | null {
  const p = (job?.progress ?? {}) as JobProgress;
  if (p.stage !== 'extract' || !p.batchTotal) return null;
  return Math.min(100, Math.round(((p.batchDone ?? 0) / p.batchTotal) * 100));
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 真实登录用户的画像生成入口。
 * - 空态无任务：显示「生成我的完整画像」按钮；
 * - 有排队/进行中的任务（离开页面后回来）：自动接上进度轮询，不重复排队（服务端幂等）；
 * - 任务失败：就地展示原因，可重试。 */
export default function ProfileGenerateButton({ initialJob }: { initialJob?: ProfileJob | null }) {
  const router = useRouter();
  const resumable = Boolean(initialJob && ACTIVE.includes(initialJob.status));
  const [job, setJob] = useState<ProfileJob | null>(initialJob ?? null);
  const [busy, setBusy] = useState(resumable);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState(resumable ? '正在生成，已自动接上进度…' : '');
  const [error, setError] = useState(initialJob?.status === 'failed' ? initialJob.error || '生成失败，可重试' : '');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPoll(), []);

  // 已用时计时器：长等待时不让页面看起来像卡死
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  function poll(jobId: string) {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/profile/jobs/${jobId}`);
        const d = await r.json();
        if (!d.ok) return;
        const j = d.job as ProfileJob;
        setJob(j);
        setMessage(j.message || '生成中…');
        if (!ACTIVE.includes(j.status)) {
          stopPoll();
          if (j.status === 'succeeded') {
            setMessage('画像已生成，正在打开…');
            router.refresh();
          } else {
            setError(j.error || '生成失败，可重试');
            setBusy(false);
          }
        }
      } catch { /* 网络抖动时继续轮询 */ }
    }, 3000);
  }

  async function start() {
    setError('');
    setMessage('');
    setElapsed(0);
    setBusy(true);
    try {
      const res = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'zhihu' }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '启动失败');
      setMessage('已开始，正在读取你的内容…');
      poll(data.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (busy) {
    const pct = extractPct(job);
    return (
      <div className="mt-6" role="status" aria-live="polite">
        <div className="mx-auto max-w-xs rounded-lg border border-[#c8b998]/50 bg-[#fbf8f1] p-4 text-xs text-[#5b6b80]">
          <p className="font-medium text-[#173e70]">⏳ {stageText(job)}</p>
          {pct !== null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[#e5dfd3]">
              <div className="h-full bg-[#2c5f8a] transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-2 flex items-center justify-between">
            <span>已用时 {fmt(elapsed)}</span>
            <span className="text-[10px] text-[#8a857c]">正常需 5–10 分钟</span>
          </p>
          <p className="mt-1 text-[10px] text-[#8a857c]">可离开页面，回来会自动接上进度</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={start}
        className="rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white"
      >
        生成我的完整画像
      </button>
      <p className="mt-2 text-xs text-[#8a857c]">
        基于你授权采集的知乎内容，约 5–10 分钟，可离开页面，回来会自动接上进度
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
