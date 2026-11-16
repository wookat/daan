# R144：/tiku/q 资料分析题「同材料题组」SSR 互链

## 取证（一手证据，2026-09-01）

- 源码：`backend/app/seo.py` 全文无 `material_hash` 引用——App 内练习已有材料题组能力（`db.grouped_ziliao_questions`，R 早期上线，material_hash 由 `refresh_material_hash` 启动线程维护），但 15.8 万收录主体的 SSR 题目页对资料分析题只输出「同考点相似题」（tag3 同考点，跨材料），同一篇材料的其余小题（真实做题时必须连做的一组）完全没有互链。
- 本机库实测：ziliao 模块 material_hash 有效分组（组内 ≥2 题）46 组、覆盖 207 题（本机 8059 题子集）；生产库为超集（生产 docker exec 高负载窗口挂起未取到精确数，源码路径一致）。
- 生产页面实测：/tiku/q/795022（资料分析）页面仅有「同考点相似题」区块，无同材料小题链接；用户从搜索落到组内某一小题后无法发现同组其余小题，SEO 侧同组页面也互不传权。

## 方案

`_render_question` 内：当 `module='ziliao'` 且 `material_hash` 有效（非 NULL/'-'）时，查同 hash 其余小题（`ORDER BY id`，含自身定位序号），组内 ≥2 题才输出：

- 新增 `<section class="card">`「同材料题组（共 n 题）」置于题目 article 之后、相似题之前；当前题标注「本题」不加链接，其余输出 `/tiku/q/{id}` 链接（题干截断样式同相似题）。
- 该区块不加 `noprint`——线下打印整组材料题是真实刷题场景（R143 的自然延伸），组内互链正是打印/连做入口。
- 相似题查询不变；SELECT 增补 `material_hash` 列。零新端点、零 SPA 改动、lru_cache 语义不变。

## 验证

- 后端 pytest：conftest 种子补一组同 material_hash 的 ziliao 题，断言组内题目页输出「同材料题组」区块与互链、非组题目页不输出。
- ruff（仓库根 + backend）全绿。
- 部署后生产实测：找一组生产 material_hash 题验证区块渲染与互链可点；1440/375 双视口 console 0 error、溢出 0；screen/print 双模式回归（R143）。
- 纯 SSR 读路径，无测试数据产生。

## 验证结果（2026-09-01 生产实测）

- 生产库实测（docker exec /data/data.db）：ziliao 有效分组 ≥2 题的 hash 组存在，样本组 6 题（min id 37/243685/753 三组各 6 题）。
- 本地：ruff（根 + backend）全绿，pytest 28 passed（新增 test_material_group.py 2 例）；material_hash 列迁移补入 db.init 基线（此前仅 refresh_material_hash 线程 ALTER，新库首个请求可能先于线程跑到 SSR 查询）。
- 生产 /tiku/q/37：1440/375 双视口「同材料题组（共 6 题）」区块渲染、组内 5 条 /tiku/q/{id} 互链 + 「本题」标注；console 0 error。
- 附带收口：375 视口取证发现题目页长算式（如 3850/104.2×4.2≈…）无断点致横向溢出 103px（存量问题，非本轮引入）；body 补 `overflow-wrap:anywhere` 后双视口溢出归 0。
- screen/print 双模式回归 R143：print 下 cta/ftr none、白底、ans 保留、题组区块保留（block）。

