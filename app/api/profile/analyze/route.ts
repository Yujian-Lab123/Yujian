import { NextResponse } from 'next/server';
import { buildUnderstanding } from '@/lib/ai/profile';
import { computeUserVectors } from '@/lib/db';
import { getZhihuContentInventory } from '@/lib/db/users';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

// 离线理解管线入口：OAuth 后“认真做一次”；增量阶段只处理新内容。
// 返回 inventory：已采集的真实内容清单（长廊/画像页的真实数据展示层）。
export async function POST() {
  const uid = await getRealSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  await computeUserVectors(uid);
  const [understanding, inventory] = await Promise.all([
    buildUnderstanding(uid),
    getZhihuContentInventory(uid).catch(() => []),
  ]);
  return NextResponse.json({ ok: true, understanding, inventory });
}
