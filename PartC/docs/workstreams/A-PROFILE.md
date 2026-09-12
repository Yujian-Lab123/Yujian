# A · 画像产品

目标：交付可解释、可追溯、内容长度自适应的人物画像与“我的”体验。

- 可修改：`app/profile/**`、`app/me/**`、`lib/profile/**`、`lib/ai/profile.ts`。
- 禁止修改：数据库 Schema/迁移、Provider、匹配模块、全局样式和公共组件。
- 依赖：C 提供画像任务与产物接口；需要新字段时先提契约 Issue。
- 验收：空/短/长画像均不重叠；证据抽屉可追溯；Qwen 模型和 Prompt 版本有记录；失败状态可恢复。
- 检查：`npm run check`，并附桌面及移动端截图。
