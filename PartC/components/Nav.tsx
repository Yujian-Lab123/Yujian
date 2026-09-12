'use client';
import Link from 'next/link';
import { useMe } from '@/lib/useMe';

export function Logo({ tone }: { tone: 'blue' | 'warm' }) {
  const color = tone === 'blue' ? 'text-ink-900' : 'text-sumi-800';
  return (
    <span className={`font-display text-2xl font-bold tracking-widest ${color}`}>
      遇见
      <span className="ml-1 inline-block h-4 w-4 translate-y-0.5 rounded-sm bg-red-700/80 text-center text-[9px] leading-4 text-white">遇</span>
    </span>
  );
}

export default function Nav({ tone, tagline, right }: { tone: 'blue' | 'warm'; tagline: string; right?: React.ReactNode }) {
  const me = useMe();
  const link = tone === 'blue' ? 'text-sumi-600 hover:text-ink-700' : 'text-sumi-500 hover:text-sumi-800';
  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
      <div className="flex items-baseline gap-4">
        <Link href="/"><Logo tone={tone} /></Link>
        <span className="hidden text-sm text-sumi-400 md:inline">{tagline}</span>
      </div>
      <nav className="flex items-center gap-6 text-sm">
        {me.loggedIn ? (
          <>
            <Link className={link} href="/encounter">遇见</Link>
            <Link className={link} href="/connections">已遇见</Link>
            <Link className={link} href="/me">我的</Link>
          </>
        ) : (
          <>
            <span className={`hidden md:inline ${link}`}>关于遇见</span>
            <span className={`hidden md:inline ${link}`}>产品理念</span>
          </>
        )}
        {right ?? (
          me.loggedIn ? (
            <Link href="/me" className="flex items-center gap-2 rounded-full border border-ink-200 bg-white/70 px-4 py-1.5 text-ink-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-600 text-xs text-white">{me.user?.name?.slice(0, 1)}</span>
              {me.user?.name}
            </Link>
          ) : (
            <Link href="/" className={`rounded-lg border px-5 py-2 ${tone === 'blue' ? 'border-ink-300 text-ink-700 hover:bg-ink-50' : 'border-sumi-400 text-sumi-700 hover:bg-paper-200'}`}>登录</Link>
          )
        )}
      </nav>
    </header>
  );
}
