# 轮77 报告：增长/SEO 线 —— 真题卷详情页增强 + 分享落地页动态 OG

分支：devin/1786319548-r73（PR#117）。本轮改动：`backend/app/seo.py`（SEO 增强 + `/s/{sid}` 分享 SSR 落地页）+ 六处三端分享链接切换。零生产题目内容变更。

## 1. SEO 内容面：选项评估与落地

### 1.1 评估：「模块×考点」聚合 vs 「真题卷详情页增强」

| 维度 | 模块×考点聚合 | 真题卷详情页增强（✅ 选定） |
|---|---|---|
| 现有基础 | 已有 `/tiku/{module}/{submodule}/` 与 `/tiku/t/{code}/` 考点页，新层级为 模块×tag3 交叉 | `/tiku/papers/{pid}` 路由与试卷数据已在线（121 张真题卷已入 sitemap） |
| 新增 URL 量 | 数百~上千个新 canonical，需全套分页/404/sitemap 分片 | 0 个新 URL，纯增强现有页面 |
| 薄内容风险 | 高（大量长尾交叉页题量稀少，易被判薄内容） | 低（真题卷天然 90-135 题/页，内容厚实） |
| 实现面 | 新路由族+分页+sitemap 分片+回归 | 单函数增强+sitemap lastmod 一行 |
| 抓取价值 | 分散抓取预算 | 真题卷是公考搜索高意图词（「2025 XX省考行测真题」），互链强化年份页（Yandex 主要抓取面） |

结论：本轮落地**真题卷详情页增强**，模块×考点聚合缓（若后续需要，建议只做题量≥50 的交叉组合）。

### 1.2 实施内容（`tiku_paper_detail`）

- **模块分布卡**：按题量降序展示「言语理解34题 / 常识判断26题 / …」，各链到模块列表页；
- **按模块刷{年份}真题卡**：链到对应 `/tiku/y/{year}/{module}/` 年份页（仅当该年份×模块页有题时输出，避免死链）；
- **同年其他真题卷卡**：同年 zhenti 卷互链（≤10 张）；
- **title/description 增强**：description 注入模块分布文案（如上 1.1 示例），title 改「{卷名}_真题卷在线模考_考公错题助手」；
- **JSON-LD**：新增 CollectionPage + BreadcrumbList 结构化数据；
- **sitemap**：`sitemap-pages.xml` 中试卷 URL 补 `<lastmod>`（取 `created_at`），页面数 194 条不变。

线上验证（部署后实测）：`/tiku/papers/1` 渲染模块分布/年份互链/同年卷/CollectionPage 全部在位；无效 pid 仍 404；sitemap-pages 121 条试卷 URL 带 lastmod。

### 1.3 IndexNow

`scripts/indexnow_submit.py --pages-only`（key 走生产 .env，不落仓库）：

```
total urls: 452
batch 1: 452 urls -> HTTP 200
done: {200: 452}
```

## 2. 分享链路：/share SSR/OG 现状与动态 OG 落地

### 2.1 现状检查

- 题目分享落地页实际是 **SPA hash 路由** `/#/pkgA/share/share-q?sid=...`（后端无独立 `/share` SSR 路由，数据走 `/api/share/{sid}`）；
- hash 路由对社交爬虫只暴露 SPA 壳的静态 meta（站点级 title/description），**无题目级动态 OG**——微信/QQ/微博/Telegram 抓卡片全是同一套文案。

### 2.2 低成本方案：新增服务端分享落地页 `/s/{sid}`（已实施）

- 后端 SSR 输出动态 OG：`og:title`=「{昵称}分享了一道{模块}题，敢来挑战吗？」，`og:description`=题干摘要（空白归一+90 字截断+HTML 转义），**不含答案/解析**；
- `noindex`（分享中间页不进搜索索引，避免薄内容）；
- 真实用户 meta refresh + JS `location.replace` 立即进入原 SPA 分享页，query（如 A/B 的 `v=`）透传；
- 无效/过期 sid → 302 回首页；
- 三端分享链接全部切到 `/s/{sid}`：H5 `api.js qShareText`、原生小程序 practice/share/book 三处复制文案、Flutter `api.dart qShareText` + `book_detail_page.dart`。

线上验证（生产实测后测试分享行已清理，growth 无残留、share_open 回基线 5）：

- `/s/{sid}` 200，title/og:title/og:description/og:url 动态输出正确，题干摘要转义正常，无答案泄露；
- Playwright 真浏览器打开 → 正确落到 `/#/pkgA/share/share-q?sid=...&v=a`，JS 错误 0；
- `/s/zzzznotexist` → 302 首页。

## 3. 部署+回归

`./deploy/deploy_h5.sh` 全流程：H5 构建 DONE（77 个 .br）、bundle hash 线上一致（index-BN4yj_d_.js）、容器重建、回归 7 项全 200（/api/stats、questions×2、/tiku/、robots、indexnow-key、/admin）。

构建/静态检查：H5 build 过、小程序 tsc+eslint 0 错误、flutter analyze 0 issue。

## 4. 健康快扫（官方口径，全绿）

```
active 112962 / full 156792
lt50 0  badjson 0  cid 0  hs_mismatch 0
empty_hs 2 ['panduan:334296', 'changshi:655861']（台账题，不动）
last7d 39 次 / 14 uid   seo14d 0
growth: share_open 5, team_join_open 5, heatmap_view 4, share_answer 3, comeback_view 1, …（与基线持平）
```

爬虫观测：8/10 归档 129 行、爬虫 0；live log（跨 8/9-8/10 未轮转段）2,654 行，YandexBot 82 + bingbot 1，/tiku/y 76 次、/tiku/papers 16 次——Yandex 持续到访年份页，真题卷页已开始被访问。Bing site: 收录仍未破零（站长平台验证仍是 P0 外部依赖）。

## 5. 遗留与备注

- 微信/QQ 卡片实际抓取效果需真机/真实分享场景验证（Linux 环境只能验 SSR 输出与跳转）；
- 小程序内 `onShareAppMessage` 卡片走小程序原生路径不受影响，本轮改的是「复制链接」类分享文案；
- 模块×考点聚合暂缓（评估结论见 §1.1）；
- 未提交任何密钥/生产 .env/数据库文件。
