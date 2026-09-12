'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { InkScene } from '@/components/Ink';
import Nav from '@/components/Nav';
import { MOODS, STATES } from '@/lib/axes';
import { useMe } from '@/lib/useMe';

const MOOD_ICONS: Record<string, string> = { 平静: '☁', 期待: '☀', 开心: '☺', 疲惫: '☾', 迷茫: '✳' };
const STATE_ICONS: Record<string, string> = { 学习中: '📖', 工作中: '💼', 创作中: '✏', 休息中: '☕', 其他: '⊞' };

const DEMO_IDS = [
  ['u0', '江树 · 产品经理（默认）'],
  ['u1', '远山与近海 · 研究员'],
  ['u3', '阿屿 · 户外领队'],
  ['u6', '老猫 · 价值投资者'],
];

export default function MePage() {
  const router = useRouter();
  const me = useMe();
  const [mood, setMood] = useState('');
  const [state, setState] = useState('');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  if (!me.loading && !me.loggedIn) {
    return (
      <main className="min-h-screen bg-paper-100 pt-24 text-center">
        <p className="text-sumi-500">请先登录。<button className="text-ink-600 underline" onClick={() => router.push('/')}>去首页</button></p>
      </main>
    );
  }

  const saveState = async () => {
    const full = [state, text].filter(Boolean).join('，');
    await fetch('/api/me/current-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: full || mood, mood }) });
    setSaved(true);
    setText('');
    me.refresh();
  };

  const toggle = async (enabled: boolean) => {
    await fetch('/api/me/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
    me.refresh();
  };

  const switchUser = async (userId: string) => {
    await fetch('/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    router.push('/onboarding');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-100 paper-texture">
      <InkScene tone="warm" side="both" />
      <Nav tone="warm" tagline="知乎孵化的人际连接产品" />

      <section className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-2">
        {/* 左：今天怎么样 */}
        <div className="card-warm fade-up p-8 md:p-10">
          <h1 className="font-display text-3xl text-ink-800">今天怎么样？</h1>
          <svg className="mt-2 w-10 opacity-70" viewBox="0 0 40 8" fill="none"><path d="M2 5 Q20 2 38 4" stroke="#a9834a" strokeWidth="2" strokeLinecap="round" /></svg>

          <p className="mt-7 text-sm text-sumi-600">此刻心情</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {MOODS.map((m) => (
              <button key={m} onClick={() => setMood(m)}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${mood === m ? 'border-ink-500 bg-ink-50 text-ink-700' : 'border-paper-300 bg-white/60 text-sumi-500 hover:border-paper-400'}`}>
                <span className="text-xs opacity-70">{MOOD_ICONS[m]}</span>{m}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm text-sumi-600">此刻状态</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {STATES.map((s) => (
              <button key={s} onClick={() => setState(s)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-5 py-3 text-sm transition ${state === s ? 'border-ink-500 bg-ink-50 text-ink-700' : 'border-paper-300 bg-white/60 text-sumi-500 hover:border-paper-400'}`}>
                <span className="text-base opacity-80">{STATE_ICONS[s]}</span>{s}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm text-sumi-600">想记录点什么？</p>
          <textarea
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="此刻的想法，感受，或是一个小小的念头…"
            className="mt-3 w-full rounded-xl border border-paper-300 bg-white/70 p-4 text-sm outline-none focus:border-ink-400"
          />
          <p className="mt-1 text-right text-[11px] text-sumi-400">{text.length} / 300</p>

          <button onClick={saveState} className="btn-primary-blue mt-4 w-full !rounded-xl !bg-ink-800 hover:!bg-ink-900">
            记下此刻 {saved && <span className="text-xs opacity-80">✓ 已记下</span>}
          </button>
          {me.currentState && (
            <p className="mt-4 rounded-lg bg-paper-200/70 p-3 text-xs text-sumi-500">此刻：{me.currentState.text || me.currentState.mood}</p>
          )}
        </div>

        {/* 右：遇见设置 + AI 理解摘要 */}
        <div className="card-warm fade-up-1 p-8 md:p-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-3xl text-ink-800">遇见设置</h2>
              <svg className="mt-2 w-10 opacity-70" viewBox="0 0 40 8" fill="none"><path d="M2 5 Q20 2 38 4" stroke="#a9834a" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-sm text-sumi-700">遇见</span>
                <button
                  onClick={() => toggle(me.user?.encounter_enabled !== 1)}
                  className={`relative h-6 rounded-full transition ${me.user?.encounter_enabled === 1 ? 'bg-ink-700' : 'bg-paper-300'}`}
                  style={{ width: 44 }}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${me.user?.encounter_enabled === 1 ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="mt-1 max-w-[180px] text-[10px] text-sumi-400">开启后，将为你推荐可能聊得来的人</p>
            </div>
          </div>

          <p className="mt-7 text-sm text-sumi-600">偏好设置</p>
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-paper-300 bg-white/50 p-4 sm:grid-cols-3">
            {[['🧭', '兴趣领域', '阅读、心理学、科技'], ['💬', '交流偏好', '深度交流、真诚友善'], ['❤', '关系期待', '互相启发、共同成长']].map(([i, t, s]) => (
              <button key={t} onClick={() => alert('第一版无需配置：AI 会从你写过的内容里理解这些。')} className="flex items-center gap-2.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 text-sm">{i}</span>
                <span className="min-w-0">
                  <span className="block text-sm text-sumi-700">{t} <span className="text-sumi-300">›</span></span>
                  <span className="block truncate text-[10px] text-sumi-400">{s}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-paper-300 bg-white/50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-sumi-700">AI 理解摘要 <span className="text-sumi-300">ⓘ</span></p>
              <p className="text-[10px] text-sumi-400">更新时间：今天</p>
            </div>
            <div className="mt-3 rounded-lg bg-paper-100 p-6 text-center">
              {me.understanding ? (
                <>
                  <p className="font-display text-2xl leading-snug text-ink-800">{me.understanding.coreQuestion}</p>
                  <svg className="mx-auto mt-3 w-24 opacity-70" viewBox="0 0 100 8" fill="none"><path d="M2 5 Q50 1 98 4" stroke="#a9834a" strokeWidth="2" strokeLinecap="round" /></svg>
                  <p className="mt-3 text-[11px] text-sumi-400">基于你的记录与内容，AI 为你生成的理解摘要</p>
                  <p className="mt-2 text-xs leading-6 text-sumi-500">
                    你长期在意的：{me.understanding.topics.join('、')}。你正在寻找能真诚交流、彼此启发的伙伴。
                  </p>
                  <button className="mt-3 text-xs text-ink-600 underline" onClick={() => router.push('/profile')}>查看完整画像 ›</button>
                </>
              ) : (
                <p className="text-sm text-sumi-400">还没有理解摘要。<button className="text-ink-600 underline" onClick={() => router.push('/onboarding')}>开始理解 →</button></p>
              )}
            </div>
          </div>

          {/* 演示身份 */}
          <div className="mt-6 border-t border-paper-300 pt-4">
            <p className="text-[11px] text-sumi-400">演示身份切换（比赛演示用）</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_IDS.map(([id, label]) => (
                <button key={id} onClick={() => switchUser(id)} className={`chip-warm ${me.user?.id === id ? '!bg-gold-500 !text-white' : ''}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 flex flex-col items-center justify-between gap-3 px-8 pb-8 text-[11px] text-sumi-400 md:flex-row">
        <p>遇见，连接真实的彼此</p>
        <p className="flex gap-6"><span>隐私政策</span><span>用户协议</span><span>帮助中心</span></p>
      </footer>
    </main>
  );
}
