# “此刻”结构化匹配与私密记录边界

## 结论

“此刻”只允许三个白名单结构化字段参与匹配：

- `mood`：平静 / 期待 / 开心 / 疲惫 / 迷茫；
- `activity`：学习中 / 工作中 / 创作中 / 休息中 / 想走走；
- `connectionMode`：想深聊 / 轻松聊聊 / 找同伴 / 只想看看。

用户选填的自由文本 `privateNote` 只在提交请求期间发送给配置的 LLM 做私密理解，不进入 16 维 Mock 向量、1024 维 Embedding、Reranker、推荐理由或页面展示。原文不写数据库、不写日志、不在 API 响应中返回；LLM 不可用或结果校验失败时，原文直接丢弃，结构化状态照常保存。

## 数据流

```text
结构化选择 ─→ 白名单校验 ─→ 规范文本 ─┬→ 16 维 Mock current
                                      ├→ 1024 维 profile_current
                                      └→ Reranker Current State

自由文本 ─→ 最长 300 字 ─→ LLM 私密理解 ─→ 仅保存白名单主题分类/支持需求/状态
                       └─ 不可用或失败 ─→ 丢弃原文
```

规范匹配文本固定为：

```text
心情：{mood}；活动：{activity}；交流：{connectionMode}
```

## 兼容存储

为避免修改冻结 Schema，现有 `current_states.text` 列保存版本化 JSON 封装，而不是自由文本：

```json
{
  "version": 2,
  "match": { "mood": "疲惫", "activity": "想走走", "connectionMode": "找同伴" },
  "privateNote": { "status": "understood", "understanding": { "themes": ["work", "rest"], "supportNeed": "companion" } }
}
```

旧版纯文本行无法解码为 v2，读取时直接返回空状态，不参与展示或内存匹配。pgvector 中新状态使用 `source_id = structured:{userId}`；ANN 查询只接收该来源，因此历史自由文本向量即使暂未物理清理也无法命中。

## API 契约

`POST /api/me/current-state`：

```json
{
  "mood": "疲惫",
  "activity": "想走走",
  "connectionMode": "找同伴",
  "privateNote": "选填，仅临时交给 LLM"
}
```

LLM 输出也只能使用固定英文主题枚举和四类支持需求，不允许生成或持久化自由文本摘要。响应只返回保存 ID 与 `note_status`，不返回原文或派生理解。`GET /api/me` 只返回 `selection`、`private_note_status` 和时间。

## 验收

无需依赖、数据库或真实模型即可运行：

```bash
node --experimental-strip-types scripts/verify-current-state-privacy.mjs
```

真实 LLM 的数据保留策略、地域、供应商条款和网络日志仍需在生产上线前单独完成隐私评审。
