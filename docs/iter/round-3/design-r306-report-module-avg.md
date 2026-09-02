# R306 设计方案：模考报告「模块得分」补全站同卷模块平均对比

## SOP-10 取证（一手证据）

- report.vue「模块得分」卡只显示本人 correct/n 与进度条（report.vue L54–63 实查），无任何全站对比——用户无法区分「这个模块是我弱还是本卷该模块普遍难」。
- 模考大赛赛后报告早有该能力先例：mock_event.py L455–472 对每模块用 `AVG(CAST(json_extract(a.per_module,'$.<m>.correct') AS REAL))` 聚合同场均值并外显 `avg_correct`——日常模考报告与大赛报告口径不一致。
- R301 已补题目级全站锚点、R305 已补卷级排行榜，模块级对比是同一「复盘对比锚点」线上的中间粒度缺口（粉笔模考报告模块分析有全站/平均对比维度）。
- 数据全部现成：exam_attempts.per_module JSON（n/answered/correct/secs），rank 接口已做同卷 per-user-best 聚合，报告页已挂 rank-card（复用其既有请求零新增）。

## 方案（最小收口，不伪造）

### 后端（insights.py api_exam_rank 纯增量）
- 同卷 per-user-best attempt（每人取最高分那次，与 board/distribution 口径一致）读 per_module，按模块聚合「各用户该模块正确率(correct/n) 的平均」。
- 返回 `module_avg: {mod: {"pct": 62, "n_users": 5}}`；仅统计 n>0 且 JSON 合法的行；参与用户 <2 的模块不返回（fail-closed，与 board 隐藏口径一致）。
- 既有字段与 self-only 鉴权零变化；不进公开 SSR。

### 前端
- rank-card.vue 拉到 rank 成功后 `$emit('loaded', d)`（既有请求复用，报告页零新增请求）。
- 新纯函数 `src/exam-mod-avg.js`：`modAvgPct(rank, key)`——module_avg 缺失/该模块缺失/n_users<2/pct 非有限数 → null 不渲染。
- report.vue `<rank-card @loaded="rankData=$event">`；modules computed 合并 `avgPct`；模板 mrow-v 下补小字「全站 {pct}%」（无数据不渲染，视觉用既有 --ink-3 token，不加新色）。

## 不做
- 不新增聚合任务/独立接口；不动大赛报告；不改 per_module 写入口径；不进 SSR/公开页。

## 验证
- 后端 pytest：多用户种子（含 per-user-best 低分重考不计入、单人模块不返回、JSON 合法性）；前端 vitest：modAvgPct fail-closed 矩阵；本地全绿后部署生产，真实接口种子实测 1440/375 双视口，测试数据全量清理。
