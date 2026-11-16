# R319：做卷页「排除干扰项」——长按选项划掉

## 取证（SOP-10 四维对标 · 核心功能深度）

- 粉笔做题（尤其计时模考）支持排除干扰项：长按选项划掉，视觉弱化 + 删除线，帮助考生在犹豫题上缩小范围、二次回看时不重复推理。
- 本站做卷页（exam.vue）选项只有「选中/未选中」两态，无任何排除交互；刷题页同样缺失（本轮不动，挂候选）。
- 做卷页本机快照 `saveProgress()` 直接保存整个 `items` 数组，逐题新增字段 `_excl` 可零改动随快照持久化；服务端续考协议（R298/R317/R318）不含排除态，本轮不同步（挂观察项，后续可完全仿 marks/secs 模式收口）。

## 方案（纯前端，零后端/零契约/零 URL 状态）

1. 纯函数 `frontend-uni/src/exam-excl.js`：
   - `toggleExcl(excl, k, picked)`：入参当前排除数组/选项字母/当前已选字母，返回 `{ excl, picked }`；排除已选项时同时清除选择；重复长按恢复；输入非法 fail-closed 原样返回。
   - `pickWithExcl(excl, k)`：选中某选项时从排除数组移除该项（选择即恢复）。
   - 输入不可变（返回新数组）。
2. `exam.vue`：
   - 选项节点补 `:class="{ excl: (cur._excl || []).includes(k) }"` + `@longpress="toggleExcl(k)"`。
   - `pick(k)` 前置调用 `pickWithExcl` 清除该项排除态。
   - `toggleExcl(k)` 调纯函数写回 `cur._excl` 并 `saveProgress()`（本机快照自然带上）。
   - 样式：`.opt.excl` 透明度弱化 + `otext` 删除线，不改选中/未选中底色语义。
   - 加载/恢复路径 `_excl` 缺省容忍（`|| []`），不改 adoptServerExamProgress。
3. 交卷 payload 不变（`_excl` 不上传，纯做题过程态）。

## 验证

- vitest：toggleExcl 增删/排除已选项清 pick/非法入参 fail-closed/pickWithExcl 恢复/不可变。
- lint + H5 build。
- 生产：testing agent 双视口实测长按排除→删除线弱化→再长按恢复→排除后选中自动恢复→刷新本机快照保留→交卷不受影响。

## 观察项

- 排除态跨设备同步（可仿 R317/R318 marks/secs 模式）；刷题页同交互补齐。
