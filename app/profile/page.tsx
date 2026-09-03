import profileArtifact from '@/profile-output/an-ling-91.profile.json';
import ProfileExperience from './profile-experience';

/**
 * 当前页面使用已通过 MediaCrawler 管线产出的画像工件。
 * 后续接入 OAuth 后，只需将这里的数据源替换为对应用户的 ProfileArtifact。
 */
export default function ProfilePage() {
  return <ProfileExperience artifact={profileArtifact} />;
}
