# R341 设计：模考报告「本卷错因画像」卡 + 直达错题本按错因复习

## 一手取证（2026-08-29，生产代码复查）

- R314 起报告解析浮层已有逐题「错因自评」（detail.mistake_id 存在时显示，PATCH /api/mistakes/:id 持久化 error_reason）。
- 但报告页对错因**零汇总呈现**：用户逐题打完标后报告页没有任何回报——无「本卷错因分布」，也无从报告直达错题本按错因复习的出口。打标行为缺少 payoff，复盘链路在报告侧断裂。
- R340 已建立错题本 rzFilter + ?rz= URL 契约与筛选能力；错题本为 tab 页（switchTab 无法带参），既有跨页意图协议为 storage 握手（autoStartReview / bookShowFavs 先写后消费即删）。
- 竞品：粉笔模考报告提供错因维度小结并可跳转错题本。

## 用户问题

模考后逐题标了错因，却看不到本卷错因构成，也无法一键去错题本复习「同错因」的题——标注投入没有产出，复盘到行动断裂。

## 方案（纯前端，零新 endpoint/表/契约）

### report.vue
1. computed `reasonRecap`：聚合 `report.items` 中答错题（picked && !correct），按 `error_reason || '未标注'` 分组计数（含 mistake_id 缺失项归未标注），按 n 降序；错题数为 0 时返回 null 不渲染。
2. 「逐题对错」卡后新增「本卷错因画像」卡：错因行（名称+比例条+计数），行可点（role=button + aria-label）。
3. 行点击 `goBookReason(name)`：`uni.setStorageSync('bookRzIntent', name)` → `uni.switchTab('/pages/book/book')`。仅四正式错因与「未标注」可写（白名单，fail-closed no-op）。
4. 卡内 tip 如实说明口径：点击进入错题本后看到的是「全部待掌握」中该错因的集合（不限本卷）。
5. 解析浮层错因自评已是响应式 data，打标后画像卡实时更新（同一 items 引用）。

### book.vue
6. onShow 消费 `bookRzIntent`：白名单校验（REASONS + 未标注）通过则 `tab='todo'`、`rzFilter=值`，随后 removeStorageSync；非法值仅删除不生效（fail-closed）。消费后 syncBookUrl 由既有 watcher 触发，URL 带 ?rz= 可刷新恢复。

### 不做
- 不新增后端 endpoint/表/埋点白名单外事件；不改 /api/mistakes、报告契约、月度统计与 R340 URL 契约；不改错因写入路径。

## 验证计划
- vitest：无既有 report 纯函数文件，聚合逻辑简单保留组件内；book-url 契约不变无需新用例（不改）。
- 本地：lint / vitest / build:h5 全绿。
- 生产 testing agent：造模考错题+浮层打标 → 画像卡出现且实时更新、行点击直达错题本已过滤（chip+URL）、未标注桶、无错题反例不渲染、bookRzIntent 消费即删、375/1440、console 0 error、0 次 /api/explain；测试 uid 清理 + 保护 uid 快照一致。
