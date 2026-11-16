# R236：申论真题公开 SSR hub（/tiku/shenlun/ 以真实语料恢复 200）

## 取证（verified）

- 生产只读库 `shenlun_questions` 实有 208 道申论真题（`shenlun_materials` 166 条素材、`shenlun_answers` 6 条真实作答），App 内申论专区即由这批数据驱动——R232 判 404 的依据只是 `questions` 表 xingce 计数（shenlun=0），公开层从未呈现过这批真实语料。
- origin 日志近窗口 `/tiku/shenlun/` 持续有爬虫请求命中 404（今日 2h 内 19 次），需求信号真实存在。
- sitemap 全族已无 shenlun URL（R232 收口正确），当前 404 页给 App 申论专区 CTA（R233）。

## 推断（inference）

- 以 208 道真实申论真题为内容基础的 hub 页不属于 thin content 门页——与 R232「0 题空模块禁止 200」的判定前提（无内容可呈现）不再矛盾；R232 的守卫语义保留：若语料清空（total=0）自动回落品牌 404 + CTA。

## 方案（最小）

`backend/app/seo.py`：

1. `tiku_module` 对 `module=="shenlun"` 分流到专用 `_tiku_shenlun(page)`：
   - 数据源 `db.shenlun_questions(limit=PAGE_SIZE, offset)`（既有函数，App 同源）；total=0 时保持原品牌 404 + 申论专区 CTA（守卫不回退）。
   - 页面：面包屑 + `<h1>申论真题库（N 题）</h1>` + 年份/地区概览 chips（纯文本，不造过滤子页）+ 题目列表（年份·地区·卷名·题型 + 题干截断，不造不存在的详情链接）+ 分页 + App 申论专区 CTA。
   - canonical/CollectionPage JSON-LD 与其他模块 hub 同構。
2. `/tiku/` 首页：申论语料非空时追加「申论真题」区块卡（链 /tiku/shenlun/，计数如实）；主计数文案仍为「行测题目」口径（R234 不回退）。
3. `sitemap-pages.xml`：申论语料非空时收录 `/tiku/shenlun/`。

## 明确不做

- 不建申论题目详情页/过滤子页（避免 thin pages，挂候选）；
- 不动 `questions` 计数口径、R234 文案、R232 空守卫与边缘 404 下架清除语义；
- 不改 App 内申论模块。

## 回归测试

新增 `tests/test_shenlun_hub.py`：seed shenlun_questions 后 `/tiku/shenlun/` 200（canonical、无 noindex、题干可见、CTA、首页与 sitemap-pages 出现入口）；随后全部置 disabled=1，恢复品牌 404 + CTA、首页与 sitemap 不再出现（同时守住 test_tiku_404 既有空守卫用例的前置状态）。

## 部署后验证

生产 `/tiku/shenlun/` 200 + 208 题 + canonical；1440/375 双视口溢出 0、console 0 error；sitemap-pages 含该 URL；性能预算复验。
