# R132：二级/分包页 axe 复扫收口（对比度 + 装饰图 alt）

## 背景与取证（生产一手，2026-08-29）

R120/R130 的 axe 复扫只覆盖 6 个主包页面。本轮对 18 个二级/分包路由做生产 1440/375 双视口 axe 4.10.2 全扫。

取证过程记录：首轮探针使用了错误路由（如 `/#/pkgA/discuss/discuss`，实际为 `/#/pkgA/social/discuss`），无效深链被 R60 兜底重定向回首页，扫描落在重定向中间态上产生了 landmark/h1 假阳性——经 pages.json 校正路由后复扫，landmark/h1 全部通过（App.vue 全局 markMain 覆盖分包页有效），该结论不成立，按规则不立项。

校正后 verified 缺陷（1440/375 双视口一致，共 8 个节点、3 个页面）：

1. `/#/pkgA/exam/contest`：`.hero-phase.upcoming`（#d97706 on --warn-soft #fffbeb）对比度不足 4.5:1；
2. `/#/pkgA/settings/reminders`：关闭态 `.set-row.dim { opacity: 0.5 }` 把行内 `.nm`/`.sub`/`.time-v` 文字对比度砍半，3 处 color-contrast fail；
3. `/#/pkgA/user/login`：`.hero-s`（--ink-3 on 页面底）、未选中 `.seg-item`（--ink-3 on --fill）、`.sso-note`（--ink-4）3 处对比度不足；品牌 logo `<image>` 编译为无 alt 的 img（image-alt fail，紧邻已有「错题邦」标题文本，属装饰图）。

其余 15 个路由双视口 0 violations。overflow=-15 为 scrollbar-gutter 预留（R43），非缺陷。

## 方案（纯样式/语义，零逻辑改动）

- App.vue 补 `--warn-strong: #b45309`（深色 `#fbbf24`），与既有 `--ok-strong`/`--bad-strong`（R49）对称；contest `.hero-phase.upcoming` 改用之；
- reminders `.set-row.dim` 保留视觉弱化但不再整行半透明：图标/开关保持 opacity 0.5，文字改用 `--ink-2` 级安全色（白底 5.5:1）；
- login：`.hero-s`、未选中 `.seg-item` 由 `--ink-3`→`--ink-2`，`.sso-note` 由 `--ink-4`→`--ink-3`；
- login logo `<image>` 补 `aria-hidden="true"`（装饰图，语义由相邻标题承载）。

## 验收

- 本地 eslint/vitest/build:h5 全绿；
- 生产 1440/375 双视口 18 路由 axe 复扫 0 violations、console 0 error。
