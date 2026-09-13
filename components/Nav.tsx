'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CaretDownIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useMe } from '@/lib/useMe';
import styles from './Nav.module.css';

const productNav = [
  ['个人', '/profile'],
  ['此刻', '/me'],
  ['侧面', '/side'],
  ['遇见', '/encounter'],
  ['关于遇见', '/about'],
] as const;

export function Logo({ tone }: { tone: 'blue' | 'warm' }) {
  const color = tone === 'blue' ? 'text-ink-900' : 'text-[#0d4079]';
  return (
    <span className={`${styles.wordmark} ${color}`}>
      遇见
      <span className="ml-1 inline-block h-4 w-4 translate-y-0.5 rounded-sm bg-red-700/80 text-center text-[9px] leading-4 text-white">遇</span>
    </span>
  );
}

export default function Nav({ tone, tagline, right }: { tone: 'blue' | 'warm'; tagline: string; right?: React.ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href === '/encounter' && pathname.startsWith('/encounter'));
  return (
    <header className="relative z-30 border-b border-[#b7a98e]/20 bg-[#fbf8f1]/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[74px] max-w-[1280px] items-center gap-8 px-5 lg:px-8">
        <Link href="/profile" className="flex shrink-0 items-center gap-4" aria-label="前往个人画像">
          <Logo tone={tone} />
          <span className="hidden border-l border-[#c8b998] pl-4 text-[11px] leading-5 tracking-[0.08em] text-[#65758a] sm:block">
            在真实的生活里<br />遇见有趣的灵魂
          </span>
        </Link>

        <nav className="ml-auto hidden h-[74px] items-stretch lg:flex" aria-label="主要导航">
          {productNav.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`flex items-center border-b-2 px-6 font-display text-[15px] font-semibold tracking-[0.08em] transition-colors ${
                isActive(href)
                  ? 'border-[#1769d7] text-[#1258bd]'
                  : 'border-transparent text-[#173e70] hover:border-[#b7c8df] hover:text-[#1258bd]'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/*
          右栏占位槽：固定宽度，保证无论里面放什么（搜索框+头像 / 自定义 right），
          都从同一个锚点向右排列。否则各页面右栏内容不同，用 ml-auto 会让整个
          nav 块跟着右栏宽度左右漂移 —— 这就是切页时导航"跳一下"的根因。
        */}
        <div className="flex shrink-0 items-center justify-end gap-4 xl:w-[340px]">
          <label className="hidden w-[250px] items-center gap-2 rounded-full border border-[#9dadc2]/35 bg-white/55 px-4 py-2 text-[#77859a] xl:flex">
            <MagnifyingGlassIcon size={18} aria-hidden />
            <input className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#8f99a7]" placeholder="搜索人、话题或内容…" aria-label="搜索人、话题或内容" />
          </label>

          {right ?? (
            <Link href="/me" className="flex shrink-0 items-center gap-2 text-[#173e70]" aria-label="打开我的页面">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-[#c8b998]/70 bg-[#e6dcc9] font-display text-sm">
                {me.loggedIn ? me.user?.name?.slice(0, 1) : '遇'}
              </span>
              <CaretDownIcon size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1280px] overflow-x-auto border-t border-[#b7a98e]/15 px-3 lg:hidden" aria-label="移动端主要导航">
        {productNav.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-4 py-2.5 font-display text-sm ${
              isActive(href) ? 'border-[#1769d7] text-[#1258bd]' : 'border-transparent text-[#536a84]'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
