# R130：禁用/忙碌态交互控件补 aria-disabled 语义

## 取证（verified facts，2026-08-31，R129 上线后）

- 生产 axe 4.10.2 复扫 6 个 SPA 页（首页/刷题/错题本/AI 问答/统计/我的，1440）：
  仅剩 1 条 violation——AI 问答页 `.ib-send.dim`（发送按钮禁用态，opacity 0.4）
  color-contrast serious；
- 根因：全站「禁用/忙碌」态统一用 `.dim` 降透明度表达，但无任何
  aria-disabled 语义——读屏用户不知道按钮当前不可用，axe 也按普通
  可用控件校验对比度（禁用控件本可豁免）；
- 同模式核查：动态 dim 的交互控件共 5 处——ask 发送按钮、ask「出一道
  同款题」chip（simLoading 忙碌）、ask「整页批改·即将上线」静态占位、
  book 手动录入「交卷判分」（未选题禁用）、export-confirm「确认导出」
  （busy 忙碌）。reminders 的 `.set-row.dim` 是容器非控件，不涉及。

## 方案

逐处补 aria-disabled（动态绑定与 dim 条件一致，静态占位直接写死），
点击守卫逻辑不变、视觉不变：
```
:aria-disabled="String(<dim 条件>)"   // 动态
aria-disabled="true"                  // 静态「即将上线」
```

## 验证

- 本地 lint + vitest + build:h5；
- 生产 1440/375：axe 复扫 6 页 0 violations；ask 页发送按钮实测
  aria-disabled 随输入内容切换；console 0 error。
