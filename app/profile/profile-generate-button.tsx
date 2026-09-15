'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileJob } from '@/lib/profile/jobs';

const ACTIVE = ['queued', 'running'];

/**
 * 真实登录用户的画像生成入口。
 * - 空态无任务：显示「生成我的完整画像」按钮；
 * - 有排队/进行中的任务（离开页面后回来）：自动接上进度轮询，不重复排队（服务端幂等）；
 * - 任务失败：就地展示原因，可重试。
 */
export default function ProfileGenerateButton({ initialJob }: { initialJob?: ProfileJob | null }) {
  const router = useRouter();
  const resumable = Boolean(initialJob && ACTIVE.includes(initialJob.status));
  const [job, setJob] = useState<ProfileJob | null>(initialJob ?? null);
  const [busy, setBusy] = useState(resumable);
  const [message, setMessage] = useState(resumable ? '正在生成，已自动接上进度…' : '');
  const [error, setError] = useState(initialJob?.status === 'failed' ? initialJob.error || '生成失败，可重试' : '');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPoll(), []);

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

  useEffect(() => {
    if (resumable && initialJob) poll(initialJob.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'zhihu' }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '启动失败');
      setMessage('已开始，正在阅读你的内容…（可离开页面，回来会自动接上进度）');
      poll(data.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="mt-6" role="status" aria-live="polite">
        <div className="mx-auto max-w-xs rounded-lg border border-[#c8b998]/50 bg-[#fbf8f1] p-3 text-xs text-[#5b6b80]">
          <p className="font-medium text-[#173e70]">⏳ {message || '生成中…'}</p>
          <p className="mt-1 text-[10px] text-[#8a857c]">可离开页面，回来会自动接上进度（约 1–3 分钟）</p>
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
        基于你授权采集的知乎内容，约 1–3 分钟，可离开页面，回来会自动接上进度
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
