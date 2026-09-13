'use client';
import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { InkAvatar, InkScene } from '@/components/Ink';
import Nav, { Logo } from '@/components/Nav';
import styles from './connect-motion.module.css';

export default function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    fetch(`/api/connections/${id}`).then((r) => r.json()).then((d) => d.ok && setData(d));
  }, [id]);

  if (!data) return <main className="min-h-screen bg-[#f4f5f7] pt-24 text-center text-sumi-400">加载中……</main>;
  const { me, other, shared, question, difference } = data;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f4f5f7] ink-texture-blue">
      <InkScene tone="blue" />
      <Nav tone="blue" tagline="在知乎，遇见欣赏你的人" />

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16" aria-labelledby="success-title" aria-live="polite">
        <div className={`card-blue px-4 py-8 sm:px-6 sm:py-10 md:px-12 md:py-12 ${styles.successCard}`}>
          <MutualMark me={me.name} other={other.name} />
          <p className="text-center text-sm tracking-widest2 text-gold-500">— 连 接 成 功 —</p>
          <h1 id="success-title" className="fade-up mt-4 text-center font-display text-3xl font-bold leading-tight text-ink-900 sm:text-4xl md:text-5xl">你们都愿意认识彼此</h1>
          <p className="fade-up-1 mt-4 text-center text-sumi-500">基于真实的兴趣与思考，遇见更懂彼此的对话</p>

          <div className={styles.connectionGrid}>
            {/* 我 */}
            <div className={`${styles.personSlot} ${styles.personLeft}`}><PersonCard p={me} /></div>

            {/* 中间：共同话题 + 开始话题 */}
            <div className={`${styles.bridge} fade-up-2`}>
              <p className="text-center text-sm text-sumi-500">— 共同关心的话题 —</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {shared.map((s: string) => <span key={s} className="chip-blue">✦ {s}</span>)}
                {other.tags.slice(0, 3).map((t: string) => <span key={t} className="chip-blue">{t}</span>)}
              </div>
              <p className="mt-8 text-center text-sm text-sumi-500">— 一个适合开始的话题 —</p>
              <div className="relative mt-4 rounded-xl bg-ink-100/60 p-7">
                <span className="absolute left-4 top-3 font-display text-3xl text-ink-300">“</span>
                <p className="text-center font-display text-lg leading-8 text-ink-800">{question}</p>
                <svg className="absolute bottom-3 right-4 w-14 opacity-60" viewBox="0 0 60 24" fill="none">
                  <path d="M4 18 Q20 12 40 16 L52 14 L46 20 M40 16 L46 10" stroke="#16337f" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              {difference && <p className="mt-4 text-center text-xs leading-5 text-sumi-400">{difference.note}</p>}
            </div>

            {/* TA */}
            <div className={`${styles.personSlot} ${styles.personRight}`}><PersonCard p={other} /></div>
          </div>

          <div className={`fade-up-3 mt-10 flex flex-col justify-center gap-3 md:mt-12 md:flex-row ${styles.actions}`}>
            <button
              type="button"
              className="btn-outline-blue"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(question || '很高兴认识你。');
                  setCopyStatus('copied');
                } catch {
                  setCopyStatus('failed');
                }
              }}
            >
              {copyStatus === 'copied' ? '已复制开场问题' : '复制开场问题'}
            </button>
            <Link href="/connections" className="btn-primary-blue">查看已遇见</Link>
          </div>
          <p className="mt-3 min-h-5 text-center text-xs text-sumi-400" role="status">
            {copyStatus === 'copied'
              ? '可以把这句话带到你们接下来的交流里。'
              : copyStatus === 'failed'
                ? '复制失败，请手动选中上面的开场问题。'
                : '知乎正式连接能力将在 OAuth 开放后接入。'}
          </p>
          <p className="mt-6 text-center text-xs tracking-widest2 text-gold-500">🔒 尊重彼此 · 真诚交流 · 安心连接</p>
        </div>

        <footer className="mt-8 flex flex-col items-center justify-between gap-3 text-xs text-sumi-400 md:flex-row">
          <p><Logo tone="blue" /> <span className="ml-2">知乎出品 · 算法匹配由「知心引擎」提供支持</span></p>
          <p className="flex gap-5"><span>使用指南</span><span>隐私保护</span><span>意见反馈</span></p>
        </footer>
      </section>
    </main>
  );
}

function PersonCard({ p }: { p: any }) {
  return (
    <div className="fade-up-2 flex flex-col items-center text-center">
      <InkAvatar name={p.name} tone="blue" size={130} />
      <p className="mt-5 font-display text-2xl font-semibold text-ink-900">{p.name}</p>
      <p className="mt-2 text-sm text-sumi-500">{p.role} · {p.city}</p>
      <p className={`${styles.personQuote} mt-4 font-display text-sm leading-6 text-sumi-600`}>「 {p.quote} 」</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {p.tags.map((t: string) => <span key={t} className="chip-blue">{t}</span>)}
      </div>
      <p className="mt-4 text-xs text-sumi-400">知乎 {p.zhihu_years} 年 · 获赞 {p.upvotes}</p>
    </div>
  );
}

function MutualMark({ me, other }: { me: string; other: string }) {
  return (
    <div className={styles.successMark} aria-hidden="true">
      <span className={styles.successPerson}>{me.slice(0, 1)}</span>
      <svg viewBox="0 0 120 44" fill="none">
        <path className={styles.connectionStroke} d="M4 25 C28 5 39 39 60 22 C79 7 92 37 116 18" />
        <circle className={styles.connectionDot} cx="34" cy="18" r="2.5" />
        <circle className={styles.connectionDot} cx="88" cy="25" r="2.5" />
      </svg>
      <span className={styles.successPerson}>{other.slice(0, 1)}</span>
    </div>
  );
}
