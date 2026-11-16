# R251 设计：申论按题型真题页 /tiku/shenlun/{题型}/ + hub 题型链接 + App qtype 深链

## 取证（verified，生产只读库 + 代码现状）

- 生产 208 道申论题按题型分布：贯彻执行 55、归纳概括 55、大作文 43、综合分析 36、提出对策 19——五个题型全部 ≥19 题，非 thin。
- 行测五模块自有 `/tiku/{module}/{中文子题型}/` 子题型页族（tiku_submodule）并入 sitemap-pages；申论 hub 正文与 meta 反复写「概括、对策、公文、大作文等题型」，但全站无任何申论题型页，hub 也无题型入口（只有年份/地区卡）。
- `/tiku/shenlun/{qtype}/` 现状：tiku_submodule 查 questions 表计数为 0 → 404「题型不存在」，分流安全。
- App 申论专区已有题型筛选（QTYPES chips + setQtype → /api/shenlun/questions?qtype=），但 onLoad 不接受 ?qtype 深链——SSR 题型页无法带类型直达 App。
- R250 年份页先例：分流 + 品牌 404 守卫 + 无斜杠 301 + sitemap 收录的完整模式可直接复用。

## 方案

1. `db.shenlun_qtype_counts() -> list[tuple[str, int]]`：disabled 守卫 + qtype 非空，按数量降序。
2. seo.py `tiku_submodule`（及 no-slash 301）对 `module == "shenlun"` 分流 `_render_shenlun_qtype(qtype, page)`：
   - 计数来自 shenlun_qtype_counts；未知题型/清空回落品牌 404；越界页码 404；
   - 列表复用 `db.shenlun_questions(qtype=...)` + `_shenlun_q_items`（逐题去作答深链）；分页 `_pager`；其他题型内链；面包屑 题库→申论→{题型}；CollectionPage JSON-LD；canonical `/tiku/shenlun/{quote(题型)}/`；
   - CTA 带类型直达 App：`/#/pkgA/shenlun/shenlun?qtype=<quote(题型)>`。
   - 注：五个题型互不为前缀，shenlun_questions 的 `qtype LIKE ? || '%'` 前缀匹配与精确计数一致。
3. hub 第 1 页补「按题型刷题」卡（对齐行测 hub sub_links 形态），链接题型页并带计数。
4. sitemap-pages 追加申论题型页（qtype counts 非空守卫，清空自动消失）。
5. App shenlun.vue onLoad 补 `?qtype` 白名单深链（QTYPES.includes 校验后 setQtype），零其他行为变化。

## 不做

- 不做地区页（山东 3 题等长尾 thin）；不做题型×年份交叉页；不改 hub 既有年份/地区/素材卡与分页/canonical 语义。

## 验证

- 本地：ruff / pytest（+1 例：题型页 200+计数+深链+canonical、301、未知题型 404、越界页码 404、hub 题型链接、sitemap-pages 收录、清空回落）/ pyright / lint / vitest / build。
- 生产：部署后 1440/375 双视口（题型页 + hub），axe、溢出、console、性能预算；点击 CTA 验证 App 题型 chip 激活；边缘 SWR 旧副本按 R250 观测陷阱等 TTL 复验。
