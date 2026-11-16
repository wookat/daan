# R323 设计：首页「未完成练习」续练卡

## 取证（SOP-10）

- 一手证据（代码/生产实查）：
  - 首页已有「未交卷模考」续考卡（R288）：本机 examProgress 优先 + 无本机时 GET /api/exam/resume，可续可弃。
  - 普通刷题的未完成练习（pendingSession 本机 + R322 practice_progress 服务端）在默认回流入口不可见：首页无任何续练入口，只有用户主动进入刷题页才会触发「继续上次练习？」弹窗。
  - 粉笔首页对未完成练习有「继续练习」外显入口；两类中断进度在本站首页待遇不一致（模考有卡、刷题没有）。
- 结论：R322 服务端化后数据已齐备，纯前端零后端即可把普通刷题续练入口提到首页。

## 方案

纯前端零后端/零契约/零 URL 状态：

1. `practice-progress.js` 新增纯函数（fail-closed，输入不可变）：
   - `parsePendingPractice(saved, now)`：本机 pendingSession → `{done,total,module}`；无效/超 24h/全部已答返回 null。
   - `parseRemotePractice(d)`：/api/practice/resume 应答 → `{done,total,module}`；无效/空/全部已答返回 null。
2. `home.vue`：模考续考卡下同构新增续练卡「有一组未做完的练习」（模块名 · 已做 X/N 题）：
   - 加载顺序与刷题页一致：本机 pendingSession 优先；无本机快照且 ppClearedAt 30s 守卫未命中时才 GET /api/practice/resume（失败静默）。
   - 「去继续 ›」：`practiceLaunch {kind:'resume'}` → 刷题页直接恢复（用户已在卡上表达意图，不再弹二次确认）。
   - 「✕ 放弃」：确认弹窗后清本机快照 + 记 ppClearedAt + POST qids:[] 清服务端。
3. `practice.vue`：launch 链新增 `kind:'resume'` → `resumeNow()`：本机快照有效直接采纳；否则请求服务端快照直接采纳（不弹窗）；两者皆无回落 startDefault。恢复采纳逻辑从 tryResume/tryServerResume 抽出复用（`adoptLocalPending`/`adoptRemoteSnap`），行为零变化。

不做：服务端契约改动；模考/背题/时政路径改动；首页卡不做倒计时（练习无时限语义）。

## 测试计划

- vitest：parsePendingPractice（有效/无 items/超期/全部已答/module 缺省）、parseRemotePractice（有效/空/picks 字符串键/全部已答）。
- 既有 tryResume/tryServerResume 弹窗路径回归（不改语义）。
- 生产：临时 uid 设备 A 作答落服务端 → 同 uid 设备 B（全新隔离 context）首页出卡 → 去继续直接恢复；本机快照场景首页出卡 0 resume 请求；放弃后卡消失且服务端清除；完成练习后首页不出卡；1440/375 双视口；验后清理测试 uid、保护 uid 快照比对。
