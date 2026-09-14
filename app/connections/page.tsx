'use client';

import { EXPERIENCE_ADAPTERS } from '@/lib/experience-mode/adapter';
import ConnectionsScreen from './ConnectionsScreen';

/** 真实「已遇见」页：主体统一在 ConnectionsScreen，模式差异全部走 ExperienceAdapter。 */
export default function ConnectionsPage() {
  return <ConnectionsScreen adapter={EXPERIENCE_ADAPTERS.real} />;
}
