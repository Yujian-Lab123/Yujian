# P2 / P3 可复现验证报告

验证日期：2026-09-08

验证脚本：`scripts/verify-p2-p3.mjs`

复现命令：

```powershell
cd C:\Users\Lenovo\Desktop\知乎黑客松\Yujian-main\Yujian-main
node --experimental-strip-types scripts/verify-p2-p3.mjs
```

## 验证边界

脚本直接加载项目中的真实模块：

- `lib/retrieval/candidate-filter.ts`
- `lib/retrieval/multi-recall.ts`
- `lib/retrieval/scoring.ts`
- `lib/db/seed.ts`
- `lib/axes.ts`

它使用真实种子人物和 27 篇种子内容，按 `computeUserVectors` 相同的加权逻辑构造 Mock 画像。因为当前压缩包没有 `node_modules`，脚本不启动 Next.js 或 PostgreSQL，也不写数据库；它验证的是 P1 → P2 → P3 的算法级集成流程，并用相同公式检查下游 Content Bridge。

## 完整流程

```text
10 个种子用户 + 27 篇种子内容
        ↓
P1 硬过滤
        ↓
4 个合格候选
        ↓
内容向量加权 → LongTerm / Value / Conversation / Current
        ↓
P2 四路独立召回
        ↓
按用户 ID 合并去重 + 保存召回来源
        ↓
P3 特征计算
        ↓
Coarse → Mock Rerank → Mutual → Final
        ↓
普通推荐顺序
        ↓
Current ≥ 0.55 时应用 Moment 提升
        ↓
Content Bridge / Encounter 卡片
```

## 场景 A：普通长期匹配

浏览者：`u0 江树`，意愿为“朋友、随便聊聊”，无 Current State。

### 1. P1 输入边界

| 用户 | 结果 | 原因 |
| --- | --- | --- |
| u0 江树 | 排除 | self |
| u1 远山与近海 | 排除 | connected |
| u2 陈默 | 通过 | pass |
| u3 阿屿 | 通过 | pass |
| u4 林医生 | 通过 | pass |
| u5 周老师 | 排除 | encounter_disabled |
| u6 老猫 | 排除 | not_interested |
| u7 青灯 | 通过 | pass |
| u8 半月 | 排除 | outgoing_pending |
| u9 何溯 | 排除 | blocked |

进入 P2 的候选为 `u2、u3、u4、u7`。

### 2. P2 各路召回结果

| 候选 | LongTerm | Value | Conversation | Current |
| --- | ---: | ---: | ---: | ---: |
| u2 陈默 | 0.838 | 0.933 | 0.847 | 未启用 |
| u3 阿屿 | 0.167 | 0.289 | 0.227 | 未启用 |
| u4 林医生 | 0.455 | 0.654 | 0.908 | 未启用 |
| u7 青灯 | 0.605 | 0.739 | 0.846 | 未启用 |

合并后仍为 4 个唯一用户，没有重复。每个结果都保存 `long_term + value + conversation` 三个召回来源及各自分数。

### 3. P3 排序结果

| 排名 | 候选 | LT | Value | Conv | Coarse | Rerank | Mutual | Final |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | u2 陈默 | 0.838 | 0.933 | 0.847 | 0.713 | 0.779 | 0.785 | 0.782 |
| 2 | u7 青灯 | 0.605 | 0.739 | 0.846 | 0.643 | 0.672 | 0.633 | 0.655 |
| 3 | u4 林医生 | 0.455 | 0.654 | 0.908 | 0.613 | 0.626 | 0.560 | 0.596 |
| 4 | u3 阿屿 | 0.167 | 0.289 | 0.227 | 0.357 | 0.336 | 0.199 | 0.274 |

脚本对每个人分别重新代入公式，验证 `Coarse`、`Rerank` 和 `Final` 与模块输出完全一致。第一名为 `u2 陈默`。

### 4. 下游 Content Bridge 检查

对第一名陈默的内容使用当前 `contentBridge` 相同公式：

| 排名 | 内容 | Bridge 分 |
| ---: | --- | ---: |
| 1 | c24《自由职业第三年：关于收入不稳定的诚实回答》 | 0.953 |
| 2 | c21《我为什么没有留在大厂》 | 0.931 |
| 3 | c23《一次西藏旅行：在海拔五千米想通的事》 | 0.278 |
| 4 | c22《如何选择 35mm 镜头？》 | 0.251 |

需要区分：`c21` 是 Demo 契约中必须保留的关键内容锚点，但当前算法实际选择的第一 Content Bridge 是 `c24`。这不是 P2/P3 排名错误；若产品演示必须固定展示 `c21`，需要另行调整 Bridge 规则或 Demo 数据，不能把当前运行结果写成 `c21` 第一。

## 场景 B：Current State 相遇

给江树加入：

```text
很想晚上找个人出去走走
```

阿屿的种子状态同样包含“晚上找个人出去走走”，P2 的 Current 路只命中：

| 候选 | Current 相似度 | 是否达到阈值 |
| --- | ---: | --- |
| u3 阿屿 | 0.819 | 是，阈值为 0.55 |

Current 融合后的普通 Final 排序仍是：

| 排名 | 候选 | Current | Coarse | Rerank | Mutual | Final |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | u2 陈默 | 0 | 0.713 | 0.779 | 0.785 | 0.782 |
| 2 | u7 青灯 | 0 | 0.643 | 0.672 | 0.633 | 0.655 |
| 3 | u4 林医生 | 0 | 0.613 | 0.626 | 0.560 | 0.596 |
| 4 | u3 阿屿 | 0.819 | 0.520 | 0.451 | 0.281 | 0.374 |

随后 Encounter 的 Moment 规则选择 Current 分最高且不低于 0.55 的候选，并提升到首卡，最终卡片顺序为：

```text
u3 阿屿 → u2 陈默 → u7 青灯 → u4 林医生
```

## 结果

脚本退出码为 `0`，共执行并通过 21 项断言：

- P2：四路召回、合并去重、来源追踪、Current 路由；
- P3：特征计算、粗排、Mock Rerank、Mutual、Final 排序；
- 集成：普通 Demo 第一名、Content Bridge 公式和 Moment 提升。

运行时只有 `MODULE_TYPELESS_PACKAGE_JSON` 警告。为了遵守冻结文件约束，本次没有修改 `package.json` 来消除该警告。
