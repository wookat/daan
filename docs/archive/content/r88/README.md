# 轮88：小程序错题本 parity 补齐

## 范围与动机

r87 parity 走查结论：原生小程序错题本相对 H5/Flutter 缺五个大项（纠错、筛选/排序、笔记、多收藏夹、PDF 导出）。本轮按 r87 清单补齐其中四项（PDF 导出不在本轮范围）：

1. 题目纠错提交；
2. 错题筛选/排序；
3. 多收藏夹管理（新建/改名/删除、按夹查看、删除后移回默认夹）；
4. 题目笔记增删改。

**结论：四项一轮全收，无需拆两轮。** 全部在既有 `pages/book` 页面内实现，零后端改动、零新增页面。

## 实现明细

改动文件（miniapp-native）：

- `miniprogram/api/types.ts`：`FavItem` 补 `note/faved_at`；新增 `FavFolder`、`NoteItem`；`Mistake` 补 `times`（后端 `list_mistakes` 返回 `m.*` 已含）。
- `miniprogram/api/index.ts`：新增 `fetchFavFolders / createFavFolder / renameFavFolder / deleteFavFolder / fetchNote / fetchNotes / saveNote / postQuestionReport`；`fetchFavs` 支持 `folder_id`。请求形态与 H5/Flutter 及后端 `social.py` 逐一对齐（纠错 body 字段为 `type`，后端落库到 `question_reports.reason`）。
- `miniprogram/pages/book/book.ts / .wxml / .wxss`：

### 1. 纠错提交

错题详情操作行新增「纠错」（仅 `question_id` 非空时显示）→ 底部 sheet：7 类纠错类型 chips（与 H5/Flutter 同词表：答案错误/解析错误/题干或选项错字/图片缺失/分类错误/重复题/其他）+ 选填补充说明（≤500 字）→ `POST /api/question_report`，成功 toast「感谢反馈，我们会尽快核查」。未选类型/提交中按钮置灰防重复提交（后端本身按 uid+qid upsert 幂等，`updated:false/true`）。

### 2. 筛选/排序

tabs 行右侧新增「筛选」按钮（激活态高亮）→ sheet 内：

- 排序：最新（默认，接口按 created_at DESC）/ 错次多（times DESC）/ 按题型 / 按错因（未标注归为一档）；
- 模块筛选：从当前错题聚合的模块 chips，点选/再点取消；
- 题型筛选：同上按 `question_type` 聚合；
- 重置 + 完成（实时显示筛选后题数）。

列表卡头部顺带补「错因」「错 N 次」标签，便于筛选结果可读。筛选/排序均纯前端，对待掌握/已掌握两个 tab 生效。

### 3. 多收藏夹

收藏 tab 顶部新增收藏夹 chips 行：「全部」+ 各夹（icon+名+题数，来自 `GET /api/favs/folders`，含默认夹 id=0）+「＋新建收藏夹」。

- 新建：`wx.showModal` editable 输入夹名 → `POST /api/favs/folders`（后端限 20 字/20 个/同名 409，错误 toast 透传）；
- 长按自建夹 → actionSheet 重命名（PATCH）/ 删除（DELETE，确认弹窗注明「夹内收藏会移回默认夹」，与后端语义一致）；默认夹（id=0）不在 fav_folders 表内，天然不可改删；
- 点选夹 chips 按 `folder_id` 过滤收藏列表（`GET /api/favs?folder_id=`）。

### 4. 笔记增删改

错题详情操作行与收藏卡均有笔记入口（收藏卡按有无笔记显示「写笔记/改笔记」，已有笔记直接在卡内预览）。笔记 sheet：打开时 `GET /api/notes?question_id=` 回填 → textarea（≤1000 字，后端 NOTE_MAX_LEN 截断）→ 保存 `POST /api/notes`；已有笔记时显示「删除笔记」按钮（提交空内容即删，与 H5 语义一致但小程序侧给了显式删除按钮）。

## 验证

- **tsc `npm run typecheck`：0 错误；eslint `npm run lint`：0 错误。**
- 生产 API 合约 QA（受控 uid `qa_r88_mp`，与小程序封装完全相同的请求形态逐一实测）：建夹→改名→收藏落夹→按夹查询→笔记写/读/改/删→纠错提交（id=10）→删夹（收藏移回默认夹复查通过）→取消收藏，全链路 200 且响应结构与 types.ts 一致。
- QA 数据清理：`question_reports/question_favs/question_notes/fav_folders/mistakes/answer_log/review_log/growth_events` 按 uid 删除，复查残留全 0。
- **限制**：小程序 UI 为代码实现+API 合约实测，未微信开发者工具/真机实测（本环境无法运行微信客户端）；建议下轮真机回归四项交互（尤其长按 actionSheet 与深色态 sheet 样式）。

## 与 H5/Flutter parity 差异（余留）

- PDF 导出：小程序仍缺（本轮范围外，需 wx.downloadFile+openDocument 方案，另立项）；
- AI 错题分析：小程序无任何 AI 功能（r86 已确认现状，不在错题本范围内展开）；
- H5 收藏夹改名/删除为长按触发，小程序同样用 longpress+actionSheet，交互对齐。

## 例行观测（生产）

health_scan.py 全绿：full 156,792 / active 113,304，<50、非JSON、(cid:)、U+FFFD、推广残留、hs 一致性、台账外空 hs、卷内重复全 0；低覆盖率仅卷 112（65/112）。近7天 39 答题 / 14 uid，growth 与基线持平。当日爬虫：YandexBot 25 + Baiduspider 1，/tiku/papers 24 次（爬虫已开始扫试卷页），/s/ 11 次均为自测 IP，仍无真实用户落地。两条 intentional 空 hs 台账题（changshi:655861、panduan:334296）未动。
