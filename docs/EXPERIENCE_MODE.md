# 体验模式：真实 / Demo 隔离（feat/d-real-demo-isolation）

> 目标：真实产品模式与 Demo 演示模式完全隔离——演示永远只看到预置数据，
> 真实账号永远不接触 Mock 数据。两个模式复用同一套业务组件与 lib 层。

## 隔离机制总览

| 维度 | 真实模式 | 演示模式 |
| --- | --- | --- |
| 入口 | `/about` → 知乎 OAuth → `/onboarding` | `/about` → `/demo` → `/demo/onboarding` |
| Cookie | `yj_session`（沿用） | `yj_demo_session`（独立，8h） |
| 会话用户 | `is_mock=0`（`real-<zhihuId>`） | `is_mock=1`（种子 `u0..u9`，按天轮换） |
| API | `/api/**`（只认真实 Cookie） | `/api/demo/**`（只认演示 Cookie） |
| 导航 | `/profile /me /side /encounter` | `/demo/profile /demo/me /demo/encounter /demo/connections` + 徽章 |
| 推荐池 | 过滤掉全部 Mock 用户 | 只保留 Mock 用户 |

## 代码结构

- `lib/experience-mode/session.ts`：双 Cookie 会话层。`getRealSessionUserId()` /
  `getDemoSessionUserId()` 各自只读自己的 Cookie，并用 `users.is_mock` 做**交叉校验**
  ——即使把真实 session id 塞进演示 Cookie（或反之）也无法越权。
- `lib/experience-mode/identity.ts`：演示身份由服务端在 Mock 池中按 UTC 日期确定性轮换；
  **客户端无法通过 userId 任意切换人物**（API 不接受该参数）。
- `lib/experience-mode/pool.ts`：候选池隔离在 API 出口执行（匹配算法层不感知模式）。
- `lib/experience-mode/nav.ts`：导航模式解析（路由驱动），`/demo/**` 下全部链接保持前缀。
- `lib/experience-mode/empty-state.ts`：画像页产品化空状态（访客/真实未生成/演示访客）。
- `app/api/demo/**`：11 个薄壳路由，业务逻辑与真实路由共享同一 lib 层。
- `app/demo/**`：演示页面，复用 `ProfileExperience`、`ProfileCorner`、`MomentSidebar` 等组件。
- 开发用「切换/生成」面板（ProfileCorner）已从正式 `/profile` 移至 `/demo/profile`。

## 关键行为

1. 真实 API 对演示 Cookie 完全不可见：演示用户访问 `/api/me` 得 401（`/api/me` 额外透出
   `demoSession: true` 供页面引导）。
2. 演示 API 对真实 Cookie 完全不可见；演示会话只能解析到 `is_mock=1` 用户。
3. 演示身份池为空（未跑 seed）时 Demo 登录返回 503，不静默伪造。
4. `POST /api/auth/demo` 不接受任何身份参数；`DELETE /api/auth/demo` 退出演示并只清演示 Cookie。
5. 生产默认关闭演示登录（`DEMO_AUTH_ENABLED !== 'true'` 时 404），真实 OAuth 流程不受影响。
6. Worker/数据库任务与 HTTP 会话无关，演示使用不影响真实画像任务。

## 测试

`lib/experience-mode/*.test.ts` 覆盖：导航前缀与路由切换、真实/演示池互斥、
Cookie 名隔离、演示身份轮换与防指定、空状态选择。
