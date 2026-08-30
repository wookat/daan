# R37 设计方案：/tiku/discuss/ 热议题目 SSR 聚合页（讨论广场 SEO 化）

## 现状取证（2026-08-29）
- R33 讨论广场（App 内 pkgA/social/plaza）已聚合全站热议，但对搜索引擎和 /tiku SSR 访客不可见：/tiku 页族无任何讨论聚合入口，R35 的题目页讨论区块只能逐题被发现。
- /tiku/ 首页（seo.py tiku_index）只有模块/考点/年份三类入口，无 UGC 聚合入口。
- 竞品题库站（粉笔网页版）在题库侧提供讨论/解析社区聚合入口，UGC 聚合页是长尾 SEO 常规打法。

## 差距定级
P2（落地页/SEO）：UGC 聚合曝光面缺 SSR 入口，讨论内容只能逐题收录。

## 方案
仅改 `backend/app/seo.py`：
- 新增 `GET /tiku/discuss/`（+ 无斜杠 301）：不缓存（UGC 实时），复用 R33 聚合 SQL（按 question_id 聚合 status='ok' 评论，讨论数 + MAX(created_at) 倒序 LIMIT 30），每题渲染一张卡：题干链接（跳 /tiku/q/{qid}，SSR 内闭环）+ 模块名 + n 条讨论 + 最新评论（昵称：内容，_e() 转义）；底部 CTA 跳 App 讨论广场；
- 空态（无讨论）输出引导文案；
- /tiku/ 首页 h1 下方增「考友热议」入口链接；
- CollectionPage JSON-LD + 面包屑；
- sitemap 增 /tiku/discuss/。

## 不做
- SSR 页内互动；分页（v1 LIMIT 30 足够，数据增长后加）。

## 验收
- py_compile/ruff 无新增错误；
- 生产：/tiku/discuss/ 渲染 3 张现有讨论卡、题干链接跳 /tiku/q/、CTA 跳 App 广场；/tiku/ 首页入口可见；sitemap 含该 URL；1440/375 无溢出；R35 题目页区块回归。
