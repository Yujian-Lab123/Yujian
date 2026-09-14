'use client';

import { EXPERIENCE_ADAPTERS } from '@/lib/experience-mode/adapter';
import { useMe } from '@/lib/useMe';
import PresentSelfScreen from './PresentSelfScreen';

/** 真实「此刻」页：主体统一在 PresentSelfScreen，模式差异全部走 ExperienceAdapter。 */
export default function MePage() {
  const me = useMe();
  return <PresentSelfScreen adapter={EXPERIENCE_ADAPTERS.real} me={me} />;
}
