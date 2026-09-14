'use client';

import ConnectionsScreen from '@/app/connections/ConnectionsScreen';
import { EXPERIENCE_ADAPTERS } from '@/lib/experience-mode/adapter';

/** 演示「已遇见」页：与真实页共用 ConnectionsScreen，仅数据源与出口不同。 */
export default function DemoConnectionsPage() {
  return <ConnectionsScreen adapter={EXPERIENCE_ADAPTERS.demo} />;
}
