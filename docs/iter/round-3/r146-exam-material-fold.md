# R146：真题做卷页资料分析同材料折叠

## 取证（2026-08-29，生产一手）

- POST /api/exam/start（paper_id=5，2025 四川行测，75 题）实测：第 72–75 题（id 376727–376730）为同材料资料分析题组，`splitMaterial` 全部可切分、`sameMaterial` 相邻判同，每题完整题面 539–580 字（材料重复约 500 字 × 3 题）。
- 做卷页 `exam.vue` 题面为 `<text class="q">{{ cur.question }}</text>` 单路径全量渲染，无任何折叠——与 R145 收口前的 practice.vue 相同缺口，且模考限时场景下重复阅读代价更高（行测真题卷资料分析通常 15–20 题 / 3–4 组）。
- 粉笔/夸克做卷体验均为「材料一次呈现 + 小题连续作答」。

## 方案（前端纯展示层，复用 R145 material.js，零后端）

- exam.vue 引入 `splitMaterial/sameMaterial`；computed `matInfo`：`cur.module==='ziliao' && idx>0 && 上一题同为 ziliao && sameMaterial(prev,cur)` 时返回切分结果，否则 null（切分失败/材料 <120 字自动回退原渲染）。
- 折叠态仅渲染 `matInfo.stem`；组内第 2+ 题题面上方插入「📄 同上材料（与上一题相同）· 展开/收起」条（role=button + 动态 aria-label，R123 运行时提供键盘激活）。
- `matOpen` 按题目下标记展开状态；`items` 变化（重开卷/恢复进度换卷）时重置。
- 与 R145 的差异：exam.vue 题面无 qSegs 高亮路径，展开态直接回全量 `cur.question`；恢复进度（storage resume）路径 items 同样经 watcher 语义覆盖。

## 边界

- 仅 module===ziliao、仅相邻实测同材料才折叠；作答/标记/答题卡/计时/交卷/键盘作答逻辑零改动。
- mini 卷与真题卷同一渲染路径，自然覆盖。

## 验证

- lint + vitest 全量 + build:h5；生产部署后 1440/375 双视口进 paper_id=5 真题卷跳至题组：首题完整、次题折叠、展开/收起、作答与答题卡回归、溢出 0、console 0 error；测试 uid 数据清理 + 保护 uid 零 mutation。
