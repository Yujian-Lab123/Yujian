/**
 * 全局路由级骨架屏。
 *
 * 为什么需要：Next App Router 在切换路由时会先等 RSC payload 返回，
 * 这段时间若不提供 loading.tsx，浏览器会停留在上一帧，
 * 数据到达后内容整体替换 —— 视觉上就是"猛地一跳"。
 *
 * 这里的骨架刻意做得通用且轻（只有导航条 + 若干占位块），
 * 具体页面各自的 loading.tsx 会覆盖它。
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f8f3e9]" aria-busy="true" aria-live="polite">
      <span className="sr-only">正在加载</span>

      {/* 顶栏骨架 —— 高度与各页面 header 的 66~74px 区间对齐，避免骨架退场时整体位移 */}
      <div className="flex h-[70px] items-center gap-8 border-b border-[#b7a98e]/20 bg-[#fbf8f1]/80 px-6 lg:px-10">
        <div className="mo-skeleton-warm h-6 w-[74px]" />
        <div className="ml-auto hidden gap-6 lg:flex">
          {[52, 44, 44, 44, 68].map((w, i) => (
            <div key={i} className="mo-skeleton-warm h-3.5" style={{ width: w }} />
          ))}
        </div>
        <div className="mo-skeleton-warm h-9 w-9 rounded-full" />
      </div>

      <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8">
        <div className="mo-skeleton-warm h-8 w-56" />
        <div className="mt-3 mo-skeleton-warm h-4 w-full max-w-2xl" />
        <div className="mt-2 mo-skeleton-warm h-4 w-3/4 max-w-xl" />

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,2.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4 rounded-xl border border-[#b8ab94]/25 bg-white/50 p-6">
            <div className="mo-skeleton-warm h-5 w-40" />
            <div className="mo-skeleton-warm h-28 w-full rounded-lg" />
            <div className="mo-skeleton-warm h-4 w-2/3" />
            <div className="mo-skeleton-warm h-4 w-1/2" />
          </div>
          <div className="space-y-4 rounded-xl border border-[#b8ab94]/25 bg-white/50 p-6">
            <div className="mo-skeleton-warm h-5 w-32" />
            <div className="mo-skeleton-warm h-24 w-full rounded-lg" />
            <div className="mo-skeleton-warm h-4 w-3/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
