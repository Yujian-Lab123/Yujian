#!/usr/bin/env node
// ============ 回填真实知乎身份（昵称/头像/一句话） ============
// 背景：历史版本的 /user 接口鉴权头用错，导致真实登录被兜底成匿名「知乎用户」。
// 本脚本用已保存的 access token 重新拉取授权用户资料，并按修复后的解析逻辑
// （fullname / avatar_path / uid 无损）更新 users 与 external_identities。
//
// 用法（项目根目录）：
//   npx tsx scripts/refresh-zhihu-identity.ts            # 全部真实用户
//   npx tsx scripts/refresh-zhihu-identity.ts --user real-anon-xxxx
//   npx tsx scripts/refresh-zhihu-identity.ts --dry-run  # 只打印，不写库

import { createDecipheriv, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from '../lib/db/client.ts';
import { externalIdentities, users } from '../lib/db/schema.ts';
import { fetchZhihuProfile } from '../lib/providers/zhihu.ts';

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

/** 与 lib/db/users.ts 的 encryptToken 对应的解密（AES-256-GCM，iv.tag.data base64url）。 */
function decryptToken(blob: string): string {
  const source = process.env.TOKEN_ENCRYPTION_KEY;
  if (!source) throw new Error('缺少 TOKEN_ENCRYPTION_KEY');
  const key = createHash('sha256').update(source).digest();
  const [ivB64, tagB64, dataB64] = blob.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

async function main() {
  const flags = parseArgs(process.argv);
  const rows = await db.select({
    userId: externalIdentities.userId,
    externalUserId: externalIdentities.externalUserId,
    encryptedAccessToken: externalIdentities.encryptedAccessToken,
    profile: externalIdentities.profile,
    isMock: users.isMock,
    name: users.name,
  }).from(externalIdentities).innerJoin(users, eq(users.id, externalIdentities.userId))
    .where(eq(externalIdentities.provider, 'zhihu'));

  const targets = rows.filter((r) => !r.isMock && (!flags.user || r.userId === flags.user));
  if (targets.length === 0) {
    console.log('[identity] 没有可处理的真实用户。');
    return;
  }

  for (const row of targets) {
    console.log(`\n[identity] ${row.userId}（当前显示名：${row.name}）`);
    if (!row.encryptedAccessToken) {
      console.log('  跳过：没有保存的 access token。');
      continue;
    }
    let token: string;
    try { token = decryptToken(row.encryptedAccessToken); }
    catch (e) { console.log('  跳过：token 解密失败 —', String((e as Error).message).slice(0, 80)); continue; }

    let profile;
    try { profile = await fetchZhihuProfile(token); }
    catch (e) { console.log('  跳过：拉取资料失败 —', String((e as Error).message).slice(0, 120)); continue; }

    console.log(`  知乎资料：${profile.name} | ${profile.headline || '(无介绍)'}`);
    console.log(`  头像：${profile.avatarUrl || '(无)'}`);
    console.log(`  唯一标识：${profile.zhihuUserId}`);

    if (flags['dry-run']) { console.log('  --dry-run：未写库。'); continue; }

    await db.update(users).set({ name: profile.name, quote: profile.headline || '' }).where(eq(users.id, row.userId));
    const mergedProfile = { ...(row.profile as Record<string, unknown> || {}), ...profile };
    await db.update(externalIdentities).set({ profile: mergedProfile, updatedAt: new Date() })
      .where(eq(externalIdentities.userId, row.userId));
    console.log('  ✅ 已更新 users.name / external_identities.profile');
  }
}

main()
  .catch((error) => { console.error('[identity] 失败：', error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => {}); });
