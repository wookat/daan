# R232 设计：空模块 SSR hub 页收口为品牌 404

## 取证（verified）
- 生产实测 `GET /tiku/shenlun/` 返回 200、可收录（有 canonical、无 noindex），页面标题/描述宣称「申论题库…真题及答案解析」，正文为「申论题库（0 题）」——`/api/questions` 实测 shenlun 模块题目数为 0。
- 该模块因 0 题已被 sitemap 与 `/tiku/` hub 内链排除（sitemap 实测 0 处 shenlun），但 URL 可猜测直达，构成可收录的空洞「门页」：对搜索引擎是 thin content 风险，对落地用户是死胡同。
- `tiku_submodule` 已有 `if not total: return _not_found(...)` 守卫，`tiku_module` 缺同类守卫，属不一致缺口。
- R232 窗口 origin 日志复核：R230 部署（rev ec63053，20:10Z）后 `/api/admin/stats` 无 >1s 样本，前一窗口 38 条慢样本全部在部署前；SSR 页族 6 页 × light/dark axe serious/critical 全 CLEAN；无其他新 verified 缺陷。

## 方案
`seo.py tiku_module` 在 `_count_questions(module)==0` 时返回既有 `_not_found("该模块暂无题目")`（R119 品牌 404：noindex + 壳 + 出路链接），与 submodule 页守卫对齐。零契约变化：有题模块、/api、无斜杠 301 行为不变（shenlun 无斜杠 301 → 品牌 404，与 sitemap 排除口径一致）。

## 不做
- 不从 kb.MODULES 删除 shenlun（App 内申论专区仍依赖其知识库配置）。
- 不为申论建设 SSR 内容（无题目数据，属内容管线级立项，见 R166 审计）。

## 验证
- pytest 新增：0 题模块 hub 404 + noindex；有题模块 200 回归。
- 本地全绿门禁 + 部署后生产实测 /tiku/shenlun/ 404、/tiku/changshi/ 200、性能预算、1440/375 双视口。
