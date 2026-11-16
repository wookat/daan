# 轮53：例行发现线（轮52 回归 + 搜索访客转化路径走查 + 数据例行）

分支 `devin/1786305124-r48`（PR#113）。本轮零代码/零生产数据变更。

## 1. 轮52 QA 回归

### 聚合页三态走查（Playwright 生产实测）

| 状态 | 介绍卡 | 列表50条 | 分页 | CTA | 题目详情 | 详情→考点链 | CTA自动开练 | JS错误 |
|---|---|---|---|---|---|---|---|---|
| 桌面1280 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 10.5s（API冷启动首跑，已知） | 0 |
| 375浅色 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 1.4s | 0 |
| 375深色 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 2.0s | 0 |

- 分页/空态：`?page=2` 200、`?page=999` 404、未知 code 404、无斜杠 301 → 带斜杠。
- JSON-LD 抽查（YY-LJ-01）：`CollectionPage`、breadcrumb 3 级、url 与 canonical 一致，JSON 解析有效。
- CTA href 三态一致：`/#/pages/practice/practice?tag3=CS-LS-01&module=changshi&source=seo`。

### brotli 传输与缓存头复验

- `Accept-Encoding: br` → `content-encoding: br`、`content-length: 99911`、`cache-control: public, max-age=31536000, immutable`；
- 仅 gzip → `content-encoding: gzip` 回退正常，同样带 immutable 缓存头。

### SEO 直链回归

聚合页 CTA 点击后自动按 tag3 开练（三态全过，见上表），/tiku/q 详情页答案/讲解/考点链正常。

## 2. 「搜索访客」转化路径体验（375px）

路径：搜索落地 `/tiku/t/CS-LS-01/` → 读考点介绍 → 点题看解析 → 返回 → 点 CTA → H5 自动开练。

**评分 8.5/10**。首屏信息完整（面包屑/题数/介绍/方法要点/CTA 均在一屏内），列表清晰带真题年份标签，底部有页码与下一页，CTA 点击 6 秒内进入做题（暖态 1.4-2s）。

摩擦点：
- P0/P1：无。
- P2-1：API 冷启动时 CTA 点击后「正在准备练习…」可长达 10s+ 且无进度反馈（轮51已知现象，建议后端保活或加载文案加「首次较慢」提示）。
- P2-2：聚合页分页仅「上一页/下一页」，181 页大考点无跳页；对 SEO 爬虫无影响，人类用户少用，低优。
- P2-3：题目详情页读完解析后返回聚合页依赖浏览器返回键，页内无「返回考点列表」链接（有面包屑可用，低优）。

均为低优 P2，本轮不改代码（与「例行发现线零变更」一致），列入后续轮候选。

## 3. 数据例行（只读快照）

- 近7天作答 37 次/12 uid；近14天 752/17（8/1-8/2 重度用户波峰已出窗）。
- 归因：14天 source 仅 share 5 次，**source=seo 仍 0**；growth_events 同前（share/team 个位数、comeback_view 1、reminder 0）。
- access log（归档，近窗口）：总 534 请求，/tiku/ 48 次，**搜索引擎爬虫 0**，流量以本轮 QA 自测为主（headless/curl）。
- Bing `site:kaogong.zalize.com`：无本站结果（Bing 回退通用搜索结果），**收录仍 0**；轮52 IndexNow 202 已提交，收录尚未生效（提交距今 <1 天，属正常等待期）。

## 4. 健康快扫（active-only，最后匹配口径）

```text
active 112962
hs mismatch(last-match) 0
options non-JSON 0
(cid: garbling 0
empty: panduan:334296, changshi:655861   ← 既有存疑台账 2 条，不变
```

## 5. 下一批建议

1. **站长平台验证（P0，需老板资源）**：Bing Webmaster Tools / 百度站长验证后可主动提交 sitemap 并查看收录诊断——IndexNow 单通道 20+ 天未见收录，需要站长平台确认是否被拒/待审。
2. 练习 API 冷启动治理（P2-1 对应）：定时保活或惰性预热，消除 10s+ 首跑。
3. 聚合页收录观测：下轮复盘 /tiku/t/ 爬虫抓取与收录变化。
4. 小程序提审（需老板资源）。
