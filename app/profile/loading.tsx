/**
 * 人物画像页骨架。
 *
 * 关键：版式必须与真实页高度一致 —— 同一张水墨底、同一个 topbar 高度、
 * 同一个"左窄右宽"的两栏节奏。骨架退场时若有布局差异，反而会制造一次跳动，
 * 那就本末倒置了。
 */
export default function ProfileLoading() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f8f3e9] bg-top bg-no-repeat text-[#5b554a]"
      style={{
        backgroundImage: "url('/images/profile/ink-landscape-bg-v1.png')",
        backgroundSize: '100% auto',
        backgroundRepeat: 'repeat-y',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">正在加载人物画像</span>

      {/* topbar：66px，与 .reference-topbar 完全一致 */}
      <div className="flex h-[66px] items-center gap-8 border-b border-[#75603b]/10 bg-[#fbf8f1]/70 px-6 lg:px-12">
        <div className="mo-skeleton-warm h-6 w-[80px]" />
        <div className="ml-auto hidden gap-4 md:flex">
          {[44, 40, 40, 52].map((w, i) => (
            <div key={i} className="mo-skeleton-warm h-3.5" style={{ width: w }} />
          ))}
        </div>
        <div className="mo-skeleton-warm h-8 w-8 rounded-full" />
      </div>

      {/* 地图舞台：用与真实页相同的 min(1448px,100%) 宽度约束，居中 */}
      <div className="mx-auto w-[min(1448px,100%)] px-0">
        {/* 顶部引言区 */}
        <div className="px-8 pb-4 pt-10 lg:px-16">
          <div className="mo-skeleton-warm h-3 w-24" />
          <div className="mt-4 mo-skeleton-warm h-7 w-[min(520px,80%)]" />
          <div className="mt-3 mo-skeleton-warm h-7 w-[min(380px,60%)]" />
        </div>

        {/* 时间轴：横向一排节点 */}
        <div className="flex items-center gap-6 px-8 pt-8 lg:px-16">
          <div className="mo-skeleton-warm h-3 w-10 shrink-0" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="mo-skeleton-warm h-2.5 w-2.5 rounded-full" />
              <div className="mo-skeleton-warm h-3 w-full max-w-[110px]" />
            </div>
          ))}
        </div>

        {/* 中央头像 + 一句话理解 */}
        <div className="flex flex-col items-center gap-4 pt-12">
          <div className="mo-skeleton-warm h-[180px] w-[180px] rounded-full" />
          <div className="mo-skeleton-warm h-4 w-[min(340px,70%)]" />
        </div>

        {/* 左右两翼：交流线索 / 长期关切 */}
        <div className="grid gap-8 px-8 pt-14 lg:grid-cols-2 lg:px-16">
          <div className="space-y-3">
            <div className="mo-skeleton-warm h-4 w-24" />
            <div className="mo-skeleton-warm h-3.5 w-full" />
            <div className="mo-skeleton-warm h-3.5 w-5/6" />
            <div className="mo-skeleton-warm h-3.5 w-4/6" />
          </div>
          <div className="space-y-3">
            <div className="mo-skeleton-warm h-4 w-24" />
            <div className="mo-skeleton-warm h-3.5 w-full" />
            <div className="mo-skeleton-warm h-3.5 w-3/4" />
            <div className="mo-skeleton-warm h-3.5 w-5/6" />
          </div>
        </div>

        {/* 决策模式 */}
        <div className="px-8 pt-12 lg:px-16">
          <div className="mo-skeleton-warm h-4 w-20" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2.5 rounded-lg border border-[#b8ab94]/20 bg-white/40 p-4">
                <div className="mo-skeleton-warm h-4 w-20" />
                <div className="mo-skeleton-warm h-3 w-full" />
                <div className="mo-skeleton-warm h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>

        {/* 价值取舍 */}
        <div className="px-8 pt-12 lg:px-16">
          <div className="mo-skeleton-warm h-4 w-20" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2.5 rounded-lg border border-[#b8ab94]/20 bg-white/40 p-4">
                <div className="mo-skeleton-warm h-4 w-28" />
                <div className="mo-skeleton-warm h-3 w-full" />
                <div className="mo-skeleton-warm h-3 w-3/5" />
              </div>
            ))}
          </div>
        </div>

        {/* 代表内容：四张横卡 */}
        <div className="px-8 pb-20 pt-12 lg:px-16">
          <div className="mo-skeleton-warm h-4 w-20" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2.5 rounded-lg border border-[#b8ab94]/20 bg-white/40 p-4">
                <div className="mo-skeleton-warm h-3 w-4" />
                <div className="mo-skeleton-warm h-4 w-full" />
                <div className="mo-skeleton-warm h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
