# R8 设计方案：/tiku 列表页 JSON-LD 补全 + 错题 sheet「恢复复习」入口 + 掌握切换即时反馈

日期：2026-08-30 ｜ 轮次：round-3 R8 ｜ 前置：R7 独立走查观察项（PR #180 评论）

## 1. 取证（R7 生产走查一手证据）

- JSON-LD 现状（运行时 + 源码核对）：题目页（QAPage）、真题卷详情/年份/考点页（CollectionPage）已有；**/tiku/ 首页、/tiku/papers/、模块页、题型页四类无 JSON-LD**（`_page(jsonld=None)`）。
- 交互：已掌握错题的 ··· action sheet 无「恢复复习」（仅强化/纠错/分享/删除），需展开卡片才能操作；粉笔错题本对已掌握项在列表操作层即可撤销。
- 掌握切换后趋势卡出现旧帧：`master()` PATCH 成功后仅 `this.load()` 异步刷新，网络慢时本地 `m.mastered/mastered_at` 仍是旧值，趋势卡/摘要短暂显示旧数据（R7 走查实测，F5 后正确）。

## 2. 架构决策

- seo.py：新增 `_collection_ld(name, description, path, crumbs)` 帮助函数，与既有年份/考点页 JSON-LD 结构（CollectionPage + BreadcrumbList + isPartOf WebSite）完全同构，四类页面复用；不改 DOM/标题/描述。
- book.vue：`itemSheet` 对 `m.mastered` 增补「恢复复习」项（复用既有 `master(m, false)`，无新接口）；`master()` PATCH 成功后先本地同步 `m.mastered / m.mastered_at` 再 `load()`，消除旧帧（服务端时间为准，本地仅乐观占位）。

## 3. 验收标准

- 本地：backend import + 四类页面 `_page` 输出含 `application/ld+json`；H5 build 通过。
- 生产 1440/375：四类 /tiku 页 JSON-LD script 存在且 BreadcrumbList 与面包屑一致；已掌握错题 ··· sheet 出现「恢复复习」且生效（API mastered=0、mastered_at 清空）；标掌握/恢复复习后趋势卡与摘要即时更新（无需 F5）；无横向溢出、console 0 error。
- 不改其他用户数据；测试沿用新自建游客 uid。
