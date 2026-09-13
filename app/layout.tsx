import type { Metadata } from 'next';
import './globals.css';
import './motion.css';

export const metadata: Metadata = {
  title: '遇见 · 发现一个值得聊一句的人',
  description: '知乎已经帮你发现值得看的内容；遇见帮你通过内容，发现一个值得聊一句的人。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
