# R303 设计方案：学习统计页补「模考成绩趋势」卡（跨卷历次成绩 + 目标分参考线）

## SOP-10 取证（一手证据）

- 学习统计页（stats.vue）已有：热力图、五模块雷达、错题分布、错因分布、近 7 日正确率、周成长轨迹、练习正确率/速度趋势、练习记录、考点地图——但对模考只在「练习记录」行里混排单条 attempt，全页零模考成绩趋势视图。
- 模考成绩数据早已齐备：`GET /api/exam/attempts?uid=`（无 paper_id 时返回全部已交卷 attempts，DESC，含 score/title/kind/submitted_at）；目标分 `GET /api/profile` target_score（R302 报告页已消费）。
- 现状：跨卷成绩趋势全站无处可看——报告页历史曲线只限同卷（R281 起），卷库列表只有最近 10 条 attempt 行无趋势；用户无法回答「我这段时间模考整体在进步吗？距离目标的差距在收敛吗？」（粉笔学习统计核心视图：模考成绩趋势 + 目标线）。

## 方案（纯前端零后端）

新共享纯函数 `frontend-uni/src/exam-trend.js`：

- `examTrend(items, target, cap=10)`：items 为 API 原样 DESC attempts；过滤 score==null/未交卷脏数据，取最近 cap 条反转为正序；<2 条返回 null（单点无趋势不渲染）。返回 `{ points[{id,score,kind,t}], scaleMax, best, latest, targetPct }`：
  - scaleMax = max(各 score, 合法 target, 10) 向上取整到 10 的倍数、封顶 100；
  - targetPct：target 合法（>0 数值，复用 exam-goal 语义）时 target/scaleMax*100，否则 null 不画参考线。

stats.vue：

1. onShow 并行 `loadExamTrend()`：拉 `/api/exam/attempts?uid=&limit=20` + 复用页面已拉的 profile（无则拉 /api/profile）取 target_score，失败静默不渲染（非关键路径）。
2. 「正确率趋势」卡之前插「模考成绩趋势」卡：复用既有 .trend 柱状视觉（高度 = score/scaleMax），柱色沿用 lo/mid 阈值（<60 lo、60–80 mid）；target 合法时叠一条虚线参考线 + 「目标 {t} 分」标签；底注「旧 → 最近 N 次 · 最好 X 分 · 最近 Y 分 → 新」。
3. 点柱进入对应成绩报告（attempt_id 深链，复用既有报告页）。

## 不做

- 不新增后端接口/字段；不改 /api/exam/attempts 契约；不做跨卷难度归一化（不同卷难度不同，卡内文案注明「不同卷难度不同，仅供参考」，不宣称可比性）；不伪造缺失目标分（无目标不画线）。

## 验收

- 1440×900 与 375×812：≥2 次模考 uid 趋势卡就位、柱高与分数一致、目标线位置正确、点柱进报告；单次/零次模考不渲染；无目标分不画参考线；溢出 0、console 0 error、性能预算过。
- 生产真实接口种子（同 R302 链路两次模考 + target 70）验证后测试 uid 全库清理 leftover 0。

## 测试

- vitest：examTrend（空/非数组/单点 null、DESC→正序、score null 过滤、cap 截断、scaleMax 取整封顶、target 非法 targetPct null、best/latest）。

## 反伪造边界

趋势只来自真实已交卷 attempts；目标线只来自用户自设画像；<2 条不渲染不编造趋势结论。
