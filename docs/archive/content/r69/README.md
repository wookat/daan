# 轮69：消化 r68 小程序三项 P2 + H5/Flutter 同类问题排查修复 + 健康快扫

日期：2026-08-09 ｜ 分支：devin/1786315936-r67（PR#116）

## 1. 小程序原生三项 P2 修复

### 1.1 redo 模式重试切回普通题源（P2-1）
`pages/practice/practice.ts`：onLoad 持久化 `_mode`（原来只在 start() 一次性消费），`onRetry()` 由 `start('')` 改为 `start(this._mode)`——错题重练完成后点「再来一组」继续走 `/api/mistakes/redo` 题源，不再切回普通抽题。

### 1.2 复习作答支持多选字母（P2-2）
`pages/book/book.ts/.wxml/.wxss`：
- `extractLetter()` 由取首个单字母 `[A-D]` 改为取连续字母段 `[A-D]+` 并去重排序归一（如「ABD」）；
- 新增 `rMulti` 状态：多选题改为点选切换（选中态 `rsel` 样式），选完后点「确认答案（已选 XX）」统一判分；单选题维持点击即判不变；
- 判分/揭晓高亮改为按字母包含判断（`rLetter.indexOf(item.k)`），多选正确项全部标绿。

### 1.3 真题卷入口二期预告（P2-3）
`pages/exam/exam.ts`：`onPaperTap` 由一次性 toast 改为 `wx.showModal` 预告弹窗——标题「全真模考 · 二期上线预告」，正文说明整卷计时作答在准备中、现在可先体验迷你模考，confirm 直接进迷你模考（30 题）。保留真题卷列表展示（预告优于隐藏：保留内容预期与曝光；如需彻底隐藏可后续加远端开关，本轮按低风险方案处理）。

校验：`miniapp-native` `npm run typecheck` + `npm run lint` 全过（0 错误）。

## 2. H5 同类问题排查与修复（同类均存在，已修）

### 2.1 错题本复习多选字母（同 P2-2）
`frontend-uni/src/pages/book/book.vue`：`extractLetter`/`ansLetter` 同步改为 `[A-D]+` 归一；新增 `curMulti` 状态与「确认答案（已选 XX）」按钮，多选点选切换（`.opt.sel` 选中态），判分/揭晓按字母包含高亮。

### 2.2 错题重练「再来一组」切回普通题源（同 P2-1）
`frontend-uni/src/pages/practice/practice.vue`：redoSet 场次记录 `_redoItems`，完成页「再来一组」改走 `retryGroup()`——错题重练场次重用同一组错题重开一轮，普通场次照旧按原模块重新抽题（`start()` 时清空 `_redoItems` 防串场）。

### 2.3 真题卷入口
H5 无对应「二期 toast」入口（真题模式为年份/地区筛选直练），无同类问题。

部署：`deploy/deploy_h5.sh` 构建+brotli+rsync+重建容器，线上 bundle hash 一致（index-D3rIhr9R.js），接口回归 7 项全 200。

## 3. Flutter 同类问题排查与修复

### 3.1 redo 重试（同 P2-1）：本就无此问题
`practice_page.dart` 完成页「再来一组」调 `_load()`，其按不可变的 `widget.mode` 分支取题，redo 场次天然保持 redo 题源——确认无同类缺陷，未改动。

### 3.2 复习/作答多选字母（同 P2-2）：存在，已修
- `core/models.dart`：新增 `Question.normLetters()`（`[A-D]+` 去重排序归一）与 `isMulti`；`correct` 改为归一后比较；
- `practice_page.dart`：多选题点选切换（品牌色选中态）+「确认答案（已选 XX）」按钮统一判分（`_pick` 拆出 `_commitPick`）；揭晓高亮按字母包含（多选正确项全部标绿）；切题/重载清空多选状态。复习模式（错题多选题此前单选永远判错）与普通练习一并受益。

### 3.3 真题卷入口：Flutter 无真题卷列表入口，无同类问题。

校验：`flutter analyze` 0 issue；`flutter build apk --debug` 构建成功。

## 4. 例行数据与健康快扫（全绿）

- 爬虫观测（access-20260809.jsonl，1,537 行）：爬虫 59 次（YandexBot 58 + bingbot 1），57 次命中 /tiku/y 年份页——Yandex 对年份页持续到访。
- 近7天作答 39 次 / 14 uid；近14天 source=seo 归因 0。
- growth 埋点累计：share_open 5、share_answer 3、heatmap_view 4、comeback_view 1、task_card_click 1、team_join_open 5 等。
- 内容健康（官方口径 r66_health）：active 112,962；options 非 JSON 0；`(cid:` 乱码 0；hs 一致性 0；active `<50` = 0；空 hs 仅 2 条台账题（panduan:334296、changshi:655861，维持不动）。

## 5. P0/P1/P2 状态

- P0/P1：无。
- r68 三项 P2：全部消化完毕（小程序修复 + H5 两项同类修复 + Flutter 一项同类修复）。
- 新增 P2 建议（未做）：真题卷入口如需彻底隐藏可加远端配置开关（本轮按预告弹窗低风险方案处理）。

## 6. 本轮变更清单

- miniapp-native：practice.ts（redo 重试保持模式）、book.ts/.wxml/.wxss（复习多选）、exam.ts（真题卷预告弹窗）。
- frontend-uni：book.vue（复习多选）、practice.vue（错题重练再来一组）。
- app-flutter：models.dart（多选归一判分）、practice_page.dart（多选交互）。
- 零生产数据变更；H5 已部署上线并回归通过。
