import { createHash } from 'node:crypto';
import { and, eq, notInArray } from 'drizzle-orm';
import type { ProfileArtifact } from '../profile/schema';
import {
  configuredEmbeddingDimensions,
  embedTexts,
  embeddingConfigured,
} from '../providers/embedding';
import {
  mergeAnnMatches,
  parsePgvectorLiteral,
  toPgvectorLiteral,
  type AnnRouteMatch,
} from '../retrieval/pgvector';
import {
  DEFAULT_RECALL_LIMITS,
  type RecallSource,
} from '../retrieval/multi-recall';
import { db, pool } from './client';
import {
  RETRIEVAL_EMBEDDING_DIMENSIONS,
  retrievalEmbeddings,
  type RetrievalEmbeddingKind,
} from './schema';
import type { UserVectors } from './index';

const KIND_BY_SOURCE: Record<RecallSource, RetrievalEmbeddingKind> = {
  long_term: 'profile_long_term',
  value: 'profile_value',
  conversation: 'profile_conversation',
  current: 'profile_current',
};

const SOURCE_BY_KIND = Object.fromEntries(
  Object.entries(KIND_BY_SOURCE).map(([source, kind]) => [kind, source]),
) as Partial<Record<RetrievalEmbeddingKind, RecallSource>>;

function rowId(userId: string, kind: RetrievalEmbeddingKind, sourceId: string): string {
  return `emb-${createHash('sha256').update(`${userId}\u0000${kind}\u0000${sourceId}`).digest('hex').slice(0, 28)}`;
}

function vectorHash(vector: number[]): string {
  return createHash('sha256').update(JSON.stringify(vector)).digest('hex');
}

function indexable(vector: number[]): boolean {
  return vector.length === RETRIEVAL_EMBEDDING_DIMENSIONS
    && vector.every((value) => Number.isFinite(value))
    && vector.some((value) => value !== 0);
}

/** 将 P4 画像产物幂等同步到统一 pgvector 表；维度或空间不兼容时拒绝污染索引。 */
export async function syncProfileVectorIndex(userId: string, artifact: ProfileArtifact): Promise<'indexed' | 'skipped'> {
  const payload = artifact.embeddings;
  if (!payload || payload.dimensions !== RETRIEVAL_EMBEDDING_DIMENSIONS) return 'skipped';

  const profiles: Array<[RetrievalEmbeddingKind, number[]]> = [
    ['profile_long_term', payload.profile.long_term],
    ['profile_value', payload.profile.value],
    ['profile_conversation', payload.profile.conversation],
  ];
  const allVectors = [...profiles.map(([, vector]) => vector), ...payload.contents.map((item) => item.vector)];
  if (!allVectors.every(indexable)) return 'skipped';

  const now = new Date();
  const rows: Array<typeof retrievalEmbeddings.$inferInsert> = [
    ...profiles.map(([kind, embedding]) => ({
      id: rowId(userId, kind, userId),
      userId,
      kind,
      sourceId: userId,
      sourceHash: vectorHash(embedding),
      spaceId: payload.space_id,
      model: payload.model,
      embedding,
      expiresAt: null,
      updatedAt: now,
    })),
    ...payload.contents.map((content) => ({
      id: rowId(userId, 'content', content.content_id),
      userId,
      kind: 'content' as const,
      sourceId: content.content_id,
      sourceHash: content.source_hash,
      spaceId: payload.space_id,
      model: payload.model,
      embedding: content.vector,
      expiresAt: null,
      updatedAt: now,
    })),
  ];

  await db.transaction(async (tx) => {
    // 每条写入保持自己的向量；数据量受单人画像上限约束，不以牺牲正确性换批量 SQL。
    for (const row of rows) {
      await tx.insert(retrievalEmbeddings).values(row).onConflictDoUpdate({
        target: [retrievalEmbeddings.userId, retrievalEmbeddings.kind, retrievalEmbeddings.sourceId],
        set: {
          sourceHash: row.sourceHash,
          spaceId: row.spaceId,
          model: row.model,
          embedding: row.embedding,
          expiresAt: null,
          updatedAt: now,
        },
      });
    }

    const contentIds = payload.contents.map((content) => content.content_id);
    const contentScope = and(eq(retrievalEmbeddings.userId, userId), eq(retrievalEmbeddings.kind, 'content'));
    await tx.delete(retrievalEmbeddings).where(
      contentIds.length ? and(contentScope, notInArray(retrievalEmbeddings.sourceId, contentIds)) : contentScope,
    );
  });
  return 'indexed';
}

/** 只为允许展示的结构化“此刻”标签生成向量；自由文本绝不能传到这里。 */
export async function syncCurrentStateVector(
  userId: string,
  structuredMatchText: string,
  expiresAt: Date,
): Promise<'indexed' | 'skipped'> {
  if (!embeddingConfigured() || configuredEmbeddingDimensions() !== RETRIEVAL_EMBEDDING_DIMENSIONS) return 'skipped';
  const generated = await embedTexts([structuredMatchText], { dimensions: RETRIEVAL_EMBEDDING_DIMENSIONS });
  const embedding = generated?.vectors[0];
  if (!generated || !embedding || !indexable(embedding)) {
    await db.delete(retrievalEmbeddings).where(and(
      eq(retrievalEmbeddings.userId, userId),
      eq(retrievalEmbeddings.kind, 'profile_current'),
    ));
    return 'skipped';
  }
  const sourceId = `structured:${userId}`;
  const sourceHash = createHash('sha256').update(structuredMatchText).digest('hex');
  const updatedAt = new Date();
  await db.transaction(async (tx) => {
    // 同一用户旧版 profile_current 可能来自自由文本，先彻底移出索引。
    await tx.delete(retrievalEmbeddings).where(and(
      eq(retrievalEmbeddings.userId, userId),
      eq(retrievalEmbeddings.kind, 'profile_current'),
    ));
    await tx.insert(retrievalEmbeddings).values({
      id: rowId(userId, 'profile_current', sourceId),
      userId,
      kind: 'profile_current',
      sourceId,
      sourceHash,
      spaceId: generated.spaceId,
      model: generated.model,
      embedding,
      expiresAt,
      updatedAt,
    });
  });
  return 'indexed';
}

interface IndexedCandidateVectors {
  userId: string;
  vectors: UserVectors;
  recallSources: RecallSource[];
  recallScores: Partial<Record<RecallSource, number>>;
  recallScore: number;
}

export interface AnnRecallResult {
  viewerVectors: UserVectors;
  candidates: IndexedCandidateVectors[];
  spaceId: string;
}

interface VectorRow {
  user_id: string;
  kind: RetrievalEmbeddingKind;
  space_id: string;
  embedding: unknown;
}

function emptyVectors(): UserVectors {
  return { long_term: [], value: [], conversation: [], current: null };
}

/**
 * 四路 HNSW Top-K 召回。表、扩展或真实向量尚未就绪时抛错/返回 null，调用方自动降级内存粗排。
 */
export async function annRecallProfiles(
  viewerId: string,
  eligibleUserIds: string[],
  limits: Partial<Record<RecallSource, number>> = DEFAULT_RECALL_LIMITS,
): Promise<AnnRecallResult | null> {
  if (eligibleUserIds.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    const relation = await client.query<{ name: string | null }>(
      `select to_regclass('public.retrieval_embeddings')::text as name`,
    );
    if (!relation.rows[0]?.name) {
      await client.query('commit');
      return null;
    }
    await client.query('set local hnsw.iterative_scan = strict_order');
    await client.query('set local hnsw.ef_search = 100');
    const viewerResult = await client.query<VectorRow>(`
      select user_id, kind, space_id, embedding::text as embedding
      from retrieval_embeddings
      where user_id = $1
        and kind = any($2::text[])
        and (expires_at is null or expires_at > now())
        and (kind <> 'profile_current' or source_id = 'structured:' || user_id)
      order by updated_at desc
    `, [viewerId, Object.values(KIND_BY_SOURCE)]);

    const primary = viewerResult.rows.find((row) => row.kind === 'profile_long_term') || viewerResult.rows[0];
    if (!primary) {
      await client.query('commit');
      return null;
    }
    const spaceId = primary.space_id;
    const viewerVectors = emptyVectors();
    const routeQueries: Promise<{ source: RecallSource; rows: Array<{ user_id: string; score: number | string }> }>[] = [];

    for (const row of viewerResult.rows) {
      if (row.space_id !== spaceId) continue;
      const source = SOURCE_BY_KIND[row.kind];
      const vector = source ? parsePgvectorLiteral(row.embedding) : null;
      if (!source || !vector) continue;
      if (source === 'current') viewerVectors.current = vector;
      else viewerVectors[source] = vector;
      const limit = Math.max(0, Math.floor(limits[source] ?? DEFAULT_RECALL_LIMITS[source]));
      if (limit === 0) continue;
      routeQueries.push(client.query<{ user_id: string; score: number | string }>(`
        select user_id, greatest(0, least(1, 1 - (embedding <=> $1::vector))) as score
        from retrieval_embeddings
        where kind = $2 and space_id = $3 and user_id = any($4::text[])
          and (expires_at is null or expires_at > now())
          and (kind <> 'profile_current' or source_id = 'structured:' || user_id)
        order by embedding <=> $1::vector
        limit $5
      `, [toPgvectorLiteral(vector), row.kind, spaceId, eligibleUserIds, limit])
        .then((result) => ({ source, rows: result.rows })));
    }

    const routeResults = await Promise.all(routeQueries);
    const matches: AnnRouteMatch[] = routeResults.flatMap(({ source, rows }) => rows.map((row) => ({
      userId: row.user_id,
      source,
      score: Number(row.score),
    })).filter((row) => Number.isFinite(row.score)));
    const merged = mergeAnnMatches(matches);
    if (merged.length === 0) {
      await client.query('commit');
      return null;
    }

    const vectorResult = await client.query<VectorRow>(`
      select user_id, kind, space_id, embedding::text as embedding
      from retrieval_embeddings
      where user_id = any($1::text[]) and space_id = $2
        and kind = any($3::text[])
        and (expires_at is null or expires_at > now())
        and (kind <> 'profile_current' or source_id = 'structured:' || user_id)
    `, [merged.map((item) => item.userId), spaceId, Object.values(KIND_BY_SOURCE)]);
    const vectorsByUser = new Map<string, UserVectors>();
    for (const row of vectorResult.rows) {
      const source = SOURCE_BY_KIND[row.kind];
      const vector = source ? parsePgvectorLiteral(row.embedding) : null;
      if (!source || !vector) continue;
      const vectors = vectorsByUser.get(row.user_id) || emptyVectors();
      if (source === 'current') vectors.current = vector;
      else vectors[source] = vector;
      vectorsByUser.set(row.user_id, vectors);
    }
    await client.query('commit');
    return {
      viewerVectors,
      spaceId,
      candidates: merged.flatMap((item) => {
        const vectors = vectorsByUser.get(item.userId);
        return vectors ? [{ ...item, vectors }] : [];
      }),
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
