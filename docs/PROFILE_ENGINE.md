# 人物画像分析引擎(爬虫验证线)

> 比赛 OAuth 未开放期间的验证路径:用 media-crawler 抓取知乎大V公开内容 → 引擎生成六维画像 → 人工评析准确度。
> 规格来源:《用户画像.txt》;与在线匹配管线(`lib/retrieval`)完全解耦,后续 OAuth 开放后可直接接入 `raw_contents`。

## 架构

```
原始内容(RawContent[])
  → normalizeContents 归一化(字段宽松映射 / HTML 清洗 / 时间规范化 / 稳定 id)
  → [阶段一·解析模型 qwen3.7-flash] 逐批提取候选线索(0~4 条/篇,六类 kind)
  → [阶段二·汇总模型 qwen3.8-flash] 压缩漏斗(删弱证据→并同义→提上位模式→按六标准排序)
  → zod 校验(失败带错误重试一次)
  → 证据消毒(evidence_ids 必须真实存在;无证据结论删除;unknown 结论挪入 unknowns;按 LIMITS 裁剪)
  → ProfileArtifact(JSON)+ 人工评析报告(Markdown)
```

| 模块 | 职责 |
| --- | --- |
| `lib/profile/schema.ts` | 六维画像 zod Schema、候选线索 Schema、前后台数量约束(LIMITS/MINS)、产物类型 |
| `lib/profile/prompt.ts` | 两阶段提示词(编码《用户画像.txt》的压缩漏斗/六标准/禁止内容/自检清单) |
| `lib/profile/engine.ts` | 管线主体:`analyzeProfile(raw, opts)` |
| `lib/profile/report.ts` | `renderReport(artifact)` → 三级结构 Markdown + 人工评析表 |
| `scripts/analyze-profile.ts` | CLI 入口 |
| `scripts/fixtures/lin-yizhou.json` | 虚构人物测试样例(12 篇,埋入六维信号,用于冒烟/回归) |

## 用法

```bash
# 测试样例(虚构人物)
node --env-file=.env.local scripts/analyze-profile.ts --fixture

# 先预览(不调 LLM、不花钱):检查字段映射 + 查看抓到了哪些作者
node --env-file=.env.local scripts/analyze-profile.ts --input data/crawler/某人.json --peek

# 正式分析(可多次 --input 合并回答/文章;--author 从混合数据中筛出目标大V)
node --env-file=.env.local scripts/analyze-profile.ts \
  --input data/crawler/zhihu/某人-回答.json \
  --input data/crawler/zhihu/某人-文章.json \
  --author "某人" \
  --name "某人"
```

输出到 `profile-output/`(已 gitignore):
- `<名字>.profile.json` —— 完整产物:profile + evidence_index(Level 3)+ meta(告警/模型/时间范围)
- `<名字>.report.md` —— 三级结构报告,末尾带人工评析表;用 VS Code / 浏览器 Markdown 预览打开

## 从 MediaCrawler 到画像的完整流程

MediaCrawler 副本在 `media-crawler/`(已适配:知乎 creator 模式同时抓回答+文章,见 `media_platform/zhihu/core.py` 的「遇见 适配」注)。系统 Python 直接可跑(依赖与 chromium 已装好)。

**第 0 步 · 粘贴大V主页网址**(只需一次,可多个):

```python
# media-crawler/config/zhihu_config.py
ZHIHU_CREATOR_URL_LIST = [
    "https://www.zhihu.com/people/<url_token>",   # ← 把大V主页地址粘贴在这里
]
```

**第 1 步 · 抓取 + 转换**(浏览器弹出后用知乎 App 扫码,登录态会被记住):

```bash
node scripts/convert-crawler.mjs --crawl --name "大V名"
```

**第 2 步 · 生成画像并评析**:

```bash
node --env-file=.env.local scripts/analyze-profile.ts --input "data/crawler/大V名.json" --name "大V名"
```

输出到 `profile-output/`:`<名>.report.md` 用 VS Code/浏览器打开,填末尾人工评析表;`.profile.json` 是机器可读版。

说明:
- 指定知乎用户 = 主页网址(`https://www.zhihu.com/people/xxx`)粘贴到 `ZHIHU_CREATOR_URL_LIST`;`--author` 可在数据混入其他作者时再过滤;
- creator 模式按 `is_end` 全量翻页,大V内容多时第一次会跑一阵;`--peek` 可随时核对映射不花钱;
- MediaCrawler 遵循其原许可(非商业学习用途),控制频率、仅作研究用途、抓取内容不要对外发布。


## 输入格式

归一化格式(字段均可缺省,有 `text` 即可):

```json
[{ "id": "c-001", "title": "标题", "text": "正文", "type": "answer|article|pin",
   "url": "https://...", "published_at": "2024-01-01" }]
```

CLI 做宽松字段映射,兼容 media-crawler / 知乎 API 常见命名:`content/content_text/text/excerpt/desc` → 正文;`publish_time/created_at/created_time` → 时间(支持 epoch 秒/毫秒);`answer→回答 article→文章 pin/idea→想法` 等。文件顶层接受数组或 `{contents|items|data|answers|articles: [...]}`。

## 六维画像(前台每维 3~5 条)

① 走过什么(人生轨迹,4~7 节点:事件→变化→后续影响)② 在追求什么(长期关切 3~5 问 + 驱动力 2~4 个)③ 通常怎么做(决策模式,过程链)④ 重视什么(价值取舍对偶 + lean 六档,禁止百分比)⑤ 怎么与人交流(特征 + 1~3 条开场建议)⑥ 代表内容(3~5 篇 Content Anchors)。另:`unknowns` 主动承认无法判断的维度。

每条结论:`claim / explanation / type(explicit|inferred) / confidence / evidence_ids`,点击证据可见原文、时间、链接(Level 3)。

## 人工评析流程

1. 选定大V,抓取 30~50 篇回答+文章(只要本人创作,丢弃评论与他人内容);
2. 跑 CLI,打开 `.report.md`;
3. 对照你对 TA 的公开认知,逐维填 ✅/🟡/❌,记录最有问题的结论、误判、漏判、挂错的证据;
4. 多人多维汇总后,回修 `lib/profile/prompt.ts`(经验上最先出问题的:对话风格只有单声道内容、轨迹时间颗粒度、价值取舍证据不足)。

## 改哪里(常见调整)

| 想改什么 | 去哪个文件 |
| --- | --- |
| **抓哪些大V** | `media-crawler/config/zhihu_config.py` 的 `ZHIHU_CREATOR_URL_LIST` |
| 画像规则/口径(六维标准、压缩漏斗、禁止项、自检) | `lib/profile/prompt.ts`(EXTRACT_SYSTEM / SYNTH_SYSTEM) |
| 每维展示条数上限/下限(3~5、4~7 等) | `lib/profile/schema.ts` 的 `LIMITS` / `MINS` |
| 管线参数(每批条数、正文截断、token 预算、模型档位) | `lib/profile/engine.ts` 的 `EXTRACT_OPTS` / `SYNTH_OPTS` / `AnalyzeOptions` |
| 新增字段映射(爬虫输出的字段名认不出时) | `scripts/analyze-profile.ts` 的 `looseExtract` 宽松映射表 |
| 报告样式/评析表格式 | `lib/profile/report.ts` |
| 测试样例人物 | `scripts/fixtures/lin-yizhou.json` |
| 输入文件格式要求 | 见上文「输入格式」;`data/crawler/sample-mixed.json` 是一份含脏字段的示例 |

## 已知边界与调参

- **抽取缓存**:默认写 `data/crawler/.extract-cache.json`,键 = 提示词版本+模型+内容id+正文哈希。内容不变的重跑直接命中(0 次抽取调用),换模型或改提示词自动失效;`--cache <path>` 可换位置,`--max-items N` 限制单人分析条数(默认 80,超出按时间均匀采样保跨年证据)。

- **当前 Qwen 配置**：`.env.local` 中抽取使用 `qwen3.7-flash`，汇总使用 `qwen3.8-flash`；画像任务显式关闭 `enable_thinking`，以降低延迟与推理 token 消耗。`EXTRACT_OPTS.maxTokens=4096` / `SYNTH_OPTS.maxTokens=8192` 是结构化 JSON 的安全上限，可按实际产物长度再下调。
- 单条正文默认截断 3000 字(`--max-chars` / `opts.maxTextChars`);候选线索上限 400 条。
- 内容不足(如 <10 篇)时轨迹/风格维度容易低于建议条数,`meta.warnings` 会如实提示,报告"管线告警"一节可见。
- 只有文章/回答、没有评论互动时,对话风格置信度偏低——这是《用户画像.txt》预期的行为,引擎会把它写进 unknowns 而不是编造。
- 成本参考:12 篇样例 ≈ 2 次抽取(flash 档)+ 1 次汇总(flash 档);30~50 篇真实数据约 5~7 次调用。首次真实验证建议加 `--max-items 12`，确认质量后再扩大样本。
