# 轮87：错题本/收藏笔记体验线（H5 全链路走查 + 三端 parity 清单）

分支：`devin/1786330334-r86`（PR#120）。本轮改动：`frontend-uni` 3 处小修（book.vue / favorites.vue / search.vue），已 deploy_h5.sh 部署上线并线上复验；零后端、零生产内容变更。

## 1. H5 错题本全链路走查（375px + 深色，生产环境 Playwright 实测）

测试方式：受控 QA uid（`qa_r87_book` / `qa_r87_curl`）种入 6 条错题（yanyu/panduan，含错因标注），逐链路真实点击走查，结束后 QA 数据全清（见 §4）。证据为线上截图+脚本输出（未按正式录屏流程制作录屏，照实说明）。

| 链路 | 结果 |
|---|---|
| 列表加载/计数（全部/待掌握/已掌握） | 通过，6/6/0 与库内一致 |
| 待掌握/已掌握/收藏三 tab 切换 | 通过 |
| 筛选面板（排序：最新/待复习优先/错次多/按题型/按错因；模块；题型） | 通过，chips 渲染与计数正确 |
| 错题详情展开（题干/选项/答案/解析/错因 chips） | 通过 |
| 题目纠错 sheet（7 类型+说明+提交） | **P1 修复后通过**（见 §2-①），提交 200、生产库落 `question_reports.reason` 正确 |
| 错题重练 | 通过：点「开始」直接进练习页，toast「错题重练开始」，6 题按模式加载（此前脚本判定 False 系脚本误判，实测正常） |
| 今日待复习入口/本月错题复盘卡 | 通过，复盘卡按模块/错因聚合正确 |
| PDF 导出（筛选面板内入口） | 通过，真实下载「错题重练卷 8月10日.pdf」 |
| 收藏 tab → 收藏夹与笔记页 | 通过 |
| 收藏夹 CRUD：新建（QA走查夹）/长按重命名/删除 | 通过（长按 action sheet 经真实 TouchEvent 验证） |
| 收藏题落夹/取消收藏/按夹「重练」 | **P1 修复后通过**（见 §2-②），重练跳转练习页并加载收藏题 |
| 笔记：写入/编辑（改）/删除（空内容即删） | 通过：q-social-bar 支持写/改/删（`saveIt('')` 删除），API 实测 create→update→delete 全链路正确 |
| 375px 布局/底部安全区 | 通过（纠错 sheet 遮挡已修，见 §2-①） |
| 深色模式（列表/筛选面板/收藏页/复盘卡） | 通过，对比度可读、无硬编码浅色残留 |
| JS 错误 | 修复后全链路 0 |

## 2. 本轮修复（P1 两处 + 顺手一处）

① **纠错 sheet 提交按钮 375px 被底部 tabbar 遮挡（P1）**：提交按钮不可点击（Playwright 点击超时复现）。修复：`book.vue` `.rp-submit { margin-bottom: 110rpx; }`。上线后真实提交成功。

② **收藏夹「重练」按钮点击无效（P1）**：`favorites.vue` `redoFolder()` 用 `uni.switchTab` 跳 `/pages/practice/practice`，但练习页不在 tabBar 列表（tabBar 为 home/book/ask/stats/profile），线上实测抛 `switchTab:fail can not switch to no-tabBar page`、按钮完全无响应。修复：改 `uni.navigateTo`（与 book.vue 重练同法）。上线复验：跳转成功、收藏题按乱序加载。

③ **顺手修**：`pkgA/search/search.vue` 同样两处 `switchTab` 到练习页必然失败——`goTopic` 改 `navigateTo`，`goBack` 的 fail 兜底改跳首页 tab。

## 3. 小程序 / Flutter 错题本 parity 清单

| 功能 | H5 | 原生小程序 | Flutter |
|---|---|---|---|
| 错题列表/待掌握/已掌握/收藏 tab | ✅ | ✅ | ✅ |
| 标记掌握/移回 | ✅ | ✅ | ✅ |
| 错题重练 | ✅ | ✅（抽10题） | ✅ |
| 月度错题复盘卡/错因 chips | ✅ | ✅（r75 复刻） | ✅（r75 复刻） |
| 筛选/排序面板（题型/错因/待复习优先等） | ✅ | ❌ 无 | ✅（sortBy time/times/type/reason/due + 题型/考点筛选） |
| 题目纠错 | ✅ | ❌ 无（全端无 question_report 调用） | ✅（practice + book_detail 两处入口） |
| 收藏夹多夹（新建/改名/删除/落夹） | ✅ | ❌ 仅单收藏列表（取消收藏） | ✅（favFolders CRUD 全套 API+页面） |
| 每题笔记（写/改/删） | ✅ | ❌ 无 | ✅（practice 写笔记 + favorites 笔记页） |
| PDF 导出错题卷 | ✅ | ❌ 无 | ✅（book 页导出入口 + export_sheet） |
| AI 错题分析 | ✅ | ❌ 无（该端无 AI 功能，r86 已确认） | ✅（book_detail mistakeAnalysis） |

结论：**Flutter 与 H5 错题本已基本 parity**（代码走查结论，本轮未真机实测/未跑 analyze，两端本轮零改动）。**原生小程序差距集中且为大项**，立项清单（按价值排序）：
1. 题目纠错入口（后端接口现成，P1 级立项，建议下轮）；
2. 筛选/排序面板；
3. 每题笔记；
4. 收藏夹多夹；
5. PDF 导出（小程序下载体验受限，可评估改为分享文件）。
本轮无可低成本当轮补的小项（小程序缺口均需 wxml+ts+wxss 三件套新增，非一两行）。

## 4. QA 数据注入与清理

- 注入：`qa_r87_book` 6 条错题（644-649）+ 1 条收藏 + 笔记若干；`qa_r87_curl` 纠错 1 条（id 8）；UI 走查产生纠错/收藏夹（QA走查夹→改名→已删）。
- 清理：备份 `/data/bak_r87_qaclean.db` → dry-run 计数 → 事务删除 `mistakes/question_reports/question_favs/question_notes/fav_folders/answer_log/review_log/growth_events/exam_attempts/shenlun_mat_favs` 中两 QA uid 记录 → 复查全表残留 **0**，`fav_folders` 无 QA 命名残留；历史真实用户纠错记录（id 1-5）未动。

## 5. 例行观测 + health_scan.py

生产快扫全绿：full 156,792 / active 113,304；质量分<50、非JSON options、(cid:)、U+FFFD、推广残留、hs 一致性、台账外空 hs、卷内重复全 0；低覆盖仅卷 112（65/112）。两条 intentional 空 hs 台账题（changshi:655861 / panduan:334296）未动。

数据：近7天 39 答/14 uid；growth 与基线持平（share_open 5 等，QA 事件零残留）。爬虫（当日 access log）：YandexBot 84、bingbot 1、Baiduspider 1；/tiku/y 57、/tiku/papers 10；/s/ 12 次仍全为自测/扫描器，无真实用户落地。r86 观测到的 bingbot 上量（22 次）与 Googlebot 现身本日未复现，属日间波动，继续观察。

## 6. 限制

- 小程序/Flutter parity 为代码走查结论，未真机实测；两端本轮零代码改动故未复跑 tsc/eslint/analyze。
- 走查证据为截图+脚本输出，无正式录屏。
- 笔记删除依赖「保存空内容即删」语义（后端 upsert/删除一体），无独立 DELETE 接口，照实记录。
