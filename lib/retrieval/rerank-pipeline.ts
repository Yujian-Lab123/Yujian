import { rerankerConfigured, rerankTexts, type RerankApiStyle } from '../providers/reranker';
import {
  buildRerankDocument,
  buildRerankQuery,
  configuredRerankCandidateLimit,
  CONVERSATION_RERANK_INSTRUCTION,
  mergeRerankedPool,
  selectRerankPool,
  type RerankUser,
} from './model-rerank';
import { loadLatestProfileArtifacts } from './profile-context';
import type { RankedCandidate } from './scoring';

export interface RerankPipelineResult<TUser extends RerankUser> {
  candidates: RankedCandidate<TUser>[];
  mode: 'model' | 'fallback';
  model?: string;
  apiStyle?: RerankApiStyle;
}

/**
 * 只用压缩后的长期结构化画像精排 Top-N。
 * 不读取当前状态原文；任意网络或响应问题都整批回退，避免混用半份模型分数。
 */
export async function rerankWithModel<TUser extends RerankUser>(
  viewer: TUser,
  candidates: RankedCandidate<TUser>[],
): Promise<RerankPipelineResult<TUser>> {
  if (!rerankerConfigured() || candidates.length === 0) return { candidates, mode: 'fallback' };
  const pool = selectRerankPool(candidates, configuredRerankCandidateLimit());
  try {
    const artifacts = await loadLatestProfileArtifacts([viewer.id, ...pool.map((item) => item.user.id)]);
    const result = await rerankTexts(
      buildRerankQuery(viewer, artifacts.get(viewer.id)),
      pool.map((item) => buildRerankDocument(item.user, artifacts.get(item.user.id))),
      { instruct: CONVERSATION_RERANK_INSTRUCTION },
    );
    if (!result) return { candidates, mode: 'fallback' };
    return {
      candidates: mergeRerankedPool(candidates, pool, result.scores),
      mode: 'model',
      model: result.model,
      apiStyle: result.apiStyle,
    };
  } catch (error) {
    console.warn('[reranker] 真实重排序不可用，整批回退本地结果：', error);
    return { candidates, mode: 'fallback' };
  }
}
