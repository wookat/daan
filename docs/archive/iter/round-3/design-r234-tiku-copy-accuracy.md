# R234：/tiku 公开页文案计数口径校正（行测计数不再宣称含申论题目）

## 取证（verified）

- 生产只读库：`select module,count(*) from questions where disabled=0 group by module` → changshi 30907 / panduan 22916 / shuliang 32556 / yanyu 22022 / ziliao 4706，**shenlun 0 行**。
- 生产 `/tiku/` 页 title/description/JSON-LD/正文均写「收录 113107 道行测申论题目（或 行测/申论题目）与历年真题」——计数 `total = sum(counts.values())` 只统计上述五个行测模块，113107 里没有一道申论题。
- `/tiku/discuss/` description 同样写「行测/申论题目与解法交流」，而讨论只能挂在题库题（行测）上。
- 本窗口 origin 复审计无新缺陷：>1s 慢样本与 502/404 全部对应今日各轮部署窗口（旧 rev 未含 R230 stats 缓存 / R231 llms.txt，部署后即消失）；`/api/admin/stats` 现实测 0.24–1.5s、`/llms.txt` 200 text/markdown。

## 推断（inference）

- 对搜索引擎与用户宣称「N 道行测申论题目」是不实计数口径（申论 0 题），与公司「实事求是、不造假」原则相悖；R232/R233 已把申论的真实形态收敛为「公开题库无申论题 + App 申论专区」，公开文案应与之一致。

## 方案（最小、可测试）

`backend/app/seo.py` 四处文案改口径，不动计数逻辑/路由/JSON-LD 结构：

- `/tiku/` 正文：`收录 {total} 道行测/申论题目` → `收录 {total} 道行测题目`
- `/tiku/` description 与 CollectionPage JSON-LD description：`行测申论题目` → `行测题目`
- `/tiku/discuss/` description：`行测/申论题目` → `行测题目`

## 明确不做

- 不改 title（「行测真题在线刷题」本就准确）、不动 sitemap/robots/llms.txt（其文案已只写行测五模块）、不动 App 内申论专区、不声称任何 SEO/流量效果。

## 回归

- `test_tiku_copy_claims_xingce_only`：/tiku/ 与 /tiku/discuss/ 不得再出现「行测申论题目」「行测/申论题目」，/tiku/ 必须出现「道行测题目」。

## 部署后验证

- 生产 `/tiku/` description/JSON-LD/正文口径已改、计数不变；`/tiku/discuss/` 同；1440/375 双视口无溢出、console 无错误、性能预算回归。
