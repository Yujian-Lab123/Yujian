import Link from 'next/link';
import Nav from '@/components/Nav';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';
import { getDemoAuthorContents } from '@/lib/providers/demo-author-content';

export const dynamic = 'force-dynamic';

/**
 * 与画像长廊独立的演示内容页。
 * 仅在有效 Demo 会话中从服务端返回已授权的公开答主摘录；不写库、不参与匹配池。
 */
export default async function DemoContentPage() {
  const userId = await getDemoSessionUserId();
  if (!userId) {
    return (
      <main className="min-h-screen bg-[#fbf8f1]">
        <Nav tone="blue" tagline="演示模式 · 已授权内容样本" />
        <section className="mx-auto max-w-xl px-5 py-24 text-center">
          <p className="font-display text-2xl text-[#173e70]">请先进入演示模式</p>
          <p className="mt-3 text-sm leading-6 text-[#77859a]">内容样本只在独立的演示会话中提供。</p>
          <Link href="/demo" className="mt-6 inline-block rounded-lg bg-[#173e70] px-5 py-2.5 text-sm text-white">前往演示入口</Link>
        </section>
      </main>
    );
  }

  const contents = getDemoAuthorContents();
  return (
    <main className="min-h-screen bg-[#fbf8f1]">
      <Nav tone="blue" tagline="演示模式 · 已授权内容样本" />
      <section className="mx-auto max-w-[760px] px-5 pb-24 pt-10">
        <Link href="/demo/encounter" className="text-xs text-[#1769d7] underline underline-offset-4">‹ 返回演示相遇</Link>
        <p className="mt-7 text-[11px] tracking-[0.16em] text-[#a09a8e]">AUTHORIZED PUBLIC CONTENT</p>
        <h1 className="mt-2 font-display text-3xl text-[#173e70]">从真实表达开始认识一个人</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#61748a]">
          以下为已获展示授权的公开答主内容摘录。它们不进入演示匹配池，也不与演示身份混淆；原始采集文件只在服务端本地读取，不写入仓库或浏览器客户端。
        </p>

        {contents.length ? (
          <div className="mt-8 space-y-4">
            {contents.map((content) => (
              <article key={content.id} className="rounded-2xl border border-[#e6ddcc] bg-white/80 p-5 shadow-[0_8px_26px_rgba(61,52,39,0.04)]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-[0.08em] text-[#9a927f]">
                  <span>{content.author}</span>
                  <span aria-hidden="true">·</span>
                  <span>{content.type}</span>
                  {content.publishedAt && <><span aria-hidden="true">·</span><time dateTime={content.publishedAt}>{content.publishedAt}</time></>}
                </div>
                <h2 className="mt-3 text-base font-medium leading-6 text-[#173e70]">{content.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[#536a84]">{content.excerpt}</p>
                {content.sourceUrl && (
                  <a href={content.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-[#1769d7] underline underline-offset-4">
                    查看公开原文 ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-[#d8cfbd] bg-white/60 p-7 text-sm leading-6 text-[#77859a]">
            当前环境没有挂载已授权的本地内容样本，因此不会用虚构内容替代。请将授权数据放在 <code>data/crawler</code> 后重新进入此页。
          </div>
        )}
      </section>
    </main>
  );
}
