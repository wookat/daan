# R10 设计方案：错题本桌面快捷键（列表 J/K/Enter 切题展开 + 复习模式 A–D/Enter 作答）

日期：2026-08-30 ｜ 轮次：round-3 R10 ｜ 对应差距项：competitor-audit.md P2-1

## 1. 取证

- 代码审计：全站 pages 无任何 keydown/keyup 处理（`rg 'keydown|onKey|keyup' frontend-uni/src/pages` 零命中），桌面用户在错题本/复习模式只能鼠标操作。
- 竞品范式：粉笔 Web 题库为桌面级工作区（R1 审计 fenbi-tiku-guest-1440.png），桌面刷题工具普遍支持键盘作答；我方 R1 双栏操作台已具备桌面形态，键盘操作是操作台效率的最后一环（P2-1：J/K 切题、Enter 展开）。

## 2. 交互规格（仅 H5 且 ≥1024px；输入框/含修饰键/移动端不拦截）

- 列表模式（非批量/无弹层）：`J`/`↓` 下一张、`K`/`↑` 上一张（当前卡 2px 品牌色描边 + scrollIntoView 平滑跟随）；`Enter`/`Space` 展开/收起当前卡。
- 复习模式：未作答且为选择题时 `A–D` 直接选项作答；多选时 `Enter` 确认答案；已作答后 `Enter` 下一题/完成复习。
- 切 tab / 离开页面（onHide/onUnload）重置焦点并移除监听，无泄漏。

## 3. 架构决策

- 纯前端 book.vue：window keydown 监听（`#ifdef H5` 条件编译，onShow 挂载/onHide+onUnload 卸载），复用既有 `toggleCard/pick/confirmMulti/nextReview`，零接口改动。
- 焦点态用 `kbId`（错题 id）驱动 `.kbf` class，样式仅在 ≥1024 media 内生效，移动端零影响。

## 4. 验收标准

- 本地 build:h5 通过。
- 生产 1440：列表 J/K 描边跟随+滚动、Enter 展开收起；复习模式 A–D 作答、Enter 下一题全链路可用；输入框输入不被拦截。
- 375：无任何行为/视觉变化；console 0 error、无横向溢出回归。
