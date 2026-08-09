# iter-r16 修复线台账（轮15发现问题）

生产快照：2026-08-09 docker cp deploy-kaogong-1:/data/data.db（questions=156792：disabled=0 111,987 / NULL 14,742 / 1 29,906）。数据改动全部走 `fixes.sql`，不直接改生产。

## 1. 代码：SEO 详情页含图题渲染
- `backend/app/seo.py` `_render_question` 补选 `image, image_credit`，题干后渲染 `<img>`（相对路径拼 SITE_BASE，与 H5 `practice.vue` `imgUrl()` 同一取图逻辑：`/qimg/...` 静态挂载）+ 图源署名。
- 快照中 disabled=0 含图题 216 道（如 412373 `/qimg/tuxing_gk2017fs_76.png`）。列表页不渲染图。

## 2. 代码：SEO/C 端口径收敛（disabled NULL=未审核，不应外显）
- `seo.py` 全部 8 处 `(disabled IS NULL OR disabled=0)` → `disabled=0`（列表/详情/相似题/sitemap/计数）。
- C 端同口径收敛：`db.py` 抽题（L365）、资料分析套题（L504/514）、模块/题型/tag3 计数与列表（L763/772/792/805）、真题卷派生（L1821/1844）、迷你模考组卷（L2488/2493）、学习计划选题（L3362/3505）；`insights.py` L390。
- 未动：shenlun_* 表（该表存量行 disabled 全为 NULL，语义为在线，非未审核）；admin/导入/去重路径（disabled=2 待审流转依赖 NULL 判断）。

## 3. 数据：papers/6「2024年国考行测真题卷」
- 核实：2,003 题全为 exam_region=国考、source=历年行测真题，年份混杂 2010–2024（2022:281 … 2024 仅 116）；即历年国考混合题集被错误立卷为 2024 卷。
- 2024 子集不足以还原真卷：116 题中 69 题已 disabled=1（在线仅 46 题），且完全缺资料分析（ziliao）模块——真正的 2024 国考行测为 130/135 题含资料分析。
- 结论：无法可靠还原 → 按预案下架该卷：`kind='retired'`（不下架题目本身）。配套 `seo.py` 试卷详情改为仅渲染 `kind='zhenti'`（原来只挡 mock，retired 卷旧 URL 现返回 404）。

## 4. 数据：options 为 Python dict 字符串（非 JSON）
- 全库扫 `options LIKE "{'%"` 及全量 json.loads 校验：共 **7** 题（轮15报告 5 题为 disabled=0 口径；本次含 2 题 disabled=1 一并修）：246070, 246137, 260606, 260615, 260935(下架), 262081, 264663(下架)。
- 转换：`convert_options.py`（ast.literal_eval → json.dumps，UPDATE 带原值守卫，幂等）；前后对照见 `options-json-ledger.json`。

## 5. 数据：(cid: 残留扫描
- disabled=0 范围内扫 question/options/explanation/hs_explanation 四字段：**0 条**，无需入 fixes.sql。

## dry-run 证据（`dry-run-output.txt`）
快照副本执行 `fixes.sql`：目标 7 题 options 全部合法 JSON、全库非 JSON 归零、paper6 kind=retired；question/answer/explanation/hs_explanation 全表哈希不变、非目标 options 不变、其余试卷不变；questions 行数不变；幂等重放通过。

## 生产执行方式（负责人操作）
```
ssh ubuntu@150.109.230.174
docker cp deploy-kaogong-1:/data/data.db /tmp/backup-$(date +%F).db   # 先备份
docker cp fixes.sql deploy-kaogong-1:/tmp/ && docker exec deploy-kaogong-1 sh -c "sqlite3 /data/data.db < /tmp/fixes.sql"  # 容器内无 sqlite3 则用 python
docker restart deploy-kaogong-1   # 必须：/tiku/q 详情页有 lru_cache，不重启会继续渲染旧数据
```
