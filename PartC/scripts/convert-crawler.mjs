#!/usr/bin/env node
// ============ MediaCrawler → 画像引擎 转换桥 ============
// 用法(项目根目录):
//   抓取+转换一步: node scripts/convert-crawler.mjs --crawl --name "大V名"
//   只转换已有数据: node scripts/convert-crawler.mjs --name "大V名" [--author "作者名"]
// 输入: media-crawler/data/zhihu/*contents*.jsonl (MediaCrawler creator 模式的输出)
// 输出: data/crawler/<名字>.json (画像 CLI 的 --input 格式)

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crawlerDataDir = path.join(root, 'media-crawler', 'data', 'zhihu');
const outDir = path.join(root, 'data', 'crawler');

function parseArgs(argv) {
  const flags = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i]?.startsWith('--')) flags[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
  }
  return flags;
}

function readJsonlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...readJsonlFiles(p));
    else if (entry.name.endsWith('.jsonl') && /contents/i.test(entry.name) && !/comment/i.test(entry.name)) files.push(p);
  }
  return files;
}

const args = parseArgs(process.argv);
if (!args.name) {
  console.error('用法:node scripts/convert-crawler.mjs --crawl --name "大V名"\n      node scripts/convert-crawler.mjs --name "大V名" [--author "作者名"]');
  process.exit(1);
}

// --crawl:先跑 MediaCrawler(知乎 creator 模式;浏览器弹出后用知乎 App 扫码登录)
if (args.crawl) {
  console.error('[convert] 启动 MediaCrawler(知乎 creator 模式)……浏览器弹出后请扫码登录;登录态会被记住,下次无需再扫。');
  const r = spawnSync('python', ['main.py', '--platform', 'zhihu', '--type', 'creator', '--lt', 'qrcode'], {
    cwd: path.join(root, 'media-crawler'), stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error(`[convert] MediaCrawler 退出码 ${r.status}(若为 1 且已抓到数据可忽略,继续转换)。`);
  }
}

const files = readJsonlFiles(crawlerDataDir);
if (files.length === 0) {
  console.error(`[convert] ${crawlerDataDir} 下没有 contents jsonl。先运行:node scripts/convert-crawler.mjs --crawl --name "大V名"`);
  process.exit(1);
}

const seen = new Set();
const items = [];
for (const f of files) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const text = String(row.content_text || row.content || '').trim();
    const id = String(row.content_id || row.id || '');
    if (!text || !id || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: String(row.title || ''),
      text,
      type: String(row.content_type || row.type || ''),
      url: String(row.content_url || row.content_url || row.url || ''),
      published_at: row.created_time ?? row.publish_time ?? row.published_at ?? null,
      author: String(row.user_nickname || row.author_name || row.author || ''),
    });
  }
}

let out = items;
if (args.author) {
  const q = String(args.author).toLowerCase();
  out = items.filter((it) => it.author.toLowerCase().includes(q));
}

out.sort((a, b) => String(a.published_at ?? 0).localeCompare(String(b.published_at ?? 0)));

fs.mkdirSync(outDir, { recursive: true });
const slug = String(args.name).replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
const outPath = path.join(outDir, `${slug}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

const types = {};
for (const it of out) types[it.type || '?'] = (types[it.type || '?'] || 0) + 1;
const dated = out.filter((it) => it.published_at);
console.error(`[convert] ${files.length} 个文件,原始 ${items.length} 条,输出 ${out.length} 条(${Object.entries(types).map(([k, v]) => `${k}${v}`).join('/')})${dated.length ? `,时间 ${new Date(Number(dated[0].published_at) * (Number(dated[0].published_at) > 1e12 ? 1 : 1000)).toISOString().slice(0, 10)} ~ ${new Date(Number(dated[dated.length - 1].published_at) * (Number(dated[dated.length - 1].published_at) > 1e12 ? 1 : 1000)).toISOString().slice(0, 10)}` : ''}
[convert] 已写出:${outPath}
[convert] 下一步生成画像:
  node --env-file=.env.local scripts/analyze-profile.ts --input "${path.relative(root, outPath)}" --name "${args.name}"`);
