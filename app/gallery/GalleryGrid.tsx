'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { GalleryEntry } from '@/lib/gallery/data';

const PAGE_SIZE = 8;

/** 卡片封面：约定路径 /images/gallery/cover-<id>.png；图片未就绪时显示素色宣纸底。 */
function CardCover({ entry }: { entry: GalleryEntry }) {
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-[#ece5d6] bg-cover bg-center"
      style={{ backgroundImage: `url('${entry.cover}')` }}
      role="img"
      aria-label={`${entry.name}的画像封面`}
    >
      <span className="absolute left-3 top-3 rounded-full bg-[#173e70]/85 px-2.5 py-0.5 text-[11px] text-[#f7f4ee]">
        {entry.isMock ? '预览人设' : '已公开'}
      </span>
    </div>
  );
}

function GalleryCard({ entry }: { entry: GalleryEntry }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-[#b7a98e]/25 bg-[#fbf9f4]">
      <CardCover entry={entry} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-display text-[15px] leading-6 text-[#2f2a22]">「{entry.quote}」</p>
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-lg text-[#173e70]">{entry.name}</h3>
          <span className="text-xs text-[#77859a]">{entry.role}{entry.city ? ` · ${entry.city}` : ''}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-[#b7a98e]/35 px-2 py-0.5 text-[11px] text-[#7a6f5c]">{tag}</span>
          ))}
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-[#77859a]">{entry.summary}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[11px] text-[#a9834a]">知乎 {entry.zhihuYears} 年</span>
          {entry.hasArtifact ? (
            <Link href={entry.profileHref} className="text-xs text-[#173e70] underline-offset-4 hover:underline">
              查看完整画像 →
            </Link>
          ) : (
            <span className="text-xs text-[#a9a192]">{entry.isMock ? '完整画像整理中' : '画像生成中'}</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** 画像长廊卡片网格：无分类筛选，左右箭头整页切换。 */
export default function GalleryGrid({ entries }: { entries: GalleryEntry[] }) {
  const [page, setPage] = useState(0);

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-[#b7a98e]/25 bg-[#fbf9f4] p-8 text-center">
        <p className="font-display text-xl text-[#173e70]">还没有人公开画像</p>
        <p className="mt-3 text-sm leading-6 text-[#77859a]">
          完成知乎登录并生成画像后，你可以选择把「愿意被看见的一面」公开到这里。
        </p>
        <Link href="/onboarding" className="mt-5 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">
          去生成我的画像
        </Link>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((entry) => <GalleryCard key={entry.id} entry={entry} />)}
      </div>
      {pageCount > 1 && (
        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={safePage === 0}
            className="rounded-full border border-[#b7a98e]/40 px-4 py-2 text-sm text-[#173e70] disabled:opacity-35"
            aria-label="上一页"
          >
            ←
          </button>
          <span className="text-sm text-[#77859a]">{safePage + 1} / {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            disabled={safePage === pageCount - 1}
            className="rounded-full border border-[#b7a98e]/40 px-4 py-2 text-sm text-[#173e70] disabled:opacity-35"
            aria-label="下一页"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
