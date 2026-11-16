# R145：资料分析同材料题组「材料折叠」——组内第 2+ 题不再整段重复材料

## 取证（一手证据）

- 生产库实查（docker sqlite）：ziliao 题的 `question` 字段为「材料全文 + 问题：小题干」拼接（如 id=38 全文 150 字、材料约 120 字）。
- App 端已有同材料连做：`db.grouped_ziliao_questions()`（qbank_api 专注模式）连续下发同组题并带 `group_seq`（如 2/5），practice 页仅展示「同材料题组 2/5」徽标（practice.vue L98）。
- verified 缺陷：组内第 2、3…题的题面把与上一题完全相同的整段材料再次全文渲染，用户每题都要重读/滚过 100–400 字材料才能看到「问题：」；375 视口下尤甚。粉笔资料分析连做的行为是材料区独立、切小题时材料不重复重排。
- 后端拆分逻辑既有：`db._material_key()` 以「【资料】」前缀 +「问题：/问题:」分隔符切材料与小题干，去空白后 <120 字不算材料。

## 方案（先方案后实现）

前端纯展示层折叠，零后端改动：

1. 新增纯函数模块 `frontend-uni/src/material.js`（可测，镜像 `_material_key` 切分语义）：
   - `splitMaterial(text)`：按「问题：/问题:」首次出现切为 `{ material, stem, key }`；`key` = 去空白材料前 400 字；材料去空白 <120 字返回 null。
   - `sameMaterial(a, b)`：两题均可切分且 key 相等。
2. practice.vue：
   - computed `matInfo`：当前题为 ziliao、非首题、与上一题 `sameMaterial` 时返回切分结果，否则 null。
   - 折叠态（默认，逐题记忆 `matOpen[idx]`）：题面只渲染 `matInfo.stem`，材料位置显示可点击折叠条「同上材料（与上一题相同）· 展开」；展开后完整题面（含既有 qSegs 判后高亮）+「收起材料」。
   - 折叠条补 role=button + aria-label（R123 运行时会给 tabindex/键盘激活）。
3. 不改 examMode 之外的判分/收藏/纠错逻辑（均以 `cur.question` 全文为键，不受影响）；导出 PDF、SSR 不动。

## 边界

- 仅相邻题比对（grouped 下发即连续），乱序/跨组不误折叠。
- 切分失败（无「问题：」或材料过短）不折叠，行为同现状。
- qSegs 高亮基于全文，折叠态显示纯 stem；判后想核对材料高亮可一键展开。

## 验证

- vitest：material.js 切分/短材料/同异材料判定。
- lint + vitest 全量 + build:h5。
- 生产：专注模式资料分析进入同材料组，1440/375 双视口验证首题全文、次题折叠、展开/收起、判分回归、console 0 error、溢出 0；测试 uid 数据清理并核对保护 uid 零 mutation。
