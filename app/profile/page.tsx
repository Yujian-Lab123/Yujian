import Link from 'next/link';
import { listArtifacts, readArtifactFile, type CrawlerInput } from '@/lib/profile/store';
import { listCrawlerInputs } from '@/lib/profile/store';
import path from 'node:path';
import ProfileExperience from './profile-experience';
import GeneratePanel from './generate-panel';

/**
 * 人物画像页:数据源为 profile-output/ 下的产物(.profile.json)。
 ?name=<slug> 查看指定人物;缺省展示最新一份。生成新画像走右侧面板(后台任务 + 轮询)。
 */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  const root = process.cwd();
  const outDir = path.join(root, 'profile-output');
  const artifacts = listArtifacts(outDir);
  const selectedSlug = name && artifacts.some((a) => a.slug === name) ? name : artifacts[0]?.slug;
  const artifact = selectedSlug ? readArtifactFile(outDir, selectedSlug) : null;
  const inputs: CrawlerInput[] = listCrawlerInputs(path.join(root, 'data', 'crawler'));

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#2c2a26]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">画像库:</span>
          {artifacts.length === 0 && <span className="text-[#8a857c]">还没有产物——用下方面板从爬虫数据生成一份。</span>}
          {artifacts.map((a) => (
            <Link
              key={a.slug}
              href={`/profile?name=${encodeURIComponent(a.slug)}`}
              className={`rounded-full border px-3 py-1 transition-colors ${
                a.slug === selectedSlug ? 'border-[#2c5f8a] bg-[#2c5f8a] text-white' : 'border-[#d8d2c6] bg-white hover:border-[#2c5f8a]'
              }`}
              title={`${a.contentCount} 篇 · ${a.timeRange || '时间未知'}`}
            >
              {a.name}
            </Link>
          ))}
        </div>

        <GeneratePanel inputs={inputs} />

        {artifact ? (
          <ProfileExperience artifact={artifact} />
        ) : (
          <p className="mt-10 text-center text-[#8a857c]">未找到画像产物。</p>
        )}
      </div>
    </main>
  );
}
