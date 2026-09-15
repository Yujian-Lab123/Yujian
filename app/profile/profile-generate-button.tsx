'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 真实登录用户的画像生成入口。
 * 放在「长期理解已准备好」空态里——这是用户登录后第一次到达画像页时会看到的页面，
 * 必须在这里提供一键生成，否则用户没有任何可点的入口。
 */
export default function ProfileGenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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
      setMessage('已开始，正在阅读你的内容…');
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/profile/jobs/${data.jobId}`);
          const d = await r.json();
          if (!d.ok) return;
          setMessage(d.job?.message || '生成中…');
          if (!['queued', 'running'].includes(d.job?.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            if (d.job.status === 'succeeded') {
              setMessage('画像已生成，正在打开…');
              router.refresh();
            } else {
              setError(d.job.error || '生成失败，请稍后重试');
              setBusy(false);
            }
          }
        } catch { /* 网络抖动时继续轮询 */ }
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white disabled:opacity-60"
      >
        {busy ? '生成中…' : '生成我的完整画像'}
      </button>
      <p className="mt-2 text-xs text-[#8a857c]">
        基于你授权采集的知乎内容，约 1–3 分钟，可离开页面
      </p>
      {message && <p className="mt-2 text-xs text-[#5b6b80]">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
