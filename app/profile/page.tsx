import path from 'node:path';
import { listArtifacts, listCrawlerInputs, readArtifactFile, resolveLocalAvatar } from '@/lib/profile/store';
import ProfileExperience from './profile-experience';
import ProfileCorner from './profile-corner';

/**
 * 人物画像页:整页渲染 profile-output/ 下的产物(.profile.json)。
 * ?name=<slug> 查看指定人物;缺省展示最新一份。切换/生成收在右下角浮层(ProfileCorner)。
 * 头像:public/avatars/<slug>.jpg 优先(scripts/fetch-avatar-browser.py 抓取或手动放入),否则水墨兜底图。
 */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  const root = process.cwd();
  const outDir = path.join(root, 'profile-output');
  const artifacts = listArtifacts(outDir);
  const selectedSlug = name && artifacts.some((a) => a.slug === name) ? name : artifacts[0]?.slug;
  const artifact = selectedSlug ? readArtifactFile(outDir, selectedSlug) : null;
  const inputs = listCrawlerInputs(path.join(root, 'data', 'crawler'));
  const avatarSrc = selectedSlug ? resolveLocalAvatar(path.join(root, 'public'), selectedSlug) : null;

  return (
    <>
      {artifact ? (
        <ProfileExperience artifact={artifact} avatarSrc={avatarSrc} />
      ) : (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] text-[#8a857c]">
          <p>还没有画像产物——点右下角「生成画像」从爬虫数据创建一份。</p>
        </main>
      )}
      <ProfileCorner artifacts={artifacts} inputs={inputs} activeSlug={selectedSlug ?? null} />
    </>
  );
}
