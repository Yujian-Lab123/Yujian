import Nav from '@/components/Nav';

/** 演示路由 loading 骨架：版式对齐演示页，避免首帧跳动。 */
export default function DemoLoading() {
  return (
    <main className="min-h-screen bg-[#fbf8f1]">
      <Nav tone="blue" tagline="演示模式 · 预置数据体验" />
      <section className="mx-auto max-w-[720px] px-5 pt-10">
        <div className="h-4 w-24 animate-pulse rounded bg-[#e6ddcc]" />
        <div className="mt-4 h-9 w-64 animate-pulse rounded bg-[#e6ddcc]" />
        <div className="mt-8 space-y-5">
          <div className="h-44 animate-pulse rounded-2xl bg-[#efe9dc]" />
          <div className="h-44 animate-pulse rounded-2xl bg-[#efe9dc]" />
        </div>
      </section>
    </main>
  );
}
