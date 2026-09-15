import Link from 'next/link';
import Nav from '@/components/Nav';
import { getLatestProfileArtifactForUser } from '@/lib/profile/repository';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';
import { getDemoAuthorProfiles } from '@/lib/providers/demo-author-profiles';
import ProfileExperience from '@/app/profile/profile-experience';

export const dynamic = 'force-dynamic';

export default async function DemoProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string | string[] }>;
}) {
  const uid = await getDemoSessionUserId();
  if (!uid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-[#173e70]">尚未进入演示模式</h1>
          <p className="mt-3 text-sm text-[#77859a]">请先从演示入口开始体验。</p>
          <Link href="/demo" className="mt-5 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">前往演示入口</Link>
        </div>
      </main>
    );
  }

  const requested = (await searchParams).author;
  const authorId = typeof requested === 'string' ? requested : null;
  const profiles = getDemoAuthorProfiles();
  const demoArtifact = await getLatestProfileArtifactForUser(uid).catch(() => null);
  const selected = profiles.find((profile) => profile.id === authorId) ?? (authorId === 'demo' ? null : profiles[0]);
  const artifact = selected?.artifact ?? (authorId === 'demo' || profiles.length === 0 ? demoArtifact : null);

  const toolbar = (
    <section className="border-b border-[#d8cfbd] bg-[#fffdf8] px-5 py-4" aria-label="演示画像选择">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-xs font-medium text-[#967034]">演示模式 · 完整人物画像</p>
          <p className="mt-1 text-xs leading-5 text-[#61748a]">公开答主的采集画像与演示身份分别展示；点击地图中的代表内容可查看依据。</p>
        </div>
        {profiles.map((profile) => (
          <Link key={profile.id} href={`/demo/profile?author=${profile.id}`}
            aria-current={selected?.id === profile.id ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-xs ${selected?.id === profile.id ? 'border-[#173e70] bg-[#173e70] text-white' : 'border-[#b8c5d2] bg-white text-[#173e70]'}`}>
            {profile.label} · {profile.contentCount} 条
          </Link>
        ))}
        {demoArtifact && (
          <Link href="/demo/profile?author=demo" aria-current={authorId === 'demo' ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-xs ${authorId === 'demo' ? 'border-[#173e70] bg-[#173e70] text-white' : 'border-[#b8c5d2] bg-white text-[#173e70]'}`}>
            演示身份画像
          </Link>
        )}
      </div>
    </section>
  );

  if (artifact) return <ProfileExperience artifact={artifact} toolbar={toolbar} />;

  return (
    <main className="min-h-screen bg-[#f7f4ee]">
      <Nav tone="blue" tagline="演示模式 · 完整人物画像" />
      {toolbar}
      <section className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-display text-2xl text-[#173e70]">当前没有可展示的完整画像</h1>
        <p className="mt-3 text-sm leading-7 text-[#77859a]">
          授权采集输入和对应画像产物需要同时挂载在服务端。这里不会用其他人的本地产物或虚构内容替代。
        </p>
        <Link href="/demo/encounter" className="mt-6 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">先看演示相遇</Link>
      </section>
    </main>
  );
}
