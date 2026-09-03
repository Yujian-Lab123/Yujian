#!/usr/bin/env node
// ============ 人物画像分析 CLI ============
// 用法(在项目根目录):
//   node --env-file=.env.local scripts/analyze-profile.ts --input <contents.json> [--input <more.json>] --name "某人"
//   node --env-file=.env.local scripts/analyze-profile.ts --fixture
// 输出:profile-output/<slug>.profile.json + <slug>.report.md
// 输入:JSON 数组或 {contents|items|data:[...]} ;字段名宽松映射(media-crawler / 知乎 API 常见字段均可)。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeProfile, normalizeContents } from '../lib/profile/engine.ts';
import { looseParseItems, saveArtifactFiles } from '../lib/profile/store.ts';
import type { RawContent } from '../lib/profile/schema.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function parseArgs(argv: string[]): { flags: Record<string, string | boolean>; inputs: string[] } {
  const flags: Record<string, string | boolean> = {};
  const inputs: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixture') { flags.fixture = true; continue; }
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { flags[key] = true; continue; }
    if (key === 'input') inputs.push(next);
    else flags[key] = next;
    i++;
  }
  return { flags, inputs };
}

/** 关键词搜索混入其他作者时,按作者名/id 过滤出目标大V(不区分大小写的包含匹配) */
function filterByAuthor(raws: RawContent[], query: string): { kept: RawContent[]; total: number } {
  const q = query.trim().toLowerCase();
  return {
    kept: raws.filter((r) => String(r.author || '').toLowerCase().includes(q)),
    total: raws.length,
  };
}

function loadItems(file: string): RawContent[] {
  const abs = path.resolve(root, file);
  return looseParseItems(JSON.parse(fs.readFileSync(abs, 'utf8')));
}

async function main() {
  const { flags, inputs } = parseArgs(process.argv);
  let raws: RawContent[] = [];
  let name = typeof flags.name === 'string' ? flags.name : null;

  if (flags.fixture) {
    raws = loadItems('scripts/fixtures/lin-yizhou.json');
    name = name || '林一舟(测试样本)';
  } else if (inputs.length > 0) {
    for (const f of inputs) raws = raws.concat(loadItems(f));
  } else {
    console.error('用法:node --env-file=.env.local scripts/analyze-profile.ts --input <file.json> [--name "某人"] [--author "作者名"] [--peek] [--out dir]\n      node --env-file=.env.local scripts/analyze-profile.ts --fixture');
    process.exit(1);
  }

  // --peek:只检查映射、列出作者清单,不调用 LLM、不生成画像(验证爬虫文件用)
  if (flags.peek) {
    const byAuthor = new Map<string, number>();
    for (const r of raws) {
      const a = r.author || '(无作者字段)';
      byAuthor.set(a, (byAuthor.get(a) || 0) + 1);
    }
    console.error(`[peek] 共 ${raws.length} 条。作者分布:`);
    for (const [a, n] of [...byAuthor.entries()].sort((x, y) => y[1] - x[1])) console.error(`  ${n} 篇 ← ${a}`);
    console.error('\n[peek] 归一化结果(前 20 条):');
    for (const c of normalizeContents(raws).slice(0, 20)) {
      console.error(`  ${c.id} | ${c.type} | ${c.published_at?.slice(0, 10) || '无日期'} | ${c.title || '(无标题)'} | ${c.text.slice(0, 40)}…`);
    }
    console.error('\n[peek] 未调用 LLM。确认无误后去掉 --peek 正式运行;混入其他作者时加 --author "作者名"。');
    return;
  }

  if (typeof flags.author === 'string') {
    const { kept, total } = filterByAuthor(raws, flags.author);
    raws = kept;
    console.error(`[analyze] 按作者「${flags.author}」过滤:${total} → ${kept.length} 条。`);
    if (kept.length === 0) {
      console.error('[analyze] 过滤后为空。先加 --peek 查看实际抓到的作者名,再用它作为 --author 的值。');
      process.exit(1);
    }
  }

  const normalized = normalizeContents(raws);
  console.error(`[analyze] 输入 ${raws.length} 条,有效 ${normalized.length} 条,开始分析(${name || '未署名'})…`);

  const artifact = await analyzeProfile(raws, {
    name,
    maxItems: typeof flags['max-items'] === 'string' ? Number(flags['max-items']) : undefined,
    maxTextChars: typeof flags['max-chars'] === 'string' ? Number(flags['max-chars']) : undefined,
    cacheFile: path.resolve(root, typeof flags.cache === 'string' ? flags.cache : 'data/crawler/.extract-cache.json'),
  });
  const outDir = path.resolve(root, typeof flags.out === 'string' ? flags.out : 'profile-output');
  const { jsonPath, mdPath, candidatesPath } = saveArtifactFiles(artifact, outDir);

  const p = artifact.profile;
  console.error(`[analyze] 完成:
  核心结论 ${p.summary.core_insights.length} | 轨迹 ${p.life_trajectory.length} | 关切 ${p.long_term_concerns.length} | 驱动力 ${p.drivers.length} | 决策 ${p.decision_patterns.length} | 价值 ${p.value_preferences.length} | 风格 ${p.conversation_style.traits.length} | 锚点 ${p.representative_contents.length} | unknowns ${p.unknowns.length}
  缓存:${artifact.meta.cache ? `${artifact.meta.cache.hits}/${artifact.meta.cache.total} 条命中(未命中即本次新抽取,已写入缓存)` : '未启用'}
  告警 ${artifact.meta.warnings.length} 条${artifact.meta.warnings.length ? ':' + artifact.meta.warnings.join(' / ') : ''}
  输出:${jsonPath}
      ${mdPath}${candidatesPath ? `
      ${candidatesPath}(抽取层候选线索,调试用)` : ''}`);
}

main().catch((e: unknown) => {
  console.error(`[analyze] 失败:${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
