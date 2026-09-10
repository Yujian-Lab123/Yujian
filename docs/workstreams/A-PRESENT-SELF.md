# A · 此刻 Present Self

## 负责什么

只负责 `/me`：让用户主动记录心情、状态和一句当下想法，并控制是否开启“遇见”。这不是长期画像页，也不做候选人匹配。

## 允许修改的路径

- `app/me/**`
- `app/api/me/**`
- `lib/useMe.ts`
- `lib/present-self/**`（新增时）

## 禁止修改的共享路径

- `app/side/**`、`lib/contextual-persona.ts`
- `app/profile/**`、`lib/profile/**`
- `app/encounter/**`、`lib/retrieval/**`
- 数据库 Schema/迁移、Provider、全局样式、公共组件、依赖和框架配置

## 依赖的接口

- `GET /api/me`
- `POST /api/me/current-state`
- `POST /api/me/toggle`

## 必须保持的行为

- 未登录用户不会看到其他人的状态。
- 状态原文只给本人使用；A 不在页面外传播它。
- 每次保存状态后，刷新页面仍能读到最新状态。

## 验收标准

- 未登录、首次登录、已有状态三种状态都有明确 UI。
- 记录为空时不能写入空数据。
- 桌面和移动端表单不会遮挡或溢出。

## 必须执行的检查

`npm run check`；附 `/me` 的桌面和移动端截图。

## Agent 任务外壳

```text
任务目标：
责任角色：A
允许修改的路径：app/me/**、app/api/me/**、lib/useMe.ts、lib/present-self/**
禁止修改的共享路径：数据库、全局样式、公共组件、/side、/profile、/encounter
依赖的接口：GET /api/me；POST /api/me/current-state；POST /api/me/toggle
必须保持的行为：状态只对本人可见；空状态不能写入
验收标准：未登录/首次/已有状态均可用；移动端不溢出
必须执行的检查：npm run check
```
