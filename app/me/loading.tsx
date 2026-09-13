/**
 * /me 路由级骨架。
 *
 * 版式对齐 app/me/page.tsx 的真实结构：
 *   InkScene 背景层 + Nav（暖色调）+ 两栏（表单 / 连接意愿卡）。
 * 注意：/me 用的是旧设计语言（paper-* 色板），所以骨架也用 paper 系的暖色，
 * 不要用 profile 页那套米金配色 —— 骨架与真实页配色不一致会显得更乱。
 */
export default function MeLoading() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100" aria-busy="true" aria-live="polite">
      <span className="sr-only">正在加载此刻的你</span>

      <div className="relative z-10 border-b border-paper-300/60 bg-paper-100/70">
        <div className="mx-auto flex min-h-[70px] max-w-6xl items-center gap-8 px-6">
          <div className="mo-skeleton h-6 w-[68px]" />
          <div className="ml-auto hidden gap-5 lg:flex">
            {[46, 40, 40, 44, 62].map((w, i) => (
              <div key={i} className="mo-skeleton h-3.5" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>

      <section className="relative z-10 mx-auto grid max-w-6xl items-start gap-8 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2">
        <div className="card-warm min-w-0 p-6 md:p-10">
          <div className="mo-skeleton h-8 w-48" />
          <div className="mt-4 mo-skeleton h-4 w-full" />
          <div className="mt-3 mo-skeleton h-4 w-2/3" />
          <div className="mt-7 mo-skeleton h-32 w-full rounded-xl" />
          <div className="mt-5 mo-skeleton h-10 w-36 rounded-full" />
        </div>

        <div className="card-warm min-w-0 p-6 md:p-10">
          <div className="mo-skeleton h-8 w-40" />
          <div className="mt-4 mo-skeleton h-4 w-3/4" />
          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-paper-300 bg-white/50 p-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="mo-skeleton h-4 w-32" />
              <div className="mo-skeleton h-3 w-full" />
            </div>
            <div className="mo-skeleton h-6 w-11 shrink-0 rounded-full" />
          </div>
          <div className="mt-6 space-y-4 rounded-xl border border-paper-300 bg-white/50 p-5">
            <div className="mo-skeleton h-4 w-24" />
            <div className="mo-skeleton h-7 w-4/5" />
            <div className="mo-skeleton h-3 w-3/5" />
          </div>
        </div>
      </section>
    </main>
  );
}
