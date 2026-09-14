import { SEED_USERS } from '../db/seed';
import { shanghaiDateKey } from './history';

export interface MockCurrentStateSeed {
  id: string;
  userId: string;
  text: string;
  mood: string;
  createdAt: Date;
}

const SCENARIOS = [
  { mood: '平静', thought: '比赛接近结束，心里有点空落落的。想在晚上出去走走，整理一下思绪。', activities: '散步、和有趣的人聊天', style: '轻松随意', person: '有自己的生活节奏，也愿意分享小小灵感的人。' },
  { mood: '有点累', thought: '今天把注意力都放在收尾上，想早点休息。', activities: '只是放空', style: '先从文字开始', person: '不急着给答案、愿意慢慢聊的人。' },
  { mood: '开心', thought: '一个困扰很久的问题终于有了进展。', activities: '好好吃一顿', style: '轻松随意', person: '愿意分享最近好消息的人。' },
  { mood: '有点焦虑', thought: '选择有点多，正在把真正重要的事情重新排一遍。', activities: '看书、专注工作', style: '认真深入', person: '能从具体经历出发交换看法的人。' },
  { mood: '想散步', thought: '想离开屏幕一会儿，去看看傍晚的城市。', activities: '散步、随便走走', style: '看情况', person: '生活节奏相近、愿意一起走走的人。' },
  { mood: '想聊天', thought: '今天遇到一个很有意思的问题，想听听不同的答案。', activities: '和有趣的人聊天', style: '认真深入', person: '好奇、真诚，也能接受不同观点的人。' },
  { mood: '充满动力', thought: '新的想法已经成形，准备把它真正做出来。', activities: '专注工作', style: '先从文字开始', person: '正在创造东西、愿意交流过程的人。' },
  { mood: '平静', thought: '普通的一天，没有特别兴奋，也没有特别焦虑。', activities: '看书', style: '轻松随意', person: '愿意聊聊最近生活的人。' },
] as const;

function atLocalDay(base: Date, offsetDays: number, hour: number, minute: number): Date {
  const instant = new Date(base.getTime() - offsetDays * 86_400_000);
  const day = shanghaiDateKey(instant);
  return new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`);
}

/** 把未来的时间点收回"已过去"，且永远不允许跨出当前月（否则当月不变量被打破）。 */
function clampToAlreadyPast(instant: Date, now: Date): Date {
  if (instant.getTime() <= now.getTime()) return instant;
  const shifted = new Date(now.getTime() - 30_000);
  return shanghaiDateKey(shifted) === shanghaiDateKey(now) ? shifted : new Date(now.getTime());
}

/**
 * 演示身份的当月「此刻」预置记录。
 *
 * 不变量：**每个可能被轮换到的演示身份（SEED_USERS 全员）都拥有当月完整历史**——
 * 演示会话按 UTC 日期确定性轮换，轮到谁，谁都不能是空档案（审计发现的缺陷：
 * 此前只为 u0 生成，轮换到其他身份时侧栏全空）。
 */
export function buildMockCurrentStateSeeds(now = new Date()): MockCurrentStateSeed[] {
  const shanghaiDay = Number(shanghaiDateKey(now).slice(8, 10));
  const clampOffset = (offset: number) => Math.min(offset, Math.max(0, shanghaiDay - 1));
  const offsets = [0, 1, 3, 5, 7, 9, 10, 11].map(clampOffset);
  const records: MockCurrentStateSeed[] = [];

  SEED_USERS.forEach((user, userIndex) => {
    offsets.forEach((offset, index) => {
      const scenario = SCENARIOS[(userIndex * 3 + index) % SCENARIOS.length];
      const createdAt = clampToAlreadyPast(
        atLocalDay(now, offset, 9 + ((index + userIndex) % 4) * 3, 12 + ((index * 7 + userIndex * 5) % 47)),
        now,
      );
      const day = shanghaiDateKey(createdAt);
      records.push({
        id: `cs-${user.id}-demo-${day}-${index}`,
        userId: user.id,
        mood: scenario.mood,
        text: [
          `今日心情：${scenario.mood}`,
          `最近在想：${scenario.thought}`,
          `今天想做：${scenario.activities}`,
          `交流方式：${scenario.style}`,
          `期待遇见：${scenario.person}`,
        ].join('\n'),
        createdAt,
      });
    });
  });

  // u0 保留两条演示叙事用记录：当晚追加的一条 + 更早的一条旧记录。
  const sameDay = clampToAlreadyPast(atLocalDay(now, clampOffset(3), 21, 16), now);
  records.push({
    id: `cs-u0-demo-${shanghaiDateKey(sameDay)}-late`,
    userId: 'u0',
    mood: '想聊天',
    text: '今日心情：想聊天\n最近在想：晚上又想到一个新的角度，想找人交换一下看法。\n今天想做：和有趣的人聊天\n交流方式：先从文字开始\n期待遇见：愿意认真听完问题的人。',
    createdAt: sameDay,
  });
  const legacyDay = atLocalDay(now, clampOffset(12), 18, 30);
  records.push({
    id: `cs-u0-demo-${shanghaiDateKey(legacyDay)}-legacy`,
    userId: 'u0',
    mood: '平静',
    text: '那天只是想安静地看完一本书。',
    createdAt: clampToAlreadyPast(legacyDay, now),
  });
  return records;
}
