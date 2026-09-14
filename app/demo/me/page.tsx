'use client';

import PresentSelfScreen from '@/app/me/PresentSelfScreen';
import { EXPERIENCE_ADAPTERS } from '@/lib/experience-mode/adapter';
import { useDemoMe } from '@/lib/experience-mode/useDemoMe';

/** 演示「此刻」页：与真实页共用 PresentSelfScreen，仅数据源与出口不同。 */
export default function DemoMePage() {
  const me = useDemoMe();
  return <PresentSelfScreen adapter={EXPERIENCE_ADAPTERS.demo} me={me} />;
}
