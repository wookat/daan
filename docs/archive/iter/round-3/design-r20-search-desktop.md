# R20 设计方案：搜索页桌面工作台（favorites 之后的下一批）

日期：2026-08-29 ｜ 轮次：round-3 R20 ｜ 范围：仅 `frontend-uni/src/pkgA/search/search.vue` + 本文档，零后端

## 1. 现状取证（生产 1440×900，bundle index-CURZOXBs.js）

- `/#/pkgA/search/search` 输入「成本」实测：`.wrap` 680px、20 个 `.card.qitem` 单列纵向堆叠、scrollH 2703（3 屏）。
- 考点/试卷命中卡与题目混排在同一窄列，桌面大屏两侧全空。
- 截图：r20_search_results.png（会话内）。
- 对标：粉笔/夸克站内搜索在桌面端均为宽幅结果区+侧栏筛选/分类导航。

## 2. 方案（纯模板包裹 + CSS 媒体查询，不改任何 JS 方法/API）

- ≥768px（H5）：`.wrap { max-width: 1044px; margin: 0 auto; }`；`.tab/.titem/.qitem/.more` hover 反馈（cursor + qitem 阴影）。
- ≥1024px（H5，仅「全部」tab）：结果区双栏
  - 模板加包裹层：`<view class="res-cols" :class="{ two: tab === 'all' }">`
    - `.res-side`（左 300px sticky）：考点 sec + 试卷 sec（分类导航语义，桌面放左侧）
    - `.res-main`（右 flex:1）：code_hit 直达卡 + 题目 sec + 加载更多
  - `tab !== 'all'` 时不加 `.two`，保持单列（避免空侧栏占位）。
- <768px：无媒体查询命中，DOM 顺序调整为 side(考点/试卷) 在 main(题目) 前——与现状「考点→试卷→题目」顺序一致，移动端视觉零变化。
- code_hit 卡从 secs 之前移入 `.res-main` 顶部：移动端顺序变为 考点/试卷→code_hit→题目。为保持移动端零变化，code_hit 保留在 `.res-cols` 之前（包裹层外）。

## 3. 验收标准

- 1440：tab=全部 时左 300px sticky 考点/试卷侧栏 + 右题目列表；tab=题目/考点/试卷 时单列；无横向溢出。
- 1280：双栏仍生效（壳约束内收敛）。
- 375：单列、视觉与现状一致；tab 切换、题目展开详情、去练习/去做卷、加载更多、高亮全部保留。
- console 0 error。

## 4. 不立项说明

- 讨论区：生产 0 条讨论（共 0 条），双栏收益低，待有内容后再议。
- /api/favs* 偶发慢响应：本轮已实查生产机——2GB 共享机上 recruit-postgres 等其他产品容器占用（load 4.5–7、swap 2GB），kaogong 容器本身 30MB 正常；属机器共租资源挤占，非 kaogong 代码缺陷，列入架构维度待办（API 迁移/隔离评估）。
