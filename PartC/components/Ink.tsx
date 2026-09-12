// 水墨装饰背景：远山 / 飞鸟 / 淡日。tone: blue（外蓝）| warm（内暖）
export function InkScene({ tone, side = 'both' }: { tone: 'blue' | 'warm'; side?: 'left' | 'right' | 'both' }) {
  const ink = tone === 'blue' ? '#16337f' : '#6b665a';
  const soft = tone === 'blue' ? 'rgba(22,51,127,0.10)' : 'rgba(107,102,90,0.10)';
  const accent = tone === 'blue' ? 'rgba(15,76,232,0.16)' : 'rgba(169,131,74,0.18)';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {(side === 'left' || side === 'both') && (
        <svg className="absolute -left-10 bottom-0 w-[46vw] opacity-70" viewBox="0 0 600 400" fill="none">
          <path d="M0 400 L0 260 Q80 200 140 250 Q200 300 260 240 Q330 170 400 260 Q470 340 600 300 L600 400 Z" fill={soft} />
          <path d="M0 400 L0 320 Q90 270 170 320 Q260 375 360 320 Q470 260 600 350 L600 400 Z" fill={ink} opacity="0.14" />
          <circle cx="90" cy="120" r="46" fill={accent} />
        </svg>
      )}
      {(side === 'right' || side === 'both') && (
        <svg className="absolute -right-10 bottom-0 w-[42vw] opacity-70" viewBox="0 0 600 400" fill="none">
          <path d="M600 400 L600 240 Q520 190 460 250 Q400 310 330 250 Q260 190 180 270 Q110 340 0 310 L0 400 Z" fill={soft} />
          <path d="M600 400 L600 330 Q500 280 420 330 Q330 385 230 330 Q120 270 0 360 L0 400 Z" fill={ink} opacity="0.12" />
        </svg>
      )}
      <svg className="absolute right-[18%] top-[12%] w-24 opacity-50" viewBox="0 0 100 40" fill="none">
        <path d="M5 20 Q15 10 25 20 M30 14 Q40 4 50 14 M55 24 Q65 14 75 24" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 头像：水墨渐变圆 + 姓氏字
export function InkAvatar({ name, tone, size = 96 }: { name: string; tone: 'blue' | 'warm'; size?: number }) {
  const bg = tone === 'blue'
    ? 'radial-gradient(circle at 35% 30%, #dfe9ff 0%, #9db8ee 45%, #35549b 100%)'
    : 'radial-gradient(circle at 35% 30%, #fdf8ee 0%, #d9c9a8 45%, #8a7a58 100%)';
  return (
    <div
      className="relative flex items-center justify-center rounded-full shadow-inner"
      style={{ width: size, height: size, background: bg }}
    >
      <span className="font-display text-white/90" style={{ fontSize: size * 0.38 }}>{name.slice(0, 1)}</span>
      <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink-600 text-[11px] text-white shadow">遇</span>
    </div>
  );
}

// 文章封面占位：水墨小景
export function InkCover({ seed, tone = 'warm' }: { seed: string; tone?: 'blue' | 'warm' }) {
  const hues = tone === 'warm'
    ? ['#e9dfc9', '#d9c9a8', '#b7a67f']
    : ['#e2ebfd', '#c3d4f9', '#8fb0f2'];
  const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ background: `linear-gradient(160deg, ${hues[0]}, ${hues[1]})` }}>
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 200 90" fill="none">
        <path d={`M0 90 L0 ${50 + (h % 15)} Q50 ${30 + (h % 20)} 100 ${55 - (h % 10)} Q150 ${75 - (h % 15)} 200 ${45 + (h % 12)} L200 90 Z`} fill={hues[2]} opacity="0.7" />
        <circle cx={40 + (h % 120)} cy="26" r="10" fill="#fff" opacity="0.5" />
      </svg>
    </div>
  );
}
