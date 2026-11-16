# 轮75：三端 parity——r74 三项复习流增强复刻到原生小程序与 Flutter

分支 `devin/1786319548-r73`（PR#117），H5 版已在 r74 上线（4f91285）。本轮为纯客户端改动，零后端/零生产数据变更，不依赖 AppID/订阅模板。

## 1. 原生小程序（miniapp-native，pages/book 三件套）

### 1.1 错因自评 chips
- 复习揭晓面板答错时显示「粗心大意/概念不清/方法不会/纯蒙的」四枚 chips（与 H5/练习页同词表）。
- 点击 `onReviewReason` → `patchMistake(id, {error_reason})` 写回 + `review_reason_tag` 埋点，选中态同步 `rCur`/`rItems`。
- 加练同类题（extra）不落错题本，不显示 chips。

### 1.2 答错自动加推同类题
- `recordReview` 答错时调 `appendSimilar`：按 module+submodule（从 question_type 拆二级）经既有 `fetchQuestions` 取最多 2 道，排除当前题，追加到本轮队列末尾并标记 `extra`。
- 防死循环：每题只触发一次（`simFetched`）、纠错副本（`requeued`）不触发、extra 题本身不触发。
- extra 题不调 `postReviewRecord`，不写 SRS/review_log，不影响到期口径；揭晓面板显示「已为你在本轮末尾加练 N 道同类题」，头部 tag 显示「加练同类」。

### 1.3 本月错题复盘卡
- 错题本页 tabs 上方新增可折叠「本月错题复盘 · 新增 N 道」卡：按模块/按错因 Top6 横条图（含「未标注」桶），纯前端聚合 `monthRecap(all)`，本月无新增不渲染。
- 样式沿用设计 tokens（--brand-500/--fill/--t1/--t2/--r-full），深色模式自适应。

验证：`npx tsc --noEmit` ✅ 0 错误；`npx eslint miniprogram --ext .ts` ✅ 0 错误。

## 2. Flutter（app-flutter）

### 2.1 错因自评 chips
- 揭晓面板错因 chips 此前已存在（practice/redo 模式），且复习模式条目带 `mistakeId`，`_setReason` PATCH 写回天然生效——本轮仅补 extra 题隐藏逻辑（`!q.extra` 才显示 chips），达成 parity。

### 2.2 答错自动加推同类题
- `Question` 模型加 `extra/appended/simFetched` 字段；`_commitPick` 复习模式答错后 `_appendSimilar`：`Api.questions(module, submodule, limit:2, adaptive:false)` 取同类、排除当前题、`extra=true` 追加到本组末尾，`review_similar_auto` 埋点。
- extra 题在 `_commitPick` 提前 return：不 `recordReview`（不写 SRS）也不 `saveMistake`；判定行显示「加练同类 · 答对了/还没稳」，原题面板显示已加练提示条。
- 复习清零庆祝（reviewCleared）走服务端 `reviewDue` 复查，不受 extra 影响。

### 2.3 本月错题复盘卡
- book_page 在错题列表上方新增可折叠复盘卡：`monthRecap` getter 按 `createdAt>=本月1日` 聚合模块/错因 Top6（含未标注），LinearProgressIndicator 横条（模块蓝/错因橙），本月无新增不渲染。

验证：`flutter analyze` ✅ No issues found；`flutter build apk --debug` ✅ Built app-debug.apk。

## 3. parity 备注
- 三端行为一致：每原题最多加推 2 道、只触发一次、extra 不写 SRS 不落错题本、复盘含「未标注」桶。
- 差异（既有架构差异，非本轮引入）：小程序/H5 复习答错有本轮末尾纠错副本重现，Flutter 复习流无 requeue 机制（沿用现状未改）；月界均取客户端本地月初（与 H5 口径一致）。
- 单选即判 / 多选确认判分、SRS 完整梯子等既有行为均未改动。

## 4. 健康快扫（生产只读）
- active 112,962 / 全表 156,792；active quality_score<50 = 0；options 非 JSON 0；(cid: 乱码 0；hs 一致性 mismatch 0。
- 空缺 hs 仅台账 2 条：panduan:334296、changshi:655861（有意留空，不动）。
- 近7天作答 39 次 / 14 uid；近14天 source=seo 0。
- growth 事件基线：share_open 5、team_join_open 5、heatmap_view 4、share_answer 3、task_card_click 1、comeback_view 1 等（与 r74 持平）。
- 爬虫：8/9 归档 2,297 行中爬虫 60 次（YandexBot 59 + bingbot 1），/tiku/y 76 次（爬虫 57 次）——Yandex 年份页持续到访；8/10（当日进行中）暂 129 行 0 爬虫。Bing 收录仍未确认破零。

## 5. 变更清单
- miniapp-native/miniprogram/pages/book/book.ts / .wxml / .wxss
- app-flutter/lib/core/models.dart、lib/pages/practice_page.dart、lib/pages/book_page.dart
- docs/content/r75/README.md（本文）
