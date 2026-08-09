# 轮57：例行发现线（轮56 回归 + H5 老用户走查 + 健康/数据例行）

日期：2026-08-09 · 分支 devin/1786308692-r55（PR#114）· 本轮零代码/零生产数据变更

## 1. 轮56 回归

### 1.1 年份聚合页三态走查（Playwright，/tiku/y/2024/changshi/）

```
[desktop-1280] h1=True list50=True pager=True 年份互链=True cta开练=True 用时=2.2s jserr=[]
[375-light]    h1=True list50=True pager=True 年份互链=True cta开练=True 用时=2.2s jserr=[]
[375-dark]     h1=True list50=True pager=True 年份互链=True cta开练=True 用时=2.1s jserr=[]
```

### 1.2 year 直链抽题正确性

- `/api/questions?module=changshi&count=5&real=1&year=2024`：10 题全部 exam_year=2024、is_real=1；
- 复验 `module=yanyu&year=2023`：10/10 题 exam_year=2023 且 is_real=1。

### 1.3 sitemap 全分片校验

15 个分片（pages/topics/years/questions-1..12）全部 200，XML 解析全部有效：

```
sitemap-pages.xml     194 URL lastmod 0
sitemap-topics.xml    156 URL lastmod 51（2026-08-09，修复后格式正确）
sitemap-years.xml     102 URL lastmod 1
sitemap-questions-*   前8片各10000 URL 带 lastmod 56~351 条，后4片无（数据如实）
```

topics lastmod 修复（ISO 文本 updated_at 兼容）复验通过：日期格式 YYYY-MM-DD，XML 有效。

## 2. H5 老用户视角走查（375px）

首页→练习→错题本→统计→我的全流程，JS 错误 0：

- 首页：今日任务三件套/模块进度卡/打卡·连签/学习计划引导/时政每日一练均正常渲染；
- 练习：模块卡→题型选择 sheet（全部随机+16 个子题型带题数）→开练出题→作答后解析/答案反馈正常（轮52-56 的 brotli、预热、tag3/year 直链未破坏原有入口）；
- 错题本：Tab 正常渲染（空态正确）；
- 统计：近12周热力图 + 本机/云端口径标注在位；
- 我的：学习提醒入口在位。

P0/P1：无。P2：无新增（走查中「模块卡不直接开练需先选题型」为既有设计，非回归）。

## 3. 健康快扫（在架口径）

```
active 112,962；hs 一致性（最后匹配、[A-D]+）0；options 非JSON 0；(cid: 0
空缺仅 2 条已知台账题：panduan:334296、changshi:655861
```

## 4. 数据例行（照实报）

- 近 7 天作答 0 次 / 0 uid；14 天 source 归因、growth_events 均无记录（前期活跃出窗，获客瓶颈未变）；
- 当日访问归档：534 请求，/tiku/ 48，搜索引擎爬虫 0，headless/curl/python 自测 375、疑似真人 159；
- Bing `site:kaogong.zalize.com` 仍 0 收录（返回无关结果）；轮56 IndexNow 提交仅为回执，未见收录变化。

## 5. 下一批建议

1. 站长平台验证（Bing WMT/百度站长）仍是收录破零 P0——需老板账号/DNS 资源，持续催办；
2. 小程序提审/上架（获客第二通道，需老板资源）；
3. 无外部依赖可做：/tiku/ 年份页收录观测纳入周报脚本（按 /tiku/y/ 前缀统计爬虫命中）；sitemap-years lastmod 覆盖率随内容更新自然提升，无需干预；
4. LLM key/ACCESS_CODE 仍待补发，AI 功能保持降级。
