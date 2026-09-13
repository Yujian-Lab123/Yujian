/**
 * /side 路由级骨架。
 *
 * 与 page.tsx 里的 SideSkeleton 分工不同：
 *   - 这里覆盖的是「服务端还没把路由数据发回来」那段空白
 *   - page.tsx 里的 SideSkeleton 覆盖的是「路由到了、但 me 还在 fetch」那段
 * 两者版式刻意做成一致，所以先后接力时看不出接缝。
 */
export default function SideLoading() {
  return (
    <main
      className="min-h-screen bg-[#f7f1e7] bg-[length:max(1680px,100%)_auto] bg-top bg-no-repeat"
      style={{ backgroundImage: "url('/images/profile/ink-landscape-bg-v1.png')" }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">正在加载侧面</span>

      <div className="flex min-h-[74px] items-center gap-8 border-b border-[#b7a98e]/20 bg-[#fbf8f1]/85 px-5 lg:px-8">
        <div className="mo-skeleton-warm h-6 w-[70px]" />
        <div className="ml-auto hidden gap-5 lg:flex">
          {[46, 40, 40, 44, 62].map((w, i) => (
            <div key={i} className="mo-skeleton-warm h-3.5" style={{ width: w }} />
          ))}
        </div>
        <div className="mo-skeleton-warm h-9 w-9 rounded-full" />
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-3 px-4 pb-12 pt-3 lg:grid-cols-[minmax(0,2.15fr)_minmax(320px,0.85fr)] lg:px-8">
        <section className="overflow-hidden rounded-xl border border-[#b8ab94]/30 bg-[#fffdf8]/95">
          <div className="border-b border-[#d3c6b0]/45 px-6 pb-6 pt-7 sm:px-8 lg:px-9">
            <div className="mo-skeleton-warm h-3 w-32" />
            <div className="mt-5 mo-skeleton-warm h-8 w-[min(420px,80%)]" />
            <div className="mt-5 mo-skeleton-warm h-4 w-[min(360px,70%)]" />
          </div>
          <div className="px-6 pb-6 pt-5 sm:px-8 lg:px-9">
            <div className="mo-skeleton-warm h-5 w-32" />
            <div className="mt-3 flex flex-col gap-5 rounded-xl border border-[#438dfa]/40 bg-[#eef6ff]/50 p-4 sm:flex-row sm:items-center">
              <div className="mo-skeleton-warm h-[132px] w-full sm:h-[112px] sm:w-[150px]" />
              <div className="flex-1 space-y-3">
                <div className="mo-skeleton-warm h-6 w-40" />
                <div className="mo-skeleton-warm h-4 w-full" />
                <div className="mo-skeleton-warm h-4 w-3/4" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 py-3">
                  <div className="mo-skeleton-warm h-[70px] w-[88px]" />
                  <div className="space-y-2.5">
                    <div className="mo-skeleton-warm h-5 w-36" />
                    <div className="mo-skeleton-warm h-3.5 w-full" />
                    <div className="mo-skeleton-warm h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-[#b8ab94]/30 bg-[#fffdf8]/95 p-6">
          <div className="mo-skeleton-warm h-6 w-36" />
          <div className="mt-5 flex gap-4">
            <div className="mo-skeleton-warm h-[102px] w-[92px]" />
            <div className="flex-1 space-y-2.5 pt-1">
              <div className="mo-skeleton-warm h-5 w-28" />
              <div className="mo-skeleton-warm h-3.5 w-full" />
              <div className="mo-skeleton-warm h-3.5 w-4/5" />
            </div>
          </div>
          <div className="mt-8 space-y-3 border-t border-[#cfc5b3]/45 pt-6">
            <div className="mo-skeleton-warm h-5 w-24" />
            <div className="mo-skeleton-warm h-4 w-full" />
            <div className="mo-skeleton-warm h-10 w-full" />
          </div>
        </aside>
      </div>
    </main>
  );
}
