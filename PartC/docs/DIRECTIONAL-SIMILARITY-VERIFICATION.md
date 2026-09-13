# P3 非对称相似度验证报告

验证日期：2026-09-14

## 实施结论

P3 的 `Pair(A→B)` 已从名义双向余弦升级为真正的方向性分数，同时保持 P2/P5 召回余弦、P6 Reranker、`mutual=min(forward, backward)` 和既有 Final 权重不变。

仅当双方长期与价值向量均为 16 维、有限、位于 `[0,1]` 的概念轴时，使用：

```text
Coverage(A→B) = Σ min(Ai, Bi) / (Σ Ai + 1e-9)
GKL(A||B)      = Σ [(Ai+1e-6) ln((Ai+1e-6)/(Bi+1e-6)) - (Ai+1e-6) + (Bi+1e-6)]
GKLScore(A→B)  = exp(-max(0, GKL) / 16)
Axis(A→B)      = 0.5 × Coverage + 0.5 × GKLScore
```

方向配对分保持原权重：

```text
Pair(A→B) = 0.4 × AxisLongTerm(A→B)
          + 0.3 × AxisValue(A→B)
          + 0.2 × CosineConversation(A,B)
          + 0.1 × CosineCurrent(A,B)

mutual = min(Pair(A→B), Pair(B→A))
final  = 0.55 × rerank + 0.45 × mutual
```

1024 维或含负数的通用 Embedding 使用 `embedding-cosine` 模式，长期和价值层均回退余弦；不会执行 Coverage、GKL、Softmax 或负数截断。

## 数学样例

输入：

```text
A = [0.9, 0.1, 其余 0]
B = [0.09, 0.01, 其余 0]
```

两者余弦为 `1.000`，但方向性结果为：

| 方向 | 模式 | Coverage | GKLScore | Pair |
| --- | --- | ---: | ---: | ---: |
| A → B | concept-axis-directed | 0.100 | 0.916 | 0.556 |
| B → A | concept-axis-directed | 1.000 | 0.959 | 0.886 |

这证明新算法保留了余弦归一化会丢失的强度差异。相同非零向量的 Coverage、GKLScore 和 AxisDirectional 均为 `1`；空 source 返回 `0`；错误维度和负数不会被识别为概念轴；大量零值仍输出有限分数。

## Demo A 回归

默认浏览者为 `u0 江树`，过滤后候选仍为 `u2 / u3 / u4 / u7`。排序保持：

```text
u2 陈默 → u7 青灯 → u4 林医生 → u3 阿屿
```

| 排名 | 候选 | Forward | Backward | Mutual | Rerank | Final |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | u2 陈默 | 0.673 | 0.729 | 0.673 | 0.779 | 0.732 |
| 2 | u7 青灯 | 0.540 | 0.680 | 0.540 | 0.672 | 0.613 |
| 3 | u4 林医生 | 0.441 | 0.569 | 0.441 | 0.626 | 0.543 |
| 4 | u3 阿屿 | 0.185 | 0.406 | 0.185 | 0.336 | 0.268 |

Demo A 第一名仍为陈默，Content Bridge 第一篇仍为 `c24《自由职业第三年：关于收入不稳定的诚实回答》`。

## Demo B 回归

按照较新的“此刻”隐私契约，江树与阿屿使用相同结构化状态：

```text
心情：疲惫；活动：想走走；交流：找同伴
```

因此 Current 相似度是 `1.000`，不是旧交接文档基于两句自由文本得到的约 `0.819`。这是隐私改造后的预期变化，不是方向性算法回归。阿屿的结果为：

| Forward | Backward | Mutual | Rerank | Final | Moment |
| ---: | ---: | ---: | ---: | ---: | --- |
| 0.285 | 0.506 | 0.285 | 0.476 | 0.390 | 达到 `current ≥ 0.55`，提升为首卡 |

Moment 后顺序仍为：

```text
u3 阿屿 → u2 陈默 → u7 青灯 → u4 林医生
```

## 输出契约

- `RankingFeatures` 与 `EncounterScores` 新增 `forward / backward`，原字段未删除或重命名。
- 推荐记录的 `scores` 保存 `forward / backward / mutual / final`。
- `bridge` 调试信息保存 `directionality_mode / forward / backward`。
- P6 模型分只替换 `rerank` 并重算 `final`，会保留方向分和 `mutual`。

## 实际检查

已通过：

```text
node --experimental-strip-types scripts/verify-p2-p3.mjs  # 51 项断言
node --experimental-strip-types scripts/verify-p4.mjs
node --experimental-strip-types scripts/verify-p5.mjs
node --experimental-strip-types scripts/verify-p6.mjs
node --experimental-strip-types scripts/verify-p7.mjs     # 18 项断言
node --experimental-strip-types scripts/verify-current-state-privacy.mjs
```

新增及修改的 TypeScript 文件也已通过 Node strip-types 语法检查。

已尝试完整 `npm run check`，但在第一步 `eslint .` 失败：当前项目副本没有 `node_modules`，系统找不到 `eslint`，且没有全局 `tsc`。本轮遵守要求，没有安装依赖、调用真实模型或运行数据库迁移。
