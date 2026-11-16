# R364：按卷练习完成页归卷收口——显卷名 + 「回卷库」出路

## 取证（verified，2026-08-29）

- 生产 rev `67a227a`（R363 已上线）。按卷不计时练习（R357）会话结束进入完成页（practice.vue「完成/结算」卡）：
  - 标题恒为通用「本组完成」，不显示这是哪张卷（R363 已把 `_ptitle` 贯穿到中断续练，但完成页未消费）；
  - 主 CTA「再来一组」→ `retryGroup()`：按卷会话 `lastModule=null` 且 `_redoItems=null`，实际走
    `this.start(null)` → 抽 **全模块随机 10 题**——用户刚练完一张真题卷，点主按钮却掉进无关随机题组，
    且会覆盖 `_source/_ptitle`（归卷线被随机组打断）；
  - 完成页无回卷库出路，只能「返回首页」再点进卷库；竞品（粉笔）做完试卷落回试卷列表/报告，闭环在卷维度。
- 计时模考不受影响（examMode 交卷走成绩报告页，不进该完成卡）。

## 方案（纯前端零契约）

1. `paper-continue.js` 补 fail-closed 纯函数 `paperFinishState(ptitle)`：
   `ptitle` 为非空字符串 → `{ isPaper: true, big: '本卷练完', title: ptitle }`；否则 `{ isPaper: false, big: '本组完成', title: '' }`。
2. practice.vue 完成卡消费（模板方法调用，规避非响应式 `_ptitle` 的 computed 缓存问题，同 R349 先例）：
   - 标题：背题「本组背完」不变；按卷显「本卷练完」+ 副行卷名「{title}」；
   - 主按钮：按卷会话显「回卷库」（`goExamList()` 已有方法直达 `/pkgA/exam/list`），替换「再来一组」；
     非按卷会话「再来一组」零变化。
3. 卷卡完成态（R361/R359 practiced）由 answer_log 驱动，回卷库即可看到「已练完全部 N 题 ✓」/新进度，无需额外请求。

## 兼容与边界

- 普通/强化/每日/时政/错题重练完成页零变化（`_ptitle` 均为 null）；
- 计时模考路径零变化；
- 中断续练恢复的按卷会话（R363 还原 `_ptitle`）同样命中归卷完成页。

## 回归

- vitest：`paperFinishState` 合法/空串/非字符串 fail-closed；
- 生产实测：按卷练完 → 完成页显卷名 + 「回卷库」→ 落回卷库卷卡进度即时可见；普通练习完成页「再来一组」回归。
