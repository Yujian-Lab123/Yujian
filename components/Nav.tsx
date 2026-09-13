'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CaretDownIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useMe } from '@/lib/useMe';
import { isNavItemActive, resolveNav } from '@/lib/experience-mode/nav';
import styles from './Nav.module.css';

export function Logo({ tone }: { tone: 'blue' | 'warm' }) {
  const color = tone === 'blue' ? 'text-ink-900' : 'text-[#0d4079]';
  return (
    <span className={`${styles.wordmark} ${color}`}>
      遇见
      <span className="ml-1 inline-block h-4 w-4 translate-y-0.5 rounded-sm bg-red-700/80 text-center text-[9px] leading-4 text-white">遇</span>
    </span>
  );
}

/** 导航始终随路由模式切换：/demo/** 下全部链接保持 /demo 前缀并显示演示徽章。 */
export default function Nav({ tone, tagline, right }: { tone: 'blue' | 'warm'; tagline: string; right?: React.ReactNode }) {
  const me = useMe();
  const pathname = usePathname() || '/';
  const { isDemo, items } = resolveNav(pathname);
  return (
    <header className="relative z-30 border-b border-[#b7a98e]/20 bg-[#fbf8f1]/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[74px] max-w-[1280px] items-center gap-8 px-5 lg:px-8">
        <Link href={isDemo ? '/demo/profile' : '/profile'} className="flex shrink-0 items-center gap-4" aria-label={isDemo ? '前往演示画像' : '前往个人画像'}>
          <Logo tone={tone} />
          <span className="hidden border-l border-[#c8b998] pl-4 text-[11px] leading-5 tracking-[0.08em] text-[#65758a] sm:block">
            在真实的生活里<br />遇见有趣的灵魂
          </span>
          {isDemo && (
            <span className="rounded-full border border-[#b8860b]/50 bg-[#fdf3d8] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#8a6d1a]">
              演示模式
            </span>
          )}
        </Link>

        <nav className="ml-auto hidden h-[74px] items-stretch lg:flex" aria-label="主要导航">
          {items.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              aria-current={isNavItemActive(href, pathname) ? 'page' : undefined}
              className={`flex items-center border-b-2 px-6 font-display text-[15px] font-semibold tracking-[0.08em] transition-colors ${
                isNavItemActive(href, pathname)
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
          {!isDemo && (
            <label className="hidden w-[250px] items-center gap-2 rounded-full border border-[#9dadc2]/35 bg-white/55 px-4 py-2 text-[#77859a] xl:flex">
              <MagnifyingGlassIcon size={18} aria-hidden />
              <input className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#8f99a7]" placeholder="搜索人、话题或内容…" aria-label="搜索人、话题或内容" />
            </label>
          )}

          {right ?? (
            <Link href={isDemo ? '/demo/me' : '/me'} className="flex shrink-0 items-center gap-2 text-[#173e70]" aria-label={isDemo ? '打开演示我的页面' : '打开我的页面'}>
              {!isDemo && me.loggedIn && me.user?.avatarUrl ? (
                // 真实登录后优先显示知乎头像；加载失败或未登录时回退到姓名首字
                <img
                  src={String(me.user.avatarUrl)}
                  alt={String(me.user?.name || '头像')}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full border border-[#c8b998]/70 object-cover"
                />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full border border-[#c8b998]/70 bg-[#e6dcc9] font-display text-sm">
                  {isDemo ? '演' : me.loggedIn ? me.user?.name?.slice(0, 1) : '遇'}
                </span>
              )}
              <CaretDownIcon size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1280px] overflow-x-auto border-t border-[#b7a98e]/15 px-3 lg:hidden" aria-label="主要导航">
        {items.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            aria-current={isNavItemActive(href, pathname) ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-4 py-2.5 font-display text-sm ${
              isNavItemActive(href, pathname) ? 'border-[#1769d7] text-[#1258bd]' : 'border-transparent text-[#536a84]'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
