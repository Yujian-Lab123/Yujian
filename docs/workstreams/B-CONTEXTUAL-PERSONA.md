# B · 侧面 Side / Contextual Persona

> 当前由 D 暂代。交接给新成员时，只交接本文件列出的路径。

## 负责什么

只负责 `/side`：将“长期理解”和“此刻记录”**分开并列解释**。它不能取代 `/profile` 的长期画像，也不能写入或展示匹配逻辑。

## 允许修改的路径

- `app/side/**`
- `lib/contextual-persona.ts`
- `lib/contextual-persona.test.ts`

## 禁止修改的共享路径

- `app/me/**`、`app/api/me/**`、`lib/useMe.ts`
- `app/profile/**`、`lib/profile/**`
- `app/encounter/**`、`app/connect/**`、`app/connections/**`、`lib/retrieval/**`
- 数据库 Schema/迁移、API 契约、全局样式、公共组件、依赖和框架配置

## 依赖的接口

- `GET /api/me` 中的 `currentState` 与 `understanding`
- `lib/contextual-persona.ts` 的纯函数输入输出

## 必须保持的行为

- 不能从一条状态记录推断长期人格、健康状况或关系状态。
- 不新增数据库/API/LLM 调用；需要这些能力时先提契约 Issue。
- 当前状态原文只在本人页面展示；给 C 的只能是必要的结构化信号。
- 长文本、缺少长期理解、缺少此刻记录时页面仍可读。

## 验收标准

- 登录后的四种数据组合（两者都有 / 只有此刻 / 只有长期 / 都没有）都有明确说明。
- 文案明确“并列、不覆盖”，没有绝对的人格判断。
- 单元测试覆盖至少三种数据组合。

## 必须执行的检查

`npm run check`；附 `/side` 的桌面和移动端截图。

## Agent 任务外壳

```text
任务目标：
责任角色：B（当前 D 暂代）
允许修改的路径：app/side/**、lib/contextual-persona.ts、lib/contextual-persona.test.ts
禁止修改的共享路径：/me、/profile、/encounter、数据库、API 契约、全局样式、公共组件
依赖的接口：GET /api/me 的 currentState 和 understanding
必须保持的行为：一次状态不等于长期人格；状态原文不对外展示
验收标准：四种数据组合清晰、可读；测试覆盖规则层
必须执行的检查：npm run check
```
