#!/usr/bin/env node
// ============ 抓取知乎用户真实头像 ============
// 用法:node scripts/fetch-avatar.mjs <url_token 或主页URL> <slug>
// 例:  node scripts/fetch-avatar.mjs yyss2037 "YY硕(yyss2037)"
// 原理:拉取知乎个人主页 HTML,提取 zhimg.com 头像 URL,下载到 public/avatars/<slug>.jpg。
// /profile 页会自动优先使用本地头像;抓不到时回退水墨兜底图。也可手动把图片放到 public/avatars/。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [tokenArg, slugArg] = process.argv.slice(2);
if (!tokenArg || !slugArg) {
  console.error('用法:node scripts/fetch-avatar.mjs <url_token 或主页URL> <slug>');
  process.exit(1);
}

const urlToken = tokenArg.includes('/people/') ? tokenArg.split('/people/')[1].split(/[/?#]/)[0] : tokenArg;
const safeSlug = slugArg.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
const outDir = path.join(root, 'public', 'avatars');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${safeSlug}.jpg`);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function main() {
  // 1) 拉主页 HTML,从 js-initialData / og 信息里挖头像 URL
  const pageRes = await fetch(`https://www.zhihu.com/people/${urlToken}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!pageRes.ok) throw new Error(`主页 HTTP ${pageRes.status}(知乎可能拦截匿名访问,手动放图到 public/avatars/${safeSlug}.jpg 即可)`);
  const html = await pageRes.text();
  const patterns = [
    /"avatarUrl(?:Template)?"\s*:\s*"([^"]*zhimg\.com[^"]*?)"/,
    /<meta property="og:image" content="([^"]*zhimg\.com[^"]*)"/,
    /(https:\/\/pic\d\.zhimg\.com\/v2-[A-Za-z0-9_-]+(?:_[a-z])?\.jpg)/,
  ];
  let avatarUrl = null;
  for (const p of patterns) {
    const m = html.match(p);
    if (m) { avatarUrl = m[1].replace(/\\u002F/gi, '/').replace(/\\\//g, '/'); break; }
  }
  if (!avatarUrl) throw new Error('主页 HTML 里没找到头像 URL(可能被风控页替代),手动放图即可。');
  // 模板变量(_xs.jpg)转成小尺寸实图
  avatarUrl = avatarUrl.replace(/_(?:xs|s||m)\.jpg/, '_l.jpg').replace(/\{size\}/, 'l');

  // 2) 下载头像
  const imgRes = await fetch(avatarUrl, { headers: { 'User-Agent': UA, Referer: 'https://www.zhihu.com/' }, signal: AbortSignal.timeout(20_000) });
  if (!imgRes.ok) throw new Error(`头像下载 HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length < 1000) throw new Error('头像文件过小,疑似占位图');
  fs.writeFileSync(outPath, buf);
  console.log(`[avatar] OK:${outPath}(${Math.round(buf.length / 1024)}KB,来自 ${avatarUrl.slice(0, 60)}…)`);
}

main().catch((e) => {
  console.error(`[avatar] 失败:${e instanceof Error ? e.message : String(e)}`);
  console.error(`[avatar] 兜底:手动把图片另存为 public/avatars/${safeSlug}.jpg,刷新页面即生效。`);
  process.exit(1);
});
