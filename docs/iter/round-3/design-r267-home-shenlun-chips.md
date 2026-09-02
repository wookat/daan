# R267 设计：/tiku 首页申论 section 补题型/年份 chips（与行测模块同构）

## 取证（生产 + 源码一手证据）

- 生产 `/tiku/`（nocache 新鲜请求）实测：行测五模块 section 均渲染「子题型 chips + 按考点刷题 + 按年份刷真题」三组链接（如 yanyu 6 个子题型、y/2025 等年份链接），而申论 section 仅有 hub 链接、口径文案与 R266 素材类型链接——**题型页族（R251，5 类各 19–55 题）与年份页族（R250，12 年份各 5–51 题）在首页零链接**，只能经 hub 二跳发现。
- 源码 `backend/app/seo/pages.py::tiku_index`：行测 section 用 `submodule_counts`/`year_module_counts` 渲染 chips；申论 section（71–88 行）没有对应渲染，仅纯文案「按套卷…、年份、题型浏览」。
- 既有能力：`db.shenlun_qtype_counts()`（R251）、`db.shenlun_year_counts()`（R250）、`_sub_path("shenlun", t)`、`_year_path(y, "shenlun")` 均现成且被 hub/sitemap 使用。
- 与 R249/R254/R266 同构：新页族上线后发现渠道收尾缺口；本轮是首页 chips 维度（非文案）。

## 方案

`tiku_index` 申论 section 内（沿既有 `sl_total` 守卫）：

- 题型 chips：`shenlun_qtype_counts()` 非空时渲染 `<p class="meta">按题型刷题：</p><div class="tags">…</div>`，链接 `_sub_path("shenlun", t)` 带计数；
- 年份 chips：`shenlun_year_counts()` 非空时渲染 `<p class="meta">按年份刷真题：</p><div class="tags">…</div>`，链接 `_year_path(y, "shenlun")` 带计数、年份倒序（与行测一致）；
- 复用行测 section 的 markup/样式类（tags/meta），不新增 CSS；
- 空语料自动回落（不渲染该组，不产生死链）；
- 不动套卷链接（49 个套卷 chips 会撑爆首页，hub「按套卷刷题」卡已覆盖，文案已提及）。

## 不做

- 不新增路由/页面；不改 canonical/sitemap/JSON-LD/API 契约；不加套卷 chips。

## 验证清单

- 回归测试：首页含题型链接（贯彻执行）与年份链接（/tiku/y/2023/shenlun/）；清空申论语料时整 section 回落不渲染。
- 本地 ruff / pytest / pyright 全绿。
- 部署后生产 nocache 实测首页 5 题型 + 12 年份链接就位；1440/375 溢出 0、console 0 error；性能预算全过。
