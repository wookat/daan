# R72 设计：每日一练同题挑战分享闭环

## 取证（2026-08-31，代码与生产实查）

- R69/R70 上线后，每日一练完成页已有「N 人完成 · 击败 X%」社交锚点，但「分享成绩」按钮仍走通用 `shareResult()`：文案是「刷了 N 道行测题正确率 X%」+ 裸首页链接，完全不体现「全站同题」与击败百分比——同题可比较才是分享传播的核心钩子（竞品粉笔每日一练分享即「同题挑战」语义）。
- practice.vue onLoad 深链只支持 tag3/module/year，**无每日一练直达深链**：被分享者点链接落首页后还要自行找入口，转化链路断裂。
- /tiku/daily/ SSR 页 CTA 也只指向主站首页，同样缺直达。

## 方案（全前端 + seo.py 一行，零新接口）

1. practice.vue onLoad：`query.daily` → `_urlLaunch = { daily: true }`；onShow 处理 `_urlLaunch.daily` 调既有 `startDaily()`（预取缓存/回退逻辑全复用）。
2. `shareResult()`：daily 完成态（`_dailyDate`/dailyStats 存在）改用同题挑战文案：
   `我完成了错题邦 {date} 每日一练（全站同题 10 题），答对 {right} 题` + （beat_pct 非空时）`，击败全站 {beat_pct}%` + `！同题挑战我：{SITE}/#/pages/practice/practice?daily=1`；非 daily 场景文案不变。
3. seo.py `/tiku/daily/` CTA href 改 `{SITE_BASE}/#/pages/practice/practice?daily=1`（直达开练）。

daily 完成后 `_dailyDate` 已清零 → 在 markDailyDone 时把 date 存入 `dailyStats._date`（或新增 `_dailyDoneDate`）供分享文案使用。

## 非目标

- 不做海报图（既有 share 体系为文案复制，保持一致）；不加新事件（复用 share_result_copy）。

## 验收

- 深链 `?daily=1` 直接进入每日一练（同题组、与 API 一致）；带 module 等旧深链不回归。
- daily 完成页点「分享成绩」剪贴板为同题挑战文案（含日期/对题数/击败百分比与 daily 深链）；普通练习分享文案不变。
- /tiku/daily/ CTA 跳转直达开练。
- 1440/375 console 0 error；随机回退路径不受影响。
