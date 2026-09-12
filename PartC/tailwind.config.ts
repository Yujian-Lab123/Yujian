import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 外蓝：知乎蓝墨系
        ink: {
          50: '#f2f6ff',
          100: '#e2ebfd',
          200: '#c3d4f9',
          300: '#8fb0f2',
          400: '#5585ea',
          500: '#2f63e0',
          600: '#0f4ce8',
          700: '#16337f',
          800: '#122a68',
          900: '#0d1b3e',
        },
        // 内暖：米纸暖色系
        paper: {
          50: '#fdfbf7',
          100: '#faf6ee',
          200: '#f3ecdf',
          300: '#e9dfc9',
          400: '#d9c9a8',
        },
        gold: {
          400: '#c8a061',
          500: '#a9834a',
          600: '#8c6a39',
        },
        sumi: {
          400: '#8a8578',
          500: '#6b665a',
          600: '#4c483d',
          700: '#3a362c',
          800: '#262319',
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Songti SC"', 'STSong', 'SimSun', 'serif'],
        body: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 30px rgba(13, 27, 62, 0.08)',
        'card-warm': '0 8px 30px rgba(76, 60, 30, 0.10)',
      },
      letterSpacing: {
        widest2: '0.2em',
      },
    },
  },
  plugins: [],
};

export default config;
