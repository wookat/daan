# R307 设计：模考报告「薄弱模块 → 去专项强化」CTA

## 取证（SOP-02，先调研再实现）

- verified（源码 + 生产实测）：report.vue 模块得分卡（R306 后已含个人 x/n + 全站 N%）5 行均为纯展示，无任何行动出口；用户看到「言语 0/25，全站 60%」后想强化只能自己退回刷题页手动选模块。
- verified：practice.vue 已有完整模块直练链路——`practiceLaunch { kind:'start', module }` storage 协议（practice.vue onShow L729 消费）与 `?module=` 深链均现成；report.vue 已有 goPractice(tag3) 同协议先例（R282 错题考点直练）。
- verified：粉笔模考报告模块诊断带「去强化」直练出口（能力诊断 → 专项练习），是报告到练习的核心转化闭环；我站该链路断裂。
- R306 刚补的 module_avg 提供了「个人 vs 全站」判定薄弱的真实数据基础，本轮是其自然消费方。

## 方案

纯前端零后端。新增纯函数 `src/exam-weak.js`：

```
weakModule(modules) -> { key, name, reason } | null
```

- 入参为 report.vue 既有 computed `modules` 行（key/name/n/correct/pct/avgPct）。
- 候选过滤（fail-closed）：key 必须在行测五模块白名单（practice 可直练）；n ≥ 3（小样本模块不判薄弱）；pct 为 [0,100] 有限数。
- 主判：avgPct 合法且 `avgPct - pct ≥ 5`（低于全站均值 ≥5 个百分点）中差距最大者，reason=「低于全站均值 X 个百分点」。
- 兜底（rank/module_avg 缺失或全不达标）：本卷正确率最低且 pct < 60 的模块，reason=「本卷正确率 X%，全卷最低」。
- 全部不满足 → null，不渲染、不伪造薄弱结论。

报告页模块得分卡尾部渲染 CTA 行（可点/可键盘 Enter）：「薄弱模块：{name} · {reason} → 去专项强化」，点击复用既有 practiceLaunch 协议 `{ kind:'start', module: key, count: 10 }` + navigateTo practice，命中既有模块直练流程。

## 范围排除

- 不新增 API/埋点（/api/track 白名单不动）；不动 rank/module_avg 契约。
- 不做多模块列表式诊断（一次只给一个最该练的，避免噪音）。
- 阈值 5pt/60% 为展示判断，不写入任何数据。

## 验证

- vitest：白名单外模块、n<3、非法 pct/avgPct、主判差距排序、5pt 边界、兜底 60% 边界、全不满足 → null、不修改入参。
- 本地全绿门禁 + 部署后生产实测：种子同卷多用户使某模块显著低于全站 → CTA 出现、点击直开该模块练习；数据不足时 CTA 不渲染；1440/375 双视口溢出/console。
