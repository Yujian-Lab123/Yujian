import { NextResponse } from 'next/server';
import { buildGalleryEntries } from '@/lib/gallery/data';

export const dynamic = 'force-dynamic';

/** 画像长廊：公开只读。预览条目（虚构人设）+ 自愿公开的真实用户画像。 */
export async function GET() {
  const entries = await buildGalleryEntries();
  return NextResponse.json({ ok: true, ...entries });
}
