# R49 设计方案：soft 底语义色文字对比度收敛（color-contrast）

## 一手证据（2026-08-29 生产取证）

Lighthouse SPA 四页批测：stats/plaza/exam-list a11y 均 1.0，**刷题页 0.91**，唯一失败项 `color-contrast`：

- `.hstats .cnt.okc`（✓答对计数胶囊）：#16a34a on #ecfdf5，对比度 **3.12**（要求 4.5）
- `.hstats .cnt.badc`（✗答错计数胶囊）：#dc2626 on #fef2f2，对比度 **4.41**

根因：`--ok`/`--bad` 主语义色直接用作 soft 浅底上的小号文字色。同组合在 home `.tag.ok`、pk `.m-badge.win/.lose`、practice `.mchip.bad`、stats `.sl-ik` 亦复用（未被本次 Lighthouse 视口覆盖到）。仓库内 exam/report、weekly-report 等页已自发使用更深的 #15803d/#b91c1c，说明缺统一 token。

## 方案

1. App.vue 全局 token 增加文字级语义色：
   - 浅色：`--ok-strong:#15803d`（on #ecfdf5 ≈4.7:1）、`--bad-strong:#b91c1c`（on #fef2f2 ≈5.9:1）
   - 深色（.theme-dark）：`--ok-strong:#4ade80`、`--bad-strong:#f87171`（深 soft 底上更亮）
2. 将 soft 底上作小号文字的用法切到 strong token：practice `.okc/.badc/.mchip.bad`、home `.tag.ok`、pk `.m-badge.win/.lose`、stats `.sl-ik`。
3. 不动 `--ok/--bad` 本体（边框、进度条、选项反馈等大面积用途不受影响）。

## 验收标准

- 生产复验刷题页 a11y 0.91→1.0（color-contrast 通过），其余页不劣化；
- 1440/375 视觉仅语义色文字微深（浅色）/微亮（深色），布局零变化；
- console 0 error、游客只读零 mutation。

## 风险

纯 CSS token 与 6 处 color 替换；回滚还原即可。深色模式此前继承浅色深绿/深红文字在深 soft 底上偏暗，本轮 strong token 顺带改善。
