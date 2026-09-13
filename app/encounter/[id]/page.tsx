'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import { InkAvatar, InkCover, InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import styles from '../encounter-motion.module.css';

export default function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [result, setResult] = useState<null | { mutual: boolean; connectionId?: string; message?: string }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/encounters/${id}`).then((r) => r.json()).then((d) => d.ok && setData(d));
  }, [id]);

  const wantToMeet = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/encounters/${id}/want-to-meet`, { method: 'POST' }).then((r) => r.json());
      if (!res.ok) throw new Error('want-to-meet failed');
      setResult(res);
      if (res.mutual) setTimeout(() => router.push(`/connect/${res.connectionId}`), 1800);
    } catch {
      setResult(null);
      setSubmitError('这次没有送达，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) return <main className="min-h-screen bg-paper-100 pt-24 text-center text-sumi-400">加载中……</main>;
  const { rec, otherContents } = data;

  return (
    <main className={`relative min-h-[100dvh] overflow-hidden bg-paper-100 paper-texture ${styles.page}`}>
      <InkScene tone="warm" side="both" />
      <Nav tone="warm" tagline="真实的人，真诚的连接" />

      <section className="relative z-10 mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <div className={styles.personReveal}>
        <p className="text-center text-sm tracking-widest2 text-gold-500">写 这 个 的 人 是 谁 ？</p>
        <h1 className="mt-3 text-center font-display text-4xl text-sumi-800">{rec.target.name}</h1>
        <p className="mt-3 text-center text-sumi-500">{rec.target.role} · {rec.target.city} · 知乎 {rec.target.zhihu_years} 年 · 获赞 {rec.target.upvotes}</p>

        <div className="mx-auto mt-6 flex justify-center"><span className={styles.avatarReveal}><InkAvatar name={rec.target.name} tone="warm" size={110} /></span></div>
        <p className="mt-5 text-center font-display text-lg text-sumi-700">「 {rec.target.quote} 」</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {rec.target.tags.map((t: string) => <span key={t} className="chip-warm">{t}</span>)}
        </div>
        </div>

        <div className="card-warm fade-up-2 mt-10 p-7">
          <p className="font-medium text-sumi-800">你们可能有这些交集</p>
          <div className="mt-3 flex flex-wrap gap-2">{rec.shared.map((s: string) => <span key={s} className="chip-warm">✦ {s}</span>)}</div>
          {rec.difference && (
            <>
              <p className="mt-5 font-medium text-sumi-800">一个值得讨论的不同</p>
              <p className="mt-2 text-sm leading-6 text-sumi-500">{rec.difference.note}</p>
            </>
          )}
          <p className="mt-5 font-medium text-sumi-800">如果真的聊起来，可以从这里开始</p>
          <p className="mt-2 rounded-xl bg-paper-200/70 p-4 font-display text-lg leading-7 text-sumi-800">“{rec.question}”</p>
        </div>

        <div className="fade-up-3 mt-8">
          <p className="font-medium text-sumi-800">TA 还写过</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {otherContents.map((c: any) => (
              <div key={c.id} className="card-warm overflow-hidden">
                <div className="h-24"><InkCover seed={c.id} /></div>
                <div className="p-4">
                  <p className="text-sm leading-5 text-sumi-700">{c.title}</p>
                  <p className="mt-1 text-[11px] text-sumi-400">{c.chars?.toLocaleString()} 字 · {c.minutes} 分钟</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center" aria-live="polite">
          {!result && (
            <button onClick={wantToMeet} disabled={submitting} aria-busy={submitting} className="btn-primary-dark w-full px-10 text-lg sm:w-auto sm:px-14">
              {submitting ? '正在送出这份意愿…' : '我有点想认识 TA'}
            </button>
          )}
          {submitError && <p className="mt-3 text-sm text-red-700" role="alert">{submitError}</p>}
          {result?.mutual && (
            <div className={styles.mutualOverlay} role="status">
              <div className={styles.mutualPanel}>
                <div className={styles.mutualGlyph} aria-hidden="true"><span>我</span><span>{rec.target.name.slice(0, 1)}</span></div>
                <p className="font-display text-2xl text-gold-600">你们都愿意认识彼此</p>
                <p className="mt-3 text-sm text-sumi-500">正在带你们去见彼此……</p>
              </div>
            </div>
          )}
          {result && !result.mutual && (
            <div className="fade-up mx-auto max-w-md rounded-2xl bg-paper-200/80 p-6 text-sm leading-6 text-sumi-600">
              {result.message}
              <div className="mt-3"><button className="btn-ghost" onClick={() => router.push('/connections')}>查看「已遇见」</button></div>
            </div>
          )}
          <p className="mt-4 text-[11px] text-sumi-400">TA 不会立即知道是你。只有双向愿意，你们才会出现。</p>
        </div>
      </section>
    </main>
  );
}
