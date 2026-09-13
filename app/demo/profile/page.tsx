import path from 'node:path';
import { listArtifacts, listCrawlerInputs, readArtifactFile, resolveLocalAvatar } from '@/lib/profile/store';
import { getProfileArtifact, getLatestProfileArtifactForUser, listProfileArtifacts } from '@/lib/profile/repository';
import { getDemoSessionUserId } from '@/lib/experience-mode/session';
import ProfileExperience from '@/app/profile/profile-experience';
import ProfileCorner from '@/app/profile/profile-corner';

/**
 * /demo/profile —— 演示模式画像页。
 * 只渲染演示身份（is_mock=1）的画像产物；开发用「切换/生成」面板（ProfileCorner）
 * 也只存在于演示路由，正式 /profile 不再挂载任何开发面板。
 */
export default async function DemoProfilePage() {
  const uid = await getDemoSessionUserId();
  if (!uid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] text-[#536a84]">
        <div className="text-center">
          <p className="font-display text-2xl text-[#173e70]">尚未进入演示模式</p>
          <p className="mt-3 text-sm text-[#77859a]">请先从演示入口开始体验。</p>
          <a href="/demo" className="mt-5 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">前往演示入口</a>
        </div>
      </main>
    );
  }

  const root = process.cwd();
  const outDir = path.join(root, 'profile-output');
  let databaseArtifacts = [] as Awaited<ReturnType<typeof listProfileArtifacts>>;
  try { databaseArtifacts = await listProfileArtifacts(); } catch { /* bootstrap 前保留本地画像预览 */ }
  // 演示画像优先取演示身份自己的产物；无则回退本地产物（均为预置演示数据）。
  let artifact = await getLatestProfileArtifactForUser(uid).catch(() => null);
  if (!artifact) {
    const localArtifacts = listArtifacts(outDir);
    const selectedSlug = localArtifacts[0]?.slug;
    artifact = selectedSlug ? readArtifactFile(outDir, selectedSlug) : null;
  }
  const artifacts = [...databaseArtifacts, ...listArtifacts(outDir).filter((local) => !databaseArtifacts.some((stored) => stored.slug === local.slug))];
  const inputs = listCrawlerInputs(path.join(root, 'data', 'crawler'));
  const avatarSrc = artifact?.subject?.name ? resolveLocalAvatar(path.join(root, 'public'), artifact.subject.name) : null;

  return (
    <>
      {artifact ? (
        <ProfileExperience artifact={artifact} avatarSrc={avatarSrc} />
      ) : (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] text-[#536a84]">
          <div className="text-center">
            <p className="font-display text-2xl text-[#173e70]">演示画像正在路上</p>
            <p className="mt-3 text-sm text-[#77859a]">预置身份的画像由演示数据生成，稍后即可查看。</p>
            <a href="/demo/encounter" className="mt-5 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">先去遇见看看</a>
          </div>
        </main>
      )}
      <ProfileCorner artifacts={artifacts} inputs={inputs} activeSlug={artifact?.subject?.name ?? null} />
    </>
  );
}
