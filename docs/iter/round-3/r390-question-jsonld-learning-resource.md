# R390：题目页 JSON-LD 从 QAPage 改为 LearningResource ⊃ Question（Google 内容准则合规）

## 取证（一手）

### 收录/抓取实况（承 R389）
- GSC 域名资源：sitemap `https://kaogong.zalize.com/sitemap.xml` 状态成功、已发现 109,903 页（09-04 读取）；网页索引报告仍「正在处理数据，请过 1 天左右再来查看」。
- 源站 crawler 报告 09-04：Google 21 次（sitemap 18 / `/tiku/` 3），题目页 `GET /tiku/q/404717 200` 1 次；Bing/Yandex 持续大量抓 `/tiku/*`。
- 内链结构核对（curl 生产）：`/tiku/` 无直接 `/tiku/q/*` 链，但有专题/分类/年份入口；专题页 `/tiku/t/ZL-JQ-01/` 50 条题链 + `?page=2…19` + `rel="next"`；`/tiku/daily/` 10 条题链。→ 抓取路径 `/tiku/`→专题→题目 深度 3，**不是内链缺失**，题目页抓取少是引擎预算/时间问题，代码侧无可改项。
- 部署窗口 5xx 核对（09-03/04 全量访问日志 × deploy-history 29 次部署，±4 min 窗口）：窗口内 5xx 195 条全为探针网段（R372 前的换出期），**非探针 5xx 0**；窗口外非探针 5xx 56 条全在 R372（06:53Z）之前。→ 部署切换不给爬虫 5xx，不做零停机改造。

### 结构化数据合规（本轮命中）
- 生产 `/tiku/q/234080` JSON-LD：`QAPage{mainEntity: Question{answerCount:1, acceptedAnswer: 站方解析}}` + `BreadcrumbList`，10.9 万题目页同构（`seo/pages.py::_render_question`）。
- Google 官方 QAPage 内容准则（developers.google.com/search/docs/appearance/structured-data/qapage，2026-09 实读）：
  > Users must be able to submit answers to the question. **Don't use QAPage markup for content that has only one answer for a given question with no way for users to add alternative answers.** Invalid: An FAQ page written by the site itself with no way for users to submit alternative answers.
  本站题目页 = 站方单一答案 + 用户不能补答 → **官方明列的无效用例**；评论区（`<!--QCOMMENTS-->`）是讨论不是「补答案」，且不在 markup 内。
- Google 通用结构化数据准则（sd-policies）：违反质量准则「可能被标为 spam」，结构化数据 manual action 使页面**失去富结果资格、不影响排名**。→ 下行风险有界但覆盖全站 10.9 万页；当前正处 Google 首次索引窗口，先合规再被大规模评估。
- 曾经的教育富结果 Practice problems（`Quiz`+`Question`）Google 已于 2026-01 弃用（官方 changelog + SEJ 2025-11-05 报道）→ 不存在可换取的富结果，本轮**不承诺任何 SERP 收益**，只做「语义准确 + 不违规」。

## 方案
- `@type` 改 `LearningResource`（schema.org 教育资源），字段：`name/url/inLanguage/learningResourceType(真题|练习题)/educationalLevel/about(考点名或模块名)/isPartOf(WebSite)`。
- `hasPart: Question{eduQuestionType:"Multiple choice", text, suggestedAnswer:[选项 A–D（position 顺序，与页面 `.opt` 可见内容一致）], acceptedAnswer{正确答案+解析≤500字}}`——沿用 Google 原 Practice problems 的 Quiz⊃Question 建模方式，去掉 `QAPage/mainEntity/answerCount`。
- `BreadcrumbList` 不动；列表页 `CollectionPage`、首页 `WebSite` 不动；HTML 正文零改动（只改 `<script type=ld+json>` 内容）。
- 测试：`test_seo_landing.py` 断言页面无 `QAPage`、类型集合 `{LearningResource, BreadcrumbList}`、`suggestedAnswer` 首字母序列 == 页面选项字母序列、`acceptedAnswer` 以「正确答案：」开头。

## 非目标
- 不动 `/tiku/*` 标题/正文/CTA；不做零停机部署；不加内链（已核实深度 3 足够）；不动 `WebSite.SearchAction`（Sitelinks searchbox 已弃用但无害）。

## 验证
- 本地：ruff / pyright 0 / pytest 374 全绿。
- 生产：curl `/tiku/q/234080` JSON-LD 类型 == `[LearningResource, BreadcrumbList]`、全站 `QAPage` 0；validator.schema.org 对生产页 0 error；1440/375 SEO 题目页 → CTA/选项 pick → 练习 → 退出保留 → 续练 回归。
- 未验证/不可验证：Google 是否因此改变对 10.9 万页的评估（需数周 GSC 数据）；Bing/Yandex 对 LearningResource 的处理。
