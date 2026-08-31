import { randomBytes } from 'node:crypto';
import { topAxes } from '../axes';
import { contentBridge, deepMatch, pairScore } from '../ai/bridge';
import { getDb, getUserVectors, type ContentRow } from '../db';
import { getUser, listUsers, type UserRow } from '../db/users';

// ============ 在线匹配管线 ============
// Hard Filter → Vector Recall → 算法粗排 → Reranker → LLM Deep Match → Content/Conversation Bridge
// 禁止 O(N²) 全文 LLM 比较；LLM 只碰 Top 候选。

export interface RecCard {
  id: string;
  target: {
    id: string; name: string; role: string; city: string; quote: string;
    tags: string[]; zhihu_years: number; upvotes: string;
  };
  anchor: ContentRow;
  reason: string;
  shared: string[];
  difference: { label: string; note: string } | null;
  question: string;
  scores: { long_term: number; conversation: number; current: number; intent: number; novelty: number; coarse: number; rerank: number; mutual: number; final: number };
  status: string;
  moment?: boolean;
}

interface Scored {
  u: UserRow;
  lt: number; val: number; conv: number; cur: number;
  intent: number; novelty: number; diversity: number;
  coarse: number; rerank: number; mutual: number; final: number;
}

export async function buildEncounters(viewerId: string): Promise<RecCard[]> {
  const d = getDb();
  const viewerMaybe = getUser(viewerId);
  if (!viewerMaybe) return [];
  const viewer: UserRow = viewerMaybe;
  const vv = getUserVectors(viewerId);

  // Step 1: Hard Filter（SQL 层条件，几乎零成本）
  let candidates = listUsers().filter((u) => u.id !== viewerId && u.encounter_enabled === 1);
  if (viewer.intents.length > 0) {
    candidates = candidates.filter((u) => u.intents.some((i) => viewer.intents.includes(i)));
  }

  // Step 2: Vector Recall（多维向量各取 Top，合并去重；Demo 规模即全量）
  const scored: Scored[] = candidates.map((u) => {
    const uv = getUserVectors(u.id);
    return {
      u,
      lt: Math.max(0, pairScorePart(vv.long_term, uv.long_term)),
      val: 0, conv: 0, cur: 0, intent: 0, novelty: 0, diversity: 0, coarse: 0, rerank: 0, mutual: 0, final: 0,
    };
  });
  for (const s of scored) {
    const uv = getUserVectors(s.u.id);
    s.val = cos0(vv.value, uv.value);
    s.conv = cos0(vv.conversation, uv.conversation);
    s.cur = vv.current && uv.current ? cos0(vv.current, uv.current) : 0;
  }

  // Step 3: Algorithmic Ranking（启发式权重，概览 §八）
  for (const s of scored) {
    const seen = d.prepare('SELECT 1 FROM recommendations WHERE viewer_id = ? AND target_id = ?').get(viewerId, s.u.id);
    s.novelty = seen ? 0.3 : 1;
    s.intent = viewer.intents.length === 0 || s.u.intents.some((i) => viewer.intents.includes(i)) ? 1 : 0.5;
  }
  scored.sort((a, b) => b.lt - a.lt);
  const pickedAxes: string[] = [];
  for (const s of scored) {
    const dom = topAxes(getUserVectors(s.u.id).long_term, 1)[0]?.axis || '';
    s.diversity = pickedAxes.length === 0 || !pickedAxes.includes(dom) ? 1 : 0.4;
    pickedAxes.push(dom);
    // 30% long_term + 25% conversation + 20% current + 15% intent + 5% novelty + 5% diversity
    s.coarse = 0.3 * s.lt + 0.25 * s.conv + 0.2 * s.cur + 0.15 * s.intent + 0.05 * s.novelty + 0.05 * s.diversity;
    // Step 4: Reranker（Mock：粗排 + 价值问题层余弦；真实阶段换 Qwen Reranker）
    s.rerank = 0.7 * s.coarse + 0.3 * s.val;
  }
  scored.sort((a, b) => b.rerank - a.rerank);
  const top = scored.slice(0, 5);

  // Step 5: LLM Deep Match（只给 Top 5）+ 双向 MutualScore = min(A→B, B→A)
  for (const s of top) {
    const uv = getUserVectors(s.u.id);
    const ab = pairScore(vv, uv);
    const ba = pairScore(uv, vv);
    s.mutual = Math.min(ab, ba);
    s.final = 0.55 * s.rerank + 0.45 * s.mutual;
  }
  top.sort((a, b) => b.final - a.final);

  // Step 6: Content Bridge + Conversation Bridge，持久化推荐
  async function makeCard(s: Scored): Promise<RecCard> {
    const bridge = contentBridge(viewerId, s.u.id);
    const existing = d.prepare("SELECT * FROM recommendations WHERE viewer_id = ? AND target_id = ? AND status = 'fresh'").get(viewerId, s.u.id) as any;
    let reason: any;
    let anchorId: string;
    if (existing?.reason) {
      reason = JSON.parse(existing.reason);
      anchorId = existing.anchor_id;
    } else {
      reason = await deepMatch(viewer, s.u, bridge.anchor.vec);
      anchorId = bridge.anchor.id;
      reason.bridge_reason = bridge.reason;
    }
    const id = existing?.id || `rec-${randomBytes(6).toString('hex')}`;
    const scoresJson = JSON.stringify({ lt: s.lt, conv: s.conv, cur: s.cur, intent: s.intent, novelty: s.novelty, coarse: s.coarse, rerank: s.rerank, mutual: s.mutual, final: s.final });
    if (existing) {
      d.prepare("UPDATE recommendations SET scores = ?, anchor_id = ?, reason = ?, status = 'fresh' WHERE id = ?")
        .run(scoresJson, anchorId, JSON.stringify(reason), id);
    } else {
      d.prepare("INSERT INTO recommendations (id, viewer_id, target_id, scores, anchor_id, reason, status) VALUES (?,?,?,?,?,?,'fresh')")
        .run(id, viewerId, s.u.id, scoresJson, anchorId, JSON.stringify(reason));
    }
    return {
      id,
      target: { id: s.u.id, name: s.u.name, role: s.u.role, city: s.u.city, quote: s.u.quote, tags: s.u.tags, zhihu_years: s.u.zhihu_years, upvotes: s.u.upvotes },
      anchor: bridge.anchor,
      reason: reason.bridge_reason || reason.why_for_viewer || '',
      shared: (reason.shared_ground || []).map((x: any) => x.label),
      difference: reason.interesting_difference,
      question: reason.conversation_question || '',
      scores: { long_term: s.lt, conversation: s.conv, current: s.cur, intent: s.intent, novelty: s.novelty, coarse: s.coarse, rerank: s.rerank, mutual: s.mutual, final: s.final },
      status: 'fresh',
    };
  }

  const cards: RecCard[] = [];
  for (const s of top.slice(0, 3)) cards.push(await makeCard(s));

  // Step 7: 此刻遇见 —— 有当前状态时，此刻状态最契合的人置顶（Present Self 改变推荐，概览 §十五/§十六）
  if (vv.current) {
    const momentCandidate = [...scored].sort((a, b) => b.cur - a.cur)[0];
    if (momentCandidate && momentCandidate.cur >= 0.55) {
      const existingCard = cards.find((c) => c.target.id === momentCandidate.u.id);
      if (existingCard) {
        existingCard.moment = true;
        cards.splice(cards.indexOf(existingCard), 1);
        cards.unshift(existingCard);
      } else {
        if (momentCandidate.mutual === 0) {
          const uv = getUserVectors(momentCandidate.u.id);
          momentCandidate.mutual = Math.min(pairScore(vv, uv), pairScore(uv, vv));
          momentCandidate.final = 0.55 * momentCandidate.rerank + 0.45 * momentCandidate.mutual;
        }
        const card = await makeCard(momentCandidate);
        card.moment = true;
        cards.unshift(card);
      }
    }
  }
  return cards;
}

function pairScorePart(a: number[], b: number[]): number {
  return cos0(a, b);
}

function cos0(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export function getRec(id: string) {
  const r = getDb().prepare('SELECT * FROM recommendations WHERE id = ?').get(id) as any;
  return r || null;
}
