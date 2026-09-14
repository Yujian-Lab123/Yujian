import type { Metadata } from 'next';
import Link from 'next/link';
import path from 'node:path';
import ProfileExperience from '@/app/profile/profile-experience';
import { getProfileArtifact } from '@/lib/profile/repository';
import { getProfileArtifactMeta } from '@/lib/profile/repository';
import { resolveLocalAvatar } from '@/lib/profile/store';
import { getRealSessionUserId } from '@/lib/experience-mode/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '公开画像 · 画像长廊',
  robots: { index: false },
};

/**
 * 画像长廊详情页：仅展示「本人自愿公开（sharedAt 非空）」的画像。
 * 与 /profile（仅本人）并列，不回退本地文件、不泄露未公开画像。
 */
export default async function GalleryProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [meta, uid] = await Promise.all([
    getProfileArtifactMeta(slug).catch(() => null),
    getRealSessionUserId().catch(() => null),
  ]);

  const isOwn = Boolean(uid && meta?.userId && meta.userId === uid);
  const isPublic = Boolean(meta?.sharedAt) || Boolean(meta?.isMock);
  const allowed = meta && (isPublic || isOwn);

  if (!meta || !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6">
        <div className="max-w-md text-center">
          <p className="font-display text-2xl text-[#173e70]">这份画像尚未公开</p>
          <p className="mt-3 text-sm leading-6 text-[#77859a]">
            画像只有本人自愿公开后，才会出现在画像长廊中。
          </p>
          <Link href="/gallery" className="mt-6 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">
            回到画像长廊
          </Link>
        </div>
      </main>
    );
  }

  const artifact = await getProfileArtifact(slug).catch(() => null);
  if (!artifact) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6">
        <p className="text-sm text-[#77859a]">画像内容加载失败，请稍后重试。</p>
      </main>
    );
  }

  const avatarSrc = artifact.subject?.name
    ? resolveLocalAvatar(path.join(process.cwd(), 'public'), artifact.subject.name)
    : null;

  return (
    <div>
      <div className="border-b border-[#b7a98e]/15 bg-[#f7f4ee]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
          <p className="font-display text-sm text-[#173e70]">画像长廊 · 公开分享</p>
          <Link href="/gallery" className="text-xs text-[#77859a] underline-offset-4 hover:underline">← 返回长廊</Link>
        </div>
      </div>
      <ProfileExperience artifact={artifact} avatarSrc={avatarSrc} />
    </div>
  );
}
