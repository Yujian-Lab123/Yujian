import type { Metadata } from 'next';
import Link from 'next/link';
import GalleryGrid from './GalleryGrid';
import { buildGalleryEntries } from '@/lib/gallery/data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '画像长廊 · 遇见',
  description: '每一个认真生活的人，都值得被看见。自愿公开的人物画像长廊。',
};

/**
 * 画像长廊（公开页）：
 * - 预览条目为虚构人设（比赛演示），真实用户画像仅在本人自愿公开后出现；
 * - 页面结构对应设计稿：横卷 Hero → 卡片网格（左右箭头翻页）→ 底部收束。
 */
export default async function GalleryPage() {
  const { preview, shared } = await buildGalleryEntries();
  const entries = [...shared, ...preview];

  return (
    <main className="min-h-screen bg-[#f7f4ee]">
      <section
        className="relative bg-[#e9e2d3] bg-cover bg-center"
        style={{ backgroundImage: "url('/images/gallery/hero/gallery-river-mountains-v1.png')" }}
      >
        <img
          src="/images/gallery/decor/branch-left-v1.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden h-full w-auto select-none lg:block"
        />
        <img
          src="/images/gallery/decor/branch-right-v1.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-auto select-none lg:block"
        />
        <div className="relative mx-auto max-w-[1280px] px-6 py-16 lg:py-24">
          <p className="text-xs uppercase tracking-[0.3em] text-[#77859a]">People Gallery</p>
          <h1 className="mt-3 font-display text-4xl text-[#173e70] lg:text-5xl">画像长廊</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#5c6b80]">
            每一个认真生活的人，都值得被看见。这里的每一份画像，都来自本人自愿公开的「愿意被理解的一面」。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/encounter" className="rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">随机遇见一位</Link>
            <Link href="/onboarding" className="rounded-lg border border-[#173e70]/40 px-6 py-2.5 text-sm text-[#173e70]">生成我的画像</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <GalleryGrid entries={entries} />
      </section>

      <footer className="border-t border-[#b7a98e]/15 py-10 text-center">
        <p className="font-display text-sm text-[#7a6f5c]">遇见更多不同的人，也遇见更多可能的自己。</p>
      </footer>
    </main>
  );
}
