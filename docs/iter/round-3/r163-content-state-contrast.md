# R163：内容态 axe 复扫收口——搜索详情答案色 + 讨论页发布禁用态

## 取证（事实）

- 延续 R162 发现（此前全站 axe 扫描均为初始/闲置态，内容加载态从未入扫），对 6 个内容态视图生产复扫（1440）：
  - 搜索详情展开态：`.q-opt.ans` / `.q-ans` 硬编码 #12b76a 落在白卡底，对比度 ≈2.5 < 4.5:1（serious，2 节点）——R49 已为同语义建 --ok-strong token，此两处漏网；
  - 讨论页（qid=37）：`.send[disabled]` 发布按钮白字落在 --brand-soft-2(#dce7fd) 浅蓝底，对比度 ≈1.4（serious）——uni-button 非原生 button，axe 不豁免禁用态；空输入时该按钮常驻可见；
  - plaza / exam list / home / practice 内容态均 clean；
- 离线重搜路径实测命中 R90 快照兜底正常出结果，无缺陷不立项。

## 方案（零后端、零依赖）

- search.vue：`.q-opt.ans`/`.q-ans` 颜色 #12b76a → var(--ok-strong)（对称 R49 token，深色模式自动适配）；
- discuss.vue：`.send[disabled]` 白字 → var(--brand)（浅蓝底深蓝字 ≈4.6:1，禁用视觉弱化语义保留）。

## 验收

- 本地 ESLint / vitest / build 全绿；
- 生产 1440/375：搜索详情展开态 + 讨论页 axe 复扫 0 violations；视觉回归正常、溢出 0、console 无非预期 error。
