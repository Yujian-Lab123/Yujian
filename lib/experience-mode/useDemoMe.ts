'use client';
import { EXPERIENCE_ADAPTERS } from './adapter';
import { useExperienceMe, type ExperienceMeState } from './useExperienceMe';

export type DemoMeState = ExperienceMeState;

/** 演示模式身份 hook：只请求 /api/demo/**，永远不触达真实会话数据。 */
export function useDemoMe(): DemoMeState {
  return useExperienceMe(EXPERIENCE_ADAPTERS.demo);
}
