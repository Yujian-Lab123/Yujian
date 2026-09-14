'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, LockSimple, PlayCircle, UserCircle } from '@phosphor-icons/react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import { useMe } from '@/lib/useMe';

const OAUTH_ERRORS: Record<string, string> = {
  not_configured: '知乎 OAuth 未配置或配置不完整，请检查服务器环境变量。',
  code_missing: '知乎回调未返回授权码，请确认授权流程完整。',
  state_mismatch: '安全校验未通过（state 不匹配），请重新发起登录。',
  token_exchange_failed: '换取知乎令牌失败，可稍后重试。',
  profile_failed: '获取知乎用户信息失败，请重试。',
  oauth_failed: '知乎登录未完成，请重试。',
};

const steps = [
  ['我', '从长期公开表达，形成只属于你的理解画像。'],
  ['此刻', '记录今天的状态；你决定要不要让它参与本次推荐。'],
  ['侧面', '选择此刻想被理解的一面，保持对展示范围的控制。'],
  ['遇见', '先从一篇真实内容开始，双向愿意后才建立连接。'],
];

/** 对外入口：只说明产品、隐私边界与真实/演示的明确分流，不承载任何个人数据。 */
export default function AboutPage() {
  const me = useMe();
  const [realLogin, setRealLogin] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'error') setOauthError(OAUTH_ERRORS[params.get('reason') || ''] || OAUTH_ERRORS.oauth_failed);
    fetch('/api/auth/zhihu/status')
      .then((response) => response.json())
      .then((data) => setRealLogin(Boolean(data?.configured)))
      .catch(() => setRealLogin(false));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture text-sumi-800">
      <InkScene tone="warm" side="left" />
      <Nav tone="warm" tagline="在真实的生活里，遇见有趣的灵魂" />

      {oauthError && (
        <div role="alert" className="relative z-20 mx-auto mt-6 max-w-3xl px-5 lg:px-8">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>知乎登录未完成：{oauthError}</span>
            <button type="button" className="shrink-0 underline" onClick={() => setOauthError(null)}>知道了</button>
          </div>
        </div>
      )}

      <section className="relative z-10 mx-auto max-w-[1160px] px-5 pb-16 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-medium tracking-[0.26em] text-[#a18a64]">MEET PEOPLE THROUGH REAL EXPRESSION</p>
          <h1 className="mt-5 font-display text-[42px] font-semibold leading-[1.22] tracking-[0.05em] text-[#173e70] sm:text-[58px]">在真实的生活里，<br />遇见有趣的灵魂</h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-8 text-[#536a84]">遇见不替你制造人设。它从长期表达、此刻状态和你主动选择展示的侧面出发，帮你先看见思想，再决定要不要聊一句。</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-[930px] gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-[#d7cdbb] bg-[#fffdf8]/90 p-7 shadow-[0_16px_38px_rgba(76,59,31,0.07)]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#edf5ff] text-[#1769d7]"><UserCircle size={23} weight="fill" /></span>
            <p className="mt-5 text-[11px] font-medium tracking-[0.18em] text-[#a18a64]">REAL SPACE</p>
            <h2 className="mt-2 font-display text-2xl text-[#173e70]">使用我的知乎身份</h2>
            <p className="mt-3 text-sm leading-7 text-[#61748a]">建立真实会话后，只读取你授权的公开内容。没有记录时只显示你的空状态，绝不会混入演示资料。</p>
            {me.loggedIn ? (
              <Link href="/profile" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1769d7] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0d5fc8]">回到我的空间 <ArrowRight size={16} /></Link>
            ) : realLogin ? (
              <a href="/api/auth/zhihu" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1769d7] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0d5fc8]"><span className="grid h-5 w-5 place-items-center rounded bg-white text-[10px] text-[#173e70]">知</span>使用知乎账号登录</a>
            ) : (
              <p className="mt-6 inline-flex rounded-full border border-[#d6c8b1] bg-[#f9f4ea] px-5 py-2.5 text-sm text-[#8a7a5c]">知乎登录暂未配置</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#d2dce8] bg-[#f7fbff]/90 p-7 shadow-[0_16px_38px_rgba(41,78,118,0.07)]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fdf3d8] text-[#9c722e]"><PlayCircle size={23} weight="fill" /></span>
            <p className="mt-5 text-[11px] font-medium tracking-[0.18em] text-[#8a7a5c]">FULL DEMO</p>
            <h2 className="mt-2 font-display text-2xl text-[#173e70]">先体验一段完整演示</h2>
            <p className="mt-3 text-sm leading-7 text-[#61748a]">使用预置人物、此刻记录和相遇候选人完整走一遍流程。页面、路由和会话都与真实空间隔离。</p>
            <Link href="/demo" className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#8eb7ea] bg-white/80 px-5 py-2.5 text-sm font-medium text-[#1769d7] hover:bg-[#edf5ff]">进入完整演示 <ArrowRight size={16} /></Link>
          </section>
        </div>

        <section className="mx-auto mt-14 max-w-[930px] rounded-2xl border border-[#ddd5c8] bg-white/55 p-7 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-medium tracking-[0.2em] text-[#a18a64]">HOW IT FLOWS</p><h2 className="mt-2 font-display text-2xl text-[#173e70]">从理解自己，到遇见彼此</h2></div><p className="text-xs text-[#7c8b9d]">每一步都可以停下、调整，或暂不参与。</p></div>
          <ol className="mt-7 grid gap-5 sm:grid-cols-4">
            {steps.map(([title, body], index) => <li key={title} className="relative"><span className="grid h-7 w-7 place-items-center rounded-full border border-[#bfcddc] bg-[#fffdf8] text-xs text-[#1769d7]">{index + 1}</span><h3 className="mt-3 font-display text-lg text-[#173e70]">{title}</h3><p className="mt-2 text-xs leading-6 text-[#62758c]">{body}</p></li>)}
          </ol>
        </section>

        <div className="mx-auto mt-6 flex max-w-[930px] gap-3 rounded-xl border border-[#dbe4ed] bg-[#f2f7fb]/75 p-4 text-xs leading-6 text-[#496c90]"><LockSimple className="mt-0.5 shrink-0" size={18} weight="fill" /><p><strong>隐私边界：</strong>原始此刻记录与侧面原文不会直接展示给对方；连接仅在双方分别表达愿意认识后成立。</p></div>
      </section>
    </main>
  );
}
