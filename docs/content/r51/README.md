# 轮51：轮50复验 + r37-r50 阶段复盘（一页纸）+ 健康快扫

## 1. QA 回归：轮50 SEO 直链三态复验

生产实测（Playwright，桌面 1280px / 375px 浅色 / 375px 深色）：

| 状态 | CTA 渲染 | 相似题互链 | 直链自动开练 | JS 报错 |
|---|---|---|---|---|
| 桌面 | ✔ | 8 条 | ✔ | 0 |
| 375 浅色 | ✔ | 8 条 | ✔（首次批跑 21s 未就绪系首载 bundle 慢，单独复跑 9s 内开练，API 200） | 0 |
| 375 深色 | ✔ | 8 条 | ✔ | 0 |

- 互链抽查：详情页 8 条链接与 DB 直查（同 tag3/排自身/仅在架）完全一致；点击互链目标页正常渲染答案与解析且同样带「在线练习此考点」CTA（内链闭环成立）。
- 直链请求实证：`/api/questions?limit=10&tag3=CS-LS-01&module=changshi` 200，拉题全部同 tag3。
- 无 P0/P1；375 首载偏慢为已知 H5 bundle 体积问题，列入 r51-r60 候选（见 §3）。

## 2. r37-r50 阶段复盘（一页纸）

### 2.1 已上线能力清单（r37→r50）

| 轮 | 能力 | 端 |
|---|---|---|
| r37 | 双长路径 UX 走查、admin ADMIN_TOKEN 修复、庆祝卡/空态/口径三项 P2 | H5/后端 |
| r38 | 迷你模考报告薄弱考点卡（weak_tags）+去强化 | 后端/H5/Flutter |
| r39 | 数据周度复盘方法固化、质量分抽样判定 | — |
| r40 | Caddy access log、首页召回卡+comeback_view、双引号治理1500条 | 后端/H5/内容 |
| r41 | 假上线 P1 发现与修复、SEO 观测首报 | 部署 |
| r42 | deploy_h5.sh 固化（hash 比对+回归）、16条撞重题裁定、周报脚本；.env 事故处置 | 部署/内容 |
| r43 | 例行复验、周报首份 | — |
| r44 | 小程序迷你模考闭环、H5 分享文案 A/B（uid 分桶+v 参数归因）、周报 cron | 小程序/H5 |
| r45 | 模考退出确认 P1、shuliang/yanyu 1312 条 hs 字母错位治理 | 小程序/内容 |
| r46 | 错题复习选项文本、收藏 Tab 操作、reminder_prefs 表+/api/reminders、小程序订阅入口（可降级）、H5 打卡提醒横幅 | 后端/H5/小程序 |
| r47 | Flutter parity（分享 A/B、复习 options、reminder_optin） | Flutter |
| r48 | access log 增量归档+小时 cron、Flutter APK 构建修复 | 运维/Flutter |
| r49 | 例行复验（无代码变更） | — |
| r50 | 详情页「在线练习此考点」tag3 直链开练 + 互链/索引复核 | 后端/H5 |

### 2.2 埋点清单（growth_events 白名单内已上线）

share_open / share_answer / share_copy / share_result_copy / share_team_join / team_join_open / team_report_copy / review_entry_click / review_done_celebrate / task_card_click / heatmap_view / comeback_view / reminder_optin / reminder_banner_click；作答归因 answer_log.source（share、share_a/b、qbar_a/b、book_a/b、seo）。

### 2.3 漏斗数据现状（近30天生产实数，2026-08-09）

| 漏斗环节 | 指标 | 现状 |
|---|---|---|
| SEO 获客 | /tiku/ 真实爬虫请求 | **0**（近14天归档 534 请求中爬虫 0，多为自测）；Bing site: 收录 0（IndexNow 已提交约12天） |
| 落地 | /tiku/ 请求 | 48 次/14天（几乎全自测） |
| 开练 | 作答 | 752 题/17 uid/30天（其中 8/1-8/2 重度用户贡献约 715，之后日均个位数）；模考 10 次/8 uid；source=seo 归因 0（刚上线） |
| 留存 | 复习/错题/提醒 | 新错题 147 条/30天；留存类埋点自然样本合计 4（comeback_view 1、heatmap_view 1、task_card_click 1、review 相关 1）；reminder_prefs 0 行 |
| 分享 | 分享事件 | share_open 4、share_answer 2、share 归因作答 5 题；A/B 分桶归因（share_a/b）样本 0 |

**一句话结论：产品侧能力（练习/模考/复习/打卡/分享/提醒/三端 parity/SEO 基建/部署与观测管道）在 14 轮内已系统性补齐且质量台账全绿，但漏斗最顶端「获客」没有自然流量进入——所有下游能力都在等第一批真实用户。瓶颈不在功能，在分发。**

### 2.4 r51-r60 优先级建议（如无异议按此推进）

1. **P0 分发（需老板资源，一次性识别申请）**：百度/Bing 站长平台验证（DNS 或文件验证）、微信小程序提审上架、LLM key/ACCESS_CODE 补发。这是唯一能让漏斗有输入的动作，工程侧已就绪。
2. **P1 无外部依赖-SEO 内容面扩大**：/tiku/ 考点聚合页（157 个 tag3 每个一页，题目列表+考点讲解），给引擎更多可收录着陆页；配套 sitemap 增量与 IndexNow 提交。
3. **P1 H5 首载性能**：bundle 分包/懒加载（375 首载慢已两轮观察到），SEO 落地→开练转化的体验前提。
4. **P2 留存机制激活**：有自然用户后复盘 A/B/提醒/召回数据再调；订阅消息等 AppID 到位开闸。
5. **P2 例行**：健康快扫（扫描器已改「取最后一次答案匹配」口径）、周报观测、Flutter 发版准备（需 keystore）。

## 3. 健康快扫

- active 112,962；hs 字母一致性 **0**（采用轮50建议的「最后一次匹配」口径，331919 误报消除）；options 非 JSON 0；(cid: 乱码 0；空缺仅剩 2 条存疑台账题（changshi:655861、panduan:334296）。
