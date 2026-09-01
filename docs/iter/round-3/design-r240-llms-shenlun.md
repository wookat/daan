# R240 设计论证：/llms.txt 补申论真题库入口（对齐 R236 站点实际内容）

## 取证（verified / inference / unknown）

- verified：R231 上线的 /llms.txt 生成逻辑显式 `if key != "shenlun"` 排除申论，且导语只写「行测五大模块」；该文件早于 R236（申论 hub 以 208 道真实语料恢复 200）——生产 curl 实测当前 /llms.txt 无 /tiku/shenlun/ 条目。
- verified：R236 已把 /tiku/ 首页与 sitemap-pages 的申论入口做成语料非空条件呈现，唯独 llms.txt 漏网——三个内容发现渠道口径不一致。
- verified：本轮生产复审计无新缺陷——/tiku/shenlun/ 在 light/dark × 1440/375 四组合 axe serious/critical 全零、页面溢出 0，Lighthouse perf/a11y/bp/seo 全 1.00、LCP 930ms、CLS 0；origin 近 8h 5xx 全部落在旧部署窗口/共享 NAT 探针（tail 有限样本，非完整日志）。
- unknown：LLM 爬虫是否消费该文件产生实际获客，不作声称。

## 方案

- `llms_txt()` 与首页/sitemap 同一守卫：`db.shenlun_questions(limit=1)["total"]` 非零时输出申论真题库条目，导语补「历年申论真题」；语料清空自动回落（与 R232 品牌 404 守卫一致，不产生死链）。
- 测试：+1 例契约测试（有语料出现、清空后消失）；测试清理用 DELETE（表上 question UNIQUE，disabled=1 后 INSERT OR IGNORE 无法复种，避免污染 test_shenlun_hub）。

## 明确不做

- 不给 llms.txt 加申论子页/详情页链接（详情页不存在，防死链）；不改边缘缓存组（R231 已放行，TTL 到期自然刷新）。
