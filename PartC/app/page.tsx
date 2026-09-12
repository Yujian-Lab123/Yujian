'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import { useMe } from '@/lib/useMe';
import styles from './p7-landing.module.css';

const OAUTH_ERRORS: Record<string, string> = {
  not_configured: '知乎 OAuth 未配置或配置不完整，请检查服务器环境变量。',
  code_missing: '知乎回调未返回授权码，请确认授权流程完整。',
  state_mismatch: '安全校验未通过（state 不匹配），请重新发起登录。',
  token_exchange_failed: '换取知乎令牌失败，可在 /api/auth/zhihu/status 查看脱敏诊断。',
  profile_failed: '获取知乎用户信息失败，请重试。',
  oauth_failed: '知乎登录未完成，请重试。',
};

export default function Landing() {
  const router = useRouter();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [realLogin, setRealLogin] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'error') setOauthError(OAUTH_ERRORS[params.get('reason') || ''] || OAUTH_ERRORS.oauth_failed);
    fetch('/api/auth/zhihu/status').then((r) => r.json()).then((d) => setRealLogin(Boolean(d?.configured))).catch(() => {});
  }, []);

  const enter = async () => {
    if (me.loggedIn) return router.push('/encounter');
    setBusy(true);
    await fetch('/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    router.push('/onboarding');
  };

  return (
    <main className={`relative min-h-[100dvh] overflow-hidden bg-[#f4f5f7] ink-texture-blue ${styles.page}`}>
      <InkScene tone="blue" />
      <Nav tone="blue" tagline="因文而遇 · 智识相知" />

      {oauthError && (
        <div className="relative z-20 mx-auto mt-4 max-w-xl px-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            知乎登录未完成：{oauthError}
            <button className="ml-3 underline" onClick={() => setOauthError(null)}>知道了</button>
          </div>
        </div>
      )}

      {/* 竖排诗句 */}
      <div className="vertical-rl absolute right-10 top-40 hidden select-none font-display text-sm text-sumi-400 lg:block">
        <p>每一篇认真写下的文字</p>
        <p className="mt-4">都在为描绘一幅</p>
        <p className="mt-4">独一无二的你</p>
      </div>

      <section className="relative z-10 mx-auto max-w-4xl px-4 pt-8 text-center sm:px-6 sm:pt-14 md:pt-20">
        <h1 className="brush-in font-display text-4xl font-bold leading-tight text-ink-900 sm:text-5xl md:text-6xl">
          发现一个值得聊一句的人
        </h1>
        <svg className={`mx-auto mt-1 w-52 opacity-60 sm:-mt-1 sm:w-64 ${styles.brushStroke}`} viewBox="0 0 300 20" fill="none" aria-hidden="true">
          <path d="M10 12 Q150 2 290 10" stroke="#0f4ce8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </svg>

        <div className="fade-up-1 mt-7 space-y-3 text-base leading-7 text-sumi-600 sm:mt-8 sm:text-lg">
          <p><span className="font-display font-semibold text-ink-700">知乎</span><span className="mx-3 text-sumi-300">|</span>帮你发现值得看的内容，</p>
          <p><span className="font-display font-semibold text-ink-700">遇见</span><span className="mx-3 text-sumi-300">|</span>帮你通过内容发现值得聊一句的人。</p>
        </div>

        <div className="fade-up-2 mt-10">
          {realLogin ? (
            <div className="space-y-3">
              <a href="/api/auth/zhihu" className="btn-primary-blue inline-flex w-full max-w-sm px-8 text-lg sm:w-auto sm:px-14">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-bold text-ink-600">知</span>
                使用知乎账号登录
              </a>
              <div>
                <button onClick={enter} disabled={busy} className="btn-ghost text-sm">
                  {me.loggedIn ? '继续（演示身份）' : busy ? '正在进入…' : '先以演示身份体验'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={enter} disabled={busy} className="btn-primary-blue w-full max-w-sm px-8 text-lg sm:w-auto sm:px-14">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-bold text-ink-600">知</span>
              {me.loggedIn ? '继续遇见' : busy ? '正在进入…' : '使用知乎继续'}
            </button>
          )}
          <p className="mx-auto mt-4 max-w-xl text-xs leading-5 text-sumi-400">🔒 遇见基于知乎内容与关系，保护你的隐私与安全{!realLogin && !me.loggedIn && '（Demo 模式：使用模拟身份体验）'}</p>
        </div>
      </section>

      {/* 下半：理念卡 */}
      <section className="relative z-10 mx-auto mt-12 max-w-6xl px-4 pb-16 sm:mt-16 sm:px-6 sm:pb-20">
        <div className="card-blue grid gap-8 p-5 sm:p-8 md:grid-cols-2 md:gap-10 md:p-12">
          <div className="fade-up-2">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-2xl">🖋</div>
            <h2 className="font-display text-2xl leading-snug text-ink-900 sm:text-3xl">
              你不需要<br />重新写一份自我介绍，
            </h2>
            <h2 className="mt-2 font-display text-2xl leading-snug text-ink-600 sm:text-3xl">
              你写过的东西，<br />本身就是。
            </h2>
            <p className="mt-6 text-sm leading-6 text-sumi-500">
              遇见会读懂你写过的内容，理解你的思想、兴趣与价值观，帮你找到可能聊得来的人。
            </p>
            <svg className="mt-6 w-40 opacity-50" viewBox="0 0 160 12" fill="none">
              <path d="M4 8 Q60 2 156 6" stroke="#16337f" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <div className="fade-up-3 rounded-xl border border-ink-100 bg-white/70 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold text-ink-900">遇见 <span className="text-sm text-sumi-400">· AI 理解中</span></p>
              <p className="text-xs text-sumi-400">已理解 76%</p>
            </div>
            <p className="mt-2 text-xs text-sumi-400">基于你在知乎的内容，遇见正在构建你的理解画像</p>
            <div className="mt-4 space-y-3">
              {[
                ['💡', '思想观念', '你关注个体成长与社会连接，思考科技发展对人类生活的影响', ['独立思考', '人文关怀']],
                ['⭐', '兴趣偏好', '你对心理学、科技、产品与设计感兴趣，喜欢深度分析与讨论', ['心理学', '科技', '产品设计']],
                ['🖋', '表达风格', '你的表达细腻真诚、逻辑清晰，擅长用故事和例子传递观点', ['真诚细腻', '逻辑清晰']],
                ['❤️', '价值取向', '你重视真诚、成长与创造，愿意尝试与探索更好的可能性', ['真诚', '成长', '创造']],
              ].map(([icon, title, text, tags]: any) => (
                <div key={title} className="flex items-start gap-3 rounded-lg bg-ink-50/50 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{title}</p>
                    <p className="mt-0.5 truncate text-xs text-sumi-500">{text}</p>
                  </div>
                  <div className="hidden shrink-0 gap-1 sm:flex">
                    {tags.map((t: string) => <span key={t} className="chip-blue">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-sumi-400">🔒 所有分析仅你可见，不会用于推荐或对外展示</p>
          </div>
        </div>
      </section>
    </main>
  );
}
