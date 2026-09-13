// DEMO 体验模式 API：仅解析演示会话（yj_demo_session，绑定 is_mock=1 用户），
// 与真实 API 数据完全隔离。业务逻辑与真实路由共享同一 lib 层。
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { currentStates, db } from '@/lib/db';
import { monthBounds, parseMonthKey, shanghaiMonthKey } from '@/lib/present-self/history';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';

export async function GET(request: NextRequest) {
  const userId = await getDemoSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, loginRequired: true }, { status: 401 });
  }

  const requestedMonth = request.nextUrl.searchParams.get('month') || shanghaiMonthKey(new Date());
  const month = parseMonthKey(requestedMonth);
  if (!month) {
    return NextResponse.json({ ok: false, error: '月份格式应为 YYYY-MM' }, { status: 400 });
  }

  try {
    const bounds = monthBounds(month.key);
    if (!bounds) {
      return NextResponse.json({ ok: false, error: '月份格式应为 YYYY-MM' }, { status: 400 });
    }
    const rows = await db.select().from(currentStates).where(and(
      eq(currentStates.userId, userId),
      gte(currentStates.createdAt, bounds.start),
      lt(currentStates.createdAt, bounds.end),
    )).orderBy(desc(currentStates.createdAt)).limit(200);

    return NextResponse.json({
      ok: true,
      month: month.key,
      records: rows.map((row) => ({
        id: row.id,
        mood: row.mood,
        text: row.text,
        created_at: row.createdAt.toISOString(),
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: '历史记录加载失败，请稍后重试' }, { status: 500 });
  }
}
