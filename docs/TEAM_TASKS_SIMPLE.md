# 当前页面分工（通俗版）

现在不要把「长期画像、此刻状态、侧面、相遇」做成一张大杂烩页面。它们的数据可以复用，但页面、代码目录和验收必须分开。

> 当前情况：B 暂时离开，D（负责人）暂代 B 的“侧面画像”工作；其余边界不变。

| 谁负责 | 用户会看到的页面 | 这块页面只回答什么 |
| --- | --- | --- |
| A：Present Self | `/me` | **我今天怎么样？** 心情、状态、想记录的话、是否愿意被推荐 |
| D（暂代 B）：Side / Contextual Persona | `/side` | **我在今天这个情境下呈现什么侧面？** 长期理解和此刻记录并列，不互相覆盖 |
| C：Encounter + Matching | `/encounter`、`/encounter/[id]`、`/connect/[id]`、`/connections` | **我现在适合认识谁，为什么？** 候选、内容桥梁、推荐理由、双向确认 |
| D：产品总控 / 基座 / 集成 | `/`、`/onboarding`、`/profile` 和共享后端 | **项目能否稳定运行、评委能否看懂、三个产品模块能否接起来？** |

## A：此刻 Present Self

页面：`/me`

A 做的是用户本人主动填写的内容：心情、状态、一句记录、遇见开关。这里是**记录入口**，不是长期画像，也不做候选人推荐。

允许改：

- `app/me/**`
- `app/api/me/**`
- `lib/useMe.ts`
- 将来新增的 `lib/present-self/**`

完成标准：用户登录后能记录一句当前状态；刷新后仍看得到；未登录时有清晰引导。

## D（暂代 B）：侧面 Side / Contextual Persona

页面：`/side`

这页把两类已有信息**分开并列展示**：

- 长期理解：长期关注的话题、反复思考的问题；
- 此刻记录：今天主动写下的一句状态；
- 侧面解释：仅说明二者在今天如何同时存在，不重新定义用户的人格。

V1 不新增数据库、API 或模型调用。它只消费已有的 `GET /api/me` 数据；匹配器如需使用“此刻”，只读结构化向量，不能回显原文。

允许改：

- `app/side/**`
- `lib/contextual-persona.ts`
- `lib/contextual-persona.test.ts`

不改：`app/me/**`、`app/profile/**`、数据库、匹配算法、全局样式。

## C：相遇 Encounter + 匹配

页面：`/encounter`、`/encounter/[id]`、`/connect/[id]`、`/connections`

C 负责从“看见一篇内容”到“决定是否想认识”的闭环：候选排序、推荐理由、内容桥梁、喜欢/跳过/想认识、双向确认和已连接状态。

允许改：

- `app/encounter/**`、`app/connect/**`、`app/connections/**`
- `app/api/encounters/**`、`app/api/connections/**`
- `lib/retrieval/**`、`lib/ai/bridge.ts`

不改：此刻记录原文、`/side` 的解释文案、数据库 Schema、OAuth。

## D：产品总控、基座和集成

D 不应该同时替所有人做页面细节；D 的职责是守住共享边界、做暂时无人负责的模块，并在每天的集成窗口处理跨模块问题。

页面和基础设施：

- `/`：Landing，让第一次看项目的人理解产品；
- `/onboarding`：登录后的理解引导；
- `/profile`：独立的长期人物画像，不和 `/side` 合并；
- 数据库、登录、OAuth、画像 Worker、部署和 CI：只在独立基础设施任务中修改。

## 每个人开工前只要记住这五条

1. 先读取自己的 `docs/workstreams/` 文件，再看 `docs/OWNERSHIP.md`。
2. 不要为了加一个按钮就去改别人的页面；先在自己的页面提供链接或提一个接口 Issue。
3. A 的状态原文只给本人；C 在推荐中不能展示它。
4. 一次 PR 只做一个页面/流程节点，避免把视觉、接口、数据库混在一起。
5. 公共文件、数据库、依赖和全局样式先找 D；不要让 Agent 顺手重构。
