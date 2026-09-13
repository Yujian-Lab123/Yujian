'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMe } from '@/lib/useMe';

/**
 * 关于遇见 /about —— 产品介绍与唯一入口页。
 *
 * 这是旧 Landing（app/page.tsx）的接替者：根路径 `/` 只做跳转，产品理念、隐私边界、
 * 登录入口统一收在这里，避免首页同时承担「介绍」和「进入」两件事。
 * 本页不承载任何个人数据管理，登录后的一切都发生在 /profile、/me、/side、/encounter。
 */

const OAUTH_ERRORS: Record<string, string> = {
  not_configured: '知乎 OAuth 未配置或配置不完整，请检查服务器环境变量。',
  code_missing: '知乎回调未返回授权码，请确认授权流程完整。',
  state_mismatch: '安全校验未通过（state 不匹配），请重新发起登录。',
  token_exchange_failed: '换取知乎令牌失败，可在 /api/auth/zhihu/status 查看脱敏诊断。',
  profile_failed: '获取知乎用户信息失败，请重试。',
  oauth_failed: '知乎登录未完成，请重试。',
};

const navLinks = [
  ['个人', '/profile'],
  ['此刻', '/me'],
  ['侧面', '/side'],
  ['遇见', '/encounter'],
  ['关于遇见', '/about'],
] as const;

const pillars = [
  {
    no: '一',
    title: '你写过的东西，本身就是自我介绍',
    body: '不需要重新填一份问卷。遇见会读懂你长期留下的公开内容，理解你的思想、兴趣与价值观，而不是让你把自己压缩成几个标签。',
  },
  {
    no: '二',
    title: '先看见思想，再遇见彼此',
    body: '推荐从一篇内容开始，而不是从一张头像开始。你会先读到对方真正写过的东西，再决定要不要往下走一步。',
  },
  {
    no: '三',
    title: '连接必须双向，才成立',
    body: '只有两个人分别表达了想认识的意愿，连接才会建立。任何一方没有回应，另一方也不会被打扰。',
  },
];

const dimensions = [
  {
    no: '1',
    name: '人生轨迹',
    note: '走过什么',
    body: '从长期内容里还原的时间线：做过什么、在哪里、为什么转向。',
  },
  {
    no: '2',
    name: '长期关切与驱动力',
    note: '在意什么',
    body: '反复出现的问题和背后的推动力，是判断「聊不聊得来」的主要依据。',
  },
  {
    no: '3',
    name: '决策模式',
    note: '怎么选择',
    body: '面对取舍时的思考方式与步骤，而不是结论本身。',
  },
  {
    no: '4',
    name: '价值取舍',
    note: '看重什么',
    body: '在两端之间更倾向哪一边，以及这个倾向的证据。',
  },
  {
    no: '5',
    name: '对话风格',
    note: '怎么聊',
    body: '表达的方式，以及真正聊得下去的切入点。',
  },
  {
    no: '6',
    name: '代表内容',
    note: '写了什么',
    body: '最能说明这个人的几篇原文，可逐条回看依据。',
  },
];

export default function AboutPage() {
  const router = useRouter();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [realLogin, setRealLogin] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'error') {
      setOauthError(OAUTH_ERRORS[params.get('reason') || ''] || OAUTH_ERRORS.oauth_failed);
    }
    fetch('/api/auth/zhihu/status')
      .then((r) => r.json())
      .then((d) => setRealLogin(Boolean(d?.configured)))
      .catch(() => {});
  }, []);

  const enter = async () => {
    if (me.loggedIn) return router.push('/encounter');
    // 演示体验走独立的 /demo 路由与会话（与真实账号完全隔离）。
    router.push('/demo');
  };

  return (
    <main className="min-h-screen bg-[#fbf8f1]">
      <header className="relative z-30 border-b border-[#b7a98e]/20 bg-[#fbf8f1]/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-[74px] max-w-[1280px] items-center gap-8 px-5 lg:px-8">
          <Link href="/profile" className="flex shrink-0 items-center gap-4" aria-label="前往个人画像">
            <span className="font-display text-[28px] font-bold tracking-[0.16em] text-[#173e70]">遇见</span>
            <span className="hidden border-l border-[#c8b998] pl-4 text-[11px] leading-5 tracking-[0.08em] text-[#65758a] sm:block">
              在真实的生活里<br />遇见有趣的灵魂
            </span>
          </Link>

          <nav className="ml-auto hidden h-[74px] items-stretch lg:flex" aria-label="主要导航">
            {navLinks.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                aria-current={href === '/about' ? 'page' : undefined}
                className={`flex items-center border-b-2 px-6 font-display text-[15px] font-semibold tracking-[0.08em] transition-colors ${
                  href === '/about'
                    ? 'border-[#1769d7] text-[#1258bd]'
                    : 'border-transparent text-[#173e70] hover:border-[#b7c8df] hover:text-[#1258bd]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* 右栏占位槽：与 Nav.tsx 同宽，避免「进入遇见」按钮比搜索框+头像短导致整排导航左移 */}
          <div className="flex shrink-0 items-center justify-end gap-4 xl:w-[340px]">
            <Link
              href={me.loggedIn ? '/me' : '#enter'}
              onClick={me.loggedIn ? undefined : (e) => { e.preventDefault(); document.getElementById('enter')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="flex shrink-0 items-center gap-2 rounded-full border border-[#c8b998]/70 bg-white/60 px-4 py-1.5 text-sm text-[#173e70] transition-colors hover:border-[#1769d7] hover:text-[#1258bd]"
            >
              {me.loggedIn ? `回到 ${me.user?.name ?? '遇见'}` : '进入遇见'}
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1280px] overflow-x-auto border-t border-[#b7a98e]/15 px-3 lg:hidden" aria-label="移动端主要导航">
          {navLinks.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              aria-current={href === '/about' ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-4 py-2.5 font-display text-sm ${
                href === '/about' ? 'border-[#1769d7] text-[#1258bd]' : 'border-transparent text-[#536a84]'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {oauthError && (
        <div role="alert" className="relative z-20 mx-auto mt-6 max-w-3xl px-5 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            知乎登录未完成：{oauthError}
            <button type="button" className="ml-3 underline" onClick={() => setOauthError(null)}>知道了</button>
          </div>
        </div>
      )}

      <section className="mo-page-in mx-auto max-w-[1280px] px-5 pb-16 pt-16 lg:px-8 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <p className="font-display text-[13px] tracking-[0.24em] text-[#8a7a5c]">关于遇见</p>
            <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.28] tracking-[0.03em] text-[#173e70] sm:text-[52px]">
              发现一个<br />值得聊一句的人
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-8 text-[#536a84]">
              知乎帮你发现值得看的内容，遇见帮你通过内容发现值得聊一句的人。
              我们相信，一个人认真写下过的文字，比任何一份自我介绍都更能说明他是谁。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#cfd5dc] bg-white/60 px-3.5 py-1.5 text-[#627083]">基于长期公开内容</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#cfd5dc] bg-white/60 px-3.5 py-1.5 text-[#627083]">双向意愿才连接</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#cfd5dc] bg-white/60 px-3.5 py-1.5 text-[#627083]">原始文字不外显</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#d8cfbd] bg-white/55 p-6 lg:p-7">
            <p className="font-display text-sm font-semibold tracking-[0.08em] text-[#173e70]">遇见 · 理解一个人的六个维度</p>
            <p className="mt-2 text-xs leading-6 text-[#77859a]">
              每条结论都可以回看它来自哪几篇原文，没有证据的结论不会留下。
            </p>
            <ul className="mt-5 space-y-3">
              {dimensions.map((d) => (
                <li key={d.no} className="flex gap-3 border-b border-[#e6ddcc] pb-3 last:border-0 last:pb-0">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#c8b998] font-display text-[11px] text-[#8a7a5c]">{d.no}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#173e70]">
                      <strong className="font-medium">{d.name}</strong>
                      <span className="ml-2 text-[11px] text-[#a09a8e]">{d.note}</span>
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-[#77859a]">{d.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/profile" className="mt-5 inline-flex items-center gap-1.5 text-xs text-[#1769d7] underline underline-offset-4">
              看一份真实生成的人物画像 ›
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#b7a98e]/20 bg-[#f7f1e7]">
        <div className="mx-auto max-w-[1280px] px-5 py-16 lg:px-8 lg:py-20">
          <h2 className="font-display text-[26px] tracking-[0.06em] text-[#173e70]">遇见怎么想这件事</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.no}>
                <span className="font-display text-[13px] tracking-[0.2em] text-[#b0a184]">{p.no}</span>
                <h3 className="mt-3 font-display text-[19px] leading-relaxed text-[#173e70]">{p.title}</h3>
                <p className="mt-3 text-[13px] leading-7 text-[#627083]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mo-page-in mx-auto max-w-[1280px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-[22px] tracking-[0.06em] text-[#173e70]">隐私边界</h2>
            <ul className="mt-6 space-y-4 text-[13px] leading-7 text-[#627083]">
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#b0a184]" />
                <span>AI 对你的分析<strong className="font-medium text-[#173e70]">只有你自己看得到</strong>，不会对外展示，也不会作为公开资料。</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#b0a184]" />
                <span>参与匹配时，对方看到的只是<strong className="font-medium text-[#173e70]">结构化摘要</strong>，不是你的原始记录。</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#b0a184]" />
                <span>你可以随时关闭「愿意遇见」，或只让某一个侧面参与相遇。</span>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-[22px] tracking-[0.06em] text-[#173e70]">三个自我，各管一件事</h2>
            <ul className="mt-6 space-y-4 text-[13px] leading-7 text-[#627083]">
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#b0a184]" />
                <span><Link href="/profile" className="text-[#1769d7] underline underline-offset-4">个人</Link>：长期以来我是谁，由公开发表的内容生成。</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#b0a184]" />
                <span><Link href="/me" className="text-[#1769d7] underline underline-offset-4">此刻</Link>：我现在怎么样，短周期、可随时更新。</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#b0a184]" />
                <span><Link href="/side" className="text-[#1769d7] underline underline-offset-4">侧面</Link>：我希望从哪一面被理解，由我决定要不要公开。</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="enter" className="border-t border-[#b7a98e]/20 bg-[#f7f1e7]">
        <div className="mx-auto max-w-[720px] px-5 py-20 text-center lg:px-8">
          <h2 className="font-display text-[28px] tracking-[0.06em] text-[#173e70]">开始之前</h2>
          <p className="mx-auto mt-4 max-w-lg text-[13px] leading-7 text-[#627083]">
            遇见基于知乎的内容与关系。完成登录后，我们会读取你公开写过的东西，生成一份只有你能看到的理解画像。
          </p>

          <div className="mt-9">
            {realLogin ? (
              <div className="space-y-3">
                <a
                  href="/api/auth/zhihu"
                  className="inline-flex items-center gap-3 rounded-lg bg-[#173e70] px-10 py-3.5 text-[15px] text-white transition-colors hover:bg-[#1258bd]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded bg-white font-display text-xs text-[#173e70]">知</span>
                  使用知乎账号登录
                </a>
                <div>
                  <button type="button" onClick={enter} disabled={busy} className="text-sm text-[#77859a] underline underline-offset-4 disabled:opacity-50">
                    {me.loggedIn ? '继续（演示身份）' : busy ? '正在进入…' : '先以演示身份体验'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={enter}
                disabled={busy}
                className="inline-flex items-center gap-3 rounded-lg bg-[#173e70] px-10 py-3.5 text-[15px] text-white transition-colors hover:bg-[#1258bd] disabled:opacity-50"
              >
                <span className="grid h-6 w-6 place-items-center rounded bg-white font-display text-xs text-[#173e70]">知</span>
                {me.loggedIn ? '继续遇见' : busy ? '正在进入…' : '使用知乎继续'}
              </button>
            )}
          </div>

          <p className="mt-5 text-xs leading-6 text-[#a09a8e]">
            {!realLogin && !me.loggedIn
              ? '当前为预览模式：知乎 OAuth 尚未接入，将使用内置预览数据体验完整流程。'
              : '登录即表示你同意我们按上述边界处理你的公开内容。'}
          </p>
        </div>
      </section>

      <footer className="px-5 py-10 text-center lg:px-8">
        <p className="font-display text-sm tracking-[0.12em] text-[#a09a8e]">先看见思想，再遇见彼此。</p>
        <p className="mt-3 text-xs text-[#b0a184]">遇见 · 连接真实的彼此</p>
      </footer>
    </main>
  );
}
