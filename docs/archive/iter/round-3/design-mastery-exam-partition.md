# R3 设计：掌握度外显 + 模考错题分区（round-3 P1-2 / P1-3）

日期：2026-08-29 ｜ 状态：实施中

## 背景（差距审计对应项）

- P1-2：掌握度体系已有服务端聚合（`/api/mastery/map`，贝叶斯平滑正确率 × 时间衰减），但只在独立的掌握度地图页可见；错题本「按模块查看」处没有任何掌握度信号，用户无法在整理错题时判断哪个模块/考点最薄弱（粉笔在错题分类处直接外显正确率/掌握情况）。
- P1-3：模考（试卷判分/答题卡扫描/手动录入）产生的错题与日常刷题错题混在一起，无来源标识、不可分区查看（粉笔错题本按来源分区）。

## 架构决策

1. **掌握度不新增计算口径**：错题本直接消费既有 `GET /api/mastery/map`（60s 进程内缓存、uid 隔离），前端只做映射展示。失败静默降级（不显示掌握度，不影响错题本主流程）。
2. **错题来源用单一 `source` 列**：`mistakes` 表按既有幂等迁移模式加 `ALTER TABLE mistakes ADD COLUMN source TEXT`；语义为「首次入本来源」，`'exam'`=模考判分（exam_api 两处 save_mistake），NULL=练习/拍题等既有路径。重复错题（dup 路径）用 `source=COALESCE(source, ?)` 保留首个来源。历史数据 source 为 NULL，按练习处理（可接受，文档注明）。
3. **不新建路由/页面**：分区做在错题本筛选体系内（筛选 sheet 加「来源」维度 + 当前筛选 chip + 卡片「模考」徽标），与既有模块/题型/排序筛选正交组合。

## 页面结构与交互规格

### 错题本 book.vue

- 「按模块查看」侧栏卡：
  - 模块行名称后追加掌握度摘要 `掌握 62% · 巩固`（来自 map.modules[].mastery/level_name，n=0 或无数据不显示）。
  - 三级考点行右侧追加 `62%`（map…tag3s[] 按 name 匹配；无数据不显示）。
- 筛选 sheet：存在模考错题时新增「来源」段：`全部 / 模考 / 练习` chips（srcFilter: '' | 'exam' | 'practice'）。
- 当前筛选条：srcFilter 生效时显示可清除 chip「模考错题 ✕」/「练习错题 ✕」。
- 错题卡 mhead：`m.source==='exam'` 时显示「模考」徽标（复用 rvbadge 样式族）。
- shownItems 过滤链新增：`exam → m.source==='exam'`；`practice → m.source!=='exam'`。

### 后端

- `db.py`：迁移列表加 `source`；`save_mistake` INSERT 增列，dup UPDATE 增 `source=COALESCE(source, ?)`。
- `exam_api.py`：两处 `db.save_mistake({...})` 增 `"source": "exam"`。
- `list_mistakes` 用 `m.*`，新列自动透出，无需改动。

## 验收

1. 本地：`(cd frontend-uni && npm run build:h5)` 绿；后端 `python -c "import app.main"` 可导入。
2. 生产（测试 uid `umteojq4sltdhorhm`）：
   - 模考判分产生的错题带「模考」徽标，筛选「模考」只剩这些；「练习」互补。
   - 按模块查看的模块行/考点行出现掌握度摘要，与 `/api/mastery/map` 返回一致。
   - 1440/375 双视口无横向溢出、无 console error；掌握度接口失败时错题本功能不受影响。
