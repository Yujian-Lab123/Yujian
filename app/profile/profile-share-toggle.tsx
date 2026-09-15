'use client';

import { useEffect, useState } from 'react';

type ShareState = { hasArtifact: boolean; shared: boolean; slug: string | null };

/**
 * 画像公开开关（真实画像页 toolbar 插槽）。
 *
 * 背景：ProfileCorner 里的同一开关从未被任何页面挂载，导致「公开到画像长廊」在
 * UI 上不可见。这里把开关收敛成一条窄横条，由 app/profile/page.tsx 通过
 * ProfileExperience 的 toolbar 插槽注入，保证真实画像页一定有可见入口。
 *
 * 后端契约：GET /api/profile/share 读状态；POST {shared} 切换公开/撤下。
 * 隐私边界：只有本人主动开启后，画像才会出现在 /gallery；撤下后立即从长廊消失。
 */
export default function ProfileShareToggle() {
  const [state, setState] = useState<ShareState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/share', { cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (!data?.ok) {
          throw new Error(data?.loginRequired ? '需要登录后才能公开画像。' : data?.error || '读取公开状态失败，请刷新重试。');
        }
        setState({ hasArtifact: Boolean(data.hasArtifact), shared: Boolean(data.shared), slug: data.slug ?? null });
      })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { alive = false; };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/profile/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: next }),
      });
      const data = await response.json();
      if (!data?.ok) throw new Error(data?.error || '操作失败，请稍后重试。');
      setState((previous) => (previous ? { ...previous, shared: next, slug: data.slug ?? previous.slug } : previous));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    // 读取中或读取失败：失败时也要给出可见说明，避免开关"凭空消失"。
    return (
      <div className="border-b border-[#d8d2c6] bg-[#fbf8f1]">
        <div className="mx-auto max-w-[1280px] px-5 py-2.5 text-xs leading-5 text-[#8a857c] lg:px-8">
          {error || '正在读取画像公开状态…'}
        </div>
      </div>
    );
  }

  // 没有画像产物时不渲染开关（本页只在有产物时进入，此分支为防御性兜底）。
  if (!state.hasArtifact) return null;

  return (
    <div className="border-b border-[#d8d2c6] bg-[#fbf8f1]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 lg:px-8">
        <span className="shrink-0 rounded-sm bg-[#f5ead4] px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] text-[#8a6d1a]">画像长廊</span>
        <p className="min-w-0 flex-1 text-xs leading-5 text-[#65758a]" role="status" aria-live="polite">
          {state.shared
            ? '已公开：任何人打开画像长廊都能看到这份画像的公开摘要。'
            : '未公开：这份画像目前只有你自己可见。'}
        </p>
        {state.shared && state.slug && (
          <a href={`/gallery/${encodeURIComponent(state.slug)}`} className="shrink-0 text-xs font-medium text-[#1c5d9d] hover:underline">在长廊中查看</a>
        )}
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-[#244e7d]">
          <span>公开到画像长廊</span>
          <input
            type="checkbox"
            checked={state.shared}
            disabled={busy}
            onChange={(event) => void toggle(event.target.checked)}
            className="h-4 w-4 accent-[#2c5f8a] disabled:opacity-50"
            aria-label="公开到画像长廊"
          />
        </label>
        {error && <p className="w-full text-xs leading-5 text-[#a05a4a]">{error}</p>}
      </div>
    </div>
  );
}
