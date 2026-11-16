# R321：刷题页「排除干扰项」——长按选项划掉/恢复（对齐 R319 做卷页）

## 取证（SOP-02 调研先行）

- 粉笔做题页（练习与模考同构）支持长按选项排除干扰项：缩小选择范围、二次回看不重复推理。
- 本站 R319 已在真题做卷页（pkgA/exam/exam.vue）实现该交互（纯函数 `exam-excl.js` + `@longpress` + `.opt.excl` 弱化删除线视觉），R320 已服务端同步。
- 代码取证 verified：刷题页 `src/pages/practice/practice.vue` 选项仅有 `@click="pick(k)"`，无 longpress、无 `_excl`；R319 handoff 观察项明确「刷题页同交互补齐」挂起。
- 刷题页与做卷页语义差异（决定设计取舍）：
  - 刷题页 `pick()` 一次性锁定（`if (this.picked) return`），选后立即判分显示答案（examMode 组内模考除外，交卷统一判分）；做卷页可改选。
  - 因此「排除已选项清空选择」分支在刷题页不可达；排除交互仅在**未作答**时有意义。
  - beiMode（背题模式）直接显示答案，排除无意义。
  - 刷题 pendingSession 快照整 items 持久化（`saveSession()`），`_excl` 自然随快照恢复；无服务端练习进度协议，不做服务端同步（与 R319 本机态定位一致；刷题组为短会话，跨设备价值低，如实不外延）。

## 方案（纯前端零后端/零契约/零 URL 状态）

1. 复用 `frontend-uni/src/exam-excl.js` 既有纯函数 `toggleExcl` / `pickWithExcl`（不改）。
2. 新增纯函数 `exclVisible(excl, k, picked, beiMode)`（入 exam-excl.js）：返回选项 k 是否呈现排除态——`excl` 含 k 且非 beiMode 且未作答（`picked` 空）；作答后由 right/wrong/dim 判分视觉接管，排除视觉整体退出，避免 right+excl 混叠。
3. practice.vue：
   - 选项补 `@longpress="toggleExclOpt(k)"`；`toggleExclOpt(k)`：`beiMode || picked` 时 no-op；否则 `toggleExcl(cur._excl, k, '')` 更新 `cur._excl`。
   - `pick(k)` 锁定判定后前置 `cur._excl = pickWithExcl(cur._excl, k)`：点击被排除项自动解除排除并选中（与做卷页一致）。
   - 选项 class 绑定改数组：`[optClass(k), exclVisible(...) ? 'excl' : '']`。
   - CSS 补 `.opt.excl { opacity: 0.45 } .opt.excl .otext { line-through }`（与做卷页同视觉）。
   - `_excl` 随既有 `saveSession()` 整 items 快照持久化；旧快照/无字段回落 `[]`（`cur._excl || []` fail-closed）。
4. 不改：pick 判分/计时/错题/统计链路、examMode 自动跳题、键盘作答、beiMode、pendingSession 协议、任何后端。

## 测试计划

- vitest：`exclVisible` 覆盖——含/不含 k、beiMode 屏蔽、已作答屏蔽、非法 excl fail-closed、空 k。
- 既有 `toggleExcl`/`pickWithExcl` 用例不动（已覆盖）。
- 本地门禁：lint / vitest / H5 build。
- 生产（testing agent，1440/375）：专项练习真实做题——长按排除→弱化删除线；再长按恢复；点击被排除项→解除并选中判分正常；作答后排除视觉退出、judge 视觉正常；examMode 组内模考同交互；刷新 pendingSession 恢复排除态；答题卡/计时/错因/连对不回归；溢出 0、console 0 error。

## 不做

- 服务端同步刷题排除态（无练习进度服务端协议，不为此新增）。
- beiMode/已作答后的排除交互。
- 改判分或选项底色语义。
