# R291 设计：成绩报告解析浮层「收藏本题」

## 取证（一手证据）

- `frontend-uni/src/pkgA/exam/report.vue` 解析浮层（R290 后已支持逐题连看/只看错题）只有题干、选项、答案、解析与导航，无任何收藏出口；复盘时遇到好题/易错题无法留存，必须离开报告去搜索页找同题收藏。
- `frontend-uni/src/pages/practice/practice.vue` 刷题页已有成熟收藏实现：`favQuestions` 本地列表（去重键 `question`、上限 200、`unshift` 新条目）+ 服务端 `setFav/removeFav(question_id)` 双写，收藏后可在收藏与笔记页（`pkgA/social/favorites.vue`）管理。
- 后端 `/api/exam/report` items 已含 `question_id/question/options/answer/explanation/hs_explanation/module/submodule/image/image_credit`，缺 `is_real/exam_year/exam_region`（收藏卡来源标签所需）。
- 竞品：粉笔模考报告逐题解析页有「收藏」操作，是复盘链路标配。

## 方案（最小收口）

1. 后端 `api_exam_report` items 增补 `is_real/exam_year/exam_region` 三字段（向后兼容，纯增量）。
2. 新增纯函数 `src/exam-fav.js`：
   - `isFaved(favs, question)`：按题干去重键判断；
   - `toggleFav(favs, item)`：返回 `{ list, added }`——已存在则移除，否则头插收藏条目（字段对齐 practice.vue 收藏 schema，上限 200），不可变操作。
3. `report.vue` 浮层标题行补 star 图标按钮（对齐 practice.vue `l-icon name="star"` 语义），点按走纯函数更新 `favQuestions` storage + `setFav/removeFav(question_id)` 服务端双写 + toast。
4. 不改收藏页/错题本/URL 协议/其余 API；`wrongOnly`、导航行为不变。

## 验证

- 单测：isFaved/toggleFav 去重、头插、上限、移除、不可变。
- 本地 lint/vitest/build + 后端 ruff/pytest/pyright 全绿。
- 生产双视口：报告浮层收藏→toast→favorites 页可见→再点取消→列表移除；服务端 fav 表双写与清理。
