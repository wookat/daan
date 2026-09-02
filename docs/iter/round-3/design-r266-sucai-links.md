# R266 设计论证：素材类型 SSR 页接入 /tiku/ 与 /llms.txt 内链

## 取证

- R264 上线 4 个 `/tiku/shenlun/sucai/{type}/` 聚合页后，入向内链只有申论 hub 素材板块
  与 sitemap；两大发现渠道仍是纯文本：
  - `/tiku/`（pages.py）：`另收录申论写作素材 166 条（政策理论、金句、案例、范文），详见申论真题库页。`
    ——类型名不带链接，素材页距首页 2 跳；
  - `/llms.txt`（sitefiles.py）：`另收录 166 条写作素材（按类型归档）`——llms.txt 是
    URL 导览文件，无 URL 的条目对 LLM 爬虫零可发现性。
- 与 R249（素材板块上线后三渠道口径对齐）、R254（套卷页族上线后 llms.txt/首页口径对齐）
  同构的收尾缺口。

## 方案

1. pages.py 素材行：类型名改为指向 `_shenlun_sucai_path(t)` 的链接并带计数
   （沿既有 `sl_mats` 非空守卫，清空自动回落）。
2. llms.txt：素材说明改为逐类型 markdown 链接（同守卫）。

零路由/契约变化；sitemap/canonical/JSON-LD 不动。测试补两渠道链接断言 +
素材清空后回落断言。

## 验证清单

- 后端 ruff/pytest/pyright 全绿。
- 生产部署后 nocache 实测 /tiku/ 与 /llms.txt 各含 4 个 sucai 链接；1440/375 双视口
  溢出 0、console 0 error；性能预算回归。
