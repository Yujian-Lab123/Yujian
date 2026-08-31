'use client';
import { useEffect, useState, use } from 'react';
import { InkAvatar, InkScene } from '@/components/Ink';
import Nav, { Logo } from '@/components/Nav';

export default function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/connections/${id}`).then((r) => r.json()).then((d) => d.ok && setData(d));
  }, [id]);

  if (!data) return <main className="min-h-screen bg-[#f4f5f7] pt-24 text-center text-sumi-400">加载中……</main>;
  const { me, other, shared, question, difference } = data;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f5f7] ink-texture-blue">
      <InkScene tone="blue" />
      <Nav tone="blue" tagline="在知乎，遇见欣赏你的人" />

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="card-blue px-6 py-12 md:px-12">
          <p className="text-center text-sm tracking-widest2 text-gold-500">— 连 接 成 功 —</p>
          <h1 className="fade-up mt-4 text-center font-display text-4xl font-bold text-ink-900 md:text-5xl">你们都愿意认识彼此</h1>
          <p className="fade-up-1 mt-4 text-center text-sumi-500">基于真实的兴趣与思考，遇见更懂彼此的对话</p>

          <div className="mt-12 grid items-start gap-10 md:grid-cols-[1fr_1.2fr_1fr]">
            {/* 我 */}
            <PersonCard p={me} />

            {/* 中间：共同话题 + 开始话题 */}
            <div className="fade-up-2">
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
            <PersonCard p={other} />
          </div>

          <div className="fade-up-3 mt-12 flex flex-col justify-center gap-3 md:flex-row">
            <a href={`https://zhihu.com/mock/${other.id}`} target="_blank" className="btn-outline-blue">👤 去 TA 的知乎主页</a>
            <button className="btn-outline-blue">＋ 关注 TA</button>
            <a href={`https://zhihu.com/mock/${other.id}`} target="_blank" className="btn-primary-blue">💬 开始交流</a>
          </div>
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
      <p className="mt-4 font-display text-sm leading-6 text-sumi-600">「 {p.quote} 」</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {p.tags.map((t: string) => <span key={t} className="chip-blue">{t}</span>)}
      </div>
      <p className="mt-4 text-xs text-sumi-400">知乎 {p.zhihu_years} 年 · 获赞 {p.upvotes}</p>
    </div>
  );
}
