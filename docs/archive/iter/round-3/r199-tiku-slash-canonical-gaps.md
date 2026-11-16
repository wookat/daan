# R199：/tiku 页族尾斜杠规范化缺口收口（papers 详情 / daily 归档）

## 取证（生产一手，2026-08-29）

R197/R113 建立的约定：列表页族以尾斜杠为规范 URL（无斜杠 301 补斜杠），详情页 `/tiku/q/{id}` 以无斜杠为规范（带斜杠 301 去斜杠）。生产逐路由复测发现两处缺口，变体直接 404 而非 301：

```text
/tiku/q/1            -> 200
/tiku/q/1/           -> 301 /tiku/q/1        （已有约定）
/tiku/papers/5       -> 200
/tiku/papers/5/      -> 404                   ← 缺口①
/tiku/daily/2026-08-28/ -> 200
/tiku/daily/2026-08-28  -> 404                ← 缺口②
/tiku/discuss        -> 301 /tiku/discuss/
/tiku/y/2025/yanyu   -> 301 /tiku/y/2025/yanyu/
```

- 缺口①：`/papers/{pid}/` 无路由，落到 `/{module}/{submodule}` 无斜杠 catch-all？否——带斜杠不匹配任何路由，直接 404。
- 缺口②：`/daily/{day}` 无斜杠落到 `/{module}` catch-all，`_module_name("daily")` 为空 → `_not_found`。

危害：外链/社交粘贴常见的「多打/少打一个斜杠」变体把 121 张卷详情页和 7 天滚动归档页判成死链（硬 404 丢权重、坏体验），与站内其余页族的 301 自愈行为不一致。

## 方案（只补 301，零内容变化）

- 新增 `@router.get("/papers/{pid}/")` → 301 `/tiku/papers/{pid}`（对齐 q/{id} 详情页无斜杠规范）。
- 新增 `@router.get("/daily/{day}")` → 301 `/tiku/daily/{day}/`（对齐列表/归档页尾斜杠规范）。
- 不改既有规范 URL、sitemap、canonical、JSON-LD；不动其余 catch-all 语义。

## 验证计划

- pytest 新增 2 例（两变体 301 且 Location 正确）；ruff 全绿。
- 部署后生产复测上表全部 URL，无回归；1440/375 双视口 /tiku/papers/5 与 /tiku/daily/ 归档页走查。
