# R243 设计：申论详情 URL 同步 + 「复制本题链接」分享出口

## 取证（verified）

- R241/R242 打通了「hub/搜索 → ?id=N 深链 → 详情」的入向链路，但出向缺失：
  在 App 内打开申论详情后地址栏仍是 `/#/pkgA/shenlun/shenlun`（无 id），
  刷新回列表态、复制地址栏分享给考友只能到专区列表——深链能力只有入口页在用，
  用户自己无法产出该深链。
- 详情页（作答工作台）零分享出口：全站其余内容面（行测题详情 q-social-bar、
  PK/团队/成绩单）均有 `uni.setClipboardData` 复制链接出口，申论详情是唯一例外。
- 本轮 14h origin 复审计无新 verified 产品缺陷（404/429/502 全部归因历史 09-01
  风暴与共享 NAT 受控测试；>1.5s 慢样本聚簇各轮部署重建窗口，为 R235 lb_try
  排队设计行为；tag3 抽题 22s 样本亦落在 21:25/21:47 部署窗口内）。

## 方案

沿用 R157 搜索页 URL 同步的既有手法（纯函数 + `history.replaceState`）：

1. 新增 `src/shenlun-url.js`：

```js
export const SHENLUN_PATH = '/#/pkgA/shenlun/shenlun';
export function buildShenlunUrl(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? SHENLUN_PATH + '?id=' + n : SHENLUN_PATH;
}
```

2. `shenlun.vue`：`watch: { detail }` 内 `history.replaceState` 同步
   `buildShenlunUrl(detail && detail.id)`——覆盖 openQ 打开、返回列表、
   切筛选清 detail 等全部路径；刷新即回到当前题（既有 onLoad ?id 校验路径）。
3. 详情头部补「复制本题链接」出口：`location.origin + buildShenlunUrl(id)`
   经 `uni.setClipboardData` 复制 + toast（对齐 profile/pk 既有交互）。

## 明确不做

- 不做微信 JS-SDK 原生分享（挂资源项）；不做分享卡片落地页（/s/* 面向战绩，
  申论深链本身即可直达）；不改 SSR/SEO 任何语义。

## 验证

- vitest：buildShenlunUrl 合法/非法 id 分支；
- 本地 lint/vitest/build + backend 全绿；
- 生产 1440/375：打开详情地址栏带 ?id、返回列表还原、复制按钮落剪贴板、
  刷新详情态直达同题、溢出 0、console 0 error、性能预算全过。
