import type { ProfileArtifact } from './schema.ts';

// ============ 画像报告渲染:三级结构 + 证据注记 + 人工评析表 ============
// 供 CLI 产出 Markdown;后续前端 Level 1/2/3 页面可复用同一数据(artifact.profile)。

export function renderReport(a: ProfileArtifact): string {
  const p = a.profile;
  const L: string[] = [];
  const ev = (ids: string[]) =>
    ids.map((id) => {
      const e = a.evidence_index.find((x) => x.id === id);
      return e ? `〔${id} ${e.title || e.type}${e.date ? `·${e.date}` : ''}〕` : `〔${id}〕`;
    }).join(' ');

  L.push(`# 人物画像 · ${a.subject.name || '未署名'}`);
  const m = a.meta;
  const types = Object.entries(m.type_counts).map(([k, v]) => `${k}${v}`).join(' / ');
  L.push(`> ${p.summary.one_sentence}`);
  L.push('');
  L.push(`信息来源 ${m.content_count} 篇(${types}) · 覆盖时间 ${m.time_range ? `${m.time_range.from} ~ ${m.time_range.to}` : '未知'} · 模型 ${m.models.cheap}(抽取)+ ${m.models.main}(综合)`);
  L.push('');

  L.push('## Level 1 · 核心结论');
  for (const c of p.summary.core_insights) {
    L.push(`- **${c.claim}**〔${c.type === 'explicit' ? '本人明确表达' : '推断'}·${labelConfidence(c.confidence)}〕`);
    L.push(`  ${c.explanation}`);
    if (c.evidence_ids.length) L.push(`  证据:${ev(c.evidence_ids)}`);
  }
  L.push('');

  L.push('## Level 2 · 人物地图');
  L.push('### ① 走过什么｜人生轨迹');
  for (const n of p.life_trajectory) {
    L.push(`- **${n.period} ${n.event}**`);
    L.push(`  变化:${n.change}`);
    L.push(`  后续影响:${n.later_impact}`);
    if (n.evidence_ids.length) L.push(`  证据:${ev(n.evidence_ids)}`);
  }
  L.push('');
  L.push('### ② 在追求什么｜长期关切与驱动力');
  L.push('**长期关切(反复思考的问题):**');
  for (const q of p.long_term_concerns) {
    L.push(`- ${q.question} — ${q.explanation}`);
    if (q.evidence_ids.length) L.push(`  证据:${ev(q.evidence_ids)}`);
  }
  L.push('**驱动力:**');
  for (const d of p.drivers) {
    L.push(`- ${d.driver} — ${d.explanation}`);
    if (d.evidence_ids.length) L.push(`  证据:${ev(d.evidence_ids)}`);
  }
  L.push('');
  L.push('### ③ 通常怎么做｜决策模式');
  for (const d of p.decision_patterns) {
    L.push(`- **${d.name}**: ${d.description}`);
    L.push(`  过程:${d.process.join(' → ')}`);
    if (d.evidence_ids.length) L.push(`  证据:${ev(d.evidence_ids)}`);
  }
  L.push('');
  L.push('### ④ 重视什么｜价值偏好(真实选择中的取舍)');
  for (const v of p.value_preferences) {
    L.push(`- ${v.left} ←→ ${v.right}:**${labelLean(v.lean)}**`);
    L.push(`  ${v.explanation}`);
    if (v.evidence_ids.length) L.push(`  证据:${ev(v.evidence_ids)}`);
  }
  L.push('');
  L.push('### ⑤ 怎么与人交流｜对话风格');
  for (const t of p.conversation_style.traits) {
    L.push(`- ${t.trait} — ${t.explanation}`);
    if (t.evidence_ids.length) L.push(`  证据:${ev(t.evidence_ids)}`);
  }
  if (p.conversation_style.good_entry_points.length) {
    L.push('**适合怎么和 TA 聊:**');
    for (const s of p.conversation_style.good_entry_points) L.push(`- ${s}`);
  }
  L.push('');
  L.push('### ⑥ 代表内容｜Content Anchors');
  for (const r of p.representative_contents) {
    L.push(`- **《${r.title}》**(${r.content_type}${r.date ? `·${r.date}` : ''})`);
    L.push(`  为什么代表 TA:${r.why_representative}`);
    L.push(`  支持的结论:${resolveSupports(r.supports, p)}`);
    L.push(`  来源:${r.content_id}${ev([r.content_id])}`);
  }
  L.push('');
  L.push('## 我们还不知道(unknowns)');
  for (const u of p.unknowns) L.push(`- ${u}`);
  L.push('');

  L.push('## Level 3 · 证据索引');
  L.push('| content_id | 类型 | 日期 | 标题 | 摘要 | 链接 |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const e of a.evidence_index) {
    L.push(`| ${e.id} | ${e.type} | ${e.date || '—'} | ${e.title || '—'} | ${e.excerpt.replace(/\|/g, '\\|').slice(0, 80)} | ${e.url || '—'} |`);
  }
  L.push('');

  if (a.meta.warnings.length) {
    L.push('## 管线告警');
    for (const w of a.meta.warnings) L.push(`- ${w}`);
    L.push('');
  }

  L.push('---');
  L.push('## 人工评析(请填写)');
  L.push('对照你对这个人的了解,逐维打分:✅ 准确 / 🟡 部分准确 / ❌ 不准,并写出最有问题的那条结论。');
  L.push('');
  L.push('| 维度 | 准确 | 部分准确 | 不准 | 最有问题的一条(如有) |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const dim of ['核心结论', '人生轨迹', '长期关切', '驱动力', '决策模式', '价值偏好', '对话风格', '代表内容']) {
    L.push(`| ${dim} |  |  |  |  |`);
  }
  L.push('');
  L.push('补充评析(误判了什么?漏掉了什么?哪条证据挂错了?):');
  L.push('');
  return L.join('\n');
}

function labelConfidence(c: string): string {
  return c === 'high' ? '高置信' : c === 'medium' ? '中置信' : '低置信';
}

function labelLean(l: string): string {
  const map: Record<string, string> = {
    left: '明显偏「左」', slightly_left: '略偏「左」', neutral: '居中/看情况',
    slightly_right: '略偏「右」', right: '明显偏「右」', unknown: '证据不足,无法判断',
  };
  return map[l] || l;
}

/** 模型可能用 "dimension.N" 索引路径引用结论,解析为对应原文;其余原样保留 */
function resolveSupports(supports: string[], p: ProfileArtifact['profile']): string {
  const parts = supports.map((s) => {
    const m = /^(summary\.core_insights|life_trajectory|long_term_concerns|drivers|decision_patterns|value_preferences|conversation_style\.traits)\.(\d+)$/.exec(s.trim());
    if (!m) return s;
    const pool: Record<string, unknown>[] =
      m[1] === 'summary.core_insights' ? p.summary.core_insights
      : m[1] === 'life_trajectory' ? p.life_trajectory
      : m[1] === 'long_term_concerns' ? p.long_term_concerns
      : m[1] === 'drivers' ? p.drivers
      : m[1] === 'decision_patterns' ? p.decision_patterns
      : m[1] === 'value_preferences' ? p.value_preferences
      : p.conversation_style.traits;
    const item = pool[Number(m[2])];
    const text = item && (item.claim || item.event || item.question || item.driver || item.name || item.trait);
    return typeof text === 'string' && text ? `「${text}」` : s;
  });
  return parts.join(';') || '(未标注)';
}
