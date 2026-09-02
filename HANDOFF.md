# 遇见 · AI 交接文档

> 写给下一个接手的 AI/开发者:读完这一篇 + `audit-output/PROJECT_AUDIT.md`,你就能安全上手。
> 最后更新:2026-09-03 · 仓库:https://github.com/Nobody-sink-it/Yujian · 分支 main

## 一、项目是什么

「遇见」——知乎 Hackathon 项目。核心假设:**通过一个人长期留下的公开内容,发现值得认识的人**。产品形态是匹配应用:OAuth 授权 → AI 离线理解生成人物画像 → 内容先行的推荐(先看到一篇好内容,再看作者)→ 双向意愿 → 连接。

当前阶段:OAuth 接口比赛方未开放,因此走**爬虫验证线**——用 MediaCrawler 抓知乎大V公开内容,驱动画像引擎,人工评析准确度,为正式接入做准备。

## 二、仓库地图

```
app/                    Next.js 15 页面 + API(演示闭环:landing/onboarding/encounter/connections/me)
lib/
  axes.ts               16 维概念轴(Mock 匹配用;与画像引擎无关,勿混淆)
  ai/profile.ts         旧版 Mock 画像(buildUnderstanding,模板拼装,演示用)
  ai/bridge.ts          Deep Match / Content Bridge / Conversation Bridge(LLM 可选)
  db/                   node:sqlite 存储层(users/contents/user_vectors/zhihu_identities 等表)
  providers/llm.ts      OpenAI 兼容 LLM 客户端(双 token 上限字段;LLM_CHEAP_BASE_URL 分层厂商)
  providers/zhihu.ts    知乎官方 OAuth(P2 代码完成,未实测)
  retrieval/matcher.ts  在线匹配管线(Hard Filter→召回→粗排→Rerank→DeepMatch→Bridge)
  profile/              ★ 人物画像分析引擎(本次验证线的核心,见四)
scripts/
  analyze-profile.ts    画像 CLI(--input/--name/--author/--peek/--max-items/--max-chars/--cache)
  convert-crawler.mjs   MediaCrawler jsonl → 画像输入(--crawl 一键抓取)
  fixtures/lin-yizhou.json  虚构人物测试样例(冒烟/回归用)
media-crawler/          MediaCrawler 副本(gitignore,非商业许可)
  config/zhihu_config.py  ★ ZHIHU_CREATOR_URL_LIST——大V主页网址粘贴处
  media_platform/zhihu/core.py  改过一处:文章抓取已解开(搜「遇见 适配」注释)
data/                   sqlite 库 + crawler 输入 JSON(gitignore)
profile-output/         画像产物 .profile.json/.report.md/.candidates.json(gitignore)
audit-output/           上次全项目审计报告+截图(gitignore,先读它)
docs/                   ARCHITECTURE / MATCHING / PRODUCT / PROFILE_ENGINE
用户画像.txt            画像引擎的规格来源(六维/压缩漏斗/证据规则/JSON Schema)
总体概览.txt            上游产品总说明(62 节)
```

## 三、两条数据管线现状

### 管线 A:爬虫验证线(已跑通,当前主线)

```
media-crawler(python,creator 模式,扫码登录一次后记住)
  → media-crawler/data/zhihu/contents_*.jsonl
  → scripts/convert-crawler.mjs(字段宽松映射/去重/epoch 时间)
  → data/crawler/<名>.json(归一化 RawContent[]:id/title/text/type/url/published_at/author)
  → scripts/analyze-profile.ts(lib/profile 引擎,LLM 两阶段)
  → profile-output/<名>.report.md(人工评析)+ .profile.json + .candidates.json
```

### 管线 B:OAuth 正式线(P2 代码完成,未实测)

```
授权(/api/auth/zhihu)→ 回调(/api/auth/callback):换 token → 拉资料 → 建真实用户 →
fetchZhihuContents 原样存档 zhihu_identities.raw_contents(500KB 上限)→【断点】
```

**断点**:raw_contents 从未解析成 `contents` 表记录 → 真实用户向量为空、画像回退模板。
阻塞项:4 个凭证(`ZHIHU_APP_ID/ZHIHU_OAUTH_APP_KEY/ZHIHU_ACCESS_SECRET/ZHIHU_REDIRECT_URI`)+ 公网 HTTPS 回调,等比赛方开放。

**两线汇合点**:画像引擎输入是归一化 `RawContent[]`,与来源解耦——OAuth 接通后只需写一个"官方 API Items → RawContent[]"适配函数,引擎零改动。

## 四、画像引擎(lib/profile)——最重要模块

两阶段 map-reduce,依据《用户画像.txt》:

1. **抽取层**(便宜模型,并发 3,失败重试 1,缓存):每 8 篇一批,每篇提 0~4 条候选线索(fact/opinion/behavior/event/value_tradeoff/style 六类,带 content_id);
2. **综合层**(主模型,单次大调用):执行压缩漏斗——删弱证据→合并同义→提炼上位模式→按六标准排序(证据强度25%/重复20%/区分度20%/行为解释力15%/稳定性10%/人际价值10%)→ 六维各留 3~5 条;
3. **证据消毒**:evidence_ids 引用不存在的内容 → 删该结论;无证据 → 删;unknown 结论 → 挪入 unknowns。**宁缺勿编**;
4. 产物:Level1 摘要+核心结论 / Level2 六维(轨迹/关切+驱动力/决策模式/价值取舍/对话风格/代表内容)/ Level3 证据索引;报告末尾自带人工评析表。

| 文件 | 内容 | 改动须知 |
| --- | --- | --- |
| `lib/profile/schema.ts` | zod Schema、LIMITS/MINS(每维条数)、产物类型 | — |
| `lib/profile/prompt.ts` | 两阶段系统提示词 | **改提示词必须同步改 `PROMPT_VERSION`**,否则缓存回旧结果 |
| `lib/profile/engine.ts` | 管线;`EXTRACT_CONCURRENCY=3`、`EXTRACT_RETRIES=1`(119-120 行);maxItems 默认 80(267 行,超出按时间均匀采样保跨年证据);maxTextChars 默认 3000 | — |
| `lib/profile/report.ts` | Markdown 渲染 + 评析表 + supports 索引解析 | — |
| `scripts/analyze-profile.ts` | CLI 入口与参数 | — |

**抽取缓存**:`data/crawler/.extract-cache.json`,键 = PROMPT_VERSION+模型+内容id+正文哈希。内容不变的重跑零抽取调用;换模型/改提示词自动全失效(故意的)。生产化时这套记账应长进数据库(`contents` 表加 extraction_model/prompt_version/candidates_json 列),引擎只需把 loadCache/saveCache 换成 SQL。

## 五、环境与凭证状态

- **Node 24.16**:CLI 直接跑 TS(type stripping),engine 等文件用**显式 `.ts` 后缀导入**;tsconfig 已加 `allowImportingTsExtensions`,`media-crawler` 已加入 exclude(它自带 webui 的 TS 会污染检查)。
- **Python**:系统 Anaconda 3.13.9,MediaCrawler 依赖与 playwright chromium 已装好,`python main.py --help` 可验证。**不要建 venv**,直接用系统 python。
- **LLM**:`.env.local` 已配 MiMo(`https://api.xiaomimimo.com/v1`),`LLM_MODEL=mimo-v2.5-pro`(综合)、`LLM_CHEAP_MODEL=mimo-v2.5`(抽取)。⚠️ MiMo 是**推理模型**:输出预算含隐藏思考 token(实测小任务思考 4k+),**便宜但慢**(单人 57 篇约 20-30 分钟)。计划换 DeepSeek/通义(key 由用户申请),`.env.example` 有三家配置示例;`LLM_CHEAP_BASE_URL` 支持分层混搭(抽取走快厂、综合留强厂)。
- **Git**:origin=github.com/Nobody-sink-it/Yujian;提交风格为中文 conventional commits(如 `feat(profile): ...`)。**绝不入库**:`.env.local`、`data/`、`media-crawler/`、`profile-output/`、`audit-output/`(均已 ignore)。GitHub 连接不稳定,克隆/推送失败先重试或确认代理。

## 六、验证实验进度(人工评析闭环)

| 步骤 | 状态 |
| --- | --- |
| 引擎冒烟(虚构人物林一舟,12 篇) | ✅ 信号全命中、证据全可溯 |
| MediaCrawler 实抓 an-ling-91 | ✅ 57 篇(回答17/文章40,2019-08~2026-08) |
| an-ling-91 画像 v1 | ✅ 生成,但丢了 2 批共 16 篇线索(MiMo 不稳定);画像基于 41 篇仍完整 |
| 人工评析 | ⏳ **等用户填** `profile-output/an-ling-91.report.md` 末尾的评析表 |
| 换厂商重跑对比 | ⏳ 等用户的新 API key(缓存/并发/重试已就位,预计 3-5 分钟) |
| 多大V(3-5 个,含 1 个轴外领域)评析 → 调 prompt | 未开始 |

## 七、已知坑(前人踩过的)

1. **MiMo 推理 token**:输出预算含思考,抽取 16k/综合 32k 已按此设置;换非推理模型可调低;
2. **token 上限字段不兼容**:请求同时发 `max_tokens` + `max_completion_tokens`(llm.ts),别删其一;
3. **知乎回答没有标题**:证据索引里 2019 年回答标题显示"—"是正常现象(标题属于问题),不是解析失败;摘要是展示用的前 160 字,模型实际读前 3000 字;
4. **MediaCrawler 的 `cache/` 是 Python 源码包**,不是运行缓存,复制时别排除;
5. **`/api/profile/analyze` 是同步路由**,跑一次几分钟,OAuth 用户不能用——需要后台任务+进度,这是待办;
6. **审计 P0 未修**(见 audit-output/PROJECT_AUDIT.md):demo 登录可冒充任意用户、access token 明文入库、连接无幂等、Next.js 版本有安全公告——**公网部署前必须处理**;
7. `scripts/fixtures/*.local.json` 已 ignore:放本地真实人物样例别进 git(合规)。

## 八、命令速查

```bash
# 画像:换新大V(网址先粘进 media-crawler/config/zhihu_config.py 的 ZHIHU_CREATOR_URL_LIST)
node scripts/convert-crawler.mjs --crawl --name "大V名"          # 抓取+转换
node --env-file=.env.local scripts/analyze-profile.ts \
  --input "data/crawler/大V名.json" --name "大V名"                # 生成画像+报告

# 预检(不花 LLM 调用)
node scripts/convert-crawler.mjs --name "X" --peek 的上游检查见 convert 输出
node --env-file=.env.local scripts/analyze-profile.ts --input <file> --peek

# 冒烟/回归(虚构人物)
node --env-file=.env.local scripts/analyze-profile.ts --fixture

# 质量门
npx tsc --noEmit && npm run build

# MediaCrawler 单独跑
cd media-crawler && python main.py --platform zhihu --type creator --lt qrcode
```

## 九、下一步(与用户对齐过的优先级)

1. **用户**:填 an-ling-91 评析表;新 API key 到位后重跑对比(稳定性测试);
2. **AI:预埋 OAuth 适配层**——`raw_contents → contents 表 → RawContent[]` 容错解析 + 画像后台生成任务骨架 + `docs/ZHIHU_API_FINDINGS.md` 占位;官方开放接口当天只需填 4 个凭证 + 部署;
3. **画像前端**(Level 1/2/3 页面,视觉参考用户提供的六维水墨图;数据源就是 .profile.json)——比赛演示核心;
4. **安全 P0 修复**(部署前);
5. 多大V评析 → 调 `prompt.ts`(记得 bump PROMPT_VERSION)。

## 十、给下一个 AI 的工作守则

- 动手前先读:`audit-output/PROJECT_AUDIT.md`(全局审计)、`docs/PROFILE_ENGINE.md`(引擎细节)、`git log --oneline`;
- 改引擎先跑 `--fixture` 冒烟,再 `npx tsc --noEmit && npm run build`;
- 涉及 LLM 长任务先确认 `.env.local` 配置与厂商健康度(MiMo 慢是常态,别误判为卡死;进程连着 111.13.x.x:443 就是在等模型);
- 不确定产品意图时读《总体概览.txt》对应章节,它的工程原则(离线理解/禁止 O(N²) LLM/描述不评价)是硬约束;
- 爬虫数据属研究用途:限频、不对外发布、不入 git。
