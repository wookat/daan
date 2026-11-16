# R340：错题本「按错因筛选」——月度复盘错因行可点直达 + 筛选 sheet 错因组 + URL 同步

## 一手取证（2026-08-29，代码 + 生产走查）

- 错因数据已双写入：复习流答错后「错因自评」chips（`REASONS: ['粗心大意','概念不清','方法不会','纯蒙的']`，PATCH /api/mistakes 持久化 error_reason）+ R314 模考报告解析浮层错因自评（同一 PATCH 契约）。
- 月度复盘卡「按错因」分布已统计（`monthRecap.byReason`，含「未标注」桶），并给出行动提示「高频错因是提分洼地：优先复习对应模块的待掌握错题」——但复盘行不可点，用户无法据此筛出对应错题。
- 排序已支持「按错因」（sortBy='reason'），但筛选 sheet（排序/模块/题型/来源）没有错因维度；`shownItems` 无 error_reason 过滤分支。
- 对标：粉笔错题本支持按错因筛选错题；本产品数据、统计、提示三者都指向该方向，唯独缺出口。

## 用户问题

用户在复习流/模考报告里认真自评了错因，月度复盘也告诉他「概念不清 12 道是提分洼地」，但他无法一键看到这 12 道题——只能靠排序把同错因排一起（混在全部错题里）或搜索关键词，筛选闭环断裂。

## 方案（纯前端，零后端/零新 endpoint/零契约变更）

1. `book.vue` 新增 `rzFilter` data（''=不过滤）；筛选 sheet 在「来源」组后补「错因」组：全部 / REASONS 4 项 / 未标注，仅当当前 tab 列表存在任一带 error_reason 的错题或未标注错题时显示（恒真，故仅以 items.length 守卫，与「来源」组 hasExamMistakes 同构风格：用 hasReasonTagged 守卫——存在至少一条 error_reason 非空才显示错因组，避免全未标注时出现无意义筛选）。
2. `shownItems` 补过滤分支：`rzFilter==='未标注'` → `!m.error_reason`；否则 `m.error_reason === rzFilter`。
3. 当前筛选 chips 行（curfilter）补 rzFilter 显示与一键清除 ✕。
4. 月度复盘「按错因」行可点：点击设置 `rzFilter = g.name`（'未标注' 直接可用）、`tab='todo'`、收起 recap、滚到列表——复盘统计是「本月新增」口径、筛选是「全部待掌握」口径，语义差异可接受（复盘是入口，筛选是全集视图），文档如实声明。
5. `book-url.js` URL 同步（对齐 R276 协议）：新增 `rz` 参数，白名单 = REASONS ∪ {'未标注'}（URL 编码由既有机制处理）；`buildBookUrl` 仅 tab!=='fav' 时输出，`parseBookOpts` 白名单外 fail-closed 为 ''。
6. 不新增埋点（与既有 srcFilter/kpFilter 无埋点口径一致），零后端改动。

## 不改变

- /api/mistakes 契约、错因自评写入路径、月度复盘统计口径、排序语义、导出 PDF（自动跟随 shownItems 当前筛选，天然受益）。

## 验证计划

- vitest：book-url buildBookUrl/parseBookOpts rz 合法值/非法值 fail-closed/fav tab 不输出。
- 本地：lint/vitest/build 全绿（纯前端，后端基线不动）。
- 生产 testing agent：造数带错因错题（PATCH error_reason）→ 筛选 sheet 出错因组、选中只显对应错题、「未标注」桶、curfilter chip 清除、复盘错因行点击直达筛选、URL ?rz= 刷新恢复、非法 rz fail-closed、导出计数跟随筛选、375/1440、console 0 error。
