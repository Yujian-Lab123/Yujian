#!/usr/bin/env node
// ============ 真实用户画像生成 CLI ============
// 作用：读取真实用户 OAuth 登录时保存的知乎内容（external_identities.raw_contents），
//      跑完整两阶段画像管线，并把产物写入 profile_artifacts（/profile 页面立即展示）。
//
// 用法（项目根目录）：
//   npx tsx scripts/analyze-real-user.ts --list
//   npx tsx scripts/analyze-real-user.ts --user real-xxxx            # 按 userId
//   npx tsx scripts/analyze-real-user.ts --zhihu-id xxxx             # 按知乎用户 id
//   npx tsx scripts/analyze-real-user.ts --all --limit 5             # 批量（最多 5 人）
//   npx tsx scripts/analyze-real-user.ts --user real-xxxx --local-only   # 只写文件不写库
//
// 说明：内容条数少也能生成（`--min-items` 可调下限，默认 1）；上限默认 80 篇（取最新）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db, pool } from '../lib/db/client.ts';
import { externalIdentities, users } from '../lib/db/schema.ts';
import { analyzeProfile } from '../lib/profile/engine.ts';
import { saveProfileArtifact } from '../lib/profile/repository.ts';
import { looseParseItems, saveArtifactFiles, slugifyName } from '../lib/profile/store.ts';
import type { RawContent } from '../lib/profile/schema.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { flags[key] = true; continue; }
    flags[key] = next;
    i++;
  }
  return flags;
}

/** 知乎开放接口返回的字段为大写开头（Url/Title/Summary/CreatedAt/ContentType），
 *  这里归一化为管线使用的 RawContent；若已是小写宽松格式则回退 looseParseItems。 */
function normalizeOAuthItems(raw: unknown[]): RawContent[] {
  const isZhihuShape = raw.some((x) => x && typeof x === 'object' && ('Title' in (x as object) || 'Summary' in (x as object)));
  if (!isZhihuShape) return looseParseItems(raw);
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((x) => ({
      id: String(x.Url || x.Title || Math.random()).slice(-24),
      title: x.Title ? String(x.Title) : undefined,
      text: String(x.Summary || ''),
      type: x.ContentType ? String(x.ContentType) : undefined,
      url: x.Url ? String(x.Url) : undefined,
      published_at: typeof x.CreatedAt === 'number' ? x.CreatedAt : null,
    }));
}

interface Candidate { userId: string; name: string; zhihuUserId: string; count: number }

/** 列出所有「真实用户 + 已保存内容条数」，供操作者选择目标。 */
async function listCandidates(): Promise<Candidate[]> {
  const rows = await db.select({
    userId: externalIdentities.userId,
    zhihuUserId: externalIdentities.externalUserId,
    rawContents: externalIdentities.rawContents,
    name: users.name,
    isMock: users.isMock,
  }).from(externalIdentities).innerJoin(users, eq(users.id, externalIdentities.userId))
    .where(eq(externalIdentities.provider, 'zhihu'));
  return rows
    .filter((r) => !r.isMock)
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      zhihuUserId: r.zhihuUserId,
      count: Array.isArray(r.rawContents) ? r.rawContents.length : 0,
    }));
}

async function main() {
  const flags = parseArgs(process.argv);
  const candidates = await listCandidates();

  if (flags.list || candidates.length === 0) {
    console.log(`[real-user] 真实用户清单（共 ${candidates.length} 人）：`);
    for (const c of candidates) console.log(`  ${c.userId}  ${c.name}  知乎id=${c.zhihuUserId}  内容 ${c.count} 条`);
    if (candidates.length === 0) {
      console.log('[real-user] 还没有任何真实用户内容。先在应用里用知乎账号登录一次，登录时会抓取并保存内容。');
    }
    return;
  }

  let targets: Candidate[] = [];
  if (typeof flags.user === 'string') targets = candidates.filter((c) => c.userId === flags.user);
  else if (typeof flags['zhihu-id'] === 'string') targets = candidates.filter((c) => c.zhihuUserId === flags['zhihu-id']);
  else if (flags.all) targets = candidates.slice(0, Number(flags.limit ?? 10));
  else targets = candidates; // 默认处理全部真实账号（可用 --user/--all --limit 收窄）

  if (targets.length === 0) {
    console.error('[real-user] 未匹配到用户。先用 --list 查看可用 userId。');
    process.exit(1);
  }

  for (const target of targets) {
    const [identity] = await db.select({ rawContents: externalIdentities.rawContents })
      .from(externalIdentities)
      .where(eq(externalIdentities.userId, target.userId)).limit(1);
    const raw = Array.isArray(identity?.rawContents) ? (identity.rawContents as unknown[]) : [];
    console.log(`\n[real-user] 目标：${target.name}（${target.userId}），保存内容 ${raw.length} 条`);
    if (raw.length === 0) {
      console.error('[real-user] 该用户没有已保存的内容，跳过。');
      continue;
    }

    const items: RawContent[] = normalizeOAuthItems(raw);
    if (items.length === 0) {
      console.error('[real-user] 内容解析后为空，跳过。');
      continue;
    }
    console.log('[real-user] 解析样例:', items.slice(0, 3).map((i) => `「${(i.title || '').slice(0, 20)}」${i.text.length}字`).join(' / '));

    const artifact = await analyzeProfile(items, { maxItems: Number(flags['max-items'] ?? 80) });
    // 真实账号名字可能重复（如匿名「知乎用户」），slug 追加知乎 id 短码保证唯一。
    const shortId = target.zhihuUserId.replace(/^anon-/, '').slice(0, 8) || target.userId.slice(-8);
    const slug = slugifyName(`${target.name || 'user'}-${shortId}`);

    // 产物文件（本地开发可见；容器内可能只读，失败不影响数据库写入）
    try {
      const out = saveArtifactFiles(artifact, path.join(root, 'profile-output'));
      console.log(`[real-user] 文件产物：profile-output/${out.slug}.profile.json`);
    } catch (error) {
      console.warn('[real-user] 文件写入跳过：', error instanceof Error ? error.message : error);
    }

    if (!flags['local-only']) {
      await saveProfileArtifact(artifact, slug, target.userId);
      console.log(`[real-user] ✅ 已写入数据库，/profile 页面可直接查看（slug=${slug}）`);
    } else {
      console.log('[real-user] --local-only：仅生成文件，未写数据库。');
    }
  }
}

main()
  .catch((error) => {
    console.error('[real-user] 失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
