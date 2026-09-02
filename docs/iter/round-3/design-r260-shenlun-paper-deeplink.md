# R260 设计：申论套卷筛选深链闭环（?paper 深链 + 套卷页 CTA 直达整套）

## 取证（verified）

- R253 套卷详情页 /tiku/shenlun/p/{paper}/ 底部 CTA 为 `?id={first.id}`——只直达本套第一题详情弹层，用户看完第一题回列表后是全库列表，本套其余小题需自行翻找（208 题 49 套，同套 4–5 题）。
- App 申论专区已有 qtype/year/region 三维筛选与深链（R251/R252），唯独「套卷」维度：后端 shenlun_questions 无 paper 过滤参数、App 无 paper 状态、onLoad 不收 ?paper。
- 逐题卡「去作答本题」?id 深链不受影响（保留）。

## 方案

- 后端：db.shenlun_questions / /api/shenlun/questions 增可选 `paper` 精确过滤（与 year/region 同构，disabled 守卫不变，契约向后兼容）。
- SEO：套卷页 CTA 由 `?id={first.id}` 改为 `?paper={quote(paper)}`——直达 App 内本套整卷列表；逐题 ?id 深链不变。
- App：shenlun.vue 增 paper 状态（onLoad 收 ?paper，非空且 ≤100 字符才应用），loadQs 拼 &paper=，筛选栏外显套卷 chip（✕ 可单独清除），重置一并清空。不做套卷 sheet 选择器（49 套列表过长，入口在套卷页/搜索）。

## 验收

- 后端 ruff/pytest 130(+1)/pyright 0；前端 lint/vitest 137/build 全绿。
- 新测试：paper 精确过滤命中 + 未知套卷空结果；R253 套卷页 CTA 断言更新为 ?paper=。
- 生产 1440/375 双视口复验：套卷页 CTA 落 App 后列表仅本套题目、chip 外显可清除、无 paper 入口行为零变化。
