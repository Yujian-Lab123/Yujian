# B · 匹配产品

目标：交付“内容先行 → 了解 TA → 想认识 → 双向确认”的完整闭环。

- 可修改：Encounter/Connect/Connections 页面及 API、`lib/retrieval/**`、`lib/ai/bridge.ts`。
- 禁止修改：画像引擎、认证、数据库 Schema/迁移、全局样式和公共组件。
- 依赖：C 提供用户/推荐/反馈/意向/连接数据服务；A 提供稳定画像摘要契约。
- 验收：空内容不崩溃；已连接、待确认、不感兴趣对象不重复推荐；重复点击不产生重复连接。
- 检查：`npm run check`，覆盖 Demo A 与 Demo B。
