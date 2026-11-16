# R242 设计：/tiku/shenlun/ hub 列表项补「去作答」深链直达 App 详情

## 取证（verified）

- 生产 `/tiku/shenlun/`（R236 恢复的申论真题 SSR hub）题目列表为纯文本 `<li>`：
  `<li><span class="meta">【…】</span>题干…</li>`，逐题无任何链接；页面唯一 App 出口是底部整页 CTA
  `/#/pkgA/shenlun/shenlun`（进入专区列表，需再自行找题）。
- R241 已上线申论专区 id 深链：`/#/pkgA/shenlun/shenlun?id=N` → `onLoad` 纯数字校验后
  `openQ(id)` 直开详情弹层（生产 id=129 实测就位）。
- 即 SEO 页用户看到具体题目后无法一键直达该题作答——hub 与 App 详情之间断链，
  而行测各 hub 的 qlist 均逐项链接到 `/tiku/q/{id}/`。

## 方案

`_tiku_shenlun` 的每个 `<li>` 追加逐题深链（复用既有 `.qlist li>a` 下划线样式，R210）：

```python
lis.append(
    f'<li><span class="meta">【{_e(meta)}】</span>{_e(text)} '
    f'<a href="/#/pkgA/shenlun/shenlun?id={it["id"]}">去作答 →</a></li>'
)
```

- 深链为 hash 片段路由，不产生任何新的可收录 SSR URL（无 thin pages 风险）；
  canonical/JSON-LD/sitemap/分页语义零变化。
- 底部整页 CTA 保留（专区还有素材范文/推荐）。

## 明确不做

- 不建申论 SSR 详情页/过滤子页（防 thin pages，挂候选不变）；
- 不改 hub 的 meta/结构化数据；
- 不动行测 qlist。

## 验证

- pytest：hub 渲染断言补逐题深链 `?id=` 存在；
- 本地 ruff/pyright/全量 pytest；
- 部署后生产复验：hub 列表项含逐题「去作答」链接、点击直开对应详情弹层、
  1440/375 溢出 0、console 0 error、性能预算回归。
