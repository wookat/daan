# R304：模考成绩海报——报告页一键生成可保存分享的成绩图片

## 取证（SOP-10 四维复审计 · 核心功能深度/传播出口）

- 现状（源码 verified）：
  - 模考报告唯一分享出口是 R283 的「邀考友挑战本卷」纯文本复制（exam-share.js，只对 zhenti 卷生成文案）；
  - 全站唯一海报能力在 pkgA/social/poster.vue，但只支持「打卡/徽章」两种模式（fetchCheckinSummary），模考成绩零海报出口；
  - 报告页已有全部所需真实数据：GET /api/exam/report（score/correct/total/paper.title/kind/id）与 GET /api/exam/rank/{attempt_id}（beaten_pct/total，样本 <10 不给击败比例）。
- 竞品：粉笔模考交卷后可生成成绩海报图片（分数+击败比例+二维码），是核心传播出口；文本复制在微信场景传播力显著弱于图片。
- 结论：图片类成绩分享是报告页已闭环链路（配速/重练/文本分享/目标锚点）中最后一个缺失的传播出口，数据全部现成，纯前端可收口。

## 方案

1. 纯函数 `src/exam-poster.js`：`examPosterData(report, rank)`
   - report 缺 attempt/score/total → null（不渲染不伪造）；
   - 输出 {title, score, correct, total, beatenPct, kind, paperId, qrUrl}；
   - beatenPct 仅在 rank.total>=10 且 beaten_pct 为有限数时给出，否则 null（对齐 rank-card tinySample 口径，不编造社会证明）；
   - qrUrl：zhenti 且有 paperId → `SITE/tiku/papers/{id}`（对齐 R283 落点），否则站点根。
2. poster.vue 增加 exam 模式：`onLoad` 读 `mode=exam&attempt_id=N`，并行拉 report + rank（rank 失败静默 null），`drawExamPoster` 复用现有渐变底/圆角/QR 绘制骨架：卷名（超宽降字号）、大号得分、答对 x/n、击败 Y%（无则不画）、日期、扫码同卷挑战。
3. report.vue share 区补「生成成绩海报」入口（share-cta 同构视觉），navigateTo poster 页；不限 zhenti（mock/mini 也有成绩可晒，QR 落站点根）。

## 不做

- 不做服务端渲染海报/图片存储（纯 canvas 本地生成，零后端）；
- 不做微信 JS-SDK 直发朋友圈（资源缺口挂账，保存图片即出口）。

## 验收

- 本地：lint/vitest（examPosterData 边界：缺数据 null、tinySample 不给击败、mock 卷 QR 落根、字段完整）/build 全绿；
- 生产：真实临时 uid 种子模考，1440/375 双视口：报告页入口就位→海报生成（得分/卷名/答对/击败与 API 逐项一致）、样本 <10 不显示击败、保存按钮可用、QR 解码指向 /tiku/papers/{pid}、console 0 error、溢出 0、性能预算全过；验后测试 uid 全库清理 leftover 0。
