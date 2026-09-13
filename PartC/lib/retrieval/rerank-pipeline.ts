import { buildCurrentStateMatchText } from '../current-state/privacy';
import { getLatestStructuredCurrentState } from '../db';
import {
  rerankerConfigured,
  rerankTexts,
  type RerankApiStyle,
} from '../providers/reranker';
import {
  applyModelRerankScores,
  buildRerankDocument,
  buildRerankQuery,
  configuredRerankCandidateLimit,
  CONVERSATION_RERANK_INSTRUCTION,
  selectRerankPool,
  type RerankUser,
} from './model-rerank';
import { loadLatestProfileArtifacts } from './profile-context';
import type { RankedCandidate } from './scoring';

export interface RerankPipelineResult<TUser extends RerankUser> {
  candidates: RankedCandidate<TUser>[];
  mode: 'model' | 'mock';
  model?: string;
  apiStyle?: RerankApiStyle;
}

/**
 * 对 P3 已粗排的 Top-N 候选做一次真实 Cross-Encoder 排序。
 * 任意配置、画像读取、网络或响应问题都会整批回退，绝不混用半份模型分数。
 */
export async function rerankWithModel<TUser extends RerankUser>(
  viewer: TUser,
  candidates: RankedCandidate<TUser>[],
): Promise<RerankPipelineResult<TUser>> {
  if (!rerankerConfigured() || candidates.length === 0) return { candidates, mode: 'mock' };

  const pool = selectRerankPool(candidates, configuredRerankCandidateLimit());
  try {
    const [artifacts, currentState] = await Promise.all([
      loadLatestProfileArtifacts([viewer.id, ...pool.map((item) => item.user.id)]),
      getLatestStructuredCurrentState(viewer.id),
    ]);
    const result = await rerankTexts(
      buildRerankQuery(
        viewer,
        artifacts.get(viewer.id),
        currentState ? buildCurrentStateMatchText(currentState.selection) : null,
      ),
      pool.map((item) => buildRerankDocument(item.user, artifacts.get(item.user.id))),
      { instruct: CONVERSATION_RERANK_INSTRUCTION },
    );
    if (!result) return { candidates, mode: 'mock' };
    return {
      candidates: applyModelRerankScores(pool, result.scores),
      mode: 'model',
      model: result.model,
      apiStyle: result.apiStyle,
    };
  } catch (error) {
    console.warn('[reranker] 真实重排序不可用，整批回退 Mock：', error);
    return { candidates, mode: 'mock' };
  }
}
