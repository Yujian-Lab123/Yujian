import path from 'node:path';
import Link from 'next/link';
import { resolveLocalAvatar } from '@/lib/profile/store';
import { getLatestProfileArtifactForUser } from '@/lib/profile/repository';
import { hasUserVectors } from '@/lib/db';
import { getRealSessionUserId, hasDemoSession } from '@/lib/experience-mode/session';
import { resolveProfileEmptyState } from '@/lib/experience-mode/empty-state';
import ProfileExperience from './profile-experience';
import ProfileGenerateButton from './profile-generate-button';

/**
 * 人物画像页（真实路由）：整页渲染画像产物(.profile.json)。?name=<slug> 查看指定人物。
 * - 真实路由绝不展示演示数据：开发用「切换/生成」面板已移至 /demo/profile。
 * - 空状态产品化：未登录/无产物时给出产品化引导，不显示白屏或开发口吻文案。
 */
export default async function ProfilePage() {
  const uid = await getRealSessionUserId();
  const demoSession = uid ? false : await hasDemoSession();

  // 真实路径只按当前真实会话的 userId 读取产物。这里绝不能回退到本地文件或
  // 任意 slug，否则访客/另一个真实用户会看到不属于自己的画像。
  const [artifact, hasUnderstanding] = uid
    ? await Promise.all([
      getLatestProfileArtifactForUser(uid).catch(() => null),
      hasUserVectors(uid).catch(() => false),
    ])
    : [null, false];
  const avatarSrc = artifact?.subject?.name
    ? resolveLocalAvatar(path.join(process.cwd(), 'public'), artifact.subject.name)
    : null;

  if (artifact) return <ProfileExperience artifact={artifact} avatarSrc={avatarSrc} />;

  // 产品化空状态：按访客状态给出下一步引导（不出现开发口吻文案）。
  const emptyState = resolveProfileEmptyState({
    hasArtifact: Boolean(artifact),
    hasUnderstanding,
    loggedIn: Boolean(uid),
    demoSession,
  });
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6">
      <div className="max-w-md text-center">
        {emptyState === 'demo-visitor' ? (
          <>
            <p className="font-display text-2xl text-[#173e70]">你正在使用演示身份</p>
            <p className="mt-3 text-sm leading-6 text-[#77859a]">
              正式画像页只属于真实账号。继续浏览预置内容，请回到演示模式。
            </p>
            <a href="/demo" className="mt-6 inline-block rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">回到演示模式</a>
          </>
        ) : emptyState === 'real-understanding-ready' ? (
          <>
            <p className="font-display text-2xl text-[#173e70]">你的长期理解已经准备好了</p>
            <p className="mt-3 text-sm leading-6 text-[#77859a]">
              长期理解已用于相遇匹配。想要完整的证据画像（六维 + 时间线 + 证据链），点下面生成一次即可。
            </p>
            <ProfileGenerateButton />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href="/onboarding" className="rounded-lg border border-[#c8b998] px-6 py-2.5 text-sm text-[#173e70]">查看长期理解</a>
              <Link href="/encounter" className="rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">去遇见</Link>
            </div>
          </>
        ) : emptyState === 'real-pending' ? (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#c8b998]/70 bg-[#f4ecdf] text-[#173e70]" aria-hidden="true">
              <span className="flex gap-1">
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
              </span>
            </div>
            <p className="mt-5 font-display text-2xl text-[#173e70]">正在准备你的长期理解</p>
            <p className="mt-3 text-sm leading-6 text-[#77859a]">
              AI 会阅读你允许使用的公开内容，整理一份只有你能看到的长期理解。你可以打开理解过程查看它如何形成，或先完整体验一次演示流程。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/onboarding" className="rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">查看理解过程</Link>
              <Link href="/demo" className="rounded-lg border border-[#c8b998] px-6 py-2.5 text-sm text-[#173e70]">先看完整演示</Link>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-2xl text-[#173e70]">遇见，从理解你开始</p>
            <p className="mt-3 text-sm leading-6 text-[#77859a]">
              登录知乎账号，我们会读取你公开写过的内容生成理解画像；也可以先用预置身份体验完整流程。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href="/about" className="rounded-lg bg-[#173e70] px-6 py-2.5 text-sm text-white">使用知乎登录</a>
              <a href="/demo" className="rounded-lg border border-[#c8b998] px-6 py-2.5 text-sm text-[#173e70]">演示模式体验</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
