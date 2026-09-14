'use client';
import { EXPERIENCE_ADAPTERS } from './experience-mode/adapter';
import { useExperienceMe, type ExperienceMeState } from './experience-mode/useExperienceMe';

export type MeState = ExperienceMeState;

/** 真实模式身份 hook：行为与旧实现一致（仅请求 /api/**）。 */
export function useMe(): MeState {
  return useExperienceMe(EXPERIENCE_ADAPTERS.real);
}
