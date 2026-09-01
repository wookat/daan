# R142：prefers-reduced-motion 全站减弱动态效果适配

## 取证（源码一手证据，2026-09-01）

- `grep -rn "prefers-reduced-motion" frontend-uni/src`：**0 处**；`deploy/cf-pages`（/tiku SSR 页族）同样 0 处。
- 全站动效存量：
  - `@keyframes` 8 处：practice（sk-pulse 骨架呼吸、pop 答对弹跳、shake 答错抖动、slideup 判分横幅/弹层上滑）、book（cb-pop/cb-bounce 完成卡）、home（skel-pulse）、predict-card（p-skel-pulse）；
  - `transition:` 16 处（hover/展开等）；
  - 判分触觉反馈 `uni.vibrateShort` 2 处（practice）。
- 即系统开启「减弱动态效果」（前庭障碍、晕动症用户）后，骨架无限呼吸、答错抖动、弹层上滑等仍全量播放——WCAG 2.3.3 Animation from Interactions 未满足。

## 方案

最小而完整：H5 全局 CSS 一处收口，不逐组件改造。

- `App.vue` H5 段新增：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

  - 用「压到 0.01ms + 单次迭代」而非 `animation: none`：保留 keyframes 终态（如 slideup 弹层最终位置、pop 终态样式），避免 none 导致停在 0% 帧的视觉破损；这是业界标准做法（modern-css-reset 同款）。
  - 无限骨架呼吸（iteration-count 1）自然静止为普通占位块。
- /tiku SSR 页族：无 keyframes/transition（纯静态文档），不改。
- 振动反馈（vibrateShort）与音效有独立开关（练习工具音效开关），且非视觉动态，不并入本轮。

## 不做

- 不逐组件写 reduce 分支（全局压制已覆盖，页面无「动画承载信息」场景）；
- 不加产品内动效开关（系统级设置已足够，避免设置项膨胀）；
- 不改 uni-toast/原生转场（uni-h5 页面转场走同一 CSS 域，被全局规则覆盖）。

## 验证

- 本地：lint / vitest / build:h5 全绿（纯 CSS 无新测试面）。
- 生产 1440/375：Playwright `emulate_media(reduced_motion='reduce')`——
  - 首页骨架 `.skel` computed animation-duration=0.01ms、iteration-count=1；
  - 刷题答错 `.opt.wrong` shake duration=0.01ms；判分横幅仍正确出现（终态在位）；
  - 未模拟 reduce 时动效原样（duration 不变）——零回归；
  - console 0 error、横向溢出 0。
