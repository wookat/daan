# R105：推送引导卡曝光盲区修复——普通练习完成页也展示

## 取证（2026-08-31 生产）

- push_subscriptions 全表 0 行；growth_events 近 7 天 `push_nudge_show`/`push_nudge_ok` 均为 0 条。
- 近 7 天真实作答 uid：08-30 13 个、08-31 5 个（answer_log），来源全部为普通专项练习
  （source=direct/session-report/NULL，module 以 changshi/yanyu 为主）。
- `daily_set_entries` 全表 0 行、`daily_open` 全表 0 条（埋点白名单随 R103 今日才生效，
  但结合 entries=0 可确认每日一练完成人数为 0）。
- R99 的「开启推送」引导卡 `initPushNudge()` 仅在 `_submitDaily()`（每日一练提交成功回调）
  中触发 → 真实用户 100% 走普通练习完成页，引导卡曝光为 0，推送通道（R98）形同虚设。

结论：不是订阅转化率低，而是引导卡从未被真实用户看到。鸡生蛋问题：推送引导只挂在
每日一练完成页，而每日一练本身没人完成。

## 方案（零后端改动）

在 `submitResult()`（普通练习完成路径，背题模式除外）末尾同样调用 `initPushNudge()`：

```js
// practice.vue submitResult() 内，H5 条件编译块
// #ifdef H5
if (!this.beiMode && this.items.length >= 5) this.initPushNudge();
// #endif
```

- 复用 R99 全部守卫：已订阅不显示、权限 denied 不显示、✕ 永久关闭（pushNudgeOff）、
  公钥未配置不显示、SW/PushManager 不支持不显示（无 SW webview 自然静默）。
- ≥5 题门槛：避免 1–2 题的强化小组/试验性会话也弹卡打扰。
- 文案分支保留：dailyStats 仅每日一练路径有值，普通练习完成显示通用文案
  「开启每日一练提醒」。
- 埋点不变：push_nudge_show / push_nudge_ok，可直接度量本轮曝光→订阅转化。

## 验收标准

1. 本地 `npm run build:h5` 通过。
2. 生产 1440：普通练习完成 ≥5 题 → 引导卡出现、push_nudge_show 落库；
   点「开启」→ 真实 FCM 订阅 → push_subscriptions 落库 + push_nudge_ok 落库。
3. ✕ 关闭后再次完成练习不再显示（pushNudgeOff 持久化）。
4. 375 视口无溢出、console 0 error。
5. 测试事件/订阅清理；保护 uid 零 mutation。
