# R198：练习页 v3 IA 迁移遗留死代码清理（学习计划/报考画像集群）

## 取证（一手证据）

- 生产 7d 窗口无新 verified 缺陷（boot 145 / slow_load 47 已知模式 / answer_log 152 持平），选代码治理轮。
- `git log -S plancard`：`30a2b54 feat(v3): 5-tab IA` 把「今日计划卡 + 报考画像引导/设置弹层」从练习页迁至首页 tab，但只删了 practice.vue 的模板，脚本与样式整段遗留。
- verified（grep 全文交叉核对）：practice.vue 模板中 `plan`、`planToday`、`profile`、`setupOpen`、`pf`、`FOCUS_MODS`、`guideHide` 及 class `plancard/guide*/plan-*/task-ck|main|sub/pf-*/hbanner*/home` 零引用；方法 `loadPlan/loadProfile/loadPlanToday/openSetup/skipGuide/setupNext/goTask/setFocus` 无任何调用点（`this.loadProfile()` 全文不存在，`this.profile` 恒为初始 undefined，故 `if (this.profile) this.loadPlanToday()` 两处守卫永假）。
- 影响：~140 行不可达 JS + ~40 行死 CSS 打进 practice chunk；`/api/daily_plan`、`/api/profile`、`/api/plan/today` 在练习页存在幽灵调用面，误导后续维护（R197 取证时即被误判为「练习页仍有独立 daily_plan 请求」）。

## 方案

只删不改：移除上述死方法、死 data 字段（`plan/profile/planToday/guideHide/setupOpen/setupStep/setupBusy/pf/FOCUS_MODS`）、`onPKeydown` 守卫里的 `this.setupOpen` 项、`finishSession` 里的永假 `loadPlanToday` 调用，及对应死 CSS。首页 tab 的同名活代码（home.vue）不动；`percentile`、`goBook`、`goMini`、`dailyStats` 等活引用保留。

## 边界（本轮不做）

- 不清理其他页面潜在死代码（无逐页取证）；
- 不改任何行为、接口、契约。

## 验证计划

- 删除后全文 grep 复核零残留引用；ESLint/vitest/build 全绿；
- 部署后生产 1440/375 练习页 golden path（开练→作答→完成页）与完成页击败百分比正常、console 0 error；
- bundle 体积对比（练习 chunk 应减小）。
