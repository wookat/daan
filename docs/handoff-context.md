# 交接上下文（Handoff Context）

> 按 company-os/templates/handoff-context.md 维护，每次里程碑后更新。

## 项目目标
错题邦（考公错题助手，花生十三方法体系）——拍题 AI 讲解 + 五大模块 13 万+题库刷题 + 模考/真题卷 + 错题本/SRS 复习 + 申论批改，属「Zalize」考公考编线。阶段：上线运营。

## 代码与数据位置
- 仓库：`https://github.com/wookat/kaogong-assistant`（默认分支 `main`）
- 本地路径：`/home/ubuntu/repos/kaogong-assistant`
- 关键子目录：`backend/app/`（FastAPI，分层见 docs/ARCHITECTURE.md：qbank/study/exam/shenlun/ai/admin 等域路由）、`frontend-uni/`（uni-app，生产 Web 端 H5 产物的来源——旧 `frontend/` 壳已不用）、`miniapp-native/`（微信原生小程序，TS+Skyline+TDesign，AppID wx01f2f29cfe51baba）、`app-flutter/`、`deploy/`（Dockerfile.runtime、docker-compose、deploy_h5.sh）
- 数据库：SQLite（backend db.py 唯一持库入口）

## 技术栈
FastAPI + SQLite / uni-app（H5+小程序）/ 微信原生小程序 / Flutter App / 多模态 LLM（OpenAI 兼容通道，llm.py 通道选择与降级）/ 后端 SSR SEO 页族（/tiku/ 落地页集群 + sitemap 分片）

## 当前实时服务状态
- 线上：https://kaogong.zalize.com（自有服务器 Docker 部署，H5 走 deploy/deploy_h5.sh；非 Cloudflare——CF 迁移评估见治理批次 GV-1）
- 管理后台 /admin（check_admin 常数时间比较+失败限速）
- 小程序：代码完成，微信开发者工具/真机验证未做（缺环境）

## 当前数据概况
- 13 万+题库（五大模块，含真题/三级考点/同材料题组）；申论真题+素材范文；模考/真题卷库
- 错题/复习按 uid 隔离；导入必须 check_import_token

## 对标复刻循环（round-3 起，2026-08-29）
- 对标标尺：粉笔错题本 / 夸克刷题错题功能（SOP-10）；审计与设计文档在 docs/iter/round-3/
- 第 1 轮已上线（PR #174）：错题本 H5 ≥1024px 双栏操作台（主列=列表工作流常规流+margin-right 预留，侧栏=统计/复盘/AI/重练/模块 float:right 堆叠；≤1023px 不变）。教训：交错 DOM 的 float 双栏会因「浮动框顶不得高于更早浮动框顶」出现左列空洞，主列勿用 float
- 生产测试数据：匿名 uid `umteojq4sltdhorhm`（12 条错题，id 912–923），供各轮 1440/375 复验用，五轮闭环后清理（只删该 uid 数据）
- 第 2 轮已上线（PR #175）：错题重练答对推进 SRS（复用 record_review 单一入口，redo 接口带 mistake_id），完成页「错题重练效果」卡（已纠正/仍错/达成掌握）
- 第 3 轮已上线（PR #176）：错题本掌握度外显（按模块查看消费 /api/mastery/map，模块行「掌握 xx% · 等级」+考点行百分比，失败静默降级）+ 模考错题来源分区（mistakes.source 列，exam_api 判分入本 source='exam'，筛选 sheet「来源」段 + 卡片「模考」徽标；历史 NULL 按练习）
- 第 4 轮已上线（PR #177）：首页新访客价值主张首屏（.landing hero：标题+亮点网格 2×2/4 列+双 CTA；pstats.days 为空且未关闭时显示，✕ 写 landingHide 永久隐藏）
- 第 5 轮已上线（PR #178，基于 #177 分支，合并顺序 #174→#175→#176→#177→#178）：首页 hero「继续目标」CTA ≥1024 收敛为自适应宽度 + 错题本桌面侧栏「错题趋势（近 4 周新增）」卡（weekTrend computed 前端聚合 created_at，零后端改动，仅 ≥1024 显示）。/tiku 首载 30s 长尾复测不可复现（部署容器重建窗口瞬态），不立项
- 五轮闭环已完成（PR #174–#178 均生产上线并经独立走查；#175/#176/#178 已合并）
- 第 6 轮已上线（PR #179）：mistakes.mastered_at 时间戳（record_review 达成掌握 COALESCE 保留首次时间/取消清空；update_mistake 手动同语义；重复错题回炉清空并 mastered=0；历史 mastered=1 无时间不回填）+ 错题本桌面趋势卡升级为近 4 周「新增（蓝 created_at）/消灭（绿 mastered_at）」双柱（图例+摘要行；375 仍隐藏）。生产独立走查 1440/375 全通过（console 0 error）；测试 uid 无已掌握数据，消灭柱>0 视觉与后端运行时写入语义未在生产触发（本地临时库四场景已验证）
- 第 7 轮已上线（PR #180，基于 #179 分支）：/tiku SEO 页族视觉对齐 design-v3（白底品牌壳「错题邦 · 考公题库」+胶囊「去刷题」CTA、1px 细描边卡片+hover 抬升、色板/字体栈对齐 App.vue tokens；仅改 seo.py 内联 CSS+header，SEO DOM 不变）。生产独立走查 1440/375 全通过；R6 遗留消灭柱运行时取证亦完成（新游客 uid umtf09sjbdbe6tef4 真实作答→标掌握→mastered_at 写入/清空、绿柱出现/回落均验证，其服务端 3 条错题按授权留存）
- 第 8 轮已上线（PR #181，基于 #180 分支，合并顺序 #179→#180→#181）：/tiku 首页/真题卷/模块/题型四类页补 CollectionPage+BreadcrumbList JSON-LD（_collection_ld 帮助函数，与年份/考点页同构）+ 已掌握错题 ··· sheet 增「恢复复习」项 + master() 本地即时同步 mastered/mastered_at 消除趋势卡旧帧。生产独立走查 1440/375 全通过（无需 F5 即时更新已验证，R7 旧帧问题修复确认）
- 第 9 轮已上线（PR #182，基于 #181 分支，合并顺序 #179→#180→#181→#182）：book.vue load() 引入 _loadSeq 并发防护（旧快照响应丢弃），修复 R8 的「恢复复习首次点击偶发不生效/旧快照回跳」。根因取证：/api/mistakes 无 CDN/后端缓存（cf-cache-status: DYNAMIC），竞争窗口在无防护的并发 load() 覆盖乐观更新。生产走查 5 轮×2 方向快速往返 10/10 首次点击即生效，R8 的 ~20s API 延迟现象一并消失
- 第 10 轮已上线（PR #183，基于 #182 分支，合并顺序 #179→#180→#181→#182→#183）：错题本桌面键盘快捷键（P2-1），book.vue H5 条件编译 window keydown（仅 ≥1024px；输入框/修饰键/批量模式/弹层不拦截；onShow 挂载 onHide/onUnload 卸载）——列表 J/↓、K/↑ 移动 .kbf 品牌蓝描边+scrollIntoView，Enter/空格展开收起；复习模式 A–D 直接作答、多选 Enter 确认、已答 Enter 下一题。生产独立走查 1440/375 全通过（bundle index-BbP4x7ZM.js，console 0 error，375 零变化）；多选 Enter 分支 untested（当轮到期复习题均单选）
- 第 11 轮已上线（PR #184，基于 #183 分支，合并顺序 #179→…→#183→#184）：错题本快捷键可发现性——桌面侧栏「键盘快捷键」提示卡（.kbdcard 沿用 trendcard 的 ≥1024 显示模式；J/K、Enter、A–D 摘要 + 「按 ? 查看全部」）+ onKeydown 增 `?` 打开 kbdHelp 速查面板（复用 .mask/.sheet；Esc/?/遮罩关闭；面板打开时其余快捷键不生效）。零后端、仅 book.vue（bundle index-BKOqloLc.js）
- 第 12 轮已上线（PR #185，基于 #184 分支，合并顺序 #179→…→#184→#185）：刷题页桌面操作台——practice.vue H5 ≥1024px 常驻右侧栏 .pside（答题卡题号网格复用 acardClass/jumpTo + 快捷键提示卡），.wrap.pdesk 拓宽 1044px 主卡 .pmain 左移；onPKeydown（onShow 挂载 onHide/onUnload 卸载，book.vue 同模式）A–D pick、Enter next（模考态不响应）、←/→ jumpTo，输入焦点/修饰键/六弹层守卫。生产独立走查 1440/375 全通过（bundle index-DmI9VCS1.js，console 0 error）；模考态 Enter 分支与输入焦点分支 untested。零后端、仅 practice.vue
- 第 13 轮已上线（PR #186，基于 #185 分支，合并顺序 #179→…→#185→#186）：真题卷库桌面网格——pkgA/exam/list.vue 试卷 v-for 外包 .plist，H5 ≥1024px 两列 grid（repeat(2,1fr)、卡片 flex 列按钮贴底对齐）+ .wrap 拓宽 1044px（受全局 UNI-APP 壳 1140−侧栏 208 约束实测 932px，网格正常）。生产独立走查 1440/375 全通过（bundle index-Ctgr25hy.js，console 0 error，375 零变化，bodyScrollHeight 19822→10753）；R12 遗留模考态 Enter 分支已补测通过（首页「真题卷练习」入口，Enter 不跳题、侧栏「交卷」齐全）。遗留观察：年份 chip 首次点击偶发 /api/exam/papers net::ERR_FAILED 重试即成功（疑网络偶发，非本轮改动）；.wrap 真达 1044 需改壳级样式（候选后续轮）。零后端、仅 list.vue
- 第 14 轮已上线（PR #187，基于 #186 分支，合并顺序 #179→…→#186→#187）：统计页桌面双栏仪表盘——stats.vue predict-card 之后全部统计卡外包 .sgrid，H5 ≥1024px column-count:2 masonry（break-inside:avoid 防截断）+ .wrap 拓宽 1044px（壳约束实测 932）。生产独立走查 1440/375 全通过（bundle index-BsspR1mM.js，console 0 error，375 零变化，scrollH 1332→900 一屏尽览）；「模块分布/练习记录·展开全部」因测试 uid 数据量不足 untested。遗留观察：学习日历分包异步组件首载偶发 60s 超时（Async component timed out，非本轮改动，候选后续轮排查分包加载）。零后端、仅 stats.vue
- 第 15 轮已上线（PR #188，基于 #187 分支，合并顺序 #179→…→#187→#188）：桌面全局壳拓宽——App.vue 新增 @media (min-width:1366px) 档：uni-app 壳 1140→1280px（内容区 1072px，R13/R14 页面级 1044px 声明真实生效），tabbar/banner/mask/inputbar/batchbar/navrow/fabmenu 定位 calc 同步换算 1280。生产独立走查 1440/1280/375 全通过（bundle index-LW5yhAnl.js，console 0 error）：1440 stats/exam-list .wrap 932→1068、卡宽 448→516，batchbar/fabmenu/practice banner 均贴内容区；1280 仍 1140 壳无变化；375 零变化。untested：.inputbar/.mask/.navrow（ask/discuss/exam 页，同一 calc 组）。另：R14 遗留的学习日历 60s 超时本轮复测不可复现（直载 5s 内、SPA 内 3 次跳转 ~1s），判定为部署传播窗口瞬态。零后端、仅 App.vue
- 第 16 轮已上线（PR #189，基于 #188 分支，合并顺序 #179→…→#188→#189）：我的页桌面双栏——profile.vue 四分组（打卡徽章/学习/偏好设置/其他）各包 .psec、外层 .pgrid，H5 ≥1024px column-count:2 masonry（break-inside:avoid）+ .wrap.profile 拓宽 1044px；账号卡/学习资产行/退出登录/页脚保持整宽。生产独立走查 1440/1280/375 全通过（bundle index-C8Ip_oeW.js，console 0 error）：1440 .wrap 680→1072、双列 514px、scrollH 1557→1049；1280 双列仍生效（壳约束 932）；375 零变化；交互抽查（每日目标循环、锁定徽章 toast、账号卡→登录、日历/收藏跳转）全通过。untested：已解锁徽章→poster 分支（游客无打卡数据，该分支零改动）。零后端、仅 profile.vue
- 第 17 轮已上线（PR #190，基于 #189 分支，合并顺序 #179→…→#189→#190）：AI 问答桌面空态操作台——ask.vue H5 ≥1024px 隐藏 .camscreen 取景屏，显示 .deskstart 双栏卡（左：粘贴题目文字 textarea+A–D chips+讲解按钮复用 submitText；右：上传截图 dropzone，点击=相册、Ctrl+V 粘贴、拖拽 → 既有图片确认 sheet）；「最近讲解」卡移出 camscreen 两端共用。教训：uni-app H5 不代理 uni-view 上的 @drop/@dragover，须 document 级原生 addEventListener（onShow 挂/onHide+onUnload 卸，与 paste 监听同生命周期）。生产两轮独立走查 1440/1280/375 全通过（最终 bundle index-GHaHjsF7.js，console 0 error；真实 OS 拖拽/Ctrl+V/文字 LLM 全流程/追问/375 回归均过）。运维：走查发现生产 deploy/.env 自 8-27 缺 LLM key（非 R17 引入），已恢复文字通道（LLM_TEXT_*→ai.ctaigw.cn deepseek-v4-pro-0817，RESCUE→kimi-k3，备份 /tmp/env.bak.r17）；视觉通道（图片讲解）仍缺可用视觉模型 key——blocked，需老板提供
- 第 18 轮已上线（PR #191，基于 #190 分支，合并顺序 #179→…→#190→#191）：申论专区桌面化——shenlun.vue H5 媒体查询（零逻辑改动）：≥768px .page 1044px 居中+筛选 .mask/.sheet 居中弹窗+hover；≥1024px 真题 .qgrid/素材 .mgrid/记录 .rgrid 两列网格，详情页 .d-cols 双栏（左 .d-left 标签+作答要求+给定资料，右 .d-right 作答 textarea+批改+历史+参考要点，sticky top 24rpx）；<1024px .d-cols 退化纵向、DOM 顺序与原单列一致。生产独立走查 1440/1280/375 全通过（bundle index-DDehkVYn.js，console 0 error）：1440 三 tab 两列 498px、详情双栏 sticky、筛选居中弹窗真实生效、草稿自动保存+强刷恢复、真实 AI 批改出结果（生产未启用访问码，访问码弹窗分支 untested）；1280 两列 442px；375 零变化。注意：deploy_h5.sh 现含 CF Pages 部署步骤，部署后 bundle hash 校验可能因缓存传播 FAIL，稍等强刷即新 bundle。零后端、仅 shenlun.vue
- 第 19 轮已上线（PR #192，基于 #191 分支，合并顺序 #179→…→#191→#192）：收藏与笔记页桌面工作台——favorites.vue（零后端、零 JS 逻辑改动）：≥768px .wrap 1044px 居中+hover；≥1024px .fav-cols 双栏（左 .fav-left 收藏夹卡 300px sticky，右 .fav-right chips/重练/题目列表），笔记 tab .ngrid 两列；新增 folder 行 `···`（仅 H5、非默认夹）@click.stop 复用 folderOps actionSheet，补齐桌面无 longpress 无法管理收藏夹的功能缺口。生产独立走查 1440/1280/375 全通过（bundle index-CURZOXBs.js，console 0 error）：新游客自建数据走真实流程（收藏 2 题、新建夹、``···`` 重命名/删除、移动到…、选夹/模块过滤、重练本夹、写笔记→ngrid 两列、取消收藏），375 单列且 `···` 不破版。观察：/api/favs* 出现一次瞬时 ~62s 慢响应窗口（非本轮引入，重试 409 证明首次已成功），后端偶发慢查询待排查
- 第 20 轮已上线（PR #193，基于 #192 分支，合并顺序 #179→…→#192→#193）：搜索页桌面工作台——search.vue（零后端、零既有 JS 方法改动，仅新增 computed hasSide）：≥768px .wrap 1044px 居中+hover；≥1024px 且 tab=全部 且有考点/试卷命中时 .res-cols.two 双栏（左 .res-side 300px sticky 考点/试卷，右 .res-main 题目+加载更多）；tab≠全部或 hasSide=false 时单列。生产独立走查 1440/1280/375 全通过（bundle index-DVvOFRNf.js，console 0 error）：去练习/去做卷跳转、题卡展开、加载更多 20→40、题号仅命中题目单列均过；375 单列零变化（DOM 带 two 类但 <1024 媒体查询保证单列）。架构实查：/api/favs* R19 偶发 ~62s 慢响应根因为 2GB 共享机其他产品容器（recruit-postgres 等）资源挤占（load 4.5–9、swap 2GB），kaogong 容器本身正常——列入架构待办（API 迁移/隔离评估），非 kaogong 代码缺陷
- 第 21 轮已上线（PR #194，基于 #193 分支，合并顺序 #179→…→#193→#194）：AI 面试陪练+模考大赛桌面化——interview.vue/contest.vue（零后端、零 JS 逻辑改动）：interview ≥768 .wrap 1044、≥1024 分类 .cat-list 两列 grid、作答页 .iv-cols 双栏（左题卡+计时 420px sticky/右 textarea+提交）、报告页 .rp-cols 双栏（左五维评分+题目+参考要点/右考官点评）；contest ≥768 .wrap 1044+榜单 .mask/.sheet 桌面居中弹窗（content 560px）、≥1024 .ct-cols 双栏（左 hero 卡/右 .ct-side 360px sticky 往期+赛制）。生产独立走查 1440/1280/375 全通过（bundle index-DS_jK4Xe.js，console 0 error）：真实 265 字面试作答→提交→流式点评 74 分全流程、换一题/再练一题、榜单弹窗开关、375 单列+榜单退回贴底抽屉。未点预约报名（防写报名数据）；weekly/calendar/mastery-map 游客态内容一屏极简暂不立项。备注：.sheet content-box 视觉宽 588px 非 bug
- 第 22 轮已上线（PR #195，基于 #194 分支，合并顺序 #179→…→#194→#195）：答题 PK 大厅+刷题小队桌面化——pk.vue/team.vue（零后端、零 JS 逻辑改动）：pk ≥768 .wrap 1044、quiz/result 用 .pk-solo 保持 680px 居中窄栏，≥1024 home .pk-cols 双栏（左 .pk-left hero+模块+发起/匹配/应战码 420px sticky/右 .pk-right 胜场榜+我的对局）；team ≥768 .wrap 1044+创建弹层桌面居中 520px，≥1024 home hero 整宽+.tm-cols 双栏（左 .tm-main 小队列表/右 .tm-side 创建+加入 360px sticky；初版误用 row-reverse 方位相反，commit 1572c1f 修正为普通 row 并复验），panel .tp-cols 双栏（左 .tp-side 周排行 360px sticky/右 .tp-main 周打卡+队友卡）。生产独立走查 1440/1280/375 全通过（最终 bundle index-C-l8IPg_.js，console 0 error）：双游客真实 10 题挑战码对局（结果 187:99 落库）、随机匹配、小队创建→panel→复制邀请→退出全流程、375 单列+弹层退回贴底抽屉、DOM 顺序不变（列表在创建按钮前）。测试游客 localStorage 已清、保护 uid 恢复
- 第 23 轮已上线（PR #196，基于 #195 分支，合并顺序 #179→…→#195→#196）：真题做卷页+成绩报告页桌面化——exam.vue/report.vue（零后端、零既有判分/进度逻辑改动，exam 新增 H5-only onExKeydown）：exam ≥768 .wrap 1044+hover，≥1024 .ex-cols 双栏（左 .ex-main 题卡流/右 .ex-side 常驻答题卡 320px sticky：倒计时+题号 grid 三态+已答统计+交卷+快捷键提示；navrow 回归文档流并隐藏答题卡按钮），H5 键盘 A–D 选择/←→ 翻题/Enter 下一题·末题交卷（guard：<1024、修饰键、输入框、loading/submitting/cardOpen）；report ≥768 .wrap 1044+解析弹窗桌面居中 640px，≥1024 .rp2-cols 双栏（左 .rp2-side 分数 hero+排名+模块得分 420px sticky/右 .rp2-main 历次成绩+薄弱考点+逐题+按钮）。生产独立走查 1440/1280/375 全通过（bundle index-Di26M4SN.js，console 0 error）：新游客真实键盘作答 3/30→交卷确认（27 未答提示）→真实判分进报告（attempt 66）、逐题解析居中弹窗、375 单列+贴底浮层/抽屉不变。测试游客 localStorage 已清、保护 uid 恢复。R23 同轮取证：weekly-report 704/interview-history 712/discuss 704/login 680 仍窄（候选后续轮）；mastery-map 已 1072 但测得 scrollWidth 1425 待查证是否真溢出
- 第 24 轮已上线（PR #197，基于 #196 分支，合并顺序 #179→…→#196→#197）：周学习报告+面试练习记录桌面化——weekly-report.vue/history.vue（零后端、零 JS 逻辑改动）：weekly-report ≥768 .wrap 1044+分享 .mask/.sheet 桌面居中弹窗 560px+hover，≥1024 .wr-cols 双栏（左 .wr-side hero 四指标+徽章+本周vs上周 420px sticky/右 .wr-main 掌握变化+错因+模考回顾+下周行动+分享按钮），空态/pending/error 卡不入双栏；history ≥768 .wrap 680→1044，≥1024 .list 两列 grid+hover 阴影。生产独立走查 1440/1280/375 全通过（bundle index-BGKt378O.js，console 0 error）：新游客真实 2 次 AI 面试作答（60/56 分流式点评）→history 两列 grid 并排；周报空态整宽居中；375 单列。untested：有数据周报双栏视觉+分享弹层（游客无上周数据，已用 styleSheets 规则断言兜底）。测试游客已清、保护 uid 恢复。同轮排除：mastery-map 复测 scrollWidth==clientWidth==1425 无元素越界非真实溢出；login 窄表单惯例不立项。顺带发现（非本轮）：面试 session 在点评 SSE 流结束后才落库，中途关页可能丢记录——候选后端改进（评分阶段先落占位）
- 第 25 轮已上线（PR #198，基于 #197 分支，合并顺序 #179→…→#197→#198）：讨论页桌面双栏+面试 session 评分即落库——discuss.vue（纯 H5 CSS+包裹层，零 JS 逻辑改动）：≥768 .wrap 1044 居中+底部固定输入栏 .replying/.inputrow 限宽 1044 居中+hover cursor，≥1024 .dc-cols 双栏（左 .dc-side 题目摘要卡 380px sticky/右 .dc-main 排序 chips+评论列表+公约）；backend/app/interview.py：/answer/stream 评分完成即 _save_session(review="") 落占位、meta 事件带 session_id、流结束 _update_review 回填——修复 R24 发现的中途关页丢练习记录。另修复既有 bug（commit 946f837）：api.js streamInterview 裸 fetch 缺 Authorization/X-Access-Code 头导致登录账号态提交面试必 403（guard_account_uid 拦截）。生产独立走查 1440/1280/375 全通过（最终 bundle index-BUebEHnd.js，console 0 error）：真实评论发布（测试账号 13900001357/R25测试考友，qid=243872 留 1 条评论）、面试完整流 session_id=9 点评完整、中断流 session_id=10 记录保留（评分在/点评空占位，服务端不回填属预期）、登录态修复后提交 200（session_id=11 落账号名下与游客隔离）。测试游客/登录态已清、保护 uid 恢复
- 第 26 轮已上线（PR #199，基于 #198 分支，合并顺序 #179→…→#198→#199）：学习日历+模考大赛赛后报告桌面化——calendar.vue/contest-report.vue（纯 H5 CSS+包裹层，零 JS 逻辑改动）：calendar ≥768 .wrap 1044+hover，≥1024 .cd-cols 双栏（左 .cd-main 日历卡 flex:1/右 .cd-side 420px sticky 里程碑+海报按钮）；contest-report ≥768 同上+.pbtn/.wrow hover，≥1024 .cr-cols 双栏（左 .cr-side 420px sticky 总分 hero+小样本提示+分数分布/右 .cr-main 距离目标+模块表现+薄弱考点+历届曲线+行动按钮），loading/err 不入双栏。生产独立走查 1440/1280/375 全通过（bundle index-e1d0dr7T.js，console 0 error）：赛事按周六窗口自动生成，测试临时把 mock_events id=6 open_at 提前（测后已恢复原值 1788570000），新游客真实参赛作答 6/86→交卷→赛后报告（attempt 68），逐题回顾/弱项练 5 题/去练三跳转均过；测试榜单 entry 已删除防污染真实比赛排名；375 两页单列零变化。同轮取证排除：poster 680/join 592/share-q 672 属分享落地页窄卡惯例不立项
- 第 27 轮已上线（PR #200，已合并）：面试中断 session 点评状态外显 + H5「重新生成点评」（POST /api/interview/sessions/{sid}/review/stream SSE，rate_limit itv_regen 10/600s）+ REVIEW_MIN_LEN=300 长度守卫（<300 字短/截断点评不锁死 regen；前端 reviewMissing 同阈值，短正文与恢复入口同显）。生产两轮走查全通过（bundle index-njTwWnwJ.js）。R6–R27 链式分支收口 PR #201（rollup 入 main）
- 第 28 轮已上线（PR #202，基于 #201 rollup 分支）：讨论区评论举报 + 阈值自动隐藏——social.py 新表 comment_reports（PK(comment_id,uid) 幂等）、POST /api/comments/{cid}/report（登录+限流 cmt_report 10/600s，理由白名单归一，自举报 400，去重举报≥3 自动 status ok→hidden）、GET /api/admin/comment-reports 聚合、admin comments 支持 hidden；discuss.vue 非本人评论/楼中楼「举报」入口+ActionSheet 五理由+受理/已举报 toast+hidden 就地移除。生产走查 1440/375 全通过（bundle index-DAfhaa2y.js，console 0 error，3 账号阈值隐藏全流程实测）；留存 4 个测试账号（R28测试1-4）+1 条 hidden 测试评论 cid=8
- 第 29 轮已上线（PR #203，基于 #202 分支）：管理台评论举报审核工作台——admin 新页 pages/comments.js「评论与举报」（用户分组导航；KPI 待审核 hidden/被举报评论/累计举报人次；举报队列表恢复=误报/删除=违规；评论浏览 ok/hidden/deleted 筛选）+ POST /api/admin/comments/{cid}/restore（status→ok 并清空该评论 comment_reports 复位阈值）。同轮修复 R28 遗留 ImportError：social._check_admin 原 `from .main import check_admin` 在生产 500（check_admin 实在 deps.py），R28 admin 接口此前不可用，现改顶部 `from .deps import check_admin`。生产走查全通过（cid=8 恢复→C 端可见→删除定性→C 端消失，三状态筛选互斥，1440 console 0 error，375 布局不崩）；R28 遗留测试评论 cid=8 已清理（deleted）
- 第 30 轮已上线（PR #204，基于 #203 分支）：讨论区「回复我的」消息收件箱——GET /api/comments/inbox（登录态，r JOIN p ON r.parent_id=p.id 取他人对我顶层评论的回复，基于新表 comment_inbox_reads(uid, last_read_at) 已读水位计算 unread）+ POST /api/comments/inbox/read（UPSERT 水位）+ 新页 pkgA/social/inbox.vue「讨论消息」（未读蓝点/我的原评论摘要/点击跳 discuss?qid=/进入即已读）+「我的」页学习分组「讨论消息」cell（登录态 onShow 拉未读 badge，未登录导登录不发请求）。两级扁平回复模型 v1 只通知顶层作者。生产走查全通过（A/B 双测试账号真实回复流、读水位、删除后空态、1440 console 0 error、375 单列），测试评论 #11/#12 已清理
- 第 31 轮已上线（PR #205，基于 #204 分支）：收件箱补「赞我的」——inbox 双流混排（items 增 type reply/like；like 流查 comment_likes l JOIN question_comments c WHERE c.uid=me AND l.uid!=me AND c.status='ok'，匿名「有人赞了我的评论」+我的评论摘要，点赞者不外显；两流按时间倒序合并取 50，unread 复用同一读水位）。生产走查全通过（bundle index-DBba9i5b.js，A/B 真实点赞+回复混排、取消点赞条目即时消失、1440 console 0 error、375 单列），测试评论 #13/#14 已清理、保护 uid 恢复。注意：#202–#205 均 merge 进各自链式基分支，main 止于 #201——本轮另开 R28–R31 收口 rollup PR 入 main
- 第 32 轮已上线（PR #207，基于 #206 rollup 分支）：讨论页消息入口——discuss.vue 排序 chips 行右侧新增「消息」入口（bell icon + 未读红色 badge），登录态 onShow 拉 GET /api/comments/inbox 取 unread（失败静默），未登录不发请求、点击走 ensureLogin 登录引导；点击跳 pkgA/social/inbox，返回讨论页 onShow 重拉自动清 badge（进入 inbox 即打读水位）。纯前端改动无接口/表变更。生产走查全通过（bundle index-BHj4cLVt.js，A/B 真实回复+点赞→badge「2」→进 inbox→返回清零、游客 0 条 inbox 请求+登录引导、1440 console 0 error、375 无挤压），测试评论 #15/#16 已清理、保护 uid 恢复
- 第 33 轮已上线（PR #208，基于 #207 分支，合并顺序 #206→#207→#208）：讨论广场——后端 social.py 新增只读 GET /api/comments/plaza?limit=20（无需登录，limit 上限 50；按 question_id 聚合 status='ok' 评论，讨论数+MAX(created_at) 最近活跃倒序，每题附最新评论昵称/正文与题干 80 字摘要+module）；新页 pkgA/social/plaza.vue（卡片：模块 chip+n 条讨论+题干+最新评论+活跃时间，点击跳 discuss?qid=；≥1024 两列 grid、移动单列、H5 hover）；首页「更多练习」新增「讨论广场」入口卡（goPlaza）。不做自由发帖社区与广场内互动。生产走查全通过（bundle index-QbEsMS27.js，游客完整链路+跳转+1440 console 0 error+375 单列无溢出、R32 消息入口/点赞回归，本轮零测试数据残留、保护 uid 回读 n=7）
- 第 34 轮已上线（PR #209，基于 #208 分支，合并顺序 #206→#207→#208→#209）：解析区热评外显——仅改 q-social-bar.vue（组件级，惠及刷题/错题本/搜索等全部引用位）：load() 在 count>0 时追加 fetchComments(qid,'hot') 取 items[0] 存 hot（切题清空、失败静默、qid 竞态守卫），讨论行下方渲染「🔥 热评」卡（标签+昵称+👍赞数+内容两行截断，整卡点击 openDiscuss）；无评论题零变化、无后端改动。生产走查全通过（bundle index-JHLaSJu_.js，游客真实作答出解析：有评论题卡出现+跳转、无评论题 0 条 sort=hot 请求零变化、1440 console 0 error、375 无溢出，写笔记/计数/分享/广场回归；截图 emoji 方框为测试机字体缺失非缺陷）
- 第 35 轮已上线（PR #210，基于 #209 分支，合并顺序 #206→#207→#208→#209→#210）：/tiku 题目 SSR 页外显考友讨论（UGC SEO）——仅改 seo.py：_render_question（保持 lru_cache）body 尾埋 <!--QCOMMENTS--> 占位符，路由每次请求用不缓存的 _render_q_comments 替换（新评论无需重启即出现）；区块=「考友讨论（N 条）」卡（ok 顶层评论按赞倒序 LIMIT 5，昵称·👍n：内容，_e() 转义防注入）+「参与讨论」CTA 跳 App 讨论页；无评论题返回空串零变化，JSON-LD 不动。生产走查全通过（纯游客只读：有评论题区块+CTA 跳转、无评论题零变化占位符无残留、1440 console 0 error、375 无溢出、/tiku 首页与考点列表回归）
- 第 36 轮已上线（PR #211，基于 #210 分支，合并顺序 #206→#207→#208→#209→#210→#211）：解析区「抢首评」引导 + 讨论页输入直达（UGC 冷启动漏斗）——q-social-bar.vue count===0 时渲染虚线胶囊引导条（「这题还没有讨论，说说你的解法… | 抢首评 →」，与 R34 热评卡 v-else-if 互斥），点击跳 discuss?qid=&focus=1；discuss.vue onLoad 读 focus=1 且登录态时 300ms 后 input 自动聚焦（游客不聚焦、点输入框仍走 ensureLogin）。生产走查全通过（bundle index-rvbk_wKv.js：引导条出现+跳转带 focus=1、游客不聚焦+登录引导、登录态 activeElement=INPUT 自动聚焦、243872 热评卡互斥 firstc=0/hotc=1、1440 console 0 error、375 胶囊不溢出，R34/R35 回归；未发布任何评论、测试 storage 清理、保护 uid 零 mutation）
- 第 37 轮已上线（PR #212，基于 #211 分支，合并顺序 #206→…→#211→#212）：/tiku/discuss/ 考友热议 SSR 聚合页（讨论广场 SEO 化）——仅改 seo.py：新路由（+无斜杠 301）不缓存实时聚合（按 question_id 聚合 status='ok' 评论，讨论数+MAX(created_at) 最近活跃倒序 LIMIT 30），每卡=题干链接跳 /tiku/q/{qid}+模块·n 条讨论+最新评论（_e() 转义），底部 CTA 跳 App 讨论广场，空态引导文案，CollectionPage JSON-LD+面包屑；/tiku/ 首页 h1 下增「考友热议题目 →」入口（nowrap 防换行断裂）；sitemap-pages.xml 增该 URL。生产走查全通过（纯游客只读：301/入口/3 卡/题干跳题目页且 R35 区块回归/CTA 跳 App 广场 R33 回归/1440 console 0 error 无溢出/375 单列）
- 第 38 轮已上线（PR #213，基于 #212 分支，合并顺序 #206→…→#212→#213）：讨论评论多行支持——仅改 discuss.vue：输入栏 input→textarea（auto-height 随内容长高、max-height 240rpx≈5 行封顶后内滚、回车=换行不发布、发布仅走按钮；maxlength=500/:focus=autoFocus/@focus=ensureLogin 保留），.tx/.reply 增 white-space:pre-wrap 换行原样展示；后端 content 本就支持多行无改动。生产走查全通过（bundle index-D3qr68Hb.js：TEXTAREA 聚焦回归、长高 52→120px 封顶内滚、7 次回车不发布、3 行评论/2 行回复 pre-wrap 展示、删除后回 0 条+R36 抢首评回归、游客登录守卫、375 输入栏无溢出、1440 console 0 error；测试评论已删、storage 清理、保护 uid 零 mutation）
- 第 39 轮已上线（PR #214，基于 #213 分支，合并顺序 #206→…→#213→#214）：账号 uid 403 自动脱困——后端 guard_account_uid 对账号态 uid（u<id>）无本人 token 返回 403 是安全设计，但前端 rawRequest 仅处理 401，403 无脱困路径：token 失效/被清而 anonUid 仍为账号 uid 时全站 uid 读写永久 403 卡死（R38 走查实测触发）。修复仅改 api.js：403 且 detail 含「无权访问该账号数据」时与 401 过期同路径 clearAuth()+toast（无 token 也复位）。生产走查全通过（bundle index-CsviIocN.js：卡死态/伪 token 态刷新均首个 403 即自动复位+后续 200、正常登录不误踢、游客流不受影响、375 复位正常；测试数据清理、保护 uid 零 mutation）。已知预期内视觉滞后：复位后当页 placeholder 到下次刷新才更新（logged 于 mount 计算）
- 第 40 轮已上线（PR #215，基于 #214 分支，合并顺序 #206→…→#214→#215）：讨论聚合接口 N+1 查询收敛（架构 P2 挂账收口）——/api/comments/plaza（R33，原 1+2N≤101 条 SQL/请求）与 /tiku/discuss/ SSR（R37，原 61 条/请求）均为游客可达高频端点，跑在 2GB 共享机；收敛为单条 SQL（GROUP BY 子查询 + 相关子查询按 created_at DESC,id DESC 取每组最新评论 + LEFT JOIN questions），响应结构/语义不变（plaza 不加 disabled 过滤、SSR 保留 disabled=0 与缺题跳过；并列时序以 id 倒序打破原 LIMIT 1 的不确定性）。本地临时数据改前后逐字段等价验证通过并清理；生产走查全通过（游客只读零 mutation：广场 1440 三卡逐卡配对正确/console 0 error、SSR 1440+375 无溢出、广场 375 单列；plaza 0.29s / discuss 0.22s）。方案：docs/iter/round-3/design-r40-plaza-query-consolidation.md
- 第 41 轮已上线（PR #216，基于 #215 分支，合并顺序 #206→…→#215→#216）：登录态变更全局广播 authChanged——R39 脱困后前台页（403 由其自身请求触发，不经 onShow）登录态 UI 滞后到刷新才更新。api.js setAuth()/clearAuth() 末尾 uni.$emit('authChanged')；持页级登录态的 3 页（discuss logged+reload / profile user / stats authUser）onLoad $on、onUnload $off。生产走查全通过（bundle index-EOkL-d_Y.js：discuss/profile 制造 403 后不刷新当页即变游客 UI、正常登录/退出即时更新、评论发布删除与游客守卫回归、1440 console 0 error、375 无溢出；测试数据清理、保护 uid 零 mutation）。坑：hash 导航不换 chunk，验证新 bundle 需硬刷新。方案：docs/iter/round-3/design-r41-auth-event-sync.md
- 第 42 轮已上线（PR #217，基于 #216 分支，合并顺序 #206→…→#216→#217）：考点掌握度地图桌面化——mastery-map.vue 原 1440 为拉伸手机页（冷启动卡横贯 1072、tab 横向 scroll-x、色格 33% 单格 ~340px、吸底条横贯 ~1416px）。仅 CSS/模板：≥1024px 双栏（新增 .side-nav 220px sticky 纵向模块导航与横向 .tabs 共用 curMod、媒体查询二选一），色格 5 列+hover，.sheet 限宽 720px 居中，冷启动卡限宽 560 居中。生产走查全通过（bundle index-PE7o0p3u.js：一次性游客 uid 真实作答 40 题解锁、双栏/侧栏切模块/5 列/hover/居中 sheet/练 10 题跳转、1440 console 0 error 无溢出、375 零变化、stats/profile 回归；storage 清理、保护 uid 零 mutation）。坑：掌握度地图有后端进程内 _MASTERY_CACHE（TTL 60s），答满题后解锁显示滞后最长 1 分钟属既有行为。方案：docs/iter/round-3/design-r42-mastery-map-desktop.md
- 第 43 轮已上线（PR #218，基于 #217 分支，合并顺序 #206→…→#217→#218）：首页桌面 CLS 收敛——Lighthouse desktop 首页 performance 0.75、CLS 0.866（唯一红项），PerformanceObserver 定位主偏移为首帧无滚动条→数据渲染后滚动条出现→居中壳横移 7px（整页面积计入）。修复一行 CSS：App.vue H5 段 `html { scrollbar-gutter: stable; }`。复验 performance 0.98/CLS 0.04；生产走查全通过（bundle index-DWOeaykf.js：rAF 逐帧采样硬刷新全程壳 x 恒 280.5 零跳变、四页 body 右缘恒 1425 一致、1440/375 console 0 error、375 零变化零副作用；游客只读零 mutation）。遗留观察：主 bundle 未使用 JS ~68KiB（wasted 59%），拆分收益未验证，候选后续轮。方案：docs/iter/round-3/design-r43-cls-scrollbar-gutter.md
- 第 44 轮已上线（PR #219，基于 #218 分支；⚠️ #207–#219 均 merge 进各自链式基分支而非 main，rollup 收口 PR 见 #220）：深色模式原生导航栏返回箭头不可见修复——uni 原生 H5 导航栏页面（掌握度地图/真题卷库等）返回箭头 SVG path 填充取自 navigationBarTextStyle=black，深底 #15161c 上不可见；App.vue 深色段补一条 `.theme-dark uni-page-head .uni-page-head-btn path { fill: #f2f3f7; }`（CSS fill 覆盖 SVG presentation attribute）。生产走查全通过（bundle index-BZoCJss8.js：深色 1440/375 两页 computed fill=rgb(242,243,247) 箭头可见可点击返回、浅色回归 fill=rgb(0,0,0) 零变化、console 0 error、游客只读零 mutation）。方案：docs/iter/round-3/design-r44-dark-navbar-back.md
- 第 45 轮已上线（PR #221 已合并进 #220 rollup 分支；⚠️ #220 先合入 main、#221 后合入 rollup 分支，R45 尚未入 main，需下一个 rollup 收口）：/tiku SEO 页族边缘缓存——生产取证 /tiku/ Lighthouse server-response-time 9,390ms（cf-cache-status DYNAMIC 无缓存，2GB 共享机 load 9.95 挤占长尾），CF Pages functions [[path]].js 对 GET /tiku* 加 caches.default 缓存（TTL 300s，X-Edge-Cache HIT/MISS，仅 200+text/html、剥 Set-Cookie）。复验 server-response-time 20ms、perf 1.0、speed-index 13.7s→0.9s；生产走查全通过（MISS→HIT 实证、HIT 页渲染无损、非 /tiku 零泄漏、375 无溢出、游客只读零 mutation）。同轮关闭 R43「主 bundle 未使用 JS 拆分」候选：sourcemap 归属显示 ~82% 为 uni-h5/vue runtime/vue-router 框架运行时，不可拆。方案：docs/iter/round-3/design-r45-tiku-edge-cache.md
- 第 46 轮已上线（基于 #222 R45b 分支）：无障碍收敛——生产取证首页 Lighthouse accessibility 0.79，唯二失败项 image-alt（l-icon 装饰图标 img 无 alt，21 页复用 + uni tabbar 图标 img）与 landmark-one-main（uni 生成结构无 main）。修复：l-icon.vue 模板加 aria-hidden="true"；App.vue H5 段 MutationObserver 给当前页 uni-page-body 挂 role="main"（仅最后一个，避免多 main）并给 .uni-tabbar__icon img 补 aria-hidden。复验首页/错题本 a11y 均 1.0、perf 0.87 不劣化。方案：docs/iter/round-3/design-r46-a11y-landmarks-alt.md
- 第 47 轮已上线（基于 R46 #223 分支）：首页渲染阻塞 CSS 内联——生产取证 Lighthouse mobile render-blocking-insight 450ms（三个小 CSS：zalize-tokens 2.3KB/uni 5.2KB/index 5KB，主因请求往返而非体积）。新增 frontend-uni/scripts/inline-critical-css.mjs（build:h5 末尾执行，从产物 index.html 解析 stylesheet link 并内联为 <style>，hash 天然跟随，CSS 资产保留，link 缺失 fail-fast）。复验 perf 0.87→0.98、FCP 2.5→1.5s、LCP 3.3→2.1s、render-blocking 通过、a11y 保持 1.0。方案：docs/iter/round-3/design-r47-inline-critical-css.md
- 第 48 轮已上线（基于 R47 #224 分支）：/tiku SSR 页族正文链接可辨识性——生产取证 /tiku/q/* Lighthouse accessibility 0.92，唯一失败项 link-in-text-block（p.meta 内考点链接与 footer 链接仅靠颜色区分）。修复：backend/app/seo.py 共享 _CSS 增一条 `.meta a,.ftr a{text-decoration:underline}`。复验 /tiku/q/*、/tiku/、考点列表页 a11y 均 1.0（注意边缘缓存 TTL 300s，复验带 cache-busting query）。方案：docs/iter/round-3/design-r48-tiku-link-affordance.md
- 第 50 轮已上线（基于 R49 #226 分支）：刷题完成页「薄弱考点 · 趁热打铁」区块——非背题/非模考且本组有错题时，错题按 tag3/question_type 聚合倒序取前 3，每行「强化 5 道新题」直接调本页 startReinforce（source=session-report），补齐答错后就地补练闭环（对标粉笔/夸克报告页举一反三）。深色模式全站运行时扫描无 P0 残留不立项。方案：docs/iter/round-3/design-r50-session-weak-reinforce.md
- 第 51 轮已上线（基于 R50 #227 分支）：分包页 a11y 扫尾——生产 Lighthouse 扫未审计页族，favorites/calendar/search/pk/mastery-map 五页 0.82–0.91；四页低对比小字收敛到 var(--ink-2)（calendar 徽章淡化只作用 🔒 图标），App.vue markMain 观察者新增「无 aria-label 的 uni-input/textarea 内层元素把 placeholder 镜像为 aria-label」全站一次修复 label 失败。生产复验五页 a11y 均 1.0、book/plaza 不回退。方案：docs/iter/round-3/design-r51-a11y-sweep.md
- 第 52 轮已上线（基于 R51 #228 分支）：练习历史——服务端把 answer_log 按 >30min 间隔会话化（生产实测落库以单题为主、同会话间隔 p90≈445s，不能按 created_at 相等分组），新接口 /api/practice/history(+/detail)，新分包页 pkgA/stats/practice-history（会话行→展开逐题 ✓/✗+我的答案 vs 正解→「重练本次错题」复用 redoSet 通道）；入口=「我的」页学习分组行 + 统计页「练习记录」卡「逐题回看 ›」（本地摘要卡保留）。生产走查逐题 10/10 全量 MATCH、重练流 8/8、双视口双主题通过。方案：docs/iter/round-3/design-r52-practice-history.md
- 第 53 轮已上线（基于 R52 #229 分支）：禁用 uni-h5 shadow-preload——框架全局 body:after 动画每页 3s 后向 cdn.dcloud.net.cn 预加载 page-head 阴影图（本仓 0 处使用），带第三方 cookie；App.vue 增 `body::after{animation:none!important}` 覆盖。首页 best-practices 0.77→1.0、dcloud 请求 0。方案：docs/iter/round-3/design-r53-remove-dcloud-preload.md
- 第 54 轮已上线（基于 R53 #230 分支）：Web App Manifest——全站原缺 manifest（SW 已有），新增 static/manifest.webmanifest（standalone、512 logo any+maskable、start_url /?utm_source=pwa）+ index.html link，CDP getInstallabilityErrors 空=可安装；真机 Android 主屏形态未实测。方案：docs/iter/round-3/design-r54-web-manifest.md
- 第 55 轮已上线（基于 R54 #231 分支）：/api/exam/papers 冷路径收敛——原冷缓存下按 1.2 万 qids 逐 id 随机读 15.6 万行主表致 origin 冷请求 5–20s；新增 questions(disabled,id) 覆盖索引（生产实测活跃题查询 0.051s）+ 卷列表 uid 无关部分 300s TTL 缓存 + stale-while-revalidate（过期返旧值后台刷新，建卷时 clear），per-uid best/attempt 实时。遗留：origin 闲置后任意端点仍有 6–14s 通用长尾（2GB 共享宿主 IO/内存竞争，主机隔离架构待办）。方案：docs/iter/round-3/design-r55-exam-papers-cold-latency.md
- 第 56 轮已上线：uid 无关公开 API 边缘缓存——首页/广场依赖的 /api/announcement、/api/submodules、/api/real_filters、/api/papers、/api/comments/plaza 五端点（生产实测响应确定、无 Set-Cookie）在 CF functions 加 60s TTL caches.default 缓存（复用 R45 通道），带 Authorization/uid 的请求一律绕过，/api/questions 等随机/uid 端点不进清单；屏蔽共享 origin 6–14s 长尾抖动对首屏的影响。方案：docs/iter/round-3/design-r56-api-edge-cache.md
- 第 57 轮已上线（基于 R56 #233 分支）：PWA「安装到桌面」产品内入口——R54 manifest 后站点可安装但全库无 beforeinstallprompt 处理、产品内零安装入口；新增 src/pwa.js 模块级尽早暂存事件（canInstall/promptInstall/onInstallable），main.js H5 段顶部 import，「我的」页偏好设置组增 H5-only「安装到桌面」cell（仅可安装时渲染，iOS Safari/standalone/不可安装环境零变化）。accepted 路径 toast 依赖真机点「安装」标 untested（同 R54 Android 真机遗留）。方案：docs/iter/round-3/design-r57-pwa-install-entry.md
- 第 58 轮已上线（与 R57 同 PR #234 分支）：iOS Safari「安装到主屏幕」引导——iOS 无 beforeinstallprompt，R57 入口对 iOS 不可见；pwa.js 增 isIosSafariInstallable()（iPhone/iPad+iPadOS 桌面 UA，排除 MicroMessenger/CriOS/FxiOS/EdgiOS 与 standalone），「我的」页 v-else-if 分支 cell 点击弹两步图文引导（分享→添加到主屏幕）。生产 UA 模拟三分支（iOS/微信/Chrome）互斥实证；iOS 真机 untested。方案：docs/iter/round-3/design-r58-ios-install-guide.md
- 第 59 轮已上线（基于 R58 #234 分支）：首屏模块题数改走轻量可缓存端点——home/practice 首屏原调 /api/questions?limit=1 只为拿 counts，却附带随机抽题（生产实测 505→1850ms、不可边缘缓存）；新增 GET /api/question_counts（uid 无关确定性，SQL 0.08–0.11s）入 R56 边缘缓存清单（60s TTL），前端 loadCounts() 切换，/api/questions 响应保持不变。生产 MISS→HIT、逐字节一致、0.08–0.10s。方案：docs/iter/round-3/design-r59-question-counts-endpoint.md
- 第 60 轮已上线（基于 R59 #235 分支）：H5 未匹配路由兜底——生产实证无效/过期深链（如 #/pages/discuss/plaza）uni h5 router 无匹配渲染永久白屏（textlen 23、无 console error、无脱困路径）；main.js H5 块 window load 后对照全局 __uniRoutes（path/alias）判无效则 location.replace 回 #/。生产 375/1440 无效深链自动落首页、有效深链（含 query）零影响。方案：docs/iter/round-3/design-r60-route-fallback.md

第 49 轮已上线（基于 R48 #225 分支）：soft 底语义色文字对比度收敛——生产取证刷题页 Lighthouse a11y 0.91，唯一失败项 color-contrast（✓/✗计数胶囊 #16a34a/#dc2626 on soft 底 3.12/4.41）。App.vue 增 --ok-strong/--bad-strong token（浅 #15803d/#b91c1c、深 #4ade80/#f87171），practice okc/badc/mchip.bad、home tag.ok、pk m-badge、stats sl-ik 切 token。复验刷题页/首页 a11y 均 1.0。方案：docs/iter/round-3/design-r49-semantic-contrast.md
- 遗留观察：toast 存续极短难以截图取证（功能以趋势卡/API 为证，非缺陷）；游客 uid umtf09sjbdbe6tef4 的 SRS 已被 R10 复习作答推进（复习清零，服务端数据留存）

## 进行中/待办任务（按优先级）
1. H5 静态前端迁 Cloudflare Pages 评估/实施（GV-1，API 留服务器）
2. 小程序真机验证（待微信开发者工具环境）
3. 品牌接入切换为版本化 @zalize/brand 包（当前 zalize-tokens.css 为拷贝）
4. 题库基建与 tiku/test-copilot 长期收敛（三线方案 U5）

## 已知坑与注意事项
- 生产 Web 端来自 `frontend-uni` 构建产物，改 UI 别改错到旧 `frontend/`
- CSP 由后端下发，新增外部资源（如 nav.js）需同步白名单（PR #154 曾修）
- LLM 缺配置立即失败/友好降级（friendly_ai_err），不得伪造 AI 输出；讲解严格引用方法库，不编造「花生十三方法」
- SEO 页 /tiku/ 与 wookat/tiku 仓是两回事（本仓是后端 SSR 落地页集群）
- 勘误（R441/R443）：本文 R128–R437 各节把 Lighthouse `/` LCP 26xx–27xx 记为「宿主方差 / 单样本波动 / 本机噪音 / 宿主负载」均为**误归因**——那是 LH simulate 口径下 Lantern 按首绘前收完的 High 优先级请求折算的稳定值（真节流 0.7 s），低值 0.8/1.2–2.0 才是主包与首绘竞态的落点；历史行按当时原文保留不改，机理见 docs/iter/round-3/r443-lcp-budget-lantern-calibration.md。

## 资源与凭证索引
- 环境变量：LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（需图片输入）、SITE_BASE_URL、管理令牌/导入令牌（名称见 deps.py）
- 服务器 SSH（deploy_h5.sh 要求）：TICKETS_VPS_SSH_USER / TICKETS_VPS_SSH_HOST / TICKETS_VPS_SSH_CREDENTIAL；远程目录 /home/ubuntu/kaogong-assistant

## Zalize 统一账号接入（UA 项目收口 2026-08-27）

- UA-P2 JWT/JWKS 离线验签 SSO + 可选绑定（PR #166 已合并）：backend/app/zalize_sso.py；SSO 新建账号 phone=za:<邮箱> 占位、对外 phone:null；手机号+密码登录保留。
- 坑：运行时镜像 deploy/Dockerfile.runtime 需 pyjwt[crypto]（首次部署缺依赖 502，已补齐两处 Dockerfile）。
- 中心站 account.zalize.com（get-session / token / jwks，Cookie Domain=.zalize.com）；30 天双轨到期日 2026-09-26（到期前旧登录/旧 token 持续有效）；总方案与全阶段 PR 索引见 company-os projects/unified-account/plan.md。

## R61 handoff（2026-08-29）
第 61 轮已上线（基于 R60 #236 分支）：slow_load RUM 增加导航阶段拆解。取证：生产 growth_events 66 条 slow_load，高频 nav:60xxx/90xxx 整点级首载挂起分布在多个不同匿名 uid，且无伴随资源明细，无法区分文档 TTFB（边缘/回源层）还是子资源/SW 层。改动：main.js rumCheck ref 追加 ttfb/dom/load/sw/tx 五字段（后端 slow_load ref 上限 200 字符既有，够用）。本地节流 11s 实测字段齐全，生产快载零误报，bundle index-DWjTOfsz.js。后续：等真实 60/90s 挂起带阶段数据落库后归因（候选下一轮查询分析）。

### R62（2026-08-29）：首页 uid 请求聚合 /api/home_bundle
- 首屏 uid 专属请求 4–5 个（daily_plan/profile/badges/summary/plan_today）合并为 1 个
  GET /api/home_bundle?uid=，各子结构复用既有 handler、逐字段等价（本地 uvicorn 实测 MATCH）。
- 独立端点全部保留；bundle 失败前端自动回退独立请求（部署窗口/旧后端兼容，生产拦截 500 实测可用）。
- uid 专属端点不进边缘缓存清单（R56 设计一致）。生产 bundle index-DzhZ7CLW.js。

### R63（2026-08-29）：GET 请求 12s 超时 + 超时自动重试
- RUM 实证单请求级长尾（daily_plan:45s 等）而其他并发请求正常；原默认 180s 超时用户干等。
- request() 对未显式传 timeout 的 GET：12s 超时→自动重试一次（20s）；POST/显式 timeout 不变。
- 生产拦截实测：首次挂起→12s 重试→渲染；双超时→R62 fallback。bundle index-BfohsEFb.js。

### R64（2026-08-31）：共享宿主竞争韧性——uid 热表预热 + 容器 CPU 权重
- 生产实测 /api/checkin/summary 冷路径 125s(524)→62s→1.5s（页面直出 request:fail timeout）；同刻宿主 load 12.3、free 81MB、recruit-postgres 154% CPU，kaogong 容器自身 0.5%/58MB；uid 热表总量 <0.5MB（questions 194.7MB 才是 DB 大头）。
- _warmup（300s 周期）扩展整表预热 13 张 uid 热表（缺表跳过）；docker-compose kaogong 容器 cpu_shares: 4096（相对权重，仅争抢时生效）。
- 已部署生效（CPUShares=4096 inspect 确认，uid 端点部署后 0.01–0.09s）。边界：不能根治共享 2GB 宿主竞争，主机隔离/迁移仍是待办需老板决策。

### R67（2026-08-31）：陈旧壳自愈 + RUM 版本戳
- 生产取证：R61 阶段化 RUM 上线多日但生产 `ref like '%ttfb%'` 为 0——近 40 条 slow_load 全为旧格式，上报客户端全在跑旧 bundle；HTML must-revalidate 排除 HTTP 缓存，陈旧壳供给通道 = sw.js 导航兜底（8s 超时回退缓存壳），慢链路用户（恰是 60/90s 长尾人群）持续拿不到新包与新 RUM。
- main.js：RUM ref 追加 `;v:<bundleHash>`（运行时取主 chunk 文件名，零构建改动）；载入 15s 后 fetch('/',no-store) 比对主 chunk hash，不一致 reload 一次（sessionStorage kg_sh_reload 防重入）。
- 生产复验：拦截制造 hash 不一致 → 恰好一次 reload 且防重入生效、终态新 bundle；正常客户端 20s 无 reload、console 0 error。bundle index-CT7E7lVH.js。
- 待观察：新 slow_load 落库后按 `v:` 戳归因 60/90s 整点聚簇（假设为固定超时层，未证实）。

### R78（2026-08-31）：往期每日一练——近 7 天补练深链 + SSR 归档页
- 取证：粉笔每日一练提供往期日期列表可回看/补练；我站 /api/daily_set 固定 cn_day()、/tiku/daily/ 只渲染当日，昨天题组无任何入口——而选题按 md5(day:qid) 确定性，任意历史日期可零存储复现。
- 后端：db.daily_archive_day() 校验仅接受今天之前 7 天内 ISO 日期；/api/daily_set 加可选 ?date=（无效/越界回退今天）；_daily_set_cache 改多日缓存（≥16 清空）。
- seo.py：_render_daily(day, archived) 共享渲染；/tiku/daily/{day}/ 归档页（无效日期 301 回 /tiku/daily/）、当日页尾「往期每日一练」近 7 天链接、sitemap 收录 7 个归档 URL；归档页 CTA 深链 ?daily=1&date=<day>。
- practice.vue：深链 date 透传 startDaily(archiveDate)，往期走 /api/daily_set?date=（不用当日预取缓存）；markDailyDone 往期分支不提交成绩/不打卡/不计 streak（当日语义），toast「往期补练完成」，完成页走普通成绩展示。
- 生产复验：API 昨日题组 10 题与 /tiku/daily/2026-08-30/ SSR 题目 id 逐一一致，无效/过期/未来日期均回退或 301；sitemap 7 条归档 URL；浏览器深链往期真实作答 10 题→无 submit 请求、无 4xx、console 0 error，375 归档页 0 溢出；当日 ?daily=1 回归 submit 正常落库（服务端实证）。测试数据（3 个测试 uid 的 answer_log/mistakes/daily_set_entries）已清理，保护 uid 零 mutation。
- 设计文档：docs/iter/round-3/design-r78-daily-archive.md。

### R77（2026-08-31）：首页 hero 每日一练完成态回显
- 取证：首页 hero「今日全站同题 10 题 · 已有 N 人完成」只反映全站参与数——完成当日一练后回首页文案不变，无成绩/名次/streak 回显（粉笔首页卡完成后显示「已完成 · 连续 N 天」）；submit 返回已含 my_right/my_rank/streak，纯前端补本地回显链路，零后端改动。
- practice.vue：daily submit 成功后 setStorageSync `dailyDone:<anonUid>` {date,right,total,rank,streak}（按 uid 隔离）。
- home.vue：loadDailySet 返回后读该 key 且 date 为今日 → hero-ds 改为「已完成 答对 N/10 · 第 R 名 · 🔥 连 X 天」（streak≥2 才显示天数），否则维持原文案。
- 生产复验：新 uid 首页原文案→真实作答 10 题（预植昨日行）→回首页显示完成态（答对 8/10 · 第 1 名 · 🔥 连 2 天）；本地 date 改旧日期回退原文案；1440/375 无溢出 console 0 error；测试数据已清理，保护 uid 零 mutation。
- 设计文档：docs/iter/round-3/design-r77-home-daily-done.md。

### R76（2026-08-31）：每日一练连续参与天数（streak）
- 取证：粉笔每日一练以「连续打卡 N 天」为核心留存钩子；我站 daily 完成页只有当日成绩，无跨日激励。daily_set_entries(day,uid) 主键天然可推导连续天数，零新表。
- db.py daily_set_submit：返回值补 streak（查 uid 最近 60 天参与日集合，从提交日往前逐日数连续）；幂等语义不变，重复提交返回当前 streak。
- practice.vue：完成页 dsbeat 行 N≥2 追加「🔥 已连续参与 N 天」；daily 分享文案 N≥2 追加「已连续参与 N 天」。
- 生产复验：API 连续两日=2/新 uid=1/隔日断签=1/重复提交幂等 streak 不变；真实作答 UI 显示「已连续参与 2 天」（预植昨日行）、1440/375 无溢出 console 0 error；测试 entries/answer_log 已清理，保护 uid 零 mutation。
- 设计文档：docs/iter/round-3/design-r76-daily-streak.md。

### R75（2026-08-31）：slow_load 上报服务端补 UA 归因
- 取证：7d slow_load 中 nav:90xxx（90.1–90.7s 整点聚簇）分布在多个互不相同的全新匿名 uid，全部旧格式 ref（无阶段/版本戳）——全新 uid 理应拿到最新 bundle 却报旧格式，疑为特定客户端族群（webview/代理/爬虫），现有埋点无法区分；旧 bundle 不会自报新字段，只有服务端入库侧补 UA 才全量生效。
- team.py api_track：event=slow_load 时 ref 追加 `;ua:<UA 压缩串[:80]>`（ref 上限 200→300），其他事件零变化，不加列不动前端。
- 生产复验：curl 带 UA 上报 slow_load 落库含 `;ua:`、heatmap_view 不含；测试事件已清理。
- 待观察：真实 nav:90s 事件带 UA 落库后归因（下一轮观察点）。设计文档：docs/iter/round-3/design-r75-slowload-ua.md。

### R74（2026-08-31）：每日一练榜单昵称化
- 取证：R73 榜单展示脱敏 uid，竞品每日一练/模考榜均展示昵称；本站 PK/小队/模考榜已统一走 pkNickname()（登录昵称→手机尾号→匿名稳定化名），daily_set_submit 是唯一不带 nickname 的成绩通道。
- db.py：_ensure_daily_set PRAGMA 缺列则 ALTER ADD COLUMN nickname；daily_set_submit 首次 INSERT 落 nickname（幂等不改成绩不改昵称）；daily_set_board 展示名=清洗昵称，缺失回退 uid[:6]+***。
- qbank_api.py：submit 透传 nickname（strip[:20]，'null'/'undefined' 视为空）；board docstring 修正为「不入边缘缓存」。
- practice.vue：daily submit 补 nickname: pkNickname()。
- 生产复验：匿名新 uid 真实作答→榜单显示「考友H3WM」稳定化名、无昵称存量行回退脱敏 uid、重复提交幂等（already=true 不覆盖昵称/成绩）、SSR 榜含昵称、榜清空后 SSR 无榜区块、1440/375 无溢出 console 0 error；测试 entries 已清理，保护 uid 无 mutation。
- 设计文档：docs/iter/round-3/design-r74-daily-board-nickname.md。

### R73（2026-08-31）：每日一练今日排行榜
- 取证：竞品每日一练完成后有当日榜（名次+成绩+用时），我们只有 participants/beat_pct 聚合数；daily_set_entries 已有全部字段，复用 PK 榜脱敏形态（uid[:6]+***）。
- db.py：daily_set_board(day)（right DESC, secs ASC, created_at ASC，top20）；daily_set_submit 补 my_rank（比我分高人数+1，同分并列不计用时）。
- qbank_api.py：GET /api/daily_set/board。不入边缘缓存：首轮验证实测 60s TTL 让刚完成的用户看不到自己，且每完成仅一次请求。
- practice.vue：daily 完成态 dsbeat 下新增「今日排行榜」卡（top10+我的名次）；seo.py /tiku/daily/ 页尾静态 top10 榜。
- 生产复验：双新 uid 作答→提交后榜单即含本人、my_rank 正确（同分并列第 1）、SSR 榜渲染、1440/375 无溢出 console 0 error；测试 entries 已清理。本轮 deploy 脚本 ssh 通道再次在容器重建后挂起（同 R65，宿主 load 8–10），已手动补跑预热/CF Pages/hash 校验/回归全过。
- 设计文档：docs/iter/round-3/design-r73-daily-board.md。

### R72（2026-08-31）：每日一练同题挑战分享闭环
- 取证：完成页已有「击败 X%」锚点，但「分享成绩」仍走通用文案（不含全站同题/击败百分比），且分享落点是裸首页——被分享者需自行找入口；/tiku/daily/ CTA 同样只到首页。
- practice.vue：新增 `?daily=1` 深链（onLoad → startDaily，预取/回退全复用）；markDailyDone 记 `_dailyDoneDate`；shareResult 在 daily 完成态改用同题挑战文案（日期+答对数+beat_pct+daily 深链），普通练习文案不变。
- seo.py：/tiku/daily/ CTA href 改 `#/pages/practice/practice?daily=1` 直达开练。
- 生产复验：深链 375/1440 直入当日题组（与 API ids 一致）、完整 10 题作答→剪贴板文案含日期/答对/击败/深链、console 0 error；测试 entries 已清理。
- 设计文档：docs/iter/round-3/design-r72-daily-share.md。

### R71（2026-08-31）：SW 升级通道自愈——存量陈旧壳客户端强制刷新
- 取证：生产 growth_events 66 条 slow_load 中 `;v:` 戳 0 条，最新记录（8-31 03:22）仍为 R61 前旧 ref 格式 → 所有仍在上报慢载的客户端都在跑多天前的旧 bundle；90s 聚簇全部来自这批客户端。R67 页面内自愈只存在于新 bundle，对它们无效；SW 脚本更新检查不走页面缓存，是唯一可触达通道。
- sw.js：CACHE v3→v4（activate 清旧壳）；install 用 `cache:'reload'` 强制取最新壳；activate 后向受控页面 postMessage `kg-sw-updated`。
- main.js：R67 自愈提取为 staleShellHeal()，15s 定时 + SW 消息双触发（防重入不变）。
- 观察指标：新 slow_load 出现 `;v:` 戳或 90s 聚簇消失即证明存量客户端被拉回。
- 设计文档：docs/iter/round-3/design-r71-sw-selfheal.md。

### R70（2026-08-31）：每日一练可发现性——首页外显+预取 + /tiku/daily/ SSR
- 取证：R69 全站同题只有完成页才可感知，首页入口零外显（竞品入口即展示参与人数社交证明）；/tiku 无每日新鲜内容页；R67 版本戳 telemetry 仍无 `;v:` 数据（8-30 15:43 后无新增纯 nav 90s 挂起，继续观察）。
- 首页 home.vue：onShow 非阻塞取 /api/daily_set（边缘缓存），hero 新增「今日全站同题 10 题 · 已有 N 人完成」行，整包写 storage `dailySet` 作当日预取。
- practice.startDaily：storage 缓存 date==中国时区今日直接复用（秒开无 loading），否则走网络，失败回退随机不变。
- SEO：GET /tiku/daily/（当日 10 题列表卡+参与数+CTA，/tiku/daily 301）+ /tiku/ 首页入口 + sitemap-pages 收录；db.cn_day() 提为共享 helper。
- 设计文档：docs/iter/round-3/design-r70-daily-visibility.md。

### R69（2026-08-31）：全站同题每日一练 + 参与数/击败百分比
- 取证：每日一练此前为各用户独立随机抽题，无「全站同题+同题比较」的社交锚点（粉笔/夸克每日一练均为全站同题）；生产主要路由 1440/375 体检无新 P0/P1，R67 版本戳 telemetry 尚无新数据（继续观察）。
- 后端：GET /api/daily_set（uid 无关、按中国时区日期确定性选题：五模块各 2 题共 10 题，md5(day:qid) 最小者优先、真题优先，进程内按日缓存）+ POST /api/daily_set/submit（daily_set_entries (day,uid) 主键，INSERT OR IGNORE 首次成绩幂等，返回 participants/beat_pct/my_right/already）。
- 边缘缓存：/api/daily_set 入 CF 60s TTL 公开 API 清单（uid 无关确定性）。
- 前端 practice.vue：startDaily 改走 /api/daily_set 固定题组（失败回退原随机抽题不阻塞）；markDailyDone 提交成绩，完成页展示「N 人完成 · 击败 X%」（首位完成者/重复提交已记录文案分支）。
- 设计文档：docs/iter/round-3/design-r69-daily-set.md。

### R68（2026-08-31）：分享落地页 /s/* 边缘缓存 + 分享失效态 CTA
- 生产取证：/s/<sid>（获客入口）冷请求 524/125s→50s→0.27s，不在 CF 边缘缓存清单每次穿透共享 origin；share-q/pk-result 失效链接直出裸文本无脱困 CTA。
- [[path]].js：isEdgeCacheable 追加 `/s/*`（页面 TTL 300s，仅缓存 200+HTML，无效 sid 302 不入缓存）；share-q 失效态补「去刷题」reLaunch 首页、pk-result 补「发起我的 PK 对局」。
- 生产复验：/s/ MISS→HIT 头 + HIT 体逐字节一致、302 不缓存、SPA 根路径缓存策略不变；四组失效态 375/1440 CTA 可点可跳、有效分享作答页回归正常。bundle index-DxkZsDSD.js。

### R66（2026-08-31）：坏深链降级态收敛——三页不再卡死/直出 [object Object]
- 生产取证（全参数路由无参直链走查）：contest-report 直出 `[object Object]`（422 detail 对象数组透传）；exam 无参永久「试卷加载中…」（navigateBack 无历史栈静默失败）；discuss 无 qid toast 后永久「加载中…」。
- 修复：api.js 非字符串 detail 回退 `HTTP <status>`（全局）；contest-report 缺参友好空态+「去模考大赛」；exam 缺参/开考失败兜底 reLaunch 卷库；discuss 缺 qid 空态+「去讨论广场」且隐藏输入栏。
- 生产复验：三页 1440/375 友好空态+CTA 回跳全过、0 console error、无溢出；回归 discuss 带 qid、mini 模考正常（冷 origin ~40s 属既有宿主长尾）。bundle index-CCgK5PO2.js。

### R65（2026-08-31）：降级态 UX——海报页错误重试 + 收件箱游客登录引导
- 生产取证：poster 页 summary 双超时直出 `request:fail timeout` 无重试路径；游客访问 inbox 发 /api/comments/inbox 必 401（console error）后落「暂无消息」空态误导。
- poster：timeout/网络类错误映射友好文案 +「重新生成」按钮；inbox：onShow 先判 getToken()，游客不发请求直接渲染登录引导空态（去登录→pkgA/user/login）。
- 生产复验：游客 inbox 0 API 请求 0 console error、登录引导渲染，去登录跳转正常；拦截 summary 实测错误态→重试→海报生成成功；1440/1280/375 无溢出。bundle index-B0M4V3Zf.js。

### R79（2026-08-31）：App 内往期每日一练入口——首页 hero「补练往期 ›」
- 取证：R78 往期能力（?date= API/SSR 归档页/深链）上线后 App 内零入口，站内用户无法发现往期补练；粉笔 App 内有往期日期列表。
- 实现：home.vue hero-ds 行尾追加下划线「补练往期 ›」（完成/未完成态均显示），点击 showActionSheet 列近 7 天日期（昨天/前天标注），选中 → launch({kind:'daily', date})；practice.vue practiceLaunch daily 分支透传 startDaily(launch.date) 复用 R78 往期链路（不提交/不打卡/不计 streak）。埋点 daily_archive_open 入 api_track 白名单（首验曾 400，补白名单后 200）。
- 生产复验：1440 入口可见→sheet 7 日期→选昨天发 /api/daily_set?date=昨天 直入题组、无 4xx、console 0 error；375 入口可见、溢出 0。测试 track 事件已清理，保护 uid 零 mutation。设计文档 docs/iter/round-3/design-r79-daily-archive-entry.md。

### R80（2026-08-31）：时政每日一练往期补练——首页时政卡「往期 ›」
- 取证：/api/shizheng/daily 服务端本就接受任意 ?date=（日期作种子确定性抽题），但前端从未传参，错过当天即永远做不到那期时政题；行测每日一练 R78/R79 已有往期链路，时政侧不对称。
- 实现（纯前端零后端改动）：home.vue 时政卡副标行尾「往期 ›」（click.stop）→ 共用 pickArchiveDay 近 7 天 actionsheet → launch({kind:'shizheng', date})；practice.vue startShizheng(archiveDate) 透传 ?date=，往期置 _szPast，markShizhengDone 往期分支不写 szDaily.days[今天]（今日完成态/回顾不受污染），toast「往期时政补练完成」。埋点复用 daily_archive_open（source 'sz:<date>'）。
- 生产复验：1440 选昨天实测发 /api/shizheng/daily?date=昨日、API 两次同日期返回题组 id 完全一致（确定性）、真实作答 10 题走完往期分支、szDaily 未写入、返回首页时政卡仍「今日更新」；console 0 error、375 溢出 0；测试事件与 answer_log 已清理，保护 uid 零 mutation。设计文档 docs/iter/round-3/design-r80-shizheng-archive.md。
### R81（2026-08-31）：完成页「登录保进度」引导（注册转化漏斗）
- 取证：30 天 94 个匿名活跃 uid、≥20 题重度用户 14 个，但注册用户共 14、30 天 register 事件仅 1；匿名数据全在 localStorage，清缓存/换设备即丢；全站唯一登录入口在「我的」页，练习闭环零引导。另查 slow_load：R75 服务端补 UA 部署后近 22h 零新事件（;ua: 0 属无样本非 bug），继续观察。
- 实现：practice.vue 完成页 duenudge 下追加 .loginnudge 卡（仅 !getAuthUser() 且累计答题 ≥30 且未关闭）：「已累计刷 N 题 · 登录保进度 / 错题本、做题记录云同步」+「去登录 ›」跳 /pkgA/user/login + ✕ 永久关闭（storage loginNudgeDismissed）；埋点 login_nudge_show/login_nudge_click 入 team.py api_track 白名单。承诺真实：login.vue mergeAnon 已有匿名数据合并链路。
- 设计文档 docs/iter/round-3/design-r81-login-nudge.md。
- 同轮 P0 生产事故与根因修复：验证期间 /api/questions（无 module，首页裸直达路径）反复 125s/524，最终 origin 全挂（uvicorn 收 SIGTERM 后 graceful shutdown 被 600s 卡死请求拖住、拒绝新连接，需 docker restart 恢复）。根因 db.py 抽题池 SWR 重建 _pick_rebuild 先 pop 缓存再重扫：每 600s TTL 到期打开一个「无缓存窗口」，窗口内所有并发请求各自全表扫描（无 module 键约 11.3 万行，共享宿主内存紧张时单扫可达分钟级）→ 惊群护航 → 524/宕机。修复：重建改为「扫完再原子替换」（旧池全程可用）+ 冷 miss 加 _pick_build_lock 单线程构建（并发请求等锁后直接吃缓存）。修复后生产 uid 裸直达实测 0.4–0.9s。

### R82（2026-08-31）：slow_load 头指纹——归因「无 UA 上报族群」
- 取证：R75 补 UA 上线后近 7 天 48 条真实 slow_load 全部无 ;ua:（含保护 uid 自己 1 条），90s 整点聚簇仍在；同链路三组对照探针（curl 带 UA / Chrome fetch / sendBeacon）全部落库含 ;ua:，curl 去 UA 则无——结论：真实上报到达 origin 时 User-Agent 头为空，追加逻辑本身有效；slow_load 仅 api_track 一条 insert 路径、Caddy 直连 /api/track 访问 0（全量走 CF）。
- 实现：api_track slow_load 入库侧恒追加 ;ua:（空写 -，消除旧格式歧义）+ ;hs: 头指纹（f=sec-fetch-mode/c=sec-ch-ua/o=origin/r=referer/l=accept-language 存在位，浏览器强制携带 sec-fetch-*，可分辨「真浏览器 UA 被剥」vs「非浏览器客户端」）。其他事件零变化、不动前端、不加列。
- 生产实测：无 UA curl → ;ua:-;hs:-；带 UA curl → ;hs:-；Chrome fetch/beacon → ;hs:fcorl；heatmap_view ref 零变化。测试事件已清理、保护 uid 零 mutation。
- 设计文档 docs/iter/round-3/design-r82-slowload-header-fingerprint.md。观察项：下一批真实 slow_load 的 ;hs: 分布。

### R83（2026-08-31）：每日一练成绩可靠投递——pending 落地 + 首页幂等补投
- 取证：三个真实匿名 uid answer_log 各 10 条且题目 id 顺序与当日题组逐一一致（确实完整做完），但 daily_set_entries 无对应成绩；真实浏览器流程实测完成路径确实发出 POST /api/daily_set/submit，origin 侧该 POST 处理长尾达 95.7s（同刻宿主 load 23+/swap 2.6GB/recruit-worker-heavy 99% CPU）——一次性 fire-and-forget POST 在机器级长尾+用户关页下丢单。
- 实现（纯前端）：api.js submitDailySet 先写 storage dailyPendingSubmit 再 POST，成功清 pending 并落 dailyDone:<uid>；失败/超时保留；home.vue onShow flushDailySubmit() 静默补投（pending.date≠中国时区今天直接丢弃；服务端 (day,uid) 主键幂等重试安全）。
- 生产复验（bundle index-B5E0ZuNG.js）：正常链路新 uid 落库恰一行；丢单链路拦截 submit abort → pending 保留 → 回首页自动补投 POST 200 → pending 清除 + hero「已完成 答对 2/10 · 第 1 名」；跨日 pending 丢弃零请求；重复提交 already=true 不覆盖；跨日 POST 400；375 溢出 0、console 0 error；测试数据（daily_set_entries 4 行/answer_log 43/growth_events 5）已清理，保护 uid 零 mutation。设计文档 docs/iter/round-3/r83-daily-submit-reliability.md。PR #259。
- 同轮 ops 事件：部署后验证期 origin 全端点 524/125s+，uvicorn 主进程 State D（disk sleep），宿主 swap 3GB/si-so 数千/blocked 9–15，为宿主级内存-IO 颠簸（recruit-worker-heavy 常驻 99%），docker restart 恢复（daily_set 2.0s/announcement 0.4s）。非本仓代码问题，主机资源隔离待老板决策（同 R64）。

### R84（2026-08-31）：origin 假死自愈 watchdog——/api/health + healthcheck + autoheal
- 取证：origin「进程在、请求全挂」假死已复发 3 次（R64/R81/R83 实录：全端点 524/125s+、uvicorn State D、swap ~3GB），每次靠人工 docker restart，无人值守即全站不可用。R82 观察项：截至本轮无新 slow_load 样本（最新一条早于 R82 部署），;hs: 分布继续观察。
- 实现：main.py 新增 GET /api/health（SELECT 1 走完整链路，区分假死）；compose kaogong 加 healthcheck（60s/25s/retries 5/start 180s，需持续 ≥5min 失败才判 unhealthy 防误杀）+ autoheal=true 标签 + willfarrell/autoheal sidecar（仅监管带标签容器）。
- 生产故障演练：宿主 kill -STOP uvicorn 主 PID（容器内 PID1 收不到 SIGSTOP，须从宿主发）→ health 挂起 → 6min 后 autoheal 判 unhealthy 发起重启 → 容器重启完成 healthy、/api/health 200，全程零人工。注意 autoheal 日志会报 Restarting failed（API 客户端等待超时）但 docker 实际完成重启。设计文档 docs/iter/round-3/r84-origin-watchdog.md。PR #260。
- 合并注意：#223–#259 又被链式合并未入 main（main 止于 R45b #222），已开 rollup PR #261（分支指向 R83 链尾 4b7b171），只需合并 #261 即收口 R46–R83；#260 合并后同理需收口。

### R85（2026-08-31）：origin 侧可观测性收口——kaogong-origin 访问日志 + 代理层 UA/IP 透传
- 取证：全量真实流量走 kaogong-origin.zalize.com，但该 Caddy 块无 access log（kaogong.zalize.com 块日志最后一条 ≈08-25，CF Pages 迁移后无流量），R75/R82「无 UA 之谜」期间 origin 侧零 UA/IP 证据；CF functions 回源虽复制原始头，但 CF-Connecting-IP 出网被重写、UA 是否保留无一手证据。
- 实现：functions 回源请求附加 X-Kg-Ip（CF-Connecting-IP）/X-Kg-Ua（原始 UA）；api_track slow_load 的 ;ua: 空则回退 X-Kg-Ua 并标 ;uav:f；宿主 Caddyfile kaogong-origin 块补 JSON access log（50MiB/14 份/336h，运维步骤入 deploy/README.md，备份 /etc/caddy/Caddyfile.bak-r85）。
- 生产验收：无 UA 探针→;ua:-、带 UA 探针→;ua:R85-Probe/1.0（经函数代理 UA 直达，未触发回退）、heatmap_view 零变化；origin access log 落盘且含 X-Kg-Ip/X-Kg-Ua（已见真实爬虫 AwarioBot+真实 IP）。untested：;uav:f 回退分支（无法在生产制造「UA 在边缘→origin 一跳丢失」）。测试事件已清理，保护 uid 零 mutation。设计文档 docs/iter/round-3/r85-origin-observability.md。
- 同轮清理：R83/R84 验证残留 answer_log 80 行（12 个机器速答 uid，题序与当日每日一练一致、9–15s 完成）+ growth_events 1 行已删除。

### R86（2026-08-31）：origin 域收口——仅接受 CF 函数代理流量，直连爬虫 403
- 取证（基于 R85 新落盘 origin 日志）：启用后 ~1h 145 条请求中 ~95 条（66%）为绕过 CF 函数的直连爬虫（AwarioBot 73 + SemrushBot 19），全打 /tiku/q/* SSR（单条实测最高 4.7s、/tiku/ 直连 6.0s），在 2GB 共享宿主上完全绕过 R45/R56/R68 边缘缓存，属无谓 IO/CPU 挤占；X-Robots-Tag noindex 挡不住第三方持续抓取。
- 实现：functions 回源附加共享密钥头 X-Kg-Edge（值在 Pages env KG_EDGE_KEY，wrangler secret 不入仓库）；宿主 Caddy kaogong-origin 块对无/错头请求 respond 403（备份 Caddyfile.bak-r86），access log format filter 删除该头防泄漏（启用前的历史泄漏行已离线清洗）。上线顺序：先函数带头→日志确认到达→再启 403，防自伤。
- 生产验收：直连 origin /tiku/、/api/stats → 403；主域 /、/tiku/、/tiku/q/*、/api/stats、POST /api/track、/api/health 全 200；后续日志实证爬虫直连均 403、post-reload 行零密钥泄漏。测试事件已清理。设计文档 docs/iter/round-3/r86-origin-lockdown.md。
- 边界：容器 healthcheck（容器内 localhost）与 deploy 预热（走主域）不受影响；DNS 回滚路径不走 origin 块。密钥轮换步骤见 deploy/README.md。

### R87（2026-09-01）：sitemap 题目分片冷路径收敛——覆盖索引 + SQL 切片 + 边缘缓存
- 取证：/sitemap-questions-8.xml 生产冷请求实测 71.9s（origin 日志此前另录 51.7s，两次独立复现）；根因 seo.py 每请求全量拉 15 万+行（SELECT 不含索引覆盖的 updated_at → 逐行回主表随机读）再 Python 切片，且 sitemap 路由不在边缘缓存清单，搜索引擎每次抓取都穿透 2GB 共享宿主冷路径。
- 实现：db.py 增覆盖索引 idx_q_sitemap(disabled,id,updated_at)；sitemap_questions 改 LIMIT/OFFSET 只取本分片（响应逐字节不变，越界仍 404）；functions isEdgeCacheable 放行 /sitemap* 与 /robots.txt（TTL 300s），并修 content-type 缓存守卫（原只认 text/html，XML 永不入缓存）放行 xml/text-plain。
- 生产验收：EXPLAIN 确认 COVERING INDEX idx_q_sitemap；shard8 冷 71.9s→16s（宿主 IO 下限）、MISS→HIT 0.1s、前后逐字节一致；shard 0/999 → 404；/tiku、/api/stats 回归 200。R86 复验：post-enable origin 日志零非边缘穿透（爬虫已被 403 挡停）。设计文档 docs/iter/round-3/r87-sitemap-cold-path.md。
- 同轮观察：首条 R82 全格式 slow_load 落库，ua 含「ShapBot/0.1.0」、hs:fcorl（headless 浏览器爬虫，nav:16s 主因 wd-icon chunk 13s），非真实用户问题，不立项。

### R88（2026-09-01）：无获客价值爬虫边缘拦截——robots 禁抓组 + CF 函数 UA 403
- 取证：R85 origin 日志显示经主域（CF 函数代理）到达 origin 的请求中 AwarioBot 496 + SemrushBot 132 = 636 条 vs 真人仅 44 条；爬虫全打 /tiku/q/<id> SSR，URL 各异使 R45 边缘缓存无效，每条穿透共享宿主渲染（实测 ~16 条/分钟）。同窗口 Googlebot/Bingbot/Baiduspider 为 0（不受本轮影响）。
- 实现：seo.py robots.txt 对 AwarioBot/SemrushBot/AhrefsBot/MJ12bot/DotBot/PetalBot 单独 Disallow: /（礼貌层）；functions [[path]].js 对 UA 命中名单直接 403 不回源（robots.txt 放行以便其读到禁抓声明）。
- 生产验收：模拟 AwarioBot/SemrushBot UA /tiku/q/* → 403、robots.txt 200；Googlebot/普通浏览器全路径 200；部署传播后 origin 日志爬虫到达从 ~16 条/分钟降为最近 5 分钟 0 条。设计文档 docs/iter/round-3/r88-edge-bot-block.md。
- 边界：robots.txt 被 CF zone 层 HTTP 缓存（cf-cache-status HIT，.txt 默认 TTL，无 cache-control 时约 2h），新禁抓组对外生效有最长 ~2h 延迟（带 query 已实证新内容）；本会话 CLOUDFLARE_API_TOKEN 无 zone purge 权限无法主动清除。

### R89（2026-09-01）：IndexNow 主动提交——打通半成品收录通道
- 取证：R85/R88 origin 日志观察窗内 Googlebot/Bingbot/Baiduspider 到达为 0；Bing site: 收录仅个位数；仓库只有 /indexnow-key.txt 密钥端点（生产 200、INDEXNOW_KEY 已配），全库无任何向 api.indexnow.org 提交 URL 的代码——通道只建了验证端从未推送。
- 实现：seo.py 新增守护线程（仅 INDEXNOW_KEY 配置时启动，本地/开发零影响），seo_meta(key,value) 表存水位 indexnow_last_qid；首轮先提交核心页（/、/tiku/、/tiku/daily/、/tiku/discuss/），之后每 6h 取 id>水位 的活跃题，每 POST ≤10000 条、每轮 ≤2 POST（≤2 万 URL/轮），2xx 才推进水位（HTTP 4xx/5xx/网络错误不推进，下轮重试同批）。
- 本地验证：mock 端点实测核心页+2×10000 批、断点续传 1429 条、500 失败水位不动、恢复后续推；ruff 通过。
- 生产验收：部署后首轮实录 api.indexnow.org 返回 200×3（核心 4 条 + 10000×2），水位落库 158705；/indexnow-key.txt 生产 200 可供引擎验证。设计文档 docs/iter/round-3/r89-indexnow-submit.md。
- 边界：IndexNow 覆盖 Bing/Yandex/Seznam 等联盟引擎，Google 不参与（需 Search Console 站点验证，属独立待办）；提交≠必然收录，需后续观察 origin 日志 bingbot 到达与 site: 收录量变化。

### R90（2026-08-31）：读接口最后一跳兜底——GET 双超时后回退本机最近成功快照
- 取证：近 3 天 slow_load 49 条，真实用户请求级长尾样本 daily_plan:45s、mistakes:33s/24s、categories:21s、events:15s、questions:9–13.5s、history:8.7s——均为 uid 专属/随机端点，无法进边缘缓存，R63 双超时（12s+20s）耗尽后调用方只能拿错误态/空态。根因仍是共享宿主竞争（迁独立主机待老板决策），应用侧继续收窄受害面。
- 实现：api.js request() GET 默认路径成功后快照落 uni storage（apiSnap:<path>，含 query/uid 天然隔离；>64KB 不缓存、LRU 40 条、24h 过期；/api/auth//api/admin 排除）；双超时/网络错误后有快照则 resolve 快照并上报 stale_fallback 埋点（track 白名单同步补充）；HTTP 业务错误（401/422/500）照旧透出不回退。
- 生产验收：CDP 拦截 home_bundle abort → 页面渲染快照数据（今日计划/打卡等全出）、stale_fallback 落库 ref 正确；HTTP 500 拦截 → 不回退（走 R62 原有 fallback）；无快照新 uid 行为与现状一致。测试事件已清理（含 R89 遗留 r90probe），保护 uid 零 mutation。设计文档 docs/iter/round-3/r90-stale-fallback.md。
- 边界：快照最长陈旧 24h，仅在「否则必然错误态」时才使用；POST/显式 timeout 请求不参与。

### R91（2026-08-29）：boot 版本心跳——活跃客户端版本分布可度量
- 取证：daily_set_entries 全表 0 行（唯一 submit 为部署探针已清理），但近 2 天 answer_log 有 17 个真实 uid、160+ 条作答——产品有人用而每日一练零参与；无法归因是「存量客户端困在旧 bundle 根本没有入口」还是「看到不想点」：slow_load 只在慢载时上报（幸存者偏差），无任何事件能做「活跃客户端 × 版本」分母。同轮复验：R89 IndexNow 提交后 YandexBot 首次到达（~240 条/40min，IndexNow 联盟引擎实证生效）+ Googlebot 1 条；R88 爬虫拦截自 R90 CF 部署起 AwarioBot/SemrushBot 到达归零（部署前 1h 仍有 ~700 条经主域到达，系 Pages 函数版本传播滞后）。
- 实现：main.js load 后 6s 上报 boot 事件（ref=v:<主chunk hash>;sw:<0/1>），localStorage kg_boot_day 按中国时区日期节流每客户端每日 ≤1 条；team.py track 白名单补 boot。零 UI/零新接口。
- 生产验收：CDP 实测新 uid 首载发 boot（v:D7XHtth2;sw:1 落库）、同日二次刷新 0 条；测试事件已清理。设计文档 docs/iter/round-3/r91-boot-heartbeat.md。
- 消费方式（下一轮）：boot 的 v 分布 → R67/R71 自愈链路对存量客户端的真实效果；boot 日活 uid 数 → 每日一练漏斗分母。

### R92（2026-08-29）：后端版本可校验——/api/health 暴露 BUILD_REV + 部署脚本 rev 后置校验
- 取证：近 3 天 slow_load 49 条中仅本轮容器重建后的 1 条带 R82 服务端 `;ua:/;hs:` 追加，其余 48 条（含 14h 前真实用户样本）全部缺失；当前容器内已确认含 R82/R91 代码——即历史窗口内生产后端曾长期落后于「已部署」代码而无人察觉。归因：deploy_h5.sh 只校验前端 bundle hash，后端无任何版本证据；且 R65/R73/R91/R92 四轮脚本均在 step 4 容器重建后 ssh 通道挂起（宿主 load ~10），人工补跑时容器是否真用新代码一直靠推断。
- 实现：deploy 脚本 rsync 前写 backend/BUILD_REV（短 SHA，backend 有未提交改动加 -dirty，.gitignore 排除）；main.py /api/health 响应补 rev 字段（读不到回退 "dev"，healthcheck 行为不变）；脚本新增 step 4a 线上 rev != 本机即 FAIL。
- 生产验收：部署后 /api/health 返回 {"ok":true,"rev":"99a8e1c-dirty"} 与本机一致；容器 healthy、关键路由全 200、/api/questions 冷 27.8s→热 0.4s（重建后冷池，R81 已知行为）。设计文档 docs/iter/round-3/r92-backend-rev-check.md。
- 边界：rev 只证明容器代码=本次 rsync 代码；历史缺失的 slow_load 归因不可回填；本轮 deploy 脚本 step 4 ssh 挂起复现（第 4 次），已手动补跑 4a/4b/5/6 等价校验。

### R93（2026-08-31）：deploy 脚本 step 4 ssh 挂起根治——远端 compose 后台化 + StartedAt/rev 轮询收敛
- 取证：R65/R73/R91/R92 四轮部署均在 step 4 前台执行远端 `docker compose up -d --build` 后 ssh 通道长时间不返回（宿主 load ~6–12），而独立 ssh 检查显示 compose 实际早已完成、容器 healthy——挂起在通道层非部署层，每轮都被迫人工补跑后续步骤。
- 实现：deploy_h5.sh ①全部 ssh 加 ConnectTimeout=15/ServerAliveInterval=15/ServerAliveCountMax=4；②step 4 改为远端 `nohup docker compose up -d --build >/tmp/kg-compose.log &` 后台化立即返回，随后每 10s 轮询容器 StartedAt 变化 + /api/health rev==本机 BUILD_REV，双条件收敛才继续，600s 未收敛打印 compose 日志尾并 FAIL；③step 5 的 home chunk 抓取补 `--compressed` 且 grep 无匹配不再触发 set -e 静默退出（本轮实测首跑在此处无输出退出，为历史「脚本没走完」的另一潜在因子）。
- 生产验收：完整脚本 `--skip-build` 自然跑通两次，第二次全程 exit 0——step 4 一次 10s 轮询即收敛（poll 输出 started 变化+rev=9bf1193）、4a rev 一致、4b 预热、4c CF Pages 部署、5/6 bundle hash+七编码变体+接口回归全 200，无任何人工补跑。/api/health 实返 {"ok":true,"rev":"9bf1193"}。设计文档 docs/iter/round-3/r93-deploy-hang-fix.md。
- 边界：共享 2GB 宿主高负载根因未变（迁独立主机/限 recruit-* 资源仍待老板决策）；600s 轮询上限基于历史 compose 实际完成时间（<2min）留 5 倍余量，宿主极端恶化时仍可能 FAIL（此时 FAIL 是正确行为，日志尾可诊断）。

### R94（2026-08-31）：/api/daily_set 冷路径预热——每日一练首跳 27s→0.3s
- 取证：R92/R93 部署后实测 `GET /api/daily_set` 冷请求 27.05s/200——`daily_set_ids` 进程内按日缓存只在首个请求填充（5 模块全量 id 扫描+Python md5 排序），容器每次重建/autoheal 重启后首个真实用户直面该长尾，且边缘缓存 TTL 仅 60s。同轮澄清一批历史谜团：R91 boot=0、login_nudge=0、stale_fallback=0、daily_set_entries=0 全部（或部分）由「生产后端长期跑旧代码、新事件被旧白名单 400 拒绝/新接口 404」解释——旧格式 slow_load（无 ;ua:）持续到 08-30 深夜，与 R92 部署时间线吻合；本轮起后端版本可信，参与漏斗数据才开始有意义，勿再拿历史 0 行下产品结论。
- 实现：main.py `_warmup`（300s 周期）追加 `db.daily_set_ids(cn_day())` + 明日日期预热（选题 md5 确定性，预热明日=明日实际结果，跨日 00:00 首个用户也不吃冷扫描）。两行改动，零接口/依赖变化。
- 生产验收：容器重建 1min 内 cache-busted 直连 origin 三连发 0.22–0.36s（对照改动前同条件 27s）；rev=b8860d9-dirty 一致、容器 healthy、部署脚本（R93 版）再次全程自然跑通 exit 0。设计文档 docs/iter/round-3/r94-daily-set-warmup.md。
- 边界：真实 00:00 中国时区跨日边界未实测（代码路径与今日预热相同）；warmup 极端负载下变慢只影响后台线程。观察项：boot/daily_set_entries 自本轮起的真实增长曲线（下一轮取证输入）。

### R95（2026-08-31）：边缘 stale-if-error——部署/假死窗口可缓存 GET 不再对外 502
- 取证：origin 日志 24h 实录 502×85，按 10 分钟聚簇与 R92/R93/R94 三次部署容器重建窗口完全吻合（每窗 1–2 分钟），受害含 YandexBot（正在收录）与真实浏览器 UA；现状边缘缓存副本 TTL 一到即不可用，重建窗口无兜底。
- 实现：CF 函数副本长存 24h（Cache-Control=86400）+ 自定义 X-Kg-Cached-At 判逻辑新鲜度——TTL 内 HIT（对外 Cache-Control 仍 60/300），过期回源，回源 5xx/fetch 异常回退陈旧副本标 X-Edge-Cache:STALE；uid API/POST/MISS/安全头/爬虫 403 全不动。仅改 deploy/cf-pages/functions/[[path]].js。
- 生产验收：低峰受控演练 docker stop 容器 → 过期 /api/announcement 与 /api/question_counts 均 200+STALE，uid /api/home_bundle 照旧 502（R90 客户端快照兜底）；docker start 后 healthy 恢复。正常路径 MISS→HIT 语义与 R56 一致。设计文档 docs/iter/round-3/r95-edge-stale-if-error.md。
- 边界：仅保护「曾被缓存过」的 URL（重建窗口首现 URL 仍 502）；STALE 最长陈旧 24h 仅在 origin 5xx 时使用。同轮复核：R88 爬虫拦截仍有效（Awario/Semrush 实测 403，日志中 07–08 时段的到达为当时窗口，09 时起仅 robots.txt）。

### R96（2026-08-31）：部署前边缘缓存预热——收窄 R95「无副本」缺口 + 埋点零行归因收口
- 取证：R95 只保护「曾被缓存过」的 URL，部署窗口首现可缓存 URL 仍 502，而 502 聚簇主因恰是部署窗口；入口级可缓存 URL 有限可穷举。同轮实证收口埋点谜团：boot 埋点链路本身有效（CDP 真实浏览器加载 6s 后 POST /api/track boot 200 落库，探针已清理），boot=0/daily_set_entries=0 只是「后端可信窗口（R92 部署后）内没有真实浏览器用户到访」——answer_log 48h 17 个 uid 的作答时间全部早于可信窗口。产品结论：当前真实 DAU 极小，增长/收录是主瓶颈而非功能面。另：growth_events.created_at 是 epoch 浮点，SQL 里用 datetime('now') 比较恒 false，取证必须用 epoch（本轮踩坑）。
- 实现：deploy_h5.sh 新增 step 3b——rsync 后、容器重建前对入口级可缓存 URL（/tiku/ 三页、robots/sitemap、允许清单 API 含 submodules?module=×5）逐个 GET 刷新副本，重建窗口内 stale-if-error 必有副本可退；失败仅 WARN 不阻塞。设计文档 docs/iter/round-3/r96-deploy-edge-prime.md。
- 生产验收：完整部署实跑 exit 0，step 3b 首跑暴露 submodules 无参 422（已改逐模块）与 /tiku/ 冷 origin 000（WARN 不阻塞设计生效），修正后清单实跑全 200。
- 边界：/tiku/q/* 15 万题页不预热，靠自然流量沉淀副本；autoheal 重启窗口靠 ≤24h 日常副本兜底。

### R97（2026-08-31）：/tiku SEO 页族补 Open Graph 标签 + /tiku/q/{id}/ 尾斜杠 301
- 取证：origin 日志实证分发通道现状（YandexBot 958、Googlebot 1、bingbot/Baiduspider/Sogou/360=0），社交/IM 分享是唯一可自建的第二通道；而 /tiku 全页族（_page() 模板）无任何 og: 标签（首页 SPA 壳有、/s/* R68 有），分享出去无卡片；/tiku/q/{id}/ 带尾斜杠被 /{module}/{submodule}/ 路由吞掉 404「模块不存在」。
- 实现：_page() 统一注入 og:type/site_name/title/description/url/image 六标签（og:url 复用 canonical）；新增 GET /q/{qid}/ → 301 无斜杠。仅改 backend/app/seo.py。设计文档 docs/iter/round-3/r97-seo-og-tags.md。
- 资源申请（owner 一次性识别，不阻塞）：① Baidu/Bing/Sogou/360 站长平台账号验证（收录通道）；② 微信公众号 JS-SDK（微信内分享卡片）。到位前用 og 标签+IndexNow 降级先行。

### R98（2026-08-31）：Web Push 每日一练提醒（关闭页面也可达）
- 取证：现有「学习提醒」是页面内 Notification 轮询（页面一关即失效，reminders.vue 自我声明）；真实 DAU 极小、召回无通道，Web Push 是唯一可自建的离线触达。PWA 基建已就绪（manifest R54/安装入口 R57/sw v4 R71）。
- 实现：backend/app/push_api.py（pywebpush + VAPID，GET /api/push/pubkey、POST subscribe/unsubscribe，表 push_subs；每日 08:00 中国时区定推「今日全站同题」深链 /?daily=1，410/404 清失效订阅，已完成今日一练的 uid 跳过，seo_meta push_last_day 幂等）；sw.js 加 push/notificationclick；reminders.vue 加「每日一练离线推送」开关（仅 PushManager+pubkey 可用时渲染）。VAPID 密钥在生产 deploy/.env（KG_VAPID_PRIVATE/PUBLIC，不入仓库），compose 已透传。未配置 VAPID 的环境接口降级、线程不启动。
- 验收：本地+生产双 E2E 全过（UI 开关订阅→落库→容器内实发→真实 FCM→通知弹出 payload 正确→UI 关闭双端退订）；测试订阅已清理。设计文档 docs/iter/round-3/r98-web-push.md。
- 边界：iOS Safari 需先安装到主屏（16.4+）；微信内置浏览器不支持（开关不渲染）；通知点击跳转 /?daily=1 复用 R72 深链。

### R99（2026-08-31）：每日一练完成页「开启推送」引导卡——R98 通道接上转化时机
- 取证：R98 推送入口埋在「我的 → 学习提醒」二级页，刚完成每日一练的用户（转化意愿最高时机）看不到任何提醒引导；完成页已有 streak/排行榜锚点可复用。
- 实现：practice.vue 完成页（当日一练提交成功后，H5-only）追加轻量引导卡——渲染条件全满足才显示（PushManager 可用、permission 未 denied、/api/push/pubkey 非空、当前无订阅、未被 ✕ 永久关闭 localStorage pushNudgeOff）；streak≥2 文案「别断了连续 N 天」；点开启走权限→subscribe→POST /api/push/subscribe（成功态「已开启每日一练提醒 ✓」）；埋点 push_nudge_show/ok 入 team.py 白名单。往期补练/普通练习不显示。设计文档 docs/iter/round-3/r99-push-nudge.md。
- 生产验收：375+1440 双视口真实完成 10 题 E2E 全过（卡片显示→点开启→FCM 订阅创建→subscribe 200→成功态渲染→push_nudge_show/ok 落库；✕ 关闭即隐藏且 pushNudgeOff 持久化，重看不再显示；溢出 0、console 0 error）；测试订阅/成绩/事件已清理、保护 uid 零 mutation。
- 边界：已订阅用户不显示（代码守卫，未单独生产复验）；本轮宿主持续高负载（swap 颠簸+外部 pip/postgres 抢占），验证期间 origin 多次 502/524 由 autoheal 自愈——共享宿主根治仍待老板决策。
- 观察项：push_nudge_show→ok 转化率、push_subs 真实增长、明早 08:00 定推实际送达。

### R100（2026-08-31）：练习中场静默预取下一组——「再来一组」零等待
- 取证：/api/questions 冷径长尾生产复现 17.2s/33.2s（宿主外部 IO 挤占时随机行读 D 态等待，R64/R81 只预热了 id 扫描）；RUM 最新 bundle 用户仍报 questions:10–13.5s；R70 预取只覆盖首页→首组，「再来一组」必然裸等网络。另证伪一条假设：kaogong 容器内存稳定 21–116MB，宿主 swap 颠簸确为外部进程（pip/postgres）所致，非我方泄漏。
- 实现：practice.vue `next()` 答到倒数第 3 题触发 `prefetchNextGroup()`，复用 prefetchPack/takePrefetch（键 module/limit/uid 与 home 预取一致）；仅普通练习（_plainStart 守卫，排除 submodule/adaptive/real/tag3/ziliao/daily/shizheng/bei）；过滤本组已现题 id；失败静默、每组一次。纯前端零后端。
- 生产验收：1440+375 新 uid 真实 10 题——第 7 题预取请求+pack 落地，「再来一组」0 网络请求即开新组；溢出 0、console 0 error；测试数据已清理、保护 uid 零 mutation。设计文档 docs/iter/round-3/r100-midsession-prefetch.md。
- 边界：daily/shizheng/bei 不触发为代码守卫未单独复验；答完不重试时浪费一次 10 行读。

### R107（2026-08-31）：专项练习首跳预取——模块选题面板打开即后台预取
- 取证：全新 uid 首次专项练习实测「出题中…」裸等约 19–20s（2GB 共享宿主页缓存换出的冷路径），RUM 持续录得 questions:9–13.5s；既有预取只覆盖首页 onShow lastModule（新用户为空）与练习中场下一组（R100），最常见入口「模块卡→二级题型面板→全部随机」必然裸等网络。
- 实现：home.vue prefetchNext 参数化为 prefetchModule(module)，openModule 打开面板成功后即预取该模块「全部随机」题包；守卫沿用（realMode/ziliao/同键新鲜 pack 跳过），practice 端 takePrefetch 精确命中零等待。零后端。设计文档 docs/iter/round-3/r107-module-launch-prefetch.md。

### R106（2026-08-31）：生产测试 uid 数据全库清理 + 可复用脚本
- 取证：全库审计发现 85 个历轮验证遗留测试 uid（r18-a/qa-r31-*/r83dailytest*/uR42tmp 机器速答爆发等）跨 12 表 646 行，其中 30 条机器速答混入 48h 活跃统计污染取证。
- 实现：scripts/clean_test_data.py（命名模式+机器速答双标准、保护 uid/已登录豁免、26 表覆盖、默认 dry-run、--apply 才删除）；生产 apply 清理 646 行、复清 0 行、保护 uid umteojq4sltdhorhm 前后行数不变。每轮验证后应复跑一次清理测试数据。设计文档 docs/iter/round-3/r106-test-data-cleanup.md。

### R105（2026-08-31）：推送引导卡曝光盲区修复
- 取证：push_subscriptions 全表 0 行、push_nudge_show 7 天 0 条；真实作答 uid（5–13/日）全部走普通专项练习完成页，而 R99 引导卡 initPushNudge 只挂在每日一练提交回调（daily_set_entries 全表 0 行）——引导卡从未被真实用户看到。
- 实现：practice.vue submitResult() 末尾（H5、≥5 题）补调 initPushNudge()，复用 R99 全部守卫（已订阅/denied/✕ 永久关闭/无公钥/无 SW 均静默）。零后端。设计文档 docs/iter/round-3/r105-push-nudge-exposure.md。

### R104（2026-08-31）：非 SW 客户端可观测性盲区修复
- 取证：近 3 天 14 个真实活跃 uid（heatmap_view）0 个上报过 boot；boot/RUM/hb-gap/陈旧壳自愈全部包在 `'serviceWorker' in navigator` 守卫内，无 SW 的国内 App 内置 webview 用户全程不可见、也无壳自愈。另清理本机遗留 28 个标签页造成的自噪声（uid umth5q5ax687m0vfh 等 19 条 growth_events，含 9 条 questions:10s slow_load——此前 RUM 长尾图景被自流量污染）。
- 实现：main.js SW 守卫只留注册与更新校验；runningHash/boot/RUM/hb-gap/staleShellHeal 移入独立 `window load` 块，SW 引用全部判空。设计文档 docs/iter/round-3/r104-nonsw-telemetry.md。

### R103（2026-08-31）：每日一练开练漏斗埋点 daily_open + 来源归因
- 取证：daily_set_entries 全表 0 行（R69 上线至今零真实提交），growth_events 无任何开练事件——漏斗只有终点没有起点；明日 08:00 R98 首推，无来源归因无法度量推送转化。
- 实现：practice.vue startDaily(archiveDate, src) 统一上报 daily_open（source=home/link/push/seo/share，往期 ref=archive:<date>）；push payload、SSR CTA、分享文案深链分别带 src=push/seo/share；main.js 根查询归一化透传 src；track 白名单补 daily_open。设计文档 docs/iter/round-3/r103-daily-funnel.md。
- 生产验收：/?daily=1&src=push 深链→daily_open source=push 落库；首页 CTA→source=home 落库；SSR CTA 实测含 src=seo；console 0 error；测试事件已清理。

### R102（2026-08-31）：/?daily=1 推送深链失效修复
- 取证：生产实测 /?daily=1 落首页 #/ 未进每日一练（uni h5 router 只识别 hash 路由，根路径 query 从未被处理），而 R98 推送 payload url 恰为 /?daily=1——明日 08:00 首推点击落地全部失效。hash 形式 /#/pages/practice/practice?daily=1 实测正常直入。
- 实现：双保险——push_api.py payload url 改 hash 深链（发送时生成，旧 bundle 也受益）+ main.js 启动前归一化（search 含 daily=1 且无实质 hash 时 location.replace 为练习页 hash 深链，透传 date）。设计文档 docs/iter/round-3/r102-daily-deeplink-fix.md。
- 生产验收：375 /?daily=1 直入今日题组、&date=昨日直入往期题组（daily_set?date= 请求实证）、1440 直入+答题卡侧栏正常、首页无回归；溢出 0、console 0 error。

### R108（2026-08-31）：首页专项练习入口去阻塞——counts 快照兜底 + 静态模块回退
- 取证：原候选「首页到期复习数量不一致」被证伪（/api/review total=1 与 home_bundle.plan.due_mistakes=1 一致、duebar/任务行均显示）；真实问题是 /api/question_counts 生产长尾（高负载实录 524/125s、200/39.8s）时首页模块卡整体不渲染，专项练习入口不可用。
- 实现：home.vue——成功 counts 落 countsSnap，onShow 先读快照预填；无快照且接口失败时用 NAMES 静态模块列表（n=0 隐藏进度、副文案「题库加载中…」）回退渲染；保留 3s×20 后台重试，真实数据原位替换。零后端/零 DB/零边缘改动。设计文档 docs/iter/round-3/r108-home-module-entry-resilience.md。
- 生产验收（PR #286）：1440+375 拦截 question_counts——5 模块卡仍渲染、面板可开、可直入练习；放行后共 N 题原位刷新；溢出 0、console 0 error（仅被拦截请求本身）。测试 uid 4 个 13 行已清理、保护 uid 零 mutation。

### R101（2026-08-31）：首载静态启动屏——消除慢网络首访白屏
- 取证：RUM 实录真实用户首载 nav:16s/dom:7.5s/tx:10.6s，index.html #app 为空、Vue 挂载前全程白屏（历史 60/90s 聚簇同理）；明日 08:00 推送深链 /?daily=1 也走该路径。
- 实现：index.html #app 内静态启动屏（logo+错题邦+副标题+CSS spinner，纯内联零请求），prefers-color-scheme 深色适配，Vue mount 整树替换无需清理。设计文档 docs/iter/round-3/r101-boot-splash.md。
- 生产验收：1440+375 新 context 60KB/s 节流实测——加载期启动屏全屏可见，挂载后移除、首页正常、溢出 0、console 0 error。已订阅 SW 的存量客户端拿旧壳无启动屏，随 R71 壳更新通道自然获得。

### R109（2026-08-31）：社交分享卡片 og:image 收口——/s/* 补图 + 全站品牌分享卡
- 取证：/s/{sid} 分享落地页 og:title/description/url 齐全但 og:image 为 0（curl 实测），og 抓取端分享卡无缩略图；root 与 /tiku 页族 og:image 指向 512×512 方形 logo.png（标准推荐 1200×630 横版）。分享回路有真实流量（近 3 日 share_open 15、pk_result_open 7）。首页新访客 CTA 复测 3 次 ~1s 直入题组（首次 33s 为孤例未立项）。
- 实现：新增品牌分享卡 frontend-uni/src/static/og-card.png（1200×630，渐变 #2e5bff→#4c7dff+站名+价值主张+特性 chips），scripts/gen_og_card.py（PIL+仓库内 NotoSansSC-Bold）可复现生成；seo.py share_landing 补 og:image/twitter:image、twitter:card 升 summary_large_image；seo.py _page 与 index.html og:image 换 og-card.png。静态单图不做按题动态出图；零 DB/零边缘缓存改动。设计文档 docs/iter/round-3/r109-social-share-card.md。
- 生产验收（PR #287）：/s/fsb75lki、/tiku/、/ 三处 og:image 均指向 og-card.png 且 twitter:card=summary_large_image；/static/og-card.png 200（40888B，实测 1200×630）；1440+375 首页与 375 分享落地页回归溢出 0、console 0 error。本轮无测试数据写入（30h 窗口 growth_events/answer_log/daily_set_entries 均 0 新增）、保护 uid 零 mutation。

### R121–R125（2026-08-31）：离线错误态/首页 LCP/键盘可达性/SSR 深色模式/窗口复审计
- R121（PR #299）：断网直入未缓存路由的 uni async-error 死胡同——仅离线替换文案+online 事件自动重试（App.vue 复用 markMain MutationObserver）；sw.js 静态资源不拦截策略保持。
- R122（PR #300）：首页 LCP 3.2s→0.8s、perf 0.91→0.98——index.html 启动屏副标题扩为完整价值主张（16px/限宽），首绘制即承载最大文本块；/tiku 页族 Lighthouse 全绿无立项。
- R123（PR #301）：SPA 键盘可达性从 0 到全站——src/a11y-focus.js 包一层 Element.addEventListener，click 绑定的 UNI-VIEW/TEXT/IMAGE/LABEL 自动 tabindex=0 + Enter/Space 激活 + :focus-visible 焦点环；role=button 延迟 rAF 只给叶子级短文本元素。axe 复扫 0 violations。
- R124（PR #302）：/tiku SSR 页族深色模式——seo.py _CSS 颜色 token 化（:root 变量，亮色取值零变化）+ prefers-color-scheme 深色覆盖 + color-scheme meta；对比度 AA 自查通过。
- R125（docs）：窗口复审计 docs/iter/round-3/r125-window-audit.md——48h 真实作答 16 uid/93 条；slow_load 仅 1 条慢网旧 bundle 样本不立项；push_subs 仍 0。
- ⚠️ 观测陷阱：growth_events/answer_log 的 created_at 是 epoch float，`created_at > datetime('now',…)` 字符串比较静默返回空集（会误判零事件）；时间过滤必须用 time.time()-N 数值参数。
- 合并链：#299→#300→#301→#302 依序合并即收口 R121–R124。

### R126–R128（2026-08-31）：弹层键盘/路由预取/窗口复审计
- R126（PR #304）：全站 25 处 `.mask` 弹层统一键盘支持——a11y-focus.js 增 initModalKeys()：MutationObserver 侦测弹层出现即焦点移入、Tab/Shift+Tab 圈定在最顶层 mask 内、Esc 等价点遮罩关闭、关闭后焦点归还触发元素。fixed 遮罩可见性必须用 getClientRects().length（offsetParent 恒 null）。
- R127（PR #305）：路由 chunk 空闲预取——build:h5 末尾 gen-precache-manifest.mjs 产出 precache.json（assets js/css 清单），运行期 precache.js load 后 8s 空闲逐个 fetch 温 HTTP 缓存（immutable 一年缓存可离线命中；省流/2g/离线跳过、同版本只跑一轮 kg_precache_done）。生产实测离线直入从未访问的 pkgA 路由可完整渲染。零 SW 改动（静态资源不经 SW 拦截的既定设计保持）。
- R128（docs）：窗口复审计 docs/iter/round-3/r128-window-audit.md——Lighthouse /tiku 页族全 1.0、首页复跑 0.98（首跑 3.2s LCP 为宿主方差非回归）；内链/分页 canonical/卷详情/无效日期 301 全健康；错题本空态完整。无可立项缺陷，docs-only。
- 合并链：#299→…→#304→#305 依序合并即收口 R121–R127。

### R131–R133（2026-08-31）：嵌套弹层栈/分包页 axe 收口/弹层决策纯函数化
- R131（PR #309）：多层嵌套弹层收口——a11y-focus.js 改「打开顺序栈」为唯一事实：每层独立 lastFocus 归还、入栈提升 z-index（BASE_Z+depth）保证后开在最上、Esc/Tab 只作用栈顶、空弹层补 tabindex=-1 落点。生产 1440 嵌套链路（筛选 sheet 内 ? 开速查）+ 375 单层回归通过。
- R132（PR #310）：二级/分包页 axe 复扫——18 个分包路由生产双视口全扫，verified 8 节点/3 页：竞赛「即将开始」徽标（新增 --warn-strong token）、提醒页关闭态整行 opacity 改只弱化图标/开关+文字换安全色、登录页三处文字对比度+logo aria-hidden。复验 18 路由 × 1440/375 全 0 violations。⚠️ 探针路由必须以 pages.json 为准（如 social/discuss、stats/mastery-map），拼错路由被 R60 兜底重定向首页会产生 landmark 假阳性。
- R133：弹层焦点管理决策纯函数化——新增 src/modal-policy.js（reconcileStack/zIndexFor/pickFocusTarget/nextTabIndex，present 判定注入），a11y-focus.js initModalKeys 改调纯函数（行为等价重构，DOM/MutationObserver/focus 副作用留在运行时）；tests/modal-policy.test.js 13 例锁定栈对帐逆序归还/层级/空弹层 fallback/Tab 循环边界（vitest 25→38 例，零新依赖不引 jsdom）。生产复验 R131 嵌套链路 1440/375 零回归。
- 合并链：#299→…→#309→#310→R133 PR 依序合并即收口。

### R134（2026-08-31）：分包页加载失败误呈现为空态收口
- 取证：生产壳 + `page.route('**/api/**', abort)` 逐页直入，verified 5 页失败时渲染「无数据」空态（plaza「还没有讨论」、practice-history「还没有练习记录」、favorites「这里还没有收藏/还没有笔记」、exam/list「暂无成套真题卷」、exam/contest「暂无比赛场次」）；根因：catch 只 toast（~1.5s 消失）后 loaded/loading 落空态分支。weekly-report 的「加载失败+重试 ›」为参照模式；calendar 本地 pstats 降级属既定设计不立项。
- 修复：5 页统一补驻留错误态（loadErr/favErr/noteErr + 空态分支前 v-else-if 错误卡 + 重试点击重载），零后端改动。生产双视口复验：5 页 × 1440/375 失败态均出错误卡不再伪装空态、放行 API 点重试原位恢复、溢出 0。方案：docs/iter/round-3/r134-load-error-vs-empty.md。

### R135（2026-08-31）：分包页加载失败误呈现为空态收口（二期）
- 取证：同 R134 方法（生产壳 + API abort 逐页直入），verified 6 分包页失败时渲染「无数据」空态（interview/history、pk（loadHome 完全静默）、social/inbox（登录态）、team（loadHome 完全静默）、shenlun 三 tab、social/discuss）。主包 stats/book 同样存在但有快照兜底（R90/R108）且状态复杂，留 R136 单独取证。
- 修复：6 页补驻留错误态+重试（shenlun 三 tab 独立 qErr/mErr/rErr；pk/team 原静默 catch 补驻留错误但不加 toast；inbox 错误卡置于登录引导之后，游客行为不变），零后端改动。生产双视口复验：5 个免登录页 × 1440/375 失败态均出错误卡、放行 API 点重试原位恢复、溢出 0；inbox 登录态失败路径为代码同构未生产实测（游客路径实测不变）。方案：docs/iter/round-3/r135-load-error-vs-empty-part2.md。

### R136（2026-08-31）：主包 stats/book 加载失败误呈现为空态收口（三期·终）
- 取证：源码逐 catch 核查 + 生产 API abort 探针。verified：stats.load()（/api/stats+/api/mistakes）失败后「错题模块分布/高频错题型」渲染「暂无数据」（无本地降级）；book.load() 无缓存回退（新设备/首访）时渲染「错题本还是空的」。stats 热力图/成长/推荐等有 pstats 降级或属增强信息、book 有缓存时 offlineView 横幅，均属既定设计不立项。
- 修复：两页补 loadErr 驻留错误态+重试（book 仅无缓存分支置错，offlineView 语义不变），零后端改动。生产双视口复验：2 页 × 1440/375 失败态出错误卡不再伪装空态、放行 API 点重试原位恢复、溢出 0。方案：docs/iter/round-3/r136-load-error-vs-empty-mainpkg.md。

### R137（2026-08-31）：详情/报告页失败态收口（成绩报告/赛后报告/掌握度地图）
- 取证：生产 API abort 探针 + 源码核查。verified：report.vue 网络失败误呈现「暂无成绩报告」引导空态；contest-report.vue 失败标题固定「暂无大赛报告」且副文案直出 request:fail（网络失败与报告不存在混淆）；mastery-map.vue 已有驻留错误文案但无重试出口。
- 修复：导出 api.js 既有 isNetErr 分流——网络层失败置 loadErr 错误卡+重试 ›，HTTP 业务错误（404 报告不存在等）保持「暂无…」空态引导语义；mastery-map 补重试+load 清空 err。零后端改动。生产双视口复验：3 页 × 1440/375 abort 出错误卡、放行后重试 mastery-map 原位恢复、不存在 id 正确落回空态引导、溢出 0。方案：docs/iter/round-3/r137-report-pages-error-state.md。

### R138（2026-09-01）：面试作答草稿自动保存
- 取证：源码核查 interview.vue——作答 textarea（5000 字上限）为纯内存 answer，刷新/标签页回收/误触返回长文全丢；对照 shenlun 已有 slDraft:<qid> 逐题草稿模式。面试是随机抽题，刷新后重抽大概率非原题，逐题键无法自然恢复。
- 修复：单键 ivDraft 整体快照 { q, cat, answer }——@input 非空 set/空 remove；onLoad 无 session_id 时有草稿直接恢复原题+分类+作答进入作答步（toast 提示）；批改流成功后 remove、失败保留；draw 换题不动旧快照（新题输入后自然覆盖）；计数行补「已自动保存 ·」外显。零后端改动。生产双视口复验：1440/375 输入→刷新原题+作答整体恢复、提交成功后草稿清除刷新不再恢复、console 0 error、溢出 0（测试 uid 数据已清理）。方案：docs/iter/round-3/r138-interview-answer-draft.md。

### R139（2026-09-01）：api.js 网络层决策纯函数化 + vitest 回归覆盖
- 取证：api.js（950 行）是全站唯一网络入口，承载六类关键决策零单测——isNetErr 错误分类（R134–R137 全站失败态分流依据）、401/403 登录失效判定（R39）、非 2xx detail 提取（R66 防 [object Object]）、GET 快照兜底 LRU/TTL（R90）、SSE 解析（feedSse + 两处 interview feed 三份复制）；历轮回归全靠生产实测。
- 修复：对称 R118/R133 模式抽出 src/api-policy.js 纯函数（isTimeoutMsg/isNetMsg/classifyHttpError/snapCacheable/snapFresh/snapPushIndex/parseSseEvents），api.js 委托调用、SSE 三处 feed 统一为 feedSse 消费 parseSseEvents（state.errMsg 定制错误文案、done 事件透出）；新增 tests/api-policy.test.js 16 例（vitest 38→54），行为等价重构零生产行为变化、零新依赖。生产双视口复验：1440/375 首页/刷题/AI问答加载回归 + 真实面试流式点评全程正常、console 0 error、溢出 0（测试 uid 4 行已清理，保护 uid 零 mutation）。方案：docs/iter/round-3/r139-api-policy-tests.md。

### R140（2026-09-01）：讨论/笔记 UGC 输入草稿保护
- 取证：延续 R138 探针对全站剩余长文本输入逐处核查。verified：讨论页 discuss.vue 发言/回复 draft（500 字）纯内存，刷新/标签页回收即丢；q-social-bar 笔记编辑 draft（1000 字）纯内存且「取消」误触即整篇丢弃无恢复。申论 slDraft/面试 ivDraft 为存量能力；book 纠错补充说明为选填短文本不立项。
- 修复：沿用 slDraft 键模式——讨论 dcDraft:<qid> 逐题草稿（onLoad 恢复、watch 即存空即删、发布成功清除）；笔记 qNoteDraft:<qid>（startEdit 优先草稿回落笔记原文、编辑中即存且与已存笔记一致时删键、保存成功清除、取消保留草稿）。零后端改动。生产双视口复验：讨论页 1440/375 输入→刷新草稿恢复、清空后键删除；笔记输入→取消→再编辑恢复、清空退出键删除、console 0 error、溢出 0（测试 uid 3 行已清理，保护 uid 零 mutation）。方案：docs/iter/round-3/r140-ugc-draft-persist.md。

### R141（2026-09-01）：读屏动态反馈通报（aria-live）
- 取证：全仓源码 grep——frontend-uni/src 与 deploy/cf-pages 中 aria-live/role="alert"/role="status" 均 0 处，uni-h5 编译产物亦无；全站 212 处 uni.showToast 是唯一操作反馈通道，刷题判分横幅（回答正确/错误+正确答案）纯视觉。即读屏用户对全站动态反馈完全无感知。
- 修复：H5-only 零后端零依赖——新增 src/a11y-live.js（body 常驻 role=status aria-live=polite 隐藏 region；MutationObserver 镜像 uni-toast 可见文案，含后挂载 toast；announce() 供页面显式通报）+ src/live-policy.js 纯函数（toastAnnounceText 可见/非空/去重决策、pickAnnounceText 判分文案含连对≥3 外显）+ practice.vue pick() 后 announce 判分结果；main.js initA11yLive()。tests/live-policy.test.js 8 例（vitest 54→62）。
- 生产双视口复验（bundle fv7249MF / rev d3f0356）：1440/375 region 在位；每日一练作答后 region='回答错误，正确答案 C'；真实 toast（练习工具切音效）两次切换 region 依次镜像「音效已关闭/已开启」；console 0 error、溢出 0（测试 uid 数据 15 行已清理，保护 uid 零 mutation）。方案：docs/iter/round-3/r141-a11y-live-announce.md。

### R142（2026-09-01）：prefers-reduced-motion 全站减弱动态效果
- 取证：源码 grep——全仓（src + deploy/cf-pages）prefers-reduced-motion 0 处；动效存量 @keyframes 8 处（骨架无限呼吸、答对 pop、答错 shake、弹层/横幅 slideup、完成卡 bounce）+ transition 16 处，系统开启「减弱动态效果」后仍全量播放（WCAG 2.3.3 未满足）。
- 修复：App.vue H5 段全局 `@media (prefers-reduced-motion: reduce)`——animation/transition duration 压至 0.01ms + iteration-count 1（保留 keyframes 终态，标准 reset 做法），零组件级改造零后端。/tiku SSR 页族纯静态无动效不改。
- 生产双视口复验（bundle BtXyRqJF）：reduce 模拟下 1440/375 首页骨架 duration=1e-05s、iteration=1；normal 模式 1.4s/infinite 零回归；console 0 error、溢出 0（测试 boot 3 行已清理，保护 uid 零 mutation）。方案：docs/iter/round-3/r142-reduced-motion.md。

### R143（2026-09-01）：/tiku SSR 页族打印样式（@media print）
- 取证：全仓 @media print 0 处；考公用户线下打印真题是真实场景（粉笔以错题导出打印为招牌），题目页打印现状：顶栏/题面 CTA、pager、面包屑、页脚、讨论/相似题区块全随题面打印，灰底+卡片阴影+绿色答案底整页耗墨，.card 无分页约束可能截断题面。
- 修复：_CSS 追加 @media print——CSS 变量压平白底黑字、.hdr-cta/.cta/.pager/.crumb/.tags/.ftr/.noprint 隐藏（讨论/相似题 section 加 noprint 类）、.card break-inside:avoid、.ans 灰框保留答案解析可打印。后端 pytest +2 例（26 passed）。
- 生产双视口复验（rev 11b9a4e-dirty）：emulate_media print 下 /tiku/q/3 上述元素全部 display:none、body 白底、.ans 保留；screen 模式零回归；console 0 error、溢出 0。纯 SSR 改动无测试数据产生。方案：docs/iter/round-3/r143-print-styles.md。

### R144（2026-09-01）：/tiku/q 资料分析题「同材料题组」SSR 互链
- 取证：seo.py 全文无 material_hash 引用——App 练习已有材料题组能力（grouped_ziliao_questions），但 SSR 题目页对资料分析题只有「同考点相似题」（tag3 跨材料），同材料其余小题零互链；生产库实测存在 6 题/组的有效分组（样本 min id 37 等三组）。
- 修复：_render_question 对 module=ziliao 且 material_hash 有效（非 NULL/'-'）查同 hash 小题（ORDER BY id LIMIT 8，≥2 题才输出），题目 article 后新增「同材料题组（共 n 题）」card：当前题标「本题」、其余 /tiku/q/{id} 链接；不加 noprint（打印整组材料题是真实场景）。material_hash 列迁移补入 db.init 基线（防新库首请求先于 refresh 线程）。附带：body 补 overflow-wrap:anywhere 收口长算式 375 横向溢出 103px 存量问题。
- 本地 ruff 全绿 + pytest 28 passed（+2 例）；生产双视口复验 /tiku/q/37：区块+5 互链+「本题」、溢出 0、console 0 error、print/screen 回归 R143。纯 SSR 读路径无测试数据。方案：docs/iter/round-3/r144-material-group.md。

### R145–R148（2026-09-01）：资料分析同材料题组体验（练习/做卷折叠 + PDF 去重/聚组）
- R145 练习页 material.js 材料折叠（PR #323）、R146 真题做卷页同折叠（PR #324）、R147 PDF _split_material 兜底去重（PR #325）、R148 PDF group_by_material 同材料聚组排版（PR #326）。方案见 docs/iter/round-3/r145–r148。

### R149–R150（2026-09-01）：questions 聚合查询计划治理
- R149 三条 /tiku 聚合覆盖索引 34/49/12s→亚秒（PR #327）；R150 tag3_lastmod 69.5s→0.059s、real_regions 5.2s→0.024s（PR #328）。pytest 查询计划回归锁定 COVERING INDEX。

### R151（2026-09-01）：成绩报告详情弹层资料题材料折叠
- report.vue 复用 material.js splitMaterial，默认小题干+「📄 资料材料」折叠条（PR #329）。方案：docs/iter/round-3/r151-report-material-fold.md。

### R152（2026-09-01）：短关键词搜索单字分词 FTS
- verified 1–2 字搜索固定走 LIKE 全表扫描（drop_caches 冷测 97.7–270.3s）；新增 contentless question_fts_cjk 单字空格分词 + phrase 查询，回填复用后台线程，未追平期间 LIKE 兜底。生产冷测 隧道 15–20s→0.19s（PR #330）。方案：docs/iter/round-3/r152-short-query-search-fts.md。

### R153–R154（2026-08-29）：搜索页失败态收口 + 搜索历史
- R153 搜索失败驻留错误卡+重试（原先 toast 1.5s 后伪装成闲置提示，PR #331）；R154 本地 kgSearchHist 历史 chips 一键重搜+清空（PR #332）。方案：docs/iter/round-3/r153-search-error-state.md、r154-search-history.md。

### R155（2026-08-29）：数据窗口复审计（docs-only）
- 7d：answer_log 23 uid/152 条、exam 12、pk 3；push_subs 仍 0；daily_set_entries 全表 0 行——真实 API 探针验证提交链路正常落库（测试行已清理），0 行系参与率为零非工程缺陷；slow_load 47 条仍以 nav:90s 已归因族群为主。无新 verified 缺陷可立项。方案：docs/iter/round-3/r155-window-audit.md。

### R156–R180（2026-08-29/09-01）：搜索可发现性与竞态、对比度治理、快照即显、HTTP 语义收口
- R156–R161 搜索 golden path：深链消费 + /tiku 搜索表单 + SearchAction（#334）、URL 同步（#335）、换词/分页/详情三条竞态防护与加载反馈（#336–#339）。
- R162–R164 对比度治理三连：结果态/内容态/深色全站 token（--brand-text 等，#340–#342）；R165 复审计确认 axe/Lighthouse 全清零（#343）。
- R166 功能面竞品复审计：剩余差距为内容管线级（招考公告聚合/职位表/备考资料），申报立项（#344）；R167 深色 tabbar 滤镜（#345）。
- R168–R174「长尾韧性」家族：边缘 SWR（#346）+ 客户端快照即显全站收口（统计/错题本/首页/我的/分包三页/周报/申论历史，#347–#350、#352）；R173 部署脚本传播窗口轮询（#351）。
- R176–R180 HTTP 语义：埋点离线重放 ago_ms（#355）、HEAD 按 GET 处理（#356）、条件请求 304（origin 强 ETag+边缘 INM/IMS，注意 CF Email Obfuscation 剥 HTML ETag，#357）、边缘 Last-Modified 稳定化（#359）。R175/R179 复审计 docs-only（#353/#358）。
- 合并注意：老板批量合并常把链式 PR 各自并进基分支而非 main，需 rollup PR 收口（#354 收 R122–R175、#360 收 R176–R180）。

### R181–R183（2026-09-01）：交卷重试风暴（客户端根治 + 服务端兜底 + 归因校正）
- R181（#361）：exam.vue 自动交卷失败后 startClock() 重启过期时钟致每秒重交、确定性 404 也无限重试（源码 verified 真实可触发）；新增 exam-policy.js submitFailPlan 三态：terminal（清 examProgress+会话失效 modal）/manual/retry（5s→60s 退避 ≤5 次）。
- R182（#362）：服务端兜底——storm_guard.py ErrorStormGuard（30 错误/60s/IP，X-Kg-Ip 维度，LRU 1024）+ main.py 中间件超阈值 429+Retry-After:60，/api/health 豁免；前端 429/「请求过于频繁」归入可重试口径（trackRetryable 复用）。生产复验第 31 个错误起 429、65s 自动恢复。
- R183 归因校正（重要，不造假数据）：origin 日志按 X-Kg-Ip 复核，风暴 ~20.9k 错误行 100% 来自本会话探针 IP（140.232.64.5，R181 复现/验证期间旧 bundle 触发真实 bug 所致）；同窗口 551 个 502 也全部来自该 IP（风暴过载症状，非独立缺陷），非探针错误仅 4 条 403 /tiku/（R86 直连拒绝，预期行为）。结论：bug 真实存在且已根治+兜底，但无证据表明真实用户曾触发；后续观察真实用户窗口挂后台。

### R184–R186（2026-09-01）：观测管线修复 + AI 限速身份修复
- R184（#364）：CF Pages 迁移后周报 cron/小时归档仍指向已死的 kaogong.zalize.com 边缘日志（8-31 周报仅 329 字节）；切到 /var/log/caddy/kaogong-origin.zalize.com-access*.log*（标题注明「回源流量，不含边缘缓存 HIT」），服务器 crontab 已同步。全量视图需 CF Analytics 权限（挂申报）。
- R185（#365）：周报被探针淹没（82889 中 ~81k 探针，UA 无法区分）；access_log_report.py 新增 --exclude-ip-file 按 X-Kg-Ip 剔除并外显剔除量，服务器 /home/ubuntu/kaogong-reports/probe-ips.txt（首条本会话 IP 140.232.64.5，新探针 IP 须手动登记否则混入）。原始日志/归档不动可复算。
- R186（#367）：verified LLM 端点匿名开放（ACCESS_CODE 空为产品决策）且 rl() 身份取 uid or client.host——生产架构下 client.host 是代理对端固定 IP，导致匿名端点全网共享一个桶（扫描器打光额度殃及真实用户）+ uid 轮换无限绕过烧 token。deps.py 新增 client_ip()（X-Kg-Ip 优先）、rl() IP 桶恒生效（带 uid 放宽 3 倍容忍 NAT）+ uid 桶保持。生产复验：缺参 400 探测（不烧 token）第 21 次起 429、health 不受影响。局限：内存限速重启清零；分布式多 IP 仍可消耗，彻底防御需 CF WAF（token 无权限，挂申报）。
- R187（#368）：R186 只覆盖 rl() 的 11 个调用点；全库 grep 复核三类同源缺陷并修复——面试 LLM 端点（itv_answer/itv_regen，单请求 2 次 LLM 调用）uid-only 可轮换绕过→接入 rl() IP 桶；auth 注册/登录/微信登录 client.host 固定代理 IP→client_ip()（reg 10/h 原为全站共享名额）；/api/track 匿名全站共享桶→按真实 IP 隔离。client_ip() 移入 auth.py（deps import auth 防成环，deps 保留转发）。阈值/窗口/语义零变化。生产复验：匿名同 uid 面试探测（缺题 404 不烧 token）第 21 次起 429。未改动：team/pk/share 纯 DB 写 uid 桶（无 LLM 成本，观察项）。
- R188（#369）：收口剩余 uid-only 桶——team_create/team_join/share_create/share_answer/pk_create 五个匿名可写 DB 端点（uid 自报可轮换→无限插行/垃圾数据膨胀）接入 rl()，阈值/窗口零变化。生产复验（rev 49ddbe1）：team/create 空名 400 探测（不写行）同 uid 第 6 次起 429。不动：social cmt/cmt_report（uid 服务端换算不可轮换）；pk join/submit/random 现状无限速（新增限速属扩权决策，挂观察）。
- R189：全量核对 @router.post × 限速调用点，verified 五个**完全零限速**的匿名可写端点：answer_log（每请求最多插 200 行）、backup（每请求 500KB blob）、report（孪生 question_report 已有 30/3600 而它漏网）、mistakes、practice_result；接入 rl()（阈值按 golden path 用量上界放宽数倍：alog 120/h、backup 10/h、report 20/h、mistake 240/h、presult 60/h）。生产复验（rev 1798efc）：/api/report 无效 reason 400 探测（不插行）第 21 次起 429，health/stats 同期 200。复核明确 bounded 不动：user_state/profile/reminders/mat_favs/daily_set submit/mock_event（upsert）、pk join/submit（UPDATE）、monitor/report（不落本地 DB）。
- 合并注意：#361–#365 又各自并进链式基分支，main 停在 #360；rollup #366 收 R181–R185，R186 为 #367（基于 #366 分支）。

### R191（磁盘治理）
- 数据卷内 5 个 8 月手工 DB 快照（~1.85GB）已归档至 `r2:zalize-backups/kaogong-sqlite/archive/`（字节校验一致后删本地），卷 2.29GB→450MB，根分区 86%→84%。
- kaogong-ops.sh 新增磁盘水位巡检（≥90% 写 DISK HIGH 入 /home/ubuntu/kaogong-ops.log），已同步 VPS 实跑验证。
- 未来手工快照请直接放 R2 archive 前缀或用 pre-*.db.gz 命名（3 天自动清理），勿在 /data 卷内长期堆放。

### R192（storm guard 429 连坐收口）
- 复盘 09-01 探针风暴（本机遗留旧 exam 标签页 ~57k 404，已关闭）：当时零 429 系容器运行 R182 前旧镜像，守卫逻辑本身无缺陷。
- verified 缺陷：rl() 的 429 被 storm guard 计入错误窗口，单端点限速 35×429 后整 IP 全 /api 连坐封禁（生产实测无关端点也 429）；record() 已排除 429。
- 生产复验方式：先触发 /api/report rl 至 429，再请求无关端点确认不连坐。

### R193（首页 Lighthouse LCP 双峰收口）
- 现象：首页 Lighthouse LCP 双峰（~0.8s 归属静态启动屏字幕 vs ~3.5s 归属水合后 hero 副标题），perf 分随之 0.99/0.89 摆动。
- 排错：先试放大启动屏字幕面积（16px/340px→17px/392px）不解决；本地对照实验 verified 关键变量是「启动屏节点被物理移除」——节点移除后 trace 侧 LCP 候选失效回退水合后内容（4/5 次归属 hero），保留节点仅隐藏则 4/4 次稳定归属启动屏。
- 收口：启动屏移出 `#app` 挂载根（防 Vue 挂载清空）；main.js H5-only mixin 首个组件 mounted 后等两帧加 `.kg-splash-done`（opacity/visibility/pointer-events 隐藏 + spinner 停转），只隐藏不移除。
- 生产复验（rev 8da5ae5 / bundle index-9wsrn0Pe.js）：5 次 Lighthouse 全部归属 `#kg-splash > div.s`，LCP 0.8–1.8s、perf 0.97–0.99，3.5s hero 峰消失；1440/375/375-dark 启动屏正常隐藏（visibility:hidden/opacity:0）、溢出 0、console 0 error。
- 如实局限：这是 LCP 归属稳定化，不缩短真实水合时间；隐藏节点常驻 DOM（零可见性、spinner 停转）。详见 docs/iter/round-3/r193-lcp-bimodal-splash.md。

### R194（启动屏加载失败死胡同收口）
- 取证：生产拦截 `/assets/index-*.js` 模拟 bundle 加载失败，25s 后仍停留启动屏 + spinner 旋转，无失败提示无出路——既有自愈链路（陈旧壳自愈/错误监控/离线兜底）全在 main.js 内，bundle 失败时一行不执行，属结构性盲区。
- 收口：index.html 内联 watchdog（不依赖 bundle）：capture 阶段 error 监听 `/assets/` script 加载失败即触发失败态，20s 超时兜底；失败态隐藏 spinner、追加「页面加载失败，请检查网络后重试」+「重新加载」按钮（location.reload）；main.js dismissSplash() 调 `window.__kgSplashOk()` 取消 watchdog，失败态若已出现而 bundle 晚到成功挂载，`.kg-splash-done` 连同失败态一起隐藏无残留。
- 生产复验（rev 5f2a45b / bundle index-D-Jearwy.js）：拦截 bundle 后 375/1440-dark 均出失败态（spinner 停、提示+按钮），点重新加载放行后正常水合；正常路径 watchdog 被取消无失败态闪现；Lighthouse perf 0.97–0.98/LCP 0.9–1.8s 与 R193 一致；溢出 0、console 无非预期 error。
- 如实局限：20s 阈值为经验值，极端慢网正常加载会先见失败提示（点重载即恢复，不阻断晚到挂载）。详见 docs/iter/round-3/r194-splash-load-failure.md。

### R195（深色 /tiku 正文链接可辨识性 + 启动屏失败态读屏可达性）
- 取证：全站 axe 复扫（light/dark × 7 页）仅 dark `/tiku/` 违例 link-in-text-block serious×7——深色 `--link:#7c9aff` 对正文 `#f3f4f6` 对比仅 2.4:1 且无下划线（h2 模块标题链接 + 首段两个内文链接；R48 只补了 `.meta a,.ftr a`）。颜色方案不可行（对 surface ≥4.5:1 与对正文差 ≥3:1 的亮度区间刚好相抵）。另实证 R194 失败态提示 role/aria-live 均无、焦点为空，读屏用户听不到失败通报。
- 收口：seo.py `_CSS` 下划线规则扩为 `.meta a,.ftr a,h2 a,p a`（双配色一致），豁免 `p a.cta,.crumb a`；index.html watchdog 失败提示加 `role="alert"`、追加后 `b.focus()` 焦点直达重试按钮。
- 生产复验：dark/light `/tiku/` axe 清零、溢出 0；拦截 bundle 后失败态 role=alert 生效、焦点落在重试按钮。
- 如实局限：下划线全页族生效（含浅色）属视觉语言统一；读屏收口验证方式为 DOM 断言非真实读屏实测。详见 docs/iter/round-3/r195-dark-link-a11y.md。

### R196（性能预算回归护栏）
- 取证：7d 窗口无新缺陷（slow_load 47 条均已知模式）；初次探测 `/tiku/search?q=比重` 400 复核为误报——curl 原始 UTF-8 未编码写入请求行所致，规范编码/浏览器路径均 302，非生产缺陷；真实缺口为流程性：perf/a11y 水位只靠隔轮手工 Lighthouse 维持（R193 LCP 双峰曾长期未被发现），部署校验对性能/无障碍回归零感知。
- 收口：新增 `deploy/perf-budget.sh`（Lighthouse 跑 `/`、`/tiku/`，预算 perf≥0.90/a11y≥1.00/bp≥0.90/seo≥0.95/LCP≤2500ms/CLS≤0.10 + 主 bundle gzip≤160KB，阈值均可环境变量覆盖）；deploy_h5.sh 新增 step 6b 部署后自动跑，默认 WARN 不阻塞（防单次抖动假红，R173 教训），`PERF_BUDGET_STRICT=1` 严格模式、`SKIP_PERF_BUDGET=1` 跳过。
- 验证：bash -n 双脚本；对当前生产实跑全部通过（/ perf 0.98/LCP 795ms，/tiku/ perf 1.0/LCP 939ms）；篡改阈值验证违例路径 exit 1；部署路径 step 6b 下轮部署自然复验。
- 如实局限：实验室指标非 RUM（真实用户长尾另有 slow_load 埋点观察）；默认 WARN 模式违例仍需人工复核。详见 docs/iter/round-3/r196-perf-budget.md。

### R197（/tiku SSR 页族键盘焦点可见性）
- 取证：7d 窗口无新缺陷；SPA 侧 a11y-focus.js 已有全局 2px focus-visible 焦点环（R123 约定），SSR /tiku 页族 verified 缺口——全文唯一焦点样式为搜索框 `outline:none`+1px 边框变色，链接/CTA 无自定义环且风格不一致（axe/Lighthouse 动态态盲区，对照 WCAG 2.4.7/2.4.11）。
- 收口：seo.py `_CSS` 新增 `:focus-visible{outline:2px solid var(--link);outline-offset:2px}`（token 化深浅色自适应），搜索框去 outline 抑制、保留 `:focus:not(:focus-visible)` 鼠标静默；+2 pytest 断言。
- 验证：ruff/pytest 74 全绿；生产 rev 00b0253 部署后 1440/375 × light/dark Tab 走查全部焦点元素出 2px 环（light #2e5bff / dark #7c9aff）、溢出 0；本次部署首次真实复验 R196 step 6b：性能预算全部通过（/ perf 0.99/LCP 806ms，/tiku/ perf 1.0/LCP 944ms）。
- 如实局限：文本输入框在 Chrome 按规范恒为 focus-visible，鼠标点击输入框也出环（与原生行为一致，非缺陷）；边缘 SWR 副本在 TTL 窗口内仍供旧 CSS，自然过期刷新。详见 docs/iter/round-3/r197-ssr-focus-visible.md。

### R198（练习页 v3 IA 迁移遗留死代码清理）
- 取证：7d 窗口无新缺陷，选代码治理轮。`git log -S plancard` verified：30a2b54（v3 5-tab IA）把「今日计划卡+报考画像引导/设置」迁至首页 tab 时只删了 practice.vue 模板，脚本与样式整段遗留——`loadPlan/loadProfile/loadPlanToday/openSetup/skipGuide/setupNext/goTask/setFocus` 8 个方法与 9 个 data 字段模板零引用（`this.loadProfile()` 全文不存在→`this.profile` 恒 undefined→两处 `if (this.profile)` 守卫永假），~140 行不可达 JS + ~40 行死 CSS 打进 practice chunk，且在练习页留下 daily_plan/profile/plan/today 幽灵调用面（R197 取证时曾被误判为活调用）。
- 收口：只删不改（-143 行），home.vue 活代码与 percentile/goBook/goMini 等活引用不动。
- 验证：删除后全文 grep 零残留；ESLint/vitest 95/build 全绿；生产 rev 19236e7 部署后 1440/375 练习页自动开题、作答正常、无横向溢出、console 0 error；R196 step 6b 性能预算全部通过（/ perf 0.99/LCP 826ms，/tiku/ perf 1.0/LCP 944ms）。
- 如实局限：仅清理本页取证确认的死集群，未逐页扫全站死代码。详见 docs/iter/round-3/r198-practice-dead-plan-code.md。

### R199（/tiku 尾斜杠规范化缺口收口）
- 取证：生产逐路由复测 verified 两个 404 缺口——`/tiku/papers/{pid}/`（带斜杠无路由直接 404）与 `/tiku/daily/{day}`（无斜杠落 `/{module}` catch-all → 模块不存在 404），与 q/{id}（带斜杠 301 去斜杠）及列表页族（无斜杠 301 补斜杠）既有约定不一致，外链斜杠变体把 121 张卷详情页/滚动归档页判成硬 404。
- 收口：只补两条 301 路由（papers 详情带斜杠→无斜杠、daily 归档无斜杠→带斜杠），规范 URL/sitemap/canonical 零变化；+2 pytest。
- 验证：ruff/pytest 76 全绿；生产 rev f149cb0 部署后全表复测（papers/5/ 301、daily/{day} 301、q//discuss//papers/ 既有语义不变、unknown 仍 404、坏日期仍 301 回 /tiku/daily/）；1440/375 两页溢出 0、console 0 error；R196 性能预算全过。详见 docs/iter/round-3/r199-tiku-slash-canonical-gaps.md。

### R200（/tiku 尾斜杠规范化扫尾）
- 取证：R199 后对 seo.py 全部路由斜杠变体穷举复测，剩三处不一致——`/tiku/search/` 落 `/{module}/` catch-all 直接 404（query 一并丢）；`/y/{year}/{module}` 与 `/t/{code}` 无斜杠路由无条件 301，无效输入产生 301→404 两跳链（与 `/{module}` 无斜杠「先验证再 301」约定不一致）。
- 收口：`/search/` 301 → `/tiku/search`（保 q）；y/t 无斜杠先验证（module 名+年份有量 / topic 存在+有量）再 301，无效直接 404。内容路由/sitemap/canonical 零变化；+4 pytest（79 全绿）。
- 验证：生产 rev d7fe5d6 部署后全表复测（search/ 带 q 301、无效 y/t 无斜杠 404、有效仍 301、R199 回归集不变）；1440/375 year/topic 页溢出 0、console 0 error；R196 性能预算全过。详见 docs/iter/round-3/r200-slash-canonical-tail.md。

### R201（模块 hub 页补考点/年份内链）
- 取证：sitemap-topics 收录 156 个考点页，但 /tiku/ 首页每模块考点截断 [:12] 实际只链 60 个；模块 hub 页（如 /tiku/changshi/ 30907 题）零考点/零年份内链——约 96 个考点页无稳定 hub 入链，只靠题目页标签与同组兄弟互链弱连通。
- 收口：tiku_module 渲染新增「按考点刷题」（本模块全量考点+题数）与「按年份刷真题」两卡，复用 tag3_counts/year_module_counts 既有取数；首页 [:12] 截断与考点/年份页自身渲染不动，零新路由。
- 验证：ruff/pytest 80（+1 例）全绿；生产 rev 964dce9 部署后五模块页考点内链合计 156（=sitemap 全量）、年份链接齐全；1440/375 模块页溢出 0、console 0 error；R196 性能预算全过。详见 docs/iter/round-3/r201-module-hub-internal-links.md。

### R202（首页考点截断补「全部考点」入口）
- 取证：首页每模块考点标签截断 [:12] 后无任何「更多」入口（生产 grep「更多/查看全部」零命中），R201 模块 hub 全量考点卡与首页截断列表之间无显式引导。
- 收口：截断（>12）时在标签尾部追加「全部 N 个考点 →」链至 /tiku/{module}/；≤12 不加。零路由/canonical/sitemap 变化。
- 验证：ruff/pytest 81（+1 例，测试库因启动自动导入题库非空，断言按实际考点数条件判定）全绿；生产 rev 5f45dc9 五模块入口齐全（27/56/18/22/33），1440/375 /tiku/ 溢出 0、console 0 error；R196 性能预算全过。详见 docs/iter/round-3/r202-home-topic-more-link.md。

### R203（部署审计日志 + 观测口径校正）
- 取证：09-01 16:11–18:37 origin 出现 ~21k 条 exam submit/report 404 风暴（60s 滚动窗口峰值 262 错误）期间零 429，而当日 22:08 生产实测与本地 pytest 均确认 ErrorStormGuard 第 31 个错误起 429 正常生效；同窗口 dockerd journal 显示容器被反复重建（约每 10–25 分钟），但无任何持久记录能回答「某时刻线上跑的是哪个 rev、由谁部署」，风暴窗口守卫失效无法定案。
- 口径校正（重要）：140.232.64.5 为 Devin 基础设施共享 NAT 出口，多个会话共用；此前 R183/R185 按该 IP 的「本会话探针」归因实为「全部 Devin 会话」口径。另实证当日有本会话之外的操作者在做 kaogong 部署/备份（19:33 手工 ops、20:55/22:00 部署，产物与 R202 树一致，线上 rev 5f45dc9 健康）。
- 收口：deploy_h5.sh rev 校验后追加一行部署审计记录（UTC 时间/rev/bundle/部署机 hostname）到服务器侧 /home/ubuntu/kaogong-reports/deploy-history.log，写失败不阻塞。详见 docs/iter/round-3/r203-deploy-audit-trail.md。

### R204（SSR 分页导航补页码窗口）
- 取证：SSR 分页页族（模块/子题型/考点/年份，共用 _pager()）只有 首页/上一页/下一页/末页，无页码直达；/tiku/panduan/ 共 459 页，到第 50 页需 ~49 连跳，非探针日志 24h 实见爬虫磨 ?page=254 深页。
- 收口：_pager() 改页码窗口（上一页 | 1 … 当前±2 … 末页码 | 下一页），当前页 <span aria-current="page">，page=1 链接用干净 base_path（无 ?page=1），保留 rel=prev/next；既有 canonical/noindex 404/唯一 title 语义不变。
- 验证：ruff/pytest 87（+6 例）全绿；生产 rev c0beeae 分页窗口/aria-current 实测生效，1440/375（含 375 深色）分页页溢出 0、console 0 error；R196 性能预算全过。详见 docs/iter/round-3/r204-pager-numbered-window.md。

### R205（边缘无副本 MISS 路径 origin 重启窗口 5xx 单次重试）
- 取证：非探针 24h 日志实见 ClaudeBot 抓 /tiku/panduan/?page=254 得 502（duration 0.05s，连接被拒量级）；dockerd journal 同窗口容器 13:57/14:07/14:24/14:34 反复重建（每次 ~15–25s 不可用）；源码复核确认有副本时已有 stale-if-error（R95），但深页/10 万+ 题目页多数无边缘副本，MISS 同步回源 fetch 异常直 throw、5xx 原样透传。
- 收口：edge-policy.js 新增纯函数 shouldRetryOrigin（仅 GET/HEAD、无 stale、首次尝试、status 0/502–504 才重试），[[path]].js MISS 路径单次 1200ms 退避重试；有副本路径与 500/501/4xx 语义不变。
- 验证：vitest 100（+5 例）/lint/build 全绿；生产部署后正常路径回归无额外延迟；受控 docker restart 窗口实测无副本深页首访 1.72s 返回 200（旧行为 0.05s 502 直漏）、同窗口 6 深页零 5xx。详见 docs/iter/round-3/r205-edge-origin-retry.md。

### R206（边缘函数 onRequest 集成级回归测试，测试补强无行为变化）
- 取证：本轮生产复审计无新 verified 缺陷（24h 非探针 origin 干净、SSR 页族 light/dark axe clean）；RUM slow_load 的 8–45s API 长尾样本无 v: 版本戳（疑旧 bundle 客户端），对应时段 origin 日志已被探针轮转无法归因，挂观察。真实缺口为流程性：[[path]].js（全站唯一入口，HIT/SWR/stale-if-error/重试/304/tee 入缓存/安全头）零集成测试，历史上只能靠部署后生产探测验证。
- 收口：tests/edge-handler.test.js 直接 import onRequest，桩 caches.default/fetch/waitUntil + 假时钟，12 例覆盖爬虫 403、MISS 入缓存（剥 Set-Cookie/盖 Cached-At）、HIT、SWR 刷新与 stale-if-error（5xx/异常两路）、R205 重试全分支、边缘 304（HIT/MISS 两路）、安全头与 /api noindex。
- 验证：vitest 112（+12 例）/lint/build/ruff/pytest 87 全绿；纯测试新增无源码改动，无需部署。详见 docs/iter/round-3/r206-edge-handler-tests.md。

### R207（SW 离线壳缓存污染收口）
- 取证：src/static/sw.js 导航分支对任何同源导航响应无条件 `cache.put('/', copy)` 不检查 res.ok；故障窗口（R205 取证的容器重建 502 等）错误页可覆盖壳缓存，之后离线/超时兜底 `caches.match('/')` 回的是 502 页且离线用户无恢复路径。SW Cache Storage 服务端不可观测，按防御性收口。
- 收口：回写前加 `res.ok` 守卫（仅 2xx 入壳缓存，错误响应直出不入缓存）；缓存名/离线兜底/不拦截清单语义不变。新增 tests/sw-shell.test.js（源码沙箱执行 + 桩 caches/fetch，4 例：200 回写、502 不污染、异常回退旧壳、路径不拦截）。
- 验证：vitest 116（+4 例）/lint/build 全绿；生产 rev 193f0a0 部署后 1440/375（深色）SW 受控、壳缓存 200、溢出 0、console 0 error；R196 性能预算全过。详见 docs/iter/round-3/r207-sw-shell-cache-poisoning.md。

### R208（/tiku 畸形参数 422 裸 JSON 收口）
- 取证：公开 SEO 页族对畸形 int 参数直出 FastAPI 原始 JSON 422（/tiku/xx/?page=abc、/tiku/q/abc/、/tiku/papers/abc/、/tiku/y/abcd/xx/），与 R119「失效链接给品牌壳+出路」约定不一致；本轮 origin 日志复审计无其他新 verified 缺陷。
- 收口：main.py 全局 RequestValidationError 处理器按路径分流——/tiku、/s/、/p/ 返回品牌 404（noindex），/api 保持默认 JSON 422 契约不变。
- 验证：ruff/pytest 89（+2 例）全绿；生产 rev 052c76a 部署后 4 类畸形 URL 全部 404 品牌页、正常分页/API 422 不变，R196 性能预算全过。详见 docs/iter/round-3/r208-tiku-422-branded-404.md。

### R209（启动屏内联 watchdog 测试补强，无生产行为变化）
- 取证：生产复审计无新 verified 缺陷（sitemap 60 URL 抽样 canonical/状态全对、边缘 304 验证器正常、slow_load 长尾为旧 bundle/爬虫族群且同名端点实测亚秒）；真实缺口为流程性——index.html 内联 watchdog（R194 失败态+重试、R195 role=alert/焦点直达）是启动链路唯一不依赖 bundle 的自愈路径，此前 vitest 零覆盖，行为只能靠部署后生产受控拦截验证。
- 收口：新增 tests/splash-watchdog.test.js，沿用 sw-shell 源码沙箱模式（从 index.html 正则提取内联 IIFE + 注入桩 window/document + 假时钟），6 例覆盖：20s 超时失败态/alert/焦点、__kgSplashOk 取消、/assets/ script error 即时触发、幂等、非 assets 不触发、kg-splash-done 不注入。
- 验证：vitest 122（+6 例）/lint/build 全绿；无生产产物变更不部署。详见 docs/iter/round-3/r209-splash-watchdog-tests.md。

### R210（dark /tiku/papers/ 列表链接 link-in-text-block 收口）
- 取证：生产 axe 复扫 light/dark × 7 页（panduan?page=254、daily、papers、search、q/1、discuss、y/2023），唯一违例为 dark /tiku/papers/ link-in-text-block serious×61——papers 列表 li 为「短标题链接 + 较长 .meta 文本」构成 text block，深色 --link 仅靠颜色区分；R195 下划线规则未覆盖 .qlist li>a。origin 24h 非探针错误仅零星扫描/直连 403，无其他新缺陷。
- 收口：seo.py 下划线选择器扩一项 `.qlist li>a`（papers 与题目列表统一，light/dark 一致，胶囊 CTA/面包屑豁免不变）；+1 pytest。
- 验证：ruff/pytest 90（+1 例）全绿；生产 rev c3aba55 部署后 14 组合 axe 全 CLEAN，1440/375 × light/dark papers/模块页下划线生效、溢出 0、console 0 error，R196 性能预算全过。详见 docs/iter/round-3/r210-papers-dark-link-underline.md。

### R211（前端 lint 覆盖面缺口收口：tests/ 纳入官方门禁，纯工具链不部署）
- 取证：`npm run lint` 只跑 `eslint src`，tests/ 12 个测试文件游离在 lint 门禁外；实测 `npx eslint tests` 27 errors（全部 no-undef：Request×20/Response×7，Fetch API 全局未声明，R209 已记录该债务）。deploy/cf-pages 边缘源码在 eslint flat config base path 之外无法直接纳管（需配置上移仓库根，挂候选不做）。
- 收口：eslint.config.mjs globals 补 Request/Response/Headers/caches/self；lint 脚本改 `eslint src tests`。零测试/源码改动，27 errors 全部由 globals 声明消解。
- 验证：npm run lint（src+tests）0 error、vitest 122、build 全绿；无生产行为变化不部署。从本轮起「lint 全绿」口径覆盖 src+tests。详见 docs/iter/round-3/r211-lint-scope-tests.md。

### R212（容器生命周期审计 + 宿主内存压力观测，纯 ops 工具链不部署）
- 取证：verified 宿主 2GB 内存跑 13 容器长期高压（mem avail 224–291MiB、swap ~2.3GB、zram 近满）；earlyoom 曾多次 SIGTERM/SIGKILL kaogong uvicorn（badness ~944、VmRSS 峰值 462MiB，08-31 journal 实证）——即部分 502/重启窗口的直接成因；09-01 晚容器每 10–20 分钟重启（dockerd sbJoin 48h×171 次、实查 Up 11 minutes），但该宿主 docker events 历史查询返回空、autoheal/ops 日志均无对应记录，重启归因存在系统性观测盲区（发起者 unknown）。
- 收口：新增 deploy/kaogong-lifecycle-watch.sh（cron 每分钟轮询比对 ContainerID/StartedAt/健康态，变化即落审计行：UTC、旧→新、内存/交换水位、近 10 分钟 earlyoom kill 数 → kaogong-reports/container-events.log）；kaogong-ops.sh 每日巡检追加 MEM 行（mem avail/swap used/uvicorn RSS）。明确不做：容器内存 limit、无 profile 的缓存压缩、动宿主级 earlyoom。
- 验证：bash -n 通过；VPS 实装 cron 并手跑两次（首次落基线、二次幂等 0 新行），MEM 行实测输出正常（重启后 uvicorn RSS 基线 ~17MiB）。无生产产物变更不部署。独立主机/内存扩容资源申报本轮新增硬证据。详见 docs/iter/round-3/r212-container-lifecycle-audit.md。

### R213（deploy/cf-pages 边缘源码纳入 lint 门禁，纯工具链不部署）
- 取证：R211 挂候选的边缘源码 lint 盲区实测复现（flat config base path 限制，frontend-uni 下无法触达 ../deploy）；从仓库根纳管后立即发现 WritableStream no-undef 1 处（真实用法、globals 缺声明）。
- 收口：仓库根新增转发型 eslint.config.mjs（base path 提根，规则仍单一来源维护在 frontend-uni/eslint.config.mjs）；ignores 补 frontend-uni/ 前缀镜像组、globals 补 ReadableStream/WritableStream；lint 脚本改 `eslint src tests && npm run lint:edge`。
- 验证：npm run lint（src+tests+edge）0 error、vitest 122、build:h5 全绿；无生产行为变化不部署。从本轮起「lint 全绿」口径覆盖 src+tests+边缘函数。详见 docs/iter/round-3/r213-edge-lint-coverage.md。

### R214（每日备份可恢复性验证，纯 ops 不部署）
- 复审计无新缺陷：深页 Lighthouse 全 1.0、JSON-LD 全可解析、hub 页内链抽样 60/60 全 200。
- verified 缺口：每日备份从未验证可恢复；手工演练最新备份 quick_check ok / questions=156792。
- 收口：ops 1c' 每日解压当日 .gz → quick_check + questions 行数 → RESTORE-VERIFY ok/FAILED 入日志（已 VPS 实装实跑，坏 .gz 走 FAILED 分支已受控验证）。详见 docs/iter/round-3/r214-backup-restore-verify.md。

### R215（PK 随机匹配新建分支 500 + 模考管理端 ImportError，已部署）
- pyright 全量甄别出两处真实运行时缺陷：R188 后 random_match 新建分支调 api_pk_create 缺 request 实参必 500；mock_event 管理端 `from .main import check_admin` 自 R114 门禁集中化后即 ImportError 500（周赛靠 ensure_weekly_event 兜底所以未暴露）。
- 收口：random_match 透传 request（pk_create 限速桶顺带对新建路径生效）；mock_event 顶部改 `from .deps import check_admin`。+2 pytest（92）。
- pyright 其余 40 处为 Optional/stub 噪声，纳门禁需基线（挂候选）。详见 docs/iter/round-3/r215-pk-random-match-500.md。

### R216（R2 远端备份副本每周独立恢复验证，纯 ops 不部署）
- R214 只验本地 .gz，远端副本从未独立下载验证；手工演练下载→md5 一致→quick_check ok questions=156792。
- 收口：ops 1b' 每周日（FORCE_R2_VERIFY=1 可强制）从 R2 真实下载当日备份、md5 比对入 R2-VERIFY 日志行（已 VPS 实装，成功/缺失对象两路径受控验证）。
- 陷阱：rclone copyto 远端对象缺失 exit 0 不落文件，判定以产物存在性为准。详见 docs/iter/round-3/r216-r2-remote-verify.md。

### R217（pyright 存量清零 + 基线固化，已部署）
- 39 errors 逐项甄别清零：实义修复（mock_event 赛后报告 attempt/paper 缺失 500→404、llm.chat 重试耗尽显式 RuntimeError、main uid=None 不进 owns_uid、db 直摸 taxonomy._alias_idx 改 alias_index() 访问器）+ 等价改写 + cv2/pypdf 可选依赖定点豁免。
- 新增 backend/pyrightconfig.json（basic/py3.12）；门禁新增 `cd backend && npx -y pyright app`（基线 0 errors）。详见 docs/iter/round-3/r217-pyright-baseline.md。
- 后补回归测试：mock 报告成绩数据缺失 404 + llm.chat 5xx 显式抛错（tests/test_mock_report_missing_data.py，pytest 94）。

### R218（边缘无副本 5xx 直漏收口为品牌 503 + Retry-After，已部署）
- 取证：origin 24h 日志 verified 深页（/tiku/panduan/?page=254 等）在容器重启窗口 R205 单次重试失败后裸 502（origin Caddy text 错误页）直漏给爬虫/用户；重启窗口 15–25s 单次重试无法全覆盖。
- 收口：edge-policy 新增纯函数 shouldServeOutage（仅 GET/HEAD、非 /api、无副本、status 0/502–504）；[[path]].js 重试耗尽后改出自包含品牌 503 页（Retry-After: 30 + meta refresh 30s + 返回首页 + 深浅色适配，no-store 不入缓存）。/api 5xx 契约与有副本 stale-if-error 路径零变化。
- 明确不做：不扩重试次数/时长；不动 /api 语义；origin 零停机部署挂候选（2GB 共享机双容器窗口风险）。详见 docs/iter/round-3/design-r218-edge-outage-503.md。

### R219（运维审计状态外显到管理台，已部署）
- 取证 verified：R203/R212/R214/R216 建立的部署/生命周期/备份/R2/内存审计数据只在 VPS 三个日志文件里（SSH 才可见），管理台看板无任何运维状态区块；日志已有真实告警行（如 09-01 UNHEALTHY api=000）无人可见。
- 收口：ops 日志迁至 /home/ubuntu/kaogong-reports/（与部署/生命周期同目录，旧日志已 cp 迁移 + 原文件留 .migrated-r219）；compose 只读挂载该目录为 /reports；新增 backend/app/ops_status.py 尾部容错解析（64KB tail、CST/UTC 双时间轴、FAILED/DISK HIGH/UNHEALTHY/SIZE MISMATCH 告警正则）+ `/api/admin/ops_status`（check_admin 门禁，OPS_REPORTS_DIR 可配）；看板新增「运维状态」卡（部署 rev/备份/恢复验证/R2 周验证/内存/24h 容器变更/近 7 天告警）。
- 验证：pytest 98（+4 例解析器）/ruff/pyright 0/lint/vitest 128/build 全绿；生产 rev dcb87b7 实测无 token 401、带 token 返回全部真实审计数据（backup/restore/r2 ok、24h 容器变更 9 次、告警 1 条），看板卡 1440/375 均渲染（375 下管理台整体 min-width 768 横向溢出为存量桌面化设计，非本轮引入），性能预算全过。
- 明确不做：不动告警阈值；不加外部通知通道（挂资源项）；不回溯已轮转日志。详见 docs/iter/round-3/design-r219-admin-ops-status.md。

### R220（管理台 ≤767px 手机档，已部署）
- 取证 verified：/admin 375×667 横向溢出 408px，根因 admin.css `body{min-width:768px}`；受控移除 R219 运维卡溢出不变，证实存量布局缺陷；既有响应式只有 ≤1023 平板档（64px 图标侧栏）。
- 收口（纯 CSS + 1 行 HTML）：admin.css 追加 `@media(max-width:767px)` 手机档——body min-width 解除、topbar search 隐藏、content padding 12、pagehead/row/filterbar 换行、kpis minmax(140px,1fr)!important（覆盖 dedup/governance 页内联 repeat(4,1fr)）、drawer 100vw、`.tbl-wrap,.card{overflow-x:auto}`+`table.tbl{min-width:640px}` 表格容器内横滚（questions 等页表格直接渲染在 .card 内不在 .tbl-wrap）。
- 缓存击穿：index.html 的 admin.css 链接原本无 `?v=`，后端 mtime 重写机制不生效，边缘缓存旧 CSS；补 `?v=r38` 收口（部署后实测重写为 mtime 版本号）。
- 验证：本地全绿（ruff/pytest 98/pyright 0/lint/vitest 128/build）；生产 375/320 全部 12 个管理台路由 scrollWidth-clientWidth=0，1440 桌面零变化（min-width:768 仍生效、侧栏 232px）。
- 明确不做：侧栏抽屉/汉堡菜单（需 JS）、管理台深色模式（挂候选）。

### R221（/api/admin/batches 慢查询收口，已部署）
- 取证 verified：origin 24h 慢请求中 /api/admin/batches 8 次 6.0–7.6s；生产只读 DB 实测 GROUP BY import_batch 全表扫 2.8s（questions 15 个索引无一覆盖 import_batch）+ 50×batch_answer_dist 各 0.11s，与线上耗时吻合；distinct batch=1000。
- 收口：db.py 追加覆盖索引 idx_q_batch(import_batch, disabled, is_real, answer)，聚合与 answer 分布均整索引覆盖不回表；零查询改写零契约变化。备份副本实测建索引 2.3s、全查询 6–8s→0.01s。
- 验证：本地全绿（ruff/pytest 100(+2 查询计划例)/pyright 0/lint/vitest 128）；生产 rev 1fe2a48 部署后 /api/admin/batches 实测 0.11–0.19s，索引已建。
- 明确不做：governance_scan（600s 缓存兜底，Python 逐行体检 SQL 化挂候选）；/api/exam/* 历史 502 根因证据仍不足（unknown，不猜测性改动）。详见 docs/iter/round-3/design-r221-admin-batches-index.md。

### R222（管理台重查询缓存 stale-while-revalidate，已部署）
- 取证 verified：/api/admin/governance 慢请求 4.0–7.1s 全部为 `_cached` 600s TTL 过期后的同步重算路径（Python 全表逐行体检），即每 10 分钟必有一个管理台请求吃 4–7s；`_cached` 同时服务 dashboard(300s) 等重查询，且无锁有同键小惊群。
- 收口：`_cached` 对齐 `_pick_pools` 语义——过期先回旧值 + 后台单飞重算，冷 miss（进程启动后首次）仍同步且 build 锁防惊群；零调用方/契约改动。+4 例 pytest（旧值不阻塞/单飞/冷 miss/重算异常不污染缓存）。
- 验证：本地全绿（ruff/pytest 104/pyright 0）；生产 rev 35f6e11 部署后 governance 冷 miss 4.1s（仅重启后首次）、后续 0.07–0.25s；性能预算全过。
- 明确不做：不 SQL 化 governance_scan（独立候选）、不加常驻预热线程（2G 内存高压宿主）。详见 docs/iter/round-3/design-r222-admin-cache-swr.md。

### R223（管理台无障碍收口，已部署）
- 取证 verified：生产认证 axe（12 个管理台路由 × 1440）全部存在 serious 级 color-contrast 违规（重复根因为 admin.css 全局 token：--t3/--t4/状态色/模块色低于 WCAG AA），另有 questions/comments/review/users/settings 表单控件缺 accessible name、侧栏 4 组 nav landmark 未唯一命名、`.main` 非语义 main、多处操作列空表头。
- 收口（纯 admin 静态资源，零 API/路由/行为变化）：① 全局颜色 token 提对比度（--t3 #5D6270、--t4 #6E7280、success/error/warning/info 及模块色全部 AA 达标，dashboard 一处硬编码 warning 色改 token）；② 控件 aria-label（全选/行选 checkbox、模块/质量分/排序/举报状态 select、用户/公告/全局搜索输入框）；③ `<main class="main">` + 4 组 `<nav aria-label>`；④ 新增 .sr-only，操作/选择列空表头补隐藏文本。
- 返工两处：首轮生产 axe 残留 settings 公告表空表头（minor，已补 sr-only）；.sr-only 绝对定位在横滚表格 th 内以 html 为包含块，375 视口 4 路由页面级 scrollWidth 溢出 296–349px，`.tbl th{position:relative}` 收进包含块后清零。
- 验证：本地全绿（ruff/pytest 104/pyright 0/lint/vitest/build）；生产 rev 05496bd 部署后 12 路由认证 axe 全部零违规，1440/375 × 12 路由页面级溢出全 0，性能预算全过。
- 明确不做：管理台深色模式（挂候选）、SPA 端无障碍（此前已清零）、布局/交互重设计。详见 docs/iter/round-3/design-r223-admin-a11y.md。

### R224（管理台深色模式，已部署）
- 取证 verified：客户端 SPA 与 /tiku SSR 均已支持深色，管理台是全站唯一无深色适配界面（admin.css 无任何 prefers-color-scheme）；R220/R223 后 pages/*.js、core.js 零硬编码色，admin.css 硬编码 hex 仅剩表面色一类，深色模式收敛为「补 token + :root 重映射」低风险收尾。本轮 origin 24h 复审计无新增 verified 产品缺陷（/api/submodules 2–8s 慢样本来自共享 NAT 且查询实测 0.1s 索引覆盖 idx_q_pick，判定宿主瞬时争用为 inference，挂观察）。
- 收口（纯 admin.css 静态，零 API/JS/行为变化）：① 表面色 token 化（--th-bg/--row-hover/--toast-t/--mod-*-bg，#fff 面板底统一 var(--surface)）；② @media(prefers-color-scheme:dark) :root 重映射，色板对齐客户端 v3 深色 token（bg #15161C/card #1D1F28/fill #23252F/line #2B2E3A/状态色亮变体）；③ 白字压亮色组合定向覆盖（.pager a.on/.ck.on::after/侧栏 badge/toast 反色）；④ color-scheme:light dark 原生控件随主题。
- 验证：本地全绿（ruff/pytest 104/pyright 0/lint/vitest/build/bash -n）；生产 rev ffe8cdc 部署后 12 管理台路由 × light/dark 认证 axe 全零违规，dark 1440/375 × 12 路由页面级溢出全 0，性能预算全过。
- 明确不做：管理台手动三档主题切换（系统偏好足够，挂候选）；不动客户端/SSR 深色实现。详见 docs/iter/round-3/design-r224-admin-dark-mode.md。

### R225（storm guard 可观测性：X-Kg-Guard 头，已部署）
- 取证 verified：09-01 08:11–10:00 origin 日志 ~20.3k 条 /api/exam/* 404 风暴（submit ~10.1k + report/72|73|75 ~10.1k，X-Kg-Ip=140.232.64.5 共享 NAT、headless Chrome UA、Server: uvicorn 证实后端真实响应）期间**零 429**——ErrorStormGuard 未触发；当晚以相同三种请求形态在生产容器（127.0.0.1:8300，注意 8000 是无关 k12team）逐一实测均第 31 个起 429，守卫现行正常；风暴窗口与当前守卫代码零 diff。SPA 现行 submitFailPlan 对 404 直接 terminal，不会产生该风暴（风暴客户端为自动化浏览器属 inference）。守卫未触发根因 unknown：纯内存态 + 容器 stdout 随 autoheal 重建销毁，风暴期进程内部状态零留存。
- 收口（最小可观测性，不改守卫语义/阈值）：ErrorStormGuard.record() 返回记录后窗口计数；中间件对 /api status≥400 响应加 X-Kg-Guard: <计数> 头、守卫 429 加 X-Kg-Guard: blocked，2xx/3xx 不加头；Caddy origin 访问日志完整记录响应头（roll_keep 14 天），下次风暴可逐请求区分「ip 为空 / 计数不涨 / 到阈值未拦截」。
- 验证：本地全绿（ruff/pytest 106(+2)/pyright 0/lint/vitest/build）；生产部署后错误响应带计数头、第 31 个起 429+blocked、200 无头，Caddy 日志实际记录到该头。
- 明确不做：不改 threshold/window、不做根因未知的猜测性修复、不持久化守卫状态。详见 docs/iter/round-3/design-r225-storm-guard-observability.md。

### R226（边缘回源 X-Kg-Fetch 模式头，已部署）
- 取证 verified：24h origin 日志仅两条 5xx——09-01T18:19:39Z bingbot /sitemap.xml 502（0.02s，R223 部署容器重建窗口）与 14:00:51Z 爬虫 /tiku/panduan/?page=254 502；两条均单条记录（无 R205 重试对），且 /sitemap.xml 18:17:40 有部署预热 200 副本。origin 日志无法区分该 502 是「swr 后台刷新失败（用户已拿陈旧副本，无影响）」还是「MISS 同步回源（用户可见失败）」——与 R225 同类观测缺口，历史两条 502 是否外泄如实标 unknown。
- 收口（纯边缘函数，零响应/缓存/重试语义变化）：边缘每个回源请求附 X-Kg-Fetch 请求头：miss（可缓存无副本同步回源）/ pass（不可缓存透传）/ swr（后台刷新）/ retry（R205 重试第二跳），由 Caddy 访问日志（记录全部请求头，14 天）自然持久化。
- 验证：本地全绿（vitest 131(+3)/lint(src+tests+edge)/build/ruff/pytest 106/pyright 0）；生产部署后 origin 日志实录四种模式：novel 深页 miss、/api/stats pass、TTL 过期后台刷新 swr；受控重启窗口实测两条完整链：有副本页 客户端 200(STALE)+日志 502[swr]（即历史 sitemap 502 的无害形态），无副本页 502[miss]→502[retry]→客户端品牌 503，窗口结束恢复 200。1440/375 双视口溢出 0、console 0 error、性能预算全过。
- 明确不做：不回溯归因历史两条 502（证据不可得）、origin 不读取该头做行为分支。详见 docs/iter/round-3/design-r226-edge-fetch-mode-header.md。

### R227（管理台折叠侧栏导航可访问名称 + tooltip，已部署）
- 取证 verified：Playwright 768px 生产实测，admin.css ≤1023px 折叠图标栏下 `.side nav a .txt{display:none}`，全部 12 个侧栏导航链接可访问名称只剩 emoji（📊/📚/…），aria-label/title 均无——读屏用户听到的是 emoji 描述而非「数据看板/题库管理」，明眼用户悬停无 tooltip。axe link-name 不报（emoji 也算名称），R223 扫描在 1440 全宽下覆盖不到该形态。
- 收口（纯静态 admin/index.html + admin.css）：12 个导航 `<a>` 补 title tooltip；折叠态 `.txt` 由 display:none 改 sr-only 式 clip 隐藏（保留可访问性树，包含块为既有 position:relative 的 `<a>`，无 R223 溢出陷阱）。CSS 缓存由 admin_assets_version() mtime 重写自动生效，无需手动 bump ?v。
- 验证：本地全绿（ruff/pytest 106/pyright 0/lint/vitest 131/build）；生产 rev 964f0c1 实测 1440 全宽零变化（.txt static 可见）、768/375 折叠态 12 链接名称全为完整中文 + title 齐全、375 溢出 0；768 的 15px「溢出」为存量 body{min-width:768px}+滚动条固有形态（widest 元素即 body），非本轮引入。性能预算全过。
- 本轮复审计其余结论：近 7 天 slow_load 46/47 样本无 `;v:` 版本戳（旧 bundle 客户端族群，boot 心跳同期版本戳齐全），当前 bundle 无新 verified 缺陷；/api/admin/governance 单条 4s 样本证据不足不改动，挂观察。

### R228（管理台侧栏可访问名称静态契约回归测试，测试+docs，无部署）
- 取证：24h origin 复审计——20.5k /api/exam/* 404、562 条 502、146 条 429 全部对应历史 09-01 08:11–10:00 风暴（R225 部署前，X-Kg-Guard 头缺失符合预期）与共享 NAT 受控测试流量；X-Kg-Fetch 四模式（pass/swr/miss/retry）正常落日志，19:29 无副本深页 miss→retry→品牌 503 链路按 R218 设计工作。无新 verified 产品缺陷。
- 流程缺口收口：R227 修复只有生产 Playwright 验证、仓库零回归覆盖。新增 backend/tests/test_admin_nav_names.py 静态契约 2 例：12 个导航 title == .txt 文案；≤1023px 折叠块 .txt 不得 display:none 且须 clip 式 sr-only。受控验证：改回 display:none / 删 title 均失败，还原后通过。顺带修正 design-r227 文档「13 个 <a>」为 12。
- 本地全绿（ruff/pytest 108(+2)/pyright 0/lint/vitest 131/build）。详见 docs/iter/round-3/design-r228-admin-nav-regression-test.md。

### R229（管理台重查询缓存启动预热）
- 取证 verified：近 3h origin 无外部用户 5xx（9 条 502 为共享 NAT 受控探针集束）；17:39–17:44 的 /api/admin/batches 6–7s 样本时间戳在 R221 索引部署之前，当前实测 0.05–0.16s（idx_q_batch 在库生效，非回退）；/api/admin/governance 实测首次命中 5.1s、随后 0.16s——R222 设计中的「进程启动后首次同步冷 miss」，而 container-events.log 显示当日容器重建 ≥8 次（每次部署都重建），每次重启后首个管理员请求都承担秒级冷查询。
- 收口：main.py `_prime_admin_caches()`（预热 admin_dashboard/governance_scan 两个 `_cached` 键），`_warmup` 线程进循环前一次性调用；不做周期化重复预热（governance 全表体检 ~3–5s CPU，2G 高压宿主不引入常驻后台负载，与 R222 按需+SWR 语义一致）。零契约变化。
- 验证：pytest 新增 test_startup_prime_fills_admin_caches（预热后两键在缓存、后续调用直接命中不再同步构建）；本地全绿（ruff/pytest 109(+1)/pyright 0/lint/vitest 131/build）。详见 docs/iter/round-3/design-r229-admin-cache-startup-prime.md。

### R230（/api/admin/stats 接入 SWR 缓存并纳入启动预热）
- 取证 verified：R229 部署后近 2h origin 所有 >3s 慢样本全部为 /api/admin/stats（2.0–5.1s × 8 条，管理台首屏必请求端点），governance/dashboard/batches 已 0.13–0.27s；代码实证 db.admin_stats() 直查 156k questions 全表 5 次 COUNT（含 hs_explanation 文本扫描）+ 多表聚合，无任何缓存。另验证 R205/R218 链路正常：19:43 外部爬虫深页 502[miss]→2s 后 200[retry]。
- 收口：admin_stats() 改 `_cached("stats", 300, _admin_stats_uncached)`（复用 R222 SWR），并加入 R229 `_prime_admin_caches()` 启动预热清单。零契约变化；300s 陈旧度与 dashboard 一致，POST /api/admin/refresh_stats 是题目统计重算与本缓存无关。
- 验证：test_startup_prime_fills_admin_caches 扩为三键；本地全绿（ruff/pytest 109/pyright 0/lint/vitest 131/build）。详见 docs/iter/round-3/design-r230-admin-stats-swr-cache.md。

### R231（/llms.txt 站点导览）
- 取证 verified：R230 部署后 origin 日志 stats/dashboard/governance/batches 全部亚秒（0.005–0.099s），管理台慢端点收口确认；`/llms.txt` 历史被请求 66 次全部 404（来源为共享 NAT IP，外部真实需求 unknown），站点已具备 robots/sitemap/公开页族但缺 llmstxt.org 标准的 LLM 爬虫站点导览文件。
- 收口：seo.py 新增 GET /llms.txt（静态 Markdown：站名+摘要+五模块 hub/papers/daily/discuss/sitemap 链接，text/markdown，无 DB 查询）；edge-policy.js 把 /llms.txt 与 robots/sitemap 同组纳入边缘缓存（isCacheableContentType 新增接受 text/markdown）。
- 验证：pytest 新增 test_llms_txt.py（状态/类型/链接契约）、vitest edge-policy 断言扩展；本地全绿（ruff/pytest 110(+1)/pyright 0/lint/vitest 132(+1)/build）；生产实测 200 + text/markdown + X-Edge-Cache HIT，1440/375 双视口溢出 0、console 0 error，性能预算全过。详见 docs/iter/round-3/design-r231-llms-txt.md。不声称已产生任何收录/流量效果。

### R232（空模块 SSR hub 品牌 404 + 边缘 SWR 下架副本清除）
- 取证 verified：生产 /tiku/shenlun/ 返回 200、带 canonical 无 noindex，正文「申论题库（0 题）」；/api/questions?module=shenlun 0 题、sitemap 与 /tiku/ 内链均已排除 shenlun——可猜测直达的空洞门页（thin content + 用户死胡同）。tiku_submodule 已有空结果 404 守卫，tiku_module 缺失，属不一致缺口。
- 收口一（seo.py）：tiku_module 在 _count_questions(module)==0 时返回既有 _not_found("该模块暂无题目")（品牌 404 + noindex + 出路），有题模块/API/301 行为零变化；不删 kb.MODULES["shenlun"]（App 内申论专区仍依赖）。
- 收口二（边缘，部署后追加取证发现）：origin 已 404 但边缘持续回旧 200 副本——revalidate() 仅 200 覆盖、404 直接 return，旧副本永久驻留且每次 SWR 续命。改为 404/410（origin 确定性下架答复）时 caches.default.delete(cacheKey)，下一请求同步回源；5xx/网络异常 stale-if-error 语义不变。
- 验证：pytest 新增空模块 hub 404/noindex + 有题模块 200 回归；vitest edge-handler 新增「后台刷新遇 404 清副本 → 下一请求 404」集成例。本地全绿（ruff/pytest 111(+1)/pyright 0/lint/vitest 133(+1)/build）；生产 rev d384fce 部署后实测 /tiku/shenlun/ 首访回旧副本随即清除、后续稳定品牌 404+noindex，/tiku/changshi/ 200，1440/375 双视口溢出 0、console 仅页面自身 404 资源行，性能预算全过。详见 docs/iter/round-3/design-r232-empty-module-404.md。

### R233（空模块 404 页补 App 专区直达出路）
- 取证 verified：本窗口 origin 无新缺陷（78 条 >1s 全部为部署 prime 触发的 SWR 并发回源、4 条 502 中 3 条自有探针 1 条爬虫 retry 后恢复 200）；App 内存在完整申论专区（pkgA/shenlun：真题题库+素材范文+在线作答），而 /tiku/shenlun/ 品牌 404 只给通用出路——搜索申论的用户被引向行测入口，产品真实能力被藏起来的死胡同。
- 收口（seo.py）：_not_found 增可选 cta_html 槽位（默认空、既有调用零变化）+ _EMPTY_MODULE_OUTLET 映射（当前仅 shenlun），空模块 404 页顶部给「申论专区：历年真题 + 素材范文 + 在线作答 →」.cta 直达 /#/pkgA/shenlun/shenlun；404 状态/noindex/无 canonical/通用出路不变。
- 验证：pytest +1 例（空模块 404 含 CTA、通用 404 不含），112 passed/ruff/pyright 0；前端门禁回归全绿。详见 docs/iter/round-3/design-r233-empty-module-outlet.md。

### R234（/tiku 公开页文案计数口径校正）
- 取证 verified：生产库 shenlun 0 题，而 /tiku/ 与 /tiku/discuss/ 的 description/JSON-LD/正文写「收录 113107 道行测申论题目」——total 只统计行测五模块，计数口径不实；本窗口 origin 无新缺陷（慢样本/502/llms.txt 404 全部对应今日旧 rev 部署窗口，部署后消失，stats 现 0.24–1.5s、llms.txt 200）。
- 收口（seo.py）：四处文案「行测/申论题目」「行测申论题目」→「行测题目」，计数逻辑/路由/JSON-LD 结构不动。
- 验证：pytest +1 例（两页不得再现旧口径、/tiku/ 须现「道行测题目」），113 passed/ruff/pyright 0；前端门禁回归全绿。详见 docs/iter/round-3/design-r234-tiku-copy-accuracy.md。

### R235（部署容器重建窗口 origin 502 收口，纯 VPS Caddy 配置）
- 取证 verified：今日每轮部署的容器 Recreate 窗口（10–20s）内，无副本深页与 /api/track 均即时 502（dial 拒绝，duration 0.01–0.08s），爬虫/用户最终收品牌 503；同机 jobs.zalize.com 已有 lb_try_duration 成熟先例。
- 收口：/etc/caddy/Caddyfile 两个 kaogong 块 reverse_proxy 127.0.0.1:8300 增加 lb_try_duration 25s + lb_try_interval 1s（拨号失败窗口内重试，POST 安全；备份 Caddyfile.bak-r235），validate+reload。
- 验证：受控 docker stop 10s 演练，/api/health 停机窗口内请求等待 12.4s 后 200（原即时 502），容器恢复 healthy、公开页 200。仓库仅落文档（Caddyfile 为共享服务器配置，与 R85/R86 同口径）。详见 docs/iter/round-3/design-r235-origin-lb-retry.md。

### R236（申论真题公开 SSR hub：/tiku/shenlun/ 以真实语料恢复 200）
- 取证 verified：生产 shenlun_questions 实有 208 道申论真题（materials 166、answers 6，App 申论专区同源数据），R232 判 404 的依据只是 questions 表 xingce 计数；origin 日志 /tiku/shenlun/ 仍持续有爬虫 404 命中。
- 收口：seo.py tiku_module 对 shenlun 分流 _tiku_shenlun（shenlun_questions 语料呈现：年份/地区概览 chips + 题干列表 + 分页 + App 专区 CTA；不造详情/过滤子页）；/tiku/ 首页与 sitemap-pages 在语料非空时补入口；total=0 守卫回落品牌 404 + CTA（R232 语义不回退，R234 行测计数口径不动）。
- 验证：pytest +1 例（200 呈现 + 清空回落 404 双分支），114 passed/ruff/pyright 0。详见 docs/iter/round-3/design-r236-shenlun-public-hub.md。生产 rev b35aa31 实测 200 + canonical + 208 题、sitemap/首页入口就位、1440/375 溢出 0、console 0 error、性能预算全过。

### R237（部署预热清单补齐入口级公开页）
- 取证 verified：旧 rev 部署重建窗口内五大模块 hub（/tiku/yanyu/ 等）出现 502[miss]→502[retry]（R235 lb_try 生效前样本；R236 部署窗口零 502），deploy_h5.sh 3b 预热清单未覆盖模块 hub、R236 /tiku/shenlun/、R231 /llms.txt——这些入口页无自然流量副本时缺 stale-if-error 第一道退路。
- 收口：3b 清单追加五大模块 hub + /tiku/shenlun/ + /llms.txt（同语义可缓存 GET）；深层分页页不预热（数量无界，非入口级）。
- 验证：bash -n；下一次部署实跑 prime 行全 200。详见 docs/iter/round-3/design-r237-prime-coverage.md。生产 rev 1c5d827 部署实跑 12 个公开页 prime 全 200、性能预算全过。

### R238（管理台重查询端点外显缓存态头 X-Kg-Cache）
- 取证 verified：R230 后 origin 仍有 /api/admin/governance 5–8.8s、/api/admin/stats 2–6s 慢样本（含距容器重建 5 分钟的样本，按 R229/R230 设计应亚秒命中），但日志只有 duration，无法区分命中/回旧值/冷 miss——预热是否真正生效、慢样本是否宿主争用只能标 unknown。
- 收口：db._cached 拆出 _cached_state 返回 (data, cold|hit|stale)（语义零变化），stats/dashboard/governance 三端点响应加 X-Kg-Cache 头，借 Caddy origin 日志（14 天 resp_headers）逐请求持久取证（同 R225 X-Kg-Guard / R226 X-Kg-Fetch 手法）；仅管理端出头，公开端点不加。
- 验证：pytest +2 例（三态转换 + 端点头断言），116 passed/ruff/pyright 0。详见 docs/iter/round-3/design-r238-admin-cache-state-header.md。
- 生产 rev 69a0004：重启窗口内三端点全 hit（R229/R230 预热 verified 生效）；TTL 过期后实测 stats/dashboard `stale`(0.01–0.03s 回旧值)→下一请求 `hit`（后台刷新 verified）；经边缘访问 origin 日志 resp_headers 实录 X-Kg-Cache；错误令牌 401 无头。cold 态仅 pytest 覆盖（生产被预热吃掉，正是设计意图）。
- 另取证：R235 lb_try 实际实施时刻为 09-01 21:31 UTC（bak-r235），此前 21:04/21:26 仍有即时 502 属实施前样本；实施后历经 3 次容器重建（21:46/21:53/22:01）origin 零 502，R235 verified 生效。

### R239（deploy shell 脚本 shellcheck 门禁 + 存量清零）
- 取证 verified：24h origin 复审计无新产品缺陷（4xx 全为历史探针，/llms.txt、/tiku/shenlun/ 404 均早于对应轮部署时刻，当前 200；慢样本聚簇部署窗口属 lb_try 排队设计行为）；真实缺口为流程性——5 个 shell 脚本历轮只有 bash -n 纯语法检查，shellcheck 全量实扫 4 处，其中 kaogong-ops.sh SC2166（`[ p -o q ]` POSIX 未定义）触及 R2 周验证触发条件，属真实正确性风险。
- 收口：SC2166 重写为 `{ [ p ] || [ q ]; }`；SC1090/SC2012/SC2086 三处有意为之定点 directive 豁免并注明理由（对齐 R217 pyright 手法）。门禁基线：`shellcheck deploy/*.sh` 0 输出，与 bash -n 并列为 shell 变更验收项（本地门禁，不引入 CI）。
- 验证：shellcheck 0 输出 + bash -n 5 脚本全过；VPS 同步 kaogong-ops.sh/cron_access_report.sh 后 FORCE_R2_VERIFY=1 实跑，R2-VERIFY ok md5 match 正常入日志（重写后触发条件 verified）。详见 docs/iter/round-3/design-r239-shellcheck-gate.md。

### R240（/llms.txt 补申论真题库入口，对齐 R236）
- 取证 verified：R231 llms.txt 生成逻辑显式排除 shenlun 且导语只写行测五模块（早于 R236 申论 hub 恢复 200），生产实测无 /tiku/shenlun/ 条目——首页/sitemap/llms.txt 三个内容发现渠道口径不一致；本轮复审计无新缺陷（/tiku/shenlun/ light/dark×1440/375 axe 全零、溢出 0，Lighthouse 四项 1.00/LCP 930ms/CLS 0；origin 近 8h 5xx 全落旧部署窗口/共享 NAT 探针）。
- 收口：llms_txt() 与首页/sitemap 同守卫（shenlun_questions total 非零输出申论条目 + 导语补「历年申论真题」，清空自动回落）；不加申论子页链接（详情页不存在，防死链）。
- 验证：pytest +1 例（有语料出现/清空消失；清理用 DELETE——question UNIQUE 使 disabled 后无法 OR IGNORE 复种），117 passed/ruff/pyright 0。详见 docs/iter/round-3/design-r240-llms-shenlun.md。

### R241（站内搜索覆盖申论真题 + 申论专区 id 深链）
- 取证 verified：生产 /api/search?q=给定资料 返回全空——搜索只覆盖行测 questions/exam_papers/考点，208 道申论真题（R236 已恢复公开 hub）完全不可搜，申论关键词成站内死胡同；App 申论专区 openQ(id) 已具备详情能力但 onLoad 不收 id，无法从搜索直达。本轮 12h origin 复审计无新缺陷（5xx 全落 R235 lb_try 实施前的部署窗口；20:41 慢样本簇为部署 rsync/prime 窗口自致）。
- 收口：db.search_shenlun(q)（question/paper LIKE，disabled 守卫，≤5 条，208 行小表不建 FTS）+ api_search type in (all, shenlun) 附 shenlun 段；搜索页侧栏「申论真题」区块点击直达 /pkgA/shenlun/shenlun?id=N（onLoad 校验纯数字后 openQ）；不新增搜索 tab、不搜 shenlun_materials（挂候选）。
- 验证：pytest +1 例（命中字段契约/卷名命中/type=question 无申论段/清空为空），118 passed/ruff/pyright 0/lint/vitest 133/build。详见 docs/iter/round-3/design-r241-search-shenlun.md。

### R242（/tiku/shenlun/ hub 列表项逐题深链直达 App 详情）
- 取证 verified：hub 题目列表为纯文本 li 无逐题出口，唯一 App 出口为底部整页 CTA（进专区还需自行找题）；R241 已具备 /#/pkgA/shenlun/shenlun?id=N 深链能力。本轮 14h origin 复审计无新缺陷（14k /api/exam/* 404 全为 09-01 风暴与共享 NAT 受控测试，429 均为 rl() 路径）。
- 收口：_tiku_shenlun 每个 li 追加「去作答 →」深链（hash 片段路由，不新增可收录 URL，无 thin pages）；canonical/JSON-LD/sitemap/分页零变化，底部整页 CTA 保留。
- 验证：hub 回归测试补逐题深链断言，118 passed/ruff/pyright 0。详见 docs/iter/round-3/design-r242-shenlun-hub-deeplink.md。

### R243（申论详情 URL 同步 + 复制本题链接）
- 取证 verified：R241/R242 打通入向深链后出向缺失——App 内打开申论详情地址栏无 ?id，刷新回列表、复制地址栏只能分享到专区列表；详情页为全站唯一零分享出口的内容面（行测/PK/成绩单均有复制链接）。本轮 origin 复审计无新缺陷（慢样本聚簇部署重建窗口，为 R235 lb_try 排队设计行为；tag3 22s 样本落 21:25/21:47 部署窗口）。
- 收口：新增 src/shenlun-url.js 纯函数 buildShenlunUrl（对齐 R157 search-url 手法）+ shenlun.vue watch detail 经 history.replaceState 同步 ?id（打开/返回/切筛选全路径覆盖，刷新直达同题走既有 onLoad 校验）+ 详情头部「复制本题链接」（setClipboardData + toast，对齐 profile/pk 交互）。零后端/SSR/SEO 变化。
- 验证：vitest +1 文件（合法/非法 id 分支），lint/vitest/build/lint:edge/ruff/pytest 118/pyright 0 全绿。详见 docs/iter/round-3/design-r243-shenlun-detail-url-share.md。

### R244（站内搜索覆盖申论素材 + 素材库 mtype 直达过滤）
- 取证 verified：生产只读库 shenlun_materials 实有 166 条（政策理论 73/金句 41/案例 32/范文 20），App 素材 tab 已消费，但 /api/search 不覆盖素材——搜「乡村振兴」等主题词无任何素材命中（R241 明确挂候选项）。本轮复审计：/llms.txt 公网 200（历史 66 条 404 均早于当前 200 样本，属旧部署窗口）；R243 详情复制/返回控件生产键盘可达（tabindex=0 + Enter 触发 toast）；origin 502/慢样本均落部署窗口。
- 收口：db.search_shenlun_materials(q)（topic/content/source LIKE + disabled 守卫，≤10 条，166 行小表不建 FTS）+ api_search 附 shenlun_mats 段；搜索页新增「申论素材」区块（topic+类型徽标+内容 clamp 3 行），点击直达 /pkgA/shenlun/shenlun?tab=m&mtype=<type>（MTYPES 白名单校验后置 mtype 再 switchMat）；不做素材单条落地页/SSR 页，SEO 零变化。
- 验证：pytest +1 例（topic/content 命中、disabled 排除、type=question 无素材段、清空为空），119 passed/ruff/pyright 0/lint/lint:edge/vitest 135/build 全绿；生产 1440/375 实测素材区块 5 条渲染、点击直达素材 tab 且「政策理论」chip 激活+列表过滤、溢出 0、console 0 error、性能预算全过。详见 docs/iter/round-3/design-r244-search-shenlun-materials.md。

### R245（搜索页补「申论」筛选 tab）
- 取证 verified：/api/search type=shenlun 后端分支（R241/R244）已返回 {q, shenlun, shenlun_mats}，搜索页 onLoad tab 白名单/syncUrl/showSec('shenlun') 全部现成，但 TABS 无申论项——用户无法只看申论结果。本轮 origin 复审计无新缺陷：近窗口 5xx 与 container-events.log 容器重建时刻逐条对时吻合（全为今日 R241–R244 部署窗口，边缘按 R218/R226 出 miss→retry→品牌 503 链），容器 RestartCount=0/OOM=false。
- 收口：TABS 追加 { k:'shenlun', n:'申论' }，1 行改动，其余走既有链路（请求 &type= 透传/区块显隐/空态/深链白名单/URL 同步）。不改后端，SEO 零变化。
- 验证：lint/vitest/build + ruff/pytest 119 全绿；生产 1440/375 实测 tab 渲染、点击后仅申论区块、URL 带 tab=shenlun、深链刷新 tab 激活、溢出 0、console 0 error、性能预算全过。详见 docs/iter/round-3/design-r245-search-shenlun-tab.md。

### R246（搜索素材命中 mid 深链直达具体素材）
- 取证 verified：R244 搜索素材点击只带 mtype 进类型列表首页（分页 20 条），命中素材 id 在最后一跳被丢弃；政策理论 73 条时目标素材可能翻数页才可见（id=35 实测不在该类型首页 20 条内）。
- 收口：db.shenlun_materials 增可选 mid 参数（AND id=?，disabled 守卫不变）+ /api/shenlun/materials 增可选 id 透传；搜索页 goShenlunMat 追加 &mid=<id>；申论页 onLoad 纯数字校验 pinMid，loadMats 首屏后命中项不在当前页则按 ?id= 拉单条，置顶+去重+自动展开+「搜索命中」角标（仅本次会话置顶，不改常规排序）；单条拉取失败不阻断列表。不新增素材详情页，SSR/SEO 零变化。
- 验证：pytest +1 例（id 单条命中/下架 id 空），120 passed/ruff/pyright 0/lint/vitest 135/build 全绿；生产 rev ad2ebb0 1440/375 实测目标素材置顶展开带角标、chip 激活、单条兜底路径 verified、无 mid 入口无角标零变化、?id=999999 空 items、溢出 0、console 0 error、性能预算全过。详见 docs/iter/round-3/design-r246-search-mat-mid-deeplink.md。

### R247（申论素材卡「复制素材链接」出向分享）
- 取证 verified：R246 打通入向 mid 深链后，App 素材卡无任何出向出口（真题详情侧 R243 已有对称能力）；生产实测 mtype 双重编码边界（搜索跳转后 URL mtype=%25E6...）功能无害——chip 激活/类型过滤/目标命中均正常，不做猜测性修复。
- 收口：shenlun-url.js 增纯函数 buildShenlunMatUrl(id, type)（非法 id 回落 ?tab=m）+ 素材卡 m-foot「复制链接」控件（role=button + aria-label，对齐 d-copy 样式），收链接端走 R246 既有 mid 置顶展开链路。零后端/SSR/SEO 变化。
- 验证：vitest +2 例（合法/非法 id 与 type 编码分支），137 passed/lint/build 全绿（后端零改动）；生产 rev 22d2532 1440/375 实测复制控件可点、剪贴板实读完整 origin+hash 深链、新开链接目标素材置顶展开带「搜索命中」角标、溢出 0、console 0 error、性能预算全过。详见 docs/iter/round-3/design-r247-shenlun-mat-share-link.md。

### R248（/tiku/shenlun/ hub 首页外显申论素材库板块）
- 取证 verified：生产 shenlun_materials 166 条（政策理论 73/金句 41/案例 32/范文 20）已具备搜索/深链/分享全链路（R244–R247），但公开 SSR hub /tiku/shenlun/ 仅底部 CTA 文案提及素材，素材资产对搜索引擎/未装 App 用户零外显。
- 收口：db.shenlun_material_type_counts()（disabled 守卫 + 排除空类型，按数量降序）+ _tiku_shenlun 第 1 页渲染「申论素材库（N 条）」卡片，各类型链接 /#/pkgA/shenlun/shenlun?tab=m&mtype=<quote(type)>（hash 深链不新增可收录 URL）；空 counts 整卡不渲染，分页页不重复；canonical/JSON-LD/sitemap/分页零变化。
- 验证：pytest +1 例（板块存在/mtype 链接/素材清空不渲染），121 passed/ruff/pyright 0；生产 rev 4813237 实测 hub 素材板块 166 条 + 4 类型链接（page=2 无板块），1440/375 点击类型链接直达 App 素材 tab 且「政策理论」chip 激活过滤 20 条、溢出 0、console 0 error、性能预算全过（/ perf 0.99、/tiku/ perf 1.00）。详见 docs/iter/round-3/design-r248-shenlun-hub-materials.md。

### R249（内容发现渠道口径对齐：首页/llms.txt/hub 元信息补素材库）
- 取证 verified：R248 上线后 /tiku/ 首页申论条目与 /llms.txt 申论条目仍只写真题、零素材提及；/tiku/shenlun/ meta description 与 JSON-LD description 只写「共 N 题」，与页面正文素材板块不一致（对照 R234/R240 口径一致先例）。
- 收口：三处均以真实计数守卫（素材清空自动回落纯真题口径）——_tiku_index 申论 section 补「另收录申论写作素材 N 条（类型清单）」；llms_txt 申论条目追加「；另收录 N 条写作素材（按类型归档）」；_tiku_shenlun 第 1 页 description/JSON-LD 追加「另有写作素材 N 条。」（分页页不带）。canonical/sitemap/分页零变化，不新增素材 URL。
- 验证：pytest +1 例（三渠道口径存在/清空回落/分页页不带），122 passed/ruff/pyright 0；生产 rev 4111a11 实测三渠道文案就位（166 条）、page=2 不带、1440/375 溢出 0、console 0 error、性能预算全过（/ perf 0.99、/tiku/ perf 1.00）。详见 docs/iter/round-3/design-r249-material-discovery-copy.md。

### R250（申论按年份真题页 /tiku/y/{year}/shenlun/ + hub 年份链接 + sitemap-years 收录）
- 取证 verified：生产 208 题分布 12 个年份（2026:26/2025:51/…/2015:10，每年 5–51 题非 thin）；行测五模块自 R201 有 /tiku/y/{year}/{module}/ 年份页族，而申论 hub「覆盖年份」只是纯文本 span、无对应页面、sitemap-years 零覆盖。先做慢样本复审计：admin stats/governance 慢样本均落旧 rev 部署窗口/共享宿主争用（X-Kg-Cache 佐证当前 hit/stale 亚秒），非代码缺口，不做猜测性改动。
- 收口：db.shenlun_year_counts()（disabled 守卫 + exam_year 非空）；seo.py /y/{year}/{module}(/) 对 shenlun 分流 _render_shenlun_year（复用 shenlun_questions(year=...)，列表项与 hub 共用 _shenlun_q_items 抽出、逐题去作答深链、_pager、其他年份内链、面包屑、CollectionPage JSON-LD、App CTA；无语料年份品牌 404、无斜杠 301）；hub 年份 chips 改真实计数链接；sitemap-years.xml 收录申论年份页（语料清空自动消失）。不做地区/题型子页。
- 验证：pytest +1 例（200+计数+深链+canonical/301/hub 链接/sitemap 收录/无语料 404/越界页码 404/清空回落），123 passed/ruff/pyright 0；生产 rev e49fea0 实测 2023（24 题）/2026（26 题）200、1999 404、越界 404、无斜杠 301，light/dark×1440/375 axe serious+ 全零、溢出 0、console 0 error，性能预算全过（/ perf 0.99、/tiku/ perf 1.00）。部署后即查 hub/sitemap 无新链接为边缘 SWR 旧副本（观测陷阱：TTL 300s 过期后复验 hub 12 年份链接 + sitemap 12 条申论条目就位，非代码缺口）。详见 docs/iter/round-3/design-r250-shenlun-year-pages.md。PR #438。

### R251（申论按题型真题页 /tiku/shenlun/{题型}/ + hub 题型链接 + App qtype 深链）
- 取证 verified：生产 208 题按题型分布：贯彻执行 55/归纳概括 55/大作文 43/综合分析 36/提出对策 19（五类全 ≥19 非 thin）；行测有 /tiku/{module}/{子题型}/ 页族入 sitemap-pages，申论 hub 正文/meta 反复提「概括、对策、公文、大作文等题型」却无任何题型页与入口；/tiku/shenlun/{qtype}/ 现状走行测 questions 表计数 0→404 分流安全；App 申论专区已有 QTYPES chips+qtype API 筛选但 onLoad 不收 ?qtype。
- 收口：db.shenlun_qtype_counts()（disabled 守卫+排除空 qtype，按量降序）；seo.py tiku_submodule 对 shenlun 分流 _render_shenlun_qtype（真实计数+shenlun_questions(qtype=...) 列表、_shenlun_q_items 逐题去作答深链、_pager、其他题型内链、面包屑、CollectionPage JSON-LD、canonical、App ?qtype CTA；未知题型/清空/越界页码品牌 404，无斜杠 301 前置存在性守卫防 301→404 链）；hub 增「按题型刷题」卡（计数链接）；sitemap-pages 收录（清空自动消失，不做题型×年份/地区交叉）；shenlun.vue onLoad 收 opts.qtype（QTYPES 白名单校验后走既有 setQtype）。
- 验证：pytest +1 例（200+计数+深链+canonical+qtype CTA/301/hub 链接/sitemap 收录/未知 404/无斜杠未知 404/越界 404/清空回落），124 passed/ruff/pyright 0/前端 lint/vitest 137/build；生产 rev c1526d8 实测归纳概括页 200（55 题）+canonical+CTA、未知题型 404、无斜杠 301，hub/sitemap 部署后即查为边缘 SWR 旧副本（TTL 过期后 hub 5 题型链接+sitemap 5 条就位），light/dark×1440/375 axe serious+ 全零、溢出 0、console 0 error，App ?qtype 深链 chip 激活+结果按类型过滤，性能预算全过（/ perf 0.98、/tiku/ perf 1.00）。详见 docs/iter/round-3/design-r251-shenlun-qtype-pages.md。

## R252（申论年份/地区筛选深链闭环，PR #440）
- 取证：208 题分布 15 地区（国考 103/江苏 16/北京 16/四川 14…尾部 3–5 题）；R250 年份页 CTA 无 ?year、hub 地区 chips 纯文本；App 已有 setYear/setRegion + API year/region 但 onLoad 不收。
- 收口：年份页 CTA ?year={year}；hub 地区 chips 改 App ?region 深链（hash 深链不新增可收录 URL，不做地区 SSR 页族——thin page 风险且行测无先例）；shenlun.vue onLoad 在 loadFilters() 返回后按真实 filters 白名单应用 year/region，非法忽略。
- 本地：ruff/pytest 124/pyright 0/lint/vitest 137/build/shellcheck 全绿。
- 生产 rev faaae5c：年份页 CTA ?year=2023 就位；hub 首查为边缘 SWR 旧副本（已知 TTL 形态），nocache 实证 origin 已出 15 个 ?region 链接；App ?year=2023 → 2023 chip 激活列表全 2023、?region=江苏 → 江苏 chip 激活列表全江苏、非法 year/region 忽略与无参一致；light/dark×1440/375 溢出 0、console 0 error、axe serious/critical 0；Lighthouse 预算全过（/ 0.99、/tiku/ 1.00）。
- 验证陷阱：hash SPA 同 page 连续 goto 不重跑 onLoad，深链复验须每例新开 page（r252app.py）。
- 复审计：05:05–05:47 慢样本簇为共享宿主争用窗口（探针 22s 与静态/health 同窗齐慢，06:00 后恢复 0.3–1.0s），非代码缺陷不改。

## R253（申论按套卷详情页 /tiku/shenlun/p/{paper}/，PR #441）
- 取证（生产只读库 /data/data.db）：208 题分布 49 套卷（paper 全非空，每套 3–5 题）；distinct(material)=49 与 paper 一一对应——一套卷一份给定资料；material 平均 7134 字（最短 4714）、reference 平均 372 字，无空值。现状缺口：hub/年份/题型三页族只出题干 80 字截断，给定资料+参考解析（内容资产主体）公开页零外显。
- 收口：db.shenlun_paper_counts()/shenlun_paper_questions(paper)；/tiku/shenlun/p/{paper}/ SSR（面包屑+给定资料一次呈现+逐题卡 details 参考解析+逐题去作答深链+其他套卷内链+CollectionPage JSON-LD+App CTA；未知/清空套卷品牌 404，无斜杠 301 前置存在性守卫）；_shenlun_q_items 卷名改套卷页链接；hub 第 1 页「按套卷刷题」卡；sitemap-pages 收录 49 套卷 URL（清空自动消失）。不做逐题详情页（同套 4–5 题共享 7k 字材料会产生重复正文）、不做套卷×题型交叉页。
- 本地：ruff/pytest 125(+1)/pyright 0/lint/vitest 137/build/shellcheck 全绿。
- 生产 rev e8a2327：套卷页 200（2025国考·副省级 5 题、38KB、canonical 编码正确）、无斜杠 301、未知套卷带/无斜杠均 404、hub 套卷链接与 sitemap 条目就位（nocache 实证）；light/dark×1440/375 溢出 0、console 0 error、axe serious/critical 0、5 个 details.ans 就位；Lighthouse 预算全过（/ 0.98、/tiku/ 1.00）。

## R254（内容发现渠道口径对齐：套卷/题型页族入 /tiku 与 llms.txt，PR #442）
- 取证：R253 上线后 llms.txt 申论条目仍写「按年份/地区归档」——地区并无 SSR 页族（R252 决策仅 App 深链），口径不实；且题型（R251）/套卷（R253）页族未提及；/tiku/ 首页申论 section 无套卷/题型入口提示（grep shenlun/p/ = 0）。同窗口 origin 6h 复审计：5xx 5 条与 >10s 慢样本簇均落 20:41/21:26 共享宿主争用窗口（静态/health 同窗齐慢，X-Kg-Fetch swr/pass 佐证），无新产品缺陷。
- 收口：纯文案两处——llms.txt 申论条目与 /tiku/ 首页申论 section 改「按套卷（含给定资料与参考解析）、年份、题型」口径；沿既有语料非空守卫。零路由/契约变化。
- 本地：ruff/pytest 125（R249 用例 +3 断言）/pyright 0 全绿（后端-only 改动）。
- 生产 rev 5021594：两渠道新口径就位（nocache 实证）、light/dark×1440/375 溢出 0、console 0 error、axe serious/critical 0、性能预算全过（/ 0.99、/tiku/ 1.00）。详见 docs/iter/round-3/design-r254-discovery-copy-paper-alignment.md。

## R255（IndexNow 主动提交覆盖非题目 SSR 页族，PR #443）
- 取证：_indexnow_cycle 只推 /tiku/q/*（游标）+ 首轮一次性 4 个核心页；R201 以来新增的模块 hub/子题型/考点/年份/申论 hub/题型/套卷/papers 详情/daily 归档全部只进 sitemap，从未主动提交。R89 立项结论不变：零外链新站，IndexNow 是触发联盟引擎抓取的唯一可行通道。
- 收口：sitemap 三个非题目端点抽出 _sitemap_page_urls/_sitemap_topic_urls/_sitemap_year_urls 纯列表构造（端点行为零变化）；_indexnow_submit_pages 拼接首页+三族 URL，sha256 与 seo_meta['indexnow_pages_hash'] 比对，集合变化时单批提交（当前 529 条 << 单批上限 10000），未变化零提交不刷 API。题目游标通道不动。
- 本地：ruff/pytest 127(+2)/pyright 0 全绿（后端-only）。
- 生产 rev cf92cfb：容器启动 120s 后实录 `[indexnow] submitted 529 urls -> 200`，seo_meta 落 indexnow_pages_hash；接口回归全 200、Lighthouse 预算全过（/ 0.99、/tiku/ 1.00）。提交 ≠ 抓取 ≠ 收录，效果不做任何声称。详见 docs/iter/round-3/design-r255-indexnow-page-families.md。

## R256（seo.py 单文件拆包为 app/seo/ 包，PR #444）
- 取证：backend/app/seo.py 膨胀至 1802 行，聚合五类职责（公共 helpers/行测页族/申论页族/站点文件/分享落地页），R236–R255 每轮申论改动都要在单文件内定位 render/route/sitemap 三处。外部引用面小：main.py 仅 router/root_router/_not_found；tests 仅 _url/_sitemap_*/_indexnow_*。
- 收口：纯移动式拆包 app/seo/{common,pages,shenlun,catchall,landings,sitefiles}.py；__init__.py 显式导入顺序 shenlun→pages→catchall→landings/sitefiles（Starlette 按注册顺序匹配，/{module} 兜底必须最后，注释+isort: skip 防字母序重排）并 re-export 全部兼容符号。唯一测试调整：test_seo_landing.py monkeypatch 目标改 seo.sitefiles._indexnow_post（函数物理位置移动）。
- 坑：common.py 须 `from .. import db, kb`（`from .` 会在部分初始化的 app.seo 包上解析触发循环导入）。
- 行为零变化实证：pre/post TestClient 对 19 个 SEO/站点文件端点 sha256 逐一比对全部字节一致（/ 为静态 mount 非本包路由，worktree 无构建产物差异与拆包无关）。
- 本地：ruff/pytest 127/pyright 0 全绿（后端-only）。
- 生产 rev 6d8c95c：容器内确认 seo/ 包就位、旧 seo.py 不存在；19 端点状态语义全对（含题型/年份/套卷页 200、无斜杠 301、未知模块 404）、sitemap 四端点与 robots/llms/indexnow-key 200、IndexNow 无重复提交（URL 集合未变 hash 命中零提交，符合设计）；Lighthouse 预算全过（/ 0.99、/tiku/ 1.00）。详见 docs/iter/round-3/design-r256-seo-package-split.md。

## R257（容器 app-boot 窗口即时 502 收口：Caddy 主动健康检查，VPS 配置 + docs PR）
- 取证：R235 lb_try 只覆盖 dial 拒绝；09-01 origin 日志 9 条即时 502（0.01–0.08s）逐条与 container-events 对时全部落在新容器 StartedAt 后 ~1s——docker-proxy 已监听 8300 接受连接但 uvicorn 未就绪即重置，非 dial 失败不触发 lb_try 重试。
- 收口：两个 kaogong 站点块 reverse_proxy 增加 `health_uri /api/health` + `health_interval 2s` + `health_timeout 10s`（备份 Caddyfile.bak-r257，validate+reload）。boot 窗口上游被标 unhealthy → 请求进入既有 lb_try 25s 等待循环，健康后放行。health_timeout 取 10s 防共享宿主争用窗口误伤（实测争用时 health 可慢至 14s 级）。
- 演练 verified：`docker restart deploy-kaogong-1` 全窗口 12 条并发 nocache 请求全部等待（最长 12.3s）后 200，零 502（R235 演练时同场景为即时 502）。健康探针噪声 ~26/min/站点块，容器日志受 daemon.json 20m×3 轮转封顶。
- 回滚：恢复 /etc/caddy/Caddyfile.bak-r257 + reload。详见 docs/iter/round-3/design-r257-caddy-health-gated-upstream.md。

## R258（SEO 包路由注册顺序契约测试：测试补强，不部署）
- 取证：R257 上线后 origin 窗口零 5xx、无新产品缺陷；架构缺口为 R256 拆包的导入顺序副作用（shenlun→pages→catchall）仅注释约束，重排即 catch-all 吞掉具体页族且无测试防线。
- 收口：tests/test_seo_route_order.py 两例——按 endpoint.__module__ 断言 catchall 路由注册序号全大于具体路由 + TestClient 实测申论 hub/套卷/年份/题型页 200、未知模块 404。零产品代码变化。
- 本地：ruff/pytest 129(+2)/pyright 0 全绿。详见 docs/iter/round-3/design-r258-seo-route-order-contract.md。

## R259（周报 /tiku 页族分段补齐：观测治理，VPS 脚本同步）
- 取证：周报分段停留在 R184 四族，R236–R253 新页族（申论 hub/题型/套卷、daily、discuss、search、模块 hub）全落「其他/导航」——生产 7.5h 样本 381 条 /tiku 请求约 89% 无法归段。
- 收口：SEGMENTS 前缀首匹配表（长前缀在前）补 6 类新分段；统计口径/探针剔除/Top20 零变化。VPS 脚本已同步并实跑验证（探针剔除 81100 条后新分段正常归段）。
- 详见 docs/iter/round-3/design-r259-access-report-segments.md。

## R260（申论套卷筛选深链闭环：?paper 深链 + 套卷页 CTA 直达整套）
- 取证：R253 套卷页 CTA 只 ?id 直达第一题详情，本套其余小题需自行翻找；App 三维筛选缺「套卷」维度且 onLoad 不收 ?paper。
- 收口：/api/shenlun/questions 增可选 paper 精确过滤（契约向后兼容）+ 套卷页 CTA 改 ?paper= + App paper 状态/chip 外显可清除；逐题 ?id 深链不变。
- 详见 docs/iter/round-3/design-r260-shenlun-paper-deeplink.md。

## R261（申论列表卡套卷标签可点筛选 + paper 筛选 URL 同步）
- 取证：R260 后 App 内进入套卷筛选只有站外入口（SSR CTA/分享链接），列表卡 q-paper 纯展示；paper 状态不同步 URL（清除/切换后不可分享刷新）。
- 收口：shenlun-url.js 增 buildShenlunPaperUrl 纯函数 + 列表卡套卷标签可点（role=button，@click.stop）走 applyPaper 统一入口 + paper 变更 H5 replaceState 同步 URL（详情打开时让位 ?id，关详情回落 paper 深链）。
- 详见 docs/iter/round-3/design-r261-paper-tag-entry.md。

## R262（申论题型/年份/地区筛选 URL 同步）
- 取证：R251/R252 入向深链就位后，App 内 setQtype/setYear/setRegion 变更不同步 URL（复制地址栏得旧链接，刷新/分享丢筛选上下文），R261 只收了 paper 维度。
- 收口：shenlun-url.js 增 buildShenlunFilterUrl 纯函数（四维组合，缺省/非法不带参）；syncPaperUrl 升级为 syncFilterUrl，setQtype/setYear/setRegion/applyPaper/clearFlt 统一走它；detail watch 关详情回落完整 filter URL。
- 详见 docs/iter/round-3/design-r262-filter-url-sync.md。
## R263（申论专区 tab / 素材类型出向 URL 同步）
- 取证：R246/R251/R252 入向 tab/mtype/mid 深链就位后，App 内切 tab（素材/作答记录/回真题）与素材类型 chip 不同步 URL——地址栏停留旧筛选深链，刷新/分享丢 tab 与类型上下文（R262 明确挂起的对称缺口）。
- 收口：shenlun-url.js 增 buildShenlunTabUrl 纯函数（m/r tab + 非全部 mtype 编码）；filterUrl() 变 tab 感知；seg 点击改 tapQ/tapMat/tapRec（原逻辑+sync），setMtype 补 sync；onLoad 入向路径不动（?tab=m&mid 深链地址栏保留 mid）。
- 详见 docs/iter/round-3/design-r263-tab-url-sync.md。
## R264（申论素材库公开 SSR 页族 /tiku/shenlun/sucai/{type}/）
- 取证：生产 166 条素材（政策理论 73/金句 41/案例 32/范文 20，含 topic 归类与权威出处）经 R244–R248 打通站内链路，但正文对爬虫/未装 App 用户零外显（hub 板块链接是 App hash 深链）；R248 只否决了逐条落地页（78–250 字 thin），按类型聚合单页 3.2k–21k 字非 thin。
- 收口：db.shenlun_materials_by_type + /tiku/shenlun/sucai/{mtype}/ SSR 页（topic 分组正文+出处、逐条 mid 深链、其他类型内链、CTA、JSON-LD；未知/清空 404、无斜杠 301 前置存在性守卫）+ hub 板块链接改指 SSR 页 + sitemap-pages 收录（IndexNow 走 R255 变化驱动通道）。
- 详见 docs/iter/round-3/design-r264-sucai-ssr.md。

## R265（uvicorn keep-alive 竞态即时 502 收口）
- 取证：origin 8h 内 7 条即时 502（0.006–0.08s）全为已建立连接上的 `connection reset by peer`/`EOF`（容器 healthy、非部署窗口，命中 ClaudeBot 真实爬虫；边缘 retry 复用另一条陈旧连接仍 502）。R235 lb_try/R257 health check 只覆盖 dial/不健康路径，对此形态不生效。
- 根因（本地 socket 复现 verified）：uvicorn 默认 `--timeout-keep-alive 5s` < Caddy 连接池 idle 默认 2min——Caddy 复用已被 uvicorn 关闭的池化连接即遇 reset。默认参数空闲 6s 二次请求 EOF；130s 参数空闲 6s/20s 均 OK。
- 收口：Dockerfile.runtime CMD 追加 `--timeout-keep-alive 130`（> Caddy 120s idle，陈旧连接恒由 Caddy 先弃）。不改 Caddy、不改应用代码。
- 未归因残留：1 条 /api/track POST 13.2s 后 EOF（时长特征不符本根因，挂共享宿主争用观察项）。
- 详见 docs/iter/round-3/design-r265-keepalive-502.md。

## R266（/tiku 首页与 llms.txt 补素材类型页内链）
- 取证：R264 sucai 页族上线后，/tiku/ 首页素材行仍是纯文本「详见申论真题库页」（素材页距首页 2 跳）、/llms.txt 素材说明无 URL（llms.txt 是 URL 导览文件，无链接条目对 LLM 爬虫零可发现性）——与 R249/R254 同构的发现渠道口径收尾缺口。
- 收口：pages.py 素材行类型名改带计数链接指 _shenlun_sucai_path；llms.txt 素材说明改逐类型 markdown 链接条目；沿既有 mats 非空守卫（清空自动回落）。零路由/契约变化。
- 详见 docs/iter/round-3/design-r266-sucai-links.md。
## R267（/tiku 首页申论 section 补题型/年份 chips）
- 取证：行测五模块 section 均有子题型/考点/年份 chips，申论 section 仅 hub 链接+文案——R251 题型页族（5 类）与 R250 年份页族（12 年份）在首页零链接（距首页 2 跳）。
- 收口：tiku_index 申论 section 沿行测同构 markup 渲染题型 chips（shenlun_qtype_counts + _sub_path）与年份 chips（shenlun_year_counts + _year_path），空语料自动回落。零路由/契约变化，不加套卷 chips（49 个撑爆首页，hub 卡已覆盖）。
- 详见 docs/iter/round-3/design-r267-home-shenlun-chips.md。
## R268（申论素材收藏视图 URL 同步 + ?fav=1 入向深链）
- 取证：R261–R263 后申论专区 paper/qtype/year/region/tab/mtype/mid 均双向同步 URL，素材「收藏」视图（favOnly）是唯一剩余不同步态——toggleFavOnly 只翻本地状态、buildShenlunTabUrl 不感知 fav、onLoad 不收 ?fav，收藏视图不可分享/刷新即丢。
- 收口：buildShenlunTabUrl 增第三参 fav（tab=m 且 fav 输出 ?tab=m&fav=1，不叠 mtype——收藏视图本身不按类型过滤）；toggleFavOnly 后 syncFilterUrl；onLoad tab=m 分支无 mid 时收 fav=1（mid 置顶优先级不变）。纯前端 hash 深链，零后端/SSR/SEO 变化。
- 详见 docs/iter/round-3/design-r268-fav-url-sync.md。
## R269（搜索行测题详情「复制本题链接」出向分享）
- 取证：R243/R247 已为申论真题详情、素材卡建立复制链接出向分享，行测侧每题有公开 SSR 页 /tiku/q/{id}/（canonical+og+App CTA）作现成分享落点，但搜索页两处 q-detail 展开块（code_hit 直达 + 题目列表）只有选项/答案/解析，零出向出口。
- 收口：search-url.js 增纯函数 buildTikuQPath（非法 id 回落 /tiku/）+ 两处 q-detail 尾部「复制本题链接」控件（d-copy 样式/aria 对齐申论先例，@click.stop 不触发折叠），纯前端零后端/SSR/SEO 变化。
- 详见 docs/iter/round-3/design-r269-search-qlink.md。

## R270（搜索题目详情展开态 URL 同步 + ?qid 入向深链）
- 取证：R157 已同步 q/tab，但 toggleDetail 展开详情只翻本地状态不进 URL——刷新即收起、复制地址栏丢展开上下文；申论侧同类状态（?id/?mid）R243/R246 已闭环，搜索页是最后一个详情态不进 URL 的页面。
- 收口：buildSearchUrl 增第三参 qid（合法正整数追加 &qid，空关键词回落基础路径）+ toggleDetail 展开/收起后 syncUrl + onLoad 收 qid（纯数字校验）搜索完成后命中即自动展开；纯前端零后端/SSR/SEO 变化。
- 详见 docs/iter/round-3/design-r270-search-qid-sync.md。

## R271（/api/search 页族纳入边缘缓存）
- 取证：08-29 共享宿主争用窗口（wa 80–88%、load 12+、swap/zram 满）实测 /api/search 经边缘 503（53s），同窗口边缘有副本的页面 0.1–0.2s 正常——搜索是争用窗口内唯一完全不可用的公开高频路径；源码实查 API_CACHE_ALLOWLIST 仅 7 个精确 pathname，search 全穿透。
- 收口：edge-policy.js 允许清单加 /api/search（精确）+ API_CACHE_PREFIXES 前缀匹配 /api/search/question/（两端点均 uid 无关公开 GET，缓存 key 为完整 URL 含 query，按查询变体自然分 key），复用既有 60s TTL + SWR + stale-if-error 链路零新逻辑；带 Authorization/uid 仍绕过。
- 详见 docs/iter/round-3/design-r271-search-api-edge-cache.md。

## R272（申论公开 API 页族纳入边缘缓存）
- 取证：origin 10h 日志实测 /api/shenlun/questions 99、filters 73、materials 62 次全穿透；09-02 04:35–04:37 争用窗口内与 /api/search 同样无副本可退，而 R250–R264 申论 SSR 页族深链落地即打这组 API。
- 收口：允许清单加 shenlun questions/filters/materials（源码实查均 uid 无关公开 GET）+ 前缀 /api/shenlun/questions/（qid 详情），复用 R271 链路零新逻辑；不缓存 /api/exam/papers（uid 变体混流另轮评估）。
- 详见 docs/iter/round-3/design-r272-shenlun-api-edge-cache.md。

## R273（app 壳静态件 /sw.js、/precache.json 纳入边缘缓存）
- 取证：origin 11.5h 日志 /sw.js 541 次 304 + 48 次 200、/precache.json 全部同步穿透（_routes.json 只留 / 与 /static/* 给 Pages 静态层）；09-02 04:35–04:37 争用窗口内两者各 4–5 条 25s 503，无 stale 副本可退，是 R271/R272 后同窗口剩余未收口的公开 GET。
- 收口：SHELL_CACHE_ALLOWLIST 两路径 60s TTL（sw.js 新版生效延迟被 TTL 上界约束；浏览器 SW 主脚本更新检查默认绕过浏览器缓存但不绕过 CDN，60s 边缘缓存安全）+ content-type 守卫 js/json，复用既有 SWR/stale-if-error/重试链路零新逻辑。不动 /api/health（探针语义须实时）。
- 详见 docs/iter/round-3/design-r273-shell-static-edge-cache.md。

## R274（shell 静态件边缘缓存集成级回归测试，tests-only 不部署）
- 取证：R271–R273 部署后 6h origin 窗口无新增用户可见 5xx/慢样本（04:34–04:37 争用窗口 pass 均发生在当轮边缘部署前，属已收口历史形态）；真实缺口为 R273 策略函数只有孤立单测，[[path]].js 编排交互（守卫先于 put、TTL 透传、stale-if-error 对 shell 生效）无集成防线——/sw.js 若被 HTML 投毒入缓存是全站级故障放大器。
- 收口：edge-handler.test.js 新增 4 例（MISS→HIT+max-age=60、/sw.js HTML 不写副本、/precache.json HTML 拒/JSON 收、TTL 过期+503 SWR 回旧副本不覆盖），vitest 154(+4) 全绿；零产品代码变化（先例 R258）。
- 详见 docs/iter/round-3/design-r274-shell-static-edge-handler-tests.md。

## R275（复审计 + 观察项收口，docs-only）
- R273 遗留 /sw.js「x-edge-cache: MISS 但 age 增长」收口：cf-cache-status HIT 实证 CF 前置 HTTP 缓存（.js 默认可缓存扩展名）在函数层之前接管，回放头为入缓存快照——非缺陷且双层防护更强；/precache.json（.json 不在默认扩展名）仍走函数层 SWR 正常。
- 09-02 04:34–04:37 窗口 31 条 503 归因：全部早于 R271（04:54）/R272（05:00）/R273（05:12）边缘部署提交，pass 属部署前预期形态；部署后窗口 origin 无新增用户可见 5xx。深分页慢样本为 VPS 本机 curl 冷缓存探针（无 X-Kg-Ip/X-Kg-Fetch），warm 复测 0.02–0.17s 非缺陷。
- 详见 docs/iter/round-3/audit-r275-shell-cache-observation-closeout.md。

## R276（错题本 tab/筛选/排序状态 URL 同步 + 入向深链）
- 取证：错题本 tab（待掌握/已掌握/收藏）、模块筛选、模考/练习来源、排序均为纯本地状态，刷新即丢、不可分享；申论/搜索侧同类状态 R261–R263/R270 已闭环，错题本是最后一个主要筛选态不进 URL 的页面。
- 收口：新增 book-url.js 纯函数（buildBookUrl/parseBookOpts，白名单 tab=done|fav、mod 六模块、src=exam|practice、sort=due|times|type|reason；默认省略、fav 不叠筛选/排序、非法忽略）+ book.vue watcher replaceState 同步 + onLoad 白名单恢复；不收 kw/kpFilter/kp3Filter（依赖动态加载数据）。纯前端零后端/SSR/SEO 变化。
- 详见 docs/iter/round-3/design-r276-book-filter-url-sync.md。

## R277（真题卷库 year/region 筛选 URL 同步 + 入向深链）
- 取证：pkgA/exam/list 的 year/region 筛选为纯本地状态（setYear/setRegion 只重拉 /api/exam/papers，不进 URL、无 onLoad 恢复），刷新/复制/分享即丢；生产 API filters 实证 years 11 档、regions 26 地区可作白名单。
- 收口：新增 exam-list-url.js 纯函数（buildExamListUrl/parseExamListOpts，年份 1990–2099 整数、region encodeURIComponent、malformed URI 不抛错）+ list.vue onLoad 暂存入向参数、首次真实 filters 返回后按 API 白名单应用一次并重拉列表、setYear/setRegion 经 syncUrl() replaceState 同步（#ifdef H5 守卫）。顺手清零 edge-handler.test.js:318 两处 no-useless-escape lint 基线。纯前端零后端/SSR/SEO 变化。
- 详见 docs/iter/round-3/design-r277-exam-list-filter-url-sync.md。

## R278（真题卷 SSR 页族接入卷库 year/region 深链）
- 取证：/tiku/papers/ SSR 列表只展示年份/地区文本无筛选入口，/tiku/papers/{pid} 的「在线模考本卷」CTA 为不带上下文的通用卷库链接；R277 已打通 App 卷库 ?year/?region 入向白名单，SSR 侧发现入口与上下文落地是对称缺口。
- 收口：tiku_papers() 基于真实 db.exam_paper_filters() 输出「按年份筛卷/按地区筛卷」chips（App hash 深链，region quote 编码，空 filters 自动消失）+ 详情 CTA 经 _exam_list_query(p) 携带本卷 year/region（缺失字段省略、全缺回落基础路径）。不新增可收录 URL/不改 sitemap/canonical/边缘缓存/App 前端。新增 backend/tests/test_tiku_papers_deeplinks.py 3 例契约测试。
- 验证：ruff/pytest 138(+3)/pyright 0 全绿；生产 rev 420bf10 实测 chips 11 年份+28 地区就位、详情 CTA ?year=2025&region=黑龙江 编码正确、点击 ?year=2022 深链后 App chip 激活+列表仅 6 张 2022 卷、1440/375 溢出 0、console 0 error、性能预算全过。
- 详见 docs/iter/round-3/design-r278-papers-ssr-filter-deeplinks.md。

## R279（收藏与笔记页 tab/收藏夹/模块筛选 URL 同步 + 入向深链）
- 取证：favorites.vue 的 tab（收藏/笔记）、folderId（收藏夹）、modFilter（模块 chips）均为纯本地状态，无 onLoad 恢复无 URL 同步，是 R276/R277 后 App 内剩余未闭环的主要筛选态页面；本轮 origin 窗口无新增用户可见 5xx。
- 收口纯前端：新增 src/favorites-url.js 纯函数（tab=note 不叠 fav 侧参数；mod 六键白名单含中文键「时政」encodeURIComponent；folder ≥0 整数、0=默认夹合法；全默认回落基础路径）+ onLoad 恢复（mod 静态白名单立即应用、folder 暂存 load() 收藏夹返回后按真实 folders 校验存在才应用、tab=note 直切）+ tab/folderId/modFilter watcher 统一 replaceState。零后端/SSR/SEO 变化。
- 验证：lint/vitest 170(+6)/build 全绿；生产双视口实测出向同步（点模块→?mod、点夹→&folder=0、切笔记→?tab=note）与入向深链（note/时政编码/folder=0/组合）chip/夹/seg 激活、非法参数回落与无参一致、溢出 0、console 0 error、性能预算全过。注意：uni-app H5 同页 hash query 变化不重挂载（不触发 onLoad），验证入向深链必须新开页。
- 详见 docs/iter/round-3/design-r279-favorites-filter-url-sync.md。

## R280（考点掌握度地图模块 tab URL 同步 + 入向深链）
- 取证：origin 12h 无新增用户可见 5xx（04:3x 503 簇为 R275 已收口历史形态）；mastery-map.vue 的 curMod（模块 tab/桌面侧栏双入口同状态）纯本地态，无 onLoad 恢复无 URL 同步，是 R276–R279 后 App 内最后一个主要筛选态未闭环页面（selected 考点吸底条为瞬时交互态不收）。
- 收口纯前端：新增 src/mastery-url.js 纯函数（mod 非空 trim 后 encodeURIComponent，缺省回落基础路径；parse decodeURIComponent 容错）+ onLoad 暂存 _pendingMod、applyMap() 在 API 返回的 d.modules 中真实存在才应用（模块列表为动态数据，对齐 R277/R279 API 白名单模式）+ curMod watcher replaceState。默认选中首模块同样外显 ?mod（replaceState 不污染历史）。零后端/SSR/SEO 变化。
- 验证：lint/vitest 174(+4)/build 全绿；生产双视口实测（种子测试 uid 40 题跨 4 模块解锁地图，验后已删）：点第二模块→?mod=shuliang、?mod=shuliang 深链新开页恢复选中、?mod=nope 回落首模块且 URL 重同步 ?mod=ziliao、溢出 0、console 0 error、性能预算全过（/ 0.99、/tiku/ 1.00）。冷启动态（<30 题）无模块列表，_pendingMod 自然不应用。
- 详见 docs/iter/round-3/design-r280-mastery-map-mod-url-sync.md。

## R281（模考成绩报告补「模块用时 · 配速分析」）
- 取证：SOP-10 四维复审计（生产 1440/375 十路由截图 + 源码核查）定位核心功能深度缺口——交卷链路 per_module 已聚合 secs 并随 attempt 落库，报告页从未呈现（只有得分维度）；粉笔模考报告核心维度之一即各模块用时 vs 参考用时。SSR 题目页全站正确率外显候选被否决（生产 attempt_count>=5 仅 17 题，覆盖面不足）。
- 收口纯前端：新增 src/exam-pace.js 纯函数 buildPaceRows（参考用时按题量占比折算自本卷限时；>1.2× 超时/<0.6× 偏快/其余合理；durationMin/total 非法或全模块 secs=0 返回空不伪造）+ fmtMin；report.vue 侧栏「模块得分」下新增配速卡（status 着色条 + 用时/参考双值 + 折算口径底注），空 rows 整卡不渲染（历史无 secs attempt 自然隐藏）。零后端/契约变化。
- 详见 docs/iter/round-3/design-r281-exam-report-pace.md。

## R282（模考报告「本卷错题重练」CTA + 逐题解析补图片）
- 取证：报告页看完错题后无一键重练出口（只有返回卷库/再考一次，粉笔模考报告核心 CTA 即错题重练）；且 /api/exam/report items 不含 image/image_credit，带图题（图形推理等）解析浮层图片缺失。重练机制已存在（book.vue redoAll → redoSet storage → practice.vue 消费，上限 10 题）。
- 收口：后端 report items 增补 image/image_credit 两字段（向后兼容）；前端新增 src/exam-redo.js 纯函数 buildExamRedoSet（只收 picked&&!correct、脏数据过滤、字段映射 id←question_id、上限 10）；report.vue 逐题对错卡下新增重练 CTA（无错题不显示、超 10 题外显「本轮先练前 10 题」）+ 解析浮层渲染图片（BASE_URL 拼接 + 点击预览，对齐 practice.vue）。未答题不算错题不进组。
- 详见 docs/iter/round-3/design-r282-exam-report-redo.md。

## R283（模考成绩报告「邀考友挑战本卷」分享出口）
- 取证：模考报告是全站主要成果页中唯一零分享出口的页面（练习完成/PK/小队/搜索/申论详情均有出向分享），粉笔模考报告以晒成绩/邀好友同考为核心传播出口；报告数据 attempt_id+uid 鉴权不可公开，R278 后 /tiku/papers/{id} 真题卷 SSR 页（无 hash/query、自带 OG + 在线模考 CTA）是现成抗截断公开落点。
- 收口：纯前端。新增 src/exam-share.js 纯函数 buildExamReportShareText(report, origin)：paper.kind!=='zhenti' 或缺 id/title 返回 ''（mini/mock 卷无公开落点不外显）；否则输出成绩摘要+/tiku/papers/{id} 链接。report.vue rank-card 下新增 share-cta（v-if=shareText，role=button+aria-label），点击复制+toast+trackEvent('share_copy','exam_report',paper_id)。不新增后端接口/分享表/短码，不公开私有报告数据。
- 详见 docs/iter/round-3/design-r283-exam-report-share.md。

## R284（真题卷 SSR 详情页「已有 N 人模考 · 平均分」社会证明）
- 取证：R283 分享落点 /tiku/papers/{pid} meta 行只有「年份 地区 · 共 N 题 · 限时 M 分钟」，零社会证明，被挑战者看不到「多少人考过/平均多少分」对比锚点（粉笔卷详情核心转化元素）；聚合数据已在 exam_attempts（api_exam_rank 同口径）。
- 收口：db.exam_paper_social(pid) 同卷每人取最高分聚合返回 {n, avg}；tiku_paper_detail n>0 时 meta 行追加「· 已有 {n} 人模考 · 平均 {avg} 分」+ JSON-LD description 同步；n=0 不渲染不伪造。顺手收口 SSR .tags a 长标题 375px 存量溢出（max-width:100%+ellipsis，pid 96/133 实测 142/160px→0）。零 App 前端/API 契约/路由变化。
- 详见 docs/iter/round-3/design-r284-paper-social-proof.md。

## R285–R295（模考/申论深度补齐，逐轮独立 PR #473–#483）
- R285 卷库列表（App+SSR）社会证明口径统一（per-user-best takers+avg_score）；R286 SSR 详情 CTA ?pid= 直达目标卷高亮定位；R287 卷库「未交卷模考」续考横幅 + 过期进度清理（exam-resume.js）；R288 首页续考卡复用同函数；R289 模考 5/1 分钟低时预警（exam-alert.js，穿越判定+时钟脉冲态）；R290 报告解析浮层逐题连看（exam-review.js，只看错题过滤+桌面←/→）；R291 浮层收藏本题（exam-fav.js，report items 补 is_real/exam_year/exam_region）；R292 浮层挂 q-social-bar（笔记/讨论/热评）；R293 申论真题收藏闭环（shenlun-qfav.js，星标+收藏视图+?fav=1）；R294 申论详情上一题/下一题连看（shenlun-qnav.js）；R295 申论作答限字联动（shenlun-words.js，parseWordLimit 四类表达）。
- 均本地全绿+生产 1440/375 双视口实测；种子测试 uid 验后全库清理 leftover 0。

## R296–R298（本地资产服务端化三连，PR #484/#485/#487；R221–R297 rollup #486）
- R296 申论真题收藏服务端同步：shenlun_qfavs 表 + GET/POST /api/shenlun/qfavs + 匿名归并（_UID_PK_TABLES）；前端 syncQFavs 双向合并（本地独有回推、服务端为权威、兼容 id-only 历史）。
- R297 申论草稿服务端同步：shenlun_drafts (uid,qid) + /api/shenlun/draft（3000 字上限、空 content 删除）；输入 1.5s 去抖推送，「本机非空一律本机优先」，批改成功双端清除。
- R298 模考未交卷进度服务端同步：exam_progress 表 + POST /api/exam/progress（attempt 归属/未交卷/未超时校验）+ GET /api/exam/resume（同构 _exam_paper_payload，不进边缘缓存）+ 交卷即清；前端 adoptServerExamProgress「本机快照有效一律本机优先」，首页/卷库无本机快照时服务端恢复。

## R299（每日刷题目标服务端同步，PR #488）
- 取证：dailyGoal 只存 local storage（home/profile/practice 三页各自读写），清缓存/换设备即回默认 20，与 R296–R298 服务端化口径不一致；user_profile+/api/profile 是现成最小复用点。
- 收口：user_profile 补 daily_goal 列（新表直建 + PRAGMA 幂等 ALTER 迁移旧库）；POST /api/profile 严格白名单 {20,50,100}（显式拒 bool/浮点/数字字符串/越档整数，None 清除，缺 key 不改）；前端共享 src/daily-goal.js（DAILY_GOALS/normalizeDailyGoal/adoptServerDailyGoal），三页 local-first 即显 + 服务端合法值覆盖本地 + setGoal fire-and-forget POST 失败静默。顺手：backend/tests/conftest.py autouse fixture 每例清 storm guard 错误计数（修复全量 pytest 跨用例 429 连坐 4 failures）。
- 验证：ruff/pytest 155/pyright 0/lint/vitest 254/build 全绿；生产 rev 485e997 实测：API 合法 200/非法 400 逐项、1440 设置 50→POST 200、375 全新 context 同 uid 恢复 50、三页 storage 一致、断 /api/profile+/api/home_bundle 后本地值保留页面正常、双视口溢出 0、console 0 error、性能预算全过；测试 uid 全库清理 leftover 0。注意：home_bundle 的 profile 也会被 adoptServerDailyGoal 采用（与独立 profile 请求同口径，无竞态：相同值返回 null 不写）。
- 详见 docs/iter/round-3/design-r299-daily-goal-sync.md。

## R300（练习偏好服务端同步，PR #489）
- 取证：R296–R299 服务端化后，练习偏好三项（groupSize/timedMode/autoNextOff）仍只存 local storage（home 设置面板 + practice 工具面板双入口），清缓存/换设备即回默认；beiMode/fontLv/sfxOff 属设备级瞬时偏好不收。
- 收口：user_profile 补 group_size/timed_mode/auto_next 列（新表直建 + PRAGMA 幂等 ALTER）；POST /api/profile 严格白名单（group_size∈{10,20,30,50}、flags∈{0,1}，拒 bool/浮点/字符串/越档，None 清除，缺 key 不改）；前端共享 src/practice-prefs.js（GROUP_SIZES/normalizeGroupSize/normalizeFlag/adoptServerPracticePrefs），home adoptPrefs 只收 groupSize、practice 复用 syncDailyGoal 同一 profile 响应采用三项；setGroup/toggleTimed/toggleAutoNext local-first + fire-and-forget POST 失败静默。
- 验证：ruff/pytest 161/pyright 0/lint/vitest 264/build 全绿；生产 rev 7f9e26b 实测：API 合法/非法逐项（400 矩阵）、None 清除、缺 key 保留；1440/375 全新 context 同 uid 三项恢复（groupSize 50 + timedMode '1' + autoNextOff '1'）、home 设置面板 setGroup(20) POST 200 服务端更新、practice 工具面板双 toggle POST 200 服务端翻转、断 /api/profile+/api/home_bundle 后本地值保留页面正常、双视口溢出 0、console 0 error；部署脚本首个 Lighthouse 样本 a11y 0.94，独立复跑 a11y 1.0（无违例项，仅 informational），性能/SEO/LCP/CLS 均过。测试 uid（含一次误建 fresh uid）全库清理 deleted 4 / leftover 0。注意：练习页 UI 恢复验证用 storage key 是 anonUid（非 anon_uid）；home 的 profile 经 /api/home_bundle 下发，fallback 测试需同时断两端点。
- 详见 docs/iter/round-3/design-r300-practice-prefs-sync.md。

## R301（复盘场景补题目全站数据锚点，PR #490）
- 取证（SOP-10 四维复审计）：刷题页早有题目级全站统计外显（难度星级/全站正确率/样本人次/易错项，attempt_count>=5 才显示），但模考成绩报告逐题解析浮层与错题本展开态零统计锚点——复盘时无法区分「大家都错的难题」与「基础题失分」（粉笔错题本/解析页核心复盘锚点）。生产 questions 表已有 17 题真实聚合 >=5 人次。
- 收口：后端 report items 补 attempt_count/correct_ratio/most_wrong 三字段（纯增量）；db.list_mistakes() JOIN questions 补同三列；抽取 _ensure_question_stat_cols(conn) 幂等补列（refresh_question_stats/list_mistakes 共用，兼容旧库/测试库）。前端抽共享纯函数 src/q-stat.js qStatLine(q)（<5 人次或 ratio null 返回 ''、星级 >85→1★…否则 5★、most_wrong 存在且≠answer 才显易错项），practice.vue 切换为共享函数（行为不变），report.vue 浮层 detailStatLine + book.vue 展开态 mStatLine（correct_answer 需 ansLetter 转字母后作 answer 传入）。零新端点/零聚合口径变化/不伪造低样本。
- 验证：ruff/pytest 163/pyright 0/lint/vitest 270/build 全绿；生产 rev c0bdf74 实测：真实接口临时 uid 走 /api/exam/start|submit|report 链路，report item（qid 262555，23 人次/0%/易错 A）与 /api/mistakes（qid 8，5 人次/60%/易错 A）字段逐项一致；1440/375 双视口报告浮层 .dstat 与错题本 .mstat 文案与口径逐字正确、低样本卡正确不渲染、溢出 0、console 0 error；性能预算全过（/ 0.98、/tiku/ 1.00）。测试 uid 全库清理 deleted 13 / leftover 0。注意：/api/exam/start 对大卷会抽子集出题（87 题卷 report 只有 67 items），验证含特定题的报告需选题目确实被出到的卷（paper 44 含 262555）。
- 详见 docs/iter/round-3/design-r301-review-qstat-anchor.md。

## R302（模考报告补「距离目标」卡 + 较上次同卷成绩锚点，PR #491）
- 取证（SOP-10 四维复审计）：用户画像早收 target_score（home 学习计划三步，POST /api/profile 白名单），模考大赛赛后报告已有「距离目标」卡，但使用频次远高的日常模考成绩报告完全不消费画像目标分；同卷历史曲线只画柱不给「较上次 ±X 分」结论——模考后无法一眼回答「离目标差多少 / 比上次进步没」（粉笔模考报告核心复盘锚点）。
- 收口（纯前端零后端）：src/exam-goal.js 纯函数 goalGap(score,target)（target 非法/未设/≤0 或 score 空→null，否则 {target,gap}，1 位小数）与 prevScoreDelta(history,curId)（正序 history 定位当前 attempt，无前次→null）；report.vue load 后并行 GET /api/profile（失败静默 targetScore=null），hero-meta 补「较上次同卷 +X/−X 分/持平」，rank-card 下补「距离目标」卡（对齐 contest-report gap-row 视觉：目标分 Y → 已达标 🎉 / 还差 Z 分）；缺数据一律不渲染不伪造。
- 验证：lint/vitest 280(+10)/build/diff-check 全绿（后端零改动）；生产 rev dd488be 部署 + API/Lighthouse 回归全过；真实接口种子（profile target 70 + paper 24 两次模考 5.9→17.6）实测 1440/375：目标卡「目标分 70 还差 52.4 分」、hero「较上次同卷 +11.7 分」、首次 attempt 不显较上次、清除 target 后目标卡与目标行均不渲染、溢出 0、console 0 error。测试 uid 全库清理 deleted 57 / leftover 0。注意：report.vue 的 uid 取 anonUid()，UI 验证需把测试 uid 写入 localStorage anonUid 后再开报告深链。
- 详见 docs/iter/round-3/design-r302-report-goal-anchor.md。

## R303（学习统计页补「模考成绩趋势」卡，PR #492）
- 取证（SOP-10）：stats.vue 已有热力图/雷达/错题分布/正确率与速度趋势等 10+ 视图，但对模考只在「练习记录」混排单条 attempt，跨卷成绩趋势全站无处可看（报告页历史曲线只限同卷 R281；卷库列表只有最近 attempt 行）；数据早已齐备：GET /api/exam/attempts?uid=（DESC，含 score/kind/submitted_at）+ /api/profile target_score（R302 已消费）。
- 收口（纯前端零后端）：src/exam-trend.js examTrend(items,target,cap=10)——过滤 score 空/未交卷、最近 cap 条反转正序、<2 条 null 不渲染；scaleMax=max(scores,合法 target,10) 取整到 10 封顶 100；target 合法性复用 exam-goal goalGap 语义，非法不画参考线。stats.vue onShow 并行 loadExamTrend()（attempts limit=20 + profile，失败静默），「正确率趋势」前插趋势卡：复用 .trend 柱状视觉 + 虚线目标线（--warn-strong）+「最好 X 分 · 最近 Y 分」底注 + 「不同卷难度不同，仅供参考」口径注明；柱 role=button 可点/Enter 进对应报告深链。
- 验证：lint/vitest 287(+7)/build/diff-check 全绿（后端零改动）；生产 rev cfb991f 部署 + API/Lighthouse 回归全过（/ 0.98、/tiku/ 1.00）；真实接口种子（target 70 + paper 24 三次模考 23.5→5.9→17.6）实测 1440/375：趋势卡 3 柱正序、目标线「目标 70 分」就位、底注「最好 23.5 分 · 最近 17.6 分」、点柱进对应报告（分数一致）、单次/零模考不渲染、清除 target 后目标线消失柱保留、溢出 0、console 0 error。测试 uid 全库清理 deleted 116 / leftover 0。
- 详见 docs/iter/round-3/design-r303-stats-exam-trend.md。

## R304（模考成绩海报，PR #493）
- 取证（SOP-10）：模考报告唯一分享出口是 R283 纯文本复制；全站唯一海报能力 poster.vue 只支持打卡/徽章，成绩零图片出口（粉笔模考有成绩海报，微信场景图片传播力强于文本）。数据全部现成（report+rank），纯前端收口，不新增图片服务端渲染/存储，不泄露 uid。
- 收口：src/exam-poster.js 纯函数 examPosterData(report,rank)——成绩取 **report.attempt.score**（顶层无 score！），total<=0/score 非法→null；beatenPct 仅 rank.total>=10 且 beaten_pct 有限时给出（低样本 fail-closed）；QR 落点 zhenti+合法 paperId → /tiku/papers/{id}，否则站点根。poster.vue 增 ?mode=exam&attempt_id=N 模式（报告接口是**路径参数** /api/exam/report/{attempt_id}?uid=，非 query），rank 失败降级基础海报；H5/小程序绘制分支调用动态 draw(ctx,d)（勿硬编码 drawPoster）。report.vue share 区补「生成成绩海报」CTA + share_poster 埋点。
- 契约纠偏（生产实测发现，追加提交 c282c52）：初版误用 query 参数路径与顶层 score，生产 404/取值失败；以 backend/app/exam_api.py 与真实生产响应为准修正，测试 fixture 同步改为 attempt:{id,score} 形状。
- 验证：lint/vitest 292(+5)/build/diff-check 全绿；生产 rev c282c52、bundle index-77hv-Tcy.js；testing agent 双视口实测全过：报告页 CTA→海报页 35.3 分/6/17/73%、QR zbarimg 客观解码（真题→/tiku/papers/24、mock→站点根）、低样本 rank.total=1 击败栏正确隐藏、H5 PNG data URL、1440/375 溢出 0、console 0 error。测试 uid（12 个 r304*）全库清理 deleted 391 / leftover 0。注意：uid 注入 localStorage 键是 anonUid（非 uid）。
- 详见 docs/iter/round-3/design-r304-exam-poster.md。

## R305（模考报告同卷排行榜 Top 10，PR #494）
- 取证（SOP-10）：rank 接口早有个人排名/击败百分比/分布，但报告不外显同卷高分者与差距（粉笔成绩报告有排行）；每日一练已有榜单+昵称脱敏先例，R283/R284/R304 分享与社会证明线的自然下一步。
- 收口：后端 /api/exam/rank/{attempt_id} 纯增量补 `board`（同卷已交卷 attempts 按 uid 聚合每人取最高分 MAX(score)、同分按 MIN(submitted_at) 先参与在前、Top 10；昵称源 users.nickname 仅对 `u\d+` uid 批量查、strip+20 字截断、空昵称/匿名回落 uid[:6]+"***"，不外泄完整 uid；me 标记查询者本人；仍仅限本人查询自己 attempt，不进公开 SSR）。前端 exam-board.js 纯函数（board 缺失/有效行 <2 → null 不渲染；无效 score 行过滤（注意 Number(null)=0 陷阱，用 num() 归 NaN）；本人不在前十且 rank/score 合法时追加「我」行），rank-card.vue 分布图下渲染榜单，复用既有请求零新增。
- 验证：ruff/pytest 167(+7)/pyright 0/lint/vitest 300(+13)/build/diff-check 全绿；生产 rev b33f12e、bundle index-DgyXb4Ot.js；API 实测 5 uid 种子（含同分先参与在前、per-user-best 低分重考不占行）逐项符合契约；UI 双视口实测榜单顺序/脱敏/本人高亮（--brand-soft）/solo 单人隐藏/溢出 0/console 0 error（「本人不在前十」分支仅 vitest 覆盖未生产实测）。测试数据全库清理 deleted 284 行 + mock 卷 2 张 / leftover 0。
- 陷阱：直接 python 探针调生产 API 需带浏览器 UA 否则 R88 边缘 403；conftest seed_questions 改为 insert-or-ignore 后按 module+题干回查稳定 id（lastrowid 跨连接不可靠曾致全量跑随机 KeyError）。
- 详见 docs/iter/round-3/design-r305-exam-board.md。

## R306（模考报告模块得分补全站同卷模块平均，PR #495）
- 取证（SOP-10）：report.vue 模块得分卡只显示个人 correct/n，无法区分「个人薄弱」与「整卷该模块普遍难」；rank 接口已被报告页请求、exam_attempts.per_module 已存真实模块数据；mock_event.py 有模块平均先例（粉笔模块诊断锚点）。
- 收口：后端 /api/exam/rank/{attempt_id} 纯增量补 `module_avg`（同卷已交卷、每 uid 取最高分 attempt；逐用户先算 correct/n 再求用户级均值，不按题目池化；malformed JSON/非 dict 模块值/bool 伪数字/n<=0 逐行跳过；每模块 ≥2 合法用户才返回 {pct,n_users}；仍 self-only、不进公开 SSR）。前端 exam-mod-avg.js 纯函数 modAvgPct（缺失/非法/越界/n_users<2 → null 不渲染），rank-card.vue 请求成功 $emit('loaded')，report.vue 模块行右侧 stack 补「全站 N%」小字（--ink-3），复用既有请求零新增。
- 验证：ruff/pytest 170(+3)/pyright 0/lint/vitest 306(+6)/build/diff-check 全绿；生产 rev 69d52dc、bundle index-CNKuN0WS.js；API 实测种子 3 uid + 1 真实用户同卷（pid 5）module_avg 五模块 n_users=4 契约符合、既有 total/rank/board 不回归；UI 双视口实测模块行「全站 1%/0%」逐行与 API 一致、rank 卡回归正常、溢出 0、console 0 error（低样本 n_users<2 隐藏分支仅单测覆盖未生产实测）；性能预算全过（/ 0.98、/tiku/ 1.00）。测试数据清理 test-r306-*（DELETED 4 / leftover 0）。
- 陷阱：scripts/clean_test_data.py 在部分表结构下（practice_results/users 无 uid 列）需先 PRAGMA 检查列再删，且 sqlite 未 commit 前异常会整体回滚。
- 详见 docs/iter/round-3/design-r306-report-module-avg.md。

## R308（模考报告「继续模考」下一卷推荐 CTA，PR #498）
- 取证（SOP-10）：报告页尾部动作只有返回卷库/再考一次（R307 薄弱模块 CTA 仅覆盖诊断成立场景），复盘后无「下一张未考卷」出口；数据现成（/api/exam/papers?kind=zhenti 含 takers/avg_score、/api/exam/attempts 只回已交卷），R286 ?pid= 深链可作安全落点（不走 exam.vue ?paper_id= 即建 attempt）。
- 收口纯前端零后端：src/exam-next.js 纯函数 nextPaper(papers,attempts,cur)（候选=id 正整数+title 非空+非本卷+不在已交卷集合；排序同 cur.region 优先→year 降序（缺排后）→takers 降序→id 降序；非法输入/无候选→null 不渲染不伪造；输入不可变）。report.vue loadNext() 并行拉双接口（任一失败静默），CTA 副文案 takers>0 显「已有 N 人模考 · 平均 X 分」否则「换一卷继续练手感」，role=button/tabindex=0/Enter，goNext→/pkgA/exam/list?pid={id}。
- 验证：lint/vitest 320(+9)/build/diff-check 全绿；生产 rev d79ce20、bundle index-DkzBjMNb.js；testing agent 双视口实测：交卷贵州卷（全库唯一贵州卷）后 CTA 推荐 pid 5（year↓→takers↓ 路径命中）文案与实时 papers 数据一致、点击/Tab+Enter 均落 list?pid=5 高亮+角标未开考、375 无溢出、console 0 error、反例 attempt 99999 空态无 CTA；同 region 优先与全卷考完隐藏分支未生产实测（vitest 已覆盖）。测试数据清理 test-r308-*（DELETED 2 / leftover 0）。
- a11y 线索：报告页逐题 75 个圆圈全在 Tab 序列内，键盘到 CTA 需 ~75 次 Tab，后续可考虑逐题区 roving tabindex。
- 详见 docs/iter/round-3/design-r308-report-next-paper-cta.md。
## R309（真题卷库「没考过/考过的」做题状态筛选 + ?st= URL 同步，PR #499）
- 取证（SOP-10）：生产卷库 118+ 张卷，卷卡已外显 best_score/attempt_count（R284/R285），但筛选条只有年份/地区（R277），找「下一张没考过的卷」只能逐卡辨认；粉笔卷库有「未做/已做」状态筛选。
- 收口纯前端零后端：src/exam-list-status.js 纯函数 filterPapersByStatus(items,st)（非数组→[]；st 非 'todo'|'done'→原数组引用；todo=best_score==null（0 分算考过）、done 反之；输入不可变）。exam-list-url.js build/parse 增 st 白名单。list.vue 筛选区首行「全部/没考过/考过的」chips，列表/空态改用 shown computed（本地过滤不重拉，与 year/region 服务端筛选自由组合），setSt 清 pinnedId+syncUrl，onLoad 入向 ?st= 恢复，applyPendingPin 改判 shown（?pid 目标被状态筛选隐藏时静默不 pin）。
- 验证：lint/vitest 326(+11)/build/diff-check 全绿；生产 rev 0ef3f65、bundle index-B92FBO3H.js；testing agent 双视口实测：交卷后「考过的」120→1、「没考过」119 不含该卷、?st= 硬刷恢复、?st=abc 回退全部、year+region+st 三参组合与空态放宽提示、?pid 可见 pin/隐藏静默双分支、双视口溢出 0、console 0 error；性能预算全过（/ 0.98、/tiku/ 1.00）。测试数据清理 test-r309-*（DELETED 2 / leftover 0）。
- 陷阱：切 chips 属 hash query-only 变化不触发 uni onLoad，验证入向恢复需硬 reload/新开页（同 R307 经验）。
- 详见 docs/iter/round-3/design-r309-exam-list-status-filter.md。
## R310（真题卷库刷卷进度外显——「已刷 X/N 卷」进度条 + 状态 chips 计数，PR #501）
- 取证（SOP-10）：R309 状态筛选后 chips 无计数、页面无刷卷总进度锚点（粉笔卷库外显「已做 N 套」）；数据早在客户端 items[].best_score，纯本地可算零请求。
- 收口纯前端零后端：src/exam-list-progress.js 纯函数 paperProgress(items)（非数组 fail-closed {0,0,0}；done=best_score!=null 与 R309 同口径；pct 四舍五入；输入不可变）。list.vue 筛选区上方进度卡（total>0 渲染，「已刷 X/N 卷」+pct+细进度条 role=progressbar 全套 aria，done===total 显「全部刷完 🎉」）+ 状态 chips 带计数「没考过 N / 考过的 M」；口径为当前 year/region 服务端筛选范围内进度。
- 验证：lint/vitest 331(+5)/build/diff-check 全绿；生产 rev 19d822c、bundle index-PCGlgYRK.js；testing agent 双视口实测：0/120→交卷（0 分实证算考过）→1/120·1% 最小填充、year/region 收窄口径一致、2025+贵州命中「全部刷完 🎉」100% 分支（生产可安全构造：选仅含 1 张已考卷的范围）、R309 st 筛选回归且进度卡不受 st 影响、aria valuenow 一致、溢出 0、console 0 error；性能预算全过（/ 0.98、/tiku/ 1.00）。测试数据清理 DELETED 2 / leftover 0。
- 观察项：🎉 在无 emoji 字体设备渲染为方框（DOM 正确，测试机即如此），后续可考虑纯文本兜底。
- 详见 docs/iter/round-3/design-r310-exam-list-progress.md。

### R311：考过的卷卡直达成绩报告（PR #503）
- 取证（SOP-10）：卷卡外显最好成绩但零回看入口，只能翻页底模考记录（limit 10）或重新交卷；报告页 ?attempt_id= 深链早已就绪（粉笔已做卷有「查看报告」）。
- 收口：后端 list_exam_papers uid 合并段改单查询 Python 聚合，契约纯增量补 best_attempt_id（最高分 attempt，同分取 id 更大即更近；未考 null；best_score/attempt_count 语义不变，未交卷不参与）；前端 list.vue 卷卡 best_attempt_id 存在时增「看报告」按钮 → /pkgA/exam/report?attempt_id=，fail-closed 缺字段不渲染。零新 API。
- 验证：ruff/pytest 174(+4)/pyright 0/lint/vitest 331/build 全绿；生产 rev e5484a1、bundle index-BQPBH1qz.js；testing agent 双视口实测：同卷 0 分/24 分双 attempt，best_attempt_id 指向最高分、已考卡 3 键/未考卡 2 键、点击直达 hero 24 分、R309/R310 回归、375 无溢出、console 0 error；清理 DELETED 137 / leftover 0。部署首跑首页 a11y 单样本 0.94，独立复跑 1.0 无违例项（采样波动）。
- 未生产实测：同分平手取更近 attempt 分支（pytest 覆盖）。
- 详见 docs/iter/round-3/design-r311-paper-card-report-entry.md。

### R312：成绩报告解析浮层补「题目纠错」入口（PR #505）
- 取证（SOP-10）：刷题页/错题本均有完整纠错链路（入口→7 类型 sheet→POST /api/question_report→管理台审核），但报告解析浮层（R290 连看/R291 收藏/R292 社交条后的复盘工作台）零纠错入口；复盘恰是最易发现「答案/解析有误」的场景（粉笔逐题解析有同权入口）。
- 收口：纯前端零后端/零契约。report.vue 解析块后、q-social-bar 前挂 report-link「题目有问题？纠错」（detail.question_id 缺失 fail-closed 不渲染）；与 practice/book 同构纠错 sheet（同 7 类型 + 500 字上限 + reportBusy 防重），.qr-mask z-index 95 盖过解析浮层（z 90）；已提交态按 question_id 记页面级 reportedIds（瞬时态不进 storage/URL），连看切题各题独立；失败 toast 可重试不置已提交态。
- 验证：lint/vitest 331/build 全绿；生产 rev 3dca609、bundle index-B1JixCtG.js；testing agent 双视口实测：入口位置（解析后/社交条前 DOM 实证）、弹层层叠/7 chips/未选禁用、提交→toast→已提交态→防重 guard、question_reports 落库逐字段一致、连看切题独立、R290/R291/R292 回归、双视口溢出 0、console 0 error；清理 DELETED 136（含 question_reports 1 行）/ leftover 0。
- 未生产实测：提交失败 toast 重试分支（无法构造生产失败）、同 uid 同题后端去重 UPDATE 分支（前端 guard 阻断 UI 二次提交路径；两者 vitest/既有 pytest 覆盖）。
- 详见 docs/iter/round-3/design-r312-report-overlay-qc-report.md。

### R313：成绩报告解析浮层逐题「练同类题」CTA（PR #507）
- 取证（SOP-10）：报告浮层已是复盘工作台（连看/收藏/统计锚点/社交条/纠错），但「这题不会→当场练同类」零出口；错题本早有同考点强化 5 道新题先例；生产实查 tag3 覆盖 113063/113264=99.8%。
- 收口零新 API：report items 纯增量补 tag3；report.vue 解析后、纠错入口前挂 CTA（缺 tag3 fail-closed 不渲染），复用既有 practiceLaunch {kind:'reinforce', module, submodule, tag3, count:5, source:'exam_report'} 直入 5 道未做新题。
- 验证：ruff/pytest 176(+1)/pyright 0/lint/vitest 331/build 全绿；生产 rev 22bb927；testing agent 双视口实测：CTA 文案与 API tag3 逐题一致、点击直达强化流 1/5 + toast、连看切题 CTA 随题切换、R290/R291/R292/R312 回归、溢出 0、console 0 error；性能预算全过。清理 DELETED 135 / LEFTOVER 0。
- 未生产实测：tag3=null 隐藏分支与空题池兜底（单测/既有逻辑覆盖）。
- 详见 docs/iter/round-3/design-r313-report-overlay-reinforce.md。

### R314：成绩报告解析浮层错题「错因自评」（PR #508）
- 取证（SOP-10）：错题本早有错因自评四选项（粗心大意/概念不清/方法不会/纯蒙的）+ 按错因筛选/聚合/学习建议，模考答错题自动进错题本；但报告浮层（记忆最鲜明时刻）无法直接标错因，须离开报告去错题本找同题补标，复盘断点。
- 收口零新 API/表/URL 状态：db.mistakes_by_qids(uid,qids) 映射本人错题 {question_id:{id,error_reason}}；report items 纯增量补 mistake_id/error_reason（仅答错且有错题记录时非 null，答对/未答/无记录 fail-closed null）；report.vue 浮层答案统计后、解析前渲染错因 chips（v-if=detail.mistake_id，role=button+aria），点击乐观更新 + PATCH /api/mistakes/{mid} {uid,error_reason}，失败回滚+toast，已选同项不重复请求；与错题本同一 mistakes 记录同源（错因排序/聚合/学习建议即时生效）。
- 验证：ruff/pytest 177(+2)/pyright 0/lint/vitest 331/build 全绿；生产 rev 80bbfd7、bundle index-U1GUVn8d.js；testing agent 双视口实测：API 契约（答错 mistake_id 非 null 初始 error_reason null，答对/未答双 null）、chips 位置/点击 PATCH 200/硬刷回显/错题本同源（按错因聚合+复习流同显）、连看不串态、fail-closed 无 chips、R291/R292/R312/R313 回归、双视口溢出 0、console 0 error；Lighthouse 全过（部署首跑 / a11y 单样本 0.94、独立复跑 1.0，采样波动）。清理 test-r314-me DELETED 10 / LEFTOVER 0，保护 uid 各表计数前后快照逐表一致。
- 未生产实测：PATCH 失败回滚 toast 分支（生产无法构造失败，逻辑代码核实）。
- 详见 docs/iter/round-3/design-r314-report-overlay-error-reason.md。

### R315：成绩报告解析浮层逐题「本题用时」（PR #510）
- 取证（SOP-10）：做卷页早已逐题计时（exam.vue qsecs→q._secs，交卷带 secs {题号:秒}），但后端只用于 answer_log 与模块级配速（R281），exam_attempts 不持久化逐题 secs、report items 无用时字段；用户模考后无法回答「这道题花了多久、是不是太慢」（粉笔逐题解析外显每题用时并与平均对比），纯数据链路断点。
- 收口零新 endpoint/表/URL 状态：db _ensure_exam_tables 幂等补列 exam_attempts.secs TEXT；finish_exam_attempt(..., secs=None) 落 JSON；get_exam_attempt 解析回 dict（旧记录 {}）；submit 把 _clean_int_map 清洗后的 secs 传入；report items 纯增量补 secs（仅 int 且 >0 返回，否则 null fail-closed）。前端纯函数 exam-time.js（fmtSecs：45 秒/1 分 20 秒/2 分，非正数 null；paperAvgSecs：secs>0 均值、有效题 <3 null 防小样本；qTimeLine：本题无效整行 null，均值无效只出前半句）；report.vue 统计行后、错因自评前插 detailTimeLine（复用 .dstat），连看随 detail 切换。
- 验证：ruff/pytest 179(+2)/pyright 0/lint/vitest 343(+13)/build 全绿；生产 rev f2f0aa2、bundle index-CXRnuOYr.js；API 实测 secs {45,80,12,-3,"bad"} → report {45,80,12,null,null}、无 secs 旧 attempt 全 null；testing agent 双视口实测：题1「本题用时 45 秒 · 全卷平均 46 秒/题」、题2 分秒格式、题4 无 secs 整行不渲染、旧报告全隐藏、DOM 顺序 用时→错因→解析→CTA→纠错→社交条、R290/R291/R312/R313/R314 回归、双视口溢出 0、console 0 error；Lighthouse 独立复跑全过（部署首跑 / a11y 0.94/LCP 2645 单样本波动）。清理 test-r315-* DELETED 7 / LEFTOVER 0，保护 uid 30 表快照前后逐表一致。
- 未生产实测：有效 secs <3 隐藏全卷平均分支（预置数据恰为 3 题阈值下限；vitest 覆盖）。
- 详见 docs/iter/round-3/design-r315-report-per-question-secs.md。

### R316：模考「标记」贯穿到成绩报告（PR #512）
- 取证（SOP-10）：做卷页早有逐题「标记」（q._marked，答题卡黄点+本机 examProgress 保存），但交卷 payload 丢弃标记，exam_attempts 无 marks、report items 无 marked——考中「不确定、回头看」的题在报告里无法定位，做对但蒙的题连看只有全部/错题两档覆盖不到（粉笔标记贯穿到解析）。
- 收口零新 endpoint/表/URL 状态：db _ensure_exam_tables 幂等补列 exam_attempts.marks TEXT；finish_exam_attempt(..., marks=None) 落 JSON 数组；get_exam_attempt 解析回 list（旧记录 []）；exam_api _clean_marks(raw,total) 仅接受 list、逐项 int 化、拒 bool、1..total 限界、去重升序；report items 纯增量补 marked boolean（旧数据 fail-closed false）。前端 exam.vue 交卷收集 1-based marks；纯函数 exam-marks.js（markedNos/nextNavMode 三态循环 all→wrong→marked，无标记跳过 marked）；exam-review.js reviewFilter/reviewStep 升级三态（兼容旧布尔调用）；report.vue 网格 .qn.mk 黄色角标（不改对/错/未答底色）+ legend「考中标记」+ 浮层 ⛳ badge + 中键 navMode 三态（aria 同步）。R298 服务端续考协议不变（未交卷标记跨设备不同步，挂观察项）。
- 验证：ruff/pytest 182(+3)/pyright 0/lint/vitest 352(+9)/build 全绿；生产 rev f2d103b、bundle index-Emoj0Q6E.js；API 实测 marks [1,3,3,0,9999,'x',None,True] → report marked_nos [1,3]（题1 做对且 marked=True）、旧 attempt 全 false；testing agent 双视口实测：真实 UI 做卷标记 题1错/题3未答/题9对，网格角标三种底色不变、legend 第4项、浮层 badge、只看标记步进 1→3→9 边界禁用、无标记卷两态循环无标记 UI、R290/R291/R292/R312/R313/R314/R315 回归（顺带实证 R315 <3 题隐藏均值分支）、双视口溢出 0、console 0 error；Lighthouse 独立复跑全过（部署首跑 / a11y 0.94 单样本波动）。清理 test-r316-* DELETED 13 / LEFTOVER 0，保护 uid 30 表快照前后逐表一致。
- 详见 docs/iter/round-3/design-r316-report-marked-questions.md。

### R317：未交卷模考「标记」跨设备同步（PR #514）
- 取证（SOP-10）：收口 R316 观察项——R298 服务端续考只同步 picks/idx，exam.vue pushProgress 不发标记、save_exam_progress 无 marks 参数、adoptServerExamProgress 恢复时硬编码 _marked:false；换设备续考后考中标记全丢，R316「只看标记」价值在跨设备场景被截断（本机快照续考不受影响）。
- 收口零新 endpoint/表/URL 状态：db _ensure_exam_progress 幂等补列 exam_progress.marks TEXT（JSON 数组，question_id 口径，与本协议 picks 一致；区别于交卷 marks 的 1-based 题号口径，互不混用）；save_exam_progress(..., marks=None) 非空存 JSON 空存 NULL；latest_exam_progress 回读 list（旧行 []）；POST /api/exam/progress 可选 marks（缺省 []；提供时必须 list ≤300 且逐项 int 拒 bool，否则 400，与本端点 picks 严格语义一致），去重升序落库；GET /api/exam/resume 应答补 marks。前端 pushProgress 补收集 q._marked 的 q.id 数组；adoptServerExamProgress 按 marks 集合恢复 _marked（Number 归一兼容字符串 id，非法项 fail-closed false），本机快照优先不变。
- 验证：ruff/pytest 183(+1)/pyright 0/lint/vitest 355(+3)/build 全绿；生产 rev 9eb2288、bundle index-CE5TDek-.js；API 实测 marks 乱序+重复 → resume 去重升序、缺省覆盖为 []、非法（非 list/[True]/["3"]/[1.5]）逐项 400；testing agent 跨设备实测：设备 A 1440 标记题1(答A)+题3(未答)，去抖 POST 实抓 body 含 marks；设备 B 375 全新 CDP 隔离 context 同 uid 首页续考卡→恢复弹窗→做卷页标记完整恢复（网格与设备 A 逐题一致、「已标记」激活态、idx 一致）；本机快照优先/本机标记切换/交卷后 resume={} 回归；双视口溢出 0、console 0 error；Lighthouse 全过（/ 0.99/LCP 823ms、/tiku/ 1.00）。清理 r317verify1+r317ui-me DELETED 10 / LEFTOVER 0，保护 uid 30 表快照前后逐表一致。
- 未生产实测：卷库横幅续考入口（与首页续考卡同 adoptServerExamProgress 路径）。
- 详见 docs/iter/round-3/design-r317-progress-marks-sync.md。

### R318：未交卷模考「逐题用时」跨设备同步（PR #515）
- 取证（SOP-10）：R315 报告外显逐题用时、R281 模块配速均消费交卷 secs，但 R298/R317 服务端续考协议只同步 picks/idx/marks——exam.vue pushProgress 不发 _secs、adoptServerExamProgress 恢复固定 _secs:0；换设备续考后设备 A 段用时全丢，交卷报告/配速失真。
- 收口零新 endpoint/表/URL 状态：db _ensure_exam_progress 幂等补列 exam_progress.secs TEXT（JSON {question_id:秒}，与本协议 picks/marks 同口径；区别于交卷 secs 的 1-based 题号口径，互不混用）；save_exam_progress(..., secs=None) 非空存 JSON 空存 NULL（UPSERT 整体覆盖，空即清除）；latest_exam_progress 回读 dict（旧行 {}）；POST /api/exam/progress 可选 secs（缺省 {}；提供时必须 dict ≤300、key 可 int 化、value 正 int 拒 bool/字符串/浮点/0/负数，否则 400 不做静默转换）；GET /api/exam/resume 应答补 secs。前端 pushProgress 补收集 Number.isInteger(q._secs)&&q._secs>0 的 {q.id: _secs}（当前题计时按既有逻辑在切题时 flush）；adoptServerExamProgress 按 secs 对象恢复 _secs（字符串键 Number 归一、非有限正数/未命中/非对象 fail-closed 0），本机快照优先不变。
- 验证：ruff/pytest 184(+1)/pyright 0/lint/vitest 358(+3)/build 全绿；生产 rev ebe60f8、bundle index-aaFA1QHz.js；API 实测乱序 secs roundtrip、缺省覆盖 {}、非法 8 类逐项 400；testing agent 跨设备实测：设备 A 1440 去抖 POST 实抓 secs {27,5}，设备 B 375 全新 CDP 隔离 context 同 uid 恢复 _secs 并继承累计（再切题抓包 {27,5,21}），首页续考卡与卷库横幅两入口分别实测（收口 R317 观察项），交卷报告题1「本题用时 27 秒」含设备 A 累计、R281 配速正常，交卷后 resume={}，双视口溢出 0、console 0 error；Lighthouse 全过（/ 0.98/LCP 819ms、/tiku/ 1.00）。清理 test-r318-api+test-r318ui-me DELETED 8 / LEFTOVER 0，保护 uid 30 表快照前后逐表一致。
- 未生产实测：secs 非法值 400 分支的 UI 侧路径（API 已逐项自测）。
- 详见 docs/iter/round-3/design-r318-progress-secs-sync.md。

### R319：做卷页「排除干扰项」——长按选项划掉/恢复（PR #516）
- 取证（SOP-10）：粉笔计时做题支持长按选项排除干扰项（缩小范围、二次回看不重复推理），本站做卷页选项只有选中/未选中两态。
- 收口纯前端零后端/零契约/零 URL 状态：新纯函数 frontend-uni/src/exam-excl.js——toggleExcl(excl,k,picked)->{excl,picked}（长按切换排除；排除当前已选项时同时清空选择；输入不可变、非法入参 fail-closed）、pickWithExcl(excl,k)（选中即解除该项排除）。exam.vue 选项补 @longpress + .opt.excl（opacity 0.45 + otext 删除线，不改选中/未选中底色语义）；pick(k) 前置 pickWithExcl。_excl 为本机做题过程态：随既有 saveProgress() 整 items 快照持久化，pushProgress 不上传（服务端 progress 协议不动），交卷 payload 不变。
- 验证：vitest 366(+8)/lint/build 全绿；生产 rev f4b9df7、bundle index-C1eUHopI.js；testing agent 真实做卷实测（1440/375）：长按排除/再长按恢复/排除已选项清空选择（答题卡变未答）/点击被排除项自动解除并选中/硬刷恢复弹窗后排除态保留；去抖 POST payload 键恰为 uid/attempt_id/picks/idx/marks/secs 无 excl；交卷报告无回归；双视口溢出 0、console 0 error；Lighthouse 独立复跑全过。清理 test-r319ui-me DELETED 7 / LEFTOVER 0，保护 uid 30 表快照一致。
- 未生产实测：真实触屏设备长按手势（自动化 CDP touch 模拟，见 SKILL 经验）。
- 观察项：排除态跨设备同步（可仿 R317/R318 marks/secs 模式服务端化）；刷题页同交互补齐。
- 详见 docs/iter/round-3/design-r319-exam-option-exclude.md。

### R321：刷题页「排除干扰项」——长按选项划掉/恢复（PR #518）
- 取证（SOP-10）：收口 R319/R320 观察项——刷题页（pages/practice/practice.vue）选项仅 @click pick，无 longpress/_excl，两个核心做题模式交互不一致（粉笔练习/模考同构支持长按排除）。语义差异：刷题 pick 一次性锁定立即判分，排除仅未作答时有意义；beiMode 显示答案不适用；无服务端练习进度协议，不做服务端同步（本机态定位）。
- 收口纯前端零后端/零契约：复用 exam-excl.js（toggleExcl/pickWithExcl 不改），新增纯函数 exclVisible(excl,k,picked,beiMode)——排除视觉仅未作答且非背题呈现，作答后判分视觉（right/wrong/dim）接管避免混叠；practice.vue 选项补 @longpress toggleExclOpt（beiMode||picked no-op，toggle 后 saveSession() 落快照）；pick(k) 前置 pickWithExcl（点击被排除项自动解除并选中）；.opt.excl 0.45 弱化+删除线与做卷页同视觉；_excl 随 pendingSession 整 items 快照持久化，旧快照 fail-closed 回落 []。
- 验证：lint/vitest 373(+4)/build 全绿；生产 rev 5632ec3、bundle index-BcpMI5gO.js；testing agent 1440/375 实测：长按排除/再长按恢复（opacity 0.45+line-through computedStyle 实证）、排除后作答判分接管无混叠+autoNext 正常、点击被排除项自动解除并选中、硬刷 pendingSession 恢复排除态、背题模式长按无效且关闭后排除态重现、examMode（真题卷练习模考态）长按生效、双视口溢出 0、console 0 error。清理 test-r321-ui。
- 未生产实测：真实触屏手势（CDP touch 模拟，同 R319 口径）。
- 走查发现补丁：初版 toggleExclOpt 不落快照（「排除后不作答直接刷新」丢排除态），已补 saveSession()；方向键 jumpTo() 不保存为既有行为未改。
- 详见 docs/iter/round-3/design-r321-practice-option-exclude.md。

### R320：未交卷模考「排除干扰项」跨设备同步（PR #517）
- 取证（SOP-10）：收口 R319 观察项——_excl 仅随本机 examProgress 快照持久化，pushProgress 只上传 picks/idx/marks/secs、adoptServerExamProgress 恢复的 items 不含 _excl；换设备续考后设备 A 的排除态全丢。R317/R318 已建立同构续考状态同步模式，_excl 是最后一块未同步做题过程态。
- 收口零新 endpoint/表/URL 状态：db _ensure_exam_progress 幂等补列 exam_progress.excl TEXT（JSON {question_id:[选项字母]}，与本协议 picks/marks/secs 同 question_id 口径；交卷协议不涉及排除态无口径冲突）；save_exam_progress(..., excl=None) 非空存 JSON 空存 NULL（UPSERT 整体覆盖，空即清除）；latest_exam_progress 回读 dict（旧行 {}）；POST /api/exam/progress 可选 excl（缺省 {}；提供时必须 dict ≤300、key 可 int 化、value 为 list ≤4 且逐项 ∈{A,B,C,D} 字符串，否则 400 不静默转换；落库去重保序、空 value 行不落库）；GET /api/exam/resume 应答补 excl。前端 pushProgress 补收集非空 Array q._excl 的 {q.id: _excl}；adoptServerExamProgress 按 excl 对象恢复 _excl（字符串键 Number 归一、非数组/非法字母项 fail-closed 过滤、未命中 []），本机快照优先不变；交卷 payload/报告协议零变化。
- 验证：ruff/pytest 185(+1)/pyright 0/lint/vitest 369(+3)/build 全绿；生产 rev 551cfc9、bundle index-Bpp2JadM.js；API 实测 excl 重复字母 roundtrip 去重保序、空 value 行不落库、缺省覆盖 {}、非法 7 类逐项 400；testing agent 跨设备实测：设备 A 1440 题1 排除 B/D 后选 A、题2 排除 C，去抖 POST 实抓 body 含 excl 与页面一致；设备 B 375 全新 CDP 隔离 context 同 uid 首页续考卡→恢复弹窗→排除态完整恢复（弱化+删除线逐题逐选项一致，picks/secs 继承、marks 无扰动）；恢复后点击被排除项自动解除并选中（R319 行为不变）；交卷后 resume={}；双视口溢出 0、console 0 error；Lighthouse 全过（/ 0.98/LCP 810ms、/tiku/ 1.00）。清理 test-r320-api+test-r320-ui DELETED 9 / LEFTOVER 0，保护 uid 30 表快照前后逐表一致。
- 未生产实测：卷库横幅续考入口（同 adoptServerExamProgress 路径，R318 已验）；excl 非法值 400 分支的 UI 侧路径（API 已逐项自测）。
- 观察项：部署后旧 SPA 标签页仍跑旧 bundle 不上传 excl（硬刷后正常，SPA 固有行为）；刷题页排除交互补齐仍挂起。
- 详见 docs/iter/round-3/design-r320-progress-excl-sync.md。

### R322：普通刷题「未完成练习」跨设备同步（PR #519）
- 取证（SOP-10）：普通刷题 pendingSession 仅存本机 storage（24h TTL），换设备/清缓存丢未完成题组；模考已有 exam_progress 服务端续考（R298–R320），画像/每日目标/练习偏好/申论草稿均已服务端化，普通刷题快照是最后的服务端化缺口（粉笔练习进度绑定账号云恢复）。
- 收口：新表 practice_progress（uid 主键单快照：qids/picks/excl/idx/right_n/streak/best_streak/module/submodule/updated_at）+ POST /api/practice/progress（uid 64 截断、qids ≤100 正整数拒 bool、picks/excl 仅 A–D 且 key ∈ qids、excl ≤4、qids:[] 即清除、idx/stat clamp、rl "ppro" 120/3600）+ GET /api/practice/resume（>24h 或全下架返回 {}，items 按原 qids 顺序，下架题跳过）。前端 practice-progress.js 纯函数 collectPracticeProgress/adoptPracticeResume（非法 fail-closed）；saveSession() 落本机快照后 1.5s 去抖 pushPracticeProgress；本机快照优先，无本机快照时 tryServerResume 复用「继续上次练习？」弹窗；完成/退出/「不用了」clearServerProgress；恢复题 _logged=!!picked 防重复写 answer_log；beiMode/examMode/时政组不进同步；失败静默不阻塞。
- 竞态补丁（走查发现，commit 0a78a78）：quit 清除 POST 与立即再入的 resume GET 竞争，实测 2/10 陈旧弹窗——clearServerProgress 本机记 ppClearedAt，30s 内 tryServerResume 跳过远端直接开练（本机 storage 判断无时钟偏差）；守卫过期后远端路径复测正常。
- 验证：ruff/pytest 191(+6)/pyright 0/lint/vitest 378(+5)/build 全绿；生产 rev 0a78a78、bundle index-DBEBlZtd.js；API 实测 roundtrip/非法 7 类 400/清除；testing agent 跨设备实测：设备 A 1440 作答+排除去抖 POST 实抓，设备 B 375 全新隔离 context 同 uid 恢复（顺序/判分/排除/idx/统计逐项一致），完成后 resume={}，新 uid 直开、本机优先 0 resume 请求，竞态修复复测通过；双视口溢出 0、console 0 error、Lighthouse 全过（/ 0.98/LCP 796ms、/tiku/ 1.00）。清理 test-r322-api/-ui/-ui-b/r322b-ui DELETED 27 / LEFTOVER 0，保护 uid 31 表快照一致。
- 未生产实测：excl 非法值 UI 侧路径（API 已验）；真实触屏长按（CDP 模拟，同 R319/R321 口径）。
- 详见 docs/iter/round-3/design-r322-practice-progress-sync.md。

### R323 首页「未完成练习」续练卡（2026-08-29，PR #520，基于 #520 分支 devin/1788386699-r323-home-practice-resume）
- 取证：首页只有模考续考卡（R288），普通刷题未完成进度（pendingSession + R322 practice_progress）在默认回流入口不可见，须进刷题页才触发恢复弹窗；粉笔首页有「继续练习」外显入口。
- 收口（纯前端零后端/零契约）：practice-progress.js 新增 fail-closed 纯函数 parsePendingPractice（本机快照→{done,total,module}，24h TTL/全部已答 null）与 parseRemotePractice（resume 应答同构）；home.vue 模考卡下同构续练卡（本机快照优先，无本机且 ppClearedAt 30s 守卫未命中才 GET resume，失败静默；「去继续」写 practiceLaunch {kind:'resume'} 直达恢复不二次弹窗；「✕」确认后清本机+记 ppClearedAt+POST qids:[]）；practice.vue launch 链新增 kind:'resume'→resumeNow()（本机优先直接采纳，否则服务端快照直接采纳），恢复采纳逻辑抽出 adoptLocalPending/adoptRemoteSnap 供既有弹窗路径复用。
- 走查发现并修复（commit c139171）：next() 原在 idx++ 前 saveSession()，本机快照 idx 比服务端去抖 POST 落后一步，「去继续」回到已答题——改为切题后落快照，专项复测 idx=1 直达第 2 题未答态。
- 验证：lint/vitest 384(+6)/build 全绿；生产 rev 0dec21a→c139171 两轮 testing agent 实测：本机命中 0 resume 请求、跨设备 375 隔离 context 服务端出卡直达恢复、放弃流程、完成/新 uid 反例、模考卡双卡共存、裸进入弹窗回归、双视口溢出 0/console 0 error、Lighthouse 全过。清理两轮 DELETED 29+3 / LEFTOVER 0，保护 uid 31 表快照一致。
- 未生产实测：resume 失败静默分支、24h TTL 过期分支（vitest 覆盖）、真实触屏。
- 详见 docs/iter/round-3/design-r323-home-practice-resume.md。

### R324 每日推送个性化——「今日到期错题」复习提醒（2026-08-29，PR #521，基于 #520 分支 devin/1788389576-r324-push-due-review）
- 取证：R98 每日 08:00 Web Push 对全体订阅者构造同一份「每日一练」payload（循环外构造），已完成当日每日一练者直接 skip；错题到期数据（db.due_review_count）与首页「今日到期复习 N 题」卡早已存在，但离开 App 后零触达。
- 收口：push_api.py 新增纯函数 build_push_payload(day, daily_done, due_n)（bool/非法 due 按 0 fail-closed）四分支：未完成每日+due=0→原文案不变；未完成每日+due>0→「今日学习提醒」合并文案仍深链每日一练；已完成每日+due>0→「错题复习提醒」深链 /#/pages/book/book?review=1&src=push；双完成→None 不打扰。_send_daily(only_endpoint=None) 循环内逐 uid 查 due_review_count（异常按 0），only_endpoint 为定向验证钩子（指定时不写 push_last_day 水位）。前端 parseBookOpts 白名单新增 review（仅 '1'，不进 buildBookUrl 状态 URL），book.vue onLoad 命中设 autoStartReview 复用既有 onShow 自动复习流。无新表/新调度/订阅协议不变。
- 验证：ruff/pytest 196(+5)/pyright 0/lint/vitest 385(+6)/build 全绿；生产 rev 90486d3、bundle index-C6UX06VT.js；testing agent 真实订阅+定向触发四分支全过（A：错题复习提醒点击自动进复习流 1/1；B：合并文案落每日一练；C：原文案不回归；D：sent=0 无通知），首页到期卡回归、review=abc/0 反例不触发、console 0 error；Lighthouse 独立复跑全过（部署首跑 / a11y 0.94/LCP 2648 单样本波动，复跑 1.0/1826ms）。清理 test-r324-push DELETED 9 / LEFTOVER 0，保护 uid 31 表快照一致。
- 未生产实测：cron 全量发送路径（出于安全只走 only_endpoint 定向；全量循环逻辑同一函数）；375 视口（本轮以通知点击流为主）；SW 未控页点通知不导航为浏览器已知行为非缺陷。
- 详见 docs/iter/round-3/design-r324-push-due-review.md。

### R325 字号设置扩展到做卷页与错题本复习流（2026-08-29，PR #522，基于 #521 分支 devin/1788391747-r325-fontlv-global）
- 取证：个人页字号三档（小/标准/大）只在普通刷题页生效，pkgA/exam/exam.vue 与 pages/book/book.vue 均不消费 fontLv，且个人页 toast 承诺「练习页生效」范围与实际不符；粉笔在做题/做卷/解析等精读场景字号一致。
- 收口（纯前端零后端/零契约）：新增 src/font-size.js 共用口径（normFontLv 仅接受 0/1/2 非法回落 1；fontSizes → {q:26/30/34rpx, opt:25/29/33rpx}）；做卷页题干/选项（含材料折叠态小题干）与错题本复习流题干/解析接入 qStyle/optStyle，onShow 重读 storage 使从个人页返回立即生效；复习列表扫描态不变；practice.vue 改复用同一纯函数；profile toast 改「（做题与复习页生效）」。
- 走查发现并修复（commit a3b2800）：「小」档全站失效——各页 `uni.getStorageSync('fontLv') || 1` 把数值 0 当 falsy 吞成标准档（旧 practice.vue 同样写法，属既有缺陷，入口收敛后成必踩路径）；四页读取全部改为 `normFontLv(uni.getStorageSync('fontLv'))`，复测小档 13/12.5px 精确命中、个人页刷新回显「小」。
- 验证：lint/vitest 389(+4)/build 全绿（修复后复跑）；生产 rev e10c472→a3b2800、bundle index-BwG3QXxG.js；testing agent 两轮实测：三档 computed px 逐档精确（13/12.5、15/14.5、17/16.5）、切档返回即时生效、材料折叠题干、复习流题干+解析、列表态不变、非法值('abc'/5)回落、1440/375 溢出 0/console 0 error；Lighthouse 全过（/ 0.98、/tiku/ 1.00）。清理 test-r325-font DELETED 19 / LEFTOVER 0，保护 uid 31 表快照一致。
- 未生产实测：375 视口小档专项（375 已覆盖标准/大与溢出）；真实触屏。
- 详见 docs/iter/round-3/design-r325-fontlv-global.md。

### R326 复盘场景补「AI 详解本题」入口——报告解析浮层 + 错题本复习流 + 共享 askPrefill（2026-08-29，PR #523，分支 devin/1788394706-r326-ask-from-review）
- SOP-10 四维复审后取证：普通刷题页已有 AI 深度讲解出口（redoQuestion → /pages/ask/ask），但成绩报告解析浮层（已是复盘工作台）与错题本复习流「看完解析仍不懂」的高价值时刻零 AI 出口（粉笔逐题 AI 讲题、夸克 AI 讲解+追问）。
- 收口（纯前端零后端/零契约/零 URL 状态）：新增 src/ask-prefill.js 纯函数 askPrefill(stem, options)（题干非字符串/空白返回 ''、options 非法容错、空串不跳转 fail-closed）；practice.vue deepExplain 改共用口径；book.vue 列表卡「AI 详解」与复习流判分后新增「看不懂？AI 详解本题」；report.vue 浮层解析后、纠错前新增同名入口（材料题取 detailMat.stem 小题干，连看随题切换）。
- 走查发现并修复（commit 674b272）：错题本侧预填选项重复两遍——mistakes.question_text 写入口径本就是题干+选项（practice.vue 与 exam_api._mistake_text 同构），初版再传 m.options 二次拼接；修正为 askPrefill(question_text, null)。
- 验证：lint/vitest 394(+5)/build 全绿；生产 rev 80dce10→674b272、bundle index-CkDDJQ_o.js；testing agent 两轮双视口实测：三入口预填单份选项（textarea A. 计数=1）、报告连看切题不串题、资料分析只填小题干、既有练同类/纠错/收藏/social bar 回归、1440/375 溢出 0、console 0 error、Lighthouse 全过；未点「讲解」零 LLM 请求。清理 test-r326-ask 两轮累计 DELETED 14 / LEFTOVER 0，保护 uid 快照一致。
- 未生产实测：真实触屏；askPrefill 空 stem fail-closed 生产分支（vitest 覆盖）；真实 LLM 讲解请求（刻意不触发）。
- 详见 docs/iter/round-3/design-r326-ask-from-review.md。

### R327 AI 详解入口带上用户作答——redoAnswer 协议 + askAnswerLetter 纯函数（2026-08-29，PR #524，分支 devin/1788396969-r327-ask-user-answer）
- 取证：ask 页早有 uanswer A–D chips 且 doExplain 已把 user_answer 传 /api/explain（讲解质量随作答上下文提升），但 R326 四个入口只写 redoQuestion、进入后 uanswer 恒空，用户须手动重选自己的错选。
- 收口（纯前端零后端/零契约）：ask-prefill.js 新增 askAnswerLetter(v)（提取恰好一个 A–D 字母，多选/非法/空 fail-closed 返回 ''）；四入口（practice deepExplain 用 picked、book redo/askFromReview 用 user_answer、report askDetail 用 d.picked）有效值写 redoAnswer、无效 removeStorageSync 防串题；ask 页消费 redoAnswer（严格 /^[A-D]$/ 白名单）后即删。
- 验证：lint/vitest 397(+3)/build 全绿；生产 rev 418bcf7、bundle index-uYRj2nkH.js；testing agent 双视口实测：四入口 chip 恢复（复习流恢复历史 user_answer=A 不被本次作答污染）、未答无 chip、先 B 后未答题不继承（清理生效）、消费后 storage null（CDP 实测）、手动 chips 无回归、1440 console 0 error、375 无溢出、零 LLM 请求。清理 test-r327-ans DELETED 46 / LEFTOVER 0，保护 uid 31 表快照一致。
- 未生产实测：detailMat 折叠材料分支（本卷未遇到，R326 已验）；askAnswerLetter 多选/非法字母分支（生产 UI 不可达，vitest 覆盖）；真实触屏。
- 环境观察项：测试期间生产 VPS 被同机 recruit 应用（postgres 长查询 + 长跑 pip install）打到 load ~21、两次 503；未动任何服务，恢复后重试通过；同机资源争抢需老板关注。
- 详见 docs/iter/round-3/design-r327-ask-user-answer.md。

### R328 AI 问答历史会话跨设备同步——ask_sessions 表 + /api/ask/sessions CRUD + 本机优先 merge（2026-08-29，PR #525，基于 #524 分支 devin/1788401713-r328-ask-sessions-sync）
- 取证：ask 页历史会话（askSessions，讲解+追问，用户已消耗真实 LLM 成本）纯本机 uni storage，换设备/清缓存全丢；R296/R297/R322 已建立「服务端权威 + 本机快照优先 + 失败静默」同步口径，AI 会话是最后一块高价值本地资产。
- 收口：后端新表 ask_sessions(uid,sid,ts,title,n,items JSON,updated_at,PK(uid,sid))；GET /api/ask/sessions?uid=（ts DESC,sid DESC 最新 20）；POST upsert（严格校验：uid≤64 必填、sid/ts 正整数拒 bool、title 截 60、n∈1..50、items 非空 list[dict]≤50 且序列化≤200K，uid 限速 rl("asksess",60,3600)，upsert 后每 uid 只留最新 20）；DELETE /{sid}?uid= 按 uid 隔离。前端新纯函数 src/ask-sessions.js mergeAskSessions（按 id 去重并集、本机优先、ts 降序、cap20、非法 fail-closed）；ask.vue onShow syncSessions 异步 GET+merge 回写、archiveCurrent 本地成功后异步 POST、loadSession/delSession 后异步 DELETE，全部失败静默。不改 /api/explain、不同步进行中 askCurSession。
- 验证：ruff/pytest 200(+4)/pyright 0（npx pyright，本机无全局装）/lint/vitest 401(+4)/build 全绿；生产 rev 61b20c4、bundle index-DfsHZs41.js；API 层临时 uid 实测 roundtrip/upsert/隔离/非法逐项 400/超 200K 400；testing agent 三 context 模拟三设备：A 归档 POST 200→B(375) 历史出现并完整恢复讲解+追问→B 再归档+UI 删除 DELETE 200→C 全新 context 远端空态；fail-open 实证（远端删后 A 本机副本保留属本机优先设计；测试中真实遇 503，POST 静默失败本地不受影响）；双视口溢出 0、console 0 error、零 /api/explain；Lighthouse 全过（/ 0.99、/tiku/ 1.00）。清理 test-r328-* + 2 个附带随机 uid：DELETED 3 / LEFTOVER 0 / PROTECTED_MATCH True（32 表）。
- 未生产实测：真实触屏；限速 60/h 分支；本机残留副本删除时远端 404 分支（DELETE 幂等 ok）。
- 环境观察项（本轮第 3 次）：测试期间生产因同机 recruit/softcopyright 负载（load ~20）503 约 15 分钟，watchdog 自愈；未动任何服务；同机资源争抢持续需老板关注。
- 语义注意：loadSession（恢复历史）本地既有行为就是把该条移出历史，现同步删服务端对应条；远端删除不强制删本机副本（fail-open，本机优先）。
- 详见 docs/iter/round-3/design-r328-ask-sessions-sync.md。

### R329 AI 问答历史会话「查看不销毁」+ 再归档回写同一会话（2026-08-29，PR #526，基于 #525 分支 devin/1788405768-r329-ask-session-view-keep）
- 取证：loadSession(i) 旧语义为「取出销毁」——点开历史即 splice 出本机列表 + dropRemoteSession 删服务端；回看一条讲解若不重新归档就永久丢失，重新归档又生成新 Date.now() sid 造成重复条目+ts 重置。粉笔/夸克历史会话均为「点开查看、列表保留、显式删除」。R328 服务端 POST 已按 (uid,sid) upsert，纯前端收口。
- 收口（零后端/零契约）：ask-sessions.js 新增纯函数 upsertLocalSession(sessions,sess)（同 id 去重置顶、cap20、非法 fail-closed、输入不可变）；ask.vue data 补 curSid（初始化读 askCurSid storage 防刷新丢 sid）；loadSession 不再 splice/DELETE，记录 curSid=s.id 并写 askCurSid；archiveCurrent sid = curSid || storage(askCurSid) || Date.now()，本机改 upsertLocalSession，POST 同 sid upsert，归档后清 curSid/askCurSid；newSession 同步清；delSession 显式删除语义不变。
- 验证：lint/vitest 404(+3)/build 全绿（纯前端未动后端，后端门禁沿用 R328 全绿基线）；生产 rev 3551a28、bundle index-D9AjcS4H.js；testing agent 实测（uid test-r329-keep）：A(1440) 恢复后历史仍保留、0 DELETE；「新对话」再归档 POST sid=原 sid、本机不重复、服务端同 sid ts 更新；B(375 隔离 context) 同步、恢复保留；B 显式删除→DELETE 200→C 全新 context 空态；双视口溢出 0、console 0 error、零 /api/explain；Lighthouse 全过（/ 1.00、/tiku/ 1.00）。清理 DELETED 2 / LEFTOVER 0 / PROTECTED_MATCH True（32 表）。
- 实景发现（fail-open 边界，挂观察项）：弱网下显式删除首次 DELETE 503 时本机已移除但服务端残留，刷新后会话从远端「复活」，重删成功——符合失败静默设计但用户可感知，后续可考虑删除失败重试/墓碑。
- 未生产实测：cap20 截断分支（vitest 覆盖）；真实触屏。
- 环境观察项（本阶段第 4 次）：测试期间生产两次因同机 recruit 负载（postgres 长查询+长跑 pip install，load ~17）503/超时，watchdog 自愈重启 kaogong 容器；未动任何服务；持续建议独立主机。
- 详见 docs/iter/round-3/design-r329-ask-session-view-keep.md。
### R330 AI 问答历史删除墓碑 + 失败重试——收口 DELETE 失败后会话「复活」（2026-08-29，PR #527，基于 #526 分支 devin/1788408896-r330-ask-del-tombstone）
- 取证：R329 生产实景发现 delSession 的 dropRemoteSession 失败静默（.catch(()=>{})），503 窗口本机已移除但服务端残留，下次 syncSessions union merge 把已删会话并回本机——「删除复活」；本阶段同机负载 503 已 4 次实景出现，缺陷真实可感知。粉笔/夸克删除历史即终态。
- 收口（纯前端零后端/零契约）：ask-sessions.js 新增墓碑纯函数 addTombstone/removeTombstone/pruneTombstones/filterTombstoned（storage 键 askDelTombs={sid:deletedAtMs}，TTL 7 天、cap 40 剔最旧、fail-closed、输入不可变）；ask.vue delSession 先记墓碑再 DELETE，成功才消墓碑；syncSessions 先 prune、远端 items 经 filterTombstoned 再 merge、对每个墓碑 sid 补发 DELETE 重试；archiveCurrent 同 sid 再归档消墓碑（撤销删除）。
- 验证：lint/vitest 408(+4)/build 全绿（纯前端，后端门禁沿用 R328 基线）；生产 rev e5c4ae3、bundle index-B0kkHHfg.js；testing agent 实测（uid test-r330-tomb，CDP Fetch.failRequest 定向拦截 DELETE 模拟弱网）：拦截下删除→墓碑落 storage→硬刷后服务端仍返回该 sid（curl 实证残留）但列表不复活（核心断言，改动前必复活）；恢复网络 onShow 自动补发 DELETE 200、墓碑清空、服务端回读已删；正常删除墓碑即时消除；R329 查看不销毁/R328 跨设备回归；双视口溢出 0、console 0 error、零 /api/explain；Lighthouse 全过（/ 0.98、/tiku/ 1.00）。清理 DELETED 3 / LEFTOVER 0 / PROTECTED_MATCH True（32 表）。
- 边界（如实）：墓碑仅本机——B 删、A 弱网窗口时 A 无墓碑仍可能短暂看到远端残留（无服务端墓碑的固有限制，本轮不改契约）；未生产实测：TTL 7 天/cap 40 分支（vitest 覆盖）、archiveCurrent 撤销分支（生产 UI 不可达）。
- 详见 docs/iter/round-3/design-r330-ask-session-del-tombstone.md。

### R331 AI 问答进行中会话刷新恢复——askCurSession 快照回填（2026-08-29，PR #528，基于 #527 分支 devin/1788410294-r331-ask-cur-restore）
- 取证：persistSession() 每次讲解/追问后写本机 askCurSession，但全页无回填路径——刷新后 results=[]，进行中会话 UI 消失；且 archiveCurrent 首行短路使快照进不了历史，「新对话」还会物理删除快照，已消耗真实 LLM 成本的问答永久丢失。粉笔/夸克刷新后会话上下文保留。
- 收口（纯前端零后端/零契约）：ask-sessions.js 新增纯函数 sanitizeCurItems（非数组 fail-closed []，仅保留 explanation 非空 string 的 object 条目，输入不可变）；ask.vue loadSession 映射抽出 adoptItems 复用；新增 restoreCurSession()（onShow 中 syncSessions 前调用，results 为空守卫防重复回填）；curSid 由 data() 读 askCurSid 恢复，R329 同 sid 再归档自然衔接。
- 验证：lint/vitest 410(+2)/build 全绿（纯前端，后端基线沿用 R330）；生产 rev 076df65、bundle index-CyabKi9q.js；testing agent 实测（uid test-r331-restore）：loadSession 产生进行中态→硬刷后讲解+追问自动回填（改动前必空态）、askCurSid 保留、「新对话」POST 复用原 sid 服务端不产生重复；无快照/字符串快照/混合非法快照 fail-closed；R328/R329/R330 回归；1440/375 溢出 0、console 0 error、零 /api/explain；Lighthouse 全过（/ 0.98、/tiku/ 1.00）。清理 DELETED 1 / LEFTOVER 0 / PROTECTED_MATCH True（32 表）。
- 边界（如实）：进行中会话仍仅本机（R328 只服务端化已归档会话）；恢复后 ansCard/sim 等瞬态不还原（与 loadSession 同口径）；字符串非法快照被忽略但不主动清 storage（无害，候选顺手清理）；真实触屏未实测。
- 详见 docs/iter/round-3/design-r331-ask-cur-session-restore.md。

### R332 AI 问答进行中会话跨设备同步——ask_cur 单快照 + /api/ask/cur（2026-08-29，PR #529，基于 #528 分支 devin/1788411812-r332-ask-cur-sync）
- 取证：R331 后进行中会话可刷新恢复但 askCurSession 仍纯本机 storage——换设备/清缓存后进行中讲解+追问（已消耗真实 LLM 成本）全丢；已归档会话 R328 起可跨设备，语义不一致。粉笔/夸克进行中上下文跨端保留。
- 收口（复用 R298/R322 uid 单快照模式）：后端新表 ask_cur(uid PK, sid, ts, items JSON, updated_at)+save/clear/get_ask_cur；POST /api/ask/cur（items 非 list/>50/非 dict/序列化>200k→400，items:[]=清除，sid 0=未归档或正整数衔接 R329 同 sid，ts 正整数，rl askcur 120/h uid 桶）；GET 无快照或超 7 天→{}。前端 parseRemoteCur 纯函数 fail-closed（items 经 sanitizeCurItems 后空→null，sid 非正整数归 0）；persistSession 末尾去抖 1.5s pushCurSession POST 整份快照；newSession 清本机+取消未决去抖+POST items:[] 清服务端+_curCleared 守卫；restoreCurSession 本机快照优先（命中 0 GET），无本机才异步 GET 回填（回调三重守卫：results 非空/已点新对话/本机已有快照则丢弃），sid>0 恢复 curSid/askCurSid。
- 验证：ruff/pytest 204(+4 test_ask_cur.py)/pyright 0/lint/vitest 413(+3)/build 全绿；生产 rev 8a9b70d、bundle index-u8FD-V0M.js；API curl 逐项实测（roundtrip/lww 覆盖/uid 隔离/7 类非法 400/items:[] 清除）；testing agent 双设备实测（uid test-r332-cursync）：A 1440 loadSession 产生进行中态→去抖 POST 实抓含 sid+items；B 375 全新隔离 context 同 uid 无本机快照→打开 ask 页自动 GET 回填讲解+追问、askCurSid 恢复；A 硬刷本机优先 0 GET；A「新对话」POST items:[] 后 B 硬刷空态；R328/R329/R330/R331 回归；1440/375 溢出 0、console 0 error、零 /api/explain；Lighthouse 全过（/ 0.98、/tiku/ 1.00）。清理 DELETED 2 / LEFTOVER 0（按 test-r332-% 前缀删除，保护 uid 不可触及）。
- 边界（如实）：单快照 last-write-wins，多设备同时进行中会话互相覆盖（同 exam/practice 口径，不做合并）；7 天 TTL/限速分支未生产实测（pytest 覆盖）；去抖多次快速操作合并未专项实测；真实触屏未实测；网络失败静默分支未生产实测。
- 详见 docs/iter/round-3/design-r332-ask-cur-cross-device.md。

### R333 搜索题目详情补「AI 详解本题」入口（2026-08-29，PR #530，基于 #529 分支 devin/1788413330-r333-search-ask-entry）
- 取证：搜索页两处题目详情展开态（code_hit 直达 + 题目列表）已有题干/选项/答案/解析/复制链接，但零 AI 出口；R326 已铺报告浮层/错题本，R327 建立 redoAnswer 协议；/api/search/question/{qid} 已返回 question/options，可直接复用 askPrefill。
- 收口（纯前端零后端契约）：两处详情态 .d-acts 行「AI 详解本题」+「复制本题链接」并排；askFromSearch(d)=askPrefill 预填（空 no-op）→ setStorageSync redoQuestion → removeStorageSync redoAnswer（搜索无作答语义，防串用上一题作答）→ trackEvent('search_ask_click', module) → switchTab /pages/ask/ask；@click.stop 防冒泡收起详情；R158/R160 竞态防护不变。
- 走查发现并修复：/api/track 事件白名单缺 search_ask_click 致埋点 400 丢失，且既有 review_ask_click/report_ask_click（R326/R327 入口）同样不在白名单、一直在 400——team.py 白名单三事件一并补入。
- 验证：ruff/pytest 204/pyright 0/lint/vitest 413/build 全绿；生产 rev b65ac08 testing agent 双视口实测（uid test-r333-search）：1440 关键词入口 + 375 code_hit（纯数字 id 命中）详情均出 AI 按钮；点击预填题干+选项单份不重复；预置 redoAnswer=B 后走搜索入口 ask 页无 B chip、storage 已清；复制链接/详情收起展开回归；全程 0 次 /api/explain、console 0 error（除埋点 400，修复后消除）、双视口溢出 0；Lighthouse 全过（/ 0.98/LCP 804、/tiku/ 1.00）。
- 边界（如实）：语义码形式 code（如 YY-LJTK-2017-1274831）不命中 code_hit 走全文搜索（既有 parse 逻辑，非本轮改动）；真实触屏未实测；埋点白名单修复后的 200 回归待下次部署复验。
- 详见 docs/iter/round-3/design-r333-search-ask-entry.md。

### R334 收藏题目详情补「AI 详解本题」入口（2026-08-29，PR #531，分支 devin/1788415680-r334-fav-ask-entry）
- 取证：收藏与笔记页收藏题目卡展开态已有题干/选项/答案/解析与 移动到…/讨论区/取消收藏 操作，但零 AI 出口——是最后一个有完整题面却无 AI 出口的复盘场景（刷题/错题本/报告浮层 R326、搜索 R333 均已就位）。
- 收口（复用协议，零新 endpoint/表/URL 契约）：ops 行行首「AI 详解本题」；askFromFav(it)=askPrefill(it.question, it.options) 预填（空 no-op）→ trackEvent('fav_ask_click', module) → setStorageSync redoQuestion + removeStorageSync redoAnswer（收藏无本次作答语义，防串用旧作答）→ switchTab /pages/ask/ask；@click.stop 防收起卡片；本地收藏 _local 同 schema 直接可用；team.py /api/track 白名单同步补 fav_ask_click（吸取 R333 教训，避免静默 400 丢埋点）。
- 验证：ruff/pytest 204/pyright 0/lint/vitest 413/build 全绿；生产 rev 2bb985c testing agent 双视口实测（uid test-r334-fav）：1440/375 入口出现、点击不收起直接跳 ask 页、预填单份、预置 redoAnswer=B 被清（无 chip、storage null）、fav_ask_click 200×2、三个既有操作回归、0 次 /api/explain、console 0 error、双视口溢出 0；Lighthouse / 独立复跑×2 a11y 1.00、LCP 1811/1924ms（部署首跑 0.94/2643ms 为单样本波动）。
- 边界（如实）：真实触屏未实测；「移动到…」仅验弹层未执行实际移动；375 下三个回归操作未单测（1440 已验）；测试 uid 全库清理 DELETED 4 / LEFTOVER 0、保护 uid 快照一致。
- 详见 docs/iter/round-3/design-r334-fav-ask-entry.md。

### R335 练习历史逐题回看展开态 + 「AI 详解本题」入口（2026-08-29，PR #532，分支 devin/1788416965-r335-history-detail-expand）
- 取证：练习历史会话详情逐题行只有 ✓/✗ + 两行截断题干 + 错题「我的答案 X · 正解 Y」+ 用时，不可点开；后端 practice_history_detail 每行早已附完整题库原题（options/answer/explanation/hs_explanation），数据就位纯呈现缺口；用户想弄懂错题只能「重练」重做。粉笔练习历史支持逐题点开看解析。
- 收口（纯前端 + 埋点白名单，零新 endpoint/表/URL 契约）：有 d.question 的逐题行可点展开（openDetailIdx 单开互斥，切会话重置）：题干去截断 + 选项（正解绿 ans/我的错选红 bad）+ 正确答案/我的答案行 + 解析；question=null（下架题）行不可展开无箭头；展开态「AI 详解本题」= askPrefill 预填（空 no-op）→ trackEvent('history_ask_click', module) → 写 redoQuestion；picked 经 askAnswerLetter 有效写 redoAnswer（本场景有真实作答语义，区别 R333 搜索/R334 收藏）、无效显式 remove → switchTab ask 页；@click.stop 防冒泡；team.py 白名单补 history_ask_click。
- 验证：ruff/pytest 204/pyright 0/lint/vitest 413/build 全绿；生产 rev c7a6dd9 testing agent 双视口实测（uid test-r335-history，API 造数 1错+1对+1未答）：逐题展开呈现/单开互斥/再点收起、错题进 ask chip=B 错选、对题 chip=A 不串题、未答（预置 redoAnswer=D）无 chip 且 storage 被清、history_ask_click 200×4、重练/会话折叠/快照即显回归、0 次 /api/explain、双视口溢出 0、console 0 error。
- 边界（如实）：真实触屏未实测；下架题（question=null）行分支无法安全构造未生产实测（代码 fail-closed）；Lighthouse 本轮跳过（分包 hash 路由无独立文档，R334 刚复跑首页基线）；测试期间宿主一度整体不可达 4–5 分钟（共享宿主负载，自行恢复，未归因本应用）；测试数据全库清理 DELETED 10 / LEFTOVER 0、保护 uid 快照一致。
- 详见 docs/iter/round-3/design-r335-history-detail-expand.md。

### R336 AI 问答会话与题目关联：item 级 qid + 「回看 AI 详解」（2026-08-29，分支 devin/1788420168-r336-ask-qid-link）
- 取证（SOP-10 审计窗口，四维复查后选定功能深度缺口）：R326–R335 六个复盘场景 AI 入口只写 redoQuestion 文本，题目 id 在跳转时丢弃；ask 会话 item（本机/ask_sessions/ask_cur）无任何题目关联字段——用户回到同一题无法知道已问过 AI，只能翻历史列表或再触发一次 LLM 讲解（重复成本）。后端 /api/ask/sessions 与 /api/ask/cur 的 items 是不透明 dict 列表，天然可带新字段，零后端改动。
- 收口（纯前端，零新 endpoint/表/URL 契约，不改 /api/explain）：新纯函数 ask-link.js——askQid(v) 仅接受正整数（number 或纯数字字符串）否则 0；findAskSid(sessions, curItems, qid) 先扫进行中 items（命中 {sid:0}）再按列表序扫归档 sessions（命中 {sid:s.id}），非法输入/无命中 null，全部 fail-closed。六入口（practice/book 复习+列表/report/search/favorites/practice-history）写 redoQuestion 同时有效写 redoQid、无效显式 remove；ask 页消费 redoQid→pendingQid，doExplain 仅文本讲解首条消费（qid 挂 rec 后即清零，图片讲解恒 0），persistSession 序列化补 qid: askQid(r.qid)，adoptItems 展开透传；askOpenSid 导航协议：回看入口写目标 sid（sid=0 进行中会话不写，直接切 tab 即见）→ ask onShow openLinkedSession() 消费并 loadSession 定位，非法/缺失静默。首批外显两处「回看 AI 详解」：练习历史展开态（toggleDetail 时算 seenAsk）+ 错题本复习流（reviewAskSeen computed + onShow tick 重算），仅命中才显示，点开零 LLM 请求。存量无 qid 会话不误命中、行为不变。
- 验证：ruff/pytest 204/pyright 0/lint/vitest 424(+11)/build 全绿。生产验证与测试数据清理见 PR 评论。
- P1（首版 753a187 生产走查发现并修复）：practice-history detail 行的题目 id 在 d.question.id（API 行结构 created_at/module/submodule/correct/secs/picked/question），首版误用不存在的顶层 d.question_id——toggleDetail 恒不出「回看 AI 详解」、askFromHistory 恒清 redoQid。修复：两处改 d.question && d.question.id（e91973b）。测试代理先证伪了「旧 split chunk 缓存」假设（清缓存+ignore-cache 重载后仍复现）才定位到字段契约问题。
- 生产复测（rev e91973b，bundle index-CHHA_PFm.js）：T1 进行中会话关联+练习历史「回看 AI 详解」+历史 AI 入口 pendingQid 透传、T2 归档会话 askOpenSid 写入/消费/定位、T3 错题本复习流命中/不误报/存量无 qid 不误命中、T4 有效 redoQid 透传+陈旧 redoQid 进无关题清除、T5 375 视口+归档/恢复/删除回归——全部通过；全程 0 次 /api/explain、track 无 4xx/5xx、console 0 error、无横向溢出；Lighthouse 预算部署脚本复验通过。
- 测试数据清理：test-r336-asklink 全库（含 uid/user_id 的 37 表字段）DELETED 17 / LEFTOVER 0；保护 uid umteojq4sltdhorhm 37 项计数+内容哈希验前验后逐项一致。
- 边界（如实）：关联以「预填后首次文本讲解」为锚，用户清空重写题目再讲解仍会挂原 qid（提示性关联，非强一致）；跨设备新会话首扫依赖 syncSessions 异步完成后再进入页面才可见（fail-closed 不误报）；回看入口首批只铺练习历史+错题本复习流，其余场景待后续轮次；真实 LLM 请求刻意未触发（用 CDP/localStorage 注入既有讲解模拟）、真实触屏未测（CDP touch 模拟）、图片讲解 qid=0 分支未生产实测（vitest 覆盖）。
- 详见 docs/iter/round-3/design-r336-ask-qid-link.md。

### R337 「回看 AI 详解」入口铺满剩余复盘场景：报告解析浮层/搜索详情/收藏详情（2026-08-29，PR #535，分支 devin/1788423125-r337-ask-seen）
- 取证：R336 已建立 item 级 qid 关联协议（ask-link.js askQid/findAskSid + askOpenSid 导航），report.vue/search.vue/favorites.vue 三场景已写有效 redoQid，但均未用 findAskSid 检查已有 AI 讲解——用户在成绩报告浮层/搜索详情/收藏详情再遇同一题只见「AI 详解本题」，不知已问过，可能重复触发 LLM。
- 收口（纯前端，零新 endpoint/表/URL 契约，不改 /api/explain）：三页复用 findAskSid——report.vue detailAskSeen computed（qid=detail.question_id）+ askSeenTick onShow 重算 + openSeenAsk()（sid>0 写 askOpenSid、sid=0 直切 ask tab）；search.vue 同构（qid=detail.id，code-hit 与列表详情两处模板）；favorites.vue 收藏卡可多开改按 item 查 favAskSeen(it)（qid=it.id，本地时政收藏 id:null 由 askQid fail-closed 不显示）。命中态「回看 AI 详解」绿色（--ok-strong），未命中/legacy 无 qid/非法 id 不显示。
- 验证：lint/vitest 424/build 全绿（纯前端，后端基线沿用 R336）；生产 rev 0943b6b、bundle index-CNuYvyjz.js，部署脚本 API 回归+Lighthouse 预算全过（/ 0.99/LCP 805ms、/tiku/ 1.00/LCP 931ms）。testing agent 实测（uid test-r337-replay，CDP 注入 askSessions/askCurSession 模拟已有讲解）：报告浮层归档命中（入口位于「AI 详解本题」上方、点击自动打开归档会话、askOpenSid 被消费）、sid=0 当前会话直切不写 askOpenSid、切无关题入口消失；搜索 code-hit 命中/无关题反例；收藏详情命中/未问过反例；既有「AI 详解本题」预填与 redoQid 消费回归；375/1440 溢出 0、console 0 error、全程 0 次 /api/explain。
- 测试数据清理：test-r337-replay 全库 DELETED 5 / LEFTOVER 0；保护 uid umteojq4sltdhorhm 快照验前验后逐项一致（PROTECTED_MATCH True）。
- 边界（如实）：本地时政收藏 id:null fail-closed 分支未生产构造（vitest 覆盖 askQid）；真实触屏未测（CDP 模拟）；「回看」入口无独立埋点（与 R336 口径一致）；ask 常驻 tab 注入时序注意事项已入测试 SKILL。
- 详见 docs/iter/round-3/design-r337-ask-seen-everywhere.md。

### R338 「回看 AI 详解」命中态收尾：刷题页解析区/错题本列表展开态（2026-08-29，PR #536 + 样式修复 PR #537）
- 取证：全代码库 redoQid 写入点复查，R337 后仅剩两处场景写有效 redoQid 但无已有讲解命中态——practice.vue 解析区 deepExplain（qid=cur.id）与 book.vue 列表展开态 redo(m)（qid=m.question_id）。
- 收口（纯前端，零新 endpoint/表/URL 契约，不改 /api/explain）：两页复用 ask-link.js findAskSid + askOpenSid 协议——practice.vue curAskSeen computed（askSeenTick onShow 重算）+ 解析区「回看 AI 详解 ›」（.deep.seen 绿色，位于「用花生十三方法详解这道题」上方）+ openSeenAsk()（sid>0 写 askOpenSid、sid=0 直切 ask tab）；book.vue 列表展开卡 mAskSeen(m) 方法查 + 「回看 AI 详解」（.op.seen）+ openSeenAskM(m) 同构导航，@click.stop 防收起。未命中/legacy 无 qid/非法 id fail-closed 不显示。
- P2（首版 94ce6a3 生产走查发现，PR #537 修复 069eefc）：book.vue 模板用了 class="op seen" 但漏加 .op.seen CSS——错题本回看入口渲染默认黑色 rgb(23,24,28) 而非绿色。补 `.op.seen { color: var(--ok-strong); }` 后生产复验 getComputedStyle = rgb(21,128,61)（--ok-strong #15803d）。
- 验证：lint/vitest 424/build 全绿（纯前端）；生产 rev 069eefc、bundle index-Dpq4U62M.js，部署脚本 API 回归+Lighthouse 预算全过。testing agent 两轮实测（uid test-r338-replay / test-r338b-css）：刷题页归档命中导航+sid=0 直切+切无关题消失、错题本列表命中（含 mastered 项）/未命中反例、@click.stop 不冒泡（bubble listener 客观验证）、askOpenSid 写入/消费、原 AI 详解预填与 redoQid 消费回归、375/1440 溢出 0、console 0 error、全程 0 次 /api/explain。
- 测试数据清理：两轮 uid 全库合并清理 DELETED 15 / LEFTOVER 0；保护 uid umteojq4sltdhorhm 37 项快照验前验后逐项一致（PROTECTED_MATCH True）。
- 边界（如实）：真实触屏未测（CDP 模拟）；真实 LLM 刻意未触发（CDP 注入已有讲解模拟）；askSeenTick 独立隔离路径经换题/重进会话等价覆盖；ask onShow 会回写覆盖注入的 askSessions（测试注入需整页硬刷，已入测试 SKILL）。
- 详见 docs/iter/round-3/design-r338-ask-seen-final.md。


### R339 AI 问答会话「查看原题」反向闭环 + 历史空态文案修正（2026-08-29，PR #538，分支 devin/1788428478-r339-ask-view-question）
- 取证：R336–R338 打通「题 → AI」（六场景入口 + 回看命中态），反向为零——AI 讲解 bubble chips 仅「再讲细一点/出同款题/存错题本」，item 级 qid 已就位但用户无法从讲解回到原题继续收藏/纠错/看讨论/复制链接；历史会话空态仍宣称「仅保存在本机」，与 R328 起服务端跨设备同步事实不符（错误承诺）。
- 收口（纯前端 + 埋点白名单一行，零新 endpoint/表/URL 契约，不改 /api/explain）：ask-link.js 新增 fail-closed 纯函数 askViewUrl(qid)——askQid>0 返回 `/pkgA/search/search?q=<qid>&qid=<qid>` 否则 null，复用 /api/search 纯数字 code_hit 直达 + 搜索页 ?qid 自动 toggleDetail（R270）；ask.vue chips 行尾 v-if="viewUrl(r)" 追加「查看原题」，点击 trackEvent('ask_view_question') → uni.navigateTo；空态文案改「同一账号换设备也能看」；team.py 白名单补 ask_view_question（防 R333 式静默 400）。不改 findAskSid/askOpenSid/redoQuestion/redoAnswer/redoQid 协议。
- 验证：ruff 0/pytest 205(+1)/pyright 0/lint/vitest 426(+2)/build 全绿；生产 rev 0323231、bundle index-COlLAc83.js，部署脚本 API 回归+Lighthouse 预算全过（/ 0.99/LCP 810ms、/tiku/ 1.00）；curl 实测 ask_view_question 200/bogus 400。testing agent 双视口实测（uid test-r339-view，注入合法 qid/legacy 无 qid/qid=0 三类 item）：合法 qid 出第 4 chip、深链 ?q=333140&qid=333140 code_hit 直达详情自动展开（题目编码与 qid 对应）、埋点 200；legacy/qid=0 fail-closed 无 chip；空态新文案、全页无旧文案；既有 chips 回归（存错题本 /api/mistakes 200）；375/1440 溢出 0、console 0 error、全程 0 次 /api/explain。
- 测试数据清理：test-r339-view + test-r339-api 全库 DELETED 5（mistakes 1 + growth_events 4）/ LEFTOVER 0 / 保护 uid 快照一致（PROTECTED_MATCH True）。
- 边界（如实）：真实触屏未测（CDP 模拟）；真实 LLM 刻意未触发（注入快照构造讲解）；「再讲细一点/出同款题」真实点击未测（会触发 LLM，仅验证存在）；题目下架时深链降级为搜索空结果（code_hit 缺失自然降级，未生产构造）。
- 详见 docs/iter/round-3/r339-ask-view-question.md。

### R340 错题本「按错因筛选」：月度复盘错因行直达 + 筛选 sheet 错因组 + ?rz= URL 同步（2026-08-29，PR #539，分支 devin/1788429993-r340-book-reason-filter）
- 取证：error_reason 数据与月度复盘 byReason 统计早已就位（R314 报告错因自评、复习流自评、sortBy=reason），但错因统计行不可点、筛选 sheet 无错因组、shownItems 不按错因过滤——「复盘定位高频错因 → 直接复习对应错题」链路断裂（粉笔错题本支持按错因筛选）。
- 收口（纯前端，零新 endpoint/表/契约，不改错因写入路径与月度统计口径）：book-url.js 白名单 RZS=[四正式错因,'未标注']，buildBookUrl 非 fav 输出 rz=encodeURIComponent(值)，parseBookOpts 先安全 decodeURIComponent 再白名单校验（畸形编码/非字符串 fail-closed 回 ''）；book.vue 新 rzFilter data（'未标注' 过滤 !error_reason，其他精确匹配）+ 筛选 sheet 来源组后「错因」组（hasReasonTagged 守卫：存在已标注错因才显示）+ 当前筛选 chip「错因：X ✕」+ 月度复盘按错因行可点 filterByReason（tab='todo'、rzFilter=name、收起复盘区）+ watcher/onLoad/syncBookUrl 接入 rz。
- 口径（如实）：复盘统计=本月新增，点击直达后的筛选=全部待掌握全集中该错因集合，两者口径不同属有意设计。PDF 导出自动跟随筛选（既有 shownItems 消费）。
- 验证：lint/vitest 428(+8)/build:h5 全绿（纯前端）；生产 bundle index-CEvL_QVo.js，部署脚本 API 回归+Lighthouse 预算全过（/ 0.98、/tiku/ 1.00）。testing agent 实测（uid test-r340-rz，真实 UI 刷题答错 3 题 + 复习流错因自评打标 2 条）：守卫反例（全未标注无错因组）→打标后 6 chips 出现、精确过滤/未标注桶、chip 清除、复盘行直达（tab 切回+复盘收起+过滤+URL 同步）、?rz= 硬刷恢复、?rz=hack fail-closed、tab=fav 无 rz、按错因排序/PDF 计数跟随/复习流回归、375/1440 溢出 0、console 0 error、全程 0 次 /api/explain。
- 测试数据清理：test-r340-rz 全库 16 表扫描 DELETED 10（mistakes 3/answer_log 3/review_log 2/growth_events 2）/ LEFTOVER 0；保护 uid umteojq4sltdhorhm DB 计数与 localStorage 逐键前后一致。
- 边界（如实）：真实触屏未测（CDP 模拟）；主流程窗口无逐请求抓包（daemon 迟启，补窗口重放核心交互 0 次 /api/explain、0 条 4xx/5xx；主流程未点任何 AI 按钮，录屏佐证）；「来源组后」相对位置因测试 uid 无模考错题未直接可见（hasExamMistakes 守卫，错因组正确出现在题型组后）。
- 详见 docs/iter/round-3/r340-book-reason-filter.md。

### R341 模考报告「本卷错因画像」卡 + 直达错题本按错因复习（2026-08-29，PR #540，分支 devin/1788431785-r341-report-reason-recap）
- 取证：R314 报告浮层逐题错因自评、R340 错题本按错因筛选均就位，但报告页零错因汇总——打完标看不到本卷错因构成，也无从报告直达错题本复习同错因，标注投入无 payoff。
- 收口（纯前端，零新 endpoint/表/契约）：report.vue computed reasonRecap（答错题按 error_reason||'未标注' 分组降序，非法值归未标注 fail-closed，0 错题不渲染）+「逐题对错」卡后「本卷错因画像」卡（行可点）+ goBookReason 白名单写 bookRzIntent → switchTab（tab 页无法带参，沿用 autoStartReview 式 storage 握手）；book.vue onShow 消费 bookRzIntent（读到即删，白名单通过 tab='todo'+rzFilter，复用 R340 过滤与 ?rz= URL 同步，非法仅删除）。tip 如实说明口径（直达=全部待掌握该错因集合，不限本卷）。
- 验证：lint/vitest 428/build:h5 全绿；生产 rev 0391d95、bundle index-CRhgmiOt.js，部署脚本回归+Lighthouse 全过。testing agent 实测（uid test-r341-rz，真实 UI 迷你模考 4 错 1 对）：初始未标注=4、浮层打标实时更新分组降序、错因行/未标注行直达（chip+?rz=+过滤+intent 消费即删）、0 答卷反例无卡、bookRzIntent='hack' fail-closed、重练 CTA/浮层导航/R340 sheet 回归、375/1440 溢出 0、console 0 error、0 次 /api/explain。
- 测试数据清理：test-r341-rz DELETED mistakes 4/answer_log 5/exam_attempts 2/growth_events 1，LEFTOVER 空；保护 uid DB 计数与 localStorage 逐键前后一致。
- 边界（如实）：真实触屏未测；主流程窗口抓包 daemon 白名单缺陷漏抓（发现后改捕全 /api/ 并重放核心交互补齐，缺陷经验已入测试 SKILL）。
- 详见 docs/iter/round-3/r341-report-reason-recap.md。

### R342 错题重练遵循错因筛选：/api/mistakes/redo 补 rz 参数 + redoAll 透传 + CTA 文案对齐（2026-08-29，PR #541，分支 devin/1788433748-r342-redo-reason-filter）
- 取证：R340 错题本按错因筛选、R341 报告错因画像直达均就位，但 redoAll() 只透传 kpFilter/filterMod，rzFilter 被无声忽略——按「概念不清」筛出 N 题点重练，实际拉全量待掌握错题，所见≠所练；重练卡文案也不反映错因态。
- 收口：backend study_api.py `/api/mistakes/redo` 新增可选 rz（白名单五值：四正式错因+未标注，非法 400 fail-closed，不传行为不变）；db.mistakes_redo_questions 补 reason 参数（'未标注'→`error_reason IS NULL OR ''`，其他→`error_reason=?`，匹配/去重/排序/limit 零变化）；book.vue redoAll() rzFilter 时追加 `&rz=`，重练卡标题「错题重练 · <错因>」+描述对齐（kpFilter 优先级不变）。redoSet 协议/practice 消费不改；srcFilter 不在本轮（redo 无来源维度）。
- 验证：ruff 0/pytest 208(+3，test_redo_reason.py 覆盖四错因/未标注 NULL+空串/非法 400/缺省不变)/pyright 0/lint/vitest 428/build 全绿；生产 rev f6d99b4、bundle index-B22QSvzn.js，部署脚本回归+Lighthouse 全过。testing agent 实测（uid test-r342-rz，真实 UI 迷你模考造 4 错题+浮层打标）：概念不清筛选重练集=仅该错因 2 题（抓包 rz= 编码正确）、未标注桶仅 NULL 题、无筛选回归无 rz 全 4 题、非法 rz=hack 400、R341 画像行→筛选态→重练全链路、?rz= 硬刷恢复、375/1440 溢出 0、console 0 error、0 次 /api/explain。
- 测试数据清理：test-r342-rz DELETED mistakes 4/answer_log 5/exam_attempts 1/growth_events 1，LEFTOVER 空；保护 uid DB 计数前后一致（PROTECTED_MATCH True）+ localStorage 逐键恢复 exact match。
- 边界（如实）：真实触屏未测（CDP 模拟）；kpFilter+rzFilter 叠加态未生产实测（代码三元 kpFilter 优先未改，vitest/代码走查覆盖）。
- 详见 docs/iter/round-3/r342-redo-reason-filter.md。

### R344 错题重练遵循三级考点筛选：/api/mistakes/redo 补 t3 参数 + redoAll 透传 + CTA 文案对齐（2026-08-29，PR #543，分支 devin/1788437508-r344-redo-tag3-filter）
- 取证：错题本三级考点筛选（kp3Filter，按模块查看三级行）就位，但 redoAll() 只透传 qtype/module——kp3 态点重练拉到整个二级分组集合，与 R342/R343 同构的「所见≠所练」缺口（且粒度差最大）。
- 收口：backend `/api/mistakes/redo` 新增可选 t3（白名单 taxonomy.topic_index() 正式考点 code，非法 400「无效的考点」，不传行为不变）；db.mistakes_redo_questions 补 tag3 参数（`question_id IN (SELECT id FROM questions WHERE tag3=?)`，无 question_id 手录错题被排除——本就不在 kp3 可见列表）；book.vue redoAll() kp3Filter 时从 shownItems 中 tag3_name 匹配项取 stable tag3 code 追加 `&t3=`（找不到 code 则回退不加，兼容策略），重练卡文案优先级 kp3Filter > kpFilter > rzFilter > srcFilter。redoSet/practice 消费不改。
- 验证：ruff 0/pytest 216(+4，test_redo_tag3.py：精确过滤/非法 400+缺省不变/无 question_id 排除/t3+rz 叠加)/pyright 0/lint/vitest 428/build 全绿；生产 rev 7284d96、bundle index-DVHbltOg.js，部署脚本回归全过。testing agent 实测（uid test-r344-t3，5 错题覆盖 CS-LS-01×2/CS-LS-02/YY-JB-02×2）：kp3「中国古代史」态 `&t3=CS-LS-01` 集合 [136,646]、同 qtype 对抗样本 649 被排除（证明 t3 生效非 qtype）、YY-JB-02 交叉 [97,498]、无筛选回归无 t3 全 5 题、非法 t3=HACK-00 400、t3+rz 叠加集合唯一交集 [136] 且卡标题只显考点、375/1440 溢出 0、console 0 error、0 次 /api/explain。
- 测试数据清理：test-r344-t3 DELETED mistakes 5/growth_events 1，LEFTOVER 空；保护 uid DB 计数与 localStorage 逐键前后一致。
- 边界（如实）：真实触屏未测（CDP 模拟）；kp3+src 叠加态未生产实测（代码三元 kp3 最前，走查覆盖）。
- 测试造数经验：POST /api/mistakes 的 question_type 须用前端分组名（如「历史人文」），带模块前缀会导致 kp3 行选中后列表异常（已入测试 SKILL）。
- 详见 docs/iter/round-3/r344-redo-tag3-filter.md。

### R343 错题重练遵循来源筛选：/api/mistakes/redo 补 src 参数 + redoAll 透传 + CTA 文案对齐（2026-08-29，PR #542，分支 devin/1788435349-r343-redo-source-filter）
- 取证：错题本来源筛选（srcFilter：模考/练习，含 ?src= URL 同步）就位，但 redoAll() 不透传——与 R342 同构的「所见≠所练」缺口。
- 收口：backend `/api/mistakes/redo` 新增可选 src（白名单 exam/practice，非法 400「无效的来源」，不传行为不变）；db.mistakes_redo_questions 补 source 参数（exam→`source='exam'`，practice→`source IS NULL OR source!='exam'`，与前端列表口径一致，可与 reason 叠加）；book.vue redoAll() srcFilter 时追加 `&src=`，重练卡文案优先级 kpFilter > rzFilter > srcFilter（组合态取最高优先级文案，参数全透传）。redoSet/practice 消费不改。
- 验证：ruff 0/pytest 212(+4，test_redo_source.py：exam/practice 含 NULL/非法 400+缺省不变/src+rz 叠加)/pyright 0/lint/vitest 428/build 全绿；生产 rev af374db、bundle index-Bw4tiS9x.js，部署脚本回归全过（首跑 Lighthouse / a11y 0.94/LCP 2707 为单样本波动，独立复跑 perf 0.97/a11y 1.0/LCP 1829 全过）。testing agent 实测（uid test-r343-src，真实 UI 造 3 模考错题+2 练习 NULL-source 错题）：模考态 `&src=exam` 集合仅 3 模考题、练习态 `&src=practice` 集合仅 2 NULL-source 题、无筛选回归无 src 全 5 题、非法 src=hack 400、叠加 rz+src 集合唯一交集且卡标题只显错因、?src=exam 硬刷恢复、375/1440 溢出 0、console 0 error、0 次 /api/explain。
- 测试数据清理：test-r343-src DELETED mistakes 5/answer_log 8/exam_attempts 1/growth_events 1，LEFTOVER 空；保护 uid DB 计数与 localStorage 逐键前后一致。
- 边界（如实）：真实触屏未测（CDP 模拟）；kpFilter+srcFilter 叠加态未生产实测（代码三元 kpFilter 优先未改）。
- 详见 docs/iter/round-3/r343-redo-source-filter.md。

### R345 错题本题型/三级考点筛选 URL 同步：?kp=/?kp3= 深链 + load 后语义校验 fail-closed（2026-08-29，PR #544，分支 devin/1788439371-r345-book-kp-url-sync）
- 取证：错题本 URL 同步（R276 tab/mod/src/sort、R340 rz）缺 kpFilter/kp3Filter 两维——筛到「语句填空」/「中国古代史」后硬刷/分享链接筛选态即丢，与 rz/src 行为不一致；R344 刚接通 kp3 重练透传使该缺口用户可感。
- 收口（纯前端零后端/零契约）：book-url.js buildBookUrl/parseBookOpts 补 kp/kp3（动态数据无静态白名单，URL 层只做形状校验：非空≤40 字符、encodeURIComponent、畸形编码/非字符串 fail-closed；fav tab 不输出）；book.vue onLoad 暂存 _pendingKp/_pendingKp3（不直接设 filter），load() 成功后 applyPendingKp() 语义校验——kp3 须命中某项 tag3_name（命中一并设 filterMod）、kp 须命中 groupKey，无命中丢弃并 syncBookUrl() 纠正 URL；kpFilter/kp3Filter watcher 补 syncBookUrl（顺带清掉历史遗留重复 kpFilter watcher key）。R345b（f400afb）补 _pendingKpFix：原始 opts 带 kp/kp3 但 parse 后均空（畸形编码）时也纠正 URL。
- 验证：lint/vitest 430(+2 组 kp/kp3 用例)/build 全绿；生产两轮 rev d4e6b4d→f400afb、bundle index-tdpTu_ly.js，部署脚本回归+Lighthouse 全过。testing agent 两轮实测（uid test-r345-kp/test-r345b-kp，4+2 错题含 CS-LS-01 vs CS-LS-02 同二级组对抗样本）：出向点行 URL 实时带 kp/kp3、chip 清除参数消失、硬刷恢复列表/chip/重练卡文案且对抗样本被排除、新 context 深链直达并自动补 mod、未知考点与畸形编码均 fail-closed 且 URL 被纠正（后者为 R345b 修复项，首轮实测发现 URL 残留）、?kp3=&rz= 叠加恢复、kp3 态重练仍带 t3=CS-LS-01（R344 回归）、fav 不输出、375/1440 溢出 0、console 0 error、0 次 /api/explain、0 条非 200。
- 测试数据清理：两轮合计 DELETED mistakes 6/growth_events 3，LEFTOVER 空；保护 uid DB 计数与 localStorage 逐键前后一致。
- 边界（如实）：真实触屏未测（CDP 模拟）；kp/kp3 语义合法性依赖当前 uid 错题数据，换设备无该题型数据时深链 fail-closed 回全量（预期，「所见即所筛」）；R340 ?rz= 单独硬刷本轮未单测（叠加用例等价覆盖）。
- 详见 docs/iter/round-3/r345-book-kp-url-sync.md。

### R346 错题本挂 q-social-bar：列表展开态+复习流补逐题笔记/讨论/热评（2026-08-29，PR #545，分支 devin/1788441490-r346-book-social-bar）
- 取证（SOP-10 功能深度维度）：q-social-bar（我的笔记/讨论计数/热评/分享给队友，R292 组件）只挂在刷题页解析区与模考报告解析浮层；错题本列表展开态与复习流 answered 态（题面/解析/历次作答俱全的两个核心复盘场景）均无逐题笔记/讨论出口，粉笔错题本支持错题逐题笔记。
- 收口（纯前端零后端/零契约）：book.vue 两处模板级挂载——列表展开态 rich-text 之后 `v-if="m.open && m.question_id"`；复习流「回看 AI 详解」行之后 `v-if="cur.question_id"`。fail-closed：手录错题（无 question_id）与加练同类题（_extra 无 question_id）不渲染；组件 watch questionId immediate 随切题重载不串题。R346b（d9b6b9b）修复首轮实测缺陷：列表挂载处包 `<view @click.stop>` 容器——点「写笔记」曾冒泡触发外层卡片 toggleCard 收起卡片、编辑器打不开。
- 验证：lint/vitest 430/build 全绿；生产两轮 rev 426a7c7（bundle index-V-U-cy2g.js）→ d9b6b9b（index-OIl6xaBS.js），部署脚本回归+Lighthouse 全过。testing agent 两轮实测（uid test-r346-sb/test-r346b-sb）：列表展开态 bar 渲染+笔记回显、手录/加练 fail-closed 无 bar、复习流写笔记 POST /api/notes 200+回显+切题不串（两 qid 独立笔记）、同源验证（重练刷题页同 qid 同笔记）、讨论入口跳转、修复后点「写笔记」编辑器打开卡片不收起且 .stop 不影响外部 toggle、R345 kp3 深链回归、375/1440 溢出 0、console 0 error、0 次 /api/explain。
- 测试数据清理：两轮合计 DELETED mistakes 4/question_notes 3/review_log 4/answer_log 1/growth_events 5/practice_progress 1，LEFTOVER 空；保护 uid DB 计数与 localStorage 逐键前后一致。
- 边界（如实）：保存 toast 视觉（900ms 未截到，以 API 200+回显为证）、真实触屏未测（CDP 模拟）。
- 观察项（既有，非本轮引入）：加练埋点 POST /api/track event=review_similar_auto ref:null → 400（疑似白名单缺 review_similar_auto 或 ref null 校验），候选后续轮收口。
- 详见 docs/iter/round-3/r346-book-social-bar.md。

### R347 /api/track 白名单缺口收口：补 4 个在发事件 + 前端发点契约同步测试（2026-08-29，PR #546，分支 devin/1788444032-r347-track-whitelist）
- 取证：R346 测试实景抓到 review_similar_auto 400；全量对账前端 trackEvent 字面量 vs team.py 白名单，共 4 事件在发被静默 400 丢弃：review_similar_auto / review_similar_click（复习流加练）、review_reason_tag（错因自评）、share_poster（成绩海报，R304 起）。
- 收口：team.py 白名单补 4 事件（其余行为零变化）；新增 backend/tests/test_track_whitelist_sync.py 静态契约测试——扫描 frontend-uni/src 全部 trackEvent('<event>' 字面量断言 ⊆ 白名单（R333 后第二次同构缝隙，此测试根治「前端新增发点漏同步白名单」再犯路径），另含 4 事件 200 入库用例。前端已不发的 reminder_optin 保留存量口径；历史丢失埋点不补发。
- 验证：ruff 0/pytest 218(+2)/pyright 0/lint/vitest 430/build 全绿；生产 rev 997e61b 复验：4 事件 curl 200、bogus 400；真实 UI（uid test-r347-ui，375px）复习流加练触发 review_similar_auto 200、错因打标 review_reason_tag 200，全程 0 非 200、0 console error、0 次 /api/explain。share_poster/review_similar_click 未 UI 实测（curl 已验）。
- 测试数据清理：test-r347 前缀全库 DELETED {mistakes 1/answer_log 1/review_log 1/growth_events 8/practice_progress 1}，LEFTOVER {}；保护 uid umteojq4sltdhorhm DB+localStorage 前后一致。
- 详见 docs/iter/round-3/r347-track-whitelist-gap.md。

### R348 加练同类题答错入错题本：_extra 条目保留 qid/题型 + 复用 /api/mistakes 收录（2026-08-29，PR #548，分支 devin/1788445318-r348-similar-extra-mistake）
- 取证：复习流答错自动加练的 `_extra` 条目丢弃 `x.id`/`x.question_type`，且 record() 首行 `if (this.cur._extra) return;`——加练题答错后完全丢弃，不入错题本、不进错因统计/重练/AI 关联（用户已暴露的新薄弱点练了白练；粉笔加练答错会沉淀）。
- 收口（纯前端零后端/零契约/零新埋点）：新增 review-similar.js fail-closed 纯函数——similarItemFromQuestion（/api/questions item → _extra 条目，保留 question_id/question_type，非正整数 id 归 null，无题干返回 null）+ mistakeRecFromExtra（仅 _extra===true 且有题干+正解才产出 /api/mistakes body）；book.vue appendSimilar 改用纯函数构造、record() _extra 答错时 saveExtraWrong（_saved 防重复、失败静默非关键路径）、答对不写；入库成功提示「已加入错题本，之后会安排复习」；_extra 保留 qid 后 askFromReview 自动获得 redoQid（AI 详解关联）。加练题仍不写 SRS、不 requeue（语义不变）。
- 部署基线事故（本轮重要教训）：首版部署 rev f33c79f 从旧基线（#537 链）切出，缺 R346/R346b/R347——生产 q-social-bar 静默消失、review_similar_auto/review_reason_tag 回退 400，仅靠 UI 回归测试发现。已 rebase 到 devin/1788444032-r347-track-whitelist 重新部署 rev 618b100，`git merge-base --is-ancestor` 逐项验证 426a7c7/d9b6b9b/997e61b 均为祖先后复验恢复。**每轮部署前必须核对部署 rev 祖先链包含近期已验修复。**
- 验证：lint/vitest 438(+8)/build 全绿（rebase 后 ruff/pytest 218/顺跑）；生产 rev 618b100、bundle index-CY7iKnTF.js，部署脚本回归+Lighthouse 全过。testing agent 两轮实测（uid test-r348-ui / test-r348c-ui，375px）：加练题答错 POST /api/mistakes 200（body 含 question_id/question_type/user_answer）+ 提示出现、答对反例 0 次 POST、完成复习后加练题出现在错题列表可展开、原题 review 200 requeue 不变；基线修复后 q-social-bar 恢复渲染、review_similar_auto/review_reason_tag 200；console 0 error、0 次 /api/explain。
- 测试数据清理：两轮合计 DELETED {mistakes 3/answer_log 2/review_log 3/growth_events 7/practice_progress 2}，LEFTOVER {}；保护 uid umteojq4sltdhorhm DB+localStorage 前后一致。
- 边界（如实）：真实触屏未测（CDP 模拟）；SW 缓存使老客户端需一次刷新周期才拿到新 bundle（旧 bundle 期间断言会误判回退，经验已入测试 SKILL）。
- 详见 docs/iter/round-3/r348-similar-extra-mistake-capture.md。

### R349 加练同类题答错入库后支持错因自评：reviewReasonMid 纯函数 + _mid 记录 + chips 放开（2026-08-29，PR #550，分支 devin/1788447810-r349-extra-reason）
- 取证：R348 saveExtraWrong 未保留 POST /api/mistakes 返回 id，错因 chips 条件 `!cur._extra` 一刀切排除——加练新沉淀错题恒「未标注」，稀释 R340 筛选/R341 画像/R342 按错因重练闭环。
- 收口（纯前端，零后端/零契约/零新埋点）：review-similar.js 新增 fail-closed 纯函数 reviewReasonMid（普通条目→cur.id、_extra→入库后 _mid，非正整数一律 null）；saveExtraWrong 记录 res.id 为 item._mid；chips 条件放开为 `!wasCorrect && reviewReasonMid(cur)`（模板方法调用而非 computed，规避 _mid 直赋值+$forceUpdate 下 computed 缓存不失效）；setReviewReason PATCH 目标经 reviewReasonMid 解析（null no-op），复用既有 review_reason_tag 事件。
- 验证：lint/vitest 442/build 全绿；生产 rev d093816、bundle index-CaEuIhi8.js；testing agent 双视口实测：加练答错 POST 200 后 chips 出现、点 chip PATCH /api/mistakes/<新 mid> 200（≠复习原条目 id）+ review_reason_tag 200、?rz= 筛选命中回显、答对反例无 POST 无 chips、普通条目打标回归、R348/R346 回归；0 次 /api/explain、console 0 error。测试 uid test-r349-ui 全库清理 LEFTOVER {}；保护 uid DB+localStorage 前后一致。
- 已知残余（低优）：saveExtraWrong 先置 _saved 再记 _mid，未对 res.id 做正整数校验——畸形响应下条目会被视为已存但 chips fail-closed 不出现（行为安全，语义待收口）。
- 详见 docs/iter/round-3/r349-extra-mistake-reason-tag.md。

### R350 加练同类题「AI 详解本题」带上本轮作答：reviewAskAnswer 纯函数（2026-08-29，PR #551，分支 devin/1788449466-r350-extra-ask-answer）
- 取证：askFromReview 取作答只读 cur.user_answer——_extra 加练条目无该字段，用户刚在本轮作答（picked）却被丢弃、redoAnswer 被清，AI 讲解拿不到「我选了什么」（R335 练习历史同场景已有透传 picked 先例）。
- 收口（纯前端，零后端/零契约/零新埋点）：review-similar.js 新增 reviewAskAnswer(cur, picked)——_extra 取 picked、普通条目取 user_answer，经 askAnswerLetter 单选语义 fail-closed；askFromReview 一行替换。普通条目行为零变化。
- 验证：lint/vitest 446/build + ruff/pytest 218/pyright 0 全绿；生产 rev af80192、bundle index-DKVlbzEI.js；testing agent 实测：加练答错选 B→ask 页预填+作答 chip B（旧版必无 chip）、加练答对选 A→chip A、普通条目历史 A 不串本轮 B、R349 回归；0 次 /api/explain、抓包 71 条全 200。测试 uid test-r350-ui 全库清理 LEFTOVER {}；保护 uid 前后一致（EXACT MATCH n=28）。
- 体验观察（候选迭代）：从复习流点 AI 详解跳走后返回错题本，复习会话不保留、加练题作废——「复习中场跳出再回来续复习」未收口。
- 详见 docs/iter/round-3/r350-extra-ask-answer.md。

### R351 错题本复习会话中断可恢复：本机快照 + 「继续复习」横幅（2026-08-29，PR #553，分支 devin/1788451482-r351-review-resume）
- 取证（SOP-10 功能深度维度）：复习会话（rItems/rIdx/picked/answered/wasCorrect/nextDays）纯组件内存态，整页刷新必丢；R350 生产实测观察从复习流跳 AI 详解再返回丢会话（本轮复测 tab 切回实际保留，硬刷才是稳定丢失路径，横幅正为此兜底）。
- 收口（纯前端零后端/零契约，埋点白名单 +1 review_resume_click）：新增 review-snap.js fail-closed 纯函数 buildReviewSnap/parseReviewSnap（v1、uid 绑定、TTL 2h、≤80 条、序列化 ≤200KB、剥离 open/html 渲染态、rIdx 越界/畸形/未来 ts 一律 null）；book.vue startReview/判分/换题/加练追加/入库/错因打标各写点 saveReviewSnap，exitReview 清快照，onShow 非复习态解析快照出橙色 resumecard（继续复习/放弃）；resumeReview 整体恢复内存态原位续答，不自动强拉。顺手收口 R349 残余：saveExtraWrong 经 reviewReasonMid 正整数校验 res.id 后才置 _mid/_saved。
- 验证：lint/vitest 452(+10)/build + ruff/pytest 218/pyright 0 全绿；生产 rev b1338d9、bundle index-DGAyeTEz.js（浏览器实载核对），部署脚本回归+Lighthouse 全过、review_resume_click curl 200/bogus 400。testing agent 实测（375px+桌面）：答错触发加练 1/5→硬刷→横幅 1/5→继续复习原位恢复（answered/错选/加练队尾原样）+埋点 200→续答完成；放弃清快照重开新轮；完成复习无横幅；fail-closed 注入（坏 JSON/uid 不符/超 2h/rIdx 越界，含合法阳性对照）全部无横幅 0 console error；R349/R350 回归；0 次 /api/explain、105 条 /api 全 200、双视口溢出 0。
- 测试数据清理：测试 uid（因 storage 键笔误实为页面自生成 umtlq40aq7y4zsrmz，anon_uid≠anonUid 教训再次验证）全库 DELETED {mistakes 4/answer_log 2/review_log 5/growth_events 13}，LEFTOVER {}；保护 uid DB+localStorage 前后一致（EXACT MATCH n=28）。
- 边界（如实）：真实触屏未测（CDP 模拟）；跨设备复习会话同步不在本轮范围（本机快照 first iteration）。
- 详见 docs/iter/round-3/r351-review-session-resume.md。

### R352 错题本复习会话跨设备同步：review_cur 单快照 + /api/review/cur（2026-08-29，PR #554，分支 devin/1788453580-r352-review-cur-sync）
- 取证：R351 reviewSnap 只存本机 storage——换设备/清缓存后中断复习会话（含 _extra 加练队列、已答态）无法恢复，而 practice_progress/exam_progress/ask_cur 均已服务端化，资产语义不一致。
- 收口（复用 ask_cur uid 单快照模式，零 UI 改动、review-snap.js 契约不变）：后端新表 review_cur(uid PK, snap, updated_at) + save/clear/get_review_cur；POST /api/review/cur（snap:null 清除；_valid_review_snap fail-closed：v===1、snap.uid===uid、ts 正整数、items 1–80 且逐项 question_text 非空、rIdx 界内、序列化 ≤200KB、bool 不冒充 int；rl "rcur" 120/h）；GET ?uid= TTL 2h 过期/无记录返回 {}；路由注册在 /api/review/{mid} 之前（有测试锁定防 "cur" 被 int 路径吞）。前端 book.vue：saveReviewSnap 本机写入后去抖 1.5s POST（失败静默）；clearReviewSnap 清本机+取消 pending timer+POST snap:null；onShow 本机快照命中零远端 GET，未命中才 restoreRemoteSnap()（GET 后 reviewing/resumeInfo/本机快照三重竞态复查，远端快照再过 parseReviewSnap 二层 fail-closed）。uid 单快照 last-write-wins，不做多设备并发合并。
- 验证：ruff/pytest 223(+5 test_review_cur.py：round-trip/清除/uid 隔离/2h TTL/15 类非法 400/超大 400/路由次序)/pyright 0 + lint/vitest 452/build 全绿；生产 rev 66580ac、bundle index-B5ESHVc1.js（部署脚本+浏览器实载核对），生产 curl 逐项实测（空 GET {} / 保存 / round-trip / 坏版本·uid 不符·rIdx 越界·缺 uid 全 400 / snap:null 清除 / {mid} 路由不受影响）。testing agent 三 context 双设备实测：A 1440 答错中断→去抖 POST 200；B 375 全新 context 同 anonUid 无本机快照→自动 GET→横幅 1/5→继续复习原位恢复（answered/错选 B/加练队尾原序 4/5 带 tag）+ review_resume_click 200；A 硬刷本机优先 0 远端 GET；B 放弃→snap:null→C 全新 context 无横幅、DB review_cur 0 行；R351/R346/?rz= 回归；0 次 /api/explain、78 条全 200、console 0 error、双视口溢出 0。
- 测试数据清理：test-r352-api（curl，snap:null 自清）+ test-r352-ui 全库 DELETED {mistakes 2/answer_log 2/review_log 3/growth_events 7/practice_progress 1}，LEFTOVER {}，review_cur 全表 0 行；保护 uid DB 34 表+localStorage 前后一致（EXACT MATCH n=28）。
- 边界（如实）：真实触屏未测（CDP 模拟）；限速 429 分支以 pytest 覆盖未生产实测；多设备并发写为 last-write-wins 语义（刻意不合并）。
- 详见 docs/iter/round-3/r352-review-cur-sync.md。

### R353 首页「未完成错题复习」续复习卡（2026-08-29，PR #556，分支 devin/1788455376-r353-home-review-resume）
- 取证：首页已有模考续考卡（R288）/练习续练卡（R323），但 R351/R352 的复习中断进度只在错题本页内可见——回流首页零外显，2h TTL 召回窗口浪费，三类「未完成学习资产」IA 口径不一致。
- 收口（纯前端 + track 白名单 1 行，零新 endpoint/表/协议）：home.vue loadReviewResume()（本机 reviewSnap parseReviewSnap 优先命中 0 远端 GET；无本机才 GET /api/review/cur 再过一层 parseReviewSnap；rvClearedAt 30s 防放弃后回填，同 ppClearedAt 口径）+ ercard「有一次未完成的错题复习 · 中断在第 X/N 题」+ rvContinue()（home_review_resume_click 埋点 → 一次性 bookReviewIntent → switchTab book）+ rvDrop()（showModal 确认 → 清本机 + POST snap:null）。book.vue onShow 消费即删 bookReviewIntent：本机快照命中直接 resumeReview() 原位恢复（跳过横幅二次点击）；未命中 _reviewIntent 传入 restoreRemoteSnap()，远端回填成功后自动恢复，失败 fail-closed 落正常错题本页。team.py 白名单 + home_review_resume_click。
- 验证：lint/vitest 452/build + ruff/pytest 223/pyright 0 全绿；生产 rev 999102d、bundle index-Ddepn9Ev.js（浏览器实载核对）、Lighthouse 全过、埋点 curl 200/bogus 400。testing agent 双设备实测（uid test-r353-ui）：A 1440 中断→首页出卡 1/5 且本机命中 0 远端 GET→去继续直达原位恢复（跳横幅，埋点 200）；B 375 全新 context 远端 GET 出卡→去继续远端回填自动恢复；放弃 ✕→弹窗→snap:null 200→C 全新 context 首页无卡错题本无横幅、review_cur 0 行；回归：直接进错题本 R351 横幅+手动继续不变、首页三卡并存（R288/R323/R353）互不挤占；0 次 /api/explain、145 条全 200、console 0 error、双视口溢出 0。
- 测试数据清理：test-r353-ui 全库 DELETED {mistakes 2/answer_log 5/exam_attempts 1/review_log 1/growth_events 14/exam_progress 1/practice_progress 1}，LEFTOVER {}，review_cur 0 行；保护 uid DB 34 表+localStorage 前后一致（EXACT MATCH n=28）。
- 边界（如实）：真实触屏未测（CDP 模拟）；C context 无独立 metrics holder 以桌面宽验证「无卡/无横幅」（断言与视口无关）。
- 详见 docs/iter/round-3/r353-home-review-resume-card.md。

### W1（R348 交叉复核集成轮，分支 devin/wf-w1-integration，未建 PR/未部署）
- 集成：origin/main 2cae38f 切 `devin/wf-w1-integration`，依次 merge R348-B1（cce7cf4）/ C1（664a21f）/ M1（858622d），三次无冲突；dropped 无。全量本地验证：backend ruff / pytest 232 passed / pyright 0；frontend-uni lint / vitest 424 passed / build:h5（产物与生产 R338 同 hash，本轮 H5 零改动）；miniapp typecheck 0 错、lint 需 `ESLINT_USE_FLAT_CONFIG=false`（根 eslint.config.mjs 误切 flat config，既有问题）。
- B1：guard_account_uid 改「写方法 && 非 multipart/urlencoded 即 json.loads」，scan_sheet 入口 owns_uid，deps.as_int 统一畸形数字 400，badges 连签补 review_log 日。本地 uvicorn 实测五种 Content-Type + multipart uid=u999999 无 token 均 403 且不落库、匿名 200、n=abc 400、badges==summary streak。
- C1：quality.py 三类扣分 + sanitize_hs，db.import_hs_explanations 源头过滤，scripts/r348_content_cleanup.py 默认 dry-run / `--apply` 写前 backup。临时库 dry-run→apply→复扫 0 一致；生产只读 dry-run 量级 17/2438/3728。**生产 --apply 未执行**：需部署本分支后由负责人确认备份路径；且 `数据矛盾` 词单独触发 12/17、≥6 条疑误杀，apply 前先决策词表。
- M1：poster `.bar`→`.actions`、request.ts 403「重新登录」清登录态回退匿名、practice 题图渲染/预览、share 模块名中文。真机/开发者工具走查未做。
- 遗留台账：docs/iter/workflow/backlog.md（含 H5 三处一行修、yanyu 抽审、17 条复核、quality_score 闸门、60 秒等待取证、guard 三路径入 SKILL 等）；详证 docs/iter/workflow/w1.md。

### R354 复习完成小结：庆祝卡升级首答正确率/纠正/加练成绩（2026-08-29，PR #557，分支 devin/1788457084-r354-review-summary）
- 取证：复习轮末庆祝卡只报「N 道到期错题全部复习完成」，本轮首答对错/答错纠正/加练成绩全部丢弃——用户跑完复习拿不到任何效果反馈（粉笔有轮末小结）。
- 收口（纯前端零后端/零契约/零新埋点）：record() 给 cur 写 `_res`（首答判分留痕，requeue 副本剥离 `_res` 独立判分）；review-summary.js 纯函数 reviewSummary(rItems)（due/dueRight/dueWrong/corrected/uncorrected/extra/extraRight/pct，fail-closed：非数组/空→null、无 `_res` 条目不入分子分母）；庆祝卡三行模板（到期+首答对 pct / 答错重出+纠正 / 加练+答对），legacy 快照无 `_res` 退化为原单行。`_res` 随 reviewSnap/review_cur 快照持久化，中断恢复后判分不丢。
- 验证：lint/vitest 457/build + ruff/pytest 251/pyright 0；生产实测 T1 混合小结三行逐字精确（3 到期 2 对 1 错→纠正 1+加练 2 一对一错，67%）、T2 全对单行 100%、T3 硬刷横幅恢复后判分计入小结（抓包 POST /api/review/cur items 带 `"_res":true`）、T4 R353 首页卡直达恢复回归；375/1440 无溢出、0 次 /api/explain、console 0 error。测试 uid 全库清理 LEFTOVER 空、review_cur 0 行、保护 uid 前后一致。
- 详见 docs/iter/round-3/r354-review-summary.md。

### R355 生产事故修复：#558 旧基线合并覆盖回退 R339–R354（2026-08-29，PR #560，分支 devin/1788458679-r355-restore-w1-clobber）
- 事故：W1 集成分支（devin/wf-w1-integration，基线 ~R338 的 2cae38f）经 PR #558 直接合入 main 并部署（rev a4fa410），把 R339–R354 十六轮功能整体覆盖回退——生产 `GET /api/review/cur` 404、POST 422（被 `/api/review/{mid}` int 路径吞）、redo 丢 rz/src/t3、复习恢复/首页续卡/加练闭环/轮末小结全部消失（R354 生产测试中途实测发现）。
- 修复：从 02a0adb（#557 合并点）重新 merge W1 头 85ae35a——自动合并干净，唯一冲突 handoff 手工保留双方；W1 的 B1/C1/M1 改动全部保留。diff vs a4fa410 +2001/-38 恢复 41 文件。本地 pytest 251/vitest 457 双方测试并存全绿。部署 rev 4bf10bb 后生产逐项复验 + T3/T4 补测通过。
- 教训（第二次同类事故，R348 是分支级、本次是 merge-to-main 级）：任何集成分支合并部署前必须 `git merge-base --is-ancestor <近期各轮 merge 点> <待部署 rev>` 逐项核对；长流程生产测试遇成批 4xx 先复查 /api/health rev 与实载 bundle（可能被并发部署覆盖）。

### R356 W1 遗留 H5 三处收口：日键口径统一/背题模式留白/首页文案口径（2026-08-29，PR #561，分支 devin/1788459968-r356-w1-h5-followups）
- 取证：W1 backlog 挂账三处一行级缺陷，本轮逐项重新取证——a) pstats.days 写用 checkin.js dayKey()（本地日）、三处读用 toISOString().slice(0,10)（UTC 日），UTC+8 00:00–08:00 统计「今天」恒 0、提醒进度错位一天；b) practice.vue 横幅 v-if 含 beiMode 但 has-banner 留白只看 picked，背题模式底部被固定条遮挡；c) 首页「11万+ 行测真题/真题题库」不实——生产实测在线 109371 题、is_real=1 仅 15864。
- 收口：stats.vue/reminder.js/reminders.vue 统一 import dayKey（新增 tests/day-key.test.js 锁定本地日语义）；practice.vue `'has-banner': picked || beiMode`；home.vue 改「免费刷 10万+ 行测题」「10万+ 行测题库」「1.5万+ 历年真题 · 三级考点分类」。
- 验证：lint/vitest 460(+3)/build 全绿（后端零改动）；部署前 merge-base --is-ancestor 4bf10bb 核对通过；生产 rev 7a9bb2f、bundle index-Bm2wz5mH.js（浏览器实载核对）、Lighthouse 全过。testing agent 实测（uid test-r356-ui）：A 用 CDP setTimezoneOverride Asia/Shanghai 制造本地 9/4 / UTC 9/3 跨日差，注入 pstats.days[本地键]=7 → 统计页「今天」列 71%(5/7)、提醒页 7/20 均命中本地键；B 375 背题不作答 has-banner padding-bottom 200px、解析底部不遮挡（末元素 bottom 440 < 横幅 top 544），picked 态回归；C 双视口文案逐字精确无溢出；0 次 /api/explain、67 条全 200、console 0 error。
- 测试数据清理：test-r356-ui 全库 DELETED {answer_log 1/growth_events 3}，LEFTOVER {}，review_cur 0 行；保护 uid DB diff 逐表一致 + localStorage EXACT MATCH n=28。
- 经验：uni.getStorageSync 注入必须用 `{"type":...,"data":...}` 包装格式（裸 JSON 静默读不出）；UTC→本地日键类修复需 CDP 时区覆写制造跨日差做鉴别试验（override 随 socket 关闭即丢，需常驻 holder）。
- 详见 docs/iter/round-3/r356-w1-h5-followups.md。

### R357 真题卷入口合并到卷库操作台 + R357b 不计时修复（2026-08-29，PR #562，分支 devin/1788462075-r357-paper-console-merge）
- 取证：首页有两个纸卷入口——结构化卷库（190 卷、模考/报告/社会证明/进度/PDF/续考）与旧版 source 派生卷 sheet（141 卷、仅标题+题数+不计时练），用户视角重复且旧 sheet 明显弱。
- 收口：a) 后端 /api/exam/papers 每卷新增可选 psource——从卷内活跃（disabled=0）真实（is_real 且有 source）题目推导主 source，主来源 <20 题 fail-closed 返回 null（_dominant_paper_source 纯函数 + 4 个契约测试）；b) 卷库卷卡命中 psource 显示「按卷练习」，写 practiceLaunch {kind:'paper', source, title, untimed:true}；c) 首页「真题卷练习」卡改跳 /pkgA/exam/list，旧卷 sheet 及全部孤儿代码下线；d) /api/papers、/api/paper_questions 保留（practice 页仍消费）。
- R357b：首版 startPaper() 无条件 examMode=true+120min 倒计时，「按卷练习」实际进模考态（testing agent 生产实测抓到）——补 untimed 参数分支：untimed 时 examMode=false、无倒计时、逐题即时判分，toast「不计时逐题练」；旧 sheet 路径行为不变。
- 验证：ruff/pytest 255(+4)/pyright 0/lint/vitest 460/build 全绿；生产 rev ee8834a、bundle index-Dc-_YXhO.js、Lighthouse 全过；生产 /api/exam/papers zhenti 120 卷中 117 有 psource、id 40（48 活跃题但无主 source）等 fail-closed 为 null。testing agent 两轮实测：首页跳转/psource 入口显隐/按卷练习不计时即时判分/开始模考回归/375+1440/console 0 error/0 次 /api/explain。
- 测试数据清理：test-r357-ui 两轮 DELETED {mistakes 1/answer_log 3/exam_attempts 3/growth_events 1/exam_progress 2}，LEFTOVER {}，review_cur 0 行；保护 uid DB 34 表+localStorage EXACT MATCH n=28。
- 遗留观察（候选下轮）：卷库「未交卷」条「放弃」只清本地，服务端 exam_progress 行不删，刷新/跨设备会回填复活（本轮实测 attempt 217 再现）。
- 详见 docs/iter/round-3/r357-paper-console-merge.md。

### W2（可信度收口集成轮，分支 devin/wf-w2-integration，未建 PR/未部署）
- 集成：origin/main 0c71fdd（含 R356 8cf2628）切 `devin/wf-w2-integration`，依次 merge W2-A（3d36bcb）/ W2-B（d3ebaf0）/ W2-C（e3e871f），三次无冲突；dropped 无；HEAD 上 merge-base --is-ancestor 8cf2628 / 7a9bb2f / 4bf10bb / 02a0adb 均为真（R355 教训）。全量本地验证：backend ruff / pytest 266 passed / pyright 0；frontend-uni lint / vitest 469 / build:h5（bundle index-tRw-HLw2.js）；miniapp typecheck 0 / lint（`ESLINT_USE_FLAT_CONFIG=false`）0 / offline 单测 7。
- W2-A（backend）：main.py ValueError/TypeError → `/api/*` 统一 400「参数格式错误」；api_save_mistake question_id as_int；`idx_mist_uid(uid, created_at)`；SEO 页脚「10万+ 行测题 · 1.5万+ 历年真题」；quality.normalize_cjk_spaces / HS_META_RE + scripts/w2_content_cleanup.py（dry-run 默认、--apply 备份 .bak-w2、rescore、不下线不改 explanation 不触发 LLM）。本地 uvicorn 实测 export/pdf ['abc'] 400、mistakes 'abc' 400 / '7149' 落 INTEGER / '' 落 NULL、EXPLAIN 命中 idx_mist_uid、/tiku/ 新页脚；临时库 dry-run 1836 → apply → 复扫 0，构造题元句剥离 / SKIP 跳过。生产广场 3 条测试评论已由 W2-A 实施方管理端软删（/api/comments/plaza items:[]）。**生产 export/pdf 仍 500、/tiku/ 仍 13万+、清洗脚本生产 dry-run/apply 未做——待部署。**
- W2-B（H5）：index.html×4 / manifest / og-card / share-q / pk-result 口径清零；weak-spots.js 薄弱考点按 tag3 聚合后同名合并；exp-dup.js 隐藏被 hs 全文包含的 explanation；contest 零人数「本场首批报名开放中 · 全站同卷」。本地 build 产物 Chrome 375 走查：share-q 不存在 id 新文案、contest 零人数/报名后 1 人两分支、practice 20 题解析显隐与预期一致、完成页薄弱考点无重名。生产 view-source/SW 待部署核对。
- W2-C（小程序）：hero/stats 连签服务端优先；utils/offline.ts answer_log/mistakes 离线队列（去重/持久化/单飞/联网触发）；exam 错误态+重试；app.wxss page 高度约束；首页题数 /api/question_counts 动态化（静态回退改当前口径）；README Skyline→webview。**微信开发者工具走查未做**（断网→恢复落库、连签一致、14 页滚到底 + login、page 高度对 navbar/底栏影响）。
- 数据纪律：全部在本机临时库完成，未触碰生产库/配置、未触发 LLM、生产未新增 test-w2-* 数据。
- 遗留台账：docs/iter/workflow/backlog.md（W2 追加：SMS 凭证资源缺口、original 题 hs 人审、题干模板家族去重设计、mock_event 唯一约束、mock 冗余卷计数、db.py 按域拆分、tag3_name 后端统一、小程序统一「数据非最新」提示、contest 历史累计人数、部署后回归清单）；详证 docs/iter/workflow/w2.md。

### R358 模考「放弃未交卷」同步删除服务端进度（2026-08-29，PR #563，分支 devin/1788465149-r358-exam-drop-server-clear）
- 取证：R357 遗留观察实证——放弃只删本地 examProgress，服务端 exam_progress 仅在交卷时 clear_exam_progress()，放弃后刷新/跨设备 /api/exam/resume 回填复活；练习（R323）/复习（R353）均已有服务端清除语义，模考是唯一缺口。
- 收口（零新 endpoint/表/协议）：a) POST /api/exam/progress body drop:true 时，在 uid/attempt 归属校验后、已交卷/超时校验前直接 clear_exam_progress 返回 {ok:true}——已交卷 drop 幂等 200、已超时进度也能放弃；b) parseExamProgress 补 attemptId（非法回落 0，drop 时 fail-closed 不发请求）；c) 卷库 dropResume/首页 erDrop 确认后写 erClearedAt + POST drop（失败静默本地照删，最终一致性同练习/复习）+ 删本地快照；d) syncResume/syncExamResume 远端回填前 erClearedAt 30s 守卫。
- 验证：ruff/pytest 256(+1)/pyright 0/lint/vitest 461(+1)/build 全绿；部署前 merge-base --is-ancestor ee8834a 核对通过；生产 rev 0c1d732、bundle index-bQpred1S.js、Lighthouse 全过。testing agent 实测（uid test-r358-ui）：放弃→抓包 drop:true 200→生产 DB exam_progress 行真删；不回填强证据（立即硬刷 + 35s 越过 30s 守卫再硬刷 + 全新 context 同 uid 均无）；继续模考原位恢复回归（picks/idx/倒计时接续）；首页 erDrop 同过；45 条全 200、console 0 error、0 次 /api/explain、375/1440 无溢出。
- 测试数据清理：test-r358-ui DELETED {exam_attempts 2/growth_events 1}，LEFTOVER {}，review_cur 0 行；保护 uid DB 34 表+localStorage EXACT MATCH n=28。
- 详见 docs/iter/round-3/r358-exam-drop-server-clear.md。

### R359 卷库卷卡外显按卷练习进度（2026-08-29，PR #565，分支 devin/1788467179-r359-paper-practiced）
- 取证：R357「按卷练习」上线后练习维度零外显——卷卡只有模考态（best_score/attempt_count/已刷 X/N 卷），按卷练习做到一半回卷库无任何痕迹；数据已就位（answer_log 逐题落库、_list_exam_papers_base 已逐卷算活跃题集）。
- 收口（零新 endpoint/表）：a) base 缓存每卷保留 _qids（活跃题 id，现有循环算出零新增查询）；b) list_exam_papers(uid) 一次 SELECT DISTINCT question_id FROM answer_log WHERE uid=? 后逐卷交集得 practiced，输出剥 _qids；无 uid practiced=0 fail-closed；c) 卷卡 v-if="p.psource && p.practiced" 绿色（--ok-strong）「已练 X/N 题」。口径如实：answer_log 覆盖所有练习场景，不限按卷练习入口。
- 验证：ruff/pytest 260(+4)/pyright 0/lint/vitest 461/build 全绿；生产 rev 18c4f02、bundle index-Deng7wBk.js、Lighthouse 全过。testing agent 实测（uid test-r359-ui）：零态 120 卷全含 practiced=0 无行；答 3 题→「已练 3/75 题」精确且全页唯一；重答同 qid 去重不变（DB DISTINCT=3）；无 psource 卷经模考构造 practiced=1 仍不显示（fail-closed 强证）；模考/看报告/R358 放弃回归；84 条全 200、console 0 error、0 次 /api/explain、375/1440 无溢出。
- 测试数据清理：test-r359-ui DELETED 10（mistakes 3/answer_log 5/exam_attempts 2），LEFTOVER 0，review_cur 0 行；保护 uid DB 34 表+localStorage EXACT MATCH n=28。
- 详见 docs/iter/round-3/r359-paper-practice-progress.md。

### R360 按卷练习「只练剩余」续练（2026-08-29，PR #566，分支 devin/1788468871-r360-paper-continue）
- 取证：R359 卷卡外显「已练 X/N 题」后进度不可行动——startPaper() 无条件 idx=0 全量从头，请求不带 uid；竞品（粉笔）「已做 X/N」点击默认续做未做题。
- 收口（零新 endpoint/表）：a) db.paper_questions(source, limit, uid=None)：uid 命中时 SELECT DISTINCT question_id FROM answer_log 得已练集，逐题补 done:bool；无 uid 契约零变化（无 done 字段）；b) /api/paper_questions 补可选 uid（strip+截断 64）；c) 前端仅 untimed 分支带 &uid=，paperContinuePlan 纯函数（done===true 才计已练，fail-closed，顺序保持），0<doneN<N 时 showModal「只练剩余/从头练」，零练过或全练完不弹窗全量；模考 timed 路径零变化。边缘缓存安全：端点不在 allowlist 且带 uid bypass。
- 基线注意：R359（#565）合并落在已合并的 R358 分支上、未随入 main——R360 分支基于该链 merge main，PR 一并带入 R359。
- 验证：ruff/pytest 264(+4)/pyright 0/lint/vitest 466(+5)/build 全绿；生产 rev 3dc7b38、bundle index-Dwa_7_qs.js、Lighthouse 全过。testing agent 实测（uid test-r360-ui）：零态无弹窗全 done:false；答 3 题→弹窗文案精确「已练过 3 题，只练剩下的 72 题？」；只练剩余 1/72 从原第 4 题起（done 集合==已答集）；从头练回 1/75 原第 1 题；模考走 /api/exam/start 零 paper_questions 请求、R358 drop 回归；console 0 error、0 次 /api/explain、375/1440 无溢出。
- 环境观察：测试期间共宿 recruit postgres 负载尖峰（load 15-21）致 8 条瞬时 503 + 20s 超时，answer_log 靠前端重试队列自愈；建议对共宿应用 cgroup 限资源。
- 测试数据清理：test-r360-ui DELETED 8（answer_log 3/mistakes 2/exam_attempts 1/growth_events 2），LEFTOVER 0，PROTECTED_MATCH True，review_cur 0 行；保护 uid DB 37 表行数一致+localStorage EXACT n=30。
- 详见 docs/iter/round-3/r360-paper-practice-continue.md。

### R361 按卷练习「已练完」完成态闭环（2026-08-29，PR #567，分支 devin/1788472379-r361）
- 取证（SOP-10 四维窗口）：R359/R360 后仍有三缺口——卷卡全练完仍显普通「已练 X/N 题」无完成态；全练完再点按卷练习无确认直接从头；startPaper() 不设 _source，按卷练习 answer_log.source 继承上一会话残值（如 reinforce）。
- 收口（纯前端零契约）：a) paper-continue.js 补 paperPracticedState(practiced, n) fail-closed 纯函数（非整数/≤0 不显示；p>=n → done 完成态「已练完全部 N 题 ✓」）；b) list.vue 卷卡消费该函数 + .ppracticed.done 品牌色加粗；c) practice.vue startPaper() untimed 全练完时弹「重新练一遍？」，取消不进会话；部分/零完成与 timed 路径零变化；d) this._source = untimed ? p.source : null——按卷练习落库归卷、timed 清残值。
- 验证：ruff/pytest 264/pyright 0/lint/vitest 470(+4)/build 全绿；祖先链核对（3dc7b38/1550a65/5f41fc2）通过；生产 rev 0f4bfc5、bundle index-BHaFSRfo.js、Lighthouse 全过。testing agent 实测（uid test-r361-ui）：零态无进度行无弹窗；部分完成绿色非加粗+R360 弹窗回归；DB 构造全练完→完成态样式（品牌色 fw600）+重练弹窗（取消停留不进会话/确认 1/75 从头）；source 归因序列 卷source→reinforce→卷source 无泄漏；模考无弹窗倒计时正常+R358 drop 回归；97 条全 200、console 0 error、0 次 /api/explain、375/1440 无溢出。
- 观察项（既有非本轮）：部分卷卡 n（question_ids∩活跃题，如 2015 新疆卷 38）≠ paper_questions?src= 会话题数（同 source 120 题）——完成态分母与全练完弹窗 N 可能对不上，候选后续轮对齐。
- 测试数据清理：test-r361-ui DELETED {mistakes:2, answer_log:76(含72构造行), exam_attempts:1, reinforce_log:1, growth_events:1}，LEFTOVER 空，review_cur 0 行；保护 uid DB 37 表+localStorage EXACT n=30。
- 详见 docs/iter/round-3/r361-paper-complete-state.md。

### R362 按卷练习会话题集对齐卷面（2026-08-29，PR #568，分支 devin/1788474838-r362-paper-align）
- 取证：R361 观察项实证为结构性口径分裂——卷卡 n/practiced（R359）= exam_papers.question_ids∩活跃题（2015 新疆卷 38），而按卷练习会话 = paper_questions(source) 同 source 全集（LIMIT 140，实测 120）；进度分母、R360 续练弹窗、R361 全练完弹窗三方对不上。
- 收口：a) db.paper_questions 补可选 pid——命中有效卷且 question_ids 非空时题集 = question_ids∩disabled=0，保持卷面顺序（IN 分块 900，与模考同口径，不加 is_real 过滤）；未命中/非法回落原 source 路径 fail-open；uid done 语义不变；b) /api/paper_questions 契约补可选 pid（仅正整数透传）；c) 前端 paper-continue.js 补 paperQuery(p, untimed, uid) fail-closed 纯函数（pid 仅正整数带、uid 仅 untimed 带），list.vue practiceLaunch 补 pid: p.id，practice.vue 透传消费；R360/R361 弹窗逻辑零改动，分母对齐后语义自动一致。
- 验证：ruff/pytest 269(+5)/pyright 0（by_id/rows 需显式 sqlite3.Row 注解否则 7 errors）/lint/vitest 474(+4)/build 全绿；祖先链核对通过；生产 rev 644d31b、bundle index-BBfYVVxQ.js、Lighthouse 全过（/ perf 0.98、/tiku/ 1.00）。curl 实证：pid=133→38 题、无/0/非法 pid→120 题回落。testing agent 实测（uid test-r362-ui）：抓包带 pid=133→会话 1/38 答题卡 38 格（旧 1/120）；答 2 题→卷卡 2/38、R360 弹窗「只练剩下的 36 题」→1/36 从原第 3 题；DB 构造全练完（必须用 pid 响应 38 qids 非 src 全集）→卡 38✓=弹窗 38=重练 1/38 三方一致；2025 四川 75/75 回归、模考 exam/start 零 paper_questions 请求；console 0 error、0 次 /api/explain、375/1440 无溢出。
- 测试数据清理：test-r362-ui DELETED {mistakes:1, answer_log:38, exam_attempts:1, growth_events:1}，LEFTOVER 空，review_cur 0 行；保护 uid DB+localStorage EXACT n=30。
- 详见 docs/iter/round-3/r362-paper-session-alignment.md。

### R363 按卷练习中断续练保留归卷 source 与卷名（2026-08-29，PR #570，分支 devin/1788476955-r363-paper-resume-source）
- 取证（SOP-10 窗口内）：R361 startPaper() 设 _source 后，中断续练两条恢复路径均不还原——本机 pendingSession 与服务端 practice_progress 都不含 source/卷名，adoptLocalPending/adoptRemoteSnap 恢复后 _source undefined，续答 answer_log.source 变 NULL（卷卡进度断档）；首页续练卡/「继续上次练习？」弹窗只能显示通用文案。
- 收口：a) practice_progress PRAGMA 守卫式补列 psource/ptitle（存量库无损）；POST /api/practice/progress 可选 source(≤64)/ptitle(≤80) 非字符串按 NULL fail-closed，GET resume 透出；b) saveSession/pushPracticeProgress 带 source/ptitle，adoptLocalPending/adoptRemoteSnap 还原 _source/_ptitle，start()/startReinforce() 清 _ptitle 防非卷会话残留；c) 首页续练卡副标题 ptitle||prModName(module)、两处续练弹窗前缀「卷名」。旧客户端/普通练习/计时模考零变化。
- 验证：ruff/pytest 271(+2)/pyright 0/lint/vitest 478(+4)/build 全绿；祖先链核对（3dc7b38/0f4bfc5/5f41fc2/1550a65/644d31b）通过；生产 rev 67a227a、bundle index-CYBWn0zz.js、Lighthouse 全过；curl 实证生产 source/ptitle 往返/非法忽略/清空。testing agent 实测（uid test-r363-ui）：中断→首页卡显卷名「2015年0711新疆公务员考试《行测》真题 · 已做 2/38 题」→恢复续答 DB source='2015年新疆省考行测真题'（旧版 NULL）；跨设备弹窗带卷名前缀且续答归卷；普通练习无卷名残留（source:""→DB NULL）；计时模考/R358 drop/R360 弹窗/R359 卷卡回归；94 条全 200、console 0 error、0 次 /api/explain、375/1440 无溢出。
- 测试数据清理：test-r363-ui DELETED {mistakes:2, answer_log:7, user_state:1, exam_attempts:1, growth_events:4, practice_progress:1}，LEFTOVER 空，review_cur 0 行；保护 uid DB 37 表+localStorage EXACT n=30。
- 详见 docs/iter/round-3/r363-paper-resume-source.md。

### R364 按卷练习完成页归卷收口（2026-08-29，PR #571，分支 devin/1788478793-r364-paper-finish）
- 取证（SOP-10 窗口内）：按卷不计时练习答完进通用完成页——标题恒「本组完成」不显卷名；「再来一组」在按卷会话（lastModule=null 且无 _redoItems）走 start(null) 抽全模块随机组，打断归卷闭环且覆盖 _source/_ptitle；无回卷库出路。计时模考走成绩报告不受影响。
- 收口（纯前端零契约）：paper-continue.js 补 paperFinishState(ptitle) fail-closed 纯函数（非空字符串→{isPaper,big:'本卷练完',title:trim}，否则通用态）；practice.vue 完成卡按 paperFinish()（模板方法调用规避非响应式 _ptitle）显「本卷练完」+ 卷名副行（.sub.ptl 品牌色）+ 主按钮「回卷库」（goExamList）；非按卷/背题/错题重练/模考零变化。
- 验证：lint/vitest 480(+2)/build:h5 全绿；祖先链核对（3dc7b38/0f4bfc5/5f41fc2/1550a65/67a227a）通过；生产 rev e727840、bundle index-DZ-HSBC6.js、Lighthouse 全过。testing agent 实测（uid test-r364-ui）：新疆卷 38 题答完归卷完成页三要素齐、回卷库落卷卡「已练完全部 38 题 ✓」、R363 恢复路径 _ptitle 生效、普通练习反例零变化、375 全程无溢出、500 条全 200、0 次 /api/explain。
- 测试数据清理：test-r364-ui DELETED {mistakes:38, answer_log:87, growth_events:4}，LEFTOVER 空，review_cur 0 行；保护 uid DB 37 表+localStorage EXACT n=30。
- ⚠️ 重要更正：保护 uid 正确拼写为 umteojq4sltdhorhm（umte-ojq，非 umtejoq），历史文档个别处拼写有误；对比前用 like 'umte%' 预校验。
- 观察项：生产 console 累计 5 条未归因 Uncaught (in promise) Object（无 UI 影响、复现不出），候选后续带 source map 归因。
- 详见 docs/iter/round-3/r364-paper-finish-loop.md。

### R365 按卷练习完成页分享文案归卷（2026-08-29，PR #572，分支 devin/1788481071-r365-paper-share）
- 取证（SOP-10 窗口内）：R364 按卷完成页「分享成绩」仍走通用文案「我在错题邦刷了 N 道行测题…」（lastModule=null 回落「行测」），不带卷名，链接只到站点首页；粉笔按卷分享带卷名。
- 收口（纯前端零契约零新埋点事件）：paper-continue.js 补 paperShareText(ptitle, n, pct) fail-closed 纯函数（非空卷名 trim + n 正整数 + pct 有限数值→按卷基句，否则 null）；shareResult() 非每日分支 paperBase 优先，命中追加连对/击败后接卷库深链 /#/pkgA/exam/list，未命中完全回落原通用路径；埋点 share_result_copy label paperBase?'paper':模块。每日一练分支零改动；计时模考走 report 分享不经此处。
- 验证：lint/vitest 483(+3)/build:h5 + ruff/pytest 271/pyright 0 全绿；祖先链核对（e727840 ∈ HEAD）通过；生产 rev f39d1f4、bundle index-GWtmGg-B.js、Lighthouse 全过。testing agent 实测（uid test-r365-ui）：按卷 38 题答完分享剪贴板精确含卷名/38 题/32%/击败34%/卷库深链、track ref=paper 200；普通练习回落 ref=panduan、每日一练 ref=daily 文案均零变化；R364 完成页三要素回归；375/1440 无溢出、0 次 /api/explain。剪贴板经页面内 writeText hook 捕获（readText 授权后仍 NotAllowedError）。
- 测试数据清理：test-r365-ui DELETED {mistakes:41, answer_log:68, growth_events:12, daily_set_entries:1}，LEFTOVER 空，review_cur 0 行；保护 uid（like 'umte%' 预校验）DB 34 共有表+localStorage EXACT n=30。
- 环境观察（非本轮引入）：00:35 共宿负载 10 秒 503 抖动 12 条（daily submit 一次 503 重做后 200）；部署换 hash 后旧 chunk 预取 404×30 噪音；promise 噪音 1 条（R364 观察项延续）。
- 详见 docs/iter/round-3/r365-paper-share-text.md。
- ⚠️ 合并链事故（R366 发现并补救）：#572 base 指向 R364 分支 devin/1788478793-r364-paper-finish，在 #571 已入 main 后才 merge，R365 commit f39d1f4 未随入 main（NOT_IN_MAIN）。补救 PR #573（devin/1788483376-r365-mainline，从最新 main merge R365 分支）。教训与 R359 #565 同类：链式 PR 合并顺序错位时改动会落在已合并分支上——合并前必须用权威工具核对 base 与 merge 后 main 祖先链。

### R366 按卷练习完成页「重练本卷错题」（2026-09，分支 devin/1788483435-r366-paper-wrong-retry，基于 #573 链）
- SOP-10 四维审计（窗口到点）：操作台/落地页/架构无新高优缺口；功能深度选中——按卷练习完成页对本卷错题无就地行动出路（模考报告 R282 有「本卷错题重练」、粉笔完成页有错题重做，按卷练习是自家双路径口径缺口）。
- 收口（纯前端零契约零新协议零新埋点）：paper-continue.js 补 paperWrongItems(items) fail-closed 纯函数（非数组→[]；取 _picked 非空字符串且 ≠answer 的题，浅拷贝清除 _picked/_saved/_mid/_secs/done，保持卷面顺序）；完成页 isPaper && wrong>0 时主按钮「重练本卷错题（N 题）”（回卷库降为 ghost），retryPaperWrong() 复用 retryGroup 会话重置口径、保留 _source/_ptitle 归卷（answer_log 归本卷、再答错经 saveWrong 入错题本）；全对不显示，普通/每日/背题/模考完成页零变化。
- 验证：lint/vitest 487(+4)/build:h5 全绿（后端零改动）。生产 rev d1fafc3、bundle index-CKVx9v-X.js、Lighthouse 全过。testing agent 实测（uid test-r366-a7k2）：1440 新疆卷 33/38→CTA「重练本卷错题（5 题）」+ 回卷库 ghost，点击 toast「只重练本卷错题」、items id 序列=5 道错题卷面顺序、无 _picked/_saved/_mid/_secs/done 残留、_ptitle/_source 保留；重练 3/5 后完成页仍归卷且 CTA 变「2 题」；全对 2/2 无 CTA、回卷库主按钮；375 同过（scrollWidth=375，CTA right=349）；普通常识 10 题完成页「本组完成」+「再来一组」零变化；已落库 78 条按卷作答 source 全部归卷；console 0 error。
- ⚠️ 部署事故（接替会话发现并补救）：上一会话部署 d1fafc3 在 4a2 之前中断——后端容器已换新（/api/health rev=d1fafc3），但 CF Pages 静态层仍为 R365 bundle index-GWtmGg-B.js（deploy-history.log 无 d1fafc3 记录）。教训：`/api/health rev` 只证明后端，静态层必须另查 `curl / | grep index-*.js` 与 chunk 内容；本轮重跑 `deploy_h5.sh --skip-build` 全流程收敛。
- 环境观察：共宿 recruit celery/postgres 负载尖峰 load 25，边缘 503 约 52s；容器重建窗口内约 8 条作答未落库（其余进 offlineQueue 刷新后同步）。完成页到期复习横幅晚到几秒下推按钮区（既有）。
- 测试数据清理：test-r366-a7k2 DELETED 108（mistakes 8/answer_log 88/growth_events 12），LEFTOVER 0。
- 合并状态：平台禁止本会话合并 main（`gh pr merge` 被拒）——#573（R365 补救）与 #574（R366，base=#573 分支）本地全绿+生产复验通过，排队待老板合并；后续轮次分支继续链在 #574 之上。
- 详见 docs/iter/round-3/r366-paper-wrong-retry.md。

### R367 卷库错题入口：卷卡错题数 + 已练完卷「只练错题」（2026-09，分支 devin/1788488367-r367-paper-wrong-entry，PR #575；补救 mainline 分支 devin/1788490598-r367-mainline）
- 取证：卷卡 /api/exam/papers 只有 practiced/best_score/attempt_count，/api/paper_questions 只有 done，R366 完成页 CTA 离开即失；已练完卷入口只有「重新练一遍/不用了」。
- 口径：「错」= 该题本人最近一次 answer_log correct=0（重练答对即不再算错；NULL/非 0 视为非错，fail-closed）。零新表/字段/端点。
- 后端 db.py：抽 `_answer_state(conn, uid) -> (done_qids, wrong_qids)`（一次 `SELECT question_id, correct … ORDER BY created_at, id` 取最近一次），list_exam_papers 每卷 +`wrong`（无 uid 为 0），paper_questions 每题 +`wrong: bool`（无 uid 不带 done/wrong，契约不变）；禁用题经既有卷题集排除。tests/test_paper_wrong.py 4 例。
- 前端：paperPracticedState(practiced, n, wrong) 追加 ` · 错 W 题`（仅 0<W≤practiced）；新增 paperWrongPlan(items) fail-closed（wrong===true、保持卷面顺序、清 done/wrong）；practice.vue startPaper 已练完+有错 → showActionSheet「只练错题（W 题）/ 重新练一遍」（取消退出），无错保留原 modal，「只练剩余」与计时模考分支不变；只练错题 toast「只练本卷上次答错的题」。vitest +7。
- 验证：ruff/pytest 275/pyright（仅基线 pywebpush 缺依赖）/eslint/vitest 494/build 全绿。生产 rev f58236d、bundle index-DpIbxVtu.js、Lighthouse 全过。testing agent（uid test-r367-q9m3）1440：整卷答错 4 → 卷卡「已练完全部 38 题 ✓ · 错 4 题」、API wrong=4 且 wrong===true 的 id 集合与顺序=答错序列；action sheet 二项；只练错题 items 精确等于错题序列、无 done/wrong、_ptitle/_source 保留；全答对后完成页无 R366 CTA、卷卡回无后缀、API wrong=0（最近一次口径）；无错 → 原 modal；取消 → session=false；计时模考/普通专项练习回归零变化。375（错 3 题）同过，scrollWidth=375，console 0 error。容器 StartedAt 未变，作答 84=84 无丢失。
- 测试数据清理：test-r367-q9m3 DELETED 99（mistakes 8/answer_log 84/exam_attempts 1/growth_events 6），LEFTOVER 0；保护 uid 无变化。
- ⚠️ 合并链事故再现（第三次，与 R359 #565 / R365 #572 同类）：#573 已入 main 后，#574（base=R365 分支）与 #575（base=R366 分支）被 merge 进各自 base 分支而非 main → `git merge-base --is-ancestor d1fafc3/f58236d origin/main` 均 NOT_IN_MAIN（生产当前运行 f58236d 却不在 main）。补救：从 origin/main 开 devin/1788490598-r367-mainline merge R367 分支（含 R366），开 PR 直接 base=main。**规则升级：后续每轮 PR 一律 base=main，不再链式 base 到未合入分支**；合并后必须用 `git merge-base --is-ancestor <sha> origin/main` 权威核对。
- 环境观察：退出模考未交卷会留 exam_attempts 行 + 卷库「未交卷」横幅（既有）；uni showLoading/hideLoading 配对 warning（既有）。
- 详见 docs/iter/round-3/r367-paper-wrong-entry.md。

### R368 错题本归卷：卷源徽标 + 按卷筛选 + 「练本卷」回流（2026-09，分支 devin/1788490910-r368-book-paper，PR #577，base=main）
- 取证：生产 mistakes 222 条，110 条关联真题（is_real=1 且 source 非空，55 个 source），但 mistakes.source 只有 NULL 203 / 'exam' 19——按卷练习答错入本（saveWrong 不传 source）与普通练习错题不可区分、看不到来自哪张卷；粉笔错题本每题带「来源」并可按来源筛选直达卷。R366/R367 打通「卷→错题」，本轮补反向「错题→卷」。
- 后端 db.py：`_paper_by_psource(conn)` 复用 `_list_exam_papers_base` 全量 TTL 缓存建 psource→{pid,title,psource}（同 source 多卷取 id 最大）；list_mistakes 多取 q.source/q.is_real，每条 +`paper`（真题且匹配才有，否则 None；q_source/q_is_real 不外泄；结果集无真题时不触发卷缓存）。team.py /api/track 白名单 +book_go_paper（test_track_whitelist_sync 守卫命中）。tests/test_mistakes_paper.py 4 例。零新表/字段/端点。
- 前端：新增 src/book-paper.js（mistakePaper / paperGroups(max=8) / inPaper，fail-closed）；book.vue 错题卡 `.pbadge` 卷源徽标（青绿，点击→pidFilter）、筛选面板「试卷」分组 ×N、当前筛选条「卷名 ✕」+「练本卷 ›」→ navigateTo /pkgA/exam/list?pid=（R365 深链高亮+scrollIntoView，非重排）；book-url.js buildBookUrl/parseBookOpts +pid（^\d{1,9}$ 或正整数，否则 0；fav 不带）——parseBookOpts 形状多一键，既有 toEqual 断言同步补 pid:0。vitest +1 文件。
- 验证：ruff/pytest 279/pyright（仅基线 pywebpush）/eslint/vitest 501/build 全绿。生产 rev 1c1e18b、bundle index-Difr5oX0.js、Lighthouse 全过。testing agent（uid test-r368-k4p7）1440/375：按卷练习答错 3 → API paper.pid=133、psource 与卷库一致，普通刷题对照 paper:null，mistakes.source 均 NULL；徽标点击→筛选条二 chip、列表 3 条、URL ?pid=133；面板「试卷」×3、「全部」清除；刷新恢复；pid=0/-5/abc fail-closed；「练本卷 ›」→ 卷卡高亮「· 错 3 题」→ 只练错题 items 精确=错题序列；/api/track book_go_paper ref=133；375 scrollWidth=375、长卷源 ellipsis；回归模块/试卷/排序叠加、✕ 单独清除、已掌握 tab、重练、导出、模考徽标、计时模考不弹 sheet 全过；console 0 error。
- 测试数据清理：test-r368-k4p7 DELETED 48（mistakes 4/answer_log 39/exam_attempts 1/growth_events 3/exam_progress 1），LEFTOVER 0；容器 StartedAt 03:10:25Z 未变，作答 39=39。清理表新增 exam_progress。
- 分支：从 R367 mainline 分支切出、PR base=main（含 #576 未合入的 R366/R367 提交，#576 合并后本 PR 自动收敛为仅 R368）。#576 仍待老板合并；main 当前落后生产三轮，合并前勿从 main 部署。
- 详见 docs/iter/round-3/r368-book-paper-source.md。

### R369 错题本按卷筛选态「重练本卷错题」直达（2026-09，分支 devin/1788493372-r369-book-paper-redo，base=main）
- 取证：近 14 天 answer_log 243/34 uid、mistakes +129/37 uid，但 review_log 仅 24/3 uid；全量 mistakes 222 条 review_count=0 占 202、mastered 0——错题产出远大于复练。R368 的 pidFilter 只改列表，页顶「错题重练」卡 redoAll() 仍拼 /api/mistakes/redo?module/qtype/rz/src/t3，用户筛到一张卷点「开始」拿到的是全局 10 道待掌握错题，与筛选态语义冲突。
- 方案（零新表/端点）：book.vue pidFilter 态下卡标题「重练本卷错题 · 卷名」、副文案「按卷面顺序只练本卷上次答错的题（答对过即不再算错）」，redoAll 前置 `if (pidFilter) return redoPaper()`；redoPaper 用 paperGroups(items, Infinity) 取当前卷 {psource,pid,title}，写 practiceLaunch {kind:'paper',untimed:true,wrong:true} → practice。practice.vue startPaper(p, untimed, wantWrong) 拉同一 /api/paper_questions 后 `paperWrongLaunch(items, wantWrong)`（paper-continue.js 新增：wantWrong===true 且有 wrong===true 项才返回 paperWrongPlan 结果，否则 null）→ 直达 wrongOnly（复用 R367 toast「只练本卷上次答错的题」、_source/_ptitle 归卷完成页）；无错题回落既有续练/重练 action sheet。team.py 白名单 +book_redo_paper。`.redo-l` 加 flex:1/min-width:0 防长卷名挤压「开始」。
- 验证：eslint/vitest 505（+4 paperWrongLaunch）/build:h5、ruff/pytest 279 全绿；pyright 4 错为基线（exam_api.py:572、mock_event.py:502 str-int 运算，stash 前后一致，与本轮无关）。本机 pip 环境重置过，需 `pip install` Dockerfile.runtime 同款依赖才能跑 pytest。
- 详见 docs/iter/round-3/r369-book-paper-redo.md。
- 生产复验（PR #578 评论）：rev 05c1f8b / bundle index-CyQMv-31.js，uid test-r369-f7qt 1440/375：pidFilter 卡文案、0× /api/mistakes/redo、/api/paper_questions + track book_redo_paper ref=133、items=[236215,236223,236252]（排除先错后对 236208）、归卷完成页、无错题回落 R367 modal、无 pidFilter/模块筛选回归、375 「开始」不被挤、scrollWidth 375、console 0 error 全过；清理 62 行 LEFTOVER 0，容器 StartedAt 03:55:36Z 未变。#576/#577/#578 已合入 main。
- 遗留观察（非本轮）：模块筛选态卡标题不带「· 模块名」；从其他路由直接改 hash 到 book?pid= 不一定重跑 tab onLoad（F5/徽标点击可进入）。

### R370 热修：按卷完成页「重练本卷错题」作答不落 answer_log（2026-09，分支 devin/1788496145-r370-paper-retry-log，PR #579，base=main）
- 取证（R369 复验中发现）：uid test-r369-f7qt 按卷练完 38 → answer_log 38；R366 CTA 重练 4 题后仍 38（容器未重启、offlineQueue=0）；/api/exam/papers wrong 不减、/api/paper_questions 刚答对题仍 wrong:true。R366 复验记的「容器重建窗口丢 ~8 条」根因即此。
- 根因：practice.vue logAttempts 以 `!q._logged` 过滤；paper-continue.js paperWrongItems 就地复用 items 未删 `_logged` → 重练轮全部被跳过。其他复用点（redoSet/_redoItems 原始拷贝、R367/R369 新拉 items）不受影响。
- 修复：paperWrongItems 追加 `delete c._logged; delete c._excl;`（排除标记也不带入重练）。零后端改动。vitest +1（502→506 含 R369）。
- 部署：release/r369-r370 分支（R369 05c1f8b + R370 合并，rev f4af7c1，bundle index-ONbThL14.js）——两 PR 独立 base=main，生产需同时含两者故临时 release 分支合并部署；#578 合入后 #579 与 main 的相邻注释冲突已解决（c9a4f6f，源文件与 release 分支字节一致）。
- 生产复验（PR #579 评论）：uid test-r370-c5ae，1440 首轮 38 答 5 错（2 题长按排除）→ CTA 重练 5 题 → 5 条 POST /api/answer_log（修复前 0）、DB 38+5=43、/api/exam/papers wrong 5→2、答对题 wrong:false；重练 items 无 _logged/_excl/_picked 残留、.opt.excl=0；联动 R367 卷卡「错 2 题」/action sheet、R369 直达 items=[236215,236243]；回归错题重练「再来一组」/普通刷题落库正常；375 CTA 全流程 2 条 POST、scrollWidth 375；console 0 error。清理 109 行（新增 review_log 表）LEFTOVER 0，保护 uid 快照一致，容器 StartedAt 04:39:49Z 未变。
- 需注意：复验中 7 条作答一度进 offlineQueue（生产 503/超时），刷新后「离线作答已同步」收敛——DB 对账前先刷新冲队列。
- 详见 docs/iter/round-3/r370-paper-retry-log.md。

### R371 任意场次答对曾错题 → 服务端推进错题复习计划（2026-09，分支 devin/1788498918-r371-answer-advance-review，PR #580 已合入 main，base=main）
- 取证（/data/data.db 实查）：mistakes 222、mastered 0、review_count=0 占 202；21 条未掌握错题在建立后已有答对 answer_log（9 条 review_count 仍 0、6 条答对 ≥2 次）；review_log 近 30 天仅 30 行/5 uid。根因：答错任何场次都走 save_mistake 重置 SRS，答对只有错题本重练场次由前端逐题 POST /api/review/{mid}；普通刷题/按卷/只练错题/CTA 重练/模考/PK 答对只写 answer_log。
- 方案（零新表/端点）：db.py 抽 `_advance_review`（record_review 与 answer_log 共用同一 SRS）、`_find_open_mistake`（条目 mid 优先→question_id+uid 回退，仅 mastered=0）、`save_answer_log_detail` 返回 `{saved, reviewed:[{mistake_id,streak,mastered}]}`（同批同错题只推进一次）；`save_answer_log` int 契约不变，exam_api/team 调用方自动获得推进。POST /api/answer_log 新增 reviewed 字段。前端 practice.vue：logAttempts 带 `mid: q.mistake_id`；syncRedoReviews 不再 POST /api/review（防双计），改 await 在途落库请求后用 reviewed 汇总；非重练场次新增 `.fixreport`「本组答对 N 道曾错题，复习计划已推进（M 道达成掌握）· 回错题本 ›」；新 src/review-advance.js。掌握阈值 [1,3,7,15,30] 未动。
- 验证：pytest 285（+6）/ruff、vitest 510（+5）/eslint/build:h5 全绿；pyright 4 错基线不变。
- 部署：rev b4f12af，bundle index-CMN418Sg.js，Lighthouse 预算全过。
- 生产复验（PR #580 评论）：uid test-r371-oayu；1440 按卷 38 答 3 错 → 错题重练 2 对 1 错 → 3 条 POST 带 mid、reviewed 各 1、**0 条 POST /api/review**、DB review_count/streak=1、next_review≈+1d、review_log 每题恰 1 行；错题本 2 题「明天复习」1 题「今日待复习」banner 3→1；卷库「只练错题」（无 mistake_id，qid 回退）答对 → `.fixreport` 出现且点击进错题本，banner 消失；375 重练 3 对 → streak 2、next_review≈+3d、redoReport 3/0/0、无横向溢出（clientWidth==scrollWidth==360，桌面 Chrome 仿真带 15px 滚动条，不能硬等 375）、console 0 error。清理 63 行（mistakes 3/answer_log 45/review_log 6/growth_events 9），保护 uid 快照不变。
- 需注意：造数据阶段生产 503/524 致容器重启一次（StartedAt 05:43:19Z → 05:57:25Z），作答走 offlineQueue 刷新后补齐无丢失；功能证据全部采自重启后稳定窗口。共宿负载问题持续，仍建议限资源。
- 详见 docs/iter/round-3/r371-answer-advance-review.md。下次 SOP-10 四维审计 ~R376。

### R372 生产进程被整体换出 → 请求 25s 超时/假死重启循环：内存驻留加固（2026-09，分支 devin/1788504128-r372-runtime-memory，PR #582 已合入 main，base=main）
- 取证（VPS /proc、cgroup v2、Caddy 源站日志、生命周期日志）：真实用户 /api 5xx 9-03 10%、9-04 早间 24%，形态为 Caddy `lb_try_duration 25s` 耗尽 503，绝大多数不在重启窗口；容器内 `/proc/1/status` VmRSS 16 MB / VmSwap 238 MB、cgroup `memory.swap.max=max`——进程被整体换出，每请求从 swap 回页数十秒；健康探针同样 >25s → autoheal SIGKILL（137，OOMKilled=false）→ 冷启动再拉回全部页 → 循环（`removing unhealthy` 4/4/6/8 次/天）。宿主 1.9 GiB RAM 被共宿 recruit-postgres（file 271 MB）+ 10 个 postgres 后端 + dockerd 213 MB 占满，全部业务容器都在 swap。kaogong 自身放大项（本地用生产库副本 smaps 实测）：启动瞬间并发 governance_scan 全表 fetchall（+100 MB 峰值）等三个后台任务 RSS 239→642 MB；每线程本地连接 32 MB 堆页缓存 × 最多 40 线程池连接，mmap 256 MB < 库 419 MB。
- 方案（零功能变化/零新表端点）：compose `mem_limit: 768m` + `memswap_limit: 768m`（→ `memory.swap.max=0`，进程页固定 RAM）+ `mem_reservation: 384m`（→ `memory.low`）；`db.get_conn` `SQLITE_CACHE_KIB=-8192`、`SQLITE_MMAP_BYTES=1<<30`；main.py `BOOT_QUIET_S`（`KG_BOOT_QUIET_S` 默认 600s）后才跑 `_prime_admin_caches` 与 `refresh_question_stats/refresh_material_hash`；`_governance_scan_uncached` 游标迭代不 fetchall。**代价：宿主压力转移到其余容器**；匿名内存真超 768 MB 走 OOM kill + restart 秒级拉起（lifecycle 日志会显示 oom=true）。
- 验证：pytest 288（+3 test_runtime_memory.py）/ruff/pyright 0；vitest 511/eslint/build:h5 全绿（前端零改动）。
- 部署：rev 9a2c8cd，bundle index-C7wGv3is.js，StartedAt 06:53:13Z；docker inspect Memory=MemorySwap=805306368、Reservation 402653184；cgroup swap.max=0、swap.current=0；VmSwap 0、anon 74 MB。
- 生产复验（PR #582 评论）：1440/375 首页/错题本/卷库/SEO/普通刷题完成页/管理台全部 200、0 console error、375 clientWidth==scrollWidth；部署后 25 min 源站 /api 136 请求 **0 5xx**（部署前当日 12362 请求 5xx 10.7%）、>5s 3.7%（前 12.2%）、平均 0.64s（前 3.74s）；容器 StartedAt 4 个检查点不变、oom_kill 0、VmSwap 全程 0。**未达项**：宿主 load 24 尖峰期普通刷题 5 个写请求 7–15.8s（全 200，进程 VmSwap 0，为宿主 CPU/IO 争抢非换出）；VmHWM 静默期结束后 555→670 MB（上限 768 MB 余量约 100 MB，需观察 lifecycle 日志 oom 字段）。清理 test-r372-xknj 16 行 LEFTOVER 0。
- 需注意：① 若 lifecycle 日志出现 oom=true，先看 `KG_BOOT_QUIET_S`/预热任务与 `_HOT_UID_TABLES` 全表 fetchall 增长，再考虑上调 mem_limit；② 共宿 recruit/postgres 限资源建议已第四次提出，仍是宿主级根因；③ 本地取证脚本 /home/ubuntu/r372_memprofile*.py 与生产库副本 /home/ubuntu/proddb 不入库。
- 详见 docs/iter/round-3/r372-runtime-memory-pin.md。

### R373 静默期结束瞬间用户写请求集体阻塞 15s：后台重任务空闲门控 + 题目统计刷新不持写锁翻冷页（2026-09，分支 devin/1788507404-r373-idle-gated-refresh，PR #584，base=main）
- 取证：R372 上线后源站 0 个 5xx，但 5 条 7–15.6s 的 POST（practice/progress ×3、answer_log ×2）全部在 07:03:34 同一秒放行；StartedAt 06:53:13 + 600s 静默期 = 07:03:13。同一秒集体放行 = 排队等同一把锁。静默期结束同时启动 `_prime_admin_caches`（admin_stats 冷页读 252 MB 全表扫描）与 `refresh_question_stats`（一个隐式写事务内逐题 UPDATE 943 行；生产库副本 `posix_fadvise DONTNEED` 冷页实测读 99 MB＝943 次随机页错误×mmap readahead，热页 0 MB）。宿主 IO pressure full≈65% + 刚起 10 min 页缓存只有 ~135 MB → 随机读全部落盘并算进写锁持有期，POST 在 busy_timeout 上排队到 commit 一刻集体放行。反证：页缓存热时（IO pressure 99%）用探针（/tmp/r373_probe.py，每 0.5s 一读一写 + 触发三缓存 stale 刷新）写 max 1.1s 不阻塞。
- 另取证（未用作本轮方向，留档）：mistakes 221/59 uid、mastered 0、times=1 占 214、197 条未掌握 next_review IS NULL（R371 前历史数据未进 SRS）、error_reason 仅 6 条非空、source NULL 202/exam 19；近 14 天 growth_events boot 231/229 uid、heatmap_view 59/38、slow_load 54/22（TTFB 中位 69ms 但 p90 25.9s 两极分化）、review_entry_click 5/4、review_done_celebrate 1/1——错题本复习完成率极低，是下一轮候选方向。
- 方案（零功能、零新表/端点）：① `db.refresh_question_stats` 先在读事务里 `SELECT id, attempt_count, correct_ratio, most_wrong ... WHERE id IN (...)`（读热页、不持写锁），只对变化行 `executemany` UPDATE，每 `QUESTION_STATS_BATCH=100` 行 commit；返回值仍为有作答题数。② main.py `note_request()`（slow-req 中间件记录最近用户请求时间，`/api/health` 探针不计）+ `heavy_task_allowed()` = 静默期已过 且（最近 `KG_IDLE_GATE_S=60`s 无请求 或 已推迟满 `KG_IDLE_MAX_DEFER_S=2h`）；`_warmup` 预热与 `_stats_refresher` 每轮刷新都过此门（`_wait_heavy_task_slot` 15s 轮询）。
- 验证：pytest 291（+3 test_idle_gated_refresh.py：只写变化行/分批 commit/无变化零写、门控四态+最大推迟、health 不计活跃）/ruff/pyright 0；vitest 511/eslint/build:h5（前端零改动）。测试坑：共享测试库主线程连接若留有 `fetchone()` 未走完的活动读语句，另一线程写后本线程再写会立刻 `database is locked`（BUSY_SNAPSHOT），用 `fetchall()` 让语句复位。
- 部署：rev c76247a，bundle 不变 index-C7wGv3is.js，StartedAt 07:48:38Z，Lighthouse 预算全过。
- 生产复验（PR #584 评论）：作者探针 StartedAt+540s→+730s 跨静默期结束点，写 184 次 max 25ms、读 185 次 max 76ms，slow-req 0（R372 同窗口 5 条）；探针刚停 `/api/admin/dashboard` X-Kg-Cache=cold（预热被推迟），空闲 ≥60s 后 `_warmup` 下一轮执行预热 VmRSS 426→647 MB、随后 hit；部署起 1666 条 /api 0 个 5xx、RestartCount 0、VmSwap 0、memory.events oom 0。testing agent（uid test-r373-avxx）1440/375 精简冒烟：首页/刷题 10 题完成页/错题本/卷库 130 个 /api 全 200 max 534ms、console error 0、375 三页 clientWidth==scrollWidth==375、答 1 题落库；清理 22 行 LEFTOVER 0，StartedAt 未变。
- 未验证/限制：① 探针窗口宿主 IO pressure avg300 仅 19–26%、load ≤3.6（事故时 full≈65%、load 19–24），「高争用下也 0 阻塞」未在生产复现，机制消除由单测 + 冷页 IO 实测背书；② 375 阶段捕到 1 条 `unhandledrejection: [object Object]`（钩子只存了 String，无法归因，重跑未复现；前端零改动）；③ 管理台未测。
- 需注意：预热后 VmRSS/HWM ≈650 MB 主要是 mmap 文件页（可回收），不是 anon 增长；若 `_warmup` 5 分钟轮询下预热最迟在空闲后 ≤300s 才发生，属预期。
- 详见 docs/iter/round-3/r373-idle-gated-refresh.md。下次 SOP-10 四维审计 ~R376。

### R374 探针流量入库侧打标（KG_PROBE_CIDRS）：运营看板只算真人，历史行不造假（2026-09，分支 devin/1788510680-r374-probe-tagging，PR #585 已合入 main，rev a0448a8）
- 取证（推翻 R373 候选方向）：源站 3 天访问日志 41,202 条 /api 请求中 41,107 条来自 `140.232.64.2–.5`（Devin 会话共享 NAT），非探针仅 95 条（`39.158.40.85` Android WebView 43、`150.109.230.174` admin/curl 38、其余 ≤2）；810 条 `/api/track` 有 807 条是探针；`/api/exam/*` 8,590 次 404 + 183 次 502 全部来自 `.5`。库内 answer_log/growth_events 无法区分探针行与真人行——「197 条未掌握错题 next_review 为空 / review_done 14 天 1 次」这类结论目前是我们自己的测试流量在说话，不能当产品结论。既有 `/home/ubuntu/kaogong-reports/probe-ips.txt` 只有 `.5` 精确 IP（另一行还带了行内注释），漏 `.2/.3/.4`。
- 方案（零用户功能）：`auth.parse_cidrs/ip_in_nets/probe_ip`，`PROBE_NETS` 由 env `KG_PROBE_CIDRS` 启动时解析（空=不打标，非法项跳过）；`answer_log`/`growth_events` 幂等加 `probe INTEGER`，新行写 0/1，**旧行保持 NULL=未知，不回填**；写入路径全带标：/api/track、/api/answer_log、/api/paper_answers、/api/exam/submit、分享作答；管理台 `_admin_dashboard_uncached` 全部 answer_log 口径加 `REAL_TRAFFIC="COALESCE(probe,0)=0"` 并返回 `today/yesterday.probe_excluded`，看板副标题外显「已剔除探针作答 今日 N / 昨日 M 条」+「真人」tag；`scripts/access_log_report.py --exclude-ip-file` 支持 CIDR；compose 透传 `KG_PROBE_CIDRS`。探针行**保留**（生产冒烟仍可对账/清理），只是不进运营口径；用户自身统计/SRS 推进不受 probe 影响。
- 验证：pytest 297（+9 test_probe_tagging.py）/ruff/pyright 0；vitest 511/eslint/build 全绿（bundle 不变 index-C7wGv3is.js）。
- 部署：生产 `deploy/.env` 追加 `KG_PROBE_CIDRS=140.232.64.0/24`（**换探针网段只改 .env 重启，不用发版**）；rev a0448a8，StartedAt 08:41:47Z，restarts 0，OOM false，VmSwap 0。
- 生产复验：本机出口实为 `140.232.64.4`（旧清单漏掉的 IP），发 1 条 track + 1 条 answer_log 均落 `probe=1`；`/api/admin/dashboard` today.active 5 / answered 41 / probe_excluded 1（探针行未计入）；testing agent 1440/375 管理台看板副标题/真人 tag/KPI 与页面自身接口响应一致、375 cw==sw、console 0 error，用户端首页双视口 0 error（录屏 PR #585 评论）。
- 限制：① 打标自 08:41Z 起生效，历史 1040 条 answer_log / 507 条 growth_events 全是 NULL——**R375 起生产取证一律加 `probe` 口径过滤，且至少积累数日干净数据后才能对复习闭环/激活率下结论**；② 副标题「昨日>0」「今日=0」分支未在生产观测；③ growth_events 侧只加了列，除 dashboard 外的漏斗/成长查询（如有）尚未加 probe 过滤。
- 生产测试数据清理：uid `r374probe-*` 行已删。下次 SOP-10 四维审计 ~R376。

### R375 用户可见的全站聚合接入探针口径（2026-09，分支 devin/1788513418-r375-real-question-stats，PR #587 已合入 main，rev e58779f）
- 取证：源站访问日志 102,655 条 /api 中 102,541 条来自探针网段，初步可信真人 API 请求 56 条（200×53 / 404×2 / 403×1）、真人 UID 约 3 个（`umst3tuisd7lgzaka` 走通 review→mistakes→check-in→profile→reminders→share）；WordPress/.env/.git 扫描流量不算用户；Cloudflare Analytics token 缺 `zone.analytics.read` 无法查（限制，未补权限）。
- 方案：`db.REAL_TRAFFIC="COALESCE(probe,0)=0"` 提为共享谓词，`refresh_question_stats()`（题目人次/正确率/`most_wrong`）与 `team._question_stats()`（分享页「击败 X%」）只算真人；历史 NULL 仍计入、不回填；UID 个人历史与 SRS 不变。补丁：**只剩探针行/真人行被清理的题目刷新时把旧聚合清为 NULL**（原实现只更新有真人行的题，陈旧「全站正确率」会一直挂着）。
- 验证：pytest 318 / ruff / pyright 0；与 main 冲突（R374 `add_column_if_missing` 同文件）已在 `e58779f` 合并解决。生产：q41 只剩 1 条探针行 → (None,None,None)，stale 0 / mismatch 0 / 有统计题 938 / 探针行 80。
- 部署：rev e58779f，bundle index-EtHOTcLm.js（含 W2 前端），deploy_h5.sh 性能预算全过；W2-A/B 生产回归：`POST /api/export/pdf` 畸形参数 400、`/tiku/` 「10万+ 行测题 · 1.5万+ 历年真题」、`idx_mist_uid` 存在、`/api/mock/events` 正常。

### W2 内容清洗事故与回滚（2026-09-04，生产数据操作，无发版）
- 事故：`scripts/w2_content_cleanup.py --apply` 在生产改写 7700 题的 question/options（去汉字间空格）+ 2398 题 hs 元句。testing agent 冒烟发现**逻辑填空题被毁**：选项分词空格是语义（「履行 强化 改变」→「履行强化改变」，约 1191 题选项 ≥6 字无分隔），题干中连续空格/`\xa0` 是空位占位（约 92 题空位消失）。第二个连带事故：`db._seed_questions()` 启动时按题干原文 `INSERT OR IGNORE`，题干被改写后容器重启把 **1928 条种子题当新题重插**（10:26:59Z，新 id、无作答引用、tag3_review 166 行）。
- 回滚（容器内脚本，备份 `/data/data.db.bak-w2`）：先删 1928 条重复行（remap 引用为空，tag3_review 166 行删除），再从备份原样恢复 2000 题（此前两次恢复因 UNIQUE 冲突中断时已恢复其余 5700 题并留下 `question||char(0)||id` 临时后缀），rescore，restart 清 lru_cache。终态核对：questions 156792 = 备份；question/options 与备份差异 0；NUL 占位 0（`id=334117` 备份里本就含 NUL，非本次）；hs 与备份差异恰 2398（预期清洗）；explanation/answer 差异 0；restart 后 seed 未再插入；restarts 0 / healthy。仍含元句的 173 条 hs 全部 disabled=1，本就不在 ONLINE 口径。
- 处置：脚本撤掉 question/options 改写，只保留 hs 元句剥离（本轮 PR）。**规则：任何对 `questions.question` 的文本改写都会被 `_seed_questions` 视作新题重插，改写前必须先改去重键或同步改 `knowledge/questions_bank.jsonl`；对选项/题干去空格必须先排除填空题型。** 存量 ~7300 题汉字间空格（主要 id≥1046924 AI yanyu 批次）与 76 对「同题异格式」重复归入 backlog（content P2），不再用通用规则一刀切。
- w2.md §5.0 中「生产 apply 已执行 7700 改写」的记录已被本节覆盖：question/options 部分已回滚，hs 部分保留。

### R376 SOP-10 四维审计 + 种子题库导入去重键换为 seed_index（2026-09-04，分支 devin/1788522083-r376-seed-index，base=main）
- SOP-10 四维审计（窗口到点）：落地页/首页 UI 与核心功能无新 P0（R375 部署性能预算 `/` 0.97、`/tiku/` 1.00；恢复后库 1440/375 全过）；**命中操作台×架构交叉缺口**——`ADMIN_EDITABLE` 含 `question`、操作台可改题干，而 `_seed_questions()` 每次启动按题干原文 `INSERT OR IGNORE` 9217 行：生产 9217 条种子题干全部在库（572 条 disabled）处于「刚好全命中」的脆弱平衡，任何题干改写/删除都会在下次重启被文件原文复活（同日事故实际重插 1928 条）。
- 方案（后端零契约零前端）：新表 `seed_index(stem_hash→question_id)` + `seed_runs(path→文件 sha1)`；`_seed_questions(path=None)->int` 文件指纹不变整体跳过，否则按题干 sha1 去重（已导入过的种子题无论改写/下线/删除都不重插），被 IGNORE 的行按原文回查 id 回填映射（升级路径），`submodule` 补齐改按 id。`_seed_shizheng` 只共用 `_seed_bank_path`，语义不变。
- 验证：pytest 324（+3 test_seed_index.py）/ ruff / pyright 0；前端零改动。生产部署核对：`seed_index` 应为 9217、questions 156792 不变、restart 后不变。
- 详见 docs/iter/round-3/r376-seed-index-audit.md。下次 SOP-10 四维审计 ~R388。


### W3（体验/口径/内容人味集成轮，分支 devin/wf-w3-integration，未建 PR/未部署）
- 集成：origin/main 2d50265（含 #587 R375、#588）切 `devin/wf-w3-integration`，依次 merge W3-A（cff7eda）/ W3-B（1ed386a）/ W3-C（8fca744），三次无冲突（A 与 R375 均改 db.py 自动合并）；dropped 无。生产 `/api/health` rev=e58779f 是 HEAD 祖先（无「已上线未合入」漂移）。全量本地验证：backend ruff / pyright 0 / pytest 342（main 基线 318，+24）；frontend-uni（Node 22.23.2）lint / vitest 523 / build:h5（bundle index-TmyrZ0ah.js）；miniapp typecheck 0 / lint 0（脚本已内置 `ESLINT_USE_FLAT_CONFIG=false`）。
- W3-A（backend）：`/api/questions/export` 复用 import 令牌（`deps.check_import_token`，无头/错令牌/未配置 401）；`growth_stats` 周键 `+8 hours`；`_client_ts(raw, now)` 接受 items[].t（int/float，>1e11 毫秒，[now−30d, now+5min] 外回退 now）落 answer_log.created_at；`/api/rate` `rl(request,'rate',60,600)`。本地 uvicorn 实测：export 无头 401 / 正确令牌 200；t=昨日毫秒 → checkin days 落昨日、t=90 天前回退今日；t=2026-08-31 周一 01:00 CST → `/api/growth` week 2026-35（UTC 键 2026-34 未出现）；`/api/rate` 第 61 次 429；核心接口 200。**生产仍旧代码：export 匿名 200，待部署后回归**。
- W3-B（miniapp+H5）：小程序 stats 页 `fetchGrowth()`（/api/growth）服务端优先、pstats 降级、`{{modSrc}}` 口径文案；offline 队列 `t: now+i`、在线上报 `t: Date.now()`；types GrowthResp / `AnswerLogItem.t` / `Question.image_credit`。H5 `buildPaceRows` 读 `per_module.answered`：answered=0 → skip「未作答」灰标、部分作答按已答折算参考时（旧版同数据 5 模块全「偏快」，复现原缺陷）；`goTask` mock 任务 `t.real || planToday.real_mode` → 卷库。本地 build 产物报告页 Chrome 实测 `.prow-tag.skip`「未作答」rgb(107,114,128) + 4×「合理」+「（按已答 5/10 题折算）」注。实施方生产 API 级回归（test-w3-b-pace）已做并清理 leftover 0。**小程序未真机、goTask 未端到端点击**。
- W3-C（content）：`quality.sanitize_explanation`（广告尾句 → 抓取源统计前缀/「解析」标签族循环剥 → normalize_cjk_spaces → 空白归一，数字/字母空格保留）+ `scripts/w3_content_cleanup.py`（w2 脚本模式，dry-run 默认、`--apply` 备份 .bak-w3、rescore、不下线）。本地临时库 dry-run 2500 → apply → 复扫 0，非 explanation 列/disabled 不变；实施方生产只读快照 dry-run rewrite 10,068（prefix 5383 / ad 192 / space 10045 / blank 6）、apply 预演 158,720 行非 explanation 列不变。**生产已 apply**（2026-09-04 17:11Z，rev fef41da 容器内，含 #594 结构空格闸/无统计前缀规则；命中 8,282，`space_kept` 65；备份 `/data/data.db.bak-w3`）。09-05 复核：容器内复扫 0、台账 8,281 题中 7,997 题与 sanitize(bak-w3) 逐字一致、0 未改 0 为空、284 题被 R396/R400 后续改动、非 explanation 列不变、容器已重建（缓存已刷）；台账 `docs/iter/workflow/w3c_applied_ids.json`，细节 w3.md §4.5。脚本 `apply()` 事后改乐观并发（`WHERE id=? AND explanation=?`），多会话并行改题时不回写旧值。
- 数据纪律：集成验证全部在本机临时库 + 本机 Chrome，生产仅 2 次只读 GET；未触发 LLM；未改生产配置。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W3 追加）」（部署后回归清单、入库防再污染一行补、async 端点同步 IO 待证据、懒迁移收敛、limit=0 口径、错题写放大量化、双目标合一、前端未验证项、小程序真机、hs 模板句式统计、「微信/关注」人审、增长提案 8 条、fastapi 新版 8 例 locked 基线问题）；详证 docs/iter/workflow/w3.md。

### R377 搜索分发接入：Google Search Console 建资源 + 管理台「搜索引擎抓取」面板（2026-09-04，分支 devin/*-r377-crawler-visibility，base=main）
- 取证：Search Console 新建 `sc-domain:kaogong.zalize.com`（DNS 提供商自动验证）后「网址检查」`/` 与 `/tiku/` 均「Google 无法识别此网址」、站点地图「未检测到」——**Google 上线以来从未发现本站**（robots 里声明的 sitemap 从未被读取）；「测试实际网址」`/` 可编入索引（SEO 层本身没问题）。源站日志剔除探针后 Googlebot 仅 3 次（全部在 12:24Z 提交 sitemap 之后），Baiduspider 0；Bing/Yandex 靠 R89 IndexNow 在爬。**修正 R90 记录**：当时的「Googlebot 1 条」实为探针网段 140.232.64.5 伪装 Googlebot UA 的 SSR 自测（08-31 08:23Z），不是真 Google。
- 爬虫 5xx 归因：9-02～9-04 06:05Z 的爬虫 503（25s）全部落在 R372 前的 unhealthy→137 重启窗口（container-events.log）；R372（06:53Z）之后爬虫 0 个 5xx，R376 部署后 restarts 0——运行时不需要改动。
- 运维动作（已执行，不入代码）：GSC 提交 `https://kaogong.zalize.com/sitemap.xml`（状态「成功」、站点地图索引、子图待处理）；对 `/tiku/` 「请求编入索引」一次（有回执）；`/` 仅「测试实际网址」通过，索引请求是否提交未知。GSC 资源挂在测试 Google 账号下——**资源申请：老板 Google 账号邮箱以加为所有者；百度站长平台账号+主动推送 token**（到位前不写推送桩）。
- 代码（操作台×分发）：`scripts/crawler_stats.py`（VPS cron `23 * * * *`，读小时级归档 → `kaogong-reports/crawler-stats.json`，探针网段剔除，`probe-ips.txt` 已补 `140.232.64.0/24`）；`ops_status.parse_crawler_stats` → `/api/admin/ops_status.crawlers`（近 7 天 hits/5xx/题库页/sitemap/最近抓取，Google/Baidu/Bing 置顶，>3h 未更新标 stale）；`dashboard.js` 运维状态卡下「搜索引擎抓取」面板（从未来过标红）。零新表/端点。
- 验证：pytest 327（+7 test_crawler_stats.py）/ ruff / pyright 0；VPS 实跑脚本 5s（历史归档 25 万行），首份 JSON：Yandex 1136 / Bing 89 / Apple 3 / probe_excluded 1（即那条伪装 Googlebot）。
- 上线复验（rev 62e8c18，同批带上 main 合入的 W3 #590，全量 build）：testing agent 1440/375 全过；cron 13:23Z 刷新后面板 **Google 16 次全部为 sitemap 抓取（12:41Z，提交 sitemap 后 17 分钟）**——GSC 提交实证生效，Google 已开始读 sitemap 但尚未抓 `/tiku/` 任何页；Baidu 仍「从未」红标。stale / crawlers=null / Google「从未」分支只在单测覆盖，生产不可造。
- 次日复核（R378 取证起点）：源站日志 Googlebot 是否抓 `sitemap-*.xml` 与 `/tiku/` 页；GSC「站点地图」已发现网页数、`/tiku/` 收录状态。不得把「提交成功」当「已收录」。
- 详见 docs/iter/round-3/r377-search-distribution.md。

### R378 搜索落地页「做这道题」深链：SEO 题目页 CTA 带 qid，练习页领跑 + 同考点续题（2026-09-04，分支 devin/*-r378-seo-lead-question，base=main）
- 取证：GSC 站点地图 13:40Z 已「成功 · 已发现网页 109,903」（R377 提交时 0）；源站 Googlebot（66.249.73.x）12:24–12:41Z 32 次全为 sitemap 子图，`/tiku/q/*` 0 次——「已发现」≠「已收录」≠「有流量」。生产 `answer_log` 按 source：`seo` 仅 2 行且 probe=1，**SEO 页从未带来一次真人作答**（此前 Google 未发现本站，是没流量不是转化差）。现状 `/tiku/q/N` 唯一 CTA「在线练习此考点」按 tag3 随机取 10 题，访客刚读的那道题不保证在其中；无 tag3 的题 CTA 退化为「继续刷题」回首页丢题。粉笔题目落地页打开的是同一道题。R372 后爬虫 SSR 题目页 p50 10ms / p95 50ms / 0 5xx，抓取承载无需改动。
- 方案（零新表/端点）：`seo/pages.py` 题目页 CTA → `practice?qid=N[&tag3][&module]&source=seo_q`（有 tag3「在线做这道题 + 同考点练习（免费）→」/ 无 tag3「在线做这道题（免费）→」）；`practice.vue` `onLoad` 解析 qid → `_leadQid`，`start()` 与题包并行取 `/api/question/{qid}`（社区路由既有单题端点），`leadq.mergeLead` 置顶去重，取不到/下线静默按原题包开练；`source=seo_q` 随 `_source` 落 `answer_log.source`。
- 度量：`answer_log WHERE source='seo_q' AND probe IS NOT 1` 行数/uid 数 = 搜索落地转化；首行 question_id == 落地 qid 比例 = 领跑生效率。Google 尚未抓题目页，短期 0 为正常。
- 验证：pytest 354（+1 CTA 两支）/ ruff / pyright 0；vitest 528（+6 leadq）/ eslint / build:h5（bundle index-BHP3w8L6.js）。
- **并行部署覆盖事故**：13:51Z 上线 rev 23cd5c5 后 5 分钟（13:56Z）被另一会话部署的 `rev=fef41da`（不在任何远端分支；树含 R377 + W3-C #594，不含 R378）覆盖，题目页回到旧 CTA，testing agent 复验开始前发现。处置：R378 分支合入 origin/main（#592/#594）得 0b6ef09 重新部署（14:00Z，bundle 不变）。防复发：`deploy_h5.sh` 新增 2b「线上 rev 谱系闸」——线上 rev 不在本机仓库或不是 HEAD 祖先即 FAIL，`DEPLOY_FORCE=1` 才放行（deploy/README 有说明）。其他并行会话须 `git pull` 才能拿到该闸。
- 详见 docs/iter/round-3/r378-seo-lead-question.md。

### R379 搜索落地→作答漏斗修补：深链「退出」整页重载（P0）+ 题目页首屏可作答（2026-09-04，分支 devin/*-r379-seo-landing-funnel，base=main）
- 取证：testing agent 以搜索访客身份在生产 rev 0b6ef09 走 `/tiku/q/*`→CTA→做题→退出，20 条 UX 发现（`r379_ux_findings.md`）。P0 F11：深链直达练习页做到 4/11 点「退出」→ `type=reload`、回同组第 1 题、计数清零、服务端进度被清——根因 H5 `uni.navigateBack` 只是 `history.go(-1)` 且永不 fail，页面栈仅 1 页时兜底 switchTab 永不触发。P1：题目页答案 `<details open>` 先于作答暴露、CTA 在 1.3–1.6 屏下、首屏无价值主张、选项像可点但是死的、练习页不说第 1 题就是刚读那题、375 答错后解析卡被横幅盖住。
- 方案（零新表/端点）：`quit()` 页面栈 1 页直接 `switchTab` 首页；题目页选项改 `<a class="opt" href=…&pick=A rel=nofollow>`，CTA（`cta-w` 整行）前移到答案前、答案默认折叠并在折叠区尾再放一次 CTA、选项上方一行价值主张、面包屑去内部 id；练习页领跑题置顶时显示可关闭提示「刚才那题在这里作答，之后 N 题同考点/同模块练习」；`leadPickOf` 只接单个大写字母，领跑就位后走既有 `pick()` 自动判定并取消自动跳题；答错后 `revealAfter()` 把 `.after` 卡顶出判分横幅。
- 未在生产验证的分支：`pick` 指向不存在选项（本地 `!= null` 守卫）、`getCurrentPages().length>1` 的 navigateBack 支（站内进入练习页再退出，属既有行为）。
- 留待后续：F18 首页「继续刚才的练习」卡、F10 答对自动跳题默认值、F6 相似题/同考点列表信息密度。
- 验证：pytest 356 / ruff / pyright 0；vitest 532 / eslint / build:h5（bundle index-DKZqTSTu.js）。生产 rev dc88fc1（15:03Z 部署，谱系闸 OK）testing agent 1440/375 全过：答案默认折叠、选项 pick 深链自动判分且不跳题、领跑提示三种文案、375 答错后解析卡顶在横幅之上、深链退出 ×3 均为 navigate（非 reload）回首页且今日计数保留、站内退出仍返回上一页、/api 全 200、容器 0 重启、清理 LEFTOVER 0、questions 156792。观察：375 无 tag3 三行题干时 CTA 底边 815px（超首屏 3px）；桌面 Chrome `vibrateShort:fail` unhandledrejection 为平台噪音（既有）。
- 详见 docs/iter/round-3/r379-seo-landing-funnel.md；复验评论 PR #596。

### R380 练习中途「退出」可保留进度——首页续练卡真正接上（2026-09-04，分支 devin/*-r380-quit-keep-progress，base=main）
- 取证：R379 F18「退出后首页无继续上下文」实查根因是 `quit()` 无条件清 `pendingSession` + 服务端进度，首页早有的「有一组未做完的练习」卡只覆盖关页/杀进程路径。搜索分发：Googlebot 仍只抓 sitemap/robots，`/tiku/q/*` 0；**Bingbot 7 次、Yandex 45 次已进入 `/tiku/q/*`**；真人 `seo_q` 仍 0。
- 方案：`quit-summary.js quitSummary(items, eligible)`（已答≥1 且有未答才返回摘要）→ `quit()` 弹「已做 N 题 · 答对 R · W 道进错题本」保留进度/结束本组 → `leave(keep)`（keep 立即 flush 服务端进度、不清本地）；模考/背题/时政不弹；埋点 `practice_quit_keep/end`。
- 详见 docs/iter/round-3/r380-quit-keep-progress.md。
- R380 验证结果（#597 已合入 main）：本地 eslint / vitest 538 / build:h5、pytest 357 / ruff / pyright 0 全绿；生产 rev 4584019（bundle index-Bctw4Xpu.js）。testing agent 1440/375 全过：弹窗标题精确「已做 2 题 · 答对 1 · 1 道进错题本」/全对无尾句、保留进度 → 立即 POST progress 200 → 首页「有一组未做完的练习 · 已做 2/11 题」→ 去继续回到第 3 题计数保留；结束本组 → 无卡、progress 行删；一题未答直接退无弹窗；站内退出仍 navigateBack、迷你模考不受影响；console 0 error、容器 0 重启、清理 LEFTOVER 0、questions 156792。
- **复验中发现并热修**：首版 d702472 只改前端，`/api/track` 白名单缺 `practice_quit_keep/end` → 400 静默丢埋点；`test_track_whitelist_sync` 的正则只认 `trackEvent('literal'`，三元写法漏扫。热修 4584019：白名单补齐 + 扫描改为抓第一实参内所有字面量（新增用例断言能扫到这两个事件）。教训：纯前端埋点 PR 也必须实测 `/api/track` 状态码 + `growth_events` 回读。
- 未在生产验证：背题/时政不弹窗分支、全部答完退出、服务端快照续练（换设备）、首页卡 ✕ 放弃。

### R381 material_hash 部分索引 + 首页壳可爬题库入链（2026-09-04，分支 devin/*-r381-material-index-seo-nav，base=main，PR #599 已合入）
- 取证：候选 F10「自动跳题默认值」（`autoNext` 默认开，已有开关）与「落地页相关题目密度」（题目页已有同材料组/同考点相似题/JSON-LD）均无真人数据支撑，不改。真命中：`questions.material_hash` 无索引且生产库**无 `sqlite_stat1`**（规划器纯启发式）→ SEO 同材料题组查询走 `idx_q_sitemap (disabled=?)` 按 id 扫 156,792 行（冷 2.2–3.4 s/题，影响 4,373 张材料题页，Yandex 已在抓）；资料分析拉题 `grouped_ziliao_questions` 选材料 GROUP BY 回表 4,698 行（2.2 s 冷）。25 s 长尾 503 同秒命中 `/robots.txt`，宿主 sar 同刻 iowait 64–76%/swap 2,800 页/s → 宿主级，非应用 SQL（第 5 次上报）。首页 `curl /` 原始 HTML 0 个 `<a href>`，10.9 万 `/tiku/*` 只靠 sitemap 被发现。
- 方案：部分索引 `idx_q_material(material_hash, disabled, module) WHERE material_hash IS NOT NULL`（4,373 行）；**无统计信息下两处查询要配合改写**否则规划器不选它：SEO 查询去 `ORDER BY id` 改 Python 排（否则为免排序选 `(disabled,id)` 索引）、选材料 `INDEXED BY idx_q_material`（COVERING）+ `OperationalError` 回退。`index.html` `#app` 后加 `<nav id="kg-seo-nav">` 9 条 `/tiku/*` 入链，`#app:not(:empty)~#kg-seo-nav{display:none}` 挂载后隐藏、挂载前 splash 盖住。详见 docs/iter/round-3/r381-material-index-seo-nav.md。
- 验证结果：本地 pytest 359 / ruff / pyright 0 / vitest 540 / eslint / build:h5 全绿（`test_answer_log_client_ts` 1 例为 CST 零点附近时间片 flake，main 上同样失败）。生产 rev 4d676b0：三条 `EXPLAIN` 全命中 `idx_q_material`；hash 未命中查询 3.4 s → 0.000 s、选材料 2.2 s → 0.053 s、`/tiku/q/297391` 冷 0.030 s、`/api/questions?module=ziliao&grouped=1` 冷 0.517 s → 0.016 s；`curl /` 出现 9 条 `<a href="/tiku/…">`。testing agent 1440/375 全过（CDP 暂停 bundle 断言挂载前 nav 被 splash 盖住/挂载后 display:none、nav 相关 layout shift 0、资料分析同材料 5+5 连续出题带 1/5…5/5、SSR 297391 同材料组 5 题 + pick 深链 seo_q 落库、言语/错题本回归、58 个 /api 全 200、容器 0 重启、清理 LEFTOVER 0、questions 156792）。复验评论 https://github.com/wookat/kaogong-assistant/pull/599#issuecomment-5543864082 。
- 复验观察 → 收口 PR 已加固：挂载前 nav 在正常流占高（1440≈57px/375≈82px）使 splash 期文档可滚动（splash fixed 仍盖住，未见暴露）；收口改为 `position:absolute;top:0` 且 DOM 放在 splash 之前（splash 后绘盖住），不再占位。
- 未在生产验证：`INDEXED BY` 索引缺失回退分支（生产索引存在）、grouped 空组分支；「导航任何滚动位置绝对不可见」只做了观察 + 加固，非穷举证明。
- 搜索分发口径不变：Google 仍只抓 sitemap（题目页 0）、Bing 7 / Yandex 87 次题目页抓取（09-02–09-04），真人 `seo_q` 0；入链是给引擎一条可爬路径，**不等于**收录/排名。
- R382 候选：① 宿主 IO 饱和是 crawler 长尾 503 的根因，应用侧能做的下一档是把 `/tiku/*` SSR 层挪到边缘（预渲染到 R2/KV，Worker 直出、源站只做回源兜底），彻底摆脱共宿 IO；② 继续核对 Googlebot 是否进入 `/tiku/q/*`（首页入链后 3–7 天再看）；③ 真人资料分析拉题耗时（`slow-req` 里 `/api/exam/papers` 10.5 s、`tag3=CS-LS-01` 4.0 s 值得下一轮取证）。

### R382 `/api/papers` 覆盖索引 + 日报真人口径（2026-09-04，分支 devin/*-r382-paper-index-human-traffic，base=main）
- 取证：R381 候选①「SSR 挪边缘」不做——近 3 天 5xx 1,707 条中 1,599 条来自探针网段 `140.232.64.4/.5`，其余为 GPTBot/ClaudeBot/扫描器；**剔探针 + 通用 bot UA 后候选真人 `/api/` 52 条、5xx 0**；CF Pages Functions 已有 60 s API TTL + SWR/SIE + 重试，不重复建缓存。候选② Googlebot 仍只抓 sitemap（`/tiku/q/*` 0），`/tiku/q/*` 流量主体是 GPTBot 11.3 万 / Yandex 2,028，不能计入搜索分发。候选③ 真命中：`/api/papers`（公开 allowlist、卷库首屏必打）走 `idx_q_real_year` 回表 24,558 行，生产库副本冷读 **78.6 MB**，共宿 iowait 44–76% 下即长尾。Cloudflare 三枚 token 均缺 `zone.analytics.read`，边缘 HIT/MISS 未取得（`X-Kg-Fetch` 只证明回源模式）。
- 方案：部分覆盖索引 `idx_q_paper_src(is_real, disabled, source, exam_year, exam_region) WHERE is_real=1`（COVERING，副本实测 78.6 MB → 0 MB、结果集一致）；`crawler_stats.py` 增 `humans{api,api5xx,page,ips}` 段（探针网段 → 引擎 UA → `BOT_GENERIC`/空 UA → `uid=test-|probe` 逐层剔除，IP 只出日去重数量）→ `ops_status.crawlers.humans` → 看板「搜索引擎抓取」面板顶部「真人」行（标注剔除口径；旧 JSON 无该段时提示等 cron）。详见 docs/iter/round-3/r382-paper-index-human-traffic.md。
- 本地：pytest 363 / ruff / pyright 0；前端零改动复用 R381 bundle。生产归档试跑（`/tmp`，不覆盖 cron 产物）：候选真人 API 09-01 5 / 09-02 48 / 09-03 2 / 09-04 1，5xx 0，日去重 IP 2–5。
- 未做/留档：`/api/exam/papers` 10.5 s 的 `list_exam_papers()+exam_paper_filters()` 组合与 `tag3=CS-LS-01` 4.0 s 留 R383 取证；`/api/comments/count`、`/api/notes` 表结构未核；宿主 IO 争用第 6 次上报。

### R404 W5 设计系统 foundation：tokens 一源多端 + 基础/复合组件层（2026-09-06，分支 devin/1788657430-w5-design-foundation，base=main，含 devin/w5-design-spec 的 docs/design-system/）
- 落地口径：`docs/design-system/SPEC.md` 的 raw→semantic→component 三层 token 只认一个源 `tools/design-tokens/tokens.json`（DTCG `$type/$value` + 自定义 `$dark`，113 个 token），`tools/design-tokens/build.mjs`（零依赖，Node ≥20）生成 6 个文件：H5 `src/styles/tokens.generated.{scss,css}`、小程序 `miniprogram/styles/tokens.generated.wxss`、`src/module-meta.js` / `miniprogram/utils/module-meta.ts`（模块色/图标/名称单一来源，替代 4 份 COLORS）、`miniprogram/components/l-icon/paths.ts`（从 H5 `l-icon/paths.js` 同步 Lucide 路径）。`--check` 做对比度（brand/status 文字 ≥4.5:1）、字阶/间距/圆角/字重白名单与幂等校验，已接进两端 `npm run lint`。不用 Style Dictionary 的理由见 SPEC §7（3 个自定义 transform，收益不抵）。
- 接入点只有 3 行 import：`uni.scss`（`@import '@/styles/tokens.generated.scss'`，`$uni-*` 改指 `$brand/$ink/...`）、`App.vue`（`@import './styles/tokens.generated.css'`）、`app.wxss`（`@import './styles/tokens.generated.wxss'`）。H5 同时出 `page` 与 `:root` 两份（uni-h5 把 page 编成 `uni-page-body`，tabbar/page-head 壳在其外层读不到）；深色选择器 `.theme-dark uni-page-body, html.theme-dark`。旧变量名（H5 `--brand-500/--t3/--surface` 等 13 个、小程序 44 个）在生成文件里保留 `/* deprecated */` compat 段，页面组接入完删。回滚 = 删 import 行。
- 组件层（只加共享层，未改任何业务页）：H5 `src/components/kg-*` 21 个（button/tag/chip-row/card/empty-state/skeleton/sheet/section-header/progress/banner/action-bar/question-card/option-group/analysis-card/module-card/stat-row/stat-card/hero-card/streak-badges/two-col/invite-input），薄封装 wd-button/wd-tag/wd-popup/wd-skeleton，自研仅限库不满足的（选项 7 态、横滚 chip、固定底栏、双栏）；小程序 `components/kg-*` 9 个 + `l-icon`（TDesign 封装同口径）。纯逻辑抽成可测模块：`option-state.js`（7 态 + 多选 toggle）、`icon-tone.js`（tone→语义色、16/20/24/32 尺寸、mask/base64 两种渲染）、`toast.js` / `utils/toast.ts`（成功 1.5s / 提示 2s / 错误 2.5s 固定、去尾标点，继续 uni/wx.showToast 不引 wd-toast）。`l-icon` 加 `tone` 语义色，`color` 保留为 deprecated 兼容路径。`export-confirm/predict-card/q-social-bar/rank-card` 只 token 化不改 props。新增 `--prog-track` 修 3 处深色进度槽漏网。
- 门禁：`tools/design-tokens/lint-pages.mjs` 拦裸 hex/rgb、非 token 字号、700+ 字重、`word-break:break-all`；共享层 = error（当前 0），存量 47 个页面文件 2110 处 = warn，页面组交付时加 `--strict` 转 error；`--file=<子串>` 单文件排查。
- 总览页：H5 开发路由 `#/pkgA/dev/design`（pkgA 分包，不入 tabBar），12 区展示全部语义 token 与 Kg* 组件状态，可切浅/深色；生产 bundle 本地实跑截图（430 宽浅/深 + 1280 桌面）已附 PR。
- 本地：H5 `npm run lint` / vitest 66 文件 560 用例（新增 5 文件 20 用例，含 `kg-components-scope.test.js` 防 kg-* 根类撞名）/ `build:h5` DONE（Node 22.23.2；Node 20 会 ERR_REQUIRE_ESM）；小程序 `tsc --noEmit` / eslint 0；`build.mjs --check` 113 tokens 6 文件一致。
- 浏览器回归（Chrome CDP，本地 build:h5 bundle，430/1280；业务数据经本地同源 `/api/*` 反代取生产、只读）：总览页 + home/practice/stats/profile/book 走查无样式回归；修掉 2 个组件 bug——`KgActionBar` 与 `KgProgress` 同用 `.kg-bar` 根类，父 scoped 选择器命中嵌套进度条使其 fixed 盖住按钮（改 `.kg-abar`）；`KgSheet` 深色白底（wd-popup 写死 `#fff`，`custom-class` 挂非根节点拿不到组件 scope 属性，CSS 覆盖命不中，改 `custom-style` 内联 `--card`，复验 computed background=rgb(29,31,40)）。观察到 `removeTabBarBadge:fail not TabBar page` rejection 来自 home/book/ask 存量路径，未处理。合并 main 时 R383 字阶偶数化（rpx）与本轮 token 化在 export-confirm/q-social-bar/navbar 冲突，取 token 侧（`var(--fs-*)`），navbar 保留 main 的标题单行省略。
- 未做/留档：① `KgPaperCard`、`KgReportSection` 未在 foundation 实现——两者是 KgCard+KgTag+KgButton+KgSheet / KgSectionHeader+KgProgress 的组合，且依赖 exam/report 页的数据形状（`exam-mod-avg.js`、答题卡数据），留给 exam/report 页面组随页迁移一起落；② Flutter `theme.dart` 生成为阶段 2；③ stylelint 未引入，裸值门禁先由 lint-pages 承担；④ 小程序 `pages/**` 44 个 compat 别名仍在用，删除时机 = 小程序页面组交付；⑤ wot-design-uni 1.14 的 Sass 全局内建函数 deprecation 警告与 vite `src/api.js` 动态/静态混引警告为存量，非本轮引入。

### R383 UI/组件/排版专项：字阶偶数化 + 卷库操作区层级/分批挂载 + 我的页 cell 标题不折行（2026-09-05，分支 devin/*-ui-type-scale，base=main）
- 取证：生产 H5 14 路由 × light/dark 28 张真机口径截图（390×844 @2x）+ 静态扫描：H5 38 个 .vue 有 30 种 `font-size`、36 种圆角、131 种色值；小程序 17 个 wxss 有 24 种字号。奇数 rpx（19/21/23/25/27/29）在 375 宽下落到 .5px 亚像素，同一行文字在不同机型渲染灰度不一，且与 `uni.scss` 字阶 token（22/26/30/34）错位。`pkgA/exam/list` 120 张卷一次性渲染整页 43k px（DOM 480+ 卡片节点），每卷 4 个同权重描边药丸按钮；`pages/profile` wot `wd-cell` 左右各 `flex:1`，9 字标题被挤成两行。
- 方案（只动样式块，不动业务）：① 脚本把 H5 .vue `<style>` 与小程序 .wxss 中奇数 rpx 字号统一上取偶数（360 处：23→24 94、25→26 91、21→22 74、27→28 65、29→30 28、19→20 8），`font-weight: 800` 85 处**保留**（v2 设计稿 hero 数字有意用 800）；`font-size.js` 选项字号 25/29/33 → 24/28/32（题干 26/30/34 减 2rpx，同一口径），对应 vitest 期望值同步。② 卷库：`paged = shown.slice(0, visibleN)`（PAGE 20），底部「展开更多（还有 N 卷）」+ `onReachBottom` 自动追加；切筛选重置；深链 `pid` 命中第 idx 张时 `visibleN = idx+1` 保证定位可见。操作区一主多次：主按钮 `flex:1.5` 实底，次按钮 `--brand-soft` 浅底无边框。③ 我的页 `:deep(.cellcard .wd-cell__left){flex:0 0 auto;max-width:62%}`，标题 nowrap、值单行省略。
- 本地：vitest 540 / eslint / build:h5（需 Node 22，lock 里 nanoid 6 只支持 ^22；系统默认 Node 20 会 ERR_REQUIRE_ESM，用 `~/.nvm/versions/node/v22.12.0`）/ 小程序 tsc+eslint 0。本地 dist + 生产 API 代理实跑：10 路由 375/1440 无横向溢出；卷库首屏 43k→7.5k px、展开更多 20→40→滚动到底 60、`?pid=112`（第 120 张）定位成功；我的页 cell 标题单行。
- 未做/留档：小程序 wxss 改动只做 tsc/eslint，未在开发者工具模拟器回归（登录态需扫码）；131 种色值/36 种圆角收敛到 token 留下一轮（需逐页语义判断，不适合脚本）；深色模式逐页对比度复核未做。

### R403 生产盘清理（2026-09-05 纯 ops，老板指令「清理旧备份腾空间」）
- 现状：VM-0-8-ubuntu 50G 根盘 43G/97%→清理后 42G/88%（余 5.9G）。大头不是备份：containerd 9.3G、docker 卷 13.4G（recruit_app_pgdata 8.6G、kaogong-data 2.0G、softcopyright 2.0G）、镜像 7.2G（nyc-ticket-odds-web 3.57G）。
- 删除（均有更新副本覆盖，先核对 R2 `zalize-backups/kaogong-sqlite` 08-27～09-05 十份字节数与本地一致后才删）：本地日备 data-2026-08-30/31、09-01/02（≈580M）；一次性旧快照 /home/ubuntu/snap_r42.db（08-10）+ snap.db.gz（08-05）≈442M；容器 /data 内 bak-r348.gz / bak-w2.gz / r396-before.gz（≈515M，各步 ids 台账在仓库）；docker build cache 676M。保留：bak-w3.gz（PR #620 审计依据）、r400/r401-before.gz、r402-before（并行会话进行中）。
- 长效：deploy/kaogong-ops.sh 本地日备保留 7→3 份（30 天历史在 R2，每周日 R2-VERIFY 独立校验），宿主 /home/ubuntu/kaogong-ops.sh 已同步（md5 一致）。
- 未做：recruit pgdata 8.6G / nyc 镜像 3.57G 属其他产品不动；主机 2G 内存 + iowait 80% 的结构性瓶颈仍建议扩容或分机。
- R382 验证结果（#601 已合入 main，rev 77230f2，bundle 不变）：生产 `EXPLAIN` 命中 `COVERING INDEX idx_q_paper_src`；testing agent 1440/375 全过（卷库 120 卷 = `/api/exam/papers` items、按卷练习 2 题退出保留进度 → 首页续练卡、言语 5 题回归、管理台「真人」行 = `ops_status.crawlers.humans`、375 无横向溢出、/api 全 200、容器 0 重启、清理 LEFTOVER 0、questions 156792）。复验评论 https://github.com/wookat/kaogong-assistant/pull/601#issuecomment-5544588011 。
- **复验修正一条事实**：H5 卷库打的是 `/api/exam/papers?kind=zhenti`，`/api/papers` 只剩小程序 `fetchPapers()` 与部署预热在用（近 4 天 507 次里 329 次探针、真人 1 次）——R382 索引对 H5 用户无直接收益，H5 热路径在 R383 补。观察项：375 管理台「真人」行 `.lb` 被挤成逐字竖排（无横向溢出）、`/api/admin/stats` 首访 13.7 s（slow-req）、言语拉题一次 4.6 s（宿主 iowait 45%）。

### R383 卷库 `/api/exam/papers` 覆盖索引 + 管理台 stats 部分索引 + 爬虫面板窄屏换行（2026-09-04，分支 devin/*-r383-exam-papers-covering，base=main）
- 取证：源站归档 09-01–09-04 `/api/exam/papers` 906 次 **p50 0.06 s / p90 2.63 s / >2 s 98 次 / 5xx 47**（含探针窗口）；`_list_exam_papers_base()` 把最近 200 卷 12,532 个 qid 分批 `WHERE disabled=0 AND id IN (...)` 按主键回表——生产库副本冷读 **85 MB**（`list_exam_papers` 全路径）。`/api/admin/stats` 首访 13.7 s：`hs_done`/`hs_down_total` 两个 COUNT 各 `SCAN questions` **264 MB** 宽行（hs_explanation 在行内），`_prime_admin_caches` 预热也走同一路径（即 R373 记的「预热 252 MB 全表扫」）。生产库无 `sqlite_stat1`，规划器纯启发式：`(id, is_real, source) WHERE disabled=0` 部分索引不会被选（仍走 rowid），**`(disabled, id, is_real, source)` 全索引会被自动选为 COVERING**，无需 `INDEXED BY`。
- 方案：`idx_q_active_src(disabled, id, is_real, source)`（1,034 页 ≈ 4 MB，副本实测 `list_exam_papers` 冷读 85 MB → 2.5 MB、结果集逐行一致）；顺手 `DROP idx_q_disabled_id`（是 `idx_q_sitemap(disabled,id,updated_at)` 的前缀，纯冗余）；部分索引 `idx_q_hs_done(id) WHERE hs_explanation IS NOT NULL AND hs_explanation!=''`（362 页）+ `idx_q_hs_down(id) WHERE hs_down>0`（1 页），`_admin_stats_uncached` 冷读 223 MB → 71 MB（剩余为 mmap 预读 + `by_module`/`total` 覆盖扫）。SQL 一字不改，仅加索引。爬虫面板行加 `.hbar-wrap`（flex-wrap，`.lb` 基准 150px，tag 不可压缩且可换行）修 375 逐字竖排。
- 未做：`exam_attempts` 全局聚合（38 行，无需索引）；`tag3=CS-LS-01` 已走 `idx_q_disabled_tag3_upd`（4.0 s 那次归宿主 IO）；ANALYZE 生产库（会改所有查询计划，需单独一轮评估）。
- R383 验证结果（PR #602，生产 rev 1c2dea6，18:19Z 部署，bundle 不变）：容器内核实三索引存在 / `idx_q_disabled_id` 已删 / 两条 EXPLAIN 命中；容器内 `list_exam_papers(kind="zhenti")` 0.023 s / 0.4 MB、`_admin_stats_uncached()` 0.33 s / 43.9 MB（部署前副本 85 MB / 223 MB）。testing agent 1440/375 全过：卷库 `/api/exam/papers` 200（1440 572 ms / 375 927 ms，经 CF `DYNAMIC`）items 120 = 卡 120；按卷作答 2 题 → 退出保留进度 → 首页续练卡 → 去继续回第 3 题；375 管理台「真人」`.lb` 255×19 单行（R382 时 316px 高逐字竖排）、tag 换行、scrollWidth 375、1440 无劣化；console 0、/api 全 200、容器 0 重启、清理 LEFTOVER 0、questions 156792。复验评论 https://github.com/wookat/kaogong-assistant/pull/602#issuecomment-5545016188 。
- 复验观察（R384 候选）：① `/api/admin/dashboard` 管理员首访 **11.5 s**（`X-Kg-Cache: cold`，slow-req 11.3 s）、`ops_status` 2.5 s、`llm_health` 3.5 s——管理台冷启动瓶颈已从 stats 转到 dashboard，登录页停在「验证中…」；② 375「运维状态」面板未加 `.hbar-wrap` 的行（每日备份上传 R2 / R2 副本周验证 / 宿主内存水位）`.lb` 被挤到 43–49 px 日期折 3 行（非逐字），同法可修；③ `/api/exam/papers` 不带 `X-Kg-Cache` 头（只有 admin 三接口带），端到端冷/热无法从响应区分；④ 部署预热 `tag3=CS-LS-01` 5.6 s（slow-req 5.3 s）宿主 IO 尖峰再现（第 7 次）。

### R384 管理台 dashboard 首访 11 s 根因修复 + 运维状态/LLM 行窄屏换行（2026-09-04，分支 devin/*-r384-dashboard-flagged-index，base=main，含 #602 提交）
- 取证：R383 复验 `/api/admin/dashboard` 首访 11.5 s（`X-Kg-Cache: cold`，slow-req 11.3 s）。生产库副本逐子查询 drop_caches 冷读：`flagged` **237.5 MB / 0.209 s**，其余 14 条合计 11 MB——`hs_down>0 AND (disabled IS NULL OR disabled=0)` 被规划成 `MULTI-INDEX OR`（`idx_q_sitemap`+`idx_q_active_src` 按 disabled=0 取全部 ~109k 活跃题）再逐行回宽行表读 `hs_down`，R383 的 `idx_q_hs_down` 部分索引（1 页）因 OR 形式未被选。R383 前 INDEX 2 是 `idx_q_disabled_id`，成本相同，非 R383 引入。生产 `disabled IS NULL` 0 行、`hs_down>0` 1 行。
- 方案：仅把该 COUNT 改写为 `COALESCE(disabled,0)=0`（语义相同）→ `SCAN USING INDEX idx_q_hs_down`，副本冷读 237.5 MB → **0.0 MB**；不加索引/不改 TTL/不用 `INDEXED BY`（免回退分支）。`dashboard.js` 运维状态 6 类行 + LLM 通道行改用 R383 的 `.hbar-wrap`。单测断言计划 + 新旧写法结果一致。详见 docs/iter/round-3/r384-dashboard-flagged-index.md。
- 未做：`governance_scan` 全表内容校验（只在治理页触发）、`llm_health` 3.5 s 为外部探活、ANALYZE、`/api/exam/papers` 的 `X-Kg-Cache`。
- R384 验证结果（PR #603，生产 rev 36718fc，18:52Z 部署，bundle 不变）：容器内 `EXPLAIN` → `SCAN questions USING INDEX idx_q_hs_down`（旧写法仍 MULTI-INDEX OR）；`_admin_dashboard_uncached()` 直测 0.289 s / 39.4 MB。testing agent 在冷缓存窗口（容器启动后 313 s、日志确认此前 0 次 `/api/admin/*`）首访：`/api/admin/dashboard` **306 ms**（`X-Kg-Cache: cold`，R383 时 11,529 ms）、stats 688 ms cold、ops_status 226 ms、llm_health 533 ms，登录后约 1 s 出看板、不再停「验证中…」；375「运维状态」/「LLM 通道」各行 `.lb` 172–255×19 px 单行（R383 时 43–49 px 宽日期折 3 行）、tag 换行、scrollWidth 375；1440 12 行全 21 px 高无劣化；看板 flagged 0 = API；1440/375 言语 3 题 → 退出保留 → 首页续练卡 3/10 全过，/api 全 200、console 0、5xx 0、容器 0 重启、清理 LEFTOVER 0、questions 156792。复验评论 https://github.com/wookat/kaogong-assistant/pull/603#issuecomment-5545304691 。
- 未在生产验证：生产 `hs_down>0` 活跃题为 0，新旧谓词等价只由单测（活跃/下线各 1 题）与代码推断背书，未在生产以非零值对账；「无记录」`tag-gray` 分支线上不出现；`ops_status`/`llm_health` 不带 `X-Kg-Cache`（本就未接缓存）。
- R385 候选：① `governance_scan` 治理页首访冷 miss 全表三遍扫（~264 MB），测量治理页首访耗时后决定是否流式/分页；② `tag3=CS-LS-01` 部署预热 3.8–5.6 s 连续 3 轮出现（已走 `idx_q_disabled_tag3_upd`，需核实是回表宽行还是宿主 IO）；③ 真人数据积累后回到错题本功能差距（错因标注/知识点聚合外显）。

### R385 `tag3+module` 拉题抽题池回表 147 MB → `idx_q_tag3_pick` 补 module 成覆盖索引（2026-09-04，分支 devin/*-r385-tag3-pick-covering，base=main，含 #602/#603 提交）
- 取证：R382–R384 部署预热 `GET /api/questions?limit=10&tag3=CS-LS-01&module=changshi` 三轮 slow-req 4.0/5.6/3.8 s，此前归宿主 IO 未核实读量。生产库副本 drop_caches 冷读：`_pick_pools(changshi, CS-LS-01)` 冷 miss **147.5 MB / 0.096 s**（其后抽题 1.5 MB）——`_pick_scan` 的 `INDEXED BY idx_q_tag3_pick(tag3, disabled, is_real, has_hs, id)` 不含 `module`，前端总是同时带 module，EXPLAIN 为 SEARCH（非 COVERING）→ 9,038 行逐行回宽行表校验 module；只带 tag3 时 0 MB。源站归档 08-09→09-04 该形态 430 次（p90 2.1–10.1 s，>2 s 58 次）**无候选真人**（397 探针/bot，33 来自一台 AWS IP），但它是 R378/R379 SEO CTA 与薄弱考点强化的落地路径。同批剖析 `governance_scan` 冷 308.8 MB / 1.19 s、warm 0.76 s（内容校验，非索引问题）。
- 方案：索引改 `(tag3, disabled, module, is_real, has_hs, id)`，`init_db` 见旧定义（sqlite_master SQL 不含 module）则 DROP 重建（副本 0.54 s）；SQL 一字不改，`INDEXED BY` 三处名字不变。副本实测 `_pick_scan(changshi, CS-LS-01)` **147.5 MB → 1.0 MB**、四层池行数一致；只带 tag3/uid 补足路径计划不变。单测 2 例（覆盖计划 + 旧定义重建）。详见 docs/iter/round-3/r385-tag3-pick-covering.md。
- 未做：`governance_scan`（需物化/增量，改架构单独一轮）、冗余前缀 `idx_q_tag3_disabled` 不删、ANALYZE。
- R385 验证结果（PR #604，生产 rev ddd0e33，19:23Z 部署，bundle 不变）：容器内 sqlite_master 新定义 + EXPLAIN `USING COVERING INDEX idx_q_tag3_pick`；`_pick_scan` 直测 `CS-LS-01/changshi` 9,038 行 **0.075 s / 1.3 MB**（部署前副本 147.5 MB）、`PD-DY-01` 0.079 s、`SL-JS-01` 0.098 s / 0.8 MB；部署预热 `tag3=CS-LS-01` **0.24 s**（R382–R384 为 4.0/5.6/3.8 s），日志 tag3 相关 slow-req **0 条**。testing agent 1440/375：SEO 题目页 → 原生 CTA → `qid&tag3&module&source=seo_q` 深链 → 领跑题即所读题 `1/11` → 作答 3 题 → 保留 → 首页「已做 3/11」→ 去继续 `4/11` 计数保留，两视口全过、375 `iw=cw=sw=375`；回归 言语 3 题 262 ms、卷库 120 卷 = API、错题本、管理台 UI = API；/api 54 次全 200、console 0 error、日志 5xx 0（唯一 slow-req 3.3 s `llm_health`）、容器 0 重启 OOM false、LEFTOVER 0、questions 156792。复验评论 https://github.com/wookat/kaogong-assistant/pull/604#issuecomment-5545786056 。
- R385 未通过/未验证：**第二冷样本 `tag3=PD-DY-01&module=panduan` 客户端 5,069 ms**（计划阈值 3.8 s）——服务端无 slow-req（阈值 3.0 s）、容器内同条件 SQL 0.079 s，同刻宿主 iowait 81–88% / swap 2.7 GiB / mem_avail 496 MiB，指向宿主 IO 争用（第 8 次上报），但本轮未取得达标的第二冷样本，需宿主空闲时复采；同条件 old/new A/B 不可得（旧索引启动即被 DROP，R383/R384 的 3.8–5.6 s 只作历史参照）；同窗口 `/api/profile`/`home_bundle`/`exam/resume` 也 1–1.7 s，生产整体延迟偏高属宿主级。
- R386 候选：① 宿主 IO/内存争用第 8 次——共宿容器限资源仍是根因侧解法，应用侧可考虑把 `_pick_pools` 池按 tag3 预构建/持久化以免任何 tag3 首访都读盘；② `governance_scan` 冷 308.8 MB 物化增量；③ 真人数据积累后回到错题本错因标注/知识点聚合差距。

### R386 SOP-10 四维审计 + 探针归因去单点（`X-Kg-Probe` 头 / 自动化 UA）+ 看板口径起点外显（2026-09-04，分支 devin/*-r386-probe-request，base=main）
- 取证（09-04 至 09-05 04:20Z 一手证据）：源站全量 `/api` 日志用 `X-Kg-Ip`/`X-Kg-Ua` 归真实端后剔探针网段/引擎/bot/扫描器/test uid 剩 2,922 行、34 个 IP×日会话，其中大会话全在 AWS `54.69.238.189`/`54.201.200.193`（UA `Python-urllib/3.10|3.12` 与模拟 Chrome/iPhone，调 `admin/stats`、`share/create`、`exam/start` 等）= 旧出口的内部自动化，**不是真人**；网段打标只覆盖当前出口，出口一换历史整月流量就混入「真人」（单点）。可信设备形态仅 vivo `V2405A` 小程序（`39.158.40.85`，作答/分享 200）与 iPhone Safari（首页 13 s 后离开），均不能证明是外部用户。`mistakes` 243 行仅 6 行有 `error_reason`（概念不清 3/方法不会 2/粗心 1）、`review_log` 30 行 5 uid → 错因/知识点聚合无数据支撑不做。IndexNow 已存在（`seo/sitefiles.py` 后台线程 + `scripts/indexnow_submit.py`，生产 `indexnow_last_qid=6525883` 已覆盖活跃 id 上限 1482630，key 文件 200）不重建。近 3 日 5xx 1,702 条全在探针/扫描器/bot；Google 仍只抓 sitemap/robots（17 次），Yandex 189/Bing 60 进 `/tiku/*`。origin 403 34 条为 `.git/config`/`xmlrpc.php`/`wp-login.php` 扫描（含伪装 iPhone UA 的 `3.238.133.204`），非用户被拒。
- 方案：`auth.probe_request(request)` 三路任一 → 探针：显式 `X-Kg-Probe: 1`（不依赖 `KG_PROBE_CIDRS`，边缘 `[[path]].js` `new Request(..., request)` 原样复制头无需改）→ 网段 `probe_ip` → `PROBE_UA_MARKERS`（python-urllib/python-requests/curl//wget//headlesschrome/playwright/httpx//go-http-client，不含普通 Linux Chrome/iPhone UA）。六处入库点（`study_api.answer_log`、`team.track`/卷答、`exam_api` 三处）从 `probe_ip` 切到 `probe_request`；`_admin_dashboard_uncached` 新增 `probe_since = MIN(created_at) WHERE probe IS NOT NULL`，看板副标题外显「探针口径自 YYYY/M/D 起生效，此前行无法区分、按真人计」。历史行不回填、不按 UA 反推真人数。单测 +4（三路/反例、track 头+UA 无网段配置、answer_log 头、probe_since 空/首条）。详见 docs/iter/round-3/r386-sop10-audit-probe-robustness.md。
- 未做：`_pick_pools` 预构建、`governance_scan` 物化、错因/知识点聚合、小程序 `home_bundle`、百度推送桩、IndexNow 重建。
- R386 验证结果（PR #605，生产 rev 81481f1，20:30Z 部署，bundle 不变）：三路隔离样本经 CF 域 `/api/track` 容器内读回——网段内 iPhone UA+显式头 1 / `python-requests` UA 1 / 仅网段 1；**网段外 VPS 出口 150.109.230.174** 真人 UA 无头 **0**（反例）、加 `X-Kg-Probe: 1` **1**（仅显式头路径成立，边缘 `[[path]].js` 零改动透传）。testing agent 1440/375：看板副标题精确句「探针口径自 2026/9/4 起生效，此前行无法区分、按真人计」与 `probe_since=1788514334.60` 页内格式化一致、KPI=API、375 `iw=cw=sw=375` `.sub` 折 4 行非逐字；言语 3 题 → 保留 → 首页 3/10 → 去继续 4/10（两视口）、answer_log 6 行 probe=1、卷库 120=API、错题本 200；CDP 显式头会话 `requestWillBeSentExtraInfo` 证实浏览器发出头 → probe=1；日志 2142 行 5xx 0 / slow-req 0 / traceback 0、容器 0 重启；清理 22 行 LEFTOVER 0、questions 156792。复验评论 https://github.com/wookat/kaogong-assistant/pull/605#issuecomment-5546440361 。
- R386 未验证：UA 签名路径只在 `/api/track` 实测，`answer_log`/卷答/exam 三处仅单测 + 同函数背书；`probe_since=None` 看板分支线上不出现（仅单测）；仍无可确认的外部真人（vivo 小程序 / iPhone Safari 会话只证明设备形态）。
- R387 候选：① 分发侧——Google 仍只抓 sitemap/robots，`/tiku/q/*` 0 次（Yandex 189 / Bing 60 已进），核对 GSC 覆盖率/索引状态而非再改代码；② 首页 13 s 后离开的 iPhone Safari 会话提示首屏耗时，取客户端 RUM（`/api/track` 已有 boot 事件可加 `ttfb/lcp` 字段）后再决定是否优化；③ 宿主 IO 争用第 9 次——共宿容器限资源仍是根因侧解法；④ 错因/知识点聚合继续等干净真人数据。

### R387 首访 RUM 逐条归因（不加埋点）+ 大陆可达性一手证据 + 入口路由分包 head 预加载（2026-09-04，分支 devin/*-r387-route-preload，base=main）
- 取证（09-04 20:30–21:30Z）：近 30 天 58 条非探针 `slow_load` 逐条归因——35 条 `nav` 60–90 s 整超时值全在 08-29 18:23~08-30 07:43（R372 取证的进程换出→上游超时机制）、5 行 20,000 ms 客户端超时与 2 条 TTFB 17/26 s 均为 Linux X11 Chrome 内部走查 uid、4 条 hb-gap 是页面挂起、9 条 API 单次 10–45 s 与 2 条 nav 14/33 s 全在 R372 前，唯一像弱网真人的是 08-31 `wd-icon.js:13025`（单样本、UA 截断、0 作答）；**最晚一条 09-03 16:30Z，全部早于 R372 部署 09-04 06:53Z，R372 后 `slow_load` 0 条、`boot` 7 条全 probe=1**。现有 RUM 字段（nav/ttfb/dom/load/sw/tx/最慢资源/版本/UA）够归因 → **R386 候选②「加 RUM 字段」不做**。生产域冷启动瀑布（Playwright/CDP、探针头、375）：无节流 TTFB 100 / FCP 164 / load 233 ms，首页分包 18 依赖与 8 个 API 各自并发（无串行瀑布）；节流 RTT 350 ms / 2 Mbps 后「首个 API 发出」1,653 ms，其中「等 `index.js` 下载执行完才发现分包」这一串行段 750 ms。ChinaZ 31 节点：CF 边缘域 8 节点失败、平均 1.511 s，DNS 0.45–1.5 s（粉笔 0.06–0.2 s）、连接 0.15–0.28 s（美西边缘）；origin 域 8 失败且多 403（源站拒探测）；粉笔同批 3 失败。`WX_MINIAPP_SECRET` 仍未配（`wxlogin` 503、`users` 16 行 0 个 `wx:`）。
- 方案（只改 `frontend-uni/`，bundle hash 不变）：新增构建后处理 `scripts/route-preload.mjs`（`build:h5` 在 `inline-critical-css` 后、`gen-precache-manifest` 前执行）：解析产物 `index-*.js` 的 `__vite__mapDeps.viteFileDeps` 与各路由 `import("./pages-*.js"),__vite__mapDeps([...])`，只取入口白名单 `pages/home/home`（默认）、`pages/practice/practice`（SEO CTA/分享落地）、`pages/book/book`、`pages/team/join`，注入 `<script data-kg-route-preload>` 到入口 module script 之前：按 `location.hash` 选路由 → JS `<link rel=modulepreload as=script crossorigin>`、CSS `<link rel=preload as=style>`（不用 stylesheet 免阻塞 splash 首绘）；Vite `__vitePreload` 见同 href link 跳过重复请求。产物结构变化直接抛错使构建失败；幂等。HTML gzip +794 B。本地同生产资产 A/B（只换 HTML）：首个 API 发出 RTT200/4M 913→676 ms、RTT350/2M 1,653→1,230 ms（−26%），请求数 56=56 无重复、console 0。vitest +5。详见 docs/iter/round-3/r387-route-preload-rum-audit.md。
- 未做：`main.js` RUM 加字段、`/api/home_bundle` 再聚合（已是聚合且并发）、小程序（无密钥）、边缘函数（`/` 本就不走 Functions）、GSC/百度侧代码。
- **资源缺口（需老板）**：大陆可达性——代码侧已到极限（HTML 12 KB、splash 内联、静态资源边缘 HIT、串行往返本轮再减一段），下一档必须 **ICP 备案 → 国内 CDN/回源或至少国内 DNS**；无备案任何国内 CDN 不接。列入资源缺口清单持续跟踪，不做代码桩。
- R387 验证结果（PR #606，生产 rev 47bb705，21:47Z 部署，bundle 不变、仅 index.html）：部署脚本 Lighthouse `/` 0.99 / `/tiku/` 1.00。作者生产同条件节流 A/B（同一生产 HTML，STRIP 变体只剥掉注入脚本；RTT 350 ms / 2 Mbps ×3 中位数）：首页分包开始 925→48 ms、**首个 API 发出 1,694→1,263 ms（−25%）**、最后 API 完成 2,197→1,795（−18%）、FCP 同为 72 ms。testing agent 1440/375（CDP 冷加载 + MutationObserver 区分入口前注入）：`/` 入口前 link 18 = M[home]、practice 深链 16 条且 0 条 home、stats 入口前 0（无误注入）；`pages-home-home` 开始 47/40 ms < index 完成 85/100 ms（并行）；请求 56==56 无重复、preload 警告 0、console/pageerror 0；言语 3 题→保留→续练 4/10、SEO CTA 领跑题、卷库 120=API、错题本 200、375 `cw=sw=375`；`/api` 151 次全 200、日志 2152 行 5xx/traceback/slow-req 0、容器 0 重启、清理 LEFTOVER 0、questions 156792；独立 Lighthouse 移动档 0.92。复验评论 https://github.com/wookat/kaogong-assistant/pull/606#issuecomment-5547130541 。
- R387 未验证：`pages/book/book`、`pages/team/join` 冷入口注入仅单测 + HTML M 表确认；节流是 Chrome 仿真非真实大陆链路；低端设备 CPU 侧未测；stats 最终 DOM 仍有 Vite 自插 6 条 modulepreload 属既有串行形态（非本轮）。
- R388 候选：① 卷库真实路由是 `pkgA/exam/list`（首页「全真模考」入口），本轮白名单里的 `pages/book/book` 是否为高频入口需用真人 `boot`/hash 分布取证后再调白名单；② Google 仍只抓 sitemap/robots、`/tiku/q/*` 0 次——继续核对 GSC 覆盖率；③ 大陆可达性资源缺口（备案）待老板；④ 宿主 IO 争用第 10 次；⑤ 下次 SOP-10 审计 ~R398。

### R388 候选真人口径剔除源站直连扫描 + GSC 渲染器 UA 归 Google（2026-09-04，分支 devin/*-r388-human-direct-origin，base=main）
- 取证（09-04 22:00–23:20Z）：① R387 候选①「卷库路由白名单」——近 7 天 `boot` 255 条中 `probe=0` 仅 1 条且 `boot.ref` 不含路由，无真人入口 hash 分布可用 → 白名单不动、也不加路由字段（每周 1 条的量级积不出分布）。② 分享链路 `shared_questions` 14 / 打开 27 / 回答 4 / PK 26 行 0 完成 / teams 0，最近 4 条全 `test-w*-mp` → 无干净外部样本，不动分享产品。③ **Google 首次进入题目页**：09-04 `66.249.65.202` GET `/tiku/q/404717` 200（此前 R377–R387 一直 0）；另有 `Google-InspectionTool/1.0`（GSC 网址检查渲染器，无 `googlebot` 字样）2 条 `/tiku/` 被算进候选真人。是否发现/收录/排名/真人点击四层**均未验证**。④ 真命中：09-04 候选真人 `page=33 / ips=32` 中 **30 条是 status 403 的源站直连**（AWS `3.238.133.20x` 普通 Chrome/iPhone UA，无 `X-Kg-Ip`/`Cf-*` 头，Caddy `@noedge` 拒绝）——用户必经边缘，直连源站主机名的只有扫描器；剔除后当日真正候选真人页面请求 **1 条**（法兰克福 IPv6 Firefox，单样本）。
- 方案：`crawler_stats.py` 真人分支加 `_via_edge`（`X-Kg-Ip`/`Cf-Connecting-Ip` 任一）门控，不经边缘的普通 UA 请求单独计 `humans.direct`；`access_log_report.BOT_ENGINES` 增 `google-inspectiontool→Google`；`ops_status.humans.direct_7d`；看板行改「候选真人」+ 尾缀「源站直连扫描 N（已剔除）」。单测 +2。详见 docs/iter/round-3/r388-human-traffic-direct-origin.md。
- 部署注意：`scripts/` 不在 rsync 范围，需 `scp scripts/crawler_stats.py scripts/access_log_report.py` 到 VPS `~/kaogong-assistant/scripts/` 并手动跑一次 cron 命令刷新 JSON。
- 验证结果（2026-09-04 23:20–23:50Z，PR #607 评论）：生产 rev 2dd6b98；VPS 脚本重跑后 `humans.page` 14 天 `{…, 09-04:33}`→`{09-04:1}`、`ips` 09-04 32→2、新增 `direct` 7 天合计 52、Google `tiku 1→3`（InspectionTool 归入）——近 14 天看板「真人页面请求」几乎全部是源站直连扫描器。testing agent 1440/375：看板「候选真人」行 7 数字 == `ops_status`、`direct_7d` 52 == 独立按 `days[-7:]` 求和、375 `.lb` 单矩形 37px 不竖排；业务回归（言语 3 题→保留→续练 4/10、卷库 120==API、错题本）两视口全过，/api 121 条全 2xx、console 0、日志 5xx/slow-req/traceback 0、容器 0 重启、LEFTOVER 0、questions 156792。未验证：`direct_7d==0` 隐藏分支（仅单测）、跨 UTC 零点滚窗口。部署脚本 Lighthouse `/` LCP 2746 违例为本机噪音（HTML 与 R387 一致、TTFB 40 ms、复跑 1230/2628）。

### R389 首页 `<title>` 从未上线（uni H5 构建以 manifest.h5.title 覆写）+ 三引擎收录实况入档（2026-09-05，分支 devin/1788563832-r389-home-title，base=main）
- 取证（09-04 23:30Z–09-05 01:20Z）：Google `site:kaogong.zalize.com` **首次出现 2 条收录**：`/` 与 `/tiku/`，其中 `/` 展示标题只有「错题邦」；线上原始 HTML `<title>` 确为「错题邦」而仓库 `index.html` 写的 SEO 标题从未上线——根因是 `@dcloudio/uni-h5-vite` 的 html transform 用 `manifest.json` 的 `h5.title`（缺省 `name`）无条件覆写 `<title>`。Bing / Yandex 公开 `site:` 0 结果（Bing 60 / Yandex 189 次抓取过 `/tiku/*`，「抓了不收」）；百度触发安全滑块无法取证。GSC：sitemap 已发现 109,903 页、页面索引报告仍在处理。搜索引擎 referer 真人访问与 `source=seo*` 确认真人转化仍为 0。生产 `seo_meta.indexnow_last_qid=6525883` 已覆盖活跃题 id 上限 1482630（109,371 活跃题），IndexNow 后台线程正常。
- 方案（仅 index.html，bundle 不变）：`manifest.json` 增 `h5.title`=「错题邦 - 公务员考试行测真题免费在线刷题 · 错题本 · 模考」（含 公务员/行测/真题/错题本 四检索词，≤34 字），`index.html` `<title>`/`og:title` 对齐；新增 `tests/seo-title.test.js` 锁三处一致 + 关键词 + 长度。不改 `navigationBarTitleText: "刷题"`、App.vue 无障碍 h1、`/tiku/*` SSR 标题。详见 docs/iter/round-3/r389-home-title-index-status.md。
- 搜索平台侧操作（非代码）：Bing Webmaster Tools 以测试 Google 账号登录，从 GSC 导入 `https://kaogong.zalize.com/`（Administrator，验证直接继承），提交 `sitemap.xml`（状态 Processing，「数据 48 小时内出」）；IndexNow 面板尚无数据（站点刚加入，是否与后台提交对上需 48h 后回看）。
- 验证结果（PR #608，生产 rev 4403c9c，23:19Z 部署，bundle index-Bctw4Xpu.js 不变）：原始 HTML `<title>`==`og:title`==新标题（curl + 页面 fetch 双路）；挂载后首页 `document.title`=「刷题」、卷库「真题卷库」、错题本「错题本」不变；`/tiku/` 与 `/tiku/q/234080` SSR 标题不变。testing agent 1440/375：言语 3 题→保留→首页续练卡→去继续 4/10 计数保留、卷库 120==API、错题本 200，两视口全过；/api 74+58 条全 200（max 296/416 ms）、console/pageerror 0（`vibrateShort:fail` 未出现）；日志 1209 行 5xx/slow-req/traceback 0、容器 0 重启 healthy；清理 12 行 LEFTOVER 0、questions 156792。部署脚本 Lighthouse `/` LCP 2730 违例与 R388 同形态（HTML 仅 title 变化），判本机噪音。
- 未验证：Google SERP 是否已展示新标题（需重爬，`/` 上次抓取时间未知）；Bing sitemap 处理结果与 IndexNow 面板对账（48h 后）；Bing/Yandex 是否从「抓了不收」转为收录。
- R390 候选：① 48h 后回看 GSC 页面索引报告（是否出现「已编入索引」页数）与 Bing sitemap/IndexNow 面板；② Google 已收录 `/tiku/` 但 `/tiku/q/*` 仅抓 1 条——核对 `/tiku/` 内链是否足够引导抓取题目页；③ 仍无可确认外部真人，获客侧无外部流量是当前最大差距；④ 宿主 IO 争用第 12 次；⑤ 下次 SOP-10 审计 ~R398。

### R390 题目页 JSON-LD 从 QAPage 改为 LearningResource ⊃ Question（Google QAPage 准则合规）+ 内链深度/部署窗口 5xx 取证否决两项（2026-09-05，分支 devin/1788565914-r390-question-jsonld，base=main）
- 取证：GSC 网页索引报告仍「正在处理」；crawler 报告 09-04 Google 21 次（sitemap 18 / `/tiku/` 3）+ `/tiku/q/404717` 1 次。内链核对：`/tiku/`→专题页（50 题/页 + `?page=N` + `rel=next`）→题目页，深度 3，不缺内链，**不加内链**。09-03/04 全量日志 × 29 次部署 ±4 min 窗口：非探针 5xx 0（窗口内 195 条全为 R372 前探针换出期），**不做零停机部署**。命中项：10.9 万题目页 JSON-LD 为 `QAPage{answerCount:1, acceptedAnswer:站方解析}`，Google QAPage 内容准则明列「站方单一答案、用户不能补答」为无效用例；Practice problems 富结果 2026-01 已弃用，不存在可换取的富结果，本轮只做「语义准确 + 不违规」。
- 方案（`seo/pages.py::_render_question` 只改 JSON-LD，HTML 正文零改动）：`LearningResource{name,url,inLanguage,learningResourceType(真题|练习题),educationalLevel,about(考点名或模块名),isPartOf:WebSite,hasPart:Question{eduQuestionType:"Multiple choice",text,suggestedAnswer[A–D 与页面 .opt 一一对应],acceptedAnswer{正确答案：X。解析≤500}}}` + `BreadcrumbList` 不动；`test_seo_landing.py` 断言无 QAPage / 类型集合 / 选项一一对应。详见 docs/iter/round-3/r390-question-jsonld-learning-resource.md。
- 验证结果（PR #609，生产 rev 46a4904，23:54Z 部署，bundle index-Bctw4Xpu.js 不变）：本地 ruff / pyright 0 / pytest 374；生产 `/tiku/q/{234080,404717,1046924}?v=<rand>` 两视口类型恰为 {LearningResource, BreadcrumbList}、无 QAPage、suggestedAnswer 与页面选项一一对应、无 tag3 题 `about` 回落模块名；列表页 JSON-LD 未变。**validator.schema.org 0 errors / 0 warnings**；Google Rich Results Test：1 项有效「路径」（Breadcrumbs）、0 无效项（LearningResource 非富结果类型不列出，不是「未检测到」）。业务：SEO CTA → 领跑题 → 3 题 → 保留 → 首页续练卡 → 去继续 4/11 两视口全过；/api 32+48 条全 200；日志 1588 行 5xx/slow-req/traceback 0；容器 0 重启；清理 13 行 LEFTOVER 0、questions 156792。
- 与本轮无关的生产观察：375 卷库分包 `pkgA-exam-list.CzyoVGKF.js` 一次 h3 拉取停滞 60 s（transferSize 0）后正常渲染，期间 1 条 `console.error(对象)` 内容未能还原（钩子只存了 `"{}"`）；`curl` 同资源 64–86 ms。单次、未复现，列为观察；测试钩子已在 SKILL 记「记 Error message/stack」。
- 注意：`/tiku*` Cloudflare 边缘缓存 ~300 s，部署后公网 `curl /tiku/q/N` 短时仍是旧 JSON-LD（`cf-cache-status: DYNAMIC` 但 CF Functions caches.default 命中），取证加 `?v=<rand>`；`kaogong-origin` 主机名直连 403 属预期（R388 `@noedge`）。
- 未验证：Google 是否因合规改变对 10.9 万页的评估（需数周 GSC 数据）；Bing/Yandex 对 LearningResource 的处理；边缘缓存旧副本自然轮换。
- R391 候选：① 48h 后回看 GSC 页面索引报告 / Bing sitemap+IndexNow 面板（R389 起算 09-06 之后）；② 375 卷库分包 60 s 停滞是否复现（h3 拉取，与 R387 modulepreload 无关——卷库 `pkgA/exam/list` 不在白名单）；③ 仍无可确认外部真人；④ 宿主 IO 争用第 12 次；⑤ 下次 SOP-10 审计 ~R398。

### R391 页面分包拉取挂起——uni h5 页面 async timeout 60 s→20 s + Vue errorHandler 接入 /api/monitor/report（2026-09-05，分支 devin/1788568473-r391-chunk-timeout-observability，base=main，PR #610）
- 取证：R390 的 375 卷库 60 s 停滞——源站归档 `pkgA-exam-list` 请求 0 条、静态资源 >3 s / 非 200 0 条（hash 资源边缘直出）、`curl` 64–86 ms、边缘无 analytics 权限 → 只能说「不在源站」。机制核对（读 `@dcloudio/uni-h5-vite` + vue runtime）：uni h5 每页 `defineAsyncComponent`，默认 `timeout:60000`（生产 bundle `timeout:6e4`），到点 `handleError` + 渲染 AsyncError「连接服务器超时，点击屏幕重试」；render `loaded` 优先于 `error`，chunk 迟到仍渲染——完全解释「60 s 停滞 + 1 条 console.error + 页面最终正常」。`handleError` 无 `app.config.errorHandler` 时只 `console.error`，`window.onerror`/`unhandledrejection` 均不触发 → chunk 超时/加载失败一直线上无痕。
- 方案（零功能）：`manifest.h5.async.timeout: 20000`（与 API GET 最终超时对齐）；`src/monitor-client.js`：`createErrorReporter`（去重/单页 ≤10/截断/send 异常不冒泡）、`classifyVueError`（chunk-timeout / chunk-load / vue）、`installVueErrorHandler`（保留 console.error + 链式旧 handler）、`describeRejection`（对象 reason 取 errMsg/message/JSON）；`src/tabbar-badge.js::setBookBadge` 统一三处角标调用并显式传 `fail`（uni 不传回调返回 Promise，同步 try/catch 接不住）。详见 docs/iter/round-3/r391-page-chunk-timeout-observability.md。
- 验证结果（第一版 rev f414804 / bundle index-BzIny8xO.js，testing agent 1440/375）：拦截 hold 25 s → 两视口 20000–20003 ms 出超时 UI + 上报 `vue:chunk-timeout…`（message/stack 真实），放行后不点重试 120 卷照常渲染，二次超时去重；404/abort → `vue:chunk-load`。375 正常路径 /api 全 2xx、console 0、上报 0。**1440 正常路径严格口径 FAIL / 业务 PASS**：未拦截时本机 Chrome↔CF h3 真实停滞两次（卷库 ≈60 s 后 200、错题本 ≈121 s 失败），产品按设计出 20 s 超时 UI 并上报，重载后恢复——即本轮要让其可见的事件；源站同期 5xx/slow-req 0。附带 `unhandledrejection: [object Object]`（真实 `setTabBarBadge:fail not TabBar page`）→ 第二次提交修复（vitest 555 / eslint / build 全绿，bundle index-CBDS4Ijc.js）。容器 0 重启、LEFTOVER 0、questions 156792。
- 未验证：真人是否再遇 chunk 挂起（只是从此可见）；20 s 阈值是否需调；h3 停滞是否 Devin 出口特有（`--disable-quic` 对照未做）；zalize-monitor 中心侧收到内容（无权限）。
- R392 候选：① 09-06 后回看 GSC 页面索引 / Bing sitemap+IndexNow；② 监控归档里 `vue:chunk-*` 是否出现非探针 IP（首批真实可见数据）；③ 仍无可确认外部真人；④ 宿主 IO 争用第 12 次；⑤ 下次 SOP-10 审计 ~R398。

### R392 中心监控 js/5xx 上报带 internal 标记——复用探针三路判定（2026-09-05，分支 devin/1788577062-r392-monitor-internal-flag，base=main，PR #611）
- 取证：R391 未验证项「中心是否入库」补齐——生产 VPS 读 `deploy/.env` 的 `MONITOR_URL/MONITOR_KEY`（中心 `https://zalize-monitor.wookat520.workers.dev`，`X-Monitor-Key` 鉴权；本机直连 403 是 key 不对不是网络）调 `/api/summary?since_hours=168` + `/api/errors?site=kaogong&limit=200`：**链路通**，R391 `vue:chunk-timeout/chunk-load`、真实文本 rejection 均已入库。缺口：kaogong 7 天 94 js + 24 5xx **`internal` 全 0**；js UA 89/94 Devin 桌面 Chrome，`ValueError 'abc'` 13 条源站日志全来自 `140.232.64.x`（R348-B1 取证流量）；中心 `checkAndAlert`（cron `*/15`，1 封/小时/站点）只算 `internal=0` → 整周内部走查全按真实用户错误进告警。`monitor.report()` 是 R374/R386 六处探针打标之外唯一没接 `probe_request` 的出口。
- 方案（零功能，后端 2 文件）：`monitor.report(..., internal=False)` + `build_payload()` 抽出（载荷加 `"internal": bool(internal)`）；`main.report_5xx` 两条路径与 `/api/monitor/report` 传 `internal=auth.probe_request(request)`，js 上报 `ua` 改 `auth.client_ua(request)`（`X-Kg-Ua` 优先）。中心 `/ingest` 早已 `body.internal===true → 1`，零改动。不删历史 118 行（无接口，按口径生效前理解）。详见 docs/iter/round-3/r392-monitor-internal-flag.md。
- 验证结果（rev b514dcd，bundle 不变 index-CBDS4Ijc.js）：中心按容器启动时刻切分——部署前 118 行全 `internal=0`，部署后 6 行全 **`internal=1`**：网段主路 js（Devin 出口 + 真人 UA）、网段主路 5xx（`POST /api/auth/wxlogin` 503 ×2，走 `status>=500` 分支）、VPS 网段外 + `X-Kg-Probe: 1`、VPS 网段外 + `python-requests` UA、testing agent GUI 页面 console fetch（无头、Linux Chrome UA、网段路）。`/api/summary` kaogong/js `internal 0 → 4`。业务回归 1440/375 全 PASS：`/api` 61+58 全 200、console 0、容器 0 重启、LEFTOVER 0、questions 156792。本地 pytest 378 / ruff / pyright 0。
- 未验证：真人 `internal=0` 路径仅单测（不向生产制造告警行）；未捕获异常→500 分支仅单测（R348-B1 后线上无可安全触发的 500）；中心告警邮件是否停发（`checkAndAlert` 只扫最近 15 min 窗口 `internal=0` 行，历史 118 行已滚出窗口，本轮未等下个 cron 观察）。
- 取证工具：`~/r392_vps{,2,3}.sh`（VPS 上读 .env 调中心，key 不打印，不落 handoff）；生产安全 5xx 触发器 = `POST /api/auth/wxlogin {"code":"x"}` → 503（`WX_MINIAPP_SECRET` 未配时恒定）。
- R393 候选：① 中心 `/api/summary` 下个 cron 后核 kaogong `internal=0` 增量是否为 0（真人零错误 vs 探针全标）；② 09-06 后回看 GSC 页面索引 / Bing sitemap+IndexNow；③ `vue:chunk-*` 是否出现 `internal=0`（真人 chunk 挂起首批可见数据）；④ 仍无可确认外部真人；⑤ 宿主 IO 争用第 13 次（本次部署 Docker 重建约 8 min）；⑥ 下次 SOP-10 审计 ~R398。

### R393 候选真人口径剔除 Devin 自动化 UA / 显式 X-Kg-Probe 头 / 预览域名 offhost 单列（2026-09-05，分支 devin/*-r393-devin-ua-offhost，base=main，PR #612）
- 取证与方案见 docs/iter/round-3/r393-devin-ua-offhost-attribution.md：三日归档 `Devin/1.0` UA 7,806 行，1 行经 Google 预取代理 IPv6 转发漏判网段；候选真人 61 条逐条归因（Devin UA 1 / 显式头 2 / `kaogong-h5.pages.dev` 12 / validator 1 / VPS 自身出口 1 / vivo 单设备 43）。
- 改动：`PROBE_UA_MARKERS` + `devin/`；日报 `BOT_GENERIC` 对齐并单测锁两份清单；crawler 真人分支剔除显式头 + `humans.offhost`（`--site-host`）；看板尾缀「预览域名 N（已剔除）」；VPS 自身 IP 入 `probe-ips.txt`（不进 `KG_PROBE_CIDRS`）。
- 验证结果（rev ed98be5）：网段外 Devin UA `probe=1` / 普通 UA 0；`offhost` 12 与取证逐日一致；候选真人 61→44；看板 7 项==ops_status；1440/375 业务回归 PASS；本地 pytest 380 / ruff / pyright 0。

### R394 搜索引擎 14 天抓取/5xx 归因 + 百度自适应标注（2026-09-05，分支 devin/1788582081-r394-baidu-adapt-markup，base=main）
- 取证：14 天引擎抓取 Yandex 1,282 / Bing 126 / Google 26 / **Baiduspider 经边缘真实抓取仅 1 条**（09-04 那条 `/tiku/q/297391` 是探针网段自测）；引擎 5xx 39 条中 29 条集中在 08-31 10:23–10:24Z（R372 前重启窗口），其余零散在部署窗口，不做零停机改造。官方文献：自适应站不用移动适配工具；head 紧随 viewport 加 `applicable-device=pc,mobile`；移动 sitemap `<mobile:mobile type="pc,mobile"/>`（wiki/544；百度公开 XSD 枚举过时不含该值，以公告为准）。详见 docs/iter/round-3/r394-baidu-adapt-markup.md。
- 改动（零业务）：SSR `_page()` head、H5 `index.html` 各加 1 条 meta；`_urlset()` 加 `xmlns:mobile` + 每条 URL 尾部扩展元素；新增 `tests/test_seo_baidu_adapt.py` + `seo-title.test.js` 用例。本地 pytest 383 / ruff / pyright 0 / vitest 556 / eslint / build:h5 全绿。
- 验收边界：其他引擎对扩展命名空间的容忍以部署后 sitemap 抓取仍 200 + GSC/Bing 站点地图状态无报错为准；百度是否因此识别为自适应/收录无法从我方日志验证（无站长账号）。
- 上线与复验（PR #613，rev d1dfd0a，bundle 不变，容器 04:30:10Z 启动）：容器内直连 `/tiku/`、`/tiku/q/297391`、404 页 `applicable-device` 各 1 条紧随 viewport、404 页 canonical 0；`/sitemap-years.xml` 114/114、公网 `?v=` 绕缓存 pages 262 / topics 156 / questions-1 10000 / questions-11 9371 每条 URL `mobile:mobile` 且 `ElementTree` 解析首子 loc、末子 mobile 全部一致，`sitemap.xml` 无 mobile。testing agent 1440/375：四页原始 HTML + DOM 断言、`DOMParser` 命名空间感知 sitemap 断言、SEO CTA→3 题→保留→续练卡→续练 4/11、卷库 120==API、错题本全过，`/api` 45+48 全 200、console 0；容器日志 1571 行 5xx/slow-req/Traceback 0、重启 0、LEFTOVER 0、questions 156792。中心监控 R393 以来 6/6 行 internal=1、R394 部署后新增 0 行。
- 边缘缓存实况（既有 SWR 设计，非本轮问题）：部署 8 min 后 1440 首次原生导航 `/tiku/`、`/tiku/q/234080` 仍拿到旧 head（`cf-cache-status: DYNAMIC`、`age: 16203`、`max-age=300`）——`[[path]].js` TTL 过期后先回陈旧副本再后台回源，重试即新副本；且 deploy 3b 步「边缘预热」是在重建前刷入旧版本副本。含义：每个 URL 部署后首个访客/爬虫会看到一次旧 head，SEO head 类改动完全生效依赖引擎第二次抓取；如需即时生效需部署后 purge（未做，需评估 10.9 万 URL 的 purge 成本与 CF token 权限）。

### R395 边缘 SWR「部署后首访旧副本」取证——否决 purge / 预热挪位，修正 R96·R394 因果（2026-09-05，分支 devin/*-r395-edge-swr-evidence，base=main）
- 取证（源站归档 14 天，剔探针）：09-01 起引擎经边缘回源 287 次 = miss 251 / swr 32 / retry 4；swr 且跨部署的上界 22 次（sitemap 13 / robots 5 / `/tiku*` 4 = 页面族 2.0%），swr 副本年龄 sitemap p50 19.3 h、`/tiku/q/*` 10–20 h（Bing 同 URL 复抓）。全流量非探针 swr 仅 145 次（robots 72 / sitemap 68 / 页面 5），**真人页面命中 swr 旧副本 0 次**；API 允许清单 swr 全为探针预热/走查。08-31 08:23Z–09-01 12:00Z 有 1,001 条引擎请求无 `X-Kg-Fetch`/`X-Kg-Edge`（当时旧版 Functions），R394 的 08-31 29 条 502 落在其中。详见 docs/iter/round-3/r395-edge-swr-stale-evidence.md。
- **决定性事实**：Cloudflare 官方文档明确 Cache API 内容不跨机房复制；`Cf-Ray` 机房分布：Devin 走查 PDX 116,847、Yandex FRA/AMS/MXP/LHR、Bing IAD/SEA/EWR、Google DFW、VPS 自身 curl ICN 57，生产 VPS 实测出边缘 `cf-ray …-ICN`。故 deploy 3b 预热只刷 ICN，对引擎/真人机房 0 覆盖；R394 见到的旧 head 是 PDX 机房里 Devin 自己 4.5 h 前留下的副本，**与 3b 无关**；「3b 挪到重建后」「VPS 发 Cache API purge」对引擎/真人零效果；zone 级 purge 需 purge 权限 token 且是否清 Cache API 条目未验证，可改善上界仅 14 天 22 次引擎抓取。**修正 R96 表述**：3b「重建窗口 stale-if-error 必有副本可退」只对 VPS 自身 cron/脚本成立；引擎在部署窗口拿到的 STALE 来自其自身历史抓取（09-02–09-04 `sitemap.xml`/`robots.txt` swr→503×25 s 共 12 条样本即此路径生效）。
- 顺带：sitemap 源站 MISS p90 7.5 s / p99 24.4 s 不是 SQL——容器内分片查询走 `COVERING INDEX idx_q_sitemap` 0.03–0.04 s / ≤1 MB，慢样本与部署窗口和宿主资源（MemAvailable 214–268 MiB、load 5、同宿主新增 recruit-*/softcopyright-* 8 容器）相关，宿主争用第 14 次上报，不做应用侧改动。
- 改动（零运行时行为）：`deploy_h5.sh` 3b 注释与 step 文案改为「仅本机所在机房」；`[[path]].js` 顶部注释补「副本按机房独立」；本文件 R394 段落「3b 刷入旧版本副本→每 URL 首访必见旧 head」的因果以本段为准。3b 保留（保护 VPS 本机 cron 请求）。
- 未验证：zone purge 与 Cache API 的关系；跨部署 swr 样本未逐条比对 body；Google/Bing 对 R394 sitemap 扩展的接受仍待 09-06 后面板。

### R396 真题「解析串题」全库取证 + 可逆隔离 307 行 + 读取层空快照回落 hs（2026-09-05，PR #615，rev b58aafb）
- 详见 docs/iter/round-3/r396-explanation-misalignment-scope.md：14 块 336 行为导入批次级解析数组错位（活跃 59、全部有 hs），`sqlite3 .backup` 后 `--apply` 隔离 307 行（`explanation_quarantine` 可 `--restore`），不猜映射、不用 hs 批量改写 base；`list_mistakes/due_reviews` 快照空回落 `hs_explanation`、快照非空以快照为准、不暴露 `q_hs`。

### R397 AI 分析空 200 根因（rescue 推理模型 finish=length content 空）+ 错题 paper:null 范围取证 + 归卷脚本只补缺（2026-09-05，分支 devin/*-r397-ai-empty-paper-null，base=main）
- 取证与方案见 docs/iter/round-3/r397-ai-empty-reply-paper-null.md。AI：容器内同 prompt 直打 rescue（kimi-k3）200/57 s/`finish_reason=length`/content 0/reasoning 1,381，主通道 200/33 s/content 351；`chat_fast` 把空串当成功。改 `llm._content()` 空正文抛 `EmptyReply`，rescue 空→回落主通道→仍空→端点 502 友好文案；不重试、不改 max_tokens、不造内容。
- paper:null：映射 90 条；活跃错题 243 = has_paper 75 / not_real 121（契约 null）/ source 无卷 37 / no_qid 10；全库真题 source 376 个仅 90 成卷、未成卷 286（活跃 5,508 题）——不是 17 题安徽卷个案，`_PSOURCE_MIN_N` 不动。旧归卷脚本直接重跑不安全：标题正则把 2025/2024/2023 国考多卷合成同名 + `upsert_exam_paper` 按 title 冲突覆盖 question_ids；`2015年吉林` 233 题 / `历年行测真题` 1,544 题是多卷混装。脚本改为标题=source 原文、已成卷/超量(>140)/撞名跳过并打印原因、`collect()` 返回 `(papers, skipped)`；`_paper_by_psource` 只看 zhenti。副本干跑：跳过 76+2、待建 19 套（61–96 题、资料分析几乎为 0）。**本轮不在生产写卷**，先摆出「补卷即不完整卷」的事实再定。
- 本地 pytest 403 / ruff / pyright 0。取证脚本 `~/r397_llm_probe.py`（key 不打印）、`~/r397_paper_null.sh`、`~/r397_src_gap.sh`、`~/r397_paper_dry_local.py`。

### R398 SOP-10 四维审计（对标粉笔错题本）+ 错题本 375 弹层让出 TabBar + AI 分析失败态可重试（2026-09-06，分支 devin/*-r398-book-sheets-above-tabbar，base=main）
- 审计与证据见 docs/iter/round-3/r398-sop10-audit-book-sheets.md。粉笔侧**无一手证据**（需账号），公开帖只作二手，不据此加功能。生产真人：`mistakes` 221/59 uid、`mastered` 0、`error_reason` 6、复习过的 uid 5/59、21 道未掌握错题事后已答对（6 道 ≥2 次）、`review_entry_click` 60 天 10 次。
- 命中：`book.vue` 9 个 `.mask` 弹层（强化卡/庆祝/AI/手动录入/扫描/键盘帮助/筛选/报告）在 375 全在 tabbar（50px, z 998）之下——R396 走查实录「下次再说」不可点、AI 失败文案被盖、筛选底行被截；`aiAnalysis()` 失败写进 `aiHtml` 后入口 `if (aiHtml) return`，失败一次本页永不重试。
- 改动：H5 `@media (max-width:767px) .mask{bottom:calc(50px+safe-area)}`（同 `export-confirm.above-tabbar`）；`aiErr` 独立 + 「重试」，空正文按失败；入口显式 `aiAnalysis(false)`。源文件锁 `tests/book-sheet-tabbar.test.js`。
- 不做：改 SRS 掌握阈值/答对即移出（需设计论证，R399+ 候选）、错因聚合（6/221）、19 套候选卷。
- 本地 vitest 559 / eslint / build:h5 全绿。取证脚本 `~/r398_probe.py`、`~/r398_probe2.py`（只读）。
- 上线与复验（PR #617，rev 9ee182e，bundle index-B0wIib1U.js）：375 五个触达弹层 `.mask` bottom 全部 762（tabbar 上方），强化卡「下次再说」717–742 可点（R396 时 767–792 被盖）；AI 真实成功 200/44.8 s 后本机 Fetch 拦截 502 → 失败态 + 重试重发 POST → 放行 200 渲染；1440 mask 仍 bottom 900；回归 PASS；容器 5xx 0 / slow-req 4（=4 次真实 AI）/ 0 重启；LEFTOVER 0。**首次在生产日志抓到 R397c 的 `[llm] rescue kimi-k3 failed (EmptyReply…) fallback to deepseek` ×2**（≈45 s 请求）——rescue→主通道回落已由生产事实证实。观察：一次回落后正文仅 126 字（首次 309）疑似偏短，待看主通道 max_tokens。未验证：扫描结果/报告 sheet、真实 502 分支。

### R399 AI 生成类接口正文截断取证 → 主通道优先 + rescue 截断回落；「事后答对仍待掌握」21 条归因，SRS 不改（2026-09-06，分支 devin/*-r399-ai-truncated-main-first，base=main）
- 取证与论证见 docs/iter/round-3/r399-ai-truncated-reply-srs-evidence.md。**修正 R398 表述**：126 字那次（34.0 s）不是回落后的主通道正文——回落两次都 ≈45 s 且日志恰 2 条 warning，34 s 只能是 rescue（kimi-k3）直接返回的截断正文（止于「## 薄弱点诊断\n1」，`finish_reason=length` 形态，推断）。容器内复采：rescue 900 ×3 全空（reasoning 897 token 吃满）、1200 ×2 全空、1600 与 2400 各 1 成功 1 空——reasoning 长度不可控，**调 max_tokens 无效**；主通道 deepseek 4/4 `finish=stop` 336–354 字 18–33 s、`completion_tokens` 1,092–1,976 >900（网关不以 max_tokens 约束其 reasoning）。
- 改动：`llm.TruncatedReply(EmptyReply)`，`_content(reject_truncated=)` 在 `finish_reason=length` 且正文非空时 rescue 侧抛出回落主通道、主通道侧只 warning 原样返回；`/api/mistakes/analysis`、`/api/ai/coach` 由 `chat_fast`（rescue 优先）改 `chat`（主通道优先，5xx/额度码仍回落 rescue）。coach 未单独采样、按同机制推断一并调整。max_tokens 不动。`tests/test_llm_empty_reply.py` +3 用例。
- SRS：21 条「事后答对仍待掌握」全在 R371（#580 合入 09-04 05:51Z）之前：u26 12 条走显式复习已推进（rc/streak 1–2，两次复习间隔几分钟）、u27 1 条 + umtg6to4yv 8 条（同一练习 3 分钟后重做）是 R371 前普通作答历史行；R371 后真人答对命中未掌握错题 0 行（契约未被违反、也无正向真人样本）。0 已掌握 = 阶梯最短 56 天 vs 站龄 34.9 天。**「答对即掌握」不采纳、不回填**；若要更早可见掌握感，候选是中间态标签（streak≥3「已巩固」），等真人复习数据。
- 本地 pytest 406 / ruff / pyright 0。脚本 `~/r399_rescue_probe.py`（key 不打印）、`~/r399_srs_probe*.py`（只读）。
- 验证结果（PR #618，生产 rev 79ccbc8，11:28Z 部署，bundle 不变）：testing agent 1440/375 三次真实 `POST /api/mistakes/analysis` 均 200、327/334/367 字且以完整句收尾；容器日志 `[llm] rescue … fallback` 0 行、`finish_reason=length` 0 行（符合「不再先走 rescue」预期，但无主通道截断样本）；R398 失败态+重试、375 弹层 762、业务回归 PASS；`/api` 全 2xx、console 0、5xx/Traceback 0、slow-req 3（=3 次 AI）、0 重启、LEFTOVER 0、questions 156792/109371、quarantine 307。**耗时 53.2 / 34.6 / 14.7 s，只 1/3 落在预期 18–35 s**——`chat()` 成功路径与主通道 5xx→rescue 回落此前都零日志，53 s 那次是「deepseek 自身慢」还是「静默回落」无法归因（推断倾向前者：rescue 900 token 直出 327 字完整文概率低）。R399b：`chat()` 主通道 5xx/额度码→rescue 处加 `[llm] main <model> status=<code>, fallback to rescue <model>` warning（+1 用例，pytest 407）。未触达：rescue `TruncatedReply` 回落（需主通道故障）、`/api/ai/coach`（前端无入口，`frontend-uni/src` grep 0 命中）。

### R400 真题解析「公式丢失骨架」211 行人工核定 → 可逆隔离 210 + PDF 页脚剥离 30 处 + 错题快照写入侧回落 hs（2026-09-05，分支 devin/*-r399-ai-truncated-main-first，base=main）
- 取证与执行实录见 docs/iter/round-3/r400-formula-dropped-explanation-snapshot.md。R399b 后容器日志 `[llm]`/analysis 0 行、5xx 0、0 重启——无自然 AI 请求可归因；`answer_log` 近 48 h `probe=0` 0 行、最近错题全 `test-w3-mp`，无外部真人作答。`growth_events` 真实 schema `(id,uid,event,source,ref,created_at,probe)` 532 行。
- R396 遗留 31 个 fit 小块逐块核对：未再发现整块串题；命中的是另一类缺陷——公式/表达式被抠掉只剩骨架（「根据公式：。」「所求项为。」）。`quality.formula_dropped()` 三信号按模块（colon / enum 非言语 / quant 仅数量·资料）全库 211 候选 → **逐行人工阅读**：210 确认、1 误报（334672 OCR 重复顿号）`--keep`。活跃 193 行全部有 hs。
- 生产：`sqlite3.backup` → `/data/data.db.r400-before`；`--garbled --keep 334672 --apply` 隔离 210（reason `r400:formula-dropped-explanation`，与 R396 307 行同表分 reason、`--restore --reason` 互不影响），错题快照全等 base 的 1 条（id 974）改写为 hs；`--strip-footers --apply` 25+5=30 处（explanation 27 / options 3）记入 `text_footer_fix`，`--restore-footers` 仅在当前值仍等于 after 时写回。复核：隔离行 explanation 仍非空 0、活跃无 hs 0、questions 156792/109371 不变、再 dry-run 0。
- 写入侧：`db.save_mistake()` 新错题 explanation 空白且 qid 有值 → 落 hs；`practice.vue` 四处 payload `q.explanation || q.hs_explanation || ''`。历史 15 条空快照不回填（读取侧回落已覆盖）。
- 不做：按 fit/标点阈值自动隔离、hs 改写 base、LLM 补公式。本地 pytest 413（+6）/ ruff / pyright 0 / vitest 559 / eslint / build:h5 全绿。脚本 `~/r400_garbled_probe.py`、`~/r400_verify.py`（只读）。

### R401 数量/资料解析「数值位被抠空」127 候选逐行人工核定 → 可逆隔离 126（独立 reason）+ 隔离脚本并发写入守卫（2026-09-05，分支 devin/*-r400-formula-dropped-snapshot，base=main）
- 取证与执行实录见 docs/iter/round-3/r401-formula-dropped-value-slot.md。起点是 R400 复验时生产样本 288140「订阅报纸的家庭为，因此只订阅日报的家庭为」——文字可读但数值/表达式位缺失，R400 三信号不覆盖。宽扫 276 行 → 用生产假阳性（「其主要成分为，」等词尾）收窄 `quality._FD_VALUE_RE`（`为[，。；]` 前字排除表 + `解得|则有|列式得|…` 直接接句读，只在 shuliang/ziliao 生效）→ 127 = 126 value + 334672（enum 命中、继续 keep）；**126 行逐行人工阅读全部确认**，活跃 109 全部有 hs。
- 脚本：`--apply` 尊重 `--reason`（本轮 `r401:formula-dropped-value`，与 R396/R400 同表分 reason 可独立 `--restore`）；`apply()` 改为 `UPDATE … WHERE id=? AND explanation=?` 条件写入，扫描后被并发写入者（宿主同期有 `/tmp/w3c.py` 清洗脚本）改过的行不隔离、不留过期快照、打印 skipped 列表（单测覆盖）。
- 生产：第一次 SSH 会话内 `integrity_check` 在 iowait 78% / IO pressure 98% 下 D 态 20+ min、会话消失，只读复核库未变；改 `nohup` 后台：`/data/data.db.r401-before` quick_check ok（15 min）→ apply `quarantined 126, mistakes snapshots rewritten 0`、无并发 skipped → post：quarantine r396 307 / r400 210 / r401 126，隔离行仍非空 0、活跃无 hs 0、288140 NULL+hs 104、334672 保留、mistakes 引用 r401 0、questions 156792/109371 不变 → 副本 restore drill 126/126 → re-dry-run 0。
- 不做：全部 regex 命中自动隔离、用 288140 推全集、猜公式、hs 改写 base、LLM 补正文、SRS 改动/回填。本地 pytest 416（+3）/ ruff / pyright 0 / vitest 559 / eslint / build:h5 全绿。教训：生产长 IO 任务必须 `nohup` 落日志再轮询，不能挂 SSH 会话。
- 生产复验（testing agent，1440/375）：288140 `/api/question` `explanation:null`/hs 104，SSR 单段 hs 无骨架，练习答错真实 `POST /api/mistakes` expLen 104、clean 前 DB raw 104（R400 时同题 167 字乱文）；对照 296168 hs / 264413 base 不串题；回归 PASS；`/api` 全 200、console 0、容器 5xx/Traceback/slow-req 0、0 重启；LEFTOVER 0。评论 https://github.com/wookat/kaogong-assistant/pull/619#issuecomment-5552841176 。
- **部署事故（宿主磁盘）**：首次 `deploy_h5.sh` compose build 在 `/tmp` 写 metadata 时 `no space left on device`（宿主 50 G 用 98%，`/var/lib/docker/volumes` 16 G 其中 `recruit_app_pgdata` 8.6 G、`deploy_kaogong-data` 4.3 G，`/opt` 6 G），容器未重建、旧 rev 继续服务，脚本 600 s 闸 FAIL。处置：把 kaogong 卷内 4 个旧备份 `bak-r348 / bak-w2 / r396-before / r400-before` gzip -3（各 430 MB→~165 MB，可逆）释放 ~1 GB 后重跑成功。复验期间宿主又从 96%→98%、load 1.5→8，`find -mmin -40 -size +50M` 定位为同宿主 recruit-* 容器重建拉取的 containerd blobs/快照（非 kaogong）。**资源缺口：宿主磁盘 50 G 多项目共用已到上限，需老板决定扩盘或迁出其他项目**；kaogong 侧后续每轮备份用完即 gzip，卷内只保留最近一份原始备份。

### R402 三轮隔离题 hs 答案一致性 + SEO acceptedAnswer 口径实测 + 数量/资料「运算符位被抠空」83 行逐行人工核定 → 可逆隔离（独立 reason）+ 快照去空白匹配（2026-09-05，分支 devin/*-r400-formula-dropped-snapshot，base=main）
- 取证与执行实录见 docs/iter/round-3/r402-formula-dropped-operator-slot.md。hs 一致性：只解析 hs 里显式答案标记（「正确答案为 X」等），无标记按未知不猜。R396 307 行 78 尾标记 75 一致，**3 不一致（264787/264790/265118）全是 disabled 行**（串题块内 hs 也可能错位，上架前先校源）；R400 150/150、R401 67/67、R402 44/44 全一致；活跃行 0 不一致。SEO：`seo/pages.py` 选 `hs or raw`，JSON-LD `acceptedAnswer` = hs（有 hs 时）；生产实抽 288140（隔离、hs-only）/264413（keep 双段）/265250/237345 四页 HTTP 200、类型 {LearningResource, BreadcrumbList}、正文与 acceptedAnswer 均与代码一致。
- 候选规则：宽扫（比值/单位/双标点等）活跃 5,498 行明显噪声，否决；收窄为 `quality._FD_OP_RE`（`=，`/`，=`/`××`/`（1－）`/`，，`/`，。` 五形态，只在 shuliang/ziliao，`。。` 单独排除以 261638 为证）→ 93 候选 → **逐行阅读**：83 确认（含 6 条 `--extra` 手加：同形态但规则未命中）、4 keep（265250/238968 正常，334667 OCR 乱码留档，334672 继续 keep）。活跃 63 全部有 hs。
- 生产（nohup，宿主 load 17.8 / IO pressure 99%，quick_check 8 min）：`/data/data.db.r402-before` quick_check ok → `quarantined 83`、无并发 skipped → post 307/210/126/83、隔离行仍非空 0、活跃无 hs 0、questions 156792/109371 不变 → 副本 restore 83/83 → re-dry-run 0。**新发现**：mistakes 2041（题 265471，真人 uid）快照是缺式文本但与隔离解析只差空格（写于 w3c 归一空白前），脚本全等匹配漏掉 → 脚本改去空白后相等（单测：空白变体改 hs、用户笔记不动），生产对 2041 单行条件 UPDATE → 140 字 = hs，再扫 0。
- 不做：全部候选自动隔离、猜公式/数值、hs 改写 base、LLM 补正文、SRS 改动/回填、删宿主他项目数据。宿主磁盘 92%（4.2–4.6 G 空闲）、老备份已全 gzip，仍待老板决定扩盘/迁出。本地 pytest 417（+1）/ ruff / pyright 0；`test_answer_log_uses_client_ts_and_falls_back` 在 UTC 00:15 时段失败属既有时区边界（`now-7200` 落 CST 昨日），与本轮无关、未动。脚本 `~/r402_probe.py`、`~/r402_ctx.py`、`~/r402_mistfix.py`（只读/单行）。
- **R402b（rev dd13df6 已上线）**：隔离写库后 `/tiku/q/237345` SSR 仍出旧「原解析」骨架——`seo/pages.py` `_render_question` 进程内 `lru_cache` 不随 DB 变化失效（不是边缘缓存）。改为以 `questions.updated_at` 为缓存版本键（隔离/还原脚本都刷 updated_at），单测 2 条；部署后容器 0 重启、5xx 0、quick_check ok、四页 SSR/JSON-LD 复核与 DB 一致。教训：**只写库不重启的数据治理，必须核 SSR 进程缓存**；活进程内失效路径生产未实证（靠本次重建清掉），下次写库后补一次「访问→写库→再访问」。

### R403 专题/年份列表页 lru_cache 接版本键（TTL 同源，零新增查询）+ sitemap lastmod 被早期 ISO 文本 updated_at 盖住：50/157 在架考点停在 2026-08-09（2026-09-05/06，分支 devin/*-r400-formula-dropped-snapshot，base=main）
- 取证与决策见 docs/iter/round-3/r403-list-page-cache-version-lastmod.md。生产只读：容器 16:28Z 启动后 questions 真实写入 0 行 → **当前无陈旧列表页，属前瞻修复**；但 09-03/04/05 活进程期间共 5 批 1.8 万行写入（含 disabled 翻转）是常态，下轮隔离即会让专题/年份页继续列已下架题。
- `_render_topic/_render_year` 版本键 = `(在架数, 归一化 MAX(updated_at))`，直接取自 `tag3_counts/tag3_lastmod/year_module_counts` 5 分钟 TTL 缓存，陈旧上界 5 min（与 sitemap lastmod、边缘 max-age 同量级）。
- **实问题**：`updated_at` 有 1,255 行 TEXT（2026-08-09 ISO），SQLite TEXT > REAL，`MAX(updated_at)` 让 50 个考点（含 SL-GC-01 2,443 题 / SL-JH-01 1,945 题，正是 R400–R402 隔离集中处）sitemap `<lastmod>` 一周来停在 08-09。`db._UPDATED_AT_EPOCH` 归一化后取到 09-04/09-05，生产实测聚合 0.019 s。不改写数据。
- 不做：每请求 MAX 实查、清缓存接口、迁移 TEXT 行、为验证写生产库。本地 pytest：R403 新增 5 条 5/5 过；全量 424 条最好一次 423 过 + 时区用例 1 失败，但多数次数出现 5 例 `database is locked`（test_int_params_400 / test_llm_empty_reply / test_llms_txt / test_material_group×2 / test_shenlun_hub，均排在本文件之前）——**去掉本文件后 3/3 同样复现、`dd13df6`（R403 前）2 次中 1 次复现、`origin/main` 363 条 2/2 干净**，即 R396–R402 分支上既有的测试夹具竞态，非 R403 引入；线索：R372 `_ConnProxy` 线程本地连接常驻 + 未耗尽游标持读快照 → 他线程提交后本连接写入即 `SQLITE_BUSY_SNAPSHOT`（busy_timeout 不等待），生产同机制是否会出「database is locked」列 R404 起点。ruff / pyright 0。脚本 `~/r403_vps.sh`、`~/r403_vps2.sh`（只读）。

### R404 本地全量 pytest 间歇 `database is locked` 根因：DEFERRED 事务内先读后写遇他线程提交即刻 SQLITE_BUSY → 连接 `isolation_level="IMMEDIATE"`（2026-09-06，分支 devin/*-r400-formula-dropped-snapshot，base=main）
- 取证与 A/B 见 docs/iter/round-3/r404-sqlite-deferred-snapshot-busy.md。SQL trace 抓到失败现场：主线程 `BEGIN`（deferred）→ FTS5 在 `INSERT questions` 语句内部重载 config（`PRAGMA data_version` + `SELECT question_fts_config`，开读快照）→ 触发器写 FTS 升级写锁 → 0 ms 报 locked；同时 `_fts_backfiller` 每批 5000 行事务在提交。最小复现：deferred `BEGIN`→SELECT→他连接提交→INSERT = `SQLITE_BUSY` 0.00 s（busy_timeout 30 s 完全不介入，快照不可升级）；`BEGIN IMMEDIATE` 同序列排队后成功。**否决**了 R403 的「未耗尽游标持快照」猜测（fetchone/fetchall 各形态均可写）和「普通写锁竞争」（持锁不提交 1 s 后全部正常等待成功）。
- 改动 1 行：`sqlite3.connect(..., isolation_level="IMMEDIATE")`，隐式事务先拿写锁，语句内部先读发生在写事务里；SELECT 不开事务不受影响；`mock_event._freeze_ranks` 本就显式 IMMEDIATE。A/B：修前 6 轮 2 轮出锁（每轮 5 例），修后 14 轮 0（唯一失败为既有 UTC 00–02 时区用例）。新增 `tests/test_conn_begin_immediate.py` 2 条（去掉改动第 1 条即失败）。pytest 426 / ruff / pyright 0。
- 生产：3.46.1，日志 locked 0、中心监控唯一 OperationalError 是历史 `duplicate column name: probe` 非锁。触发条件对应「写 questions（有 FTS 触发器）时恰有他连接提交」——真人写路径（mistakes/answer_log/users）无 FTS 触发器、Python 隐式事务首句必为 DML，不会先读后写，故生产 0 条与机制一致；受益场景是管理台导入/编辑、种子导入、stats 刷新与 backfiller 并发、治理脚本外部写库后的首次 questions 写入。属加固非事故修复；生产 3.46.1 未做复现（不为验证造写入）。

### R405 334667 类「OCR 整段乱码解析」全库取证 → 63 行逐行人工核定 → 可逆隔离 reason `r405:ocr-garbled-explanation` + 活进程 SSR 版本键失效首次生产实证（2026-09-06，分支 devin/*-r400-formula-dropped-snapshot，base=main，零部署）
- 取证与实录见 docs/iter/round-3/r405-ocr-garbled-explanation.md。全局启发式（字符类、罕见二元组 P99、模板模糊/收窄匹配）全部否决为整改规则——公式/拉丁/人名/数学符号是常态、334667 二元组占比不过 P99；探测器只用来找块，写库清单 154 行逐行读全文后定 63 行（三块 2018 辽宁 16/41、2019 辽宁 24/41、2021 广西 14/39 + 块外 9；横跨四模块，是 PDF 源 OCR 质量问题不是模块特有；块内严重/正常混排故不按 source 整块隔离）。口径四类 C 答案标记损坏 / N 正文严重错字 / F 公式槽位丢失 / A 串入别题；单字级错字不动、不猜字、不改写文本。
- 脚本 `--blocks/--extra` 分支 `apply(conn, targets, args.reason or REASON)`（此前 `--reason` 只对 `--garbled` 生效），单测 `test_cli_extra_only_apply_uses_custom_reason`。用法：`python - --extra id,id --reason r405:ocr-garbled-explanation [--apply] < script`（容器内 cwd=/app/backend）。
- 生产（nohup，`~/kaogong-reports/r405_apply.log`）：写前 63 行 md5 与导出一致 → 容器内直打三页 SSR 预热（含「原解析」+ 乱码）→ dry-run 63 → `backup` 449 MB quick_check ok → `quarantined 63, mistakes rewritten 0`、并发 skipped 0 → 五 reason 307/210/126/83/63、63 行 base NULL 全有 hs、questions 156792/109371 不变 → **不重启立即复访三页：单段 hs、无乱码**（R402b/R403 版本键在活进程内首次实证）→ 活库 quick_check ok → 副本 restore 63/63 → re-dry-run 0 → 边缘正式域名三页 DYNAMIC 单段、JSON-LD acceptedAnswer 取 hs、对照 265250 仍双段。容器日志 5xx/Traceback/locked 0。`data.db.r402-before` 原始备份已 gzip（卷内只留 r405-before 一份原始）。
- 未验证/未做：块内 262255/262521/332699 未读；块外非穷尽（探测器没命中的其他 source 看不到）；mistakes 334314 快照为空走 R396 读取层回落，未以该 uid 登录 UI 验；`updated_at` 1,255 行 TEXT 仍不迁移。

### R406 「占位解析」78 行取证 → 可逆隔离 reason `r406:placeholder-explanation`（2026-09-06，分支 devin/*-r400-formula-dropped-snapshot，base=main，零部署）
- 取证与实录见 docs/iter/round-3/r406-placeholder-explanation.md。R405 补读：332699 完整不动；262255/262521 是「计算结果：98 / 1043」——短解析全库正则 1,006 命中里活跃 100 逐行读：is_real=1 88 行全在 259880–264604 同批次、跨 33 source；其中 **复制值占位 64**（`计算结果：176米`×24 / `98`×16 / `1043`×13 / `儿子得4/7`×7 / `8人`×2 / 裸 98×2，同字面跨互不相关题、选项无该值）、`逻辑推理：甲的话对，丙的答案对` 模板句 12（与 260363/262538 答案直接矛盾）、`常识解析：蛋白质` 1、残句「措施。」1 → 隔离 78（全部有 hs）；答案自洽的 10 行（`本题答案为X。`/裸 `A`/`BCD表述正确。`，ansok 全 True）与 12 行种子题「XX。故选X。」保留。
- 生产（nohup `~/kaogong-reports/r406_apply.log`）：预热三页含占位 → dry-run 78 → backup 449 MB quick_check ok → `quarantined 78, mistakes rewritten 0` skipped 0 → 六 reason 307/210/126/83/63/78、questions 156792/109371 不变 → 不重启复访三页占位字面消失（版本键活进程失效第二次实证）→ quick_check ok → 副本 restore 78/78 → re-dry-run 0 → 边缘四页 acceptedAnswer 答案字母与 answer 一致。日志 5xx/Traceback/locked 0。`r405-before` 已 gzip。
- 未做/遗留：同字面 disabled 占位行 106（无 hs）上架前先校源；78 行 hs 只抽读 4 页；「只给答案不给理由」的 10 行 UI 是否标注待真人触达；`updated_at` TEXT 不迁移。

### R407 同批次 >40 字复制/串题/答案字母冲突解析 7 行取证 → 可逆隔离 reason `r407:mismatched-explanation`（2026-09-06，分支 devin/*-r400-formula-dropped-snapshot，base=main，零部署）
- 取证与实录见 docs/iter/round-3/r407-mismatched-explanation.md。活跃 is_real 有 base 解析 15,080 行，同解析跨 ≥2 题干 195 组/396 行，其中 185 组题干高度相似（同材料/同题多卷次）合法共用不动、195 组 answer 字母无一不一致——重复不是损坏证据；低相似 10 组逐条读题干+选项+hs 后只定 5 行（331742 与 331721 共用一段讲 331721 的 292 字解析；261859/264300 `词语辨析：正确答案为贯彻` 选项无该词；261729/262411 `阅读理解：人文精神与科学精神…` 与题无关）；`答案：X。` 前缀 97 行里字母与 answer 冲突仅 2 行（1272206 前缀 A/answer C 且正文截断；1272268 前缀 A/answer D 且正文推导得 D）→ 共 7 行，全部活跃有 hs、mistakes 引用 0。
- 生产（nohup `~/kaogong-reports/r407_apply.log`）：预热四页含错解析 → dry-run 7 → backup 449 MB quick_check ok → `quarantined 7, mistakes rewritten 0` skipped 0 → 七 reason 307/210/126/83/63/78/7、questions 156792/109371 不变 → 不重启复访四页错解析消失（版本键活进程失效第三次实证）→ quick_check ok → 副本 restore 7/7 → re-dry-run 0 → 边缘五页 200 DYNAMIC、`正确答案：` 字母与 answer 一致。30 min 日志 5xx/Traceback/locked 0。`r406-before` 已 gzip，宿主 93%。
- 未做/遗留：7 行 hs 只按 DB 文本核未 UI 走查；185 组合法共用按相似度+抽读非全读；331721 保留按语境判断（原始导入件不可得）；`updated_at` TEXT 不迁移；106 行 disabled 占位行待校源。七轮共隔离 874 行。

### R408 隔离题真人触达取证 + 3 条错题快照读取层回落 uid 视角复核 + SEO 题目页「只有 hs」也标注「花生十三讲解」（2026-09-06，rev dd608bf，分支 devin/*-r400-formula-dropped-snapshot，base=main）
- 取证与决策见 docs/iter/round-3/r408-hs-only-label-real-reach.md。生产只读：隔离 874 / 活跃 568 / 活跃无 hs 0；全库活跃 hs-only **791**（568 隔离 + 223 本就只有 hs）。`answer_log.probe`：NULL 1,040 行 / 61 uid（09-04 打标前历史行，`COALESCE(probe,0)=0` 按真人计但不可证明）、probe=1 28 行 / 2 uid、**probe=0 全表 0 行**——打标后可确认的真人作答为 0，隔离题上亦 0；「真人触达隔离题」只能说可证明为 0、历史 NULL 不可归因。
- mistakes 引用隔离题 3 行（m914/334314 空快照、m974/296168、m2041/265471），三 uid 匿名、作答全在打标前，真人/走查不可区分不下结论。容器内直接调 `db.list_mistakes(uid)` / `db.due_reviews(uid)`（与 API 同读路径）：explanation 149 / 89 / 140 字（空快照回落 hs）、`q_hs` 未外泄——R396 读取层回落对这三个 uid 生效；全表空快照 15 行的题全有 hs，不补写快照。
- 展示口径实抓：SEO 题目页 hs-only（331742 等 791 页）此前**无任何来源标签**，hs 正文直接当唯一解析；双段页有「花生十三讲解/原解析」，练习页 hs 一直标「花生十三方法解析」。改 `seo/pages.py` 3 行：`elif hs:` 也标「花生十三讲解」；raw-only 页不变。**不加「官方解析缺失」**——223 道非隔离 hs-only 题无法证明曾有官方解析，「缺失」不可取证。单测 +1、既有隔离用例补断言；pytest 428 / ruff / pyright 0。
- 部署 `--skip-build`（bundle 不变）：容器 healthy 0 重启、20 min 日志 5xx/Traceback/locked 0、questions 156792/109371、七 reason 不变；源站三页 hs-only 各 1 处标签；边缘首抓三页无标签（age 内旧副本，R395 已证的 SWR 形态）、复抓 age≈20 全部带标签；334314/265250/264413 与源站一致。Lighthouse `/` LCP 2760 同 R388–R407 形态。**宿主磁盘 93%→95%（2.8 G）**，本次部署 build 让空间再降 0.7 G，下次 compose build 有 `no space left` 风险，仍待老板决定扩盘/迁出 recruit·softcopyright；kaogong 侧可释放项只剩卷内中间备份 r400/r401/r402/r405/r406 gz（各 ~170 MB，quarantine 表本身保留原文可 `--restore`，删中间备份不影响可逆性）——未删，待示。
- 未做/遗留：UI 未以那三个 uid 登录走查（匿名 uid 无登录态）；probe NULL 历史行不回填；`updated_at` TEXT 不迁移；106 行 disabled 占位行待校源。

### R409 试卷分节标题串入末选项/解析尾部可逆裁剪 47 处 + 223 道非隔离 hs-only 题来源分布 + hs 标签统一「花生十三方法解析」+ 磁盘治理（2026-09-06，rev c79a9a8，分支 devin/*-r400-formula-dropped-snapshot，base=main）
- 取证与实录见 docs/iter/round-3/r409-section-header-tail-hs-only-sources.md。223 道非隔离 hs-only：全 is_real、跨 6 个 id 批次（104 万段 169）、Top source 2024 浙江/山东/广东/江苏/深圳，**同 source 其他题有 base 解析** → 「整批 base 从未导入」不成立，原始导入件不可得不下「曾有官方解析」结论，维持不标「官方解析缺失」。hs 显式答案标记 vs `answer`：220 一致 / **3 冲突**（1046855 D/hs C、1046866 A/hs D、1046874 C/hs D，作答/错题 0 行）——无原卷不判对错，不改写不隔离，登记待校源。
- 顺带发现 PDF 切题把**下一节标题并进上一题末选项/解析**（896328 D=`⑤②④③①⑥ 三. 数量关系：在这部分试题中…`），R400 页脚规则与 `LIKE` 预筛都漏。`quality.FOOTER_SECTION_RE` 只裁尾部（`(?=$|")`），正文提及模块名不动；`select_footers` 改扫全部真题 + `_blanks_option` 守卫（选项裁后为空=选项已错位 → SKIP 不改）。生产：候选 60 → SKIP 13（全 disabled，含 1046586/1046838/1046954 选项 B 并着「B.D.」）→ **applied 47/47**（活跃 7：235971/236036/246097/896328/1046534/1046578/1272498；40 处 disabled 含 R400 漏的带空格页脚 10 处）。备份 `r409-before` quick_check ok → 写后 questions 156792/109371、七 reason 不变、`text_footer_fix` 30→77 → **不重启复访 6 页 LEAK→clean**（版本键活进程失效第四次实证）→ 活库 quick_check ok → 副本 `--restore-footers` 77/77（含 R400 的 30，表不分 reason）→ re-dry-run 0。日志 VPS `~/kaogong-reports/r409_apply.log`。
- hs 命名：SEO 题目页「花生十三讲解」改为与练习页/站内 meta 一致的「花生十三方法解析」（`seo/pages.py` 2 处 + 单测）；错题卡拿到的 `explanation` 是快照/读取层回落后的单一字串、API 不暴露来源（R396 契约），**无法标注也不猜**，不动。
- 磁盘：R408 95%（2.8 G）→ 删 r401/r402/r405/r406 中间 gz + r407-before 压缩 → 93% → 再删 r400/r407 gz → **91%（4.5 G）**；卷内只留 `bak-w3.gz` + `r409-before.gz`；docker images 7.2 G / build cache 4.0 G / volumes 13.4 G 主体为 recruit-*/softcopyright-*，未动。
- 本地 pytest 429 / ruff / pyright 0。部署 `--skip-build`（bundle 不变、仅后端）：线上 rev c79a9a8、容器 healthy 0 重启、15 min 日志 5xx/Traceback/locked 0、questions 156792/109371、quarantine 874、text_footer_fix 47+30、quick_check ok；源站 5 页（896328/1046534/331742/265250/264413）「花生十三方法解析」各 1、「花生十三讲解」0、串入文本 0；边缘 896328/1046534 DYNAMIC 同源站。Lighthouse `/` LCP 违例 WARN 同 R388–R408 形态、`/tiku/` 全过。宿主 91%（4.6 G）、load 0.9。
- 未做/遗留：3 行答案冲突 + 13 行选项错位 disabled 题需原卷；236036 中段「~ 64 ~」页码标记另一形态未扫；47 处里 40 处 disabled 只做文本卫生不改上架状态。

### R410 SOP-10 四维审计（对标粉笔错题本，仍无一手竞品截图→只审我方次级屏 375/1440 可用性 + 真人触达）→ 6 P1 + 4 P2 修复（2026-09-06，分支 devin/*-r400-formula-dropped-snapshot，base=main，bundle 变）
- 审计与决策见 docs/iter/round-3/r410-sop10-audit-book-secondary-screens.md；testing agent 报告 `~/r410_test_report.md`、录屏 `~/screencasts/r410-audit/r410-audit-edited.mp4`。生产只读：mistakes 222/60 uid、已掌握 0、错因标注 6、从未复习 54/60 uid、probe=0 作答 0 行（不归因真人）。**结构原因一手核实：列表页此前没有错因标注入口**（只有练习答错当下与复习答错后；模考错题全程无入口）——R398「卡片展开有错因自评」表述不准确，已更正。
- 8 项次级屏全部功能可达，无 P0；P1×6：375 末卡「···」被 FAB 盖（`elementFromPoint`→`fab-main`）、`uni.showActionSheet` 375 末行越过 tabbar 762 / 1440 裁切、复习错因 chip 26px、筛选 chip 24px、搜索 ✕ 24×16。修法（仅 book.vue + practice.vue 样式）：`.fabspace` 占位；「···」改页内 `.mask` sheet（R398 让位规则、48px 行、Esc 关）并放入错因自评四选一（PATCH error_reason，可取消）；`.rz/.kpchip/.rp-chip` 40px + 26rpx、`.searchclear` 40×40、`.e-btn2` 44px；已掌握 tab 专属空态；batchbar 常驻「退出」。源文件锁 tests/book-r410-audit.test.js。vitest 564 / eslint / build:h5 绿。
- 部署 rev `2541413`（build 后宿主 92%→复验后 91%/4.6 G）；testing agent R410b 复验（uid test-r410b-*，375/1440，46 行清理→LEFTOVER 0）：6 项 P1 全部复量 PASS、1440 复习全流程补做 PASS、R398 回归 PASS；容器 healthy 0 重启、5xx/Traceback/locked/slow-req 0。报告 `~/r410_regress_report.md`、录屏 `~/screencasts/r410b-regress/r410b-regress-edited.mp4`。
- 未做/遗留：粉笔一手截图仍缺；待掌握 tab 批量清空后空态仍是通用文案（P2）；stats 9–11.5px 字号、社交栏 17px 文字链、复习「下一题」初始 y774 未改；错因入口是否被真人使用待后续数据。

### R411 R410 遗留 P2 收口 + R409「3 行 hs 答案冲突」复核为解析器误报（2026-09-06，同分支 PR #619，bundle 变）
- 详见 docs/iter/round-3/r411-stats-font-floor-todo-empty-hs-conflict-recheck.md。1046855/1046866/1046874 hs 结尾均为「确认答案为 D/A/C」与 answer 一致，R409 抓的「选X的…是错拿…」是干扰项解释 → **从校源队列移除、不改库**；三题独立复算 1000/80/79 与 DB 一致。后续 hs 标记比对优先「确认答案为/正确答案为/故选」，句末「选X」仅兜底且排除「选X的…」形态。
- 13 行选项串入分节标题仍全 disabled；容器/宿主无原卷文件（只有 db 与备份）→ 校源队列标「资源缺口：需原始真题 PDF」。
- stats.vue 样式 37 处 18–23rpx → 24rpx（12px 下限）；待掌握 tab 全部掌握后专属空态「待掌握已清零」+ 去刷题。源文件锁 tests/stats-r411-fontfloor.test.js。vitest 566 / eslint / build:h5 绿。
- R411b：复验发现 predict-card（≥30 题作答后渲染）11 处 20–22rpx 仍 <12px，同法抬 24rpx；教训：字号类断言要先造够数据让条件渲染卡片出现。
- R411/R411b 生产复验（testing agent，rev ec0ab08 → d3fd10f）：stats 全页 <12px 只剩 uni tabbar 标签（框架默认）、溢出 0、热力图对齐；待掌握清零空态 375/1440 PASS；回归 PASS；清理 65+54 行 LEFTOVER 0；评论 https://github.com/wookat/kaogong-assistant/pull/619#issuecomment-5555047980 。未测 `.p-col-v/.p-col-l`（需跨日 history）。

### R412 / R412b（rev `45522cc` → `a121b5f`）
- hs 显式答案标记 vs `answer` 按 R411 新口径全量重跑（1,576 行会落到 hs 的真题）：强标记 1,376 / 一致 1,370 / **不一致 6 全 disabled**（R402 3 条维持：264787/264790/265118；新登记 297984、376412、298014（answer `AC` vs hs 单选 C））。不改库，上架前须原卷校源。200 行无标记未读。
- 社交栏 `q-social-bar`：三链/笔记操作 `.qsb-link`/`.nop` min-height 40px；R412 复验「改」`.edit` 35.2px FAIL → R412b `min-height:40px inline-flex` 实测 40.0；组件内字号全 24rpx。「🔥 热评」条运行时未量（生产 17 条评论全 deleted）。
- 生产复验清理 9+3 行 → LEFTOVER 0；questions 156792/109371、quarantine 874、paper_exports 38。
- PR #619 评论：https://github.com/wookat/kaogong-assistant/pull/619#issuecomment-5555205747

### R413（rev `7bb9fb4`，bundle 变）
- 「answer 多字母」全库 13 行全真题（活跃 8 / disabled 5），逐行读全为北京市考合法多选题，**不成批**；真问题是练习页单选实现——8 题此前永远答不对且无选项 ✓。practice.vue 加 `isMulti`/`multiSel`/`confirmMulti`/`commitPick`，选项标记按字母包含 `hasKey`；收藏卡/收藏页/搜索详情正确项按 `indexOf(k)` 标绿。复习模式 book.vue 早有 `curMulti` 流程，未改。
- 复习页作答后 `.next-btn`（下一题/确认答案）`position: sticky; bottom: calc(50px + safe-area + 16rpx)`：375 长讲解 bottom 774（视口外）→ 754，短讲解不变。
- 校源队列资源缺口合并登记（6 行 hs 冲突 + 13 行选项串入分节标题，全 disabled，需原卷 PDF）；`error_reason` 7 天观察点 ≥ 09-11。详见 docs/iter/round-3/r413-multi-answer-practice-review-sticky-next.md。
- 生产复验（testing agent）：375/1440 PASS；未测考试/模考态多选（卷库无 2015 北京卷）；预存 P2：收藏卡 `.anscmp` 23rpx=11.5px、卡内/收藏页 tag 10–11px。清理 22 行 → LEFTOVER 0；questions 156792/109371、quarantine 874、paper_exports 38。vitest 573 / eslint / build:h5 绿。
- PR #619 评论：https://github.com/wookat/kaogong-assistant/pull/619#issuecomment-5555363108

### R414（rev `e203afa`，bundle 变）
- 生产只读：全库 156,792 行 answer 空/空白/小写/未升序或重复/越界全 0 → **现有数据已规范，不迁移**；导入 `import_questions`/管理端 PATCH/治理扫描接 `db.normalize_answer()`（去空白、大写、去重、升序、按 options 键校验，非法拒绝）。
- R413 「卷库无可测多选卷」被修正：`exam_papers` 29（264342）/31（275876）/116（273027/273028/273030/273031/273032/273036）含活跃多选题且 `/api/exam/papers` 可见。模考链路此前全是单选假设（`answer[:1]`、`[:1]` 截断、点选即跳题、报告 `k === answer`）→ `exam_api._grade()` 统一三条判分（字母集完全一致才对；单选多涂仍 `status=multi` 不记分）、`answered` 口径改 `status=='ok'`、进度接受 1–4 个 A–D 归一存储、题面下发 `multi` 不带 answer；前端 `togglePickLetter` 点选切换不跳题 + `.multi-tip`，报告按包含标记。PK 本就排除多选未动。
- book.vue 42 处 / favorites.vue 4 处 18–23rpx → 24rpx（R413 预存 P2）。详见 docs/iter/round-3/r414-exam-multi-answer-normalize-fontfloor.md。
- 本地 pytest 434（+5）/ ruff / pyright 0；vitest 578（+5）/ eslint / build:h5 绿。生产复验（testing agent，375/1440，paper 116 原生作答→F5 恢复→交卷→报告→DB 对账）全 PASS；清理 25 行 → LEFTOVER 0；questions 156792/109371、quarantine 874、paper_exports 38。
- 未测/遗留：OMR 答题卡多选（生产 38 张卷无多选样本）；`.trend-kn`（需 4 周内已掌握）；`.sort-chip` 仅 CSS 无模板；单选多涂 status=multi UI 无法产生。复验顺带暴露 P2：进 exam 页不作答直接 F5 会弹「继续上次模考？（已答 0/N 题）」并留空 `exam_attempts`+`exam_progress`（既有行为，R415 候选）。

### R415（rev `50f6f26`，bundle 变）
- 生产只读取证（e203afa 容器）：`exam_attempts` 42 / 已交卷 17 / 未交卷 25（<1d 3、<7d 13、≥7d 9，17 uid）；`exam_progress` 7 行里 **6 行 picks=`{}`**——「进过页面就走」形态；原 `start_exam_attempt` 只清 >24h 且不删进度行。
- 修：`exam-resume.js` 新增 `countAnswered`/`shouldPushProgress`，`parseExamProgress` 已答 0 → null（首页/卷库不出 0/N 卡）；`exam.vue` 续考弹窗要求已答 >0，`pushProgress` 无作答无标记且从未推送过不写服务端、推送过后一律同步（清空作答也覆盖）；`db.start_exam_attempt` 清本人 >24h 未交卷 **或** 同卷且进度空/无进度行的 attempt 连同 `exam_progress` 行。`/api/exam/resume` 契约未改（历史空行由前端过滤）。详见 docs/iter/round-3/r415-exam-empty-attempt-resume.md。
- 本地 pytest 435（+1）/ ruff / pyright 0；vitest 582（+4）/ eslint / build:h5 绿。生产复验（testing agent，375/1440，paper 116）：不答 F5 不弹且旧空场次+`{}` 行回收、首页/卷库无卡、答 BD 后 F5 弹 1/62 恢复、取消后 DB `{}` 再 F5 不弹并回收、交卷报告/mistakes 一致，全 PASS；清理 9 行 → LEFTOVER 0；questions 156792/109371、quarantine 874、paper_exports 38。
- 已知取舍：**只标记不作答**时服务端会落 `{picks:{},marks:[…]}`，但 F5 按空场次新开并回收 → 标记丢失（前后端「空」口径不一致，P3，候选修法：`shouldPushProgress` 不把 marks 视为内容，或 reap SQL 把有 marks 视为非空）。不做历史 25 条空 attempt 一次性清理（各 uid 下次开考自清、用户不可见）。375 A/C/D/E 段 console 全量 dump 缺失（仅 `/api/exam/*` 全 200；1440 全段与 375 list 段全量 0）。

### R416（rev `bf23e59`，bundle 变、仅 `exam-resume.js`+`exam.vue` 一处调用）
- R415 遗留 P3 口径对齐：`shouldPushProgress(picks, pushedBefore)` 去掉 marks 参数——**只标记（旗标）不作答不再首次 POST `/api/exam/progress`**，与服务端 reap（picks 空即回收）/续考卡（已答 0 不出）三处一致；推送过后一律同步（marks 随 payload 落库、清空作答也覆盖）。后端未动。
- 本地 vitest 582 / eslint / build:h5 绿。部署：宿主同时在跑 softcopyright build + recruit 重启（load 13），首次 ssh 轮询挂起、外部 health 一度超时，最终 `poll: rev=bf23e59` 收敛、脚本 rc=0、Lighthouse 全过；容器 healthy 0 重启、30 min 5xx/Traceback/locked 0；磁盘 92%/3.9 G。
- 生产复验（testing agent，375/1440，paper 116，F5 后核 chunk `pkgA-exam-exam.BmsS0Wt9.js`）：只标记 q1/q2 ≥6s → progress POST **0**、DB 0 行 → F5 不弹直接 1/62、旧 attempt 回收；首页/卷库无卡；BD 作答后加标记 → DB marks 同步 → F5 弹 1/62 且 BD/标记均保留；取消 BD → DB `{}` → F5 不弹回收；A/BD/AC 交卷报告与 `mistakes (273028,'AC','ACD')` 一致；1440 只标记同过；**375 八段 + 1440 两段全量诊断 dump**（补齐 R415 缺口）non-2xx/console/pageerror/rejection 0；清理 6 行 → LEFTOVER 0；mistakes 231 / answer_log 1070 / growth_events 584 与 R415 结束值零漂移；questions 156792/109371、quarantine 874、paper_exports 38。
- 未测：只标记后直接离页（onHide flush）路径；恢复后仅新增标记的同步（步骤 2 间接覆盖）。既定口径：只标记不作答 F5 后标记不保留（本就不落库）。

### R417（rev `e2a241d`，bundle 不变、后端 1 行 + 单测）
- 顺着 R416 未测路径读码取证到真问题：`save_answer_log_detail` 写 `answer_log.picked` 用 `str(picked)[:2]`——R413/R414 让多选题可作答后，**多选错选 3–4 字母（ABD/ABC）会截成 `AB` 落库**，下游「易错项」（`refresh_question_stats` → `most_wrong`）、错题卡「历次作答 · 选 X」（`question_attempts`）、作答历史三处口径失真。改为 `normalize_answer(picked)[:8]`（大写/去重/升序，与判分同口径）。生产存量 `picked` 长度分布 `{NULL:429, 1:641}`、含多选题的行仅 1 条（273028 选 A，R413 前）→ **无已损坏数据、无需迁移**；R413–R416 复验用的 AC/AB/BD/AD 恰全是 2 字母，所以此前未暴露。
- vitest 源锁：`exam.vue` 只有一处 `request('/api/exam/progress')`，onUnload/onHide → `flushProgress` → `pushProgress`，`toggleMark` → `saveProgress`，全走 `shouldPushProgress` 闸门。
- 本地 pytest 436 / ruff / pyright 0；vitest 583 / eslint 绿。`--skip-build` 部署（宿主 load 7–9、free ~100 MB，compose build ~5 min），`poll: rev=e2a241d` 01:12:17Z；healthy 0 重启、20 min 5xx/Traceback/locked 0；磁盘 91%→92%/3.9 G。
- 生产复验（testing agent，paper 116，375/1440，容器内直查 `/data/data.db`）全 PASS：273028 ABD / 273027 ABC / 273036 BD 交卷 → 报告「你选了 ABD/ABC」、DB `answer_log ('ABC',0) ('ABD',0) ('BD',1)`、`mistakes.user_answer` ABC/ABD、错题卡 `.att-pick`「选 ABD」；练习页从 `/tiku/q/273031` CTA 深链多选 ABD 确认 → DB `('ABD',0,'seo_q')`；**R416 未测路径 1**：只标记 q1/q2 → 「<」离页（onUnload flush）→ 7 s 内 progress POST 0、DB 0 行、无续考卡、再进卷旧场次回收；**R416 未测路径 2**：BD 落库 → F5 恢复 → 只标 q5 → POST picks 不变 marks `[260470]`、DB 同步、再 F5 旗标/BD 保留；1440 同过；375 九段 + 1440 一段全量诊断 non-2xx/console/pageerror/rejection 0；清理 14 行（含 `practice_progress`）→ LEFTOVER 0；mistakes 231 / answer_log 1070 / growth_events 584 / paper_exports 38 / questions 156792/109371 / quarantine 874 零漂移。
- 未核：`most_wrong` 由后台按 probe=0 聚合，探针流量不刷新，不伪造。取证口径：LS `examProgress`/`pendingSession` 非 uid 作用域，同设备换 uid 会误弹一次续考/续练卡（真实用户单设备单 uid 不受影响）。
- 生产只读观察（不归因真人）：`answer_log.probe` 分布 NULL 1040 / 0→1 行 / 1→29；`exam_attempts` 50（已交 17 / 未交 33，其中 `exam_progress` 7 行 6 行 `{}` 为 R415 前存量，各 uid 下次开考自清）。

### R418（rev `4c58e07`，bundle 不变、后端 + 脚本 + 单测）
- 顺着 R417「most_wrong 按 probe=0 聚合」读跨用户聚合取证：**`exam_attempts` 无 `probe` 列**，卷库 takers/avg（`_list_exam_papers_base`）、SEO 卷页「已有 N 人模考」（`exam_paper_social`）、模考报告排行榜/击败比例/模块均值（`insights.api_exam_rank`）、比赛分数池（`mock_event._score_pool`）四处全体已交卷 uid 一律计入。生产真人可见污染：paper 5 登录用户 `u6` 报告池含 `test-w4-mp`（卷卡「2 人考过」）、paper 197/203/204/219/227 卷卡「1 人考过」全为走查 uid。
- 修：`add_column_if_missing(exam_attempts.probe INTEGER)`；`/api/exam/start` 传 `auth.probe_request(request)` → `start_exam_attempt(..., probe=)` 写 1/0；四处读取接 `REAL_TRAFFIC`，排行榜 pool 为 `(REAL_TRAFFIC OR uid=本人)`（探针看自己报告 total≥1、board 有 me）。新脚本 `scripts/r418_probe_backfill_test_uids.py`：`test-%` 且 `probe IS NULL` 行回填 probe=1（dry-run 默认 / `--apply --record` 落 (table,id) / `--restore`），不删行、不碰 `mistakes`（无 probe 列）、不动普通匿名 NULL。详见 docs/iter/round-3/r418-exam-attempt-probe-cross-user-aggregates.md。
- 本地 pytest 438（+2）/ ruff / pyright 0。`--skip-build` 部署 `poll: rev=4c58e07`，Lighthouse 全过（`/tiku/` LCP 960）。生产回填：dry-run → `/data/r418-before.db` 449 MB 备份 → apply **answer_log 39 / growth_events 27 / exam_attempts 19**（记录 `/data/r418-probe-backfill.json`）→ re-dry-run 0 → `test-*` probe NULL 三表全 0、非 `test-*` 行未动（answer_log probe=1 非 test 1 行、growth_events 30 行为 R374/R386 自动打标存量）→ 分布 answer_log NULL 1001 / 0→1 / 1→68，growth_events NULL 480 / 0→7 / 1→97，exam_attempts NULL 31 / 1→19 → `refresh_question_stats` 已按新口径重算（906 题；仅 test-* 作答的题 attempt_count 回 NULL，143960 只剩匿名 1 行）→ `/api/exam/papers` 过 SWR 后 paper 5 takers 2→**1**、197/203/204/219/227 1→**0**；容器内 `api_exam_rank(13,'u6')` total 1、board 仅 u6；SEO `/tiku/papers/5`「已有 1 人模考 · 平均 1.3 分」。
- 生产复验（testing agent，paper 116，375/1440）全 PASS：出口 `140.232.64.4` 命中 `KG_PROBE_CIDRS` → 原生开考 attempt 299 `probe=1`；本人报告「排名 1/1 · 样本 1 人」、`/api/exam/rank/299` board 仅 me；交卷 305 s 后 `/api/exam/papers` 116 takers 仍 0、卷卡无「人考过」、SEO 无「人模考」；`/api` non-2xx / console / pageerror / rejection 0；healthy 0 重启、60 min 5xx/Traceback/locked 0；load 2.07 时 `quick_check` ok；清理 4 行 → LEFTOVER 0；questions 156792/109371、quarantine 874、paper_exports 38、mistakes 231、answer_log 1070。
- 观察：growth_events 584→**586**，+2 为复验前 uid `umtp6aesg1ulp6zv2`（probe=1）boot/heatmap_view，其他探针会话产生，非本轮漂移。宿主：回填时 quick_check 进 D 态、load 峰 11.8（free ~90 MB，其他项目并发），ssh 通道两次挂起需 kill 重连；磁盘 91→92%/4.2 G（`/data/r418-before.db` 449 MB 待 gzip/删）。UI「同卷排行榜」列表 total=1 不渲染是 `exam-board.js rows<2` 既定逻辑。
- 未做：`mock_event_entries` 比赛名次未加 probe（报名是显式行为，走查 uid 未见入表）；`mistakes` 表无 probe 列，`test-*` 8 行保留；`probe=NULL` 匿名历史行仍按兼容口径计入、不可归因真人。

### R419（rev `3c1cf71`，bundle 不变、后端 + 脚本 + 单测）
- R418 两问生产只读取证（4c58e07 容器）：`mock_event_entries` 全表 1 行（`event_id=3, u15`，只报名未交卷）、`test-*` 0 行、无 `probe` 列，跨用户读取（`_counts`/`_freeze_ranks`/`api_event_rank`/`report` total）只读该表且分数池已在 R418 接 `REAL_TRAFFIC` → **无污染证据，不为口径统一加列**；`mistakes` `test-*` 8 行（3 uid），全部 `FROM mistakes` 读取均带 uid 条件（stats/_due_by_tag3/推荐强化候选/mistake_analysis_stats/report.reasons/review log 连接）→ 不改不删。
- 顺带取证到真问题：`mock_events` 12 行里 **同窗口重复 2 组**——09-12 窗口 8 行「第5期」（id 8–15，created_at 00:19:47.99–48.28，与 caddy 源站日志 8 次并发 `/api/mock/events` 逐个对应）+ 09-05 窗口 2 行（6「第3期」/7「第4期」，相隔 5 h，08-30 日志已轮转未归因）。根因：`ensure_weekly_event` 的 SELECT 存在性检查走无锁快照、INSERT 才 BEGIN IMMEDIATE，多线程同过检查各插一行；表无唯一约束。用户可见：`next` 只取一条（「第5期」编号错，真实前序只有 3 场）、`past` 同日两场。
- 修：`ensure_weekly_event` 快检 → `_pick_paper_id`（锁外，可能建卷并 commit）→ `BEGIN IMMEDIATE` → 锁内二次检查 → INSERT，`IntegrityError` 回滚；`init_mock_event_db` 建 `UNIQUE INDEX idx_mock_events_window(series,open_at,close_at)`（`ensure_window_index` 库有重复时返回 False 不抛）；管理端撞窗口 409；`_ensure_exam_tables` `secs/marks` 改 `add_column_if_missing`（并发单测在空库暴露）。脚本 `scripts/r419_dedupe_mock_events.py`：组内留有登记行否则留最小 id、≥2 行有登记跳过、dry-run 默认、`--apply --record` 落全字段、`--renumber` 才重排期号、`--restore` 原 id 重插+标题还原+删索引。详见 docs/iter/round-3/r419-mock-event-duplicate-weekly-race.md。
- 本地 pytest 443（+5）/ ruff / pyright 0。生产先改库再部署：`/data/r419-mock-events-before.json`（两表全字段）→ apply `--renumber` → `deleted 8, retitled 1（8「第5期」→「第4期」）, index 已建`（记录 `/data/r419-mock-events-dedupe.json`）→ re-dry-run 0、表剩 1/3/6/8、entries 仍 1 行 u15、quick_check ok → 不重启 `/api/mock/events` `next` 即「第4期」。`--skip-build` 部署 `rev=3c1cf71`，Lighthouse 全过（`/tiku/` LCP 950）；6 并发 `/api/mock/events` 全 200 后仍 4 行、重复组 0；healthy 0 重启、20 min 5xx/Traceback/locked 0；磁盘 94%/2.9 G（build 后回落）、free ~100 MB、load ~2。
- 生产复验（testing agent，`test-r419-ui`，375/1440）全 PASS：首页「模考大赛」→ contest hero 恰 1 张「第4期」（paper 95，9月12日）、往期第3/2/1期各一条、页面与 DB「第5期」0；原生「预约报名」→ toast →「已报名，开赛后可进入」「1 人报名 · 0 人交卷」→ F5 保持 → API `my_state 已报名`；多次 GET 后 `mock_events` 仍 4 行、唯一索引在位；`/api` non-2xx / console / pageerror / rejection 0；清理 1 行 → LEFTOVER 0、u15 保留；healthy 0 重启、30 min 日志 0。
- 观察（P2，未改）：contest `fmtWindow` 按浏览器本地时区格式化，非东八区访客看到「01:00 - 16:00」与赛制说明「09:00-24:00（东八区）」不一致，R420 候选。未在生产实测管理端 409（单测覆盖）。6/7 重复成因未归因，唯一索引兜底。

### R420（rev `2573df1`，bundle 变、前端 3 页 + 新 helper，后端不动）— SOP-10 四维审计（模考大赛簇）
- 审计口径同 R398/R410：粉笔无一手截图，零竞品陈述、不加功能；本轮审此前两轮未覆盖的「模考大赛」簇（首页卡 → contest → 榜单弹层 → contest-report → 周报「下一场」）。取证文档 `docs/iter/round-3/r420-sop10-audit-contest-cst-fontfloor.md`。
- 一手命中：① 后端 `_saturday_window` 固定东八区，`contest.vue` 却按设备本地时区格式化——**东八区真实用户往期日期 `fmtDay(close_at)` 显示成次日**（close_at=周日 00:00 CST），非东八区访客窗口「01:00 - 16:00」与赛制说明不一致；② contest 7 处 / contest-report 8 处 18–23rpx 低于 24rpx 下限；③ 榜单 `.sheet-x` ✕ 热区 ≈31×23px。
- 修：新 `src/contest-time.js`（`cstParts` 用 UTC getter 读 +8h 平移时间，不经设备时区/DST）；contest `fmtWindow`/`fmtDay(p.close_at - 1)`、weekly-report `fmtDayHour` 共用；字号 → 24rpx；`.sheet-x` 40×40。vitest 591（+8，`TZ=UTC/Asia/Shanghai/America/Los_Angeles` 各跑）/ eslint / build:h5 绿。
- 生产复验（testing agent，`test-r420-ui`，375/1440，CDP `setTimezoneOverride` 三时区各真实 F5）全 PASS：`.hm` 三 TZ 均「9月12日 09:00 - 24:00」、往期 09-05/08-15/08-08；全页 <12px []；✕ 40×40 命中；contest-report 两种空态；报名→F5 回归；`/api` non-2xx 仅预期 404、console 0；healthy 0 重启；`mock_events` 4；清理 1 行 LEFTOVER 0。untested：周报「下一场」链接（周报 empty 态）、报告正文（无人交卷不造数据）。
- 审计其他维度：管理台**无比赛任何可见面**（只有 `POST/DELETE /api/admin/mock/events` 接口，P2 登记不做）；caddy 08-31 起 `/api/mock/events` 127 条全探针、真人 0、entries 1 行 u15 只报名——比赛功能无可证明真人使用。1440 `.mask` 以 App.vue ≥1366 壳体规则为基准（288..1345）居中，非全视口，属既定设计。

### R421 / R421b（rev `42f31aa` → `adfdc17`，bundle 变；后端 `llm.py`/`engine.py`/`ai_api.py` + 前端 `api.js`/`ask-link.js`/`ask.vue`）— AI 讲解首字前长空白
- 一手取证：生产 `/api/explain/stream` 真实浏览器 referer、200 但 ~79 s；容器内直连上游探针（模型名/主机名可打印、密钥不打印）：`extract_question` 14.75 s + 流 headers 2.4 s → reasoning 首包 2.4 s → **正文首字 44 s** → done 52 s，reasoning 增量 2754 个 / 正文 665 个。两段根因：① 题库题深链也要过一遍识题 LLM 才发 meta；② 主通道 `deepseek-v4-pro-0817` 为推理模型，`reasoning_content` 在 `chat_stream` 被丢弃，正文首字前客户端零信号。取证文档 `docs/iter/round-3/r421-explain-stream-linked-qid-thinking.md`。
- 修：`POST /api/explain/stream` 新增可选 `question_id`（Form）；`engine.extract_from_qbank(q, text)` 题干前 40 字（去空白）逐字命中 + 模块合法才直通（`known_answer` 取题库 answer、disabled 行不取答案），否则 `None` 回 `extract_question`（fail-closed）；`_explain_messages` 有 `known_answer` 时加「题库标准答案：X，讲解须以此为准」；`llm.chat_stream(with_thinking=True)` 对 reasoning 增量产出 `llm.Thinking(chars)` 标记（默认 False 行为不变，`@overload` 保证旧调用方类型仍为 `str`）；`ai_api` 每 ≥`THINKING_TICK_SEC`=1 s 发 `event: thinking` `{"secs","chars"}`（不含推理文本）；前端 `streamExplain({questionId,onThinking})` 三端上送、`feedSse` 解析 thinking；ask 页流式卡占位「生成中…」→「AI 正在推理…（已 N 秒）」/「AI 推理接近完成…（已 N 秒）」（`thinkingLabel`）。R421b：ask「存入错题本」`save(r)` 带 `question_id: askQid(r.qid) || null`（复验 P1：ask 存入行 qid NULL → 错题卡再问无 redoQid/无「查看原题」）。
- 已知口径：原文缓存命中走 `_linked()` 之前的快路径，meta.qid 为 null，前端用自身 qid 回填 rec.qid；含图请求不走直通。
- 生产探针（X-Kg-Probe）：linked qid 297481 **meta 0.28 s**（原 12–15 s）、thinking 首发 3.2 s、26 个心跳、正文 29.9 s、done 36.3 s、meta.qid=297481；错 qid 243872 → 回识题 meta 7.9 s、qid null、thinking 30 个；同题第二次 cached 0.25 s。
- 复验（testing agent，`test-r421-ui`/`test-r421b-ui`，375/1440）：深链 709458 FormData 带 `question_id`、meta 186 ms、thinking 27 个键恰 `{secs,chars}` 间隔 1.0–1.16 s、占位文案递增到「已 30 秒」、正文 30.4 s 无推理草稿、「查看原题」可跳；无 qid 手输 meta 10.4 s、thinking 61 个、正文 75.9 s；缓存秒回 0 thinking；1440 深链 709452 同过；回归 存入/追问/同款题/历史；`/api` non-2xx 0、console 0；healthy 0 重启、5xx/Traceback/locked 0；清理 LEFTOVER 0。R421 FAIL（ask 存入丢 qid）→ R421b 复量 PASS：DB 行 `question_id 709458`（与练习自动存行按 qid 合并 times 2，R421 P2「同题两张卡」随之消失）、错题卡再问带 qid + 「查看原题」。
- 遗留：practice 页答错 `uni.vibrateShort` 无 fail 回调 → `unhandledrejection vibrateShort:fail`（P2，桌面 Chrome 噪音）；无 qid 路径识题 LLM 8–15 s 仍在（含图/手输无题库可对）；`error_reason` 观察点 ≥09-11。本地 pytest 453（+10）/ ruff / pyright 0；vitest 597（+6）+1 / eslint / build:h5 绿。

### R422 / R422 运维（rev `9e657da`，bundle 变；后端 `llm.py`/`engine.py` + 前端 `practice.vue`；另两处生产配置不入库）— 无 qid 识题 8–15 s / vibrateShort rejection / 视觉通道 / SSE 被 gzip 缓冲
- 一手取证（容器内直连上游，密钥不打印）：旧无图识题 `chat_fast` **rescue 优先**走 `kimi-k3` 推理模型，4 道真题 8.6–18.4 s（`reasoning_tokens` 171–513，关 thinking 参数不稳定）；主文本通道 `deepseek-v4-pro-0817` 显式 `{"thinking":{"type":"disabled"}}` 后 2.4–3.3 s、`deepseek-v4-flash-0817` 1.9–2.5 s，模块 4/4 与题库一致。取 text pro nothink（够快且保守）。取证文档 `docs/iter/round-3/r422-extract-nothink-vibrate-caddy-sse-gzip.md`。
- 修：`llm._body(..., think)` 非 think 加 `thinking.disabled`；`chat/chat_fast/chat_json` 透传 `think`；`chat_fast(think=False)` 主文本通道优先、5xx/配额仍回落 rescue（同带关闭参数）；`engine.extract_question` 无图 `fast=True, think=False`、含图 `fast=False, think=True`（图片路径不变）。practice 页两处 `uni.vibrateShort` 补 `fail: () => {}`。单测 `test_r422_extract_no_think.py`（+6）+ `practice-r422-vibrate-fail.test.js`（源锁）。
- 生产探针（X-Kg-Probe）：无 qid 五模块 meta **3.0–4.5 s**（原 8–15 s），正文首字仍 20–92 s（解释模型 reasoning，本轮不改）。
- **运维 1（视觉通道）**：复验发现含图路径 `AI 服务未配置`——生产 `.env` 自 R17 起只配 `LLM_TEXT_*`/`LLM_RESCUE_*`，`_endpoint()` 对含图消息要 `LLM_BASE_URL/LLM_API_KEY`。文本网关 `/v1/models` 82 个模型含 `qwen3-vl-*`/`glm-4.6v`/`doubao-seed-2.0-*`；两张真题截图容器内 `extract_question` 实测 qwen3-vl-plus 2.9–5.4 s 2/2 正确（flash 2.6–3.3、235b 4.3–5.0、glm 5.4–7.0、doubao-pro 9.8–9.9 均正确）。生产 `.env` 追加 `LLM_BASE_URL/LLM_API_KEY`（=文本网关）+ `LLM_MODEL=qwen3-vl-plus`，备份 `/home/ubuntu/env.bak.r422`，`docker compose up -d --no-build` 重建 healthy 0 重启。**只验 2 题，低清/多图/材料题未验**。
- **运维 2（SSE 被 Caddy gzip 整条缓冲，影响 23.8% 活跃题）**：含图 235804 经边缘 meta 与正文同刻 71 s 到、直连容器正常 → 逐层定位到 Caddy `encode gzip`：首个 flush ≥512 B（默认 `minimum_length`）才决定压缩，一压就把整条 `text/event-stream` 攒到结束（Caddy 直连 `curl --compressed` 复现，响应头多 `vary: Accept-Encoding`；Worker 回源自带 Accept-Encoding，客户端 `identity` 无效）。meta 事件含题干，题干 ≥~110 字即 ≥512 B：只读扫库 **活跃 109,371 题中 26,068（23.8%）**，言语 78.1%、资料 95.7%、判断 19.1%，explain_cache 99 条历史讲解里 30 条属此类——即 R421 thinking 心跳对这些题从未到达用户。修服务器 `/etc/caddy/Caddyfile` 两个 kaogong 块 `encode gzip` → `@nosse not path */stream` + `encode @nosse gzip`（备份 `Caddyfile.bak-r422`，validate → reload），未动其他项目块；口径写入 `deploy/README.md`。
- 复验（testing agent 两轮，`test-r422-ui`/`test-r422b-ui`，375/1440）：无 qid meta 2.5–3.7 s、深链 188–256 ms、缓存 159 ms；practice 判题 `__pexc []`（rejection 0）、多选 273031 `ACD`；含图 375 拖入 → meta 3.18 s `shuliang/周期与日期` thinking 44 逐秒 正文 51 s「【答案】A」；长题 235804（180 字）无 qid 375/1440 thinking 61/47 个逐秒（done 前 5 s 0 个）、深链 thinking 37/45 逐秒；6 条 stream 响应头无 `content-encoding`、`encodedBodySize==decodedBodySize`；`/api` non-2xx 0、console/pageerror/rejection 0；healthy 0 重启、5xx/Traceback/locked 0；清理 LEFTOVER 0，explain_cache 回基线 99。本地 pytest 459（+6）/ ruff / pyright 0；vitest 599（+2）/ eslint / build:h5 绿。
- 遗留：解释正文首字 40–70 s 是上游推理模型行为（可见进度、未缩短）；`known_answer` 与讲解首行答案一致性只核了单题、未批量抽样；`error_reason` 观察点 ≥09-11（只看 probe=0）；interview 两个 SSE 端点同受 gzip 规则保护但未实测。

### R423 / R423b（rev `cb61b1f` → `795377a`，bundle 变；后端 `interview.py`/`sse.py`/`llm.py`/`db.py` + 前端 `interview.vue`/`api.js`/`ask-link.js` + 对账脚本）— 讲解首行答案对账 / 面试 SSE / 视觉补样 / error_reason
- explain_cache 99 行讲解首行【答案】vs 题库 `answer`：OK 28 / **CONFLICT 6** / SUSPECT 24 / NO_FIRST 8 / UNMATCHED 33 / MATCH_DISABLED 0。6 行冲突逐行核题库解析+hs 均支持题库 answer（1273222 B、183439 C、245781 B、235804 A），**只删缓存 6 行不改题库**（`scripts/r423_explain_cache_answer_audit.py --apply`，记录 `/data/r423-explain-cache-conflicts.json`，`--restore` 副本演练可还原且幂等），生产 explain_cache 93。explain_cache 幂等加列 `qid`（题库直通命中时落）。
- 面试：打分 `_grade()` 改主通道关推理（rescue kimi-k3 8.6–29 s → 2.5 s）；两条点评流走新 `sse.relay()` 发 `event: thinking {secs,chars}`，前端占位「考官正在思考…（已 N 秒）」；边缘实测两流均无 `content-encoding`（R422 Caddy 规则覆盖）。**R423b**：上线后抓到点评正文空（推理 ~4930 字后 done）——直连上游 reasoning_tokens 2966 时 completion 4007 > 旧预算 4000 → `REVIEW_MAX_TOKENS=8000`；`chat_stream` 记 finish/正文/推理字数，`finish=length` 或正文空时 warning（不透出推理）。
- 视觉补样（qwen3-vl-plus，探针）：材料题 157897 截图 → ziliao/比重计算、【答案】D 正确（meta 10.2 s，正文 71 s）；低清 360px JPEG q35 36 KB → 识题逐字命中缓存键、【答案】A 正确；多图：API 单 `image` 字段、重复字段只取最后一张，前端 `chooseImage count:1`，UI 产生不了多图 → 登记 P3 不加功能。
- `error_reason`：观察点 ≥09-11 未到期（服务器 09-06）；全时段 6 行非空全在 probe=NULL uid（历史口径），probe=0 uid 0 行；`mistakes` 无 probe 列，按 uid 关联 answer_log.probe 分类，不加列不改行。
- 复验（testing agent，375/1440，`test-r423-ui-1/2`）：(a)–(g) 全 PASS——meta 2.9/4.5 s、thinking 逐秒 41/40 个、正文 3785/2801 字无推理泄漏、重进/F5 落库一致、3 流无 content-encoding enc==dec、thinking 阶段 F5 中断 → 「重新生成点评」regen 3451 字落库；`/api` non-2xx 仅预期 404 ×2、console 0、容器 healthy 0 重启、5xx/Traceback/locked 0。清理 interview_sessions 18–23 + 探针 explain_cache 1 行 → LEFTOVER 0。
- 本地：pytest 468 / ruff / pyright 0；vitest 603 / eslint / build 绿。取证 `docs/iter/round-3/r423-explain-cache-answer-audit-interview-sse-vision-samples.md`。
- 遗留：点评正文首字 30–47 s 仍是上游推理行为；SUSPECT/UNMATCHED 57 行讲解无真值不判；真实手机拍照样本未做；`error_reason` 到 09-11 再看（只看 probe=0）；**高负载时段勿在生产库跑无索引全表 LIKE**（本轮一次 >10 min 中止）。

### R424 / R424b（rev `4c45fd5` → `1085031`，bundle 不变；后端 `llm.py`/`interview.py`/`engine.py`/`ai_api.py` + 单测）— 面试点评关推理 / 讲解「题目存疑」兜底收窄 / 缓存处置
- 一手取证（容器内直连上游，同题同答同提示各 2 次）：pro-thinking 正文首字 **52–62 s**（reasoning 3.3–4k token）→ **pro-nothink 1.8–6.6 s**，逐段引用/✅/⚠️ 计数 4/4/4 同级、三节齐、token 5.3–5.9k → 1.7–1.8k；flash-nothink 1.6–4.1 s 但引用 3/3/3 更泛，flash-thinking 两次波动（一次上游未推理）。**决策：点评走主通道关推理，不切 flash**。取证 `docs/iter/round-3/r424-interview-review-nothink-suspect-heuristic.md`。
- 修：`llm.chat_stream(think=)` 流请求体复用 `_body()`（`think=False` 带 `thinking.disabled`）；`interview.py` 首次流/regen 流/非流点评均 `think=False`，流路径保留 `with_thinking=True`（上游若忽略 disabled 仍发 thinking 心跳）。生产探针 `answer/stream` meta 2.59 s → 正文 3.90 s → done 20.8 s、thinking 0。
- explain_cache 24 行「题目存疑」归类：17 行兜底死规则固定文案（8 乱码+选项、4 噪声/空/无选项、**4 行 3 题合法数列/类比被 `<8 汉字` 误拦并永久缓存**、1 极短算式）+ 7 行模型自判（缺图/缺数据/矛盾/残缺，保留）。兜底收窄为「≥3 选项 且（汉字 ≥4 或 **独立数字项** ≥3）放行」——R424 首版按数字字符 ≥4 放行被生产探针证伪（`7f3q9z k2m A.1…` 放行后模型硬编【答案】B 并入缓存）→ **R424b** 改独立数字项；存疑固定文案不再写缓存（流/非流）。`1+1等于几？A…` 仍拦（保守）。
- 生产缓存处置（可逆）：`~/r424_cache_apply.py` dry→apply 删 18 行（17 固定文案 + 1 首版探针错讲解），记录 `/data/r424-explain-cache-suspect.json`；explain_cache 94 → **76**；副本 restore 演练 76→94 存疑回 24。生产复测：数列「【答案】B」、类比「【答案】D」、乱码 2.76 s 秒回存疑不落缓存、缺图题模型自判存疑。
- 复验（testing agent，`test-r424-ui-1/2`，375/1440）(a)–(f) 全 PASS：面试 3 流 thinking 0、正文首字距 meta 1.3–1.6 s、2386/2641/2998 字无泄漏、正文中 F5 → regen 1.5 s 落库；ask 数列/类比走模型、乱码秒回存疑 `7f3q9z%` 0 行；`/api` non-2xx 仅预期 404、console 0、healthy 0 重启、Traceback/locked/finish=length 0；清理 LEFTOVER 0、explain_cache 回 76。本地 pytest 475（+7）/ ruff / pyright 0。
- 观察：首个有量的 `probe=0` uid `umst3tuisd7lgzaka`（vivo V2405A WebView、中国移动 IP，09-06 两次到访 241 API、22 作答/16 错题、3 次 `wxlogin` 503）——R386 已登记同机为 MiniProgramEnv 走查设备、行为与内部验收一致，**按候选真人登记不归因外部真人**；`error_reason` 该 uid 0 行、全局 probe=0 仍 0 行，观察点 ≥09-11。
- 遗留：极短算式仍拦；flash 替代 pro 样本不足不下结论；点评总时长 30–38 s 由 2.7–3k 字正文决定；宿主 load 10–11、free ~76 MB、磁盘 94%/2.9 G；Lighthouse LCP 2737 一次超预算（bundle 未变、宿主负载）。

### R425（2026-09-06）首个 probe=0 设备逐页复盘 / 小程序 wxlogin 503 反馈 / 点评字数——只取证登记、不改码不部署
- 取证 docs/iter/round-3/r425-probe0-device-path-wxlogin-503-review-length.md。`umst3tuisd7lgzaka` 是**已发布微信小程序**（Referer servicewechat.com/wx01f2f29cfe51baba）在 vivo V2405A 上的访问：caddy 9 个文件全量 327 行、6 次到访；09-06 08:55–08:58 主链路 = wxlogin 503 ×2（2 s 内）→ 资料 10 题（11 s 内 1 题/s）→ 综合 10 题 → review/1952 → PATCH mistakes 2815/2819 标掌握 → growth ×7；DB `answer_log` 20 行 / `mistakes` 14 新建 + 1952 review_count 0→1 逐条对应，API 全 200 ≤0.66 s。行为是「点过去」+ R386 已登记同机走查 → 仍按候选真人/内部走查登记，不改 probe。
- wxlogin 503：小程序 `utils/request.ts` 透传 `detail`，登录页 `l-err` 直显「微信登录暂未开通（服务端未配置小程序密钥）」（源码推断未真机截图）；根因是 `WX_MINIAPP_SECRET` 资源缺口，小程序端改动需微信开发者工具发布不在 H5 管线内 → 不改，P3：密钥到位后真机复验登录成功（`users` 出 `wx:` 行）。
- 点评总时长：上游关推理吐字 57–59 tok/s ≈ 95 汉字/s，总时长 = 首字前 1.3–4 s + 正文长度/速率，纯线性无隐藏等待；流式 95 字/s 远快于阅读速度，不构成可感知等待；`_review_prompt` 无字数约束，生产无真实用户读点评的行为数据 → **不收字数**，P3 待 probe=0 面试会话后看停留/滚动再定。
- `error_reason` ≥09-11 再看（probe=0 仍 0 行）。宿主状态未变（未部署）。

### R426（rev `dc69266`，bundle 变；后端 `db.py`/`study_api.py` + 前端 `practice.vue` + 单测）— 小程序 API 契约核对 / `practice_results` 探针口径
- 取证 docs/iter/round-3/r426-miniapp-api-contract-practice-result-probe.md。以 R425 小程序真机调用集合 + `miniapp-native/api/index.ts` 44 个函数逐条核后端/H5：uid 作用域、错误透传、probe 判定全在服务端，均一致；**唯一命中 `POST /api/practice_result`**——表无 uid/probe，「本组正确率击败了 X% 的刷题记录」（H5 与小程序同文案）池 = 全表，R375 接探针口径时漏掉，SKILL 早已登记「测试行无法归属、不清理」。
- 生产只读：286 行、按日 08-14 18 / 08-31 31 / 09-04 35（走查日）、正确率 p25 已 100%、p10 只 10%；时间关联 answer_log 仅 85 行可匹配（test uid 的 answer_log 早被清理），probe=0 只有 R425 那台 vivo 的 2 行——**这张表的 NULL 不能套 `REAL_TRAFFIC` 兼容口径**。
- 修：幂等加列 `uid`/`probe`；`PRACTICE_POOL = "n>0 AND probe=0"`（严格，与 `REAL_TRAFFIC` 并列注明）；端点读可选 `uid` + `probe_request`；H5 payload 加 uid；管理台 `daily_usage` 接 `REAL_TRAFFIC` 并先 ensure 列。历史 286 行不删不回填（无 uid 不可归因）；回滚 = 谓词改回。**上线后「击败 X%」不显示，直到累计 10 次 probe=0 完成**（如实而非回归）。
- 复验 PASS（375 ×2 + 1440 ×1，XHR body/DB/日志/清理 LEFTOVER 0）；附带发现 `daily_usage` 无任何管理台页面渲染（P3）。P3：小程序 `postPracticeResult` 下次发布补 uid。宿主部署前 load 1.5、磁盘 91%/4.7 G → 4.4 G。

### R427（rev `7464985`，bundle 不变；后端 `pk.py` + 回填脚本 + 单测）— `share/create`/PK 跨用户口径复核 → `pk_matches.probe`
- 取证 docs/iter/round-3/r427-pk-matches-probe-leaderboard-random-match.md。`share/create` 无跨用户读取、分享作答 `q_stats` 走 `answer_log`+`REAL_TRAFFIC`（R375 已接）、`pk/result` 是单局公开比分、`pk/mine` uid 作用域——均不涉及；**命中 `GET /api/pk/leaderboard`（全站周榜）与 `POST /api/pk/random_match`（全站等待池）**：`pk_matches` 无 `probe` 列无谓词。生产一手：匿名榜实测 3 个胜者全是 `test-w*` 走查 uid；等待池 12 局里 11 局是 R8–R19 走查残留、真人随机匹配会配到幽灵局。
- 修（同 R418 口径）：幂等加列 `probe`；create 按 `probe_request` 写、join `MAX(COALESCE(probe,0),加入者)`；random_match 池 `COALESCE(probe,0)=请求方`；leaderboard `REAL_TRAFFIC OR 本人参与`。历史 21 行团队命名 uid（`test-*/devin-test-*/r<N>-*/opponentuid12345`）回填 probe=1（记录 `/data/r427-pk-probe-backfill.json`，`--restore` 可还原），5 行 `ums…` NULL 不动、不删行。
- 生产：dry-run 21/26 → 部署 rc=0 → apply 21/21 → re-dry 0；匿名榜 `items:[]`。部署窗口另一会话（wechatdevtools UA `test-w6-social-mp`）新建 PK 行写入侧即 probe=1。复验 PASS（375/1440：A 胜 B 后 A/B 可见、第三方 C 与匿名空榜；探针随机匹配 shuliang 不吃真人 `ZBFS14`；non-2xx/console 0、healthy、清理 LEFTOVER 0、表回 27 = NULL 5 + probe1 22）。
- 登记不改：P2 分享作答页只能单选、多选题分享后必判错（生产分享/作答全为内部 uid）；P3 `daily_set_entries` 无 probe（0 行）；P3 PK 大厅 chip 切换后 1 s 内点「发起好友挑战」一次 XHR status 0（复验观察，未到服务端）。仍：`.trend-kn` 字号需 4 周已掌握样本；`error_reason` ≥09-11 看 probe=0；SOP-10 审计 ~R430。

### R428（rev `5e8f7f1`，bundle 变；后端 `team.py` + 前端 `share-q.vue` + 单测 3/vitest 3）— 分享作答多选题：`picked[:2]` 截断必判错 → 归一判分 + 勾选后确认
- 取证 docs/iter/round-3/r428-share-answer-multi-select.md。源码：`api_share_answer` `upper()[:2]` + 原样比对（3–4 字母答案必错、乱序也错）、`_sanitized_question` 不回多选信号、`share-q.vue` 点选即提交——分享页是 R413/R414 之后唯一的多选口径孤岛（全库 `[:2]` 最后一处）。生产只读：活跃多选题 8 道（全 changshi、北京市考 2015 ×6 / 2021 ×2）；`shared_questions` 现存 15 行无多选题引用；**唯一历史命中 `answer_log` 08-09 `umsm4wiud2zgvl9pt` 经分享作答 273028（ACD）picked A 判错**（probe=NULL、uid 无其他痕迹、分享行已清，不可归因真人）；`probe=0` 分享事件只有 09-06 vivo 小程序 `share_copy` + 同 sid 2 次 `share_open` 未作答 → 无可确认真人受害，但路径在生产被走过且结构必错 → 修不加功能。
- 修：`picked = normalize_answer(...)[:8]`、`correct = picked == normalize_answer(answer)`；详情 `question.multi` 布尔（不泄漏答案）；`share-q` 多选 `togglePickLetter` 勾选 + 「确认答案（N）」（空选 `.dis`）确认后才 POST，单选点选即提交不变；揭晓 `right/wrong` 按字母包含。小程序分享页未改（仍单选，与改前一致；P3 随下次发布）。
- 本地 pytest 486（+3）/ ruff / pyright 0；vitest 606（+3）/ eslint / build:h5 绿。部署 `--skip-build` rc=0（宿主 load 0.4、free 93 MB、磁盘 91%/4.6 G），rev 5e8f7f1；Lighthouse `/` **accessibility 0.94 一次 WARN**、单独重跑 `--only-categories=accessibility` 回 1.0（本轮未改首页、报告 tmp 已删未取到失败项，登记观察）；其余全过。
- 复验 PASS（testing agent，uid `r428-ui-a…f`，375 + 1440）：273028 分享 `qe0ecpkv` `multi:true` 无 answer；B 点 A→D→C→D(取消)→D 期间 POST 0、确认 body `ACD` → correct、三项绿、F5 一致；C 空选 0 POST、AB → 判错 B 红、列表「选 ACD 对 / 选 AB 错」；单选 8740 `geu5hbhj` `multi:false` 无确认条、点选即 POST 对/错各 1；1440 确认条在卡片内；DB `shared_answers`/`answer_log` 归一值一致、probe 全 1；`/api` non-2xx 0、console/pageerror/rejection 0、healthy 0 重启、60 min 5xx/Traceback/locked 0；清理 SA 5 / SQ 2 / AL 5 / GE 14 → LEFTOVER 0，shared_questions 15 / shared_answers 4。窗口内另一探针 `umtppg…` 12 行 answer_log（probe=1；7535/7536 同时间戳为两题不同的批量写入，非重复）未动。
- 仍登记：P3 `daily_set_entries` 无 probe（0 行）；P3 PK status 0 一次；`.trend-kn` 字号需 4 周已掌握样本；`error_reason` ≥09-11 看 probe=0；SOP-10 审计 ~R430。

### R429（rev `f71db28`，bundle 变；后端 `db.py`/`qbank_api.py` + 前端 `practice.vue` 1 行 + `scripts/r429_daily_set_probe_backfill.py` + 单测 pytest 3/vitest 1）— 每日一练成绩表探针打标；Lighthouse a11y 0.94 未复现
- 取证 docs/iter/round-3/r429-daily-set-probe-lighthouse-a11y.md。① Lighthouse `/` 完整跑 5 次 + 部署 6b 再 1 次：accessibility 全 1.0、score<1 的 a11y 审计项 0（lhr 留 `/home/ubuntu/r429_lh/`）——R428 那次 0.94 不可复现、无失败项可取，不改首页、不改预算脚本，再命中一次再定是否让 `perf-budget.sh` 保留 lhr。② `daily_set_entries` 无 probe 列，`daily_set_stats`/`daily_set_submit` 池/`daily_set_board`/SEO `/tiku/daily/` 四处全表计入；生产表 1 行 `umtpnhrwbzwprmwhv`「考友CPV8」3/10 = 探针（同 uid answer_log 30 行全 probe=1、无 probe=0；caddy 该 POST 出口 140.232.64.5 ∈ KG_PROBE_CIDRS），部署前公开面显示「今天已有 1 人完成 / 今日排行榜 1. 考友CPV8」——R375 口径遗漏表，同 R418/R427 修。
- 修：`_ensure_daily_set` 幂等加列 `probe`；`daily_set_stats` 接 `REAL_TRAFFIC`（兼容口径，该表现无 NULL 行且按日重置，不用 R426 严格口径）；`daily_set_submit(..., probe=)` 写 1/0、击败/名次池 `(REAL_TRAFFIC OR uid=?)`；`daily_set_board(day, limit, uid=None)` 同池，`GET /api/daily_set/board?uid=` 可选、完成页带 `anonUid()`（board 不在边缘缓存白名单）；submit 端点接 `Request` 走 `probe_request` 三路判定。回填脚本规则：内部命名 uid 或「同 uid answer_log 有 probe=1 且无 probe=0」→ 1，其余 NULL 不动不删，`--record/--restore`。
- 生产：dry-run 1/1 命中 → 备份 `/data/r429-daily-set-before.json` → apply 1/1（记录 `/data/r429-daily-set-probe-backfill.json`）→ 全构建部署 rc=0（磁盘 92→94%/2.9 G、free ~330 MB），rev f71db28；部署后 `/api/daily_set` participants 0、board `[]`、`?uid=umtpn…` 1 条、`/tiku/daily/` 源站「来做今天第 1 位完成者」无榜。
- 本地 pytest 489（+3）/ ruff / pyright 0；vitest 607（+1）/ eslint / build:h5 绿。
- 复验 PASS（testing agent，`r429-ui-a` 375 / `r429-ui-b` 1440，探针网段）：A 原生 10 题 → submit `{participants:1, beat_pct:null, my_rank:1}`（池不含 umtpn… 行）、`board?uid=r429-ui-a` 只本人、完成页「第 1 位完成者」+「我的名次：第 1 名」1 行、DB probe=1；匿名 `/api/daily_set` 0 / board `[]` / `/tiku/daily/?x=` 无榜无昵称全程不变；B 1440 同、榜不含 A、卡片无溢出；B 二做 → `already:true, my_right:5`「已记录（首次 5 对） · 1 人完成」；`/api` non-2xx 0、console/pageerror/rejection 0、healthy 0 重启、60 min 5xx/Traceback/locked 0；清理 6 表 60 行（含 `review_log` 1 行）LEFTOVER 0，表回 1 行 probe=1。**完成页 F5 不重发 submit**（从第 1 题重开）。并发外部探针 `umtpqwm7p0put2j5p`（probe=1）+1 answer_log/+1 mistakes 非本轮未动。
- 登记：小程序不调用 `/api/daily_set*`（无待办）；P3 PK status 0 一次；`.trend-kn` 字号需 4 周已掌握样本；`error_reason` ≥09-11 看 probe=0；**R430 SOP-10 四维审计**。

### R430 / R430b（rev `824a9e3` → `e456a88`，bundle 变；前端 4 页 CSS + `main.js`/`monitor-client.js` + vitest 6+3）— SOP-10 四维审计（统计/报告次级屏簇）+ 旧壳 chunk 404 自愈
- 取证 docs/iter/round-3/r430-sop10-audit-stats-secondary-fontfloor-chunk-heal.md。粉笔仍无一手截图 → 零竞品陈述不加功能；审 R398/R410/R420 未覆盖的统计簇：日历 / 掌握度地图 / 练习历史 / 周报 **29 处 18–23rpx** 低于 R411/R420 的 24rpx 下限、`.cal-btn` ‹ › 与周报 `.sheet-x` ✕ 无热区、`.dot` 30rpx 角标；生产只读：`weekly_reports` 0 行、无 checkin 表（打卡由 answer_log 推导）、本簇 API 非探针请求全为自动化/候选设备、**无可确认外部真人**。修：→24rpx、`.dot` 36rpx、两热区 min 40×40 + 源锁单测。
- R430 复验 PASS（375/1440，原生 30 题解锁地图；全页 <12px `[]`、`.cal-btn` 40×40、地图/历史/日历/周报空态/1440 side-nav 正常、`/api` non-2xx 0、清理 LEFTOVER 0）；**untested**：`.sheet-x` 运行时（需有上周记录的 uid）、`.sheet-s` computed 未落盘。**抓到 FAIL（非 CSS）**：旧 SW 预缓存壳 import 旧 hash 分包 404 → uni 原生「连接服务器超时，点击屏幕重试」误导，需手点。
- R430b：`installVueErrorHandler` 加第 4 参 `onChunkLoadError`（仅 chunk-load 触发），`main.js` 接到既有 `staleShellHeal`（拉 `/` no-store 比 hash，**不一致才 reload、会话内一次**，一致即真网络故障不动）。第一次部署远端 compose「exporting layers」进程消失（free 68 MB、同机 recruit/softcopyright 同时重建镜像，疑 OOM 未证实；旧容器服务未中断），重跑成功 13:11:39Z。复验（方案 B CDP Fetch，因发版后服务器保留上一版分包、自然旧壳无 404）：fail-closed / heal（~100 ms reload → 目标页正常、`kg_sh_reload=1`）/ 会话内一次三分支 375+1440 全 PASS，旧 bundle 对照仍停超时文案；`/api` non-2xx 0、healthy 0 重启、5xx/Traceback/locked 0、清理 LEFTOVER 0。**(c) 自然旧壳路径 untested**——下次发版前留一个「隔两版」旧壳 tab 可直接验。
- 设计内观察：后台 hidden tab 在 SW `kg-sw-updated` 时被 visibility 守卫跳过不刷新；同 document 内失败过的 chunk Chrome 不再请求，会话上限后靠用户点「重试」整页 reload（已验可恢复）。
- 登记：P3 `.sheet-x`/周报正文运行时量测待有数据 uid；`.trend-kn` 需 4 周已掌握样本；`error_reason` ≥09-11 看 probe=0；宿主磁盘 94%/3.2 G、free 68–102 MB，同机多产品并发重建镜像会互相挤（本轮首次部署中断），扩盘/迁出待老板决定。下次 SOP-10 审计 ~R440。

### R431 / R431b（rev `ed9e69e` → `ce81242`，bundle 不变；仅 `deploy/deploy_h5.sh` + 新 `deploy/host_probe.sh` + `deploy/README.md`）— R430b 重建中断取证 + 部署第 4 步可归因/让行
- 取证 docs/iter/round-3/r431-deploy-compose-cancel-forensics-hardening.md。dockerd 日志：`Control/Solve ... context canceled` + overlay differ `failed to send write: context canceled`（导出 cv2 .so 时）= **build 被 client 侧（compose 进程）取消**；`sudo -n journalctl -k` 全 boot 周期 **0 次内核 OOM → R430「疑 OOM」否定**；`only one connection allowed` 成功 build 也打、是噪音。本地 r430b 日志 `compose-started` 后无任何 ssh 报错、39 轮空轮询 ≈ 8 min → launcher ssh 恰在 cancel 时刻返回 → compose 先没了才放开 ssh（非 ssh 掉线牵连）；谁发信号无 auditd 不可考，记推断（同机另一产品 build 2 min 后同样 cancel）。
- 脚本缺口：后台 nohup 退出码丢失只能等 600 s；单一日志被覆盖；无宿主快照/不看别家 build；FAIL 不打现场；旧写法 `cd && nohup … & echo` 的 `&` 作用于整个 && 列表 → 子 shell 持 ssh 管道到 build 结束（R431 首版复现 launcher 挂 ~90 s）。
- 修：`host_probe.sh`（`mem_avail/disk_avail/load/other_builds`，`pgrep -fc '[d]ocker compose .*(build|up)'`）；4-pre 别家 build 在跑等 15 s×≤300 s 只 WARN；`setsid -f nohup bash -c 'docker compose up -d --build; echo KG_COMPOSE_EXIT rc=$?'` 独立日志 `/tmp/kg-compose-<rev>-<utc>.log`（`/tmp/kg-compose.log` 软链）；轮询读末行 rc≠0 立即 FAIL、rc=0 宽限 3 轮；FAIL 打宿主快照/残留进程/日志尾 40/内核 OOM 关键词。**不加内存阈值**（无证据）。
- 生产：部署① ed9e69e 首轮收敛 rc=0（free 313 MB、91%）；部署② ce81242 launcher 立即返回、第 2 轮收敛 rc=0、整脚本 1m12s（free 383 MB、94%、load 2.7）；`/api/health` rev ce81242、healthy 0 重启、5xx/Traceback/locked 0、内核 OOM 0；6b `/` LCP 2785 一次 WARN（bundle 不变、宿主负载形态）。无 DB 写入无 UI 改动，不派 testing agent。
- 登记：`other_builds` 是进程观测非锁；磁盘 94%/3.0 G，扩盘/迁出 recruit·softcopyright 仍待老板；`.sheet-x`/自然旧壳 404 (c) 待下次发版；`error_reason` ≥09-11 看 probe=0；`.trend-kn` 需 4 周样本。下次 SOP-10 审计 ~R440。

### R432（commit `55b157e`+收口；bundle 不变、容器不重建；仅 `scripts/crawler_stats.py` + `deploy/cron_access_report.sh` + 单测 1 + `deploy/README.md`）— 访问归档 gzip + probe=0/error_reason 到期复查
- 取证 docs/iter/round-3/r432-access-archive-gzip-probe0-followup.md。起点复查（只读 `/data/data.db`，`created_at` 是 Unix 秒）：`answer_log probe=0` 仍只有 vivo 小程序 uid `umst3tuisd7lgzaka` 22 行、全在 09-06（00:10 / 08:57 UTC）、之后无新行；`mistakes.error_reason` 非空 6 行（3 uid）按 uid 关联 `answer_log.probe` **全 NULL**（u32 = R2 手写走查 uid；另两个是 R374 前历史），probe=0 仍 0 行、≥09-11 未到期 → 三项都不改产品代码，vivo 仍按候选/内部走查登记。`mistakes/review_log/interview_sessions/shared_answers/users` 无 probe 列，只能经 uid 关联。
- 宿主 94%/3.0 G 的一手 du：大头是 recruit pgdata 8.5 G / containerd 11 G / SoftCopyright backups 5.8 G（别家，不能动）；**kaogong 名下唯一可动项** = `kaogong-reports/access-archive` 415 MB 全明文 jsonl（同机 recruit 早有 `-mtime +1 gzip` cron，kaogong 的 `cron_access_report.sh` 只有 90 天删、R184 漏配）。
- 修（最小、不删文件）：`iter_archive` 用 `fn.removesuffix(".gz")` 对窗口集合、`.gz` 走 `gzip.open("rt")`（改前 .gz 会被静默跳过、日报少算）；周报输入 `zcat -f access-*.jsonl*`；周报末尾 `find -mtime +3 -name 'access-*.jsonl'` → `gzip -c >> "$f.gz" && rm -f "$f"`（多成员追加、同日重灌不覆盖），`+90 -delete` 改 `access-*.jsonl*`。单测 +1（明文/单成员/多成员 gz 混读、窗口外 gz 不读）。
- 本地：pytest 490（+1）/ ruff 0 / pyright 仅原有 `access_log_report` 导入解析 1 error（stash 对照同）/ `bash -n` 过。
- 生产：scp 两文件（md5 核对）、手工跑与脚本逐字相同的压缩循环：415 MB → **86 MB**（15 个 .gz ≈360→14.4 MB ≈25:1 + 5 个 ≤3 天明文 75 MB），`df /` 5.5 → 5.9 G（88%），3.3 s；`gzip -t` 15/15；新脚本重算 `crawler-stats.json` 与 14:03 cron 产物除 `generated_at` 外**逐键相等**（Yandex 1184 / Bing 119 / Google 47 / Apple 3）；周报 `zcat -f` 输出与改前 `cat` 输出 `diff` 空。
- 登记：这不是宿主问题的解（别家 25 G+ 未动），扩盘/迁出 recruit·softcopyright 仍待老板；`-mtime +3` 依据是归档写入形态、未长期观测；`.sheet-x`/自然旧壳 404 (c) 待下次发版；`error_reason` ≥09-11 看 probe=0；`.trend-kn` 需 4 周样本。下次 SOP-10 审计 ~R440。

### R433（`deploy/kaogong-ops.sh` + `backend/app/ops_status.py` 1 行正则 + 单测 + README；bundle 不变、容器不重建、脚本 scp md5 核对）— 卷内手工全库快照离站归档 + `VOLUME-SNAPSHOT` 巡检
- 取证 docs/iter/round-3/r433-volume-snapshot-offload-ops-audit.md。只读盘点：`~/kaogong-backups` 468 MB = 3 份每日 gzip（策略保留、R2 都有、非浪费）；`deploy_kaogong-data` 卷 922 MB 里 `data.db` 429 + wal 109 之外，**`data.db.bak-w3.gz` 178 MB + `r418-before.db.gz` 179 MB 两份手工全库快照**（R191 就写过「勿在 /data 堆放」，之后又堆进去无人巡检）= kaogong 名下第二可动项。共享宿主（recruit pgdata 9 G / containerd 9.5 G / SoftCopyright 6 G / build cache 2.75 G）只记录不动。
- 处置（同 R191，可逆）：容器内 `gzip -t` → `docker exec cat | rclone rcat --size` 到 `r2:zalize-backups/kaogong-sqlite/archive/` → 远端字节数 + `rclone cat | md5sum` 真回读与本地一致（`9cebb800…`/`010485278…`）→ 才删本地。卷 922 → **581 MB**，healthy 0 重启。两份现只在 R2 archive（单副本），需要时 `rclone copy` 回。
- 巡检：`kaogong-ops.sh` 每日 `find /data -maxdepth 1 \( *.db* -o *.gz \) ! data.db* -size +1M` → 有则写 `VOLUME-SNAPSHOT N file(s) M MB: <paths> (move to r2:…/archive/)`（只报不删）；`ops_status.ALERT_PAT` 加该词管理台标红（随下次容器重建生效）。同步前 `diff` 生产副本发现**未入库改动**（本地保留 7→3 份）已回收进仓库再 scp（md5 `863db0bd…`）。生产整脚本实跑 rc=0 157 s：backup/R2/RESTORE-VERIFY/R2-VERIFY 全 ok、无 VOLUME-SNAPSHOT 行（卷已干净）、`/api/health` 200；改前 2 MiB 假快照演练能报、删后为空。
- 本地：`bash -n` 过；pytest ops_status 4 passed；ruff 0；pyright 0。
- 登记：宿主仍 91%/4.6 G——kaogong 可动项已动完（R432 −330 MB + R433 −340 MB），扩盘/迁出 recruit·softcopyright 仍待老板；`.sheet-x`/自然旧壳 404 (c) 待下次发版；`error_reason` ≥09-11 看 probe=0；`.trend-kn` 需 4 周样本。下次 SOP-10 审计 ~R440。

### R434（`deploy/kaogong-ops.sh` 1 行 + README + 取证；bundle 不变、容器不重建、脚本 scp md5 核对）— R2 `kaogong-sqlite` 前缀盘点：30 天清理递归误伤 `archive/`（差 2.6 天）
- 取证 docs/iter/round-3/r434-r2-prefix-retention-archive-recursion.md。只读 `rclone lsl`：顶层 11 份每日 `data-08-27…09-06.db.gz`（最早 08-27，未满 30 天 → 30 天清理尚无可观测样本）+ `archive/` 7 个对象（R191 归档的 R33 ×3 / R96 ×2 未压缩 .db 各 370 MB + R433 两份 .gz）= 3.585 GiB；bucket 全部 5.64 GiB（多产品共用，10 GB 免费额度）。
- **命中**：`rclone delete --min-age 30d "r2:$BUCKET_PREFIX/"` 默认递归，`--dry-run --min-age 1s` 复现作用域含 archive/ 全部 7 个对象；`bak_r96_qa*.db`（08-10）已 27.4 天，**09-10 03:40 的 cron 就会删掉**，随后 r33 三份（09-16）、R433 两份（10-06）——「永久归档」实为 30 天静默消失。修 1 行：`--max-depth 1 --include "data-*.db.gz"`；dry-run 新作用域只有 11 份每日；scp md5 `362cba73…` 一致，新命令生产实跑 rc=0（今天无到期对象）。
- archive/ 5 份未压缩 .db 流式 gzip（`rclone cat | gzip | rclone rcat`，不落宿主盘；`gunzip | md5sum` 与原对象一致才 `deletefile`）：5/5 一致，archive 1.86 GB → 987 MiB、前缀 3.585 → 2.484 GiB、bucket 5.64 → 4.54 GiB；全程 healthy、health 200。
- 卷内 `iter-r3b/` 24 MB 是 R3b 清洗账本（ledger/fixes.sql）、`r4xx-*.json` 是处置记录 → 保留。
- 登记：30 天清理真执行要 09-26 后看；R2 用量稳态 ≈5 GB+archive、超 10 GB 是计费不是失败；archive 单副本；`.sheet-x`/自然旧壳 404 (c) 待下次发版；`error_reason` ≥09-11 看 probe=0；`.trend-kn` 需 4 周样本。下次 SOP-10 审计 ~R440。

### R435（`backend/app/db.py` 1 行 + 新 `backend/requirements.txt` + 两份 Dockerfile 改装法 + 单测 4 + README；两次部署 `190cf70`/`3c451c9`，bundle 不变）— RESTORE-VERIFY 覆盖面核查（不改）+ WAL 114 MB 永不回收 + 镜像依赖裸装最新版
- 取证 docs/iter/round-3/r435-restore-verify-wal-limit-requirements-pin.md。校验链一手：RESTORE-VERIFY 09-03…09-06 每日 `ok questions=156792`、R2-VERIFY md5 match；宿主 gunzip 当日备份只读对账 85 表，questions/users/mistakes/answer_log/review_log 的 count 与 max(rowid) 与活跃库逐一相等（`favorites`/`reminders` 本库无此表）。`.backup` 页级整库 + `quick_check` 全表 B-tree，再数业务表行数是重复信号 → **不扩校验、不改脚本**。
- **命中 A**：`/data/data.db-wal` 114 MB，`-shm` 头 mxFrame=876 → 活帧 3.6 MB，`journal_size_limit=-1`；连接常驻不 close、进程退出不 TRUNCATE → 历史一次性大写入（清洗/隔离）把文件撑大后永不回收。修 `SQLITE_WAL_LIMIT_BYTES = 64<<20` + `PRAGMA journal_size_limit`（只在 WAL 重置时截文件、热路径零 I/O）；单测复现「1 MiB 上限 8 MB 写入 → checkpoint 后仍峰值 → 下次写入截回 ≤1 MiB，对照连接停峰值」。部署后手工 `wal_checkpoint(TRUNCATE)` → `(0,0,0)`，wal 114 MB → 0 → 重建后 16 KB。
- **命中 B**：生产 `pip freeze` pypdf 6.17.0（PyPI 09-04 发布）vs 本机 6.16.2。buildkit 日志：R431 `ed9e69e` 与 R435 `190cf70` 两次部署 pip 层缓存 miss 重跑、`Downloading pypdf-6.17.0`，R431b `CACHED`——Dockerfile 裸装无版本、同机别家 build 挤缓存（`builder du` 可回收 2.19 GB）→ 生产依赖版本由「别家何时 build」决定，与本地测试不是同一套包。修：`backend/requirements.txt` 41 行 `==` 全量钉版（来源生产 freeze）、两份 Dockerfile 只 `pip install -r`、单测锁格式/覆盖/装法；本机 pypdf 对齐 6.17.0 后 PDF 27 测试过。`3c451c9` 部署后容器 `pip freeze` 与清单 `diff` 为空。
- 复验：两次 rc=0、`/api/health` rev 对、healthy 0 重启、5xx/Traceback/locked 0、`/api/stats` 0.087 s、表计数不变；6b `/` LCP 2745 / performance 0.81 各一次 WARN（宿主 load 3.67 同机别家 build，bundle 不变，`/tiku/` 1.00）。无 UI/DB 写入不派 testing agent。本地 pytest 494（+4）/ ruff 0 / pyright 0 / `bash -n` 过。
- 登记：`journal_size_limit` 生产下一次大写入周期的实际截断待观测（现 16 KB）；升级依赖走「改 requirements.txt → pytest → 部署」；`probe=0` 无新行、`error_reason` ≥09-11 看；`.sheet-x`/自然旧壳 404 (c) 待下次前端发版；`.trend-kn` 需 4 周样本。下次 SOP-10 审计 ~R440。

### R436（只取证登记，无改码无部署）— 前端构建链「本地≠线上」同类缺口核查：无
- 取证 docs/iter/round-3/r436-frontend-build-reproducibility-audit.md。`package-lock.json` 入库（v3，1253 包）且与 `package.json` 依赖根条目 0 差异；本机 `node_modules/.package-lock.json` 与锁逐包 version 差异 0 / 缺失 0 / 多装 0；**同 commit 重跑 `build:h5`，dist 119 文件 md5 全同**（含 hash chunk 名），VPS 侧 `index-junWyPAm.js` md5 与本机一致；生产 `Dockerfile.runtime` 直接 COPY 预构建 dist、不经 npm；备用 `Dockerfile` 走 `npm ci`。→ 前端没有 R435 命中 B 的同类缺口，不改。
- 登记版本口径差（无事故样本、不改）：Node 本机 22.23.2 / 备用镜像 node:20（无 engines/.nvmrc）；Python 3.12.13 / 3.12.14；SQLite 本机 3.37.2 / 生产 3.46.1（本地测试跑在更老库上，代码只用 `json_extract` 1 处，无 `->>`/RETURNING/STRICT）；`python:3.12-slim` 浮动 tag（基础层 09-01）不钉 digest。
- WAL：重建后 16512 B 未变、jsl 64 MiB 读回；自然截断周期未发生，继续观测。`probe=0` 仍只 vivo 小程序 22 行；`mistakes.error_reason` 非空 6 行与 probe=0 关联 0（注意 `error_reason` 在 `mistakes` 不在 `answer_log`）。

### R437（新 `deploy/app_log_snapshot.sh` + `deploy_h5.sh` 3 行 + README；部署 `83c7522`，bundle 不变、后端不动）— 24 h 非 2xx 全部归因 + 应用日志随容器重建丢失
- 取证 docs/iter/round-3/r437-app-log-lost-on-recreate-24h-non2xx-audit.md。caddy 源站 24 h 9975 请求、非 2xx 47 次逐组归因：探针网段负向用例 36、vivo 小程序 wxlogin 503 ×3（既定）、无边缘头直连扫描 403 ×4、Palo Alto `security.txt` 404 ×2、Bing 请求历史分片 `sitemap-questions-12.xml` 404 ×2（索引现 1–11，设计内）→ **无未登记产品问题**；隔离解析题 SEO 页回落花生十三解析正常。
- **命中**：容器日志驱动 json-file，文件随容器删除；lifecycle 审计 09-01 起 251 个容器 ID、09-06 单日 22 次部署 → `docker logs --since 24h` 实际只覆盖当前容器的几十分钟，跨部署的 Traceback/耗时行无第一手可查（历轮「N min 日志 0 异常」都只是当前容器窗口）。修：重建前远端 `docker logs --timestamps | gzip` → `kaogong-reports/app-log/kaogong-app-<rev>-<startedAt>-to-<now>.log.gz`（≈9 B/行）保留 14 天，失败只 WARN；不改日志驱动/daemon.json。预演 1205 行 11 KB；真实部署快照 1283 行 12 KB、compose rc=0、health rev 对、healthy 0 重启、5xx/Traceback/locked 0、6/6 与 5b 全过；6b `/` LCP 2793 一次 WARN（bundle 不变）。
- 登记：部署机无 `brotli`，R367 起 60 次部署全 WARN、dist 无 .br，线上 br 由边缘动态压出（5b 从未失败）——要补装 brotli 即可、本轮不动；`error_reason` ≥09-11 看 probe=0；`.sheet-x`/自然旧壳 404 (c) 待下次前端发版；`.trend-kn` 需 4 周样本；WAL 截断继续观测。下次 SOP-10 审计 ~R440。

### R438（`backend/app/db.py` 新 `cn_day_start()` + `_advance_review` 1 行 + 单测 3 新/1 改；部署 `fbcda82`，bundle 不变）— SRS 到期点按复习时刻滚动 24 h，与 UI「今日到期 / 明天复习」日历口径不一致
- 取证 docs/iter/round-3/r438-srs-due-day-boundary-cst-midnight.md。源码可证：`next_review = time.time() + N×86400`（滚动秒），UI 与 `cn_day()` 全是日历词 → 08:00 复习的题次日 08:00 前「明天复习」、08:00 后「今日到期」（同日早上清零下午冒出）；23:30 复习的题次日全天「明天复习」直到 23:30。前端 `Date.now()` 与后端 `time.time()` 都是绝对秒，**时区不参与**、不是 TZ 问题。生产只读：29 行 `next_review` 全落在复习钟点、无 00:00；`review_log` 相邻间隔 20–28 h 为 0 → **无隔夜复习样本、无已发生的真人受害**；R425 vivo 设备 `1952` 到期 09-07 16:58。
- 修：`nxt = cn_day_start() + days*86400`（到期 = 中国日历日 00:00，1 天档=明天 0 点）；`due_*` 谓词、前端 `isDue`/`Math.ceil` 标签、错题重写 `next_review=time.time()` 都不改。生产实跑：23:45 CST 答对 → `next_review 09-07 00:00:00`、probe=1、清理 LEFTOVER 0；现存 29 行 floor 到所在日 00:00（dry 29 → dump `/data/r438-next-review-realign.json` → apply 29 → re-dry 0；只提前不推后；`python3 - restore` 可回）。healthy 0 重启、5xx/Traceback/locked 0。本地 pytest 497（+3）/ ruff 0 / pyright 0。
- 顺带：R437 归档 app-log 3 份 3168 行 Traceback/5xx/locked/warn 0（窗口仅 31 min，跨部署完整样本要明天起）。
- 登记：日界抖动无生产样本、修的是语义缺陷；小程序 `miniapp-native` 标签代码未单独核；`error_reason` ≥09-11 看 probe=0；`.sheet-x`/自然旧壳 404 (c) 待下次前端发版；`.trend-kn` 需 4 周样本；WAL 截断继续观测。下次 SOP-10 审计 ~R440。

### R439（`backend/app/db.py` `_day_start` 委托 `cn_day_start` + `plan.py` 内联日界公式去重 + 单测 2；部署 `7282ff1`，bundle 不变、无 DB 写入）— 小程序错题本到期口径核（服务端驱动、不改）+「今天 00:00」三处同公式合一
- 取证 docs/iter/round-3/r439-miniapp-due-label-day-start-single-source.md。`miniapp-native` 全目录无客户端到期判断/「明天复习」标签：首页「今日到期 N 题」、练习页「今日还有 N 题到期」的 N 全来自 `GET /api/review` 的 `total`（`due_review_count`），复习 toast「N 天后」来自 `POST /api/review/{mid}` 的 `next_review_days` → R438 落 00:00 后小程序自然同口径，**无需发版**。生产 29/29 `next_review` 在 CST 00:00、vivo `1952` → 09-07 00:00。
- 顺带：同一「中国日历日 0 点」公式在 `db.cn_day_start` / `db._day_start`（8 处调用）/ `plan.today_plan` 内联局部变量（且与新函数同名）各写一份 → 合一（数值同、无行为变化，单测锁 `_day_start()==cn_day_start()`）。三处历来都是日历日口径，佐证 R438 方向与既有意图一致。
- R438 对 08:00 推送「你有 N 道错题今日到期」与今日计划的效果：昨日任意时刻复习过的题今早都算到期（改前昨晚复习的要到今晚同钟点）；单测 `test_plan_counts_last_night_review_as_due_at_push_hour`；历史推送数字不落库不可回溯、`push_subs` 真人订阅数未查。
- 跨部署 app-log：`83c7522` 680 行 / `fbcda82` 675 行 Traceback/5xx/locked/非 access WARN 全 0；仍是部署间隔片段，完整 24 h 样本需无部署日。`probe=0` 仍 22 行无新增；`error_reason`×probe=0 关联 0。
- 复验：rc=0、health rev 对、healthy 0 重启、6b 全过（`/` LCP 1820）、WAL 160 KB。本地 pytest 499（+2）/ ruff 0 / pyright 0。
- 登记：`.sheet-x`/自然旧壳 404 (c) 待下次前端发版；`.trend-kn` 需 4 周样本；WAL 截断继续观测；`error_reason` ≥09-11。R440 做 SOP-10 四维审计。

### R440（SOP-10 四维审计「复习流 / 今日计划 / 推送」簇：`plan.py` `_review_sub` + `home.vue` 35 处 / `reminders.vue` 4 处 → 24rpx + 两处行内文字链热区 + pytest 2 / vitest 3 + `test_answer_log_client_ts` 去时段假失败；部署 `d30a9b0`，bundle 变、无 DB 写入）
- 取证 docs/iter/round-3/r440-sop10-audit-review-plan-push-cluster.md。竞品维度仍无一手粉笔截图 → 零竞品陈述、不据二手加功能。一手命中：① 首页样式块 35 处 20–23rpx（375 下 10–11.5px，含 `.tk-sub/.tk-go/.duebar-s/.plan-days/.task-sub/.plan-prog-t/.tk-ck/.task-ck`）+ 提醒设置 4 处，低于 R411/R420/R430 的 24rpx 下限；② 「补练往期 ›」`.hero-ds-arc` /「往期 ›」`.sz-arc` 只有文字高度无热区；③ 口径不对齐：首页「今日到期 N 题」/到期卡/错题本/推送用 `due_review_count(uid)`（含今日新错），今日计划复习任务用 `created_before=cn_day_start()`（R439 有意排除今日新错）→ 同屏上方「今日到期 2 题」、下方「今日到期错题已清」。修：字号全抬 24rpx + 源锁；arc `inline-block` + `margin:-12px 0 -12px`/`padding:12px` 纵向热区 ≥40px 布局不变；`_review_sub(due, new_today)` 副标点出「另 N 道今日新错可随时巩固」，任务 `target/done` 不变。
- 推送簇不改：`build_push_payload` 用全部到期（与首页同口径、08:00 时今日新错≈0）；生产 `push_subs` **0 行**、当前 + 归档 app-log 无 push/VAPID 行、`seo_meta.push_last_day=2026-09-06` → 循环在跑但无真人订阅可观测。`profiles` 8 个 uid 当下 due_all==due_old 全 0 差 → 命中 ③ 是源码可证结构事实、无已发生真人样本。
- 顺带：`test_answer_log_client_ts` 在 CST 00:00–02:00 跑必假失败（`now-7200` 跌进昨天 checkin 桶；stash 对照同样失败、非本轮引入）→ `t2 = max(now-7200, cn_day_start(now)+1)`。登记 `db.daily_plan` 仍内联 `((now+tz)//86400)*86400-tz`（R439 漏一处，数值同、不动）。
- 复验（testing agent，`r440-ui-a/b`，375/1440）：造「到期已清 + 今日新错 1」现场 → 任务卡「今日到期 1 题」+ 到期卡，计划复习行仍 ✓ 副标「今日到期错题已清 · 另 1 道今日新错可随时巩固 · 已完成 1/1」，`/api/plan/today` 逐字一致；对照 uid 只有今日新错 → 计划无 review 任务（reviewed+due=0 → target 0，预期）；首页/提醒页全页 `<12px []`、无溢出；arc 41px 高、父行 17px 未撑大；`/api` 非 2xx 0、console/pageerror/rejection 0、healthy 0 重启、5xx/Traceback/locked 0；清理 6 表 15 行 LEFTOVER 0。6b 全过（`/` LCP 1245 / perf 0.99）。本地 pytest 500（+1）/ ruff / pyright 0；vitest 619（+3）/ eslint / build:h5 绿。
- 登记：375 下新副标 + 「· 已完成 1/1」在 247px 内折 2 行（无溢出、1440 单行）——是否接受双行待产品定；`.sheet-x`/自然旧壳 404 (c) 本次发版后可补量；`.trend-kn` 需 4 周样本；WAL 165 KB 截断继续观测；`error_reason` ≥09-11；宿主 91%/4.7 G。下次 SOP-10 审计 ~R450。

### R441（日界公式收口 3 处 `db.daily_plan` / `insights._week_start` / `mock_event._saturday_window` → `db.cn_day_start` + 单测 1；部署 `b265cdc`，bundle 不变、无 DB 写入、不派 testing agent）
- 取证 docs/iter/round-3/r441-day-start-single-source-lcp-baseline-postrelease-404.md。A：R439 合一漏的不止 `daily_plan` 一处，grep `8 \* 3600` 全量核出 3 处「日 0 点秒」克隆，全部改用 `db.cn_day_start(ts)`（纯等价，`weekday` 局部计算保留）；pytest 501 / ruff / pyright 0。
- B：R440 前端发版后 70 min caddy 源站 160 请求、`/assets/*` 404 0、monitor POST 0 → 自然旧壳 404 (c) 仍无样本（非 2xx 仅 testing agent `GET /api/plan` ×2）。
- **C（口径纠正）**：`/` Lighthouse LCP ≈ 2.73 s 是稳定基线（R429 留存 lhr 4/5 + 本轮 4/4 都 2732–2793），历轮记「一次 WARN、宿主负载」是错误归因——LCP 元素是壳内联 splash、observed TTFB 57–102 ms、render-blocking 0、assets 全 <200 ms 收完，成本在 4× CPU 模拟下的主线程（主包 bootup 1.4–2.0 s）。R439 1820 / R440 1245 才是离群低值。不改预算不改码（无设计论证）。
- **D（未定论、R442 起点）**：同机同 bench 下主包 `bootup scripting` R429 `Ct1Bg37q` 402–450 ms（5 次）→ 本轮 `DaOBPuSg` 744/757/1373 ms（3 次），TBT 54–94 → 321–658；样本少、LH 单机噪音大 → R442 本地起两版 dist（R429 commit vs HEAD）交替各跑 ≥5 次 A/B 再归因（候选：R430b `main.js`/`monitor-client.js`、R440 `home.vue`）。
- E/F：`probe=0` 仍 22 行、`error_reason` 6 行不变、`push_subs` 0、`weekly_reports` 0、WAL 431 KB；`d30a9b0` 归档 app-log 1959 行 0 异常（grep 5xx 会误匹配 `[indexnow] submitted 533 urls`，看上下文）。
- lhr 留存：`/home/ubuntu/r441_lhr*.json`、`/home/ubuntu/r429_lh/`（devin-box，非仓库）。下次 SOP-10 审计 ~R450。

### R442（只取证不改码不部署：主包脚本成本 A/B 无回归 + `/` LCP 基线决策项）
- 取证 docs/iter/round-3/r442-main-bundle-bootup-ab-no-regression-lcp-baseline.md。R441-D 关闭：同机交替 5×5，A=R429 `f71db28` 重建 dist 主包 scripting 433–524（均 472）vs B=HEAD dist 426–480（均 457），TBT 93 vs 78，两版主包只差 81 B；生产复测两次 scripting 443/458、perf 0.92–0.93、LCP 2734/2745。R441 记的 744–1373 是量测机噪音。
- `/` LCP 基线累计 11 次里 10 次 2732–2793（2500 预算恒 WARN、无信息量）→ 决策项交老板：(a) `perf-budget.sh` LCP 线校准到 3000 并注明依据 / (b) 立项主包瘦身（先取证 374 KB 构成）/ (c) 不动；无异议下轮按 (a)。
- 方法资产：`/home/ubuntu/r442/proxy.py`（本地 dist + `/api` 代理生产加 `X-Kg-Probe: 1`）+ `ab.sh`（交替 Lighthouse 抽指标），可复用于任何前端版本对照；A 版 worktree 已删。

### R443（`perf-budget.sh` `/` LCP 线 2500→3000；只改阈值 + 注释，不改产品代码不部署，生产仍 `b265cdc`）
- 取证 docs/iter/round-3/r443-lcp-budget-lantern-calibration.md。R442 决策项 (a) 落地，并把「2.73 s 是什么」一手证死：LH 默认 simulate 口径下 `/` 的**观测** FCP/LCP 只有 110–178 ms，Lantern（`FirstContentfulPaint.ts`，LH 13.4.1 源码）把观测 FCP 前收完的 High/VeryHigh 请求（主包 129 KB + R387 预加载 21 个分包/CSS ≈ 23 个 216 KB）全按 150 ms RTT / 1.6 Mbps 折算 → 模拟 LCP 2723–2750；改 `--throttling-method=devtools` 真节流两次 **FCP=LCP=712/722 ms**（LCP 元素同 `#kg-splash > div.s`）。
- 双峰成因一手：同轮 6 次 simulate 5 次 2723–2750（23 请求进图）、1 次 **2018**（主包 150 ms 收完晚于观测 FCP 141 ms 9 ms → 被排除 → 22 请求 86.7 KB）→ 历轮 0.8/1.2–2.0/2.7 是量测机上 ~10 ms 竞态的落点，不是页面性能信号；R193–R386 复跑 0.8 为主 / 首跑 26xx、R387 后 2.73 成主峰与机理吻合（历史归因为推断）。
- 3000 线：仍把「首绘前 High 优先级字节」留在护栏内（现值 2723–2793，余量 ~250 ms），不再每次部署误报；perf ≥0.90 不动。`bash -n` 过；生产实跑 `perf-budget.sh` 12 项全 OK（`/` perf 0.97 / LCP 2020；`/tiku/` 1.00 / 957；bundle gzip 125 KB）。
- 否决 (b) 主包瘦身（真节流首屏 0.7 s、主包在 160 KB 预算内、R442 无回归）与换 devtools 口径（历史水位全是 simulate、跑一次 60–90 s 且带 incomplete warning）。
- 留存 `/home/ubuntu/r443/lhr_sim_{1..4}.json`、`lhr_devtools_{1,2}.json`。到期项未动：`.sheet-x`/(c) 无样本、`error_reason` ≥09-11、`.trend-kn` 4 周、WAL 截断、无可确认外部真人、`WX_MINIAPP_SECRET`、R385 第二冷样本；下次 SOP-10 ~R450。

### R444（到期项只读复查 + 27xx 误归因勘误指针 + 首页 CLS 0.071 元素级归因；只登记，不改产品代码不部署，生产仍 `b265cdc`）
- 取证 docs/iter/round-3/r444-due-items-readonly-cls-attribution-erratum.md。到期项全无新样本：`probe=0` 仍 22 行/1 uid（09-06 vivo 小程序，之后 0 新行）、`error_reason` 6 行与 probe=0 关联 0、`push_subs`/`weekly_reports` 0/0、29/29 `next_review` 在 CST 00:00、WAL 519 KB（64 MiB 截断阈值未触发；只读探针连接读 `journal_size_limit=-1` 属连接级 pragma 预期，应用连接 R436 已读回 64 MiB）；caddy 6 h 2404 请求 `/assets/*` 404 = 0、monitor 上报 12 条全 testing agent、非探针非 2xx 全可归因（bingbot 历史分片 12 / 直连 403 / `.env`·security.txt 扫描）、0 候选真人。
- 勘误：把 26xx–27xx LCP 记为「宿主方差/单样本波动/本机噪音/宿主负载」的历史行（R128/R315/R324/R334/R343/R388/R389/R424/R427/R431/R435/R437 节 + r424/r435 取证各 1 处）**不改原文**，在本文「已知坑与注意事项」加一条勘误指针 → R443 机理文档。
- CLS 0.071（R196 起每次 6b 恒定、从未归因）一手拆解：8 份 lhr + `--save-assets` trace + Playwright `layout-shift` sources 4 次 = **12 次全同**两次位移：#1 0.0608 `uni-page-wrapper::after`（uni-app TabBar 50 px 占位，空页时在 44 px 导航下、内容进入后被推到 2680 px 页尾）≈ 全在启动屏遮盖下；#2 0.0102 `home_bundle` 回包 `dsMeta` 有值 → `<text v-if="dsMeta" class="hero-ds">` 插入 26 px 把 `.hero-acts` 与 taskcard 下顶 26 px（taskcard 同帧另收 −26 px，哪一行未核），落在 splash 0.15 s 淡出窗口内。判 P3 登记：0.071 在「良好」区间且预算 0.10 有余量；候选修法 = `dsMeta` 未返回前给 `.hero-ds` 预留一行（需先核 `dsMeta` 是否每日必有），无真人样本不动手。
- 留存（devin-box）：`/home/ubuntu/r444/lhr_cls_1.json`、`lhr_cls_1-0.trace.json`、`cls_sources.py`。到期项继续挂：`.sheet-x`/(c)、`error_reason` ≥09-11、`.trend-kn` 4 周、WAL 截断、无可确认外部真人、`WX_MINIAPP_SECRET`、R385 第二冷样本；下次 SOP-10 ~R450。

### R445（首页 `.hero-ds`「今日全站同题」行首帧占位 `v-else-if="dsMeta"` → `v-else` + vitest 2；部署 `3dc59fa`，bundle 变、后端不动、无 DB 写入；testing agent 复验全 PASS）
- 取证 docs/iter/round-3/r445-hero-ds-first-frame-placeholder-cls.md。R444 留的两项补齐：① `dsMeta` 来自 `/api/daily_set`（不是 `home_bundle`），`db.daily_set_ids` 按 `md5(day:qid)` 每模块 2 题共 10 题、题库非空即恒有 → 「今日全站同题 10 题」不依赖回包即成立，占位无副作用；② taskcard「−26 px」是 `LayoutShiftAttribution` rect 按视口裁剪的伪象（593+230 = 619+204 = 823），4 态 rect 对照卡高恒 246 → #2 全部成因就是 `.hero-ds` 插入 26 px。
- 修：该行常驻，未回包只显示「今日全站同题 10 题 + 补练往期 ›」，回包后同一行追加「· 已有 N 人完成 / 来做今天第 1 人」，最终态像素不变。6b `/` CLS 0.07 → **0.06**；Playwright sources ×3：#1 0.0608 不变、#2 0.0102 → 0.0024（只剩链接随文字变长水平右移 108 px，P4 登记：改右对齐需 UI 判断）。
- 复验：375/1440 正常态单行无溢出；CDP 拦 `/api/daily_set` + 清 `apiSnap` 快照后 hero 按钮/今日任务卡 y 与正常态 Δ 0.0；rAF 逐帧首帧即占位、回包后 `.hero-acts.top` 不变；`<12px` `[]`、console 0、`/api` 非 2xx 0、healthy 0 重启、LEFTOVER 0。走查坑：`api.js` `apiSnap:` 快照兜底让单 abort 接口不等于错误态（要先清键）；1440 下 uni actionSheet 是 popover、无「取消」键点遮罩关。
- 到期项继续挂：`.sheet-x`/自然旧壳 404 (c)（本次前端发版后可补量）、`error_reason` ≥09-11、`.trend-kn` 4 周、WAL 截断、无可确认外部真人、`WX_MINIAPP_SECRET`、R385 第二冷样本；下次 SOP-10 ~R450。

### R446（只取证登记：`growth_events` probe=0 首次逐 uid 归因 + `stale_fallback` 口径 + R445 发版后 (c) 补量；不改码不部署，生产 `3dc59fa`）
- 取证 docs/iter/round-3/r446-growth-events-probe0-readonly-stale-fallback-postrelease.md。`growth_events` 全仓库**无产品/管理台读路径**（看板 KPI 只读 `answer_log`），唯一读者 `scripts/health_scan.py` → `stale_fallback` 不计入任何看板；生产 20 行全 probe=1（两次 testing agent 断网走查同秒 7/13 行）。
- probe=0 访客级信号：`growth_events` 近 7 天 probe=0 4 个 uid——vivo 小程序 uid、同型号 V2405A Chrome 打开该 vivo 分享码（推断同一持有者）、Windows 老 uid 经双出口 IP 回访（身份不可考）、iPhone 单页跳出 1 次（唯一像外部真人）。`answer_log` R374 后 probe=NULL 新增 0 行。不加看板字段（caddy 日报 `humans.ips` 已覆盖、样本 1），以后到期项复查固定加 `growth_events probe=0 by uid`。
- (c)：R445 发版后 40 min 148 请求 `/assets/*` 404 0、monitor 0，继续挂。到期项无新样本（probe=0 22 行、error_reason 6/0、push_subs 0、weekly_reports 0、29/29 CST 00:00、WAL 560 KB）。

### R447（首页「补练往期 ›」`.hero-ds-arc` `inline-block` → `float:right`，R445 剩余 CLS 尾项 0.0024 归零；1 行 CSS + vitest 1 新/1 改；部署 `c7347a1`，bundle 变、后端不动、无 DB 写入；testing agent 375/1440 全 PASS）
- 取证 docs/iter/round-3/r447-hero-ds-arc-float-right-cls-tail.md。改前一手：375 拦/正常 arc x 144.9→243.6、1440 465.4→564.1（漂 98.7 px），纵向几何不变；1440 下链接落在 924 px 行左 1/4 后面大段空白 → 右对齐更合布局。取 B 方案只改一条规则：`float:right; margin:-12px -8rpx -12px 8rpx; padding:12px 8rpx`（热区 41 px 不变，`margin-right:-8rpx` 让文字右缘与 hero 内容右缘对齐、热区外扩 4 px）；否决父级 flex（uni `<text>` 嵌套编译成 span，匿名 flex item 换行要重验）。
- R440 源锁 `home-r440-fontfloor.test.js`「热区须 inline-block」有意放宽为「inline-block 或 float:right」（都是块级盒、纵向 padding 生效）。
- 复验：6b `/` CLS 0.06、LCP 931、perf 0.99；Playwright sources ×9 只剩 #1 0.0608（uni TabBar 占位）；375/1440 拦/正常 arc rect 恒定、`.hero-acts`/taskcard Δ0；testing agent 逐帧 t=165 占位 → t=191 回包 arc x 不动；**已完成分支实测**「已完成 答对 1/10 · 第 1 名 补练往期 ›」375 单行余量 21.6 px；`<12px []`、console 0、`/api` 非 2xx 0、healthy 0 重启、LEFTOVER 0。
- 坑：右对齐比对用不变量 `arc.right-4 == .hero-bar.right`，绝对 x 随「有无占位滚动条」漂 7.5 px（clientWidth 1425 vs 1440）；`.hero-ds` scrollWidth +4 / innerText 多一个 `\n` 是浮动副作用不是溢出。
- **待老板定**：375 已完成态若同时带 `· 🔥 连 N 天`（推算 +57.9 px，总宽 ≈305.7 > 可用 246.4）会绕浮动折到第二行（不重叠、行高变、且发生在回包后）——streak≥2 无真实数据未实测；不接受则下轮缩文案（如去「·」或「连 N 天」缩成「🔥N」）。
- 到期项（09-06 18:01Z）无新样本：probe=0 22 行/1 uid、error_reason 6/0、push_subs 0、weekly_reports 0、growth_events probe=0 18 行/4 uid 同 R446、WAL 564 KB。(c) 本次发版后待下轮补量；`.trend-kn` 4 周、无可确认外部真人、`WX_MINIAPP_SECRET`、R385 第二冷样本继续挂；下次 SOP-10 ~R450。

### R448（首页「补练往期 ›」`.hero-ds-arc` `float:right` → `position:absolute` 贴右 + `.hero-ds padding-right:124rpx` 留位；2 行 CSS + vitest 1 改（+1 用例）/ R440 锁再放宽；部署 `98dffdf`，bundle 变、后端不动、无 DB 写入；testing agent 375/1440 全 PASS）
- 取证 docs/iter/round-3/r448-hero-ds-arc-absolute-long-text-fix.md。R447 「待老板定」的推算被一手推翻：Playwright 在线上 DOM 注入「已完成 答对 1/10 · 第 1 名 · 🔥 连 2 天」，375 下**文字放得下（290.5/307）但浮动放不下（剩 16.5 px）→ 浮动被挤到下一行、`.hero-ds` 非 BFC 高仍 17 → 链接文字压在「继续目标」按钮上沿、41 px 热区盖住按钮顶部 19 px**。名次恒有（`my_rank` = 高分人数+1），streak≥2 = 连做两天 → 任何真人连做两天即命中，属 R447 引入的 P2 布局缺陷（生产 `daily_set_entries` probe=0 0 行，尚无受害）。
- 修 D：链接绝对定位贴右（`right:-8rpx; top:50%; translateY(-50%)`，短文案 rect 与 R447 像素一致）、父行 `padding-right:124rpx`（链接文字 56.6 px + 间距）让长文案在链接左侧折行、行高增长把 `.hero-acts` 推下（+17）；否决回退 inline-block（漂移回来）、flow-root（负外边距盒不含 padding 仍压）、父级 flex（要改模板、CJK min-content 先压文字）、缩文案（最长形态仍超 246 px）。
- 首页其它「回包后追加文案 + 文字链」行：只有 `.sz-arc`，前文静态 → 无同类漂移。
- 复验：本地 dist 代理与生产同脚本逐项一致；6b 首跑 `/` perf 0.88 一次 WARN → 单独重跑 12 项全 OK（perf 0.93 / LCP 2772 / CLS 0.06）；testing agent 拦/正常逐帧 Δ0、原生做完 10 题已完成态单行右对齐、注入长文案 375 两行居中 acts +17 无重叠、按钮顶部点击正常、`<12px []`、console 0、非 2xx 0、LEFTOVER 0。
- 登记（既有非本轮）：短文案下 arc 热区与「今日计划」按钮 top 重叠 2 px（R440 起，`elementFromPoint(300,517/518)`=arc），可把 padding 12→10 消除，需权衡 R440 ≥40 px 热区契约。
- 坑：量测机无 emoji 字体（🔥 → □），注入长文案的折行点与真机可能差几 px；uni `<text>` 嵌套编成 span，注入文本节点要沿 `contains(arc)` 链下钻到 arc 的父 span 再 `insertBefore`。
- (c) R447 发版后 24 min 246 请求 `/assets/*` 404 0 / monitor 0 → 继续挂，R448 发版后待下轮补量。到期项（18:53Z）无新样本：probe=0 22 行/1 uid、error_reason 6/0、push_subs 0、weekly_reports 0、growth_events probe=0 18/4、29/29 CST 00:00、WAL 1.6 MB；`.trend-kn` 4 周、无可确认外部真人、`WX_MINIAPP_SECRET`、R385 第二冷样本继续挂；下次 SOP-10 ~R450。

### R449（首页 `.hero-ds` 下外边距 20→24rpx，「补练往期 ›」41 px 热区底缘与 hero 按钮 top 重叠 2 px 消除；1 处 CSS + vitest +1；部署 `27e8729`，bundle 变、后端不动、无 DB 写入；testing agent 375/1440 全 PASS）
- 取证 docs/iter/round-3/r449-hero-ds-arc-hitbox-button-gap.md。一手：375 arc 热区 477.4–518.4 vs `.hero-acts` top 516.4 → 2 px 落在「今日计划」x 280–341（1440 按钮左对齐、arc 下方是空白无功能冲突）；几何来源 = 热区下伸 12 px（padding）> margin-bottom 10 px。谱系：R440 负外边距版纵向 rect 相同、当时压的是「继续目标 ›」→ **R440 起既有，非 R447/R448 回归**。
- 方案 A（采纳）margin-bottom 24rpx：热区底 == acts top，arc/按钮尺寸都不变，hero +2 px（静态、非 CLS）；否决 B `.hero-acts{position:relative}`（靠绘制顺序赢命中、意图不可见、链接在按钮 x 段缩 39 px）、C arc padding 12→10（37 px 破 R440 ≥40 契约）。新源锁：`.hero-ds` margin-bottom(rpx)/2 ≥ arc padding(px)。
- 复验：6b 12 项全 OK（`/` perf 0.98 / LCP 1403）；testing agent `elementFromPoint` 1 px 步长 ≤517.4 链接 / 518.4 起按钮，可信点击 (300,517) 往期 sheet、(300,519)/(300,520) 计划 sheet；拦/正常 rAF Δ0；三按钮 top+1 正确；长文案两行 arc 底 526.9 < acts 535.4；`<12px []`、console 0、非 2xx 0、LEFTOVER 0。
- 坑：CDP 仿真 reload 后可能未重申（cw 360、hero 下移 17）→ 1–2 px 边界测试前守卫 `clientWidth==375 && .hero-ds.width==307`；1440 点遮罩关 sheet 会连带触发左侧导航，用 `location.hash='#/'` 回首页。
- (c) R448 发版后 27 min 228 请求 `/assets/*` 404 0 / monitor 0 → 继续挂，R449 发版后待下轮补量。到期项沿用 R448 18:53Z（无新样本）。下一轮 **R450 = SOP-10 四维审计**。

### R450（SOP-10 四维审计「分享 / PK / 小队排行」簇：4 页 28 处 <24rpx 字号抬到 24rpx + `.rank-copy`/`.remind-btn`/`.chip` ≥40px；CSS + vitest +5；部署 `460120f`，bundle 变、后端不动、无 DB 写入；testing agent 375/1440 全 PASS）
- 取证 docs/iter/round-3/r450-sop10-audit-share-pk-team-cluster.md。竞品维度仍无一手（粉笔次级屏需账号）→ 零竞品陈述、不加功能。
- ① 生产只读：`pk_matches` 无显式 probe=0 对局（NULL 1/4、probe=1 9/13）；`shared_questions`/`shared_answers`/`teams`/`team_members` 均无 `probe` 列（探针归因只能经 `growth_events`/镜像 `answer_log`）；该簇 growth_events probe=0 仅 3 行且与 R446 vivo 持有者同源 → **无外部真人样本**。
- ② 源码走查 share/pk/team 后端与 4 页前端：幂等/揭晓/多选/probe 隔离/周榜谓词/提交失败重试/等待轮询/空错态均在位，无缺陷命中，后端不改。
- ④ 命中：`pk.vue` 9 / `team.vue` 11 / `share-q.vue` 5 / `pk-result.vue` 3 = 28 处 <24rpx（生产 `/s/` `/p/` 实测 10.5–11.5px）；`.rank-copy` 32 / `.remind-btn` 36 / `.chip` 33px 热区 <40 → 全抬到下限并源锁（`tests/social-r450-fontfloor.test.js`）。`.timer-t` 最长文案 12px 宽 282 < 311 仍单行（measureText + 生产实测 h17）。
- 复验：6b 12 项全 OK（`/` perf 0.96 / LCP 2287 / CLS 0.06）；testing agent 两探针 uid 走完 PK 双人对局 `HQQVXK`、小队 `r450tm`、单选/多选分享作答，13 页 `<12px []`、非 2xx 0、清理 LEFTOVER 0。1440 `.remind-btn` 未量到（对方当天已作答不渲染；CSS 与视口无关）。
- 到期项无新样本（probe=0 22 行/1 uid、error_reason 6/0、push_subs 0、weekly_reports 0、29/29 CST 00:00、WAL 1.79 MB）。(c) R449/R450 发版后待下轮补量。下次 SOP-10 审计 ~R460。

### R451（只取证登记，不改码不部署；生产仍 `460120f`）
- 取证 docs/iter/round-3/r451-postrelease-404-due-items-weekly-reports-probe-blindspot.md。
- (c) R449/R450 发版后 54 min 642 请求：`/assets/*` 404 0、monitor 0 → 继续挂。
- 到期项：probe=0 22/1、error_reason 6/0、push_subs 0、growth_events probe=0 18/4 不变；**`weekly_reports` 0→1**：uid `umtppgte7u8emh2vs` 20:14:52Z 首开周报，来自 `140.232.64.3`（Devin /24、无 `X-Kg-Probe` 头、Playwright iPhone UA），该 uid 26 answer_log/8 growth_events/6 exam_attempts **全 probe=1（仅网段一路命中）** → 推断同网段兄弟 Devin 会话巡览，非真人。登记：30 张带 uid 无 probe 列的表（含 weekly_reports/push_subs）到期项要 join answer_log 看 probe，不补列（产品读路径不跨用户聚合这些表）。
- R450 遗留 1440 `.remind-btn`：合成元素 + 真实 `data-v-806c425f` scoped CSS 量得 1440/375 均 h40、fs12、min-height 40px → 闭合。
- WAL 3.05 MB、healthy 0 重启、当前容器日志 0 异常、宿主 91%/4.5 G。

### R452（只取证登记，不改码不部署；生产仍 `460120f`）
- 取证 docs/iter/round-3/r452-probe-route-dependence-7d-caddy-readonly.md。7 天 caddy 按 `auth.probe_request` 三路复算：1233 uid，**~864（70%）只靠网段一路**命中（GUI 走查 UA 与真人无异）；网段外无签名自动化 **0 uid**；非探针 uid 10 个全部归因（5 已知设备 + 3 扫描器 + 2 单页访客），与库内 probe=0（answer_log 22/1、growth 18/4）一一对应、无未归因行 → 当下无污染。风险形态 = Devin 出口 /24 变更当天 GUI 走查整批 probe=0，现有日报 `humans.ips` 会立刻放大 → 不加码，SKILL 到期项加「突增先核 CIDR」。
- 兄弟自动化 uid 首见 09-06 11:05:29Z 首页冷启动四连，全程 `140.232.64.3`。
- 到期项不变；候选真人 +1（Windows 171.114.10.99 只读首页 0 作答）；WAL 3.15 MB。

### R453（宿主 Caddyfile 删旧 `kaogong.zalize.com` 站点块；应用不改、生产仍 `460120f`）
- 取证 docs/iter/round-3/r453-legacy-caddy-block-bypass-scanner-pair-trend-kn.md。
- **归因纠正**：R446「唯一像外部真人」的 iPhone iOS 18.3 访客（`59.83.208.103` 09-03/09-04）= Palo Alto Networks 扫描器配对的 Linux 无头 Chrome 移动仿真：页面 UA iPhone、同会话 `/sw.js` UA `X11; Linux x86_64`；与 `Hello from Palo Alto Networks` UA 同秒相邻 IP 成对 4 次（08-20/08-25/09-03/09-04）；全部**直打 VPS IP、SNI `kaogong.zalize.com`、无任何 CF 头**，走的是迁移后已死的旧 Caddy 块（08-19 起 33,292 行边缘头 0）。候选真人 −1。
- 缺陷修（P2）：旧块仍全路径 `reverse_proxy 127.0.0.1:8300`，扫描器拿到完整壳 + 实时 API、后端只见直连 IP → `growth_events` 写 probe=0 1 行 / NULL 2 行（保留不改），日报 `crawler_stats` 只读 origin 日志看不见这条通道。删块（不是加 403：留块 Caddy 09-28 起为该域续签 LE 必失败刷 journal 至 10-28 过期）。备份 `Caddyfile.bak-r453`，validate → reload；直打 SNI → TLS alert；公网 `/`、`/tiku/`、`/api/*` 200 rev 对；origin 直连 403；兄弟站 200。`deploy/README.md` 回滚步骤改为 DNS + 恢复块。
- 日报 `humans.ips` **未**把 3 扫描器算候选真人：ShapBot（R452 截成 `ShapBo`）X-Kg-Ua 含 `bot` → BOT_GENERIC；Firefox Ice / Mac 访客 referer pages.dev → offhost；PA/iPhone 不在 origin 日志。本地同参数重算 = 生产 json。
- `.trend-kn` **闭合**：自然 4 周已掌握样本仍只有 vivo 小程序 uid 2 条（小程序不渲染 H5 趋势卡）；合成元素量真实 `data-v-bcbaf750`：375/1440 `.trend-kn`/`.trend-n` 均 fs 12 / h 14 / 600 → 已在 12px 下限。登记改为「有真人 k>0 样本时看 4 列排版」。
- 到期项：probe=0 22/1、error_reason 6、push_subs 0、weekly_reports 1、growth probe=0 18/4 不变；WAL 3.16 MB；healthy 0 重启。
- **跨产品登记（非本轮引入）**：`www.zalize.com` LE 续签自 09-05 起持续失败（tls-alpn-01 打到 CF 边缘 `Cannot negotiate ALPN acme-tls/1`；ZeroSSL 回退 `caddy_legacy_user_removed`），证书 **10-04 到期**，不修会在 CF Full(strict) 下断站。修法（CF Origin CA / DNS-01 / dns-only）属 zalize.com 运维，待老板定；本仓库不动。

### R454（只取证登记，不改码不部署；生产仍 `460120f`，宿主为 R453 删块后状态）
- 取证 docs/iter/round-3/r454-post-legacy-block-removal-readonly-pagesdev-scanner.md。
- 删块复验：直打 SNI 仍 TLS alert（rc 35）；旧块日志 mtime 停在 09-06 06:07Z、删块后 0 新行；caddy journal **0 条** TLS 握手噪音（Caddy 默认级别不记未知 SNI 握手失败，直打量不可由 journal 观测）；reload 后 journal 唯一 error `http2: stream closed` ×48 按同秒 access log 归属 `api-video.zalize.com`（今日 1454 条、04:10/04:25/04:40 CST 成簇，早于 reload），与 kaogong 无关。
- 库内：近 24 h `growth_events event='boot'` 33 行 = 32 probe=1 + 1 probe=0（R446 vivo 持有者 Chrome 入口 uid），NULL 0 → 无新绕边缘写入；3 扫描器 uid 库内只有 ShapBot `slow_load` NULL 1 行 + PA/iPhone `boot` NULL 1 行（Firefox Ice 0 行），保留不改。`growth_events` 列是 `id,uid,event,source,ref,created_at,probe`；`error_reason` 在 `mistakes` 表。
- **pages.dev 预览域名扫描器活体**：20:41:46Z `34.44.11.77` 同秒 9 GET（UA `SonyEricssonW810i` 功能机描述符、`/sw.js` 暴露 `HeadlessChrome/143`、referer/`X-Forwarded-Host` 全 `kaogong-h5.pages.dev`），0 POST、库内 0 行；7 天经 pages.dev 共 37 请求 / 13 IP / 0 POST / 0 引擎 UA，全一次性访客。日报按 offhost 单列不进 `humans.ips`。**登记 P3 不动手**：`_routes.json` 把 `/`、`/static/*` 排除在函数外，函数内按 hostname 301 覆盖不到首页壳，要么收回 `/`（改 Pages 迁移 `3d28c33` 静态层设计，非 R271）要么 CF 账户级 Bulk Redirects；触发条件见 SKILL R454。
- 到期项全不变：probe=0 22/1、error_reason 6（3 uid 全 NULL 历史）、push_subs 0、weekly_reports 1、growth probe=0 18/4、29/29 CST 00:00、WAL 3,164,192 B（与 R453 同字节）、healthy 0 重启。
- 宿主盘 92% / 3.9 G（R452 91% / 4.5 G）：`/var/lib/docker` 12 G，24 h 新增大文件为其它产品的 containerd 层（python3.12 + cv2）与 softcopyright/recruit 备份；`kaogong-backups` 480 M（+12 M）。扩盘/迁出仍待老板定。

## R455（WAL 机理闭合 + `_routes.json` 出处勘误；只取证不改码不部署，生产仍 `460120f`）
- 「WAL 截断观测」**闭合**：直接解 `-wal` 头/帧——3,164,192 B = 768 帧 × (4096+24) + 32，当前 salt 有效帧 768/768、最后 commit 帧 768、`ckpt_seq 0`；`wal_autocheckpoint` 未设即默认 1000 帧 → **尚未到自动 checkpoint 阈值，文件只增是预期**；到 1000 帧（≈4 MB）写连接 PASSIVE checkpoint 后从帧 0 复用、大小停在高水位，只有 > `journal_size_limit` 64 MiB 才截断。历轮 431 KB→3.16 MB = 帧 105→768 累积，非泄漏。到期项口径改为：仅 `-wal` > 64 MiB 且持续 > 1 天才立项（长读事务阻塞复用），不再逐轮记字节。
- 推断（未查前一容器退出信号）：主库 mtime 15:05Z 早于容器 19:41Z 启动 + `ckpt_seq 0` → 进程停止未走连接关闭路径，WAL 跨重启被新进程接续（SQLite 正常恢复路径，无损）。
- **勘误**：R454 把 `_routes.json` 排除 `/`、`/index.html`、`/static/*` 写成「R271 设计」错误——`git log -S` 一手：Pages 迁移 `3d28c33` 首次创建（README「静态层由 Pages CDN 直出」），`eef6113`（#163）把 `/assets/*` 收回函数；R271 只是 `/api/search` 边缘缓存。R454 文档/handoff 已改（`24cd26b`）；pages.dev 301 方案取舍不变（优先 CF Bulk Redirects）。
- 到期项不变：probe=0 22/1、error_reason 6、push_subs 0、weekly_reports 1、growth probe=0 18/4、healthy 0 重启、`KG_PROBE_CIDRS` 在配、VPS 出口 `150.109.230.174` 未变；无前端发版 (c) 无新窗口。
- 取证：`docs/iter/round-3/r455-wal-frames-autocheckpoint-routes-origin-erratum.md`。

## R456（停机不 checkpoint 的机理坐实 + 探针出口 /24 复核；只取证不改码不部署，生产仍 `460120f`）
- R455 推断**成立**：本地同源码 `python3 -m uvicorn` 起服 → 写入 → `kill -TERM`，uvicorn 日志 `Shutting down … Finished server process`（优雅关闭），但主库 mtime 不变、`-wal`（4003 帧）/`-shm` 原样保留——`get_conn()` 线程本地连接从不 `close()`、无 lifespan/atexit 钩子，解释器退出不析构其它线程 TLS 里的连接 → 无 checkpoint-on-close。生产旁证：容器 19:41:40Z 由 R450 `compose up` 重建、PID 1 是 exec 形式 uvicorn、主库 mtime 15:05Z 早于启动、`ckpt_seq 0`。SQLite 正常恢复路径、`synchronous` 默认 FULL，**无数据风险**；**登记 P4 不动手**（加 shutdown 钩子 TRUNCATE checkpoint 收益只是重启后 WAL 归零，多一条停机故障点）。
- `app_log_snapshot.sh` 在停容器前归档 → 归档永远没有 `Shutting down` 行；`docker events --since 36h` 对该容器为空。要看生产停机形态需在 deploy 脚本停容器后再 `docker logs --tail` 一次（未加，无需求）。
- R452 复核（origin 24 h）：Devin 出口全在 `140.232.64.0/24`（`.2/.3/.4/.5`，`.5` 新增仍在段内）；网段外 Headless 且无探针头仅微软/Bing 网段 3 条 + R454 pages.dev 扫描器 1 条 → 无 probe=0 污染风险变化。
- 到期项沿用 R455 快照无变化。取证：`docs/iter/round-3/r456-shutdown-wal-not-checkpointed-probe-cidr-recheck.md`。

## R457（部署重建窗口一手时序；只取证不改码不部署，生产仍 `460120f`）
- R450 部署（`compose up -d --build` Recreate）逐秒：dockerd 19:41:40.13Z 发停止 → 19:41:40.72Z 旧进程退出（**SIGTERM 0.58 s**，远小于默认 10 s stop timeout，`stop_grace_period` 未配无需配）→ 新容器 19:41:43.77Z 起 → 19:41:45.65Z uvicorn listening（startup 同毫秒完成，无 lifespan 阻塞）→ 源站不可达窗口 **≈5.5 s**。origin 窗口内 **0 请求**（两侧最近 19:41:34.6 / 19:41:47.7 均部署轮询）→ 本次 0 个 5xx 是流量没打进窗口，不是窗口为零。
- 7 天 origin ≥500 仅 4 条：3 条 `wxlogin` 503（`WX_MINIAPP_SECRET` 未配已知）+ 1 条 09-06 00:35 `/api/health` 503 25.9 s（~~已登记的共宿负载抖动，非部署窗口~~ **R458 勘误：就在 00:35Z 部署 Recreate 窗口内，见 R458**）→ 有 compose log 的 12 次部署无 5xx 落窗。
- `--timeout-keep-alive 130` 是空闲保活，与停机等待无关；边界登记：停机瞬间在飞长 SSE 会等到 10 s 被 SIGKILL 流中断，7 天无样本、部署都在探针窗口 → 不加 `stop_grace_period`。压窄 5.5 s 需双容器/Caddy 重试（宿主拓扑改动）→ **P4 登记**。
- 同秒 dockerd `healthcheck failed … only one connection allowed` 是 dockerd↔containerd gRPC 告警（推断），非应用 healthcheck，容器全程 healthy。
- 到期项 21:26Z 实查无变化（probe=0 22/1、error_reason 6、push_subs 0、weekly_reports 1、growth 18/4、WAL 3,164,192 B、healthy rc=0）。取证：`docs/iter/round-3/r457-deploy-window-timeline-stop-timeout.md`。

## R458（autoheal 重启形态 + 14 天动手记录 + compose 10 s 强杀 2 次 + 09-05 盘满 53 s + R457 勘误；只取证不改码不部署，生产仍 `460120f`）
- autoheal 近 14 天对 `deploy-kaogong-1` **动手 22 次**（08-31 4 / 09-02 2 / 09-03 10 / 09-04 6），全部在 R372/R373 上线（09-03 12–17Z 连续发版）前后的假死期，**09-04 05:56:49Z 之后 0 次**（到 09-06 21:15Z 共 2.6 天；时间相关非受控对照）。
- 形态 = `docker restart t=30` **原地重启**：容器 ID 不变、`StartedAt` 变、`RestartCount` **不加** → 历轮「healthy 0 重启」只证明未被 restart policy 拉起，**不能**当「没被 autoheal 重启」。至少 2 次一手观测 `exited unhealthy 137`（03:47:19 发出 → 03:48:26 观测 → 03:48:28 新起，68 s；01:57:25 → 01:58:04 → 01:58:05，40 s）= 30 s 超时被吃满后 SIGKILL；其余 20 次发出→新起 40–88 s，退出码未观测（60 s 轮询）。unhealthy 态（进程被换出/假死）SIGTERM 无人响应，30 s / 10 s 只决定多等多久 → 不改超时、不加 `stop_grace_period`。
- compose 路径 09-06 也有 **2 次** `failed to exit within 10s - using the force` 落在 kaogong（14 天 12 条逐 ID 对 `container-events.log`，其余 10 条属兄弟产品）：00:35Z（rev `bf23e59`）停止 00:35:17.5 → task-delete +2.4 s → 强杀 +10 s → 新起 00:35:54.5（**窗口 ≈37 s**，mem_avail 341 MiB / swap 2.6 GB）；08:53Z（rev `1085031`）同形态 **≈32 s**。「task-delete 已到仍等满 10 s」机理未解。窗口内流量：00:35 只有部署轮询自身 `/api/health` 503 25.9 s（**R457 表 3 / handoff「00:35 共宿抖动非部署窗口」勘误**：`/tmp/kg-compose-*.log` 13:47Z 前不存在，无 log ≠ 非部署；用 `deploy-history.log` + `container-events.log` 归因），08:53 窗口 0 请求 → 仍无用户可见 5xx。
- **09-05 14:44:19–14:45:12Z 宿主盘真满 53 s**：journal `No space left on device` 12,542 行（rsyslog / caddy 写 kaogong origin 日志失败 → 该窗口 origin 日志是盲区不是无流量）；同秒 `a987b2dbc0fb…` crash-loop（exit 1/3 rc 19→23）+ `ep=recruit-app` + 4 个 Devin 出口 SSH 会话 → 推断兄弟会话构建/备份写满又释放，非 kaogong 容器。kaogong：窗口内 `answer_log`/`growth_events` 0 写入、`quick_check ok`；自身 caddy 日志 `roll_size 50MiB/keep 14` 非肇因。现 `df /` 90% / 4.8 G（`kaogong-ops.log` 09-07 03:40 CST 报 94%）；R454「不到一周进 95%」已以瞬时 100% 兑现一次，再满一次若逢作答写入 = 用户可见 500 + 日志盲区；**扩盘 / 迁出 recruit·softcopyright 仍待老板定**。
- 到期项 09-07 01:2xZ 实查无变化（probe=0 22/1 **严格 `probe=0` 口径**——`COALESCE(probe,0)=0` 会把 R374 前 1001 行 NULL 算成 1023/57、error_reason 6 关联 probe=0 为 0、push_subs 0、weekly_reports 1、growth 18/4、29/29、WAL 3,164,192 B、healthy rc=0 StartedAt 未变、autoheal rc=25 对 kaogong 无新动作）。取证：`docs/iter/round-3/r458-autoheal-restart-form-sigkill-diskfull-erratum.md`。


## R459（09-03/09-04 两次 137 归属坐实 = autoheal 30 s 强杀、earlyoom 排除 + dockerd↔containerd 会话断连与「task-delete 已到仍等满」强相关 + R458 journal 只剩 1.6 天勘误；只取证不改码不部署，生产仍 `460120f`）
- 宿主历史日志：journal **只从 09-05 14:43:34Z（盘满那一秒）起有档**（`--list-boots` 仅一段、宿主 08-10 起未重启 → 推断盘满触发 journald 清档），R458「journal 14 天 12 条」实为 1.6 天（**勘误**，结论不变）。完整历史在 rsyslog `/var/log/syslog{,.1}`（08-30 起）+ `.2-4.gz`（到 08-09）。
- 两次 137（09-03 03:47Z `dea4dbd7` / 09-04 01:57Z `56d67abc`）：syslog dockerd 同秒 `failed to exit within 30s of signal 15 - using the force` 直接对上 autoheal 发出时刻；earlyoom 08-30 起全部动作只在 08-31 05:07–06:27Z、09-01 起 0 行、内核 OOM 0 → **归 autoheal 30 s 吃满 SIGKILL，earlyoom 排除**。而且 autoheal 22 次里 **21 次**在 dockerd 有 30 s 强杀行（逐 ID 多重集精确匹配；第 22 次 09-04 01:37:00Z 落在上一次重启未完成的 90 s 内无独立停止）；宿主 14 天 `within 30s` 强杀 21/21 全是 kaogong → 「30 s 强杀」= autoheal 在 dockerd 侧的唯一签名。
- earlyoom 唯一一次动到 kaogong：08-31 05:07–05:11Z 对 `uvicorn`（RSS 709 MiB）12 次 SIGTERM 全 `kill failed: Timer expired`；06:26–06:27Z 再 6 次失败后 **06:27:06Z SIGKILL 击杀**（容器 `3e9744d246ac`），restart policy 43 s 后拉起（中间 30 s `failed to delete container from containerd`）。同日 05:11Z/05:26Z 两次同 ID 10 s 重启是当时操作者手工 `docker restart`（排除法推断）。
- 「task-delete 已到仍等满超时」：09-06 00:35Z stop 后 0.8 s `healthcheck failed`、5.8 s `healthcheck failed fatally`（dockerd↔containerd 会话 `only one connection allowed`）；09-06/07 全宿主 19 条 10 s 强杀里 10 条前 12 s 内有 fatal 行（3 天 202 条 fatal，12 s 窗口随机命中 ≈1.3%）→ **强相关**；30 s 路径同款且再多一次 `within 10s of kill - trying direct SIGKILL`。推断 = dockerd 丢/迟处理 containerd 退出事件后对已死进程补一刀，无害、只把不可达窗口拉长 8–30 s；08:53Z 那次无 fatal 行 → 未完全解释；宿主级跨产品，本仓库不动。
- 14 天停机形态全景（syslog，CST 日，kaogong 归属启发式）：kaogong 10 s 强杀 08-30 45 / 08-31 63 / 09-01 57 / 09-02 8 / 09-03 10 / 09-04 11 / 09-05 1 / 09-06 2 / 09-07 0，部署量 27–81 次/天不减 → 「停机 SIGTERM 无人应答」比例在 09-02 起骤降、R372/R373（09-03）后归零；时间相关非受控对照（09-02 已在降说明另有因素）。
- 到期项 05:29Z 无变化（probe=0 22/1、growth 18/4、error_reason 6/关联 0、push_subs 0、weekly 1、29/29、quick_check ok、healthy rc=0）；宿主 `df /` **92% / 3.9 G**（一夜 −0.9 G）、swap 2.5 GB。处置：不改 autoheal 超时/不加 grace/不动 earlyoom/不在部署脚本处理 dockerd 会话断连，全部登记。取证：`docs/iter/round-3/r459-exit137-attribution-earlyoom-vs-autoheal-dockerd-task-delete.md`。

## R460（SOP-10 四维审计「成长页 / 周报 / 知识点趋势」簇 → 4 处前端命中修复；生产 `460120f` → `1177fb1` → `fe57df3`）
- 竞品维度：粉笔次级屏仍无一手截图，零竞品陈述、不据二手加功能。运营实体：本簇仍无可确认外部真人；`answer_log` probe=0 22/1 → **33/1**、`growth_events` probe=0 18/4 → 20/4、`mistakes.error_reason` 6 → 7（关联 probe=0 的 0 → 1）、`weekly_reports` 1 → **2**，增量全部归因于 R425/R446 已知 vivo `V2405A` 内部验收设备 09-06 21:37–21:45Z（CST 05:37）一次 ~~H5~~ 会话（**[R461 勘误]** 实为微信原生小程序、W6 分支构建，R460 的 H5 改动该设备看不到；移动网段、无探针头、非自动化 UA → probe=0 打标正确）；该会话走完 `/api/growth`、`/api/mastery/map`、`/api/report/weekly`（周报行由设备首开生成，非量测写入）。`push_subs` 0、`quick_check ok`、WAL 4.12 MB（已过 1000 帧自动 checkpoint，停在高水位）。
- 命中并修（后端不动、无 DB 写入）：① `stats.vue` 成长趋势把「最后两条有数据周」固定叫「本周比上周」（服务端 `growth_stats` 只返回有作答周）→ `checkin.js` 新增 `cnWeekKey`（与 SQLite/Python `%Y-%W` 同口径，2024–2027 逐日对拍 1461 天一致），末两周确为本周/上周才用原文案，否则点名两周（生产历史 uid 改前「本周比上周提升 0」→ 改后「26年第31周比26年第30周提升 0」）；② 热力图 `hmTotal` 起点 `today−83` → 与 12 列格子同起点 `today−dow−77`（周日多算 6 天）；③ `.gw-wk` 130→150rpx、`.gw-pct` 150→180rpx + `nowrap`（375 改前折两行）；④ `.gw-tab`（≈19px）与 `mastery-map.vue .tab`（375 实测 31.4px）→ `min-height:40px`。vitest +5 源锁 `tests/stats-r460-growth-week.test.js`。
- 未命中登记不改：`report.py` 周报语义/状态机、`/api/mastery/map` 仅本 uid 聚合无需 `REAL_TRAFFIC`、`calendar.vue` 今天标记用设备本地日期（R438 口径）、4 页样式块 `<24rpx` 为 0。
- 复验：vitest 634 / eslint / build 绿；两次部署 rc=0，R460 6b `/` perf 0.88 一次 WARN → 独立复跑 0.93 全 OK；R460b 一次全 OK（0.94 / LCP 2294 / CLS 0.06），部署窗口 origin 89 请求非 2xx 0；375/1440 生产量测 `.gw-wk/.gw-pct` 单行、`.gw-tab` 40、`mastery .tab` 40、`.side-item` 40。
- 如实：375 仿真 cw=360 致 24rpx 计算 11.52px（1440 为 12px），不据此改字号；热力图合计差异为源码推导未见生产数值差；无 testing agent 录屏（未另行授权）。宿主盘 **92–93% / 3.6–4.2 G**（部署时镜像构建瞬时 93%）。
- 取证：`docs/iter/round-3/r460-sop10-audit-growth-weekly-mastery-cluster.md`。PR #619 仍 open（R400–R460 同分支）。

## R461（R460 勘误：vivo 会话是微信原生小程序 W6 分支构建、非 H5 + 本簇接口层全 200/≤85 ms + W6/W7 小程序 `onAiAnalysis` 无 in-flight 守卫致 4 次并发 20–40 s LLM 请求（他人分支，评论登记）；只取证不改码不部署，生产仍 `fe57df3`）
- **勘误（如实认错）**：R460 把 vivo `V2405A` 09-06 21:37–21:45Z 会话写成「H5 会话」错了——272 行 origin 日志 UA 全 `MicroMessenger … MiniProgramEnv/android`、Referer 全 `servicewechat.com/wx01f2f29cfe51baba`（= `miniapp-native` AppID）→ 微信原生小程序；且会话打的 `/api/report/weekly`、`/api/mastery/map`、`/api/predict`、`/api/shenlun/stats`、`/api/exam/attempts`、`/api/mistakes/analysis`、`/api/explain/stream`、`/api/pk/mine`、`/api/access_info` 在 main/#619 的 `miniapp-native` 里 0 命中、在 `origin/devin/w6-mp-parity`（#634）/ `w7-mp-flat-v3`（#636）10/10 命中 → 设备跑的是**未合 main 的 W6 分支构建**（哪个 commit / 体验版或开发版不可知）。R460 4 处 H5 命中该设备看不到；R460 其余结论（probe=0 打标正确、非外部真人、后端不动）不变。R460 文档 + handoff R460 节已加指针。
- 逐页复盘（按接口束归组，非客户端路由日志）：首页冷启动 7 GET → 错题本 → 模考 → 统计页（`stats/growth/mastery/map/checkin/summary/shenlun/stats/predict` 6 GET 束 ×8 次进出共 60 次，**全 200、3–85 ms**）→ 我的页 ×2（`checkin/badges/pk/mine/reminders/growth/mistakes`）→ 21:38:07 `wxlogin` **503**（`WX_MINIAPP_SECRET` 未配，唯一非 2xx）→ 练习 ziliao/changshi/shuliang 三组 11 次 `answer_log`+`mistakes` → 21:39:49 `PATCH /api/mistakes/2923` 写 error_reason 第 7 条（`纯蒙的`，q 296322，用户自填）→ AI 讲解 ×2（`explain/stream` 41.5 / 41.7 s，LLM 时长 R421 口径）→ **AI 错题分析 ×4 并发**（起点 21:41:25/:36/:47/:48，19.7–39.8 s，全 200 845–879 B）→ 周报 ×2（`report/weekly` 506 B `summary.n=24` → `next_event` → `read`，3–10 ms）→ `growth` 单独 ×6。空态按响应字节推断：`predict` 34 B = 设计冷态 `{"status":"cold","need":100}`、`shenlun/stats` 51 B 无记录；growth/mastery/周报非空。**无渲染层证据**（小程序真机）。
- 命中（在 W6/W7 分支、不在 main）：`miniapp-native/pages/book/book.ts` `onAiAnalysis()` 只 `if (this.data.aiHtml) return;` 不判 `aiLoading` → 等待中关面板再点入口即再发一次 20–40 s LLM 请求（4 次 = 4 份 LLM 花费、后者覆盖前者）；H5 `book.vue` 有 `if (this.aiLoading || …) return;` 守卫。顺带：R460 ①「本周比上周」W7 `stats.ts` 已独立修（`cur.label + '比' + prev.label` + 自带 `cnWeekKey`）、W6 未修；R460 ② 热力图合计 W7 `utils/cn-date.ts:61` 仍 `today−83`（W6 原版按格子累加无此缺陷、W7 重写引入）。**不动他人活跃分支**，评论到 #636（含 #634）登记一行修法。
- (c)：R460 两次发版后 21:00Z 起 845 请求 `/assets/*` 404 0、monitor 0、非 2xx 1（上面 503）→ 继续挂（小程序不加载 H5 壳，与 (c) 无交集）。到期项无增量：probe=0 33/1、growth 20/4、error_reason 7、push_subs 0、weekly_reports 2、`quick_check ok`、WAL 4.1 MB 高水位、healthy 0 重启、宿主 92% / 3.9–4.2 G。
- 如实：「W6 构建」是接口集合 × `git grep` 一致性推断；4 并发归因「关面板再点」是守卫缺失 + 起点间隔推断（W6 `request` 无重试已读，无客户端埋点）；`explain/stream` 两次是否同题不可知；空态为字节推断。
- 取证：`docs/iter/round-3/r461-vivo-session-is-miniapp-w6-build-erratum-analysis-double-fire.md`。PR #619 仍 open（R400–R461 同分支）。

## R462（W5/W6/W7 分支线与 #619 合并冲突面预判：冲突根在 W5 #630、26 文件、两向机械解法分别回退 32 / 4 条源锁 → 合并顺序建议先 #619；只取证不改码不部署，生产仍 `fe57df3`）
- **冲突根不在 W6/W7，在共同祖先 W5（#630 `devin/w5-integration`）**：四条小程序分支（#634 `w6-mp-parity` / `w6-exam` / `w6-social` / #636 `w7-mp-flat-v3`）与 #619 的冲突集合完全相同 = 「main + W5」再合 #619 的 **26 文件**（23 vue + `backend/app/db.py` + `docs/handoff-context.md` + SKILL）。任务原定的 `checkin.js`（W5 未动）与 `miniapp-native`（#619 0 文件）**都无冲突**。
- **W5 分自 `bcf4662`（09-04 17:53Z）未再 rebase，而 `origin/main` 至今就停在 `bcf4662`**——#602–#619 共 150 提交全未合，生产 `fe57df3` 跑的是 #619 分支；W5 是在比生产落后 R383–R461 的 main 上重排了 23 个 H5 页面（+4654/−5883），这 23 个文件 #619 侧有 29 提交 / 31 轮次（R391–R460b）+461/−301。
- **两向机械解法都回退已修缺陷**（#619 vitest 89 文件 / 654 条为尺）：取 W5 侧 `-X ours` → **32 失败 / 16 文件**，功能级：R413/R414/R428 多选作答 `togglePickLetter`（W5 0 命中）、R415 `shouldPushProgress/_progPushed`（0）、R398 `aiLoading ||` 失败可重试（0）、R421/R423 `thinkSecs`（0）、R460 `cnWeekKey`（0）+ R410/R411/R412/R430/R440/R445/R447–R450 字号·热区·占位；取 #619 侧 `-X theirs` → 仍 **4 失败**（W5 非冲突 hunk 并入：`book.vue` `k === it.answer` 多选标记回退、`stats.vue` 硬编码「本周比上周」、chip 36px、`.hero-ds` 条件渲染回来）。→ **无自动策略可用**，逐文件人工合并 + #619 vitest/eslint/build 全绿为门。
- `db.py` 4 块冲突全在 `get_mistakes` 两条联查：W5 `q.question AS q_question` + `_hydrate_mistake`（有 options 时 `question_text` **无条件**取题库题干）vs R400 `q.hs_explanation AS q_hs` + `explanation` 为空才回落 → 两列两步可两存；W5 无条件覆写会让 R396/R400 隔离/修正题在联查到时被题库当前题干替换，建议只补空（P3 登记，需 W5 方确认）。
- **合并顺序建议**：先合 #619（= 生产已跑代码，main 落后生产才是异常态）→ #630 在新 main 上重合、人工解 26 处、跑 #619 654 条 → #634 → #636（W6/W7 只改 `miniapp-native` + docs）。反向等价数量但会让生产回退 R383–R461 直到 #619 重合。已在 #619 与 #630 评论登记。
- 到期项 22:44Z 无增量：probe=0 33/1（末条 09-06 21:39:44Z = R461 vivo）、growth 20/4、error_reason 7（≥09-11 **0**）、push_subs 0、weekly 2、`quick_check ok`、WAL 4,124,152 B 同字节、healthy 0 重启；(c) 22:30Z 后 81 请求 404/monitor 0、非 2xx 仅本轮脚本直打 origin 的 1 条 403 自归因；宿主盘 **93% / 3.4 G**（续降）。
- 如实：32/4 是源锁正则计数（W5 换写法会误报，但 6 个功能符号 W5 侧 0 命中为真缺失）；W5 未 rebase 按 merge-base 判定；W5 子 PR #625–#629 内部关系未展开；本轮未执行任何合并。方法：git 2.34 无 `merge-tree --write-tree`，用 detached worktree `merge --no-commit` 取 `--diff-filter=U`，结束 `worktree remove`。
- 取证：`docs/iter/round-3/r462-w5-w6-w7-vs-pr619-merge-conflict-preview.md`。PR #619 仍 open（R400–R462 同分支）。

## R463（W5 `--hit-min` 44 与 #619 40px 口径对照 + 申论页 `pkgA/shenlun` 从未过 R410+ 字号/热区审计；只取证不改码不部署，生产仍 `fe57df3`）
- **两层规则并存不冲突**：W5 44 是设计系统组件层（KgButton sm/md `::after`、KgChipRow padding+`::after`、KgSheet ✕ 44×44，视觉 20/28/32/36 不变），#619 40 是页面层（每个可点元素 `min-height: 40px` + 源锁）。凡 W5 真撑到 44 处取 W5 写法不算回退，只需源锁正则接受 `var(--hit-min)`/`::after`。
- **W5 侧 5 处既不到 44 也不到 40**（合并时按 #619 保留或换 `kg-button size="sm" variant="text"`；已评论 #630）：`book.vue` `.kpchip` 32（#619 40）、`book.vue` `.cf`×6/`.pbadge` = `kg-tag` 20px 当按钮、`q-social-bar.vue` `.qsb-link`/`.nop` 去掉了 R412 40px、`home.vue` `.hero-lnk` ≈ 34、`shenlun.vue` `.paper-tag`/`.tappable` = `kg-tag` 20px。`KgTag` 组件本体无撑高逻辑。
- **我方命中（R464 立项）**：`pkgA/shenlun/shenlun.vue` 从未过 R410+ 审计——源码 15 处 `20–23rpx`（375 下 10–11.5px）、可点 `.seg-i/.chip/.chip.sm/.q-paper.tappable/.q-go/.sheet-x(本页自写筛选 ✕)/.d-copy/.back/.d-h.toggle` 无 min-height；生产 375 实测（360 仿真 ×1.042）seg-i 30.7 / chip 30.7 / q-paper 19.6 / q-go 28.6 / sheet-x 30.8 / chip.sm 27.7，字号 chip 11.5 / q-paper·q-type·q-meta 11.0（×60 节点）。R430/R440/R450/R460 四次选簇都没含申论。达标的：`.more` 45.8、`.m-star` 42.2、`.sf-btn` 42.2。
- R462 `-X ours` 32 失败按口径拆三类：功能缺失 7 文件（必取 #619）/ 布局 3 文件（人工）/ 字号热区 6 文件（达标改锁、上面 5 处取 #619）。W5 `--fs-caption: 12px` 写 px 与 #619 12px 下限一致。
- 到期项 22:58Z 无增量：probe=0 33/1、growth 20/4、error_reason 7（≥09-11 0）、push_subs 0、weekly 2、`quick_check ok`、WAL 4,124,152 B 同字节、healthy 0 重启；(c) 22:40–22:58Z 99 请求 404/monitor 0；宿主 93% / 3.5 G。
- 如实：W5 页面无渲染量测（分支未构建），`::after` 44 在 uni H5 下是否被父级 `overflow: hidden` 裁掉未验（kg-chip-row 未写 `overflow: visible`）；1440 量测因 Playwright↔Chrome service_worker target 断言崩掉未取；申论素材 tab/详情页只按源码判。
- 合并：R462「先合 #619」一轮无异议 → 按 CHARTER 第 7 条，R464 起点由项目负责人合并 #619 → main（本地门 vitest/eslint/build + pytest/ruff/pyright），再在新 main 上做 R464 申论修复。
- 取证：`docs/iter/round-3/r463-w5-hit-min-44-vs-pr619-40px-shenlun-unaudited.md`。PR #619 仍 open（R400–R463 同分支）。

## R464（申论页 `pkgA/shenlun` 首次过 R410+ 字号/热区审计；前端 1 文件 + 源锁，生产 `fe57df3` → `04ef7f7`）
- R464a：本地门全绿后尝试合 #619 → main 被平台策略拒绝（`gh pr merge`：Devin 不得合入 main）→ 已告知老板需人工点 Merge；R464b 继续叠在 #619 同分支。
- 改动只在 `shenlun.vue` `<style>`：15 处 `20–23rpx` → `24rpx`；10 类可点元素 `min-height: 40px`（`.seg-i .chip(.sm) .q-go .sheet-x .back .d-nav-btn .d-h.toggle .d-copy .retry .grade-btn`），`.q-go/.sheet-x/.d-copy` 用负外边距不抬行高；`.m-foot` baseline→center。
- **页面层首次用 `::after` 撑命中区**：`.q-paper.tappable`（「只看本套卷」带底色小标签）保留 19.8/21px 视觉，`::after` 40px 带；一手 `elementFromPoint` ±19 命中 / ±21 不命中（375/1440、本地与生产各一次）。以后同类「带底色的小标签当按钮」优先此法，不把标签撑成大药丸。
- 生产复验 375/1440 全部 ≥40（表见取证 §3），改后 `<11.5px` 叶节点只剩 uni TabBar label 10px ×5；卡片高/`.q-top`/`.sheet-h` 未被撑高。
- 部署 rc=0、rev 一致、6/6 回归 200；perf 随部署 0.88 WARN → 独立复跑 0.93 OK（R460 同形态）。到期项 23:17Z 无增量：probe=0 33/1、growth 20/4、error_reason 7（≥09-11 0）、push_subs 0、weekly 2、`quick_check ok`、WAL 同字节、healthy 0 重启；(c) 184 请求 404/monitor 0。宿主 93% / 3.8 G。
- 如实：375 为 360 仿真直读、真机未量；作答记录 tab / 批改流未真实走；无 testing agent 录屏；PR #619 仍 open 待人工合并。
- 取证：`docs/iter/round-3/r464-shenlun-font-floor-hit-area.md`；源锁 `frontend-uni/tests/shenlun-r464-audit.test.js`。

## R465（核心作答页 `pages/practice/practice.vue` 首次过 R410+ 字号/热区审计；前端 1 文件 + 源锁，生产 `04ef7f7` → `c3326e4`）
- 只读盘点先命中：作答页本体（主循环每题必经）从未过审计——样式块 40 处 `19–23rpx`、答题卡入口 `.tag` 生产 20.8px 直接可点、抽屉 ✕ `.sheet-x` 27.7×35.3。R430–R464 历轮选簇全绕过了它。
- 改动：40 处 → `24rpx`（含 11 处模板已不引用的死规则，一并抬只为一条源锁正则可锁；不删）；按模板逐个核 `@click` 后只对可点元素补 40px：`.tag`（模板 1 行改 `<view class="tag"><text class="tag-t">`，外层 40px + `margin:-10px 0`）、`.op`、`.fontbtn::after inset -12px`、`.sheet-x`×3、`.lead-x`、`.mat-fold`、`.hs-rate-btn`、`.report-link`、`.deep`、`.rp-chip`（原 `min-height:44rpx`=22px 无效值）、`.wr-btn`、`.rr-go`、`.duenudge-go`、`.loginnudge-x`、`.fixreport`；纯信息标签只改字号不撑高。
- 硬约束达成：`.rhead` header 行高 20px 不变（375/1440 生产一手）；`.tag` 22→24rpx 变宽在 375 出省略号 → `.hstats gap 12→8rpx` + `.op` 不加水平 padding 补回，复验无省略号。
- 生产复验 375/1440：`.tag/.op/.sheet-x` 命中带 40（`elementFromPoint` ±20/−19）、`.fontbtn` 42、解析区 `.hs-rate-btn/.report-link/.deep` 40；`<11.9px` 叶节点全部 = 24rpx 仿真 11.52px，0 个 <24rpx。
- 本地门 vitest 642/642（+4 `tests/practice-r465-audit.test.js`）/ eslint / build 绿；部署 rc=0、rev 一致、7/7 回归 200、perf 一次全 OK（0.94 / LCP 2354）。
- 到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、quick_check ok、healthy 0 重启）；(c) 200 请求 404/monitor 0。**WAL 3,164,192 → 4,124,152 B = 1001 帧**，首次到 R455 预测的 1000 帧 autocheckpoint 阈值，下一轮看是否停在高水位同字节。
- 如实：375 为 360 仿真；完成页/领跑提示/材料折叠/纠错 chip 未在生产真实走到，按源码 + 本地 dist 推断 + 源锁；无 testing agent 录屏。宿主盘 **94% / 3.1 G**（再降）。
- 留 R466：搜索页 `.tab` 25.7 / `.scancel` 20、讨论页 `.msg` 15、个人页 `.zl-link` 16、面试页 `.hist-link` 18 只读读数待语义确认（是否有外层撑高）。
- 取证：`docs/iter/round-3/r465-practice-font-floor-hit-area.md`；源锁 `frontend-uni/tests/practice-r465-audit.test.js`。

## R466（搜索 / 讨论 / 个人 / 面试四页字号/热区修复 + WAL 高水位复用坐实；前端 4 文件样式 + 源锁，生产 `c3326e4` → `7e2e2b3`）
- R465 留的 5 处读数先核语义：搜索 `.tab`（`<text @click>`，行高=自身 25.7）/ `.scancel`（`.sbar` 32.3 内 20）/ 讨论 `.msg`（`<view @click>` 15，`.chips` 行 24）/ 个人 `.zl-link`（`<text @click>` 17，flex-wrap 行=自身）/ 面试 `.hist-link`（block 19）——**全部真可点、外层无撑高**，不是内层读数小。源码路径勘误：实为 `pkgA/search/search.vue`、`pkgA/social/discuss.vue`（R465 按页名猜的路径不存在）。
- 改动：4 页样式块 27 处 `20–23rpx` → `24rpx`；模板逐个 `grep @click` 后只对可点元素补 `min-height:40px`：搜索 `.tab .scancel(-4px) .sclear(-12px) .hist-clear .hist-chip(line-height 40) .d-copy .retry`、讨论 `.chip .msg .up(-12px) .op(-12px) .rx 40×40 .send .plaza-btn .retry`（去掉 `.up.sm,.op.sm` 20rpx 覆盖）、个人 `.zl-link(-4px)`+`.zl-links gap 8→16rpx`、面试 `.hist-link .swap(-10px)`；纯信息标签只改字号。0 行模板、0 后端。
- 生产复验 375/1440：5 处 + 顺带元素全部 40 / `elementFromPoint` 命中带 40；`.sbar` 32.3 不变；四页 `<24rpx` 叶节点 0（剩 24rpx 仿真 11.52px + uni TabBar label）。本地 dist 预检与生产逐项一致。
- 本地门 vitest 650/650（+8 `tests/secondary-r466-audit.test.js`）/ eslint / build 绿；部署 rc=0、rev 一致、7/7 回归 200、perf 一次全 OK（0.96 / LCP 2302；`/tiku/` 1.00）。
- **WAL：4,124,152 B 同字节，但 `ckpt_seq 0→1`、有效帧 55/1001 槽（新 salt）** → 1000 帧 autocheckpoint 已发生、从头复用、停在高水位，R455 预测/R465 挂起项闭合；主库 mtime 22:09:44Z 说明 R465 读到的已是 checkpoint 后的高水位。到期项口径仍 R455（>64 MiB 且持续 >1 天才立项）。
- 到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、quick_check ok、healthy 0 重启）；(c) R465 后 305 请求 404/monitor 0。宿主盘 93% / 3.7 G。
- 如实：375 为 360 仿真；搜索历史区 / 详情 `.d-copy` / 讨论有评论态 `.up .op .rx` / 面试 `.swap` 未在生产真实走到（源码 + dist + 源锁推断）；`.zl-link` 两行命中带 375 重叠 1.3px 登记不改；到期项脚本一次把 TEXT `created_at` 表误报为新写入已纠正（见取证 §5）。
- 取证：`docs/iter/round-3/r466-secondary-pages-font-floor-hit-area-wal-reuse.md`；源锁 `frontend-uni/tests/secondary-r466-audit.test.js`。


## R467（主循环页错题本 `pages/book` / 首页 `pages/home` 首次强制只读读数 → 可点元素 40px 修复；前端 2 文件 + 源锁，生产 `7e2e2b3` → `a49b52c`；部署脚本 600 s 中止后手工续跑 4c/5/6 一次）
- 路径勘误：R465/R466 写的 `pages/index` 不存在，首页是 `src/pages/home/home.vue`。两页样式块 `<24rpx` **0 处**、生产 `<11.9px` 叶节点只剩 uni TabBar label → 字号维度无需改。
- 热区改前一手（375/1440）：book `.seg-i` 30.4/33（`.seg` 36.2）、`.pbadge` 19.8/21（`<text @click.stop>`，`.mhead` 行=自身）、`.mg-go` 33.3/35（`@click.stop` 独立于 `.mg-row` 57 的 `toggleGroup`）、`.recap-h` 18/19、`.kbd-more` 17（桌面卡）；home `.ld-x` 22.7/23、`.ann-x` 19.8/20。**不改**：`.tk-go` 16/17 无 `@click`、外层 `.tk-row` 52.3/55 整行可点（±21 全命中）；`.searchbar` 33 是输入框在 44 行内。
- 改法：`.pbadge` 模板包一层 `<view class="pbadge-hit" @click.stop>`（`inline-flex; min-height:40px; margin:-10px 0; max-width:40vw; position:relative; z-index:1`，`.pbadge` 保持 20px 药丸 + ellipsis、宽 146.4 同改前）；`.seg-i` 40 + `.seg padding 6→4rpx`（`.seg` 43.8 仍在 44 工具行内）；`.mg-go .recap-h(-11px, z-index) .recap-link .kbd-more(-4/-11px) .sheet-x 40×40(-6px)`；未走到态按源码补 `.rf-alt .resume-drop .manual-back .retry .sim-row`；home `.ld-x 40×40 .ann-x 40×40(-10px) .cb-go .cb-x`。`z-index:1` 是本地 dist 预检 `elementFromPoint(+19)` 被下方题干盖住后才加的。
- 生产复验 375/1440：全部 40 / ±19 命中 ±21 不命中；`.mhead` 1440 21 / `.mg-row` 57 / `.sheet-h` 28 不抬；本地 dist 预检与生产逐项一致。本地门 vitest 657/657（+7 `tests/mainloop-r467-hitarea.test.js`，含 `.tk-go` 反向锁）/ eslint / build 绿。
- **部署一手**：两次 `deploy_h5.sh --skip-build` 都在 600 s 轮询上限被脚本判 FAIL（compose 仍在后台跑）：第 1 次层缓存全失（`apt-get` 178 s）+ 同宿主兄弟会话 `docker builder prune -f --keep-storage 1GB` 并发、mem_avail 98 MB、load 25 → pip 层 `exit code 4294967295` rc=1（内核无 OOM，归因为推断）；第 2 次 17 min 后 rc=0，容器 00:48:06Z 起。旧容器全程 healthy 对外。**脚本中止 = 4c Pages / 5 校验 / 6 回归没跑**，线上出现「后端 `a49b52c`、`/` 仍旧 bundle `index-CbCTdalC.js`」半发版态 ~4 min，手工跑 4c 后切 `index-D6cTFb18.js`，5b/6/perf 全过（`/` 0.93 / LCP 2772；`/tiku/` 1.00）。
- 到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、quick_check ok、WAL 4,124,152 B `ckpt_seq 1`、healthy 0 重启）；(c) R466 后 321 请求 404/monitor 0。宿主盘部署起点 **96% / 2.4 G**（历轮最低）→ 复验时 95% / 2.8 G。
- 如实：375 为 360 仿真、真机未量、无 testing agent 录屏；`.recap-link .sheet-x .ann` 改前一手未取（源码推算）；book 强化卡/续练放弃/换卷/复习页、home 续练横幅未在生产走到；1440 `.recap-link` 未取到；`.mhead` 375 读 41.8 是时间标签折行（宽同改前，折行状态一致为推断）。
- 取证：`docs/iter/round-3/r467-mainloop-book-home-hit-area.md`；源锁 `frontend-uni/tests/mainloop-r467-hitarea.test.js`。

## R468（`deploy_h5.sh` 600 s 上限取证：19 次常态 build p50 82 / max 149 s，默认不动；加 `DEPLOY_WAIT_SECS` / 超时明示 4a–6 未跑 / `DEPLOY_RESUME=1` 续跑；生产 `a49b52c` → `aa29e52`，本次构建 1650 s 两条新路径都在真故障态走通）
- 分布（宿主 `/tmp/kg-compose-*.log` 有 `KG_COMPOSE_EXIT` 的 19 次，09-06 13:47Z 起）：min 20 / p50 82 / p90 99 / max 149 s；R467 996（rc=1）/ 1017 + 本轮 **1650** s 是 6.7–11× 离群，三次共同点 = 层缓存全失 + 宿主 load 10–25 / mem_avail <400 MB / 盘 92–96%。→ **600 默认不改**（覆盖 19/19 且 4× 余量），只加可配 `DEPLOY_WAIT_SECS=N`。
- 真缺口在超时后：原脚本 FAIL 一行退出，不说 compose 仍在 `setsid` 后台跑（别重跑叠 build）、不说 4a–6 没跑（半发版）。现超时分支打印 4 行：`tail -1 $COMPOSE_LOG` 看 `KG_COMPOSE_EXIT rc=0` + `/api/health rev` → `DEPLOY_RESUME=1 $0 --skip-build` 续跑 4a–6 → rc≠0 才是真失败。`DEPLOY_RESUME=1` 跳过 2b–4（不 rsync 不重建），**4a rev 闸不放松**（线上 rev≠HEAD 即 FAIL；部署前负路径实跑 `a49b52c≠b28b832` 被拒），4a2 审计行照写（R467 手工补 4c 没写 `deploy-history.log`，`a49b52c` 缺行）。
- 本轮部署一手：`DEPLOY_WAIT_SECS=1500` 起 01:08:58Z → 1500 s 超时分支新文案退出（现场 `mem_avail=366MB disk 3.0G(94%) load=12.19 other_builds=2`=自身两进程）→ `KG_COMPOSE_EXIT rc=0 at 01:36:28Z`、容器 01:36:26Z healthy → `DEPLOY_RESUME=1` rc=0：4a/4a2/4b/4c/5/5b 七编码/6 7/7/6b perf 一次全 OK（`/` 0.93 LCP 2744；`/tiku/` 1.00）。bundle 未变 `index-D6cTFb18.js`，无半发版窗口。构成：`#3 load metadata` 236 s、`#5 FROM` 62 s（00:48Z 刚建的层 01:09Z 又不在）、`#6 build context` 330 s、`#10 pip` 205 s、`#16 export` 230 s；层缓存再丢原因**未坐实**（00:40–01:10Z `docker events` 0 prune/delete、daemon.json 无 GC 配置、cron prune 在 20:20Z）。
- **R467 勘误**：FAIL 现场 `other_builds=2` 是 `host_probe.sh` pgrep 数进了本次部署自己的 `bash -c` 壳 + `docker compose` CLI，不是另有 2 个 build；R467 文档 §1.5/§2b 已加指针。登记不改（4-pre 让行时自身未起、读数 0 正确）。
- 到期项：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、WAL 4,124,152 B、healthy 0 重启；**push_subs/weekly/quick_check 本轮未取到**（load 14 下 `docker exec` 两次 120 s 无响应，不编数，下轮补）。(c) R467 容器起后 225 请求 `/assets/*` 404 0 / monitor 0 / 小程序 UA 0。宿主盘构建瞬时 **94% / 3.0 G**、后 93% / 3.6 G；本机无 `brotli`，1b 每轮 WARN 跳过、线上 `.br` 走 Caddy gzip 回退（非新事，登记）。
- 取证：`docs/iter/round-3/r468-deploy-wait-ceiling-build-duration-resume.md`；脚本 `deploy/deploy_h5.sh`（`aa29e52`）。

## R469（层缓存「再丢」根因坐实：同机 recruit_app 磁盘守护 cron `*/15` 盘 ≥80% 即 `docker builder prune -f --keep-storage 1GB`；R467/R468 归因勘误；4-pre 让行加 prune（脚本层，未发版）；R468 三项到期项绕 `docker exec` 补齐；生产仍 `aa29e52`）

- **根因（事实层四路一手）**：`/etc/cron.d/recruit-disk-maintenance` 第二行 `*/15 * * * * root /usr/local/bin/recruit-disk-guard.sh`；脚本盘 ≥80% 即 `docker image prune -f` + `docker builder prune -f --keep-storage 1GB`（≥88% 再加 `rmi softcopyright:prod-b*` 只留 2）。宿主盘常年 87–96% → 09-06 96/96 槽位全触发（累计 617 次）= **整机 BuildKit 缓存上限 1 GB、每 15 min 强制一次**，三产品共享（sco 自注单次构建 1.28 GB）。守护 prune 段耗时随负载放大：21:15–00:00Z 每次 4–17 s → 00:15Z **15 m 39 s**（盖住 R467 第 1 次 build 的 pip 层 00:17–00:27Z `exit 4294967295`）→ 01:15/01:30Z 5 m 05 / 3 m 23（在 R468 build 01:09–01:36Z 之中）→ 02:00Z 8 m 25（R469 三次 docker CLI 120 s 无响应落在其中）。`ps` 谱系 `cron → sh -c recruit-disk-guard.sh → bash → docker builder prune --keep-storage 1GB → docker-buildx prune`。
- **推断层**：「本家层被这次 prune 清掉」靠 上限 1 GB < 单次别家构建 + 三次离群都在别家构建之后；`buildx du` 逐层 LastUsed 负载下取不到。
- **勘误（如实认错）**：R467 §2b 00:22:05 `builder prune --keep-storage 1GB` 写成「兄弟会话手工 ssh」→ 是 root cron 守护；R468 §1.6 排除项只核了 cron 每日任务（20:10Z）漏了同文件第二行 15 分钟守护。两文档已加指针。
- **改动（未发版、不需要发版）**：`deploy/host_probe.sh` 多打 `prunes=N`（builder/image/system prune + `docker rmi` 进程数）+ 头注写明 `other_builds` 本家起来后含自身 2 进程；`deploy/deploy_h5.sh` 4-pre `BUSY=other_builds+prunes` 非 0 即 WAIT（15 s / 300 s 上限 / 超时 WARN 不阻塞；`probe-failed` 放行同原行为）；`deploy/README.md` 一行。对生产宿主实跑同段循环：`other_builds=2 prunes=1` WAIT ×3 → WARN；`bash -n` ×2 通过。让行只避「起点撞 prune」，避不掉 17–28 min 构建中途每 15 min 一次的 prune。
- **宿主级请老板定（不动别家脚本）**：`--keep-storage 1GB` 抬到 ≥3 GB 或 ≥90% 才 prune builder / 有 compose build 在跑时跳过 / 扩盘（第六次提）。
- 到期项（宿主直读卷 `mode=ro`，绕 `docker exec`）：`push_subs 0`、`weekly_reports 2`、`quick_check rc=0 201 s`、`mistakes.error_reason` 7 / ≥09-11 **0**（首版误查 `answer_log` 列，已纠）、probe=0 33/1、growth 20/4、WAL 4,124,152 B 同字节。(c) R468 容器起（01:36:26Z）后 47 请求：`/assets/*` 404 0 / monitor 0 / 小程序 UA 0；非 2xx `/api/health` 403 ×2 + `/sw.js` 304（首版 epoch 常量写成 2025 年把 14303 行全算进去，已纠）。
- 取证：`docs/iter/round-3/r469-buildkit-cache-loss-recruit-disk-guard-prune-cron.md`。

## R470（SOP-10 四维审计：主循环 practice/book/home 强制只读读数 0 命中；选簇模考簇 `pkgA/exam/list|exam|report` + `components/rank-card` 首次过 R410+ 审计 → 42 处 <24rpx 字号 + 12 类可点元素 40px；前端 4 文件 `<style>` + 源锁，0 后端；生产 `aa29e52` → `6047881`；新 4-pre 让行首次实跑）
- 主循环三页生产 375/1440 一手全达标：home `.ld-x/.ann-x` 40、`.tk-row` 52/55 整行；book 四类 40；practice `.tag/.op` 40、`.fontbtn` 盒 20 但 `::after` 42 命中带 −21…+19 全命中（R465 生效）→ 不是缺陷。1440 `<11.9px` 叶节点三页 0（375 计数全是 24rpx 仿真 11.52px）。
- 模考簇改前一手（375/1440）：答题卡 ✕ 27.7/28、题号格 38.4/40、报告题号格 36.5/38、详情 ✕ 27.7/28、纠错链接 21.7/23、上下题 37.3/39、全部题目 33.3/35、练同类题 34.3/37、AI 详解 18/19、纠错类型 chip `min-height:44rpx`=22（R465 同类无效值）；1440 `<11.9px` 叶节点 list 490 / report 36 / 详情 36。改后全部 40（±19 命中 ±21 不命中）、1440 叶节点 0。
- 有意不改：`.dopt` 报告选项无 `@click`；`.mod .lg .acard-foot .dstat .note .wrow-s .prow-*`、rank-card 轴刻度/分段提示等纯信息标签只抬字号；卷库 `.fchip/.pbtn/.paper-top/.arow` 原 44 源锁反向锁住。无一手竞品截图不加功能。
- 部署一手：4-pre 起点 `other_builds=1 prunes=0`（SoftCopyrightAgent compose build 已跑 45 min）WAIT ×18 → 300 s WARN 继续（设计如此，prune 分支本轮未触发）；构建 ~1500 s 再离群（pip 413 s + export 344 s）→ 600 s FAIL 新文案 → 等 `KG_COMPOSE_EXIT rc=0 03:08:40Z` → `DEPLOY_RESUME=1` rc=0（rev 一致 / bundle `index-D_ZUYBdC.js` / 回归全 200 / perf 0.96·1.00）；重建窗口源站 256 请求 5xx 0。
- 到期项 03:12Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、healthy 0 重启；(c) 3062 请求 `/assets/*` 404 0 / monitor 0，非 2xx 全为已登记项（`/api/health` 403 直连扫描、wxlogin 503、`sitemap-questions-12.xml` 404）。
- 如实：375 为 360 仿真、真机未量、无 testing agent 录屏；`.drz` 错因 chip / `.retry` 失败态 / 交卷与续考门控未在生产走到（源码 + dist + 源锁）；`.rp-chip` 375 单值按 1440 + 源锁推断；考试页量测用浏览器侧合成的 `/api/exam/start` 回包不建 attempt；构建离群归因为宿主指标相关性。
- 取证：`docs/iter/round-3/r470-sop10-audit-mainloop-exam-cluster-font-hitarea.md`；源锁 `frontend-uni/tests/exam-r470-audit.test.js`。下次 SOP-10 审计 ~R480。
## R471（R470 起点复核：team.vue「rank-card」是同名本地 class 非组件（勘误）；contest/contest-report 无低字号；全仓 17 页失败态「重试 ›」文字链 11 页热区 18–22px → 40px；R470/R471a `inline-flex` 把 6 页重试挤到错误文案同行 → R471b 改块级 flex；前端 12 文件 `<style>` + 源锁，0 后端；生产 `6047881` → `59cd473` → `6e82179`）
- 勘误：`git grep rank-card` 命中 `pkgA/team/team.vue` 是本地 `.rank-card` class（`<view class="card rank-card">`），`components/rank-card` 组件挂载点全仓只有 `pkgA/exam/report.vue`（R470 已审即全部）。team / contest / contest-report 三文件 `<style>` 20–23rpx 0 处；可点元素全是按钮/整行卡类，唯一命中 = 失败态 `.retry`。
- `.retry` 全仓 17 页：6 页历轮已补 40（shenlun/practice/search/discuss/book/list·report），11 页无 min-height。改前生产（API 全 abort 制造失败态，375/1440）h 18–22、±19 全不命中；改后 `59cd473` 10 页 h=40、±19 命中 ±21 不命中、父容器不抬；`inbox` 失败态未渲染 `.retry`（先落登录分支）未走到。
- R471a 生产截图发现：`inline-flex`（照 R470 list/report 写法）在「`加载失败：{{err}}<view class="retry">`」同容器 6 页（stats/team/pk/contest/mastery-map + **R470 list**）把「重试 ›」从独占一行挤到错误文案同行 → R471b 12 页统一 `display: flex; align-items: center; justify-content: center; min-height: 40px`，本地 dist 375/1440 全 40、独占一行居中；源锁 `frontend-uni/tests/retry-r471-hitarea.test.js`（递归 ≥17 页、min-height 40px、禁 Nrpx、同容器禁 inline-flex）。门：vitest 699/699、eslint 0、build 通过。
- 部署：R471a 600 s FAIL → `KG_COMPOSE_EXIT rc=0 04:05:55Z`（export 1142 s，守护 prune 常驻、load 11–23、mem_avail 188–335 MB）→ `DEPLOY_RESUME=1` rc=0；R471b 4-pre WAIT ×6 别家 build 先退（未到 300 s WARN）→ `compose-started 04:15:05Z` → 20 min（pip 242 s + export 333 s）`KG_COMPOSE_EXIT rc=0 04:35:20Z` → `DEPLOY_RESUME=1` 首次被 4a rev 闸拒（HEAD 已是 docs 提交）→ `git checkout 6e82179` 重跑 rc=0（bundle `index-ln5farCT.js`、回归全 200、perf 0.97/1.00；a11y 0.94 WARN 独立复跑全 OK）；生产 `6e82179` 375/1440 10 页 `.retry` 全 40 与本地 dist 逐项同值，团队页「重试 ›」独占一行。**登记**：04:36:06Z `/api/monitor/report` ×1 = 本机出口 IP + Lighthouse 移动 UA（部署 6b 自己）、容器起后 48 s 冷启同刻 `[slow-req] 4.2s /tiku/`，上报体只在中心、内容未知，3 次加载 + perf-budget 复跑 0 复现。**坑**：宿主 TZ=CST，caddy `ts` 过滤要用 tz-aware UTC，首版把 R461 vivo 272 行数进了新容器窗口。
- 到期项 04:07Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、healthy 0 重启；(c) R471a 容器起后 32 请求 `/assets/*` 404 0 / monitor 0 / 小程序 UA 0 / kaogong 5xx 0（Caddy 总日志 502 全是别家 host：sco / api-video / api.aicdks / mx-ux）。
- 如实：375 为 360 仿真、真机未量、无 testing agent 录屏；改前逐页精确值未落盘只登记范围；三页按钮类可点元素只核源码未逐个量测；inbox 失败态未走到；R471a 回归是截图发现、源锁事后补锁只覆盖同容器形态。
- 取证：`docs/iter/round-3/r471-retry-hitarea-all-pages-rankcard-mount-erratum.md`。下次 SOP-10 审计 ~R480。

## R472（R471 教训全仓回扫：R410 起 `display` 净变化 87 条 / 块级↔行内流变化 33 处 → 0 处「错误文案 + 重试同行」同类回归；R471 未截图的 book/report/discuss/search 4 页 `.retry` 生产失败态补截独占行；0 代码、不发版，生产仍 `6e82179`）
- 方法：`git diff 2541413~1 HEAD -- frontend-uni/src` 整行抽 `display:\s*([a-z-]+)`（**不能只匹配独占一行的 `display:`，本仓大量单行规则，第一版因此得出「只新增 3 条」的假结论**）→ 按 (文件, 选择器) 归并净变化 → `html.parser` 解析模板取元素标签 / 父容器 display / 兄弟行内性。33 处流变化：26 处父是 flex（子项 blockified，等价）、7 处父 block 但无行内兄弟（独占行、宽变内容宽）、**0 处 R471a 形态**。
- 生产 `6e82179` 375/1440：book / report(`?attempt_id=`) / discuss / search(需真搜一次) `.retry` h=40、±19 命中 ±21 不命中、top 均在错误文案 bottom 之下，截图独占行居中。17 页 `.retry` 至此 16 页有生产失败态一手，只剩 `inbox`（API 全 abort 先落登录分支）。
- 到期项 04:52Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、healthy 0 重启；(c) R471b 容器起后 54 请求全部本机出口 IP（部署 curl / Lighthouse / 本轮 Playwright），`/assets/*` 404 0、小程序 UA 0、5xx 0，monitor 仍只有 R471 那 1 条。宿主 92% / 4.2 G、load 10、mem_avail 281 MB，守护 prune 04:30/04:45Z 各一次。
- 如实：「0 同类回归」是静态判定 + 4 页一手，其余 29 处依赖各轮当时量测未重截；inbox 未走到；375 为 360 仿真；无录屏；0 代码故本轮无新门。
- 取证：`docs/iter/round-3/r472-display-change-layout-regression-sweep.md`。下次 SOP-10 审计 ~R480。

## R473（`inbox` 失败态换路径补齐 17/17 页 `.retry` 生产一手；SOP-10 §4 硬指标（对比度 / 横向溢出 / pageerror）R165 以来首次全路由复扫 25 路由 × 2 视口 0 命中；0 代码、不发版，生产仍 `6e82179`）
- inbox 走不到失败态的原因：`onShow()` 先 `getToken()`（`uni.getStorageSync('authToken')` = H5 `localStorage.authToken`），无 token 直接落登录分支不调 `load()`。解法 `context.add_init_script` 写假 `authToken` 再 `route('**/api/**')` 全 abort → `loadErr='request:fail'` → `.retry` 渲染。生产 375/1440：h=40、flex、父 `.empty` flex-column、前一兄弟 `empty-t` bottom < top（独占行）、±19 命中 ±21 不命中；截图 `r473_inbox_375.png`。假 token 不产生写入（全 abort；`readCommentInbox` 只在 `d.unread` 时调）。
- 硬指标复扫：axe `color-contrast`+`link-in-text-block` 25 路由 × 375/1440 **0 违例**；`documentElement.scrollWidth==clientWidth` 50/50；元素级越出视口 7 组全为非缺陷（exam/list `.fchip` 在 `uni-scroll-view overflow-x:auto` 横滚行；reminders×4 / discuss×2 / ask×1 是 uni resize-sensor `visibility:hidden` 探测 div、父 `overflow:hidden`）；pageerror 0。未扫 exam/exam、contest-report、share/*、poster、offline、team/join。
- 到期项 04:59Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、healthy 0 重启；(c) R471b 容器起后 90 请求（增量全是 R472/R473 本机 Playwright，51 带探针头）、`/assets/*` 404 0、小程序 UA 0、5xx 0、monitor 仍 1 条。宿主 93% / 3.7 G、load 2.85、mem_avail 358 MB，守护 prune 04:30/04:45Z。
- 如实：375 为 360 仿真；inbox 有消息态 / 已读回写未走到；axe 只跑两规则、只覆盖首屏渲染态（弹层 / 深色未展开）；越出判定按 `visibility:hidden` + 祖先 overflow、未逐个截图；0 代码无新门。
- 决策：字号 / 热区 / 对比度 / 溢出四条 UI 硬指标线 R464–R473 已扫平，**R474 起转功能深度维度**（先只读盘点模考报告用时 / 统计锚点 / 目标分 / AI 出口在真实用户回包里的触达率）。取证：`docs/iter/round-3/r473-inbox-retry-auth-inject-contrast-overflow-sweep.md`。下次 SOP-10 审计 ~R480。

## R474（转功能深度维度：模考报告用时 / 统计锚点 / 目标分 / AI 出口在 probe=0 真实数据里的触达率只读盘点 → 报告簇真实触达 0（根因单一：无交卷）；AI 出口有真实触达但飞行中重复；0 代码、不发版，生产仍 `6e82179`）
- `exam_attempts` 64：probe NULL 29（加列前历史，19 未交/10 交，不可归因）/ **probe=0 1**（attempt 315，未交卷）/ probe=1 34（探针）。唯一 probe=0 设备 `umst3tuisd7lgzaka`（vivo V2405A，微信小程序 `servicewechat.com/wx01f2…/0/` 开发版 Referer）09-06 21:41:58Z `exam/start` → 答前 3 题（`secs` 2/2/1 s）→ 3 次 `exam/progress` 200 → 8 s 后回卷库 / 统计页 / 首页 / 周报，**无 `exam/submit`**；70 min 后超时，`latest_exam_progress` 排除 → 续考横幅消失、attempts 只列已交卷 → 3 题作答在任何界面不再可见、服务端不代判（现行设计，登记不改，无一手竞品不加功能）。
- 报告簇（`/api/exam/report/{id}`、`exam/rank*`、`exam/attempts?paper_id&limit=10`）非探针 IP 全文件（09-05 18:44Z 起）**0 次**；`target_score` 9/9 profile 都有（该 uid 70 / 国考），但报告页 `goalGap` 从未渲染；`questions.attempt_count>=1` 仅 781/109371，锚点「N 人做过」99.3% 题无数据可显（真人口径必然）。已交卷 24 条里 `secs` 16 条全在 09-02 后、`marks` 全空。
- AI 出口真实触达：`explain/stream` ×2（41.5/41.7 s，请求体同 446 B，起点隔 6 s、出口 IP 切换，`explain_cache` 落 1007 字）、`mistakes/analysis` ×4（起点 21:41:24/:36/:47/:48Z，19.7–39.8 s，全 200）——**同 uid 同体在飞行中重复，每次独立打满 LLM**；服务端无 single-flight/短缓存（`rl` 只限量），`book.vue aiLoading` 只管同页面实例，POST 不重试。登记为 R475 候选：先答客户端为何重发（MP-WEIXIN 本机无法复现），再论服务端合并 + R398 失败不缓存口径。
- 口径坑：Caddy `ts` 是响应写出时刻，长请求起点 = ts − duration；`size` 是 `encode gzip` 后字节不能反推字数。另 `141.11.46.193` 面试页 API 14 次未归因（下轮到期项）。
- 到期项 05:09Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、healthy 0 重启、WAL 同字节；(c) R471b 容器起后 182 请求全本机/探针，`/assets/*` 404 0、5xx 0、monitor 仍 1 条。宿主 90% / 5.2 G、load 3.7、mem_avail 294 MB，守护 prune 04:45/05:00Z。
- 如实：只覆盖当前 caddy 文件 + DB 全量；报告页卡片未在生产渲染（不造假 attempt）；小程序 4 并发未复现；0 代码无新门。取证：`docs/iter/round-3/r474-exam-report-reach-probe0-ai-duplicate-inflight.md`。下次 SOP-10 审计 ~R480。

## R475（AI 同 uid 飞行中重复：客户端根因 = 原生小程序开发版 `onAiAnalysis` 只守 `aiHtml` 不守 `aiLoading`（关弹层再点入口即重发，非页面栈/超时）；服务端 `/api/mistakes/analysis` 同 uid single-flight 上线、成功不缓存；生产 `6e82179` → `2bad8bc`）
- 根因（源码 + 时序）：事发客户端是 `miniapp-native` 开发版（Referer `servicewechat.com/…/0/`），当时 `pages/book/book.ts onAiAnalysis()` 守卫 `if (this.data.aiHtml) return`，加载中「重新分析」隐藏但可关弹层再点入口 → 每次一条 POST；4 条起点 0/+11/+23/+24 s、duration 完整、gzip size 各异 = 四篇独立生成。兄弟会话 W8 分支 `8db03a2`（09-06 22:53Z，事发后 71 min）已补 `aiLoading`，**未合 main / 未发正式版**，且只保护同页面实例。R474 §4 按 H5 `book.vue` 核守卫是核错对象（已加勘误指针）。
- 设计（先论证再动手）：合并键 = `uid[:64]`（当前 `body: dict` 只读 `uid`，等价 (uid, body)；**加字段时键必须并入**）；只合并飞行中、成功不缓存（分析依赖当下错题统计、TTL 会返旧文、观测重复 100% 在飞行中）、失败不缓存（R398）；`asyncio.shield` 隔离等待者取消；进程内字典 = 全局（uvicorn 单进程无 `--workers`，改多 worker 前换共享介质）。`explain/stream` ×2 不同构（SSE 需缓冲回放、第 2 次多在第 1 次流被放弃后、全文件仅 1 对）→ 登记不改。
- 实现 `backend/app/ai_api.py`：`_ANALYSIS_INFLIGHT` + `_shared_mistake_analysis(uid, prompt)`，`add_done_callback pop`；单测 `tests/test_mistake_analysis_singleflight.py` 3 例（4 并发 1 次 LLM 同文 + 结束再调重新打；失败全体 502 + 下一次重试；不同 uid 不合并）。门：pytest 504 / ruff / `npx pyright app` 0。
- 生产一手（探针 uid `umsacie728f4ghcv8`，`X-Kg-Probe: 1`）：4 并发 → 4 份 sha 同 `5515b9b39352`、len 359、Caddy size 全 913、结束 05:36:25.460×3/.474；0.4 s 后再发 → sha `293513dddcf0`、42 s 完整耗时 = 成功未缓存、槽已清。容器 0 Traceback。
- `141.11.46.193`：09-06 08:55–10:43Z 94 请求、V2405A **VivoBrowser**（不是微信）、`/s/fqpexz7g` 分享页 → 首页 → `interview/categories` ×1 + `interview/question` ×1（R474 写「14 次」是计数口径，按 `/api/interview` 前缀只有 2 条），uid `umsagboriz4qyurnd`，非探针 → 候选真人（分享链路带来），只到出题未点评，不改。
- 部署：4-pre 无让行、compose build **78 s**（load 0.82 历轮最低；再证 R468 离群 = 宿主负载相关）、rev 一致、bundle 未变、7/7 200、perf 0.93/1.00。到期项无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节、healthy 0 重启；(c) 新容器后 35 请求全本机，404/5xx/monitor 0。
- 如实：「关弹层再点」无端侧日志/真机复现；`explain` 那对「网络切换流中断」为推断；single-flight 跨 worker 未验证（当前不需要）；141.11.46.193 与 21:41Z 小程序设备同机型是否同一台未核。
- 待办：`explain/stream` 若再现同体飞行中重复 → 立项缓冲回放式合并；`mistakes/analysis` 请求体加字段时同步扩合并键；W8 分支合 main 时保留 `aiLoading` 守卫。

## R476（R475 发版后 (c) 补量 + 自然 `mistakes/analysis` 合并命中观测 + 面试页「出题后不点评」非探针漏斗 + 成长页 9 请求扇出实测 → 只登记，0 代码不发版；生产仍 `2bad8bc`）
- 自然 single-flight 命中**不可观测**：容器起 05:32:03Z（filter 与 `docker inspect StartedAt` 同秒）后非探针 `mistakes/analysis` 0 条；只有 R475 探针一手，不能写「已在真实用户上生效」。三条件核法挂着：同 uid 起点重叠 + duration 相近 + gzip size 全同。
- 面试漏斗（Caddy 全文件 + `interview_sessions`）：非探针 `categories` 2 / `question` 2 / `answer*` **0** / `history` 2，两 uid（`umsagboriz4qyurnd` VivoBrowser 分享链路、`umst3tuisd7lgzaka` 原生小程序非正式版）都是 4–5 min 全站每页停 2–8 s 的浏览形态，出题后 3–4 s 即离开，`interview_sessions` 无其行 → 「出题后不点评」= 日志未观测到 answer，不是「想答没答成」，不立项续答提醒/自动点评。
- 成长页 onShow 9 个 uid GET（H5 `pages/stats/stats.vue`；main 小程序只 2 个，W7 `w7-mp-flat-v3` 与 H5 同构 9 个）：后端 9 端点 p50 10–30 ms / p99 ≤762 ms / 全文件 >1 s 仅 3 条；生产 375 CDP 弱网仿真 9 并发墙钟 4G 中位 337 ms vs 单 `home_bundle` 182、3G 386 vs 306 → HTTP/2 下 9 并发 ≈ 1 RTT + 80–150 ms，`stats_bundle` 上限收益 <1 RTT 且会把 9 卡片绑成最慢者决定首绘 → **不立项**（R62 首页聚合的前提「origin 45 s 长尾」已随 R372/R373 消失）。
- 小程序硬约束（微信官方文档核过）：`wx.request` 最大并发 **10**；W7 成长页 9 连 + 飞行中的 AI 长请求（20–40 s）会顶到上限排队（事发 21:42:07 = 9 + 2 条 analysis 在飞）。W7 合 main 前建议成长页 ≤8 或 AI 长请求单独计数；只登记，#619 不动 W7 文件。另「进入后台 5 s 内请求未结束回调 `fail interrupted`」——`aiLoading` 守卫在 catch 后复位可重发，服务端 single-flight 正好兜住。
- R475 勘误：Referer 版本号 `0` = 开发版/体验版/审核版，非只「开发版」（R475 文档已加指针）。
- 到期项 05:45–05:55Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节、healthy 0 重启；(c) 新容器后 `/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。
- 如实：漏斗 n=2、「浏览形态」为停留时长 + 遍历时序推断、两设备是否同一人未核；扇出量测为 Chrome 侧节流（非真机/小程序）、`home_bundle` 作单请求对照非严格等体量、每网况 5 轮；0 代码无新门。取证：`docs/iter/round-3/r476-postdeploy-natural-singleflight-interview-funnel-stats-fanout.md`。下次 SOP-10 审计 ~R480。


## R477（自然 `mistakes/analysis` 仍 0 + AI 问答真实触达后的会话留存只读盘点 + R475「explain ×2」形态坐实为网络切换→手动重点 → 只登记，0 代码不发版；生产仍 `2bad8bc`）
- 自然 single-flight 命中仍**不可观测**：R475 容器起后 228 请求全部本机/探针，非探针 `mistakes/analysis` 0 条；三条件核法继续挂。
- AI 问答留存（Caddy 全文件 + `ask_cur` / `ask_sessions` / `explain_cache` 只读）：非探针打开问答页 2 uid（`umsagboriz4qyurnd` H5 分享链路 6 次进页 0 提交；`umst3tuisd7lgzaka` 小程序非正式版 1 次）→ 提交 1 uid → `ask_cur` 留 1 条（1007 字讲解、`saved:false`、追问 0、评分 0、未归档）→ 之后 0 回访；`ask_sessions` 全表 1 行 + `ask_cur` 另 4 行 + `explain_cache` 82 行 / 21 hits **全是探针 uid**（**R478 勘误**：`ask_cur` 另 4 行里 `umsacie728f4ghcv8` 09-05 17:06Z 那条是 R446「身份不可考、探针三路不命中」会话，非探针口径应为 2 uid / 2 条）。服务端 `ask_cur` 7 天口径 → 该条 09-13 21:41Z 过期，在此之前若该 uid 回问答页 `GET ask/cur` 命中 = 「留存被用到」的首个可观测点。n=1 不立项。
- R475 登记的 `explain/stream` ×2 **坐实**：第 1 条起点 21:40:02.8Z（IP 223.83.2.220）前 1.6 s 有 `GET /api/access_info`；第 2 条 21:40:09.0Z（IP **39.158.40.85**）前 1.4 s **又一次** `access_info`（全小程序只有 `ask.ts ensureAccess()` 调它 = `submitText` 手动提交；代码无自动重试，`streamPost` 失败降级的是非流式 `/api/explain`、全文件 0 条）；`ask_cur.items` 只 1 条 rec、端侧 ts 21:40:07.553Z 对应第 2 次（第 1 次走 `catch`：`setError` + 展开文本面板保留原文/答案，rec 不入 `results`）；旧 IP 此后 0 新请求。→ 网络切换致端侧首条流失败，用户 ~4.8 s 内手动重点；两条在源站都 200 跑满 41.5 s（12831 / 14843 B，两次独立生成；`explain_cache` 两行 `key`/`raw_key` 3 ms 内写于第 2 条末尾 21:40:50.63Z）。服务端合并/回放收益 = 1 次 LLM + ≈6 s、全文件仍 1 对 → 继续登记。「源站为何跑满」= 手机侧 socket 失效无 FIN/RST 到边缘、CF 继续拉源站流 → 推断未验证。R475 文档已加指针。
- 顺带登记给 W7：`doExplain` 在 `onMeta` 就把 `loading` 复位（按钮解锁）而 `rec.streaming` 仍 true，理论上允许流中再提交（本对不是这条路径）。#619 不动 W7 文件。
- 到期项 06:02Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节、healthy 0 重启；(c) 新容器后 `/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。
- 如实：网络切换为 IP 永久切换 + 代码路径反推、无端侧日志/真机；rec 归属假设端侧时钟偏差 <5 s；两 IP 段均为运营商 NAT 池；`ask_cur` 落库 `length(items)` 1535 为 SQLite 字符数（≈2.6 KB UTF-8，与 POST 2631 B 一致，字段未丢）；0 代码无新门。取证：`docs/iter/round-3/r477-explain-stream-pair-network-switch-manual-retry-ask-retention.md`。下次 SOP-10 审计 ~R480。


## R478（`explain/stream` 三条失败路径 H5/W7 源码对照 + 生产 `[llm] stream` 告警 0 + R477 `ask_cur` 归类勘误 → 只登记，0 代码不发版；生产仍 `2bad8bc`）
- **R477 勘误**：`ask_cur` 5 行不是「1 非探针 + 4 探针」而是 **2 非探针 + 3 探针**——`umsacie728f4ghcv8` 09-05 17:06:00Z 那条（qid 234494 深链、`user_answer:B`、1188 字讲解、`saved:false`、`fu:[]`、`explain_cache` 17:07:18Z、`ask_cur.updated_at` 17:07:22Z）落在 R446 登记的 09-05 16:42–17:05 Windows Chrome 双代理出口会话，当时探针三路不命中（`growth_events` p0 ×3）、R446 判「身份不可考」；它的 p1 行全在 R475 09-07 05:36Z **我拿它当 single-flight 探针 uid** 之后。修正口径：AI 问答留存 = 2 uid / 2 条 / 0 后续动作，n=2 仍不立项。这也是 R378/R421 qid 直通路径在非探针口径下的首条落库样本（Caddy 当前文件 09-05 18:44Z 起、该会话不在其中，只靠 DB）。R477 文档已加指针。
- 归错原因：只按当前 Caddy 文件的出口/UA 归类，文件起点前的会话不可见 + 探针复用了身份不可考老 uid。**规则入 SKILL**：探针一律专用新 uid，不复用 R446/R452 身份表里的 uid；`ask_cur`/`ask_sessions` 归类须与身份表 + 各表 probe 列交叉。
- H5 `pages/ask/ask.vue` 与 W7 `pkgSocial/ask/ask.ts` 提交路径同构（`ensureAccess→doExplain→streamExplain`），R477 的「失败→`catch` 重开文本面板保留原文→手动重点」H5 相同。三条失败路径两端都未处理：A meta 前失败（已处理好，R477 对即此）；B meta 后失败（`catch` 不改 `live.streaming` → 卡片永久 spinner / 半截无评分 chips；H5 边缘断开无 `error` 事件时 `reader.read()` done 不核 `state.done` → 半截当完整落库清输入）；C 空正文（服务端 `full.strip()` 空只是不缓存、仍 `done`；两端按成功 resolve → 空卡片 + 输入清空；R397/R399 的 `EmptyReply` 只覆盖了 `mistakes/analysis`）。修法形态 ≤10 行三处（后端 `gen()` 空正文改 `event: error`；两端 `catch` 复位 `streaming`；H5 `!state.done` 判中断）**备查不做**。
- 生产证据 0：当前容器 + `kaogong-reports/app-log/` 20 个归档（**覆盖 09-06 15:11Z 起 ≈14.3 h，非 14 天**）`[llm] stream|main|rescue` 0、Traceback 0；`POST /api/explain/stream` 归档内仅 2 条 = R477 那对（uvicorn 行 21:40:02.80 / 08.99Z，与 Caddy 反推起点 ±25 ms）；`explain_cache` 82 行 explanation 空 0 / min 50 字；`ask_cur`/`ask_sessions` items 空 explanation 0。→ B/C 在有日志窗口内没发生过；按 SOP 无一手不改。可观测性缺口登记：`chat_stream` 中途异常与 `gen()` except 都不写日志，B 只在 SSE 里可见。
- 自然 `mistakes/analysis` 仍不可观测：R475 容器起后 229 请求全 140.232.64.x 本机；非探针 AI/ask/interview 0；`umst3tuisd7lgzaka` 0 回访（09-13 21:41Z 前继续挂）。
- 到期项 06:19Z 无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节、healthy 0 重启；(c) `/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。
- 如实：B「边缘断开源站跑满」仍是 R477 推断；W7 按 `origin/devin/w7-mp-flat-v3` 源码、未真机；本轮未在生产制造失败态；`umsacie728f4ghcv8` 只纠正「非探针」不升格「外部真人」；0 代码无新门（沿用 R475 门）。取证：`docs/iter/round-3/r478-explain-stream-failure-paths-h5-mp-parity-ask-cur-uid-erratum.md`。下次 SOP-10 审计 ~R480。

## R479/R480（SOP-10 四维审计选簇 = 问答页 `pages/ask` + 面试簇 `pkgA/interview/*`：生产 375/1440 一手命中 → 最小修复上线；生产 `2bad8bc` → `6d7259c`）
- **选簇**：`git log 2bad8bc -- pages/ask pkgA/interview` 自 R410 起只有 R421/R422（功能）、R466（`.hist-link` 单点读数）触碰，从未按 24rpx/40px 规则整页过审（同 R465 practice / R470 模考簇形态）；且是非探针用户真会走到的路径（R477/R478 问答提交 2 条、R475/R476 面试出题 2 uid）。
- **改前生产一手（`2bad8bc`，375=360 仿真 / 1440，`X-Kg-Probe:1`，0 库写入）**：问答页三个 sheet 共用 `.sheet-x` ✕ **27.7 px**、`.rate-btn` 有用/有误 **29.2 px**；字号 <24rpx 12 处（`.top-s/.cam-quick/.cam-tip2/.cam-mode/.cam-side/.ub-ans/.ds-d2/.ans-method/.tag/.rec-meta/.rec-del/.rec-e2`，375 渲染 10.08–11.04，`.ans-method` 21rpx 最小）；面试记录页 `.stat-t/.tag/.meta` 3 处 22rpx（7 叶节点 11 px）；面试出题页字号 0 命中、`.cat` 52/53 整行 / `.swap` 40 / `.hist-link` 40 / 按钮 44 → **不改**（`.cat-arrow` 18 无 `@click`，父行命中）。
- **修法（只 `<style>` 3 文件）**：15 处 → 24rpx；`.sheet-x` 40×40 + `margin:-6px -8rpx -6px 0`（`.sheet-h` 头行仍 28、不抬）；`.rate-btn` `min-height:40px + box-sizing:border-box`，父 `.rate-btns` 已 flex、**不改 display**（R471a 教训）。源锁 `tests/ask-interview-r479-audit.test.js`（三页无 <24rpx、`.sheet-x`/`.rate-btn` 40、原 44px 八类反锁、面试簇 52/40/44）。
- **改后生产一手（`6d7259c` bundle `index-DoCoVd0k.js`）**：`.sheet-x` ×2 处 40×40、`.rate-btn` 40，`elementFromPoint` ±19 命中 ±21 不命中；1440 页面自有 <11.9px 叶节点 问答四态 2/2/3/5 → 0、面试记录 7 → 0；375 自有叶节点全 ≥11.52（=24rpx），仅剩 uni tabbar label 10 px（框架全站、不动）。截图布局无回归。
- 门：vitest 706/706（+7）、eslint rc=0（直接取退出码）、build:h5 绿；部署 `--skip-build` 一次 rc=0（rev 一致 / bundle 校验 / 7/7 200 / perf 0.98·1.00）。
- 观测项 06:48Z：非探针 `mistakes/analysis` 仍 0（R475 容器起 280 请求全本机；新容器起 78 = 本机 76 + GPTBot 2）；`explain/stream` 第 2 对未出现；`umst3tuisd7lgzaka` 0 回访（09-13 21:41Z 前继续挂）；到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节、healthy 0 重启）；(c) `/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。
- 如实：375 为 360 仿真、真机未量、无 testing agent 录屏（未另行授权）；追问 sheet ✕ 未在生产打开（源码 + 源锁，与另两处共用规则）；面试记录页空态 `.btn-primary` / 失败态 `.retry` 本轮未渲染（源码 + 源锁 + R471 一手）；`.cat-arrow` 非缺陷判定未做逐点命中；结果态/历史 sheet/面试记录为本地占位数据渲染（uni H5 `{type:'object',data:[...]}` 包装格式 / 浏览器侧 fulfill）。取证：`docs/iter/round-3/r479-sop10-audit-ask-interview-cluster-font-hitarea.md`。R480 SOP-10 审计以本轮计；下次 ~R490。

## R481（git 触碰史法一次列全 R410 后从未整页过审的剩余页面 → 7 处生产 375/1440 一手命中 → 最小修复上线；生产 `6d7259c` → `21bd0c6`）
- **清单**：`git log 6d7259c -- <path>` 查 R410 起触碰史——`share/*`（share-q / pk-result）R450 已整页过审剔除；`export-confirm`（卷库/首页/错题本共用导出弹层）/ `offline` / `poster` / `inbox` / `plaza` / `team/join` / `login` 7 处只有 R471 `.retry` 单点或 0 触碰 → 从未按 24rpx/40px 规则整页过审。
- **改前生产一手（`6d7259c`，375=360 仿真 / 1440，0 库写入；plaza/inbox 浏览器侧 fulfill 占位）**：导出 ✕ `.sheet-x` **22.7×26.6**、离线「下载/更新/删除」`.act` **27.5**、海报「保存图片」`.btn` **34.3**、收件箱「去登录」`.login-btn` **34.3**、小队邀请「登录/注册 ›」`.reg-tip` **38.2**、登录分段 `.seg-item` **38.3**（1440 依次 24 / 29 / 35.8 / 35.8 / 38 / 39）；字号 <24rpx：offline `.hint/.sub2/.hint2`、plaza `.mod/.cnt/.time`、poster `.tip`、export `.opt-note`、inbox `.act/.time`（21–22rpx，375 渲染 10.56–11.04）。plaza `.item` 卡 125.7 ±19/±21 全命中——父卡即热区不改；join `.act-btn.main` 44 不改。
- **修法（7 文件只 `<style>`，不改 display 流）**：字号 → 24rpx；`.sheet-x` 40×40 + `margin:-6px -8rpx -6px 0`；`.act` `inline-flex + min-height:40px + border-box`（父 `.pkg` flex）；`.btn/.login-btn` `line-height:40px + min-height:40px`；`.reg-tip/.seg-item` `min-height:40px + border-box`。源锁 `tests/r481-leftover-pages-audit.test.js`（7 文件无 <24rpx + 各热区几何 + `.pkg` flex）。
- **改后生产一手（`21bd0c6` bundle `index-DJhppeDm.js`）**：7 组可点元素 375/1440 全 40、±19 命中 ±21 不命中；1440 页面自有 <11.9px 叶节点 offline 5 / plaza 4 / poster 1 / export 1 → 0；375 全 ≥11.52。**如实登记副作用**：导出 `.sheet-h` 头行 22.7 → 28（1440 24 → 28；本组件头行原本比问答页矮，负外边距只能抵到 28），截图无重叠、不再动。
- 门：vitest 717/717（+11）、eslint rc=0、build:h5 绿；部署 `--skip-build` 一次 rc=0（谱系闸 OK / rev 一致 / bundle 校验 / 14/14 200 / perf 0.99·1.00 / a11y 1.00）；新容器 healthy 0 重启、Traceback/locked/5xx 0。
- 观测项 07:10Z：非探针 `mistakes/analysis` 仍 0、`explain/stream` 第 2 对未出现、`umst3tuisd7lgzaka` 0 回访（09-13 21:41Z 前继续挂）；到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节）；(c) R479 容器窗口 116 + 新容器 53 请求全本机，`/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。
- 如实：375 为 360 仿真、真机未量、无 testing agent 录屏（未另行授权）；离线「更新/删除」态与海报失败态「重新生成」未在生产渲染（共用规则，源码 + 源锁）；收件箱已读回写被 abort 未走到；「从未过审」按 git 触碰史判定。取证：`docs/iter/round-3/r481-leftover-pages-git-touch-audit-font-hitarea.md`。

## R482（分享链路逐步骤留存盘点 → 命中真人 monitor 行 2/2 全是跨源脱敏 `Script error.` 且各触发一次中心告警 → H5 `window.onerror` 最小过滤；首次发版因宿主盘 0 B 中止、盘释放后重发上线；生产 `21bd0c6` → `948d351`）
- **分享链路（非探针，Caddy 全文件 + DB 只读）**：`fqpexz7g`（qid 283184，创建者 `umst3tuisd7lgzaka`）→ `141.11.46.193` VivoBrowser 08:55:46Z 打开分享页（`share_open` + `GET /api/share/*` 200）→ **未作答**（`shared_answers` 0、`POST share/*/answer` 0）→ 3 min 26 s 后首页全套 state 读 → 面试出题 1 次不答 → 问答页 6 进 0 提交 → 1 h 45 min 后回访分享页 / 成长页（出口已切 `182.108.230.77`）→ 此后 0 请求。整条路径 **0 写入**，首个断点在分享页作答之前，放弃 vs 缺陷不可分（R428/R450 已核 share-q 无命中）→ 不立项。
- **命中**：中心 `errors` 153 行里 `internal=0` 且非本机出口只有 **2 行**（id 1123 分享页 10:43:18Z / 1124 成长页 10:46:49Z），都是该用户、`message="Script error."`、`stack=NULL`；Caddy 9 文件 `POST /api/monitor/report` 114 条里非 `140.232.64.0/24` 且非探针也恰好只有这 2 条 → **H5 错误监控上线以来真人产出 2 条、可定位信息 0**。规范：跨源 classic script 抛错脱敏为 `Script error.` + `filename=""` + `error=null`；本页脚本全同源（主 bundle `crossorigin`、两段内联；CSP 里 `career.zalize.com/nav.js` 已下线、源码 0 处加载、0 处 `createElement('script')`）→ 只能来自页面外注入脚本（厂商浏览器等，推断）。中心 `checkAndAlert()` 对 `internal=0` ≥1 条/15 min 即发告警（1 h 节流）→ 这 2 条按代码各触发一封（送达未核）。Sentry `DEFAULT_IGNORE_ERRORS[0]` = `/^Script error\.?$/`（一手）。
- **修法（端侧最小）**：`monitor-client.js` `isMaskedCrossOriginError(e)` = `/^Script error\.?$/` ∧ `!e.error` ∧ `!e.filename`；`main.js` `window 'error'` 监听首行 `if (isMaskedCrossOriginError(e)) return;`。`unhandledrejection` / Vue errorHandler / chunk-load 不受影响；不在后端按字符串硬丢（拿不到 filename/error）。单测 8 断言 + `main.js` 源锁。门：vitest **719/719**（+2）、eslint rc=0、build:h5 绿（bundle `index-kGPUzEDT.js`）。
- **发版中止（如实）**：`deploy_h5.sh --skip-build` 1/6–3b 完成（rsync + 预热 23/23）后在 4/6 让行等待期被我手动中止——宿主 `/dev/vda2` 非 root 可用 **0 B**（`/opt/SoftCopyrightAgent` 兄弟 `compose up --build` pid 1136032 在跑），超时后脚本会在 0 B 盘上起重建、必失败且可能停旧容器。线上仍 `21bd0c6` / `index-DJhppeDm.js` healthy 0 重启。**盘满对写入一手**：容器 uid 0 可用 ext4 root 保留块（550432 × 4 KB ≈ 2.1 GB）→ 07:40:37Z 探针 `POST /api/track`（`X-Kg-Probe: 1`）200、`growth_events` id 2042 probe=1 落库、WAL 不变、app-log 无 full/Traceback；但 dockerd 同 root，保留块吃穿即 `SQLITE_FULL`。07:43:28Z 兄弟构建结束盘跳回 4.0 G（`r482_disk.log`）→ 重跑 `--skip-build` 一次 rc=0（`KG_COMPOSE_EXIT` 07:46:09Z、rev `948d351`、bundle `index-kGPUzEDT.js` 校验一致、7/7 200、perf 0.99·1.00）；新容器 healthy 0 重启、起后 48 请求 5xx/asset 404/Traceback 0。**改后生产一手（375/1440 CDP + `X-Kg-Probe: 1`）**：合成 `ErrorEvent('Script error.')` → 0 条 `/api/monitor/report`；同 message 带 `error` 对象 → 1；普通 message 带 `filename` → 1；Caddy 恰 4 条（2 视口 × 2 应报）全 200 / probe 头（中心 internal=1）。
- 观测项 07:15Z：非探针 `mistakes/analysis` 仍 0、`explain/stream` 第 2 对未出现、`umst3tuisd7lgzaka` 0 回访；到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节）；(c) R481 容器起后 57 请求全本机，`/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0；历史 503（wxlogin ×4 / health ×1）全在 R481 窗口外。
- 老板侧新增证据：同宿主兄弟项目 `compose build` 可把盘吃到 0（守护 prune 挡不住构建峰值）——R469 §4 三选之外，建议至少把构建挪出生产宿主或给 dockerd 设存储上限。本轮未 prune / 未 kill 兄弟进程。
- 如实：注入脚本来源为排除法推断（无端侧 URL）；告警送达未核；分享链路 n=1、分享者/被分享者是否同一人未核；无 testing agent 录屏（未另行授权）。取证：`docs/iter/round-3/r482-share-path-funnel-monitor-script-error-noise.md`。

## R483（R482 发版后 (c) 补量 0 增量；分享页 375 首屏折叠一手→登记不改；命中「时政题号与 `questions.id` 撞号」→ 服务端置空兜底 + H5 answer_log 补 `_sz` 守卫 + 可逆历史回填已执行；生产 `948d351` → `df9d6be`）
- **(c) 补量 / 观测项**：R482 容器窗口与本轮新容器（08:29:42Z 起 34 请求）全部本机/探针，`/assets/*` 404 / 5xx / `/api/monitor/report` / 小程序 UA / 非探针 `mistakes/analysis` / `explain/stream` 全 0；真人 monitor 行 R482 过滤上线后 0 条新增（无真人流量、非过滤效果证据）；`umst3tuisd7lgzaka` 0 回访；到期项无增量（answer_log probe=0 33、growth 20、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、shared_answers 4、ask_cur 5、WAL 4,124,152 B）。
- **分享页首屏（登记不改）**：`/s/fqpexz7g`（qid 283184，题干 370 px 高的长题）Chrome CDP 仿真：360×740 / 412×915 四选项全见；375×667 / 360×640 A、B 全见、C 半露、D 折下，「先作答，再看答案和大家的选择」提示与前两项都在首屏。长题折叠是内容长度所致、作答控件未失效，且候选真人 n=1 放弃 vs 缺陷不可分 → 不改布局（改法候选：题干折叠/选项 sticky，需 ≥2 个一手样本再定）。量测脚本 `/home/ubuntu/r483_fold.py`。
- **命中（修）**：`shizheng_questions` 独立自增 id（1–11180）与 `questions.id` 只是数字撞号，但 H5 `practice.vue` answer_log 条目 `qid: q.id || null` 漏 `_sz` 守卫（错题四处早有）、W7 `daily.ts logAttempts()` 同形态、服务端 `save_answer_log_detail`/`save_mistake` 原样落 qid → 生产 `answer_log module='时政' AND question_id IS NOT NULL` 39 行（含 `umst3tuisd7lgzaka` probe=0 ×10）、`mistakes` 3 行。**用户可见影响一手**：`refresh_question_stats` 按 qid 聚合不看 module → 19 道行测题外显「N 人做过 / 正确率 / 易错项」全部（18）或一半（109）来自时政作答；`list_mistakes`/`due_reviews` `LEFT JOIN questions` 把 3 条真人时政错题套上行测题选项/解析；`_find_open_mistake(qid)` 与 `save_mistake` 去重会跨题推进/合并（review_log 尚 0 行、逻辑成立）。
- **修法**：`db.foreign_module_qid(module, qid)`（module 非空且 ∉ `VALID_MODULES` → qid 置 NULL）接入 `save_answer_log_detail`（先置空再查 questions / 推进 SRS）与 `save_mistake`（去重与落库）；H5 answer_log 条目补 `_sz` 守卫 + 源锁；W7 端登记不在 #619 动。`scripts/r483_shizheng_qid_null.py` dry-run / `--apply --record` / `--restore`。单测 +4（pytest 508）/ vitest +2（721）/ ruff·pyright·eslint·build 绿。
- **发版**：等兄弟 `pip install`/BuildKit 结束（load 8.6→2.9、未 prune/kill）后 `DEPLOY_WAIT_SECS=1500 --skip-build` 一次 rc=0（4/6 compose build ~5.5 min、rev `df9d6be`、bundle `index-3pg3VDhV.js` 校验一致、7/7 200、perf 0.99·1.00 / 1.00·1.00）。写入侧探针一手：同 uid `qid=48` 两条，`module='时政'` 落 NULL、`module='ziliao'` 落 48 + submodule 回查。
- **历史回填（已执行、可逆）**：容器内 `sqlite3.backup` → `/data/data.db.r483-before`（449 MB，quick_check ok）→ dry-run 39+3 → `--apply --record /data/r483_shizheng_qid_null.record.json` 39/39 + 3/3 → re-dry-run 0 → 手动 `POST /api/admin/refresh_stats`（容器内 127.0.0.1）`updated 911` → 26 个撞号题里统计非空 19→**1**（109 `1/100%/NULL` = 唯一真实行测作答），18 题由既有 stale 分支清 NULL；`attempt_count>=1` 911 = REAL_TRAFFIC distinct qid 911 全在 questions；healthy 0 重启、Traceback/locked/full 0、WAL 不变。还原：`--restore record.json` 或整库回滚；备份与 record 留卷内待老板确认后清理。
- 如实：折叠为仿真非真机、候选真人视口未知；39 行按端归属未逐行核（probe=0 10 行 H5/小程序均可能）；W7 端未修（服务端兜底覆盖）；R474 记的 `attempt_count>=1` 781 与本轮 911 口径差未复核；写入侧复验为探针 uid（+2 probe=1 行）；无 testing agent 录屏（未另行授权）。取证：`docs/iter/round-3/r483-share-fold-shizheng-qid-collision.md`。

## R484（R483 发版后 (c) 补量 0 增量、新 `时政且 qid 非空` 行 0；全部「按 question_id JOIN/聚合」路径时政撞号盘点服务端侧 0 污染；命中 H5 `practice.vue` AI 详解深链 / 回看 AI 详解两处漏 `_sz` 守卫 → 2 行最小修上线；生产 `df9d6be` → `7acf57b`）
- **(c) 补量 / 观测项**：R483 容器（08:29:42Z 起）35 请求全本机 + bingbot 1 条 GET，`/assets/*` 404 / 5xx / monitor / 小程序 UA / 非探针 `mistakes/analysis` / `explain/stream` 全 0；`umst3tuisd7lgzaka` 0 回访；`answer_log`/`mistakes` `module='时政' AND question_id IS NOT NULL` 全表 0 / R483 后 0（服务端兜底 + 回填生效）；到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 4,124,152 B 同字节）。自纠：`created_at` 是 epoch real，首版补量把 R483 起点写成 2025 年的 epoch → 窗口失真，按 `docker inspect StartedAt` 换算后重跑。
- **盘点（生产只读）**：撞号 96 对（`shizheng_questions` 140 行 id ≤ max `questions.id`）。`mistakes` 258 非空 qid 文本交叉无时政行（2 处差异为 `changshi` 标点归一化；1 行 `ziliao` qid 41 数字撞号但文本=行测题）；`question_favs`/`notes`/`comments`/`reports`/`shared_questions` 与时政 id 集 0 重叠；`ask_cur` 唯一非 0 qid 234494 行测；`pk_matches` 27/27 列表无时政；`practice_progress`/`explain_cache` module 分布只有行测/NULL；`review_log` 按 `mistake_id` 不按 qid；`interview_sessions` 的「孤儿」qid 21 属静态 `interview_questions.json`（80 题 id 1–80）独立命名空间非污染；`shenlun_answers` 6/6 在 `shenlun_questions`。
- **命中（修 `7acf57b`）**：`practice.vue` `curAskSeen()` 按 `this.cur.id` 匹配本地 askSessions、`deepExplain()` `askQid(q.id)` 写 `redoQid` 均无 `_sz` 守卫 → 时政题点「用花生十三方法详解」会把撞号行测题号带进 ask 页 rec：「查看原题」深链、「存入错题本」落行测题号。（**R485 勘误**：首版还写了「`explain/stream question_id` → 服务端 `_linked()` 按 `questions` 取题喂 LLM」——不成立，R421 `extract_from_qbank` 按题干前 40 字 fail-closed，撞号 qid + 时政题文返回 None、meta qid None，本地用生产 118 题干实跑证实；服务端提示不受影响。）生产 `ask_cur` 时政 0 条 = 路径可达未触发。修法 `this.cur && !this.cur._sz && this.cur.id` / `q._sz ? 0 : askQid(q.id)`（题干仍带过去走纯文本识题）；源锁 +2（vitest 723/723、eslint rc=0、build 绿）。W7 同形态登记不在 #619 动。
- **发版 + 一手**：盘 3.5 G / load 1.5–3.3 未让行，`--skip-build` 一次 rc=0（rev `7acf57b`、bundle `index-DYSsqDo0.js` 校验、路由分包 `pages-practice-practice.sbe-gR5r.js` 线上=本机逐字节、7/7 200、perf 0.99·1.00 / 1.00·1.00）。CDP 375 + `X-Kg-Probe` 拦 `Storage.prototype.setItem`：时政（id 118，与 `questions.118` panduan 确为撞号对）点深链 → 只写 `redoQuestion`/`redoAnswer` **无 `redoQid`**；行测 376403 → `redoQid 376403`。新容器 100 请求全本机、404/5xx/monitor 0；探针写入 answer_log +4（时政 2 行 qid NULL）/ mistakes +3（时政 2 行 NULL）。
- 如实：盘点为当前库行 + 源码路径，非历史版本写入口穷举；修的是生产 0 条落库的未触发路径；CDP 仿真非真机、未实际提交 `explain/stream`（`redoQid` 被 ask 页 onShow 即消费，事后读 storage 为 null，须写时拦截）；W7 端 `logAttempts` 未修（W7 `streamExplain` 不带 `question_id`、main 小程序无问答页，`explain/stream question_id` 发送方只有 H5 `ask.vue`）；无 testing agent 录屏（未另行授权）。取证：`docs/iter/round-3/r484-shizheng-qid-namespace-audit-ask-deeplink-guard.md`。

### R485（2026-09-07）：`explain/stream question_id` 发送方全产品盘点 + R484「喂错题」勘误 + 服务端 module 兜底论证（0 代码，生产仍 `7acf57b`）

- **R484 勘误**：「时政 qid 进 `explain/stream` → 服务端按 `questions` 取题喂 LLM」不成立。R421 `engine.extract_from_qbank` 要求题库行题干前 40 字逐字在提交文本里，撞号 qid + 时政题文 → `None` → 原识题路径、meta `qid=None`（本地用生产 `questions.118` 题干实跑）。受影响仅端侧 `ask.vue:623` `qid: askQid(m.qid) || qid` 回落 `pendingQid` → 「查看原题」/「存入错题本」。R484 修法/源锁不变。
- **发送方只有 H5 `ask.vue`**：W7 `api/social.ts streamExplain()` 只发 `text`/`user_answer` 不带 `question_id`；main 小程序无问答页。`redoQid` H5 写入方 7 处数据源均为 `questions`（practice 已守卫、book 时政行 qid 已全 NULL）。
- **服务端补 module/source 兜底不立项**：现状 `_linked()` 按题干命中已是更强的 fail-closed；协议加字段要动三处且老端不发字段无法兜底。登记：缓存命中分支 `meta0` 不回传 `qid`，端侧因此必须保留回落；若要「只信服务端确认 qid」需 `meta0` 回传 `hit.qid` + 端侧去回落（2 行，0 生产例，待有例再修）。
- **(c) 补量**：R484 容器起后源站 103 请求 = 本机 101 + ClaudeBot 2；非探针 POST/analysis/explain 0、`umst3` 0、404/5xx/monitor/小程序 UA 0；`时政且 qid 非空` 全表 0 / R484 后 0；到期项无增量（probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 同字节）。
- 取证自纠：Caddy 统计 glob `/var/log/caddy/*.log*` 会把同宿主兄弟站点算进来（出现 1001 请求的假 IP），只能读 `kaogong-origin.zalize.com-access.log`。
- 取证：`docs/iter/round-3/r485-explain-stream-qid-sender-audit-linked-failclosed-erratum.md`。

### R486（2026-09-07）：时政题文进 AI 讲解 0 例 + R421 qid 直通路径 0 次新生成（0 代码，生产仍 `7acf57b`）

- 时政题文（138 条题干前 30 字）与 `explain_cache` 82 行 / ask rec 6 条 / `mistakes` 全表交叉 **0 命中**；识题 LLM module 必落五模块（`guess_module` → `panduan` 兜底），时政题文进来会被贴行测模块，无样本不动。
- `explain_cache.qid` **82 行全 NULL**：R423（09-06 07:12Z）起记 qid，之后 0 次带 qid 新生成 = R421 直通路径上线后从未在新生成上执行（缓存命中不写 qid）；唯一带 qid 的非探针请求（234494，09-05 17:06Z）早于 R421。82 行里 50 行题文含活跃题库题干 → 适用面宽但端侧从未带 qid 到达。观察指标：`select count(*) from explain_cache where qid is not null` 首次 >0。
- 登记合并：`meta0` 回传 `hit.qid` + 命中时补写 qid（待有例）。
- 取证自纠：别用 `replace() LIKE` 扫 157k 题 × N 行（>15 min 不返回、kill 后宿主残留 `sudo python3 -` 要手动 kill）；Python 一次建活跃题干 12 字字典再滑窗（4.5 s）。
- 取证：`docs/iter/round-3/r486-shizheng-text-in-explain-zero-r421-qid-path-unexercised.md`。

### R487（2026-09-07）：非探针「练习页 → 问答页带 qid 深链」为何 0 → 入口可见可达但触达不可观测 → `practice_ask_click` 埋点上线（生产 `7acf57b` → `896007c`）

- **取证**：`practice.vue` 「用花生十三方法详解这道题 ›」无 `v-if`、解析区出现即渲染，`deepExplain()` → storage + `uni.switchTab` → 问答页 API 的 Caddy `Referer` 仍是进站 URL（本轮非探针 ask GET referer 全为 `/s/<code>`/`/`，含 practice 的 0 条）；全产品 6 个问答入口只有练习页无 `*_ask_click` 埋点 → `growth_events` probe=0 20 行 0 条能证明练习深链被点过。结论：`explain_cache.qid` 0/82 **既不能判「没人点」也不能判「点了 qid 丢了」**——可观测性缺口，不是功能缺陷。
- 本轮唯一非探针 `explain/stream` 一对（`umst3tuisd7lgzaka` 09-06 21:40Z）Referer `servicewechat.com/wx01f2f29cfe51baba/0/page-frame.html` + `MiniProgramEnv/android` = W7 小程序（appid 与 `project.config.json` 一致）；题文=行测 `questions.296322`（shuliang），该 uid 21:39:44Z 刚答错这题（mistakes 2923 `error_reason='纯蒙的'`）；W7 `streamExplain()` 不发 `question_id`（R485）→ 这两行 qid NULL 是协议决定的。小程序侧「练习→深链讲解」链路通，H5 侧 0 证据。
- **修（`896007c`）**：`deepExplain()` `switchTab` 前 `trackEvent('practice_ask_click', q.module || '', q._sz ? 'sz' : String(qid || ''))`（时政不放数字 qid，记 `'sz'`）；`team.py` `/api/track` 白名单 +1；源锁 `tests/practice-r483-shizheng-qid.test.js` +1、后端 `test_track.py` +1。门 pytest 509 / ruff / pyright 0；vitest 724 / eslint rc=0 / build 绿。下轮起 `growth_events(practice_ask_click).ref` ↔ `explain_cache.qid` 可对账（点了几次 / 带 qid 几次 / 落库带 qid 几次）。
- **发版**：让行 `/opt/SoftCopyrightAgent` `compose up --build`（09:45–09:50Z，盘 5.4→4.0→4.5 G）后 `--skip-build` 一次 rc=0（rev `896007c`、bundle `index-Dm-hobV2.js`、practice 分包 `Ll3wF6Ra` 线上=本机逐字节、7/7 200）。6b `/` 首跑 Lighthouse「运行失败」（stderr 被脚本吞、原因未留痕），手动复跑 perf 0.57 / 0.88 / 0.93、LCP 2738–2812（预算内）、a11y 1.00，`/tiku/` 1.00·1.00；首页结构未改 → 判量测机噪音（推断）。改后一手：探针 `POST /api/track` `practice_ask_click` ×2（`shuliang/296322`、`时政/sz`）200 落库 probe=1，非白名单事件 400；新容器 healthy 0 重启、63 请求 5xx/404/monitor/mpUA 0；WAL 同字节。
- (c) / 到期项无增量：probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、`时政且 qid 非空` 0/0、`explain_cache qid nonnull` 0/82、`umst3` 0 回访。
- 如实：埋点在真人流量上 0 样本；未提交 `explain/stream`（不造 LLM 流量）；W7 `openExplain` 无 `_sz` 守卫 / 不发 qid 只读源码核未真机；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r487-practice-ask-deeplink-reach-unobservable-practice-ask-click.md`；脚本 `~/r487_host.sh` `~/r487_db3.sh` `~/r487_db4.sh` `~/r487_post.sh`。

### R488（2026-09-07）：`perf-budget.sh` Lighthouse「运行失败」不可考 → stderr 留痕（部署侧脚本，生产仍 `896007c` 不发版）
- **(c) / 到期项 0 增量**：R487 容器（09:51:52Z 起）108 请求全本机/探针/bot，非探针 `mistakes/analysis` / `explain/stream` / POST 0；`umst3tuisd7lgzaka` 0 回访；`practice_ask_click` 仍只有 R487 探针 2 行（probe=1）→ `growth_events.ref ↔ explain_cache.qid` 对账无真人样本、未做。probe=0 33/1、growth 20/4、`explain_cache qid` 0/82、`时政且 qid 非空` 0/0、error_reason ≥09-11 0、WAL 同字节、healthy 0 重启。track 5 条里 2 条 200 是 R487 手动 Lighthouse（`moto g power (2022)` UA、本机网段）触发的页面埋点，归探针。
- **修（`deploy/perf-budget.sh`，仅在部署机跑）**：lighthouse stderr 落 `$TMP/<url>.err`，失败时打印 `rc` / loadavg / stderr 末 20 行后继续下一个 URL；`rc=$?` 块首先取；成功路径输出不变、`deploy_h5.sh` 6b WARN/strict 语义不动。本地：`bash -n` OK；正常 `/` perf 0.93 / LCP 2783 rc=0；`SITE=https://nonexistent-r488.invalid` 构造失败 → `rc=1, load=…` + `Chrome prevented page load with an interstitial` 打出、脚本 rc=1。
- **R487 `/` perf 0.57 勘正**：该次手动跑未落盘、不可复核，不再作为数据点；留痕 6 次 perf 0.88–0.93、LCP 2731–2812、`runWarnings` 空、bench 3249–3686；83 份部署日志 `/` perf OK 71 次 0.90–1.00、FAIL 3 次 0.81/0.84/0.86、运行失败 1 次（R487）。「运行失败」根因仍未知，不登记为回归，登记为「已留痕待自然复现」。
- 顺带一手：`CHROME_PATH` 指向不存在文件时 lighthouse 照常跑通（chrome-launcher 回落自找 Chrome，机制为推断）——R487 那次不是 Chrome 路径问题。
- 如实：本轮 0 产品代码；构造失败走的是 interstitial 路径、未复现 R487 具体失败类型；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r488-perf-budget-lighthouse-stderr-retained.md`；补量脚本复用 `~/r487_post.sh`。

### R489（2026-09-07）：6 个问答入口非探针漏斗只读盘点——5 个已埋点入口自 09-03 上线 0 真人点击（0 代码，生产仍 `896007c`）
- **(c) / 到期项 0 增量**：R487 容器 108 请求（last 10:04:20Z）全本机/探针/bot；非探针 POST / analysis / explain 0；`umst3` 0 回访；`practice_ask_click` 仍只 R487 探针 2 行；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` 7 / ≥09-11 0；WAL 同字节；Lighthouse「运行失败」本轮无部署无样本。
- **`growth_events` 全表**：`search/review/report/fav/history_ask_click`（R326–R339，09-03 合入）probe=0 **合计 0 行**、probe=NULL 0 行，全表仅 1 行 `search_ask_click` probe=1（09-06 探针）；`ask_view_question` 0 行。7 个事件名在生产 bundle 各分包里都在（`X-Kg-Probe: 1` 拉取 grep 一手），不是没发上去。
- **非探针问答漏斗（Caddy 08-31 起 5 文件 + DB）**：自然 `explain/stream` 提交 **2 uid / 3 次**——H5 `umsacie7` 09-05 17:07Z ×1（带 qid 234494；16:43→17:07 无任何 `*_ask_click` → 按排除法走的是当时唯一无埋点的练习页深链，推断）+ W7 `umst3` 09-06 21:40Z ×2；**全部是「刚做完题 → 深链讲解」形态**。H5 `umsagboriz` 问答页 6 对 GET = TabBar 直进来回切、0 提交。5 个入口 0、问答页自由输入 0。`ask_cur` 另 3 行 `umtp*` 全 probe=1。
- **判定**：不立项。样本不足以判「没人用 = 缺陷」（R479 已核问答页热区、各入口页面 4 天内到访本身极少）；登记「R326–R339 五入口收益在真实流量 0 验证」，与 R486（R421 直通 0 验证）/ R487（`practice_ask_click` 真人首条）合并观察，指标 = 任一 `*_ask_click` probe=0 首行 / `explain_cache.qid` 首次非空。
- 取证自纠：Caddy 轮转文件名 `…-access-<date>.log.gz`，glob 必须 `…-access*`（`…-access.log*` 只匹配当前文件，会漏 09-05 前全部）；`error_reason` 在 `mistakes` 不在 `answer_log`；容器起点 epoch 用 `StartedAt` 换算别手算。
- 如实：排除法推断依赖「5 个埋点 09-05 前已上线且未静默失败」；`umsacie7` 两段不同出口 IP、身份不确定；0 库写入；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r489-ask-entry-funnel-five-tracked-entries-zero-natural.md`；脚本/输出 `~/r489_db.sh` `~/r489_db.out` `~/r489_caddy.out` `~/r489_post.out`。

### R490（2026-09-07，SOP-10 四维审计）：生产唯一一次非探针带 qid 问答深链走的是错题本**列表**「AI 详解」`redo(m)`——7 入口里唯一无埋点、R487/R489「6 入口」漏数 → `book_ask_click` 上线（生产 `896007c` → `a8ceca8`）
- **(c) / 到期项 0 增量**（10:31Z）：R487 容器 108 请求全本机/探针/bot；非探针 POST / analysis / explain 0；`umst3` 0 回访；`practice_ask_click` 仍只探针 2 行；probe=0 33/1、growth 20/4、`explain_cache qid` 0/82、时政 qid 非空 0/0、`error_reason` ≥09-11 0、WAL 同字节。
- **选簇**：三候选只有「问答页会话/历史 sheet」有非探针**写入**（`umsacie7` 09-05 `explain/stream` + `ask/cur` 落库）；错题本 AI 分析（非探针 `mistakes/analysis` 全历史 0）/ 每日一练完成态（`daily_set_entries` 1 行 probe=1）只读无写 → 先把这唯一一次到达复盘到入口。
- **命中（verified）**：Caddy 17:05:56Z 同一秒 `GET /api/attempts|notes|comments/count?…question_id=234494`（`/api/attempts` 全 `book.vue` 只在列表 `toggleCard(m)`；复习模式不调）→ 17:05:57Z 问答页 onShow（`ask/cur`+`ask/sessions`），中间 **0 条 `/api/track`**（`askFromReview()` 必打 `review_ask_click`）→ 入口 = 列表展开卡 `redo(m)`，无埋点。R487 §1.1 / R489 §2.1「6 入口」漏了它（book.vue 有复习态 + 列表两个入口）；R489「排除法走练习页」勘误（两份文档已加勘误块）。该次讲解走完：`ask_cur` 一条完整讲解（答案 D + 针对所选 B 的错因分析，`saved:false`），功能通，是可观测性缺口非缺陷。
- **修（`a8ceca8`）**：`redo(m)` `switchTab` 前 `trackEvent('book_ask_click', m.module || '', String(qid || ''))`；`team.py` 白名单 +1；源锁 `tests/book-r490-ask-click.test.js`（`redo(m)` 必带 + **所有写 `redoQid` 的方法体必有 `*_ask_click`**，改前 2/2 红）；`test_track.py` +1。门：pytest 510 / ruff / pyright 0；vitest 726 / eslint / build 绿。
- **发版**：4-pre 让行兄弟构建 150 s 后 compose rc=0，容器 10:37:53Z healthy 0 重启；bundle `index-DR7w8z1H.js` + `pages-book-book.QtYBmytf.js` 线上=本机逐字节；7/7 200；perf `/` 0.93 / `/tiku/` 1.00。改后一手：探针 `book_ask_click` → 200 落库 probe=1、非白名单 400（源站直连 403 ×2 为 R388 口径，走公网域名）；起后 34 请求 5xx/404/monitor/mpUA/非探针全 0。
- 顺带核不命中：`redo(m)` `if (!text) return;` 对 `question_text` 空静默——生产 0 行。问答页 sheet / 错题本 AI 分析结果态 / 每日一练完成态本轮**未整页过审**（`ask_sessions` 该 uid 0 行、sheet 非探针 0 次打开），留到有到达证据再审。
- 如实：`umsacie7` 61 作答全 08-01 probe=NULL、09-05 回访 0 作答、两段出口 IP 不同、身份不确定；入口归属靠「调用点唯一 + 无 track POST」两条推出；埋点真人 0 样本；未提交 `explain/stream`；无 testing agent 录屏（未另行授权）；仍无可确认外部真人完整闭环。
- 取证：`docs/iter/round-3/r490-sop10-book-list-ask-deeplink-only-natural-qid-entry-untracked.md`；脚本/输出 `~/r490_db3.sh` `~/r490_caddy1.py` `~/r490_post.sh` `~/r490_post2.out` `~/r490_deploy.log`。

### R491（2026-09-07）：问答页会话/历史 sheet 只读整页审（375/1440）——命中「删除正在查看的会话后被新对话/切换会话重新归档复活」→ `clearCurrent()` 最小修上线（生产 `a8ceca8` → `93ac35c`）
- **(c) / 到期项 0 增量**：R490 容器（10:37:53Z 起）34 请求全本机/探针；非探针 POST / `mistakes/analysis` / `explain/stream` 0；`umst3` 0 回访；`book_ask_click` 真人 0（仅 R490 探针 1 行）、`practice_ask_click` 仍只 R487 探针 2 行 → `growth_events.ref ↔ explain_cache.qid` 对账无真人样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 33/1、growth 20/4；WAL 同字节。
- **历史 sheet 一手（生产 bundle CDP 375/1440，探针头，`/api/**` 全 mock/abort → 0 库写入 0 LLM）**：空态/列表行 54.8 px/`删除` 44×30.7/关闭 40×40/长标题 ellipsis/切换写 `askCurSid`/DELETE 503 墓碑保留 + 刷新过滤 + 重试 全通过（R330 语义成立）。
- **命中（verified 两视口）**：删**正在查看**的会话 A → 行消失、DELETE 200、墓碑清，但 `results`/`askCurSid` 仍 = A；随后「新对话」或切到 B → `archiveCurrent()` 用同 sid 回写 → 本机列表 A 复活 + `POST /api/ask/sessions sid=A`（服务端复活）、标题被 `userText` 30 字改写。R329「查看不销毁」× R330「删除即终态」交叉路径无人接。
- **修（`93ac35c`，纯前端）**：`newSession()` 清空段抽成 `clearCurrent()`；`delSession()` 末行 `if (s.id === (this.curSid || Number(uni.getStorageSync('askCurSid')) || 0)) this.clearCurrent();`（刷新后 `curSid` 为 0、sid 只在 storage 的情形一并覆盖）。源锁 `tests/ask-r491-del-current-session.test.js`。门 vitest 728 / eslint / build 绿；pytest 510 / ruff / pyright 0。
- **发版 + 改后一手**：等兄弟 `pip install` 退出（盘 2.6 G→3.4 G）后 `--skip-build` 一次 rc=0，容器 `StartedAt 11:03:51.871Z` healthy 0 重启，`pages-ask-ask.9GiTFO19.js` 线上=本机 md5；7/7 200；perf `/` 0.97·1.00 / `/tiku/` 1.00·1.00。生产 375/1440 同脚本：删当前会话即清空 + `POST /api/ask/cur []`、切 B 后 0 条 `POST sessions`、`askSessions=[1002]`；失败态/墓碑不变。起后 49 请求全本机、5xx/404/monitor 0。
- **生产触达**：Caddy 全历史 `/api/ask/sessions|cur` 630 次里非探针 20 次（GET 18 + `POST cur` 2），**`POST/DELETE /api/ask/sessions` 非探针 0 条**、`ask_sessions` 全表 1 行探针 → 命中路径真实流量 0 次发生（可达未触发，R484 同性质）。
- 登记不改：`删除` 30.7 px 宽 + 无二次确认（错题本有 `showModal`）——无样本；跨设备删后本机仍看着 → 追问回写复活（R330 已登记）。
- 如实：CDP 仿真非真机；`.rec-row`/`.rec-brief` 结果区同名 class 会混进计数、判定看 `.sheet` 内元素 + `askSessions`；未提交 `explain/stream`；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r491-ask-history-sheet-audit-delete-current-session-resurrect.md`；脚本/输出 `~/r491_hist.py`（`R491_BASE` 可指本地 dist）`~/r491_hist_{375,1440}{,_post}.out` `~/r491_hist_375_local.out` `~/r491_caddy2.sh` `~/r491_post.out` `~/r491_deploy.log`。

### R492（2026-09-07）：错题本 AI 分析结果态只读整页审（375/1440）——命中「成功结果按页面生命周期缓存、无重新生成入口」→ 「按当前错题重新生成」最小修上线（生产 `93ac35c` → `08a409d`）
- **(c) / 到期项 0 增量**：R491 容器（11:03:51Z 起）49 请求全本机/探针；非探针 POST / `mistakes/analysis` / `explain/stream` 0；`umst3` 0 回访；`book_ask_click`/`practice_ask_click` 真人 0（探针 3 行）→ `growth_events.ref ↔ explain_cache.qid` 对账无真人样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 33/1、growth 20/4；WAL 同字节。发版后（11:31:25Z 起）79 请求同口径全 0。
- **AI 分析 sheet 一手（改前生产 bundle CDP 375/1440，探针头，`/api/mistakes` 假数据 + `/api/mistakes/analysis` 全 mock ok/fail/empty/nopending/long/hang，其它非 GET abort → 0 库写入 0 LLM）**：入口 `>=3` 两侧 / 生成 56.6×44 / loading 让出 TabBar（762=762）/ 成功 3 节 / 502 失败 + 重试 333×41 / 空正文转失败 / 确定性文案 / 长文本 70vh 内滚 / 关闭 40×40 / 成功重开 0 请求 / 失败重开重请求 / 挂起单飞 全通过（R397–R399 语义成立）。
- **命中（verified 两视口）**：`aiAnalysis(false)` 在 `aiHtml` 非空即 return，成功结果按 tab 页实例生命周期缓存；`onShow → load()` 已刷新错题列表而 `aiHtml` 不失效，结果态 sheet 只有关闭、无任何重新生成入口（唯一途径整页 reload）。与「练习 → 错题 → 复习 → 掌握」闭环冲突：分析输入（`mistake_analysis_stats` `mastered=0` + 近 7 天作答）一次会话内就会变。
- **修（`08a409d`，纯前端）**：结果态 `<view v-else><rich-text/><view class="sheet-done ai-regen" @click="aiAnalysis(true)">按当前错题重新生成</view></view>`（复用 `retry===true` 绕缓存分支，`--brand-soft` 二级色）；catch 分叉 `if (this.aiHtml) uni.showToast('重新生成失败：…')` 保留旧结果可读 / `else this.aiErr` 首次失败仍走 R398 失败态（不分叉则 `v-else-if="aiErr"` 盖住旧结果且重开也回不来）。不做列表变化自动失效（会让每次重开都打 LLM）、不改后端限流。源锁 `tests/book-r492-ai-regen.test.js`。门 vitest 730 / eslint / build 绿；pytest 510 / ruff / pyright 0。
- **发版 + 改后一手**：宿主无兄弟构建、盘 3.9 G、load 1.08，`--skip-build` 一次 rc=0；容器 `StartedAt 11:31:25.998Z` healthy 0 重启；`pages-book-book.Bz_ypnQd.js` 线上=本机 md5；7/7 200；perf `/` 0.99·1.00 LCP 927 / `/tiku/` 1.00·1.00。本地 dist → 生产 375/1440 三点对照：`.ai-regen` 333.1×41.1 / 1029×42 命中 ✓；点它 → loading → mock 502 → toast + 旧结果回显（`h2` 3 节、无 `.ai-err`）→ 再点 → 长文本替换（`h2` 17 节）；analysis 恰 2 次；其余 18 项与改前一致。
- **生产触达**：`/api/mistakes/analysis` 全历史非探针 4 次全为 W7 小程序 `umst3`，H5 `book.vue` 路径非探针 0 → 命中路径真实流量 0 次发生（可达未触发，R484/R491 同性质）。
- 登记不改：入口阈值 `todoItems >= 3` vs 后端 ≥1——生产待掌握 1–2 条 uid 48 / ≥3 条 24（含探针，`mistakes` 无 `probe` 列），2/3 有错题账号看不到入口，产品取舍；1440 `.mask` 只盖 `.bookwrap`（l≥288）左导航可点（R479/R491 同形态）。
- 如实：CDP 仿真非真机；未向生产 LLM 发过请求、真实 30–60 s loading 体验未测；修的是真实流量 0 次触发的路径；48/24 含探针；`r492_post.sh` 误在本机跑过一次（数据弃用）；截图改前版被改后同名覆盖，改前以 `.out` 为准；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r492-book-ai-analysis-sheet-audit-stale-result-regen.md`；脚本/输出 `~/r492_ai.py`（`R492_BASE` 可指本地 dist；模式 ok/fail/empty/nopending/long/hang + 7b regen）`~/r492_ai_{375,1440}.out`（改前）`~/r492_ai_local_375.out` `~/r492_ai_prod_{375,1440}.out` `~/r492_post.sh`（远端 payload）`~/r492_post.out` `~/r492_post2.out` `~/r492_deploy.log`。

### R493（2026-09-07）：每日一练完成态只读整页审（375/1440）——命中「成绩提交失败仍报打卡成功、完成页无重试入口、分享丢每日文案、首页补投后要再切页才显已完成」→ 最小修上线（生产 `08a409d` → `c458a3e`）
- **(c) / 到期项**：发版前 R492 容器 79 请求全本机/探针；发版后（12:05:52Z 起）165 请求，5xx/404/monitor/Traceback 0；`*_ask_click` 真人 0（探针 3）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；H5 非探针 analysis 0（全历史 4 全 W7）；非探针 explain 0；WAL 4,124,152 B 同字节。
- **首次非探针作答增量（verified Caddy + DB，发版前 4–9 min，与发版无因果）**：`umsacie7…` H5 Win Chrome `141.11.46.189` 资料分析 10 题 22 s（2 s/题，4 错 → 4 `mistakes`），此前错题本展开 234494 卡 → 原题/讨论页 → 问答页进出 0 提交、无 `book_ask_click`；完成页首次对非探针显示 `login_nudge_show` / `push_nudge_show`；`umst3…` W7 小程序 `223.83.2.218` grouped 资料 10 题 19 s（同材料 5 题 5 s 全选 B）+ `POST /api/pk/create` 1 次。probe=0 `answer_log` 33/1 → 53/2、growth 20/4 → 26/4。**口径**：非探针有写入 ≠ 真人在学（1–2 s/题是点过）；两端同城同时段推断同一人点测，身份不确定。258 请求全 200/304；部署重启窗口内 0 请求；两人都没进每日一练（`submit` 0、`daily_set_entries` 仍 1 行探针）。
- **完成态一手（改前生产 bundle `index-DetvGgWg.js`，CDP 375/1440 探针头，`/api/daily_set*` 全 mock、其它非 GET abort，0 库写入）**：几何（环/`本组完成`/`dsbeat` 43.6/榜 10 行 281/三按钮 44×306 / 44×650）、`already`/`first`/`boardfail`/`past`、长昵称 ellipsis、无横向溢出、滚到底 755<812、分享/返回首页——全过。
- **命中（两视口）**：`markDailyDone()` `submitDailySet().then()` 无 catch；提交 503 → toast 仍「打卡成功」、`.dsbeat` 整行不渲染、DOM 无任何重试元素、`shareResult()` 回落普通练习文案（丢「每日一练/同题挑战 daily=1」）；`fail2`（提交挂起 → 回首页补投成功）首页 `loadDailySet()` 与 `flushDailySubmit()` 并发，hero 仍「已有 36 人完成」，再切一次页才「已完成」。补投链路本身成立。
- **修（`c458a3e`，纯前端）**：`practice.vue` 提交抽 `sendDailyResult(p)`（catch 仅无 stats 时 `dailyErr=true`，榜失败不算）+ 完成页 `v-else-if="!beiMode && dailyErr"` 行「今日全站同题 · 成绩上传失败，点此重试（回首页也会自动补传）」`role=button` `min-height 40px` 警示色 → `retryDailySubmit()` 只重投 storage 同日 pending payload；分享条件 `_dailyDoneDate && (dailyStats || dailyErr)`、`ds = dailyStats || {}`；`submitResult()` 复位。`api.js flushDailySubmit()` 返回 `Promise<boolean>`；`home.vue` `flushDailySubmit().then(ok => ok && syncDsDone())` + `loadDailySet()` 经 `syncDsDone()`。不改后端/协议/toast 时机。源锁 `tests/practice-r493-daily-submit-fail.test.js` 6 用例。门 vitest 736 / eslint / build 绿；pytest 510 / ruff / pyright 0。
- **发版 + 改后一手**：宿主 load 0.21 盘 3.9 G 无兄弟构建，`--skip-build` 一次 rc=0；容器 `StartedAt 12:05:52.498Z` healthy 0 重启；`pages-practice-practice.BcHHPZzW.js` / `pages-home-home.BYayApaM.js` 线上=本机 md5；7/7 200；perf `/` 0.99·1.00 LCP 1405 / `/tiku/` 1.00·1.00。本地 dist → 生产 375/1440 三点对照：失败行 48×306 / 40×650 命中 ✓；点 → 再 503 → 行保留；改成功再点 → 每日行 + 榜 10 行、pending 清；失败态分享仍带每日文案 + `daily=1&src=share`；`fail2` 首页首次 onShow 即「已完成」；`ok`/`boardfail` 与改前一致。
- 登记不改：CDP context TabBar 高 0（375 让位按最后按钮底 < vh 判，真机未核）；「打卡成功」toast 在提交前发出（本地完成语义，失败时先看到成功再看到失败行）；往期日期不提交不显每日行（后端只收当日）；修的是可达未触发路径（`daily_set_entries` 1 行探针、非探针 submit 全历史 0）。
- 如实：CDP 仿真非真机；生产本轮 0 次真实 submit；「同一人两端点测」为推断；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r493-daily-set-done-state-audit-submit-fail-visible-retry.md`；脚本/输出 `~/r493_daily.py`（`R493_BASE` 可指本地 dist；模式 ok/fail/fail2/already/first/boardfail/past/retry）`~/r493_daily_{375,1440}_<mode>.out`（改前）`~/r493_daily_local_*.out` `~/r493_daily_prod_*.out` `~/r493_post.sh` `~/r493_post.out` `~/r493_post2.out` `~/r493_who.sh` `~/r493_who.out` `~/r493_deploy.log`。

### R494（2026-09-07）：完成页登录/推送 nudge 首次对非探针显示 → 触达/关闭/订阅漏斗只读盘点 + 375/1440 叠加形态一手——几何/交互无缺陷；命中「关闭与开启失败在生产不可观测」→ 最小修补 3 埋点（`7100b51`）
- **(c) / 到期项**：R493 容器（12:05:52Z 起）165 请求 5xx/404/monitor/Traceback 0；非探针非 bot 5 条全 `umst3…` 12:08Z 小程序只读 GET，非探针 POST 0；`*_ask_click` 真人 0（探针 4）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；非探针 analysis/explain 0；probe=0 `answer_log` 53/2、growth 26/4；`daily_set_entries` 1/1 探针；WAL 4,124,152 B 同字节。
- **两个非探针 uid 回访**：`umsacie7…` 12:00Z 后 0 请求；`umst3…` 84 请求 = R493 那 10 题（12:00:08–27Z，后 5 题 1 s/题全 B）+ 12:08Z 只读回访，**均无第二段作答**、未进每日一练、0 `*_ask_click`。口径不变：非探针写入 ≠ 真人在学；同一人两端点测为推断。
- **nudge 漏斗（verified DB）**：`umsacie7…` 11:57:57Z `login_nudge_show` / 11:57:58Z `push_nudge_show`（probe=0 首现，各 1 行），其后 0 `login_nudge_click` / 0 `push_nudge_ok` / `push_subs` 0 / 无 login 页与 subscribe 请求。源码：两卡 `✕` 只写 storage 不打点、`pushNudgeGo()` 权限非 granted 与 subscribe/上报异常两路只 toast 不打点 → 「没看见 / 关掉 / 被拒 / 失败」四解释不可区分，可观测性缺口（R487/R490 同性质）。
- **叠加形态一手（改前生产 bundle `index-DetvGgWg.js`，CDP 375/1440 探针头，`/api/**` 全 mock、学习类非 GET abort，0 库写入 0 LLM）**：到期复习 / 登录 / 推送三卡顺序固定、卡间 11.5 / 12 px、无重叠无横向溢出（`docSW 360/1425`）；`去登录 ›` 73.9×40、`开启 ›` 61.9×40、两 `✕` 40×40；独立关闭各写 `loginNudgeDismissed` / `pushNudgeOff` 且二次完成不复活；`去登录 ›` → `#/pkgA/user/login` + `login_nudge_click`；推送成功卡「已开启 ✓」去 CTA/✕ + `subscribe` 1 + `push_nudge_ok` 1；权限拒绝 / subscribe 抛错各 toast、nudge 保留可重试、`push_nudge_ok` 0。**全过，无几何/交互缺陷**。
- **修（`7100b51`）**：`practice.vue` `dismissLoginNudge()` +`login_nudge_dismiss`、`dismissPushNudge()` +`push_nudge_dismiss`、`pushNudgeGo()` denied → `push_nudge_fail`/`denied`、catch → `push_nudge_fail`/`error`；`team.py` 白名单 +3。不改展示条件 / 本地关闭语义 / 订阅 payload / 学习接口。源锁 `tests/practice-r494-nudge-funnel.test.js`（4 用例，含「前端 7 个 `*_nudge_*` 事件名 ⊆ 后端白名单」）+ `test_track.py` +1。门 pytest 511 / ruff / pyright 0；vitest 740 / eslint / build 绿。本地 dist 375 `both/pushdeny/pushfail` 改后一手：`login_nudge_dismiss` / `push_nudge_dismiss` / `push_nudge_fail ref=denied ×2` / `ref=error ×2` 均发出，几何与改前生产一致，`errs 0`。
- **发版（如实）**：首次 `deploy_h5.sh` 因本机 `pkill -f` 误杀自身 shell 未起；第二次在 4-pre 让行阶段宿主 `/` avail 掉到 41 M（兄弟 `/opt/SoftCopyrightAgent` `DOCKER_BUILDKIT=0 docker build` + `pnpm install`，load 5–6.6）→ 本机 kill 脚本（远端未动）、只读轮询到兄弟退出且 avail 4.9 G（12:45:34Z）后第三次起跑 `--skip-build` rc=0：容器 `StartedAt 12:47:52Z rev=7100b51` healthy 0 重启，bundle `index-JtJc6eiv.js` 线上=本机（首查旧 hash 传播窗口内 5 s 重试即一致），7/7 200，perf `/` 0.97·1.00 LCP 1679 / `/tiku/` 1.00·1.00；探针经边缘域 `login_nudge_dismiss`/`push_nudge_dismiss`/`push_nudge_fail` 200 落库 probe=1、非白名单 400（直打源站 403 = R388 无边缘头，非回归）；生产 bundle 375 `both/pushdeny/pushfail` 三点对照与本地 dist 逐值一致（几何与改前同、三类新事件各发出、`errs 0`）；改后 140 请求 5xx/404/monitor/非探针 0、WAL 同字节。期间未删任何东西。详见 `docs/iter/round-3/r494-*.md` §4.2。
- 登记不改：一次关闭永久（无再现周期）；`loginNudgeN ≥ 30` 阈值；运行中权限 denied 保留卡可重试（既有语义）。
- 如实：生产真人对两 nudge 的 click/ok/dismiss/fail 全 0 样本；推送成功/失败均 stub；CDP 非真机（TabBar 高 0、权限弹窗形态未测）；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r494-done-page-nudge-funnel-audit-dismiss-fail-telemetry.md`；脚本/输出 `~/r494_nudge.py` `~/r494_sum.py` `~/r494_nudge_{375,1440}_<scen>.out`（改前生产）`~/r494_nudge_local_375_*.out`（改后本地）`~/r494_nudge_prod_*.out`（改后生产）`~/r494_post.sh` `~/r494_post.out` `~/r494_who.sh` `~/r494_who.out` `~/r494_hostwait{,2}.sh/.out` `~/r494_deploy.log`。

### R495（2026-09-07）：登录页 `pkgA/user/login` 375/1440 只读整页审（nudge「去登录」→ 登录页 → 回完成页留存 + wxlogin 503 兜底）——命中「H5 刷新/深链直达登录页成功后停在登录页」+「匿名记录合并失败静默」→ 最小修上线（生产 `7100b51` → `f281539`）
- **(c) / 到期项 0 增量**：R494 容器 140 请求 / 本轮新容器（13:19:59Z 起）88 请求，5xx/404/monitor/Traceback/mpUA 0、非探针 POST 0、WAL 同字节；`*_ask_click` 真人 0（探针 4）→ `explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；`umsacie7` 0 回访、`umst3` 仍 84。**nudge dismiss/fail 真人首行仍 0**：`login_nudge_dismiss`/`push_nudge_dismiss`/`push_nudge_fail` 各 1 行全为 R494 探针（probe=1）；`push_nudge_ok`/`push_subs` 0。
- **登录页一手（改前生产 bundle `index-JtJc6eiv.js`，CDP 375/1440 探针头，`/api/auth/*` 全 mock、学习类非 GET abort → 0 账号 0 库写入 0 LLM）**：375 卡 337×386 / 字段 306×42 / 主按钮 306×44 / seg 150×40 / `docSW 360`；1440 卡 656 居中；短手机号/短密码/401/SSO 401 文案各就位、busy disabled；成功后 `authToken`/`authUser`/`deviceAnonUid` 落 storage；nudge「去登录」→ 登录 → **回完成页**、登录 nudge 消失、推送 nudge 独立保留（首判「登录 nudge 残留」是 `.loginnudge` class 复用误判）。留存路径成立。
- **命中 A（verified 改前生产两跑）**：`fresh` 直达登录页（页面栈 1 页）→ 成功 → 1.2 s 后仍 `#/pkgA/user/login`。原成功尾 `uni.navigateBack({ fail: () => switchTab(stats) })`，H5 `navigateBack` = `history.go(-1)` 永不 `fail`；`practice.vue` R379 已按 `getCurrentPages().length > 1` 分流、登录页没有。运行时 `window.getCurrentPages` undefined（只在 bundle 作用域）、`history.length 2`。
- **命中 B（verified 源码 + 改前生产 `mergefail`）**：`mergeAnon` catch 空注释 → 503 时无 toast/err，用户不知本机记录未并入；生产 `merge_anon` 非 2xx 全历史 0（可达未触发）。
- **修（`f281539`，纯前端 1 文件）**：`leave()`（`getCurrentPages().length > 1 ? navigateBack({fail: switchTab(stats)}) : switchTab(stats)`）；`submit()`/`ssoLogin()` 成功尾 `setTimeout(() => this.leave(), 1200)`；两处 catch → toast `MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并'`（`clearAuth()` 会把 `anonUid` 恢复为 `deviceAnonUid`，再登录会再合并——源码 verified 运行时未复验）。源锁 `tests/login-r495-leave-merge-fail.test.js` 3 用例。门 vitest 743 / eslint / build 绿；pytest 511 / ruff / pyright 0。
- **发版 + 三点对照**：宿主 avail 6.3 G / load 0.56 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 `StartedAt 13:19:59.642Z` healthy 0 重启；`pkgA-user-login.VZROEXEt.js` 线上=本机 md5 `6daa4c3f…`；7/7 200；`index-gUxy9rlY.js` gzip 126 KB；perf `/` 0.99·1.00 LCP 927 / `/tiku/` 1.00·1.00。本地 dist → 生产 375 `fresh`/`freshmergefail`/nudge `ok` + 1440 `fresh` 逐值一致：`fresh` → `#/pages/stats/stats`（改前停登录页）、`freshmergefail` → 合并失败 toast + stats、nudge `ok` 回完成页同改前。harness 噪音：stats 页用 mock token 读生产 → 403（只读、`u9495` 不存在）；本地 stats mock 不全 `TypeError`/`ERR_FAILED`——都不是产品错误。
- **wxlogin 503 兜底（只读）**：`auth.py` 无 `WX_MINIAPP_SECRET` → 503「微信登录暂未开通（服务端未配置小程序密钥）」；小程序 `request.ts` reject `Error(detail)` → `login.ts` `err` 页内显示，`wxBusy` 复位。生产非探针 503 4 次（09-06 两 IP，同 IP 2 s 两次 = 重试推断）。不改：密钥运营决策；小程序 `mergeAnon` catch 亦静默（W7 分支登记）；文案无「改用手机号」引导。
- 登记不改：`.sso-note` 11.52 px 说明小字；`.err` 无 `role=alert`；`merged_anon` 历史覆盖不全；「退出 → 重登 → 再合并」运行时用例下一轮只读核。
- 如实：CDP 非真机；SSO 成功只 mock；小程序真机文案未核；0 生产账号 0 学习写入 0 LLM；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r495-login-page-audit-h5-leave-stack-merge-fail-visible.md`；脚本/输出 `~/r495_login.py`（`R495_BASE` 可指本地 dist；场景 ok/fail401/mergefail/sso401/validate/register/direct/fresh/freshmergefail/hang）`~/r495_login_{375,1440}_<scen>.out`（改前生产）`~/r495_local_375_*.out`（改后本地）`~/r495_prod_*.out`（改后生产）`~/r495_post.sh` `~/r495_post.out` `~/r495_post2.out` `~/r495_deploy.log` `~/r495_backend_gate.out`。

### R496（2026-09-07）：「退出 → 重登 → 再合并」运行时复验 + 个人页/统计页登录态·退出路径 375/1440 只读整页审——命中「退出后账号派生数据（打卡/徽章/热力图/未读）留在屏上要再切 tab 才归匿名态」→ 最小修上线（生产 `f281539` → `f7ae2c7`）
- **(c) / 到期项 0 增量**：R495 容器 88 请求 / 本轮新容器（13:44:32Z 起）32 请求，5xx/404/monitor/Traceback/mpUA 0、非探针 POST 0、WAL 同字节；`*_ask_click` 真人 0（探针 4）→ `explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；nudge dismiss/fail/ok 真人 0；`umsacie7` 0 回访、`umst3` 无第二段；**登录分包非探针加载全历史 0**。
- **登录/退出链路生产触达（Caddy 全历史）**：`POST /api/auth/logout` **0 次**（含探针）、`merge_anon` 1 次探针 200 / 非 2xx 0、`login/register/sso` 全探针、账号域无 token 403 共 70 全探针（R495 harness mock token 读生产）——「退出 → 重登」可达未触发。
- **storage 语义运行时复验（verified，`/api/**` 全 mock，0 账号 0 库写入）**：`setAuth()` 落 `deviceAnonUid`；退出 → `POST logout` 1 次、`authToken/authUser` 清、`anonUid` 恢复 = `deviceAnonUid`；再登录 → `anon !== user.uid` 进合并分支 → `POST merge_anon {anon_uid: 旧匿名}` 再发 + toast「本机记录已合并到账号」——R495 文案「退出后重新登录会再次合并」运行时成立（375 改前 / 1440 改后）。
- **几何/交互无缺陷**：个人页 `退出登录` 329.3×44、统计页 `退出` 55.7×42.2 / 58×44，modal/toast/匿名态账号卡各就位，`docSW 360/1425` 无溢出。
- **命中（verified 改前生产 profile 375 + stats 375/1440）**：退出后个人页 `7连续打卡`/`连续 7 最长 12`/徽章 2/`3 条未读` 仍在屏上，统计页 `7连续打卡`/`学习 102 次`/亮格 7 仍在，均要再切一次 tab 才归 0；根因 `doLogout()` 只重拉各自挑的一部分 loader（个人页缺 `loadBadges/loadInbox`，统计页缺 `checkin/summary`/`predict`/`mastery`/`exam/attempts`），字段不随 `user=null` 失效；与确认文案「退出后回到本机匿名记录」自相矛盾，换账号登录会串一屏（推断）。
- **修（`f7ae2c7`，前端 2 文件）**：两页各抽 `refreshAccountData()` 收拢 `onShow` 全部账号相关拉取、`onShow` 只调它；`doLogout` 确认后 `clearAuth()` → 清账号态字段（profile `mistakeN/profile/growth/badgeInfo/inboxUnread`；stats `hmDays/svStreak/kmCov/examAttempts/examTarget/growth/reco/slStats`）→ `refreshAccountData()` 按恢复后的匿名 uid 整套重拉。源锁 `tests/logout-r496-account-state-refresh.test.js`（改前 4/4 红）。门 vitest 747 / eslint / build 绿；pytest 511 / ruff / pyright 0。
- **发版 + 三点对照**：宿主 avail 5.5 G / load 0.28 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 `13:44:32.383Z` healthy 0 重启；profile/stats 分包线上=本机 md5；7/7 200；perf `/` 0.99 / `/tiku/` 1.00 LCP 965。生产改后 375 profile / 375+1440 stats 退出后即全 0、`calls_after` 多出缺的 loader；1440 relogin 再发 `merge_anon`；本地 dist 逐值一致；`errs 0`。发版后「非探针非 bot 13」逐条按 `Cf-Connecting-Ip` = 本机出口 → 全为部署 6b Lighthouse（UA `moto g power (2022)` 无 `Lighthouse` 字样）+ CDP `/sw.js`，外部 0。
- 登记不改：`authLogout()` 失败静默（本机退出语义）；两页退出确认文案措辞不一致；401/403 自动清态与 logout 接口失败两路径只源码核未运行时复验；修的是生产 0 次触发路径。
- 如实：CDP 非真机；0 生产账号 0 库写入 0 LLM；1440 个人页改后未复跑（不涉几何）；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r496-profile-stats-logout-stale-account-state-refresh.md`；脚本/输出 `~/r496_logout.py`（`R496_BASE` 可指本地 dist；场景 profile/stats/relogin）`~/r496_prod_*.out`（改前生产）`~/r496_local_*.out`（改后本地）`~/r496_prod_post_*.out`（改后生产）`~/r496_post.sh`/`~/r496_post2.sh`/`~/r496_post3.sh` → `.out`、`~/r496_deploy.log`。

### R497（2026-09-07）：401/403 自动清态 + `authLogout()` 失败两路径运行时复验 + 设置页/提醒设置项登录态·匿名态 375/1440 只读整页审——命中「自动清态发生在已挂载的个人页/统计页上时账号派生数据留屏要再切 tab」+「提醒时间 picker 触发区 15–16 px」→ 最小修上线（生产 `f7ae2c7` → `578d176`）
- **(c) / 到期项 0 增量**：R496 容器 44 请求 / 本轮新容器（14:15:20Z 起）35 请求，5xx/404/monitor/Traceback/mpUA 0、非探针非 bot 0、非探针 POST 0、WAL 同字节；`*_ask_click` 真人 0（探针 4）→ `explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；nudge dismiss/fail/ok 真人 0；`push_subs` 0；`umsacie7` 0 回访、`umst3` 无第二段；登录分包/提醒设置分包非探针加载全历史 0；`POST /api/auth/logout` 全历史 0。
- **401/403 真实发源（Caddy 全历史）**：非探针 401 只有 6 次 `GET /api/admin/*` 无 bearer（管理台探活）；`comments/inbox` 真实 401 0；带 Bearer 的非探针请求 0；账号域 403 共 70 全探针——两条清态路径生产从未对真人触发（可达未触发）。
- **运行时 verified（改前生产 bundle，`/api/**` 全 mock，0 账号 0 库写入 0 LLM）**：非 auth 接口 `401 未登录或登录已过期` / `403 无权访问该账号数据` → 700 ms 内 toast「登录已过期，请重新登录」、`authToken/authUser` 清、`anonUid = deviceAnonUid`；`/api/auth/merge_anon` 401 **不**清态、走登录页合并失败 toast（`classifyHttpError` 的 `/api/auth/` 排除成立）；`POST logout` 503 → 本机仍清态 + 「已退出登录」（R496 登记 ① 升级为运行时 verified）。
- **命中 A（verified 改前生产 profile 375 `inpage_profile`/`expire401_profile` + stats 375/1440）**：个人页停留中点「每日目标」撞 403 → 账号卡已「未登录」但 `180/25/7`、`连续 7 最长 12`、徽章 2、`3 条未读`、`国考 · 2026-11-29` 全留屏；统计页 KPI `180/70%/7`、`学习 102 次`、亮格 7 留屏；都要 reshow 才归 0。根因：R496 的清字段+重拉只挂在 `doLogout()` 里，`api-policy` 走 `clearAuth() → $emit('authChanged')`，两页无监听。
- **命中 B（verified 改前生产 375/1440 登录态+匿名态）**：`<picker mode="time">` 可点区 = `.time-v` 本体 `15–16 × 51–53 px`，行高 57 但整行不可点；`pkgA/settings/*` 从未整页过审。
- **其余全过**：入口 46.9×329.3 / 48×512；三行 56/57；`docSW 360/1425`；开关 → storage/toast/权限 warn 三态（default/denied/granted）各就位；离线推送权限未授 → toast 不发订阅；synthetic granted + subscribe 抛错 → 「开启失败，请稍后再试」（stub 不判缺陷）；登录态/匿名态一屏相同（storage 不随账号）。
- **修（`578d176`，前端 3 文件）**：两页 `onLoad` `$on('authChanged')`（`onUnload` `$off`），uid 变了才 `resetAccountState()`（清字段 → `refreshAccountData()`），`doLogout` 只 `authLogout()+clearAuth()+toast`；`.time-v` `min-height:40px; inline-flex; align-items:center; padding-left:24rpx`。源锁 R496 测试改写（4 用例）+ `tests/reminders-r497-picker-hitarea.test.js`（3 用例）。门 vitest 754 / eslint / build 绿；pytest 511 / ruff / `backend/` pyright 0（根目录跑 pyright 121 假错）。
- **发版 + 三点对照**：宿主 avail 5.5 G / load 0.45 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 `14:15:20.868Z` healthy 0 重启 `rev=578d176`；profile/stats/reminders 分包线上=本机 md5；7/7 200；perf `/` 0.96 LCP 1397 / `/tiku/` 1.00 LCP 951。生产改后 `inpage_profile`/`expire401_profile` 403/401 后**不切页即**全 0 且 `calls_after` 紧跟匿名 uid 重拉；`expire_stats` 375/1440 即全 0；`logoutfail`/`relogin_mergeauth401` 同改前；设置页 `.time-v` 40×65.3、其余逐值同改前；本地 dist 一致。
- 登记不改：提醒开关/时间只落本机 storage 不随账号；synthetic push 失败无重试入口（真实 PushManager 路径未触，等 `push_subs` 真人首行）；picker 原生弹层真机未测；修的两条都是生产 0 次触发路径。
- 如实：CDP 非真机；0 真实登录/退出/合并/订阅/LLM 请求；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r497-auth-expiry-clear-state-mounted-pages-settings-picker-hitarea.md`；脚本/输出 `~/r497_expire.py`（场景 `expire_profile|expire_stats|expire401_profile|expire_fresh|inpage_profile|profile_logoutfail|relogin_mergeauth401`）、`~/r497_settings.py`（`<W> <auth|anon> [grant]`）、`~/r497_prod_*.out`（改前生产）`~/r497_local_*.out`（改后本地）`~/r497_prod_post_*.out`（改后生产）、`~/r497_post.sh` → `~/r497_post.out`/`~/r497_post2.out`、`~/r497_deploy.log`。

### R498（2026-09-07）：其它持有账号派生字段的页面（首页 / 错题本 / 成长 / 学习计划）是否也漏 `authChanged` 监听——同法「清态在 `onShow` 之外」用例 375/1440 只读审——命中「首页停留中撞 403 → 今日进度/打卡/考试/今日计划/focus 全留屏」+「错题本『标为已掌握』撞 403 → 错题卡留屏 + PATCH 失败无 catch（unhandledrejection 打 monitor、用户无反馈）」→ 最小修上线（生产 `578d176` → `cf95384`）；成长三页 / 问答页源码核后登记不改
- **(c) / 到期项 0 增量**：R497 容器（14:15:20Z 起）至发版共 70 请求 / 本轮新容器（14:40:54Z 起）32 请求，5xx/404/monitor/Traceback/mpUA 0、非探针非 bot 0、非探针 POST 0、Caddy 401/403 0（harness 403 全在 CDP 本地 mock）、WAL 同字节；`*_ask_click` 真人 0（探针 4）→ `explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；nudge dismiss/fail/ok/click 真人 0；`push_subs` 0；`umsacie7` 0 回访、`umst3` 无第二段；登录分包/提醒分包非探针加载全历史 0；`POST logout` 全历史 0；harness uid `umr498*`/`u9498` 落库 0 行。
- **全仓盘点（源码）**：tabBar 5 页里 `profile/stats` 有监听（R497），**`home`/`book` 无**且持有大量账号派生字段；`ask` 无监听但会话历史是设备本地 `askSessions` + 远端合并、不按 uid 分键（既有设计）；成长三页 `pkgA/stats/{mastery-map,practice-history,weekly-report}` 是 `navigateTo` 叶子页、进入即按当前 uid 拉取、唯一写请求 `weekly/read` 已空 catch；「学习计划」无独立页（首页 `plan*`/`home_bundle.daily_plan`）。
- **命中 A（verified 改前生产 375/1440 `inpage_home`）**：首页停留中点计划 focus chip → `POST user_state` 403 → toast「登录已过期」、token 清、`anonUid` 恢复，但 `今日已练 9/20 · 连续打卡 7 天 · 国考·北京 · 今日到期复习 5 题 · 今日计划 83 天强化期 2 行 · focus 资料分析` 全留屏，`calls_after` 仅那 1 条 403；reshow 才归匿名态。
- **命中 B（verified 改前生产 375/1440 `inpage_book`）**：错题本「更多 → 标为已掌握」→ `PATCH mistakes/:id` 403 → `待掌握 4 · 今日待复习 2 道 · 4 卡` 全留屏，且 `master()` 无 catch → **`POST /api/monitor/report unhandledrejection: 登录已过期`**、用户侧无「操作失败」反馈（`del()` 同形态源码 verified）。
- `expire_home`/`expire_book`（切回时 403）改前即匿名态——`onShow` 顺手刷掉，与 R497 §5 同理，不计命中。
- **修（`cf95384`，前端 2 文件 + 源锁 6 用例改前 6/6 红）**：两页 `onLoad` `$on('authChanged')`（`onUnload` `$off`），`anonUid() !== this._acctUid` 才 `resetAccountState()`（清字段 → 首页 `refreshAccountData()` 收拢 `onShow` 五个 loader；错题本按新 uid 解析 `reviewSnap` → `load()`）；`master()`/`del()` 加 catch → toast「操作失败：…」/「删除失败：…」并 return。门 vitest 760 / eslint / build 绿；pytest 511 / ruff / `backend/` pyright 0。
- **发版 + 三点对照**：宿主 avail 5.5 G / load 0.15 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 `14:40:54.419Z` healthy 0 重启 `rev=cf95384`；home/book 分包线上=本机 md5；7/7 200；bundle 126 KB；perf `/` 0.99 LCP 1410 / `/tiku/` 1.00 LCP 965。生产改后 `inpage_home` 375/1440 撞 403 后**不切页即** `0/20 · 选择考试 · 无计划 · guide`，`calls_after` 紧跟匿名 uid `exam/resume → practice/resume → review/cur → home_bundle`；`inpage_book` 375/1440 即空态、toast「操作失败：登录已过期，请重新登录」、匿名 uid `review/cur → mistakes → review → mastery/map`、**monitor 不再出现**；本地 dist 一致。
- 触达：账号域 401/403 非探针全历史 0；非探针 `PATCH/DELETE mistakes` 只有 `PATCH 200 ×3`、非 2xx 0；`POST user_state` 非探针 0 → 两条都是可达未触发路径。
- 登记不改：成长三页不加监听（源码推断、无运行时用例）；`ask` 会话历史不按 uid 分键属产品决策；飞行中「403 先到、旧 uid 回包后到」竞态两页均未防（与 profile/stats 同）；`ask.loadDue()` 到期数不监听（页内无可撞 403 的写请求）。
- 如实：CDP 非真机；0 真实登录/退出/合并/错题写入/LLM 请求；改后 `expire_*` 未复跑；改前截图被改后同名覆盖，改前数值以 `~/r498_prod_inpage_*.out` 为准；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r498-home-book-auth-changed-clear-state-growth-plan-audit.md`；脚本/输出 `~/r498_expire.py <375|1440> <inpage_home|inpage_book|expire_home|expire_book>`（`R498_BASE` 可指本地 dist）、`~/r498_prod_*.out`（改前生产）`~/r498_local_*.out`（改后本地）`~/r498_prod_post_*.out`（改后生产）、`~/r498_post.sh`/`~/r498_post2.sh` → `~/r498_post.out`/`~/r498_post2.out`、`~/r498_mist.sh`、`~/r498_gates.log`/`~/r498_backend_gates.log`、`~/r498_deploy.log`。

### R499（2026-09-07）：「退出先落地、旧 uid 回包后到」飞行竞态 5 页只读核 + 问答页 `askSessions` 账号失效后跨账号语义设计论证——命中「个人页退出后飞行中的账号 `growth` 回包 → `180累计做题` 复现于匿名态」+「问答页退出后飞行中的账号 `ask/cur`/`ask/sessions` 回包 → 旧账号会话落到不分键的设备本地 storage 并被 `pushCurSession()` 以匿名 uid 回传远端」→ 最小修上线（生产 `cf95384` → `7c50b27`）；ask 产品语义 / 后端 `merge_anon` 不改

- **(c) / 到期项 0 增量**：R498 容器至发版 68 请求 / 新容器（15:22:02Z 起）34 请求，5xx/404/monitor/Traceback/mpUA 0、非探针 POST 0、WAL 同字节；唯一「非探针非 bot」`15:05:18Z GET / 403 redroid12_arm64` 直打源站无 Cf 头（R388 规则命中的模拟器扫描）；`*_ask_click` 真人 0 → `explain_cache.qid` 对账无样本；`explain_cache qid` 0/82、时政 qid 非空 0/0、`error_reason` ≥09-11 0、probe=0 `answer_log` 53/2、growth 26/4；nudge 真人 0；`push_subs` 0；登录/提醒分包、`logout` 非探针全历史 0；`umsacie7` 0 回访、`umst3` 无第二段；harness uid 落库 0 行。
- **5 页只读核**：profile/stats/home/book 的 `authChanged → resetAccountState()` 只清已到手字段、按新 uid 重拉，**对飞行中旧 uid 请求无 uid 比对/代次/abort**；ask 无监听且回包直接落 `askSessions`/`askCurSession` storage → 1.5 s 后 `pushCurSession()` 用发送时刻 `anonUid()` POST。后端 `owns_uid()` 挡不住「发出时 token 在、鉴权已过、响应后到」。忠实触发面 = 显式退出/换号（401/403 清态下同 token 兄弟请求同样 403，不会 200 后到）。
- **命中 A（runtime-confirmed 改前生产 375 `profile_race`）**：`growth?uid=账号` 挂起 → 退出 → 清态 `0/0/0` → 释放回包 → **`180累计做题 / 0错题本 / 0连续做题`**，reshow 才回 0。**命中 B（`ask_race`）**：`ask/cur`+`ask/sessions` 挂起 → 切「我的」退出 → 释放 → storage 落 `askCurSid 777001` / 1 条进行中 / 1 条历史，且 **`POST /api/ask/cur {uid:匿名, sid:777001, items:[账号 item]}`** 发出（harness abort）→ 切回问答页 `msgs 1` 账号态问题。这是账号数据经竞态跨身份外泄到远端，不是 R498 登记的「设备本地历史不分键」。
- **设计取舍**：不改 ask 产品语义（匿名 → 登录靠 `merge_anon` 归并、退出后本机仍见本机历史，无一手证据要求按账号隔离）、不逐页加请求代次（30+ 处）、不动后端合并；只在 `request()` GET 回包层加**身份守卫**一处覆盖 5 页 + 全部带 uid 的 GET。POST 不守卫（uid 发出时已定，服务端 `owns_uid()` 兜底）。
- **修（`7c50b27`，前端 5 文件 + 源锁 9 用例改前 9/9 红）**：`api-policy.js` `pathUid()/isStaleUidResponse()/isStaleUidErr()`；`api.js` `guardStaleUid()`：回包到达时 query `uid` ≠ storage `anonUid` → 抛 `{staleUid:true}`，在 `snapSave` 之前、文案不含网络字样（不走 `stale_fallback`）；显式 `timeout` GET 同守卫；`export { isStaleUidErr }`。home/book/stats catch 首行 `isStaleUidErr(e)` 静默 return（book 置 `loading=false`）；profile/ask 的 catch 本就静默。门 vitest 769 / eslint / build 绿；pytest 511 / ruff / `backend/` pyright 0。
- **发版 + 三点对照**：宿主 avail 5.5 G / load 0.34 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 `15:22:02.074Z` healthy 0 重启 `rev=7c50b27`；`index-Cx8gmCr9.js` + 五个分包线上=本机 md5；7/7 200；perf `/` 0.99 LCP 936 / `/tiku/` 1.00 LCP 956。生产改后 `profile_race` 375/1440 `after_release` **`0/0/0`**；`ask_race` 375 `after_release_storage` **全空、POST 0**、切回 `msgs 0`；`errs []`。
- 登记不改：ask 会话历史设备本地 + 远端按 uid 合并（等有真实账号用户再看是否按账号隔离）；POST 不守卫；401/403 清态场景无「旧 uid 200 后到」未造用例；`ask_race` 1440 未跑（守卫与视口无关）。
- 如实：CDP 非真机；0 真实登录/退出/合并/问答写入/LLM；生产 `logout` 全历史 0 → 修的是可达未触发路径；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r499-stale-uid-inflight-response-guard-ask-sessions-semantics.md`；脚本/输出 `~/r499_race.py <375|1440> <profile_race|ask_race>`（`R499_BASE` 可指本地 dist）、`~/r499_prod_*_race_375.out`（改前）`~/r499_prod_post_*_race_{375,1440}.out`（改后）、`~/r499_post.sh`/`~/r499_post_b.sh`/`~/r499_post2.sh` → 同名 `.out`、`~/r499_deploy.log`。

### R500（2026-09-07）：SOP-10 四维审计（R490–R499 登录/退出/清态簇收口 + R410 后未整页过审清单 0 页 + 非探针真实路径漏斗 + 对标粉笔公开面一手）→ 回到功能面选簇「卷库/真题卷」——命中「回忆版真题卷 69/221 缺模块（58 卷缺资料分析）而卷卡默认整卷齐全」→ 最小修上线（生产 `7c50b27` → `ccdbf58`）；否决批量补建国考/缺项卷

- **(c) / 到期项 0 增量**：R499 容器至发版 103 请求 / 新容器（16:01:18Z 起）43 请求，5xx/404/monitor/Traceback/mpUA 0、非探针 POST 0、WAL 同字节；非探针非 bot 3 = 两条 `GET / 403`（Host 源站域 `kaogong-origin.zalize.com`、无 Cf 头、`180.101.245.247` Chrome/87 → R388 源站直连扫描）+ 本机预检 `curl /api/health`；`*_ask_click` 真人 0、`explain_cache qid` 0/82、时政 qid 非空 0/0、`error_reason` ≥09-11 0、probe=0 `answer_log` 53/2、growth 26/4；nudge 真人 0；`push_subs` 0；登录/提醒分包、`logout` 非探针全历史 0；`umsacie7` 0 回访、`umst3` 无第二段。
- **四维复盘**：R490–R499 8 处修全部生产 verified、触发面全 0 → 簇收口（统筹者指令：回到功能面）；R410 后未整页过审页面 **0**（32 页 × `docs/iter/round-3/r4*.md` 逐页对账）；主循环三页 375/1440 读数无新命中（`searchbar`/`fontbtn` 为历轮登记）；probe=0 growth 26 行 10 种事件，`exam_attempts` 已交卷非探针 10 行全为内部账号/打标前匿名 uid → **可确认外部真人模考交卷 0**。
- **粉笔公开面一手**（未登录）：国考/省考分区 + 年份 + 地区成套真题卷（「共36套」），点卷即登录墙；内部作答/错题/复习未核。本产品 `zhenti` 120 卷仅 1 卷标题含国考（`source` 含国考 766 题分散 30 组）、卷卡不显示构成。
- **命中**：生产库只读复现 `_list_exam_papers_base()`：221 卷 13,341 活跃题，≥5 题卷 **五模块齐 152 / 缺项 69 / 无 module 0**；缺项 `缺资料 58 / 数量+资料 5 / 常识+资料 2 / 常识 2 / 言语+资料 1 / 数量 1`。`build_zhenti_papers.py --dry-run` 可补 16 卷（含国考地市级 3 张）**全缺资料** → 不批量补建、登记等题源。
- **修（`ccdbf58`，后端 1 + 前端 2 文件 + 源锁 pytest 5 / vitest 10）**：`_paper_module_counts()`，`/api/exam/papers` 每卷 `mods={module:n}`（只含 >0、`MODULE_ORDER` 顺序、只算活跃题、只认五模块）；卷卡 `.pmods` 24rpx 一行 `paperModsText()`「常识 19 · 言语 25 · 数量 9 · 判断 18 · 资料 4」/「… · 判断 21 · 缺资料」，无已知模块不渲染。**性能坑**：`module` 合进原 `SELECT id, source, is_real` 会让查询从 `COVERING INDEX idx_q_active_src` 退化为 rowid 回宽行表（R383 回归）→ 单独一趟 `SELECT id, module … disabled=0 AND id IN (…)` 走 `idx_q_disabled_module` 覆盖索引，生产库只读 24.8 ms + 50.9 ms。门 pytest 514 / ruff / pyright 0；vitest 775 / eslint / build 绿。
- **发版 + 三点对照**：宿主 avail 5.5 G / load 0.26 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 healthy 0 重启 `rev=ccdbf58`；`pkgA-exam-list.DuZhjzCa.js` 线上=本机 md5；7/7 200；perf `/` 0.99 LCP 941 / `/tiku/` 1.00 LCP 936。生产 API 120/120 带 `mods`、69 卷缺项、0.21–0.35 s；生产 bundle 375/1440 `.pmods` 120/120 渲染、69 含「缺」、独占整行、11.52/12 px、无溢出、`errs []`、非 GET 0。
- 登记不改：国考卷成套（等资料分析题源）；卷库无「国考/省考」分区维度（无一手用户证据）；`mods` 未接小程序端（W7 合 main 时可读）；2015 吉林 233 题需人工拆卷。
- 如实：CDP 非真机；0 真实模考/作答/账号/LLM；粉笔只核公开面；立项依据是「对外信息 vs 数据实况」而非用户反馈；无 testing agent 录屏（未另行授权）。
- 取证：`docs/iter/round-3/r500-sop10-audit-paper-module-composition-fenbi-benchmark.md`；脚本/输出 `~/r500_post.sh` → `~/r500_post{,2}.out`、`~/r500_scan.py` → `~/r500_scan_*.out`、`~/r500_fenbi*.py` + `~/r500_fenbi_*.png`、`~/r500_appq.sh`/`~/r500_bench*.sh`/`~/r500_guokao*.sh`/`~/r500_takers.sh` → 同名 `.out`、`~/r500_dryrun.out`、`~/r500_papers_ui.py <375|1440> [BASE]` → `~/r500_prod_papers_*.out` + `~/r500_papers_*.png`、`~/r500_papers_post.json`、`~/r500_deploy.log`。

### R501（2026-09-08）：R500 发版后 (c) 0 增量 + 真人模考漏斗全历史一手（11 → 1 → 0）+ 缺项卷在作答/报告/续考链路口径核 → 只读不改码，登记 3 项

- (c)：新容器 45 请求 5xx/404/monitor/Traceback/非探针 POST 0；WAL 同字节；到期项全部与 R500 同；卷库 `mods` 非探针触达 0。
- 漏斗（Caddy 全历史非探针）：`exam/papers` 11（全 `umst3`，四段巡览）→ `exam/start` **1**（paper 5 四川省考 70 min，8 s 答 3 题即离开）→ `submit`/`report` **0**；唯一 probe=0 attempt `#315` 超时后 `latest_exam_progress()` 服务端过滤 + 前端 `end_at_ms` 双保险 → 续考卡/成绩列表均干净。
- 缺项卷口径：`per_module` 服务端只含卷内出现的模块 → 报告页 `modules()`/`weakModule()`/配速/`insights` 全部 fail-closed，缺项不出「0/0」也不会被判薄弱；但报告页无「本卷不含 X」说明（登记）。
- 登记：报告页缺项说明 / 超时进度静默丢弃 / 模考侧无真人证据不加功能；下一处功能面回真人有量路径（练习→错题→复习）。
- 取证：`docs/iter/round-3/r501-exam-funnel-real-path-missing-module-report-semantics.md`；`~/r501_post.sh`→`~/r501_post.out`、`~/r501_funnel.sh`→`~/r501_funnel.out`、`~/r501_resume.sh`→`~/r501_resume.out`（VPS 上经 ssh 只读执行）。

### R502（2026-09-08）：真人有量路径「练习 → 错题 → 复习 → 再答对推进 SRS」全链路 DB + Caddy 只读对账 → 写入 1:1、SRS 答错分支字段级正确、答对分支生产 0 样本、断点在人不在码 → 不改码，登记 4 项

- (c)：R500 容器 69 请求 5xx/404/monitor/Traceback/非探针 POST/401·403 全 0；WAL 同字节；到期项全部与 R501 同。
- 写入对账（Caddy 非探针全历史 ↔ DB）：`POST answer_log` 55 ↔ 55 行、`POST mistakes` 36 ↔ 36 行、`POST review/1952` 1 ↔ `review_log #307 correct=0`、`PATCH mistakes` 3 ↔ `mastered=1` ×2 + `error_reason='纯蒙的'` ×1；无丢失无 4xx。
- SRS：唯一复习事件答错 → `review_count 1 / streak 0 / next_review = cn_day_start()+1d` 与 `_advance_review()` 一致；**答对推进**两条入口（`review/{mid}` 答对、R371 `answer_log` 命中错题）生产 0 样本，只有 `test_answer_advance_review.py` / `test_r438_srs_day_aligned.py` 锁定。
- 断点：到期 31/30，进错题本 68 次只开始过 1 次复习；作答节奏 1–4 s/题（10 题 20 s 的资料分析）= 巡览点击；`umst3` 同 uid 有 `probe=1` 行、`umsacie7` 09-07 出口 `141.11.46.189`（R475 内部 /24）→ 两 uid 疑内部设备，不构成外部真人证据，不据此立功能。
- 登记：时政错题 `question_id=NULL`（9/32）只能走复习页推进；15 条 R400 前旧快照 `correct_answer` ≠ 现题 `answer`（复习页只用快照，自洽）；答错自动追加同考点题样本 1；「到期 → 开始复习」转化低但无外部真人。
- 取证：`docs/iter/round-3/r502-real-path-practice-mistake-review-srs-chain-audit.md`；`~/r502_post.sh`→`~/r502_post.out`、`~/r502_srs.sh`→`~/r502_srs.out`、`~/r502_srs2.sh`→`~/r502_srs2.out`/`~/r502_srs3.out`（VPS 上经 ssh 只读执行）。

### R503（2026-09-08）：首页首屏「未登录冷启动、无任何数据」态 375/1440 一手对标粉笔公开面 → 命中「新用户错题复习被标『今日已清零 ✓』计入 1/3」→ 最小修上线（生产 `ccdbf58` → `34bd4d1`）

- (c)：R500 容器至发版 5xx/404/monitor/非探针 POST/401·403 全 0；WAL 同字节；到期项全部与 R502 同（`explain_cache` 真实列以 `key` 开头、无 `id`）。无新的外部真人作答/复习证据。
- 冷启动几何全过：375 首屏 landing（109–408）+ hero（418–557）+ 完整任务卡（567–780）+ 学习计划卡上沿；1440 到公告/时政卡；`docSW == cw`（360/1425）、`pageerror 0`、核心 GET 全 200；改前改后逐值相同。
- 命中（语义）：匿名新 uid `due_mistakes=0` 且从未有错题，任务卡渲染「✓ 错题复习 · 今日已清零」并计「今日任务 **1/3**」——模板只看 `planFetched && !dueReview`，服务端没有「是否有过错题」字段。
- 修：`daily_plan` 新增 `mistakes_total`（`_uid_clause` 隔离、含已掌握）；首页 computed `reviewTaskDone`（有到期 → false；`mistakes_total==0` → false；老快照无字段 → 旧口径），✓/done/`taskDoneN` 三处改走它，新用户副标题「答错的题自动进错题本」。改后生产 375/1440：「今日任务 0/3」，任务卡几何不变；`umst3`（32 错题 / 30 到期）仍走「今日到期 30 题」。
- 粉笔公开面：门户型（课程/题库/公告/职位表/日历/直播/APP），点题即登录墙；本产品「免注册打开即练」是差异化，不据此加功能。
- 门：pytest 516 / ruff / pyright 0；vitest 778 / eslint / build 绿。发版 `--skip-build` rc=0，容器 `16:46:42Z rev=34bd4d1` healthy，7/7 200，perf `/` 0.96 LCP 2290 / `/tiku/` 1.00。
- 登记：landing 三卖点 375 三行小字（无用户证据不动）；打卡行 1–2 天态未核；老壳/新服务端组合走 `t == null` 旧口径不受影响。
- 取证：`docs/iter/round-3/r503-home-cold-start-fresh-user-review-task-fenbi-benchmark.md`；`~/r503_post.sh`、`~/r503_claims.sh`→`~/r503_claims.out`、`~/r503_home_cold.py`→`~/r503_home_cold_{,post_}{375,1440}.out`+`.png`、`~/r503_fenbi_home.html`、`~/r503_deploy.log`。

### R504（2026-09-08）：首页「有数据态」hero / 任务卡 / 到期条 / 今日计划 与 DB 一手对账 375/1440 → 数值口径全部一致，命中「考试日期已过仍倒计『距考试 -1 天』」→ 最小修上线（生产 `34bd4d1` → `65580c6`）

- (c)：R503 容器至发版 / 新容器 5xx/404/monitor/非探针 POST/401·403 全 0；WAL 同字节；到期项全部不变（probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`push_subs` 0）。`mistakes_total` 非探针首次触达 **0**（非探针 `home_bundle` 35 次全在 R503 发版前）。无新的外部真人证据。
- 对账（`umst3` 只读 GET，0 写入）：DB 今日 0 题 / 累计 45 / 学习日 09-03·06·07 / mistakes 32·30·30 / profile 国考·2026-09-07 ↔ `home_bundle` `today_n 0 · streak 2 · due 30 · mistakes_total 32 · progress 0/4` ↔ 页面 `今日已练 0/20 · 连续打卡 2 天 · 今日任务 0/3 · 今日到期 30 题 · 再打卡 1 天解锁 3 天 · 0/4 · 国考` 逐值一致；375/1440 无溢出、GET 8/8 200。
- 命中：`plan_today.days_left = -1`（`exam_date` 已过）被模板原样渲染为「距考试 -1 天 · 冲刺期」，而同屏 `summary.days_to_exam` 对已过日期回 `None` —— 两口径不一致。修：新 `frontend-uni/src/plan-days-label.js` `planDaysLabel()`（>0 距考试 N 天 / 0 今天考试 / <0 「考试日期已过 · 点「编辑」更新」/ 非整数不渲染），`home.vue` 走 computed `planDaysText`；不改后端 `_days_left`/阶段。源锁 vitest 6。
- 门：vitest 784 / eslint / build 绿；pytest 516 / ruff / pyright 0。发版 `--skip-build` rc=0，容器 `17:02:40Z rev=65580c6` healthy，7/7 200，perf `/` 0.98 LCP 1414 / `/tiku/` 1.00。改后生产 375/1440 计划卡头「考试日期已过 · 点「编辑」更新」，其余读数与几何逐值同改前。
- 登记：服务端 `phase` 对已过日期仍 `chongci`；小程序端若显示 `days_left` 需同法（W7 合 main 顺带）；跨日界 `today.n` 双路径未造用例。
- PR #619 与 main 冲突（W5 设计系统 tokens）已合并解决 `b470b50`：4 组件取 token 字阶/语义色、保留本分支热区（`min-height 40px`/`flex-wrap`），SKILL 双方保留；六门全绿（vitest 804 / lint:tokens+eslint / build；pytest 516 / ruff / pyright 0）。
- 取证：`docs/iter/round-3/r504-home-data-state-hero-taskcard-db-reconcile.md`；`~/r504_post.sh`→`.out`、`~/r504_post2.sh`→`.out`、`~/r504_home_data.py`→`~/r504_home_data_{375,post_375,post_1440}.out`+`.png`、`~/r504_bundle_umst3tuisd7lgzaka.json`、`~/r504_deploy.log`。

### R505（2026-09-08）：首页「编辑」→ 学习计划设置表单 375/1440 只读整页审 → 命中「计划卡头说『考试日期已过 · 点「编辑」更新』，表单却把已过日期原样放行到生成」→ 最小修两次发版（生产 `65580c6` → `40e5ee0f` → `bf1807a6`）

- (c)：R504 容器 5xx/404/mpUA 0、非探针 POST 只有扫描器 `POST / 403`；817 条「非探针非 bot」全为 `34.186.44.79` 直打源站 `.env`/`.git/config` 扫描（403/404，0 条 <400）；1 条 monitor 是 R505a 发版 6b Lighthouse（探针网段，internal=1）。新容器 56 请求全 0。WAL 同字节；到期项全部不变；`mistakes_total` 非探针触达仍 0。无新的外部真人证据。生产 profile 已过/今天/未来 = 1/0/8（唯一已过 `umst3tui · 2026-09-07`）。
- 命中（改前生产 375/1440 runtime-confirmed，0 写入）：第 1 步日期框 `2026-09-07` 无提示、picker 初值 2026/09/07、「下一步」放行、第 3 步摘要仍带 `2026-09-07`，CTA 会 `POST /api/profile` 存回已过日期。
- 修：`plan-days-label.js` 新增 `cnTodayStr()`/`isExamDatePast()`/`examDateFieldText()`；`home.vue` 日期框「YYYY-MM-DD · 已过，请重选」+ `.past` 错误色、`setupNext()` 第 1 步拦截 + toast「考试日期已过，请重新选择」。不改后端/契约/生产库。源锁 vitest 7（+R504 import 正则放宽）。
- **R505a 未触发教训**：首版用浏览器本地日期 `fmtDateStr(Date.now())` 判今天，改后复验（harness 浏览器 UTC，17:2x Z 仍 09-07）表单照旧放行——与服务端东八区 `days_left` 不同口径。R505b 改 `cnTodayStr()` 后 375/1440：日期框「已过，请重选」红、下一步停 1/3 + toast、`docSW==cw`、errs []、非 GET 仅 `POST track`。
- 门：vitest 810→811 / lint-pages 0 error / build 绿；pytest 516 / ruff / pyright 0。发版两次 `--skip-build` rc=0（预检 5.1G/0.29、4.6G/0.38，兄弟构建 0）；R505a perf `/` a11y 0.94（R429 已知间歇），R505b `/` 0.98 a11y 1.00 LCP 1562 / `/tiku/` 1.00。
- 登记：后端 `/api/profile` 仍接受已过日期（小程序/直调可存回）；小程序端计划表单未核；picker `dateStart` 取 UTC 日期与 `cnTodayStr()` 在 16:00–24:00Z 差 1 天（只影响最早可选日）；monitor 中心内容无权限。
- 取证：`docs/iter/round-3/r505-home-plan-setup-expired-exam-date-form.md`；`~/r505_post.sh`→`.out`/`_post2.out`、`~/r505_scan.sh`→`.out`、`~/r505_setup_sheet.py`→`~/r505_setup_{375,1440}.out`（改前）/`~/r505_setup_post_{375,1440}.out`（R505b）、`~/r505_bad_probe.py`、`~/r505_deploy.log`/`~/r505b_deploy.log`。

### R506（2026-09-08）：学习计划表单第 2/3 步 + 「生成」后计划卡刷新链路 375/1440 只读审 → H5 全过（唯一读数：375 第 3 步标签折两行，main W5 表单迁移已解）；小程序端同形态源码核命中「首页『距考试 -1 天』+ 表单放行已过日期」→ 最小修（未发小程序）；H5 随本轮把已合入的 main 发版（生产 `bf1807a6` → `591bbd59`）

- (c)：R505b 容器 5xx/404/monitor/mpUA/非探针 POST/401·403 全 0、Traceback 0、WAL 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click` 真人 0、`push_subs` 0、harness uid 落库 0；`mistakes_total` 非探针触达仍 0。`user_profile` 9 行全默认值（目标 70×8/75×1、零基础×8、60 分钟×9、国考×9），已过/今天/未来 1/0/8——第 2/3 步在生产上从未被非探针用户改过。无新的外部真人证据。
- H5 审（`~/r506_setup_form.py`，探针头、注入 `anonUid=umst3tui…`、非 GET 全 abort、只 mock `POST /api/profile`）：第 2 步 `60+…80+`/`零基础·有基础·二战` 选中态、第 3 步 `30/60/90/120 分钟` + 副标题「决定每日任务量」+ 摘要五段、`上一步` 回退保留、再前进保留，375/1440 全过、`docSW==cw`、errs []。生产 `bf1807a6` 375 第 3 步标签「每日可用时长」折两行（label 63.7 px）——已合入本分支的 main W5 表单迁移（`set-kwrap` 纵排 + `kg-chip-row`）本地 dist 单行、CTA 36→44 → 不另改 H5，随发版上线；改后生产 375/1440 复跑：标签单行（kBox 84×20）、chip 单行、CTA 328/448×44、链路同前。
- 生成链路（受控，不是生产生成验证）：CTA → `POST /api/profile`（mock，body 七字段齐）→ 真实 `GET /api/plan/today?uid=…` 200 → sheet 关 → toast「学习计划已生成」→ 计划卡 `0/4` + 4 行 + focus 重绘、`homePlanCard=1`；非 GET 仅 `POST track`（abort）。picker CDP 拖动不触发 `change`（该次读数作废），改浏览器内存注入 `pf.exam_date`。
- 小程序（源码一手，运行时未核）：首页计划行/sheet 标题直接拼 `days_left`（会出「距考试 -1 天」）；表单第 1 步日期无已过标示、「下一步」放行。修：新 `utils/plan-label.ts`（`planDaysLabel`/`isExamDatePast`/`examDateFieldText`，今天用既有 `cnDayKey()` 东八区）+ `home.{ts,wxml,wxss}`（`daysText`/`daysTitle`/`pfDateText`/`pfDatePast`、`onSetupNext` 拦截 + toast、`.pf-date.past`）；源锁 vitest 4；native typecheck/lint 0 错。**不改**：`mistakes_total`（契约 + 三处口径，另簇）、`daily.ts logAttempts()`/`onDeepExplain` `_sz`、`login.ts` `mergeAnon` 空 catch（历轮已登记给 W7）。
- 门：vitest 812 / eslint / lint:tokens / build 绿；pytest 516 / ruff / pyright 0（`npx -y pyright`，`.venv` 无 pyright）；native typecheck/lint 0 错。发版 `--skip-build` 一次 rc=0（宿主 4.7 G / load 2.9 / mem_avail 309 MB——同机 `softcopyright:prod` 10 分钟前刚 build；首查 `df` 瞬时 2.9 G）；容器 `19:24:43Z rev=591bbd59` healthy；主 bundle 126→123 KB gzip；7/7 200；perf `/tiku/` 1.00 LCP 967；**`/` 0.78 LCP 5133 a11y 0.95**——本机复采 ×4 仍 0.79–0.83 / LCP 4315–4345 / a11y 0.95（R505b 0.98 / 1562 / 1.00）→ **真回归，来源是已合入的 main W5 首页**（LCP 元素换成首屏 `kg-banner__t` 公告横幅、须等 `GET /api/announcement`；`.searchbar-t` 改 `--ink-4` #b0b4c0 对比度 2.07:1），不是本分支改动；登记 R507 起点（对比度 1 行修 + R442 法同机 A/B 定 LCP 修法），详 R506 文档 §3.2。
- 登记：后端 `/api/profile` 仍接受已过日期；小程序 picker `start` 本地日期；小程序 `mistakes_total`/`_sz`/`mergeAnon`；生产 profile 全默认值——`target_score`/`daily_minutes` 分布是「表单被真人用过」的首个可读信号。
- 取证：`docs/iter/round-3/r506-home-plan-setup-step23-generate-chain-miniapp-parity.md`；`~/r506_post.sh`→`.out`、`~/r506_profiles.out`、`~/r506_setup_form.py`→`~/r506_setup_{375,1440}.out`（改前生产）/`~/r506_local_setup_{375,1440}.out`（本地合并后 dist）/`~/r506_setup_post_{375,1440}.out`（改后生产）、`~/r506_prod_step{2,3}_375.png`、`~/r506_prod_generated_{375,1440}.png`、`~/r506_local_step3_375.png`、`~/r506_deploy.log`。

### R507（2026-09-08）：R506 发版带上生产的 `/` Lighthouse 回归——同机交替 A/B/C/D 定因（LCP 主因 = W5 公告横幅「标题+正文拼接、等回包才绘」，不是组件小 chunk 数；a11y = `.searchbar-t --ink-4`）→ 两处最小修 + 公告占位等高 → 生产 `591bbd59` → `b0ed4c13`，复采 perf 0.96–0.98 / a11y 1.00×3 / LCP 1085–2319 / CLS 0.086

- (c)：R506 容器 + R507a 容器（145）+ 当前容器（50）5xx/404/mpUA/非探针 POST/401·403/Traceback 全 0、WAL 同字节；monitor 1 = 发版脚本 6b Lighthouse 自身（探针网段 moto g UA）；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、harness uid 落库 0；`mistakes_total` 非探针触达仍 0；profile 已过/今天/未来 1/0/8。无新的外部真人证据。
- A/B/C/D（`~/r507/ab.sh`，四个本机代理 `proxy.py`，`/api/**` 转发生产 GET；C 用 `STUB_ANN=1` 把 `/api/announcement` 置空）各 5 轮 ×2 组：A `bf1807a6` LCP 3.3–3.9 s（splash）、B HEAD 修前 5.6–6.2 s（元素 `kg-banner__t`）、C = B + 公告空 1.9–4.1 s（splash）、D 修后 1.8–4.1 s（splash）；B/C/D 均 28 JS / 18 CSS、A 18 / 7 → 公告横幅内容/时机是主因，chunk 数不是；W5 位置不动。
- 修（`b0ed4c13`）：`home.vue` 横幅 `:text="announce.title"` + 有正文时「详情」按钮 → `annOpen` 后 `.ann-body` 另起一行（`--ink-2`）；`.searchbar-t` 回 `--ink-3`；公告占位 `kg-skeleton preset="banner"`（`kg-skeleton.vue` 新预设 48 px 等高，替代 116 px 的 `lines`，CDP 量到 `.kg-sec.sec-h` top 回包前后 728→580 变 660→580，同机 CLS 0.148→0.105）。源锁 `tests/home-r507-lcp-announce-banner-contrast.test.js` 5 例；R467 源锁正则放宽允许 `:action-text/@action`。
- 门：vitest 816 / eslint（19 既有 warn）/ lint:tokens / lint-pages / build 绿；pytest 516 / ruff / pyright 0；native typecheck/lint 0；`git diff --check` 空。发版 `--skip-build` 两次各 rc=0（R507a dist D 19:55Z rev 标签仍 `51165654`——改动未提交时发的；R507b dist E 20:08Z `rev=b0ed4c13`）；bundle `index-Au2ZsSgt.js` 线上=本机；7/7 200；脚本 6b `/` 0.93 / LCP 2799 / a11y **0.94（R429 间歇）**；本机对生产 ×3：0.98/0.98/0.96、a11y 1.00×3、LCP 1422/1085/2319、CLS 0.086×3、`color-contrast` 过。生产 CDP 375/1440：横幅 `标题 190/558×19 · 详情 34×32 · ✕ 44×44`，正文初始不渲染，点详情后 `.ann-body` 328×83 / 696×46。
- 登记：剩余 CLS 主体 = 计划卡 `cards` 骨架 288 vs 实际 208/189 + Tabbar `::after` 0.061（预算 ≤0.1 已过，不动）；6b a11y 间歇 0.94 无 LHR 明细（可让脚本落 `--output-path`）；小程序端公告形态未核；均为本机采样非 RUM。
- 取证：`docs/iter/round-3/r507-home-lighthouse-regression-announce-lcp-searchbar-contrast-ab.md`；`~/r507_post.sh`/`~/r507b_post.sh`→`.out`、`~/r507/{ab.sh,ab.txt,ab2.txt,abE.sh,lhr2_*.json,lhr3_*.json,lhr_prodE_*.json,skel_h.py,skel_hE.py,shift_map.py,shift_map_prod.out,d_check2E.py,d_check2_prod.out}`、`~/r507b_deploy.log`。

### R508（2026-09-08）：首页学习计划卡占位等高——`cards` 骨架 288 vs 引导卡 208/189 / 任务卡 507 是态相关高差 → 新 `plan` 预设放同一 `kg-card` 内、按本地 `homePlanCard` 标记存的任务行数占位 → 生产 `b0ed4c13` → `77bd47b5`，CLS 0.086 → 0.061×3（剩余 = Tabbar `::after`）

- (c)：R507b 容器（354）+ 新容器（90）5xx/404/mpUA/非探针非 bot/非探针 POST/401·403/Traceback 全 0、WAL 同字节；monitor 各 1 = 两次发版 6b Lighthouse（`140.232.64.4` moto g）；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、harness uid 落库 0；`mistakes_total` 触达 0；公告「详情」非探针点击无样本（非探针请求 0，且展开不发请求）。无新的外部真人证据。
- 量（改前生产，CDP hold `/api/home_bundle` 前后量 `.kg-sec.sec-h` top）：匿名引导卡 375 −80 / 1440 −99；`umst3` 4 行任务卡无快照 +302（含到期条 83）。返回用户 24 h 内 `apiSnap` 即显不出骨架；骨架只在「首次（必引导）」与「标记在、快照过期」两种可预知场景出现。
- 修（`77bd47b5`）：`kg-skeleton.vue` 新预设 `plan`（`rows` 0 → 68+38+44；n → 80+19+14+62n+30；`cards` 不动，模块列表仍用）；`home.vue` 骨架包进 `<kg-card class="sec plan">`、`planSkelRows` 读标记；`plan-days-label.js` `planCardMark()` 把 `homePlanCard` 从 `'1'/''` 改存任务行数（旧 `'1'` 兼容）。源锁 `tests/home-r508-plan-skeleton-equal-height.test.js` 5 例，R507 预设数组断言改正则。
- 复验（本地 dist = 生产逐值）：匿名 375 位移 **0**（208/207.69）、1440 −19（`plan-s` 单行）；`umst3` 标记 4 + 清快照 509 vs 507.27，剩余 +81 全是到期条。`docSW==cw`、errs []、0 写入。门：vitest 821 / eslint / lint:tokens / lint-pages / build 绿；`git diff --check` 空（后端/native 未动）。发版 `--skip-build` rc=0（mem_avail 404 MB / 5.3 G / load 0.79）；`20:27:52Z rev=77bd47b5` healthy；7/7 200；6b `/` 0.91 / a11y 0.94（间歇）/ CLS 0.06；本机对生产 ×3 a11y 1.00×3、CLS 0.061×3、LCP 1874/2726/3695（FCP 同步抬升、请求拓扑同 R507 → 网络抖动）。
- 登记：到期条 83 px 同法可占位但等有量；1440 引导 −19 不加媒体查询；lighthouse 13.4.1 LHR 无 `largest-contentful-paint-element`（LCP 元素本轮未核）；非 RUM。
- 取证：`docs/iter/round-3/r508-home-plan-card-skeleton-equal-height-cls.md`；`~/r508_plan_skel.py`→`.out`、`~/r508_plan_geom.py`、`~/r508/r508_plan_skel_{F,prod}.py`→`.out`、`~/r508/lhr_prod_*.json`、`~/r508_pre.sh`/`~/r508_post.sh`→`.out`、`~/r508_mon.sh`、`~/r508_deploy.log`。

### R509（2026-09-08）：练习页首题冷启动 375/1440 一手量（直链 + 首页正常路径）→ 几何/位移全过（CLS 0×3、topbar 不动、`docSW==cw`）→ 命中 a11y「H5 `<uni-button>` 禁用态无 `aria-disabled`，『请选择答案』对辅助技术是可用按钮 + 1.29:1 计入 contrast」→ `kg-button` 一处显式 `aria-disabled` → 生产 `77bd47b5` → `e01e87be`

- (c)：R508 容器 5xx/404/mpUA/非探针非 bot/非探针 POST/401·403/Traceback 全 0、WAL 同字节；monitor 1 = R508 发版 6b；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0；公告「详情」/`mistakes_total` 非探针触达无样本（非探针请求 0）。无新的外部真人证据。
- 量（改前生产，CDP 探针头、匿名新 uid、非 GET 全 abort）：直链冷启动 375/1440 骨架 `.pskel` 195（lines 116 + 提示 19 + 返回 36）→ 首题 topbar [·,60] 44 / 题干 309×178.5（375）· 662×51（1440）/ 4 选项 / 底栏 69；「稍慢（3秒）」提示是 harness hold API 造的，服务端 `questions` 17–151 ms。首页→模块→sheet→「全部随机」：首页 0.3 s 预取题包、sheet 0.14 s、topbar 0.13–0.16 s、**不出骨架**；375×667 sheet body 384 可滚。解析卡需作答，未量。生产 Lighthouse ×3：CLS 0×3、a11y 0.96×3、`color-contrast` 3 项 = 顶栏/题目元信息模块标签「言语理解」（`#e11d48`/`#fce8ec` **4.00:1**）+ 禁用主按钮（白字 opacity .4 叠品牌色 1.29:1，DOM 无 `disabled`/`aria-disabled`/`role`）。
- 修（`e01e87be`）：`kg-button.vue` `<wd-button :aria-disabled="disabled || loading ? 'true' : null">`（可用态不落属性；`:disabled` 透传 + `onClick` 守卫不变）。源锁 `tests/practice-r509-button-aria-disabled.test.js` 3 例。门：vitest 824 / eslint / lint:tokens / lint-pages 0 error / build 绿；`diff --check` 空；后端/native 未动。
- 复验：本地 dist 与改后生产 375/1440 DOM `aria-disabled="true"`；生产 Lighthouse ×3 `color-contrast` 只剩两处模块标签、CLS 0×3、a11y 仍 0.96（axe 按审计项计分，1 项失败与 3 项同分——**不宣称达 1.00**）。发版 `--skip-build` rc=0（mem_avail 355 MB / 5.5 G / load 0.46）；`20:50:43Z rev=e01e87be` healthy；7/7 200；6b `/` 0.98 / a11y 1.00 / LCP 1679 / CLS 0.06，`/tiku/` 1.00。发版后 (c) 全 0（4 条「非探针」= 本机 curl 直打源站 403）。
- 登记：模块标签 4.00:1 是 7 模块 token 取舍，待设计论证；**直链冷启动 LCP 4.4–4.6 s（6 次中 5 次）而服务端 ≤151 ms → 客户端「主 bundle → practice 分包 → 挂载后才发 API」串行链，是 SEO `/tiku/q/*` CTA / 分享深链真人入口 → R510 起点**；解析卡首屏未量；骨架 195 vs 首题不等高但 CLS 0 不做；非 RUM。
- 取证：`docs/iter/round-3/r509-practice-first-question-cold-start-a11y-aria-disabled.md`；`~/r509_pre.sh`/`~/r509_post.sh`→`.out`、`~/r509_practice_cold.py`→`~/r509_practice_{375,1440}.out`、`~/r509_home_to_practice.py`→`~/r509_home2practice_*.out`、`~/r509_sheet_375.py`、`~/r509/lh_practice.sh`→`lh_practice.out`/`post/lh_practice_post.out`、`~/r509/dom_a11y.py`→`dom_a11y_yanyu.out`、`~/r509_qdur.out`、`~/r509_deploy.log`。

### R510（2026-09-08）：练习页直链冷启动客户端链一手拆解——R387 head 预加载**已覆盖** practice 分包（直链分包 ~240 ms 起、与主 bundle 并行，不串行；剩余可动项只有「API 在挂载前发」，无真人直链样本不改）；命中的是「首页 → 练习」运行期预取链（`precache.json` 字母序、`load` 后 8 s 才逐个拉）→ 清单前置 practice/book/入口路由依赖 + 8 s→3 s → 生产 `e01e87be` → `f5223d72`，首页停留 8–12 s 点进练习：practice 依赖走网 26–30 → 0、点击→首题 1.5–1.6 s → 0.92–0.96 s

- (c)：R509 容器 2074 请求，assets 404/mpUA/非探针非 bot/非探针 POST/monitor 全 0；**5xx 5 + Traceback 15 全为兄弟 W9 审计探针**（`kg-w9-audit-probe`，探针网段）用 20 位整数打 `year=`/路径 id → `OverflowError: Python int too large to convert to SQLite INTEGER` 500（登记：整数参数越界应 400/404，归 W9）；WAL +49 KB = 同探针 `POST /api/profile`×2（`test-w9-*`，`X-Kg-Probe: 1`）。probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、harness uid 落库 0；公告「详情」/`mistakes_total` 非探针触达无样本。无新的外部真人证据。
- 量：直链 7 次 `pages-practice-*.js` 211–247 → 1165–1211 ms、`index-*.js` 232–247 → 1637–1676、API 1788–1847 发出（主 bundle 完成 + ~140 ms 挂载）、topbar 2117–2188。首页停留 8/12 s 点进：分包点击后才走网（10.9/14.9 s 起）、依赖 30 个走网、点击→topbar 1.37 s。源码：`precache.js` `load`+8 s+idle、`gen-precache-manifest.mjs` 字母序（practice 第 90+ 位）。
- 修（`34f67d3a`，2 文件 + 1 测试）：`gen-precache-manifest.mjs` 复用 `route-preload.mjs` `parseRouteDeps`，`PRECACHE_FIRST_ROUTES`（practice/book/ENTRY_ROUTES）依赖前置、其余原序补齐（构建：144 项、前置 73）；`precache.js` `PRECACHE_DELAY_MS = 3000`；源锁 `tests/precache-r510-manifest-order.test.js` 4 例。不做 API 预取/布局/token。
- 本地同机 A/B（A=`e01e87be` dist，B=HEAD；`serve.py` immutable 静态 + 转发生产 GET；CDP Fetch 拦非 GET）：375 d=8 点击→topbar 1606/1645 → **884/895**、走网依赖 26/27 → 6（全为清单尾部非练习资源）；d=12 1542/1519 → 895/923；1440 d=8 1606 → 920；`assets_before_api`/`questions` 时序 A=B（3 s 未挤占首屏数据）。
- 门：vitest 117/828 / eslint / `lint:tokens` / build / `diff --check` 绿；后端/native 未动。发版 `--skip-build` rc=0（mem_avail 312 MB / 5.0 G / load 0.99）；`21:26:33Z rev=f5223d72` healthy 0 重启；7/7 200；6b `/` 0.98 / a11y 1.00 / LCP 1889，`/tiku/` 1.00。改后生产：375 d=8/12、1440 d=8 分包在 load+3 s（5.3–5.6 s）入缓存、点击→topbar **934/921/962**、practice 依赖走网 0；直链 topbar 2116（同改前，预期）。发版后 (c) 全 0、WAL 同字节。
- 方法教训（入 SKILL）：Playwright `page.route` 会禁用 HTTP 缓存，缓存实验必须改 CDP `Fetch` 域；直链与首页链分开量。
- 登记：直链 API 挂载前预发待真人直链样本；整数参数越界 500（W9）；3 s 未在真机弱网量；清单尾部 ~70 个资源仍在首页停留后逐个拉（省流/2g 跳过）；非 RUM。
- 取证：`docs/iter/round-3/r510-practice-deep-link-precache-waterfall.md`；`~/r510/{waterfall.py,serve.py,ab.sh,ab2.out,ab_1440.out,wf_375_direct.out,wf_direct2.out,wf_375_home_delay.out,prod_after_home.out,prod_after_2.out,lh/lh_practice_r510.out}`、`~/r510_pre.sh`/`~/r510_5xx.sh`/`~/r510_prof.sh`/`~/r510_post.sh`→`.out`、`~/r510_deploy.log`。

### R511（2026-09-08）：SOP-10 四维审计——R500–R510 三簇（首页 Lighthouse/CLS、练习页冷启动、计划表单）复盘均收口无新样本；命中 W9 登记的「整数参数越界 500」未被处置 → `OverflowError` 接入 `_bad_param_handler`（/api 400、`/tiku`·`/s/`·`/p/` 品牌 404）→ 生产 `f5223d72` → `0c532532`；首页 Lighthouse perf/LCP 双峰定性为 Lantern 模拟量法（观测值/拓扑不变），不是回归

- (c)：R510 容器 155 请求 5xx/404/monitor/mpUA/非探针非 bot/非探针 POST/401·403/Traceback 全 0、WAL 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0；公告「详情」/`mistakes_total` 非探针触达无样本；profile 11 行已过/今天/未来 1/0/10、非探针 `POST /api/profile` 全史 1 条。无新的外部真人证据。
- 命中（一手）：`origin` 无 W9 分支、main 无 `OverflowError` 处理；本地 `TestClient` 复现 `/api/question|questions?year|exam/papers?year|mock/events` 20 位整数 → 500，**公开页 `/tiku/q/<20 位>/` 也 500**（`/tiku/<20 位>/yanyu/` 已 404）。机制：pydantic `int` 任意精度放行，`sqlite3` 绑参才抛 `OverflowError`（`ArithmeticError` 子类，`ValueError/TypeError` 兜底不覆盖）。
- 修（`0c532532`，`backend/app/main.py`）：`_bad_param_handler` 加 `@app.exception_handler(OverflowError)`；/api 同 400 文案；`isinstance(exc, OverflowError)` 且 `/tiku`/`/s/`/`/p/` → `seo._not_found`；其余路径仍 `raise`。不逐端点加 `le=`。源锁 `tests/test_int_params_400.py` +6。门：pytest 522 / ruff / pyright 0；前端未动。
- 发版：`DEPLOY_FORCE=1 --skip-build` rc=0（mem_avail 404 MB / 5.0 G / load 0.57）——线上 `f5223d72` 是 R510 在旧分支的原提交、本分支为 cherry-pick `34f67d3a`（空树差），谱系闸假阳性；`21:42:01Z rev=0c532532` healthy 0 重启、7/7 200、`/tiku/` 1.00。生产复验：4 条 /api → 400 JSON、`/tiku/q/<20 位>/` → 301 → 404 `页面不存在_错题邦`、正常 id 200、Traceback 0。
- 双峰定性（`~/r511/lhr_root_*.json`）：perf 0.99/0.85/0.85、simLCP 1427/3686/3660，而 obsFCP 96/180/140、obsLoad 207–261、请求 83、FCP 前 48 个资源逐条相同、simTTI 同；唯一差异是 `index-*.js` 结束时刻在 obsFCP 之前/之后 → **推断** Lantern 按观测 FCP 裁剪依赖图。6b 单次 FAIL（本轮/R508/R506）不是页面回归；判回归先看 obs*/拓扑/FCP 前资源。是否让 6b 取中位数待定。
- 登记：`/api/profile` 仍收已过日期（R505）；直链 API 预发/真机弱网/清单尾部（R510）；模块标签 4.00:1；W7 小程序三项；非 RUM；无录屏。
- 取证：`docs/iter/round-3/r511-sop10-audit-int-overflow-400-lantern-bimodal.md`；`~/r511_pre.out`、`~/r511_post.out`、`~/r511_deploy.log`、`~/r511/lhr_root_{1,2,3}.json`。

### R512（2026-09-08）：错题本复习作答页 375/1440 只读整页审——命中「到期复习 294 题中 266（90%）联查题库，`_hydrate_mistake` 把 `question_text` 换成规范题干、选项进结构化 `options`，而复习卡只画 A–D 裸字母 → 真人到期复习不可据选项作答」→ `review-opts.js` fail-closed 纯函数 + 作答卡竖排铺出选项文本 + AI 详解预填带 options → 生产 `0c532532` → `8a4bc53e`

- (c)：R511 容器 179 请求 + R512 容器 45 请求 5xx/404/monitor/mpUA/非探针非 bot/非探针 POST/401·403/Traceback 全 0、WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；全史非探针 `POST /api/review/<id>` 仍只 09-06 那 1 条、`review_log` 自 09-07 起 0；公告「详情」/`mistakes_total` 触达无样本；`user_profile` 11→**9** 行（推断 W9 清了自己 2 行探针 profile，未求证）。无新的外部真人证据。
- 命中（一手，改前生产 `umst3` 30 题到期）：复习卡 Q1（资料分析 641 字）题干**无 A–D 行**、选项 4 个只画字母各 71.3×46 横排；Q2（定义判断 70 字）同；1440 同。`pageerror []`、`docSW==cw`。答后态/判词/下一题/同类题/AI 入口/进度重排（1/20→1/23）均正常。
- 修（`8a4bc53e`，前端 3 文件）：`src/review-opts.js` `reviewOptions(cur)` 只接受对象 + 单大写字母键 + 非空字符串值 + ≥2 项，否则回退 A–D（手录/时政/加练题不臆造选项）；`book.vue` `v-for="o in curOpts"` `.opt.full`（字母 + 文本、`aria-label` 带文本、仍 `pick(o.k)`，状态机不变）；`askPrefill(question_text, options)` 两处（此前传 `null`）。源锁 +12。门：vitest / eslint / lint:tokens / lint-pages / build:h5 绿；后端未动。
- 发版：`--skip-build` rc=0（mem_avail 398 MB / 5.9 G / load 0.41，谱系闸 OK）；`22:02:50Z rev=8a4bc53e` healthy 0 重启；7/7 200；6b `/` 0.93 / a11y 1.00 / LCP 2800 / CLS 0.06、`/tiku/` 1.00。改后生产 375：选项各 **309×44**（长选项 61.4 两行）竖排、文本 14px；1440 各 **726×44**；`docSW==cw`、errs []。
- **如实**：为量答后态 harness 点了一次选项 A 与「下一题」，`POST review/1953`、`review/cur`、`track ×2` 全在网络层 abort；`mistake 1953` `review_count 0 / next_review NULL` 未变、`umst3` 自 22:00Z `answer_log`/`growth_events`/`review_log` 新增 0。不是外部真人复习验证。
- 登记：多选复习卡无到期样本（只过源锁）；错因自评 chip 行 375 末项被裁（既有）；小程序端复习卡同形态未核（W7）；`/api/profile` 仍收已过日期（R505）；直链 API 预发/真机弱网（R510）；模块标签 4.00:1；6b 中位数策略待定；非 RUM；无录屏。
- 取证：`docs/iter/round-3/r512-book-review-card-options-text.md`；`~/r512_pre.out`、`~/r512_post.out`、`~/r512_deploy.log`、`~/r512/review_audit.py`、`~/r512/review_{375,1440}.out`（改前）、`~/r512/local_*.out`、`~/r512/post/prod_{375,1440}.out`（改后）+ 截图。

### R513（2026-09-08）：复习多选题作答卡 + 完成态 / 退出恢复态 375/1440 只读整页审——多选状态机（合成样本）与恢复链路（真数据）均正常不改；命中「375 复习卡 988 px 高、作答须下滚 ≥400，完成复习关闭庆祝后 `exitReview()` 不回页顶 → 头卡 top −613、到期状态/CTA 不可见」→ `exitReview()` 末尾 `uni.pageScrollTo(0)`（完成/手动退出同一出口）；生产 `8a4bc53e` → `10e2eb82`（PR #640 追加）

- (c)：R512 容器 5xx/404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0、WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`mistakes_total` 触达无样本；复习真人证据仍只 09-06 1 条。无新的外部真人证据。
- 多选：生产到期项 `len(correct_answer)>1` **0 道**（题库多选 13/156792）→ `GET /api/review` 在 CDP `Fetch` 层 stub 合成 1 道多选：pick/unpick/确认文案随选变/确认后 `ok|bad|ok|dim` 全对，375/1440 同；**合成非真人证据**。
- 恢复：`umst3` 真数据答到 Q2 刷新 → 恢复卡「第 2/23 题」→ 继续复习题干一致（True×2）；`reviewSnap` 18 KB。
- 命中：完成态 375 关闭庆祝后头卡 top −613（1440 视口够高 top 68 正常）。修 `book.vue` `exitReview()` +1 行；源锁 `tests/book-r513-exit-review-scroll-top.test.js` 2 例。改后生产 375 头卡 top **56** / CTA 140、`sheets=[]`、`resume=null`、errs []。
- 小程序源码核（W7）：`resetQ()` 按 `options[k]` 组 `rOpts[].text` + wxml `wx:if="{{item.text}}"` → **不是裸字母形态**；登记 ① native `exitReview()` 同样不回页顶 ② `celebrateN = rItems.length`（H5 排除 `_extra/_requeued`）。未在微信开发者工具跑。
- 门：vitest 119/836 / eslint / `lint:tokens` / lint-pages 0 error / build / `diff --check` 绿。发版 `--skip-build` rc=0（mem_avail 425 MB / 5.5 G / load 3.11），**compose 重建 21 min = BuildKit 层缓存再丢（pip 全量）**，R469 同形态；`22:24:01Z rev=10e2eb82` healthy 0 重启；7/7 200；6b `/` 0.93 / a11y 1.00 / LCP 2807 / CLS 0.06。
- 发版后 (c)：全 0；**非探针非 bot 48 行 = 48 IP × 1 次 `GET /tiku/q/*`**，`Accept-Language en-US` 统一、无 Referer、UA Chrome 107–136 轮换、无后续 assets/API、同 UA 集合全史只三簇（09-02/09-04/09-07 整点）→ 推断住宅代理分布式抓取，`access_log_report` 会计为候选真人（登记不改口径）。
- 登记：W7 两项；多选无生产样本；复习卡 988 px 长题干未做折叠/粘底（等真人数据）；候选真人启发式待样本；既有项不变。
- 取证：`docs/iter/round-3/r513-book-review-multi-complete-resume-scroll-top.md`；`~/r513/review_states.py`、`~/r513/{resume,complete,multi}_{375,1440}.out`、`~/r513/post/complete_{375,1440}.out`、`~/r513_pre.out`、`~/r513_post.out`、`~/r513_deploy.log`。

### R514（2026-09-08）：复习答错后「同类题自动加练」+「看讲解 / AI 详解」375/1440 只读整页审——答错链路（判词/讲解卡/加练提示/两个入口/进度重排）正常；命中 ① 加练卡 `options` 不透出 → R512 铺文本回退成 A–D 裸字母、选项拼在题干一行连排 ② `appendSimilar()` 从 `question_type` `split('-')` 反推 submodule 在生产恒为 null → 只按 module 抽，「定义判断」加练到「逻辑判断」→ 后端 `/api/review`·`/api/mistakes` 透出 `q.submodule` + 前端加练项保留结构化 `options`（fail-closed 回退）+ 三处改 `similarSubmodule(m)`；生产 `10e2eb82` → `2d75ba53`（PR #640 追加；分支已合 origin/main W9 #641 `cd8c734a`）

- (c)：R513 容器整窗 1240 请求 + R514 容器 262 请求 5xx/404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0、WAL 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针 0；复习真人证据仍只 09-06 1 条。`user_profile` 9→10：新行 `test-w10-a1`，边缘 0 条 `/api/profile` POST → 推断 W10 兄弟会话绕边缘直写（同 R512 11→9 形态），登记知会。无新的外部真人证据。
- 48 IP 簇：**不是 2 分钟突发，是 ≈15 行/分钟匀速持续抓取**，22:24:51Z 起到 23:06:18Z 仍在跑，604 行 = 604 IP、UA 14 种、每 IP 1 次、全 200、与其它请求 IP 交集 0；R514 发版未触发新簇（发版前已在跑、节奏不变）。`access_log_report.classify()` 会全部计为候选真人 → 日报 humans 将被灌水，口径剔除属设计变更，登记不改。
- 改前一手（`umst3` 到期题 2784 定义判断，`/api/review` 桩 1 道）：同类题请求 `questions?limit=2&module=panduan`（无 submodule）；加练卡 375 裸字母 `71.3×46`×4 / 1440 `175.5×46`，选项 `A.… B.…` 与题干连排一行。前置：到期联查 268/268 题库 `submodule` 非空且 `(module,submodule)` 活跃池 ≥3；`question_type` 与题库 `submodule` 存在不等值（盈亏问题→计算问题 / 概率问题→排列组合与概率 / 历史→历史人文），不能当筛选键。
- 修：`db.py` 两处 SQL `q.submodule AS q_submodule` + `_hydrate_mistake()` 透出；`review-similar.js` `similarItemFromQuestion()` 经 `reviewOptions()+reviewOptionsFull()` 校验保留 `options`（否则旧形态、不臆造）、`mistakeRecFromExtra()` 快照仍拼选项行、新增 `similarSubmodule()`；`book.vue` `appendSimilar/practiceSimilar/reinforceFromMistake` 改用（后者保留旧回退）。源锁 `backend/tests/test_r514_review_submodule.py`、`tests/review-similar.test.js`、`tests/book-r514-review-similar-submodule.test.js`。
- 门：pytest 532 / ruff / pyright 0；vitest 860（122 文件）/ eslint / `lint:tokens` / lint-pages 0 error / build:h5；`diff --check` 空。发版 `--skip-build` rc=0（mem_avail 348 MB / 5.0 G / load 1.36），compose 重建 1 min 49 s（层缓存在）；`23:02:39Z rev=2d75ba53` healthy 0 重启；7/7 200；6b `/` 0.91 / a11y 1.00 / **LCP 3057 FAIL（WARN）** = R511 Lantern 双峰高侧、首页 dist 未变 / CLS 0.06；`/tiku/` 1.00×3。
- 改后生产：`questions?…&module=panduan&submodule=定义判断`，加练/重排题全为定义判断；加练卡 375 `309×61.4`×4 竖排文本 / 1440 `726×44`；加练题答后点「看不懂？AI 详解本题 ›」→ 问答页预填 `optLines 4` + 答案 chip 预选 + toast「题目已填入…」，`POST ask/cur` abort、无 explain/stream；`docSW==cw`、errs []。本地 dist 同值。
- 如实：harness 用 Playwright `page.route`（本轮不量时序）；`POST review/*`·`track`·`mistakes` 本地 200 桩、其余非 GET abort；点了选项/下一题/AI 入口；`umst3` 自 R513 发版起四表新增 0、`mistake 1953` 未变。`redo*` 存储被 `ask.vue` 消费后为空是预期，判据看 textarea/`optLines`/`ansChipOn`。
- 登记：手录/时政题（options 非法，到期 28 道）加练走旧形态未量；加练 2 vs preset 3 口径差（既有）；小程序端自动加练是否同样只按 module 抽 + `rOpts` 带文本未核（W7）；604 IP 簇日报口径；W10 直写 profile 行。
- 取证：`docs/iter/round-3/r514-book-review-similar-auto-options-submodule.md`；`~/r514/wrong_path.py`、`~/r514/{wrong_375,wrong_1440}.out`（改前）、`~/r514/post/*.out|png`（改后）、`~/r514/local_*.out`、`~/r514_pre.out`、`~/r514_pre2.out`、`~/r514_post.out`、`~/r514_deploy.log`。

### R515（2026-09-08）：复习答错后「还不稳？练 3 道同类题巩固」→ 练习页 `practicePreset(submodule)` 375/1440 只读整页审 + 手录/时政（options 非法）加练卡旧形态一手——行测路径正常不改；命中「时政错题（`/api/shizheng/daily` 来源、题库无池）答错后同样露出同类题入口 → 练习页 `questions?module=时政` 空 →『该模块暂无题目』死路，且自动加练也空发」→ `hasSimilarPool(m)`（= `MODULE_KEYS` 五键，fail-closed）门控 CTA / `appendSimilar()` / 错题操作单三处；生产 `2d75ba53` → `22a38390`（PR #640 追加）

- (c)：R514 容器整窗 1366 请求 + R515 容器 238 请求 5xx/assets 404/mpUA/非探针 POST/Traceback 全 0、WAL 同字节；monitor 1 行探针；401/403 2 行 = 发版预检 `GET /api/health` 直打源站（R388 设计 403，探针网段）；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针 0。无新的外部真人证据。
- **更正 R514**：`user_profile` `test-w10-a1` `created_at` 实为 09-07 23:03:39Z（R514 错换算成 09-06），边缘同秒 `POST /api/profile 200 probe=1 140.232.64.5`（Δ 0.0 s）；本轮新增 `test-w10-b1` 23:30:11Z 同样对上 probe=1 POST → **W10 是经边缘带探针头写的，「绕边缘直写」推断撤回**。`mistakes` 各 module 增量同样来自 `test-w10-*` 探针 uid。`user_profile`/`mistakes` 无 `probe` 列仍需人工剔。
- 604 IP 簇：22:24:51Z → 23:38:44Z 连续 75 分钟无 >120 s 间断、14.8 行/分、累计 1110 行 / 1109 IP、UA 14 种、每 IP ≤2；`crawler-stats.json`（23:23Z）**已显示 humans.page 09-07 = 757 / humans.ips = 761**（前几天 ≤7/≤9）→ 日报 humans 已被灌水（验证，不是预测）；复算 page 1127 行里簇 1110、真人 IP 1121 里簇独占 1109。归因只有请求头/节奏特征；剔除口径待老板点头，不改。
- 改前一手：行测 2784 → CTA → `practicePreset {panduan, 定义判断, 3}` → `questions?limit=3&module=panduan&submodule=定义判断` → 练习页 `1/3`、3 题定义判断、完成态正常（375）。时政 2914（`question_id null / options null`）→ 同样露 CTA → `{时政, null, 3}` → `questions?limit=3&module=时政` → 「题目加载失败 / 该模块暂无题目」（375/1440）；`appendSimilar()` 也发 `limit=2&module=时政` 空回。DB：时政 27 行 / 8 uid 全到期、qid 全 NULL；题库活跃 module 无 `时政`。
- 修：`review-similar.js` `hasSimilarPool(m)`（import `MODULE_KEYS`）；`book.vue` computed `similarableReview` + CTA `v-if` + `appendSimilar()` 守卫 + 操作单 `if (hasSimilarPool(m))`；AI 详解入口对时政保留；源锁 `tests/book-r515-similar-pool-gate.test.js`，R514 源锁 import 断言改正则。门：vitest / eslint / lint:tokens / lint-pages 0 error / build:h5；`diff --check` 空。发版 `--skip-build` rc=0（mem_avail 279→318 MB / 5.0 G / load 0.95）；`23:33:44Z rev=22a38390` healthy 0 重启；7/7 200；6b `/` 0.93 / LCP 2795 / CLS 0.06、`/tiku/` 1.00。
- 改后生产：时政 375/1440 `SIM-BTN 0`、同类题 GET `[]`（自动加练也不发）、只剩 AI 入口、进度 1/2；行测 1440 preset 与改前同形态（CTA / preset / `limit=3&…&submodule=定义判断` / `1/3` / 完成态）；`inv`（桩 `options:null` 加练卡 3/4）：题干末 A–D 一行连排 + 裸字母 375 `71.3×46` / 1440 `175.5×46`、答后态正常、无 CTA、**不臆造选项**——fail-closed 预期。边缘：R515 容器 `module=时政` 请求 0（改前 4 条全 probe=1 harness）。
- 如实：本机 CDP；`GET /api/review` 桩 1 道真数据、`inv` 桩 `questions`；`POST review/*`·`track`·`mistakes` 本地 200 桩、其余非 GET abort；点了选项/下一题/CTA/练习页作答；`umst3` 自 R514 发版起四表新增 0、`mistake 1953/2784/2914` 未变。浏览器本地合成路径，不是真人证据。
- 登记：时政同类题若要有须走 `/api/shizheng/daily`（新功能，无样本不立项）；加练卡旧形态/加练 2 vs 练 3 口径差（既有）；小程序 `book.ts appendSimilar()` 仍 `!cur.module` 判池 + `split('-')` 反推（W7）；日报 humans 簇剔除口径；(c) 统计 401/403 先剔探针网段。
- 取证：`docs/iter/round-3/r515-book-similar-pool-gate-shizheng-cluster-humans.md`；`~/r515/preset_path.py`、`~/r515/{preset_375,sz_375,sz_1440}.out`（改前）、`~/r515/post/{sz_375,sz_1440,preset_1440,inv_375,inv_1440}.out|png`（改后）、`~/r515_pre{,2,3,4}.out`、`~/r515_post.out`、`~/r515_deploy.log`。

### R516（2026-09-08）：错题本列表「···」错题操作单 + 「同考点强化 5 道新题」`reinforceFromMistake` 落点 375/1440 只读整页审——命中 ① 时政/手录错题操作单标题与列表分组显「单选」（`tagName()` 把作答形式 `question_type='单选'` 当题型标签）② 后端 `reinforce_questions()` submodule 回退不带 module（同名二级题型跨模块 15 个、`submodule=?` 走 `idx_q_pick` 全扫 5.1 s）→ `ANSWER_FORMATS` 退回模块名 + 回退限同模块（`module=? AND submodule=?` 前缀 2.6 ms）；生产 `22a38390` → `94803e0b`（代码随 #640 合入 main `bd6514f6`；本节/取证/SKILL 在后续分支）

- (c)：R515 容器整窗 1177 + R516 容器 151 请求 assets 404/mpUA/monitor/非探针 POST/401·403/Traceback 全 0、WAL 同字节；**5xx 72 条 503 全在 00:28:10Z–00:29:25Z compose 重建窗**、全是簇的 `/tiku/q/*`（非探针，上游等 ~25 s），发版后 0；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针 0；`questions?module=时政` 0。无新的外部真人证据。
- 簇：09-07 UTC 终值 1437 行 / 1435 IP（22:24:51Z–23:59:58Z 无间断，15 行/分）；09-08 00:00–00:32Z 又 572/527（峰 97 = 重建窗排队重试），仍在跑；`crawler-stats.json` 00:23Z `humans.page 09-07 1444 / 09-08 250`、`humans.ips 1446 / 250`——管理台「候选真人」两日数字基本全是簇。剔除口径仍待点头不改。
- W10：`test-w10-*` 两行已不在（`user_profile` 10→9），边缘 09-07 `POST /api/profile` 4 条全 probe=1 → **推断**兄弟会话自清（未求证）。
- 改前一手（`umst3`）：操作单时政 2914 「**单选** · 更多操作」只「标为已掌握/删除/取消」（R515 门控生效、无 tag3 故无强化）；行测 2808/2784/1952 标题正确、7 项动作；「同考点强化」→ `practiceLaunch {reinforce, ziliao, 比重, ZL-JQ-04, 5}` → `questions?mode=reinforce&…&submodule=比重&tag3=ZL-JQ-04` → 「资料分析 1/2」正常。DB：同名 submodule 跨模块 15 个（逻辑判断 changshi/panduan/yanyu、定义判断 changshi/panduan、行程问题/经济利润 panduan/shuliang…），未掌握错题 143 条属此类，带 tag3 未掌握 260 条里 5 条会走 submodule 回退（`umst3` 比重 tag3 池 1）；`EXPLAIN submodule=?` = SCAN idx_q_pick（生产 5099 ms）vs `module=? AND submodule=?` = SEARCH（2.6 ms）；`mistakes.question_type='单选'` 只在时政 27 行。
- 修：`db.py` `reinforce_questions()` `sub_cond = ("module=? AND submodule=?", …) if module else ("submodule=?", …)`；`book.vue` `ANSWER_FORMATS=['单选','多选','判断','不定项']`、`tagName()` 为空或 ∈ 该表 → `modName(m.module)`（分组键/操作单标题同源）。源锁 `backend/tests/test_r516_reinforce_same_module.py`（同模块隔离 / 无 module 兼容 / EXPLAIN 必 SEARCH，旧逻辑跑过 FAIL）、`frontend-uni/tests/book-r516-tagname-answer-format.test.js`。门：pytest 535 / ruff / pyright 0 / vitest 867 / eslint / lint:tokens / lint-pages 0 error / build:h5 / `diff --check` 空。
- 发版如实：预检 load 10.78 / mem_avail 281 MB / 兄弟构建 0 → compose 600 s 未收敛 `DEPLOY_RC=1`（脚本按设计留后台）；宿主现场 load 14.8、**other_builds=2**、BuildKit 层缓存再丢（pip 126 s / COPY backend 106 s / 导出层 179 s）；`KG_COMPOSE_EXIT rc=0 00:29:15Z`、容器 `00:29:12Z rev=94803e0b` healthy → `DEPLOY_RESUME=1 --skip-build` 接续 4a–6 `RESUME_RC=0`：bundle 线上=本机、7/7 200、6b `/` 0.99 / LCP 1567 / CLS 0.06、`/tiku/` 1.00。重建窗 ~75 s 出 72 条 503（全簇，R457 形态，宿主 load 13 拉长）。
- 改后生产：375/1440 时政「**时政** · 更多操作」、动作不变（不给时政造强化）；比重 7 项不变；`reinf` 落点同改前；容器 `db.py:5270` 新条件在、生产 DB EXPLAIN SEARCH 前缀；`reinforce_log` 仍 2 行；`umst3` 四表新增 0、`mistake 1953/2784/2914` 未变；errs []、`docSW==cw`。
- 如实：本机 CDP；`reinforce` GET 网络层拦下改同参无副作用 GET（真端点写 `reinforce_log`）、`review/cur` 桩 null、非 GET 全 abort；点了操作单动作/练习页选项——浏览器本地路径非真人证据；后端回退修正生产只核源码 + EXPLAIN，未触发真 `reinforce`。
- 登记：日报 humans 剔簇口径；宿主级（兄弟构建并发 + 层缓存丢 + load >10 → 600 s 上限 / 重建窗 >1 min 5xx）；小程序 `book.ts` 标签/操作单标题是否同样把 `单选` 当题型 → W7；时政/手录不做同考点强化。
- 取证：`docs/iter/round-3/r516-book-sheet-reinforce-same-module-answer-format-label.md`；`~/r516/sheet_path.py`、`~/r516/{sheet_375,sheet_1440,reinf_375}.out`（改前）、`~/r516/post/*.out`（改后）、`~/r516_pre.out`、`~/r516_db{2,3,4}.out`、`~/r516_post.out`、`~/r516_5xx.out`、`~/r516_deploy.log`。

### R517（2026-09-08）：错题操作单「题目纠错」/「分享给队友」落点 + 错题展开详情 375/1440 只读整页审——两条写路径与详情态均按源码预期工作、**本轮 0 代码改动 / 0 部署**（生产仍 `94803e0b`）；登记 ① 纠错类型 chip 行 7 项 375 裁 3 / 1440 裁 2（无滚动条、仅渐隐；桌面竖向滚轮不横滚，需 Shift+滚轮/触控板）② 网络失败 toast 透原文 `request:fail`（`request()` 全站口径、119 处 `e.message` 直显、策略层按原文分类）③ 时政/手录 `question_id` NULL 无纠错/分享路径（fail-closed）④ 簇同签名扩到 `/tiku/papers/*`、`/tiku/y/*`

- (c)：R516 容器整窗（00:29:12Z→00:54:02Z，569 请求）assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；5xx 21 = 重建窗 72 条 503 落在容器启动后的尾段（审前后同值，0 新增）；WAL `4,173,592` 同字节；probe=0 各表与 R516 完全相同；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本。无新的外部真人证据。
- 簇：09-08 UTC 00:00→00:54Z 892 行 / 847 IP（16.2 行/分，仍在跑）；`crawler-stats.json` 仍 00:23Z 版本。**推断**：非簇「候选真人」3 行（`/tiku/y/2025/panduan/`、`/tiku/papers/75`、`/tiku/papers/89`）请求头签名与簇相同、只是路径不在 `/tiku/q/*`——簇扩到卷页/年份页，`sig()` 与日报口径都只按 `/tiku/q/` 会漏计。
- 一手（`umst3` 真数据，`~/r517/`）：比重 2808 操作单 7 项含「题目纠错 / 分享给队友」，时政 2914 3 项无此两项（展开态 footer 也无「纠错」）。纠错弹层 375 底部 375×348 / 1440 居中 480×340：7 chip（视觉 30、命中 `::after` 扩 `--hit-min`）、textarea placeholder「补充说明（选填，500 字以内）」+ `maxlength 500`（560→500）、「提交纠错」343×44 / 448×44 未选类型 `disabled`+`aria-disabled`+`pointer-events:none`（点它 0 请求）→ 选「答案错误」即可用 → 提交 `POST question_report {qid 246821, type, detail 500 字}` abort → toast「提交失败：request:fail」、弹层与内容留存可重试 → 关闭重开清空回 disabled。分享：`POST share/create` abort → toast「request:fail」；本地 200 桩（未发生产）→ 剪贴板「【比重】我刚做了一道题…/s/r517stub?v=a」（`shareVariant(umst3)=a`，`mod` 取 `d.submodule`）+ toast「分享链接已复制，发给队友吧」+ `track share_copy book_a` abort。展开详情 2808：343×874.6 / 696×583，4 选项竖排 309×40.3 / 662×20.1 带 `--ok/--bad`、「我选 C 答案 A」、历次作答 1 行、footer AI 详解/纠错/···、解析、社交条（写笔记/讨论/分享给队友各 40 高），只多发 `GET attempts/comments/count/notes`；时政 2914 `opts []`、无历次/社交/纠错。全部 `docSW==cw`、errs []。
- 登记（不改）：R517-1 chip 行可见性（`KgChipRow` 无 wrap 属性，COMPONENTS §1.3 定义为横滚行 → 交 UX 定「弹层内两行 wrap」还是「按频次重排」）；R517-2 `api.js request()` `fail` 透 `errMsg` 原文，`api-policy isNetMsg/trackRetryable`、`exam-policy submitFailPlan` 及其单测都按 `request:fail|timeout` 原文分类 → 只能在显示层加 `userFacingError(e)`，119 处接入属跨切面设计项；R517-3 时政/手录纠错落点另立项（与 R515 同原则不臆造）；R517-4 `question_reports.reason` 历史「答案有误/解析有误」≠ 当前「答案错误/解析错误」，管理台分组会分裂（不做兼容映射）；R517-5 簇扩路径 + 日报口径仍不改。
- 如实：本机 CDP `X-Kg-Probe: 1`；非 GET 全 abort（边缘非探针 POST `[]`）；`sharestub` 为浏览器本地 `route.fulfill`，生产 `shared_questions` 17 / `question_reports` 6 / `growth_events share_copy` 分布 / `umst3` 四表 / `mistake 1953/2784/2914` 审前后完全不变；`reportBusy`「提交中…」态因 abort 即回未量到；点了操作单/chip/提交/分享——浏览器本地路径，非真人证据。`141.11.46.189 umsacie7…` 09-07 11:56Z 那段是 R502 已入档设备，非新真人。
- 取证：`docs/iter/round-3/r517-book-report-share-detail-readonly-audit.md`；`~/r517/ops_path.py`、`~/r517/wheel_probe.py`、`~/r517/{report,share,sharestub,detail}_{375,1440}.out`、`~/r517/*.png`、`~/r517_pre.out`（00:42Z）、`~/r517_post.out`（00:54Z）、`~/r517_uid.out`。

### R518（2026-09-08）：错题展开详情社交条「写笔记」/「讨论」落点 375/1440 只读整页审——笔记（编辑/草稿/失败留存/本地桩成功·删除）与讨论页（空态/失败重试/排序/登录门/草稿/`focus=1`/无 qid fail-closed/假 token 登录态发布失败留存/收件箱）均按源码预期工作、**本轮 0 代码改动 / 0 部署**（生产已被兄弟会话换成 `de94fde`，社交/错题本源码与 `94803e0b` 相同）；登记 ① 登录态进讨论页 `GET /api/comments` 连发 2 次 ② 三处失败 toast 透 `request:fail`（=R517-2）③ 游客「抢首评」到 `focus=1` 无提示 ④ `question_comments` 17 行全 deleted、生产从未有真人评论/笔记 ⑤ 簇扩路径为涓流（≈0.6%）

- (c)：R516 容器整窗 + R518-fresh 容器（01:03:49Z→01:20Z，878 请求）assets 404/mpUA/非探针 POST/401·403/Traceback 全 0；monitor 4 行全探针网段；**5xx 5 条全在 01:03:47–51Z 兄弟会话（W10 #643）发版重建窗**，`GET practice/progress` / `POST answer_log` 502/503 来自 `140.232.64.5` 探针网段，无真人；WAL `4,173,592` 同字节；probe=0 各表与 R517 完全相同；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`questions?module=时政` 0。无新的外部真人证据。
- 簇：09-07 终值 1445 行 / 1443 IP；09-08 00:00→01:20Z 1282 行 / 1237 IP（15.8 行/分、峰 97 = R516 重建窗重试、UA 14、每 IP ≤2、200 ×1210 / 503 ×72）仍在跑；`crawler-stats.json` 仍 00:23Z 版，复算 09-08 候选真人 1282/1237 全是簇。`sig()` 扩到全 `/tiku/` 后：非 `/tiku/q/` 同签名行 09-07 8 / 09-08 8（`/tiku/papers/*`、`/tiku/y/*`、`/tiku/t/*`、`/tiku/panduan/*`），与 `/tiku/q` 簇 IP 交集 0——扩路径是涓流，主体仍是 `/tiku/q/*`。
- W10 痕迹（推断）：`user_profile` 9→11 `test-w10-*`（边缘 `POST /api/profile` 三条全 probe=1）、`shared_questions` 18→19（`test-w10-a` sid `jm7vpb24`，`share_copy` probe=1）——兄弟会话经边缘带探针头写入，两表无 `probe` 列需人工剔。
- 社交表/真人：`question_notes` 5 / `question_comments` 17（全 `status='deleted'`，R25/R28 测试残留）/ `comment_likes` 5 / `comment_reports` 0 / qid 246821 笔记评论 0/0 审前后不变；边缘 09-07 起非探针 `POST notes|comments|share|question_report` 0；唯一非探针讨论页访问 = R502 设备 `umsacie7` 09-07 11:56Z `GET comments?question_id=234494` 一次（空态即走）。
- 一手（`umst3` 2808 → qid 246821，`~/r518/`）：社交条 309×78 / 662×78 三链接 55/72.5/79 ×40 + 「抢首评 →」；写笔记编辑态 309×99 / 662×99、textarea `auto-height` 291×50 / 644×50 `maxlength 1000` 占位「记下这题的方法 / 陷阱，下次遇到随解析展示」、取消/保存 32×40；输入即写 `qNoteDraft:<qid>`，`POST notes` abort → `request:fail` + 编辑态/文本/LS 留存，取消/折叠/reload 后重开都恢复，清空即删键；本地 200 桩 → 「笔记已保存」→「📝 我的笔记：… 改」309×53.2 / LS 清 → 「改」多「删除笔记」56×40 → 桩 null → 「笔记已删除」回「写笔记」。讨论页：`.wrap` 375×505.8 / 1076×403.6，`.kg-two` 375 `column-reverse` / 1440 aside 320 + main 700，摘要卡 343×179.4 / 320×179.4，`kg-segment` 213×32 / 570×32、「消息」66×44，空态 343×74.8，输入条 375 `fixed` 375×93（ta 195×44 + 发布 104×44）/ 1440 `sticky` 700×94（ta 518×44）；游客占位「登录后参与讨论」+ 发布 `disabled/aria-disabled/pe:none`，点 textarea → modal「需要登录」300×175.8，取消后可输入、`dcDraft:<qid>` 即写、发布 0 请求再弹 modal、去登录返回草稿留、「最新」`sort=new`、「消息」modal；无 qid → 「链接缺少题目参数 / 去讨论广场」118×44 0 API → plaza；`dcfail` → 「加载失败：request:fail」+ 重试 → 放行重试回空态；`dclogged`（本地假 token）→ `focus=1` 0.5 s 聚焦、占位「说说你的解法 / 吐槽这道题…」、`POST comments` abort → `request:fail` + 草稿留、「消息」→ inbox。全部 `docSW==cw`、errs []。
- 登记（不改）：R518-1 `discuss.vue data.logged=false` → `onLoad load()` 后 `onShow` 见 token 翻转再 `load()`，登录态每次进入同参 `GET comments` ×2（后到覆盖、无可见异常）；修法候选 `data()` 里 `logged: !!getToken()` 一行 + 源锁，本轮无真人受影响证据（非探针登录态讨论页 0 次）且宿主 `MemAvailable 239 MB` / 兄弟刚发版，不为一行只读优化单独发版，**并入下一次含发版轮次**；R518-2 = R517-2 全站 `request:fail` 口径；R518-3 `onLoad` 只在 `getToken()` 为真时 `autoFocus`，游客「抢首评」落点无聚焦无 modal（有意静默，交 UX 定）；R518-4 生产从未有真人评论/笔记，`plaza`/`/tiku/discuss/` 为空态是事实非缺陷，不做运营性造数；R518-5 簇/日报口径不改。SKILL 旧条「`logged` 非响应式须 F5」已过时（`onShow` + `authChanged` 双路刷新），本轮改写。
- 如实：本机 CDP `X-Kg-Probe: 1`；非 GET 全 abort（边缘非探针 POST `[]`）；`notestub` 为本地 `route.fulfill`，生产 `question_notes` 仍 5、qid 246821 仍 0/0；`dclogged` 是本地假 token `r518-local-fake`、账号 GET 一并 abort，**不是真实登录用户证据**；`umst3` 四表自 R516 发版起新增 0、`mistake 1953/2784/2914` 不变；1440 未跑 reload 步、`dcfail` 只跑 375；点了写笔记/保存/删除/发布/排序/消息/抢首评——浏览器本地路径，非真人笔记/讨论证据。
- 取证：`docs/iter/round-3/r518-book-social-note-discuss-readonly-audit.md`；`~/r518/social_path.py`、`~/r518/{note,notestub,discuss,noqid}_{375,1440}.out`、`~/r518/dcfail_375.out`、`~/r518/dclogged_{375,1440}.out`、`~/r518/*.png`、`~/r518_pre.out`（01:04Z）、`~/r518_pre2.out`、`~/r518_post.out`（01:20Z）。

### R519（2026-09-08）：登记项 → 实修（统筹者指令：只读走查已够，把登记项转为实际修复）——R517-2/R518-2 uni `fail` 原文 `request:fail` 在 `api.js` 五处 `fail` 回调映射为中文（`netFailMessage`，分类/重试口径零变化）+ R518-1 `discuss.vue` `logged: !!getToken()` + `syncLogged()`（登录态进页 `GET comments` 1 次）+ R518-3 游客 `focus=1` 300 ms 后弹既有登录 modal 并保留 `_wantFocus`（无 focus 不弹）+ R517-1 `KgChipRow` opt-in `wrap`（默认横滚契约不变，仅纠错弹层用，7 类型两行全显）+ 追加 `guard_account_uid` JSON body 非字符串 uid → 400（生产 01:30Z 5 条 TypeError Traceback）；生产 `de94fde` → `03f7d826`；PR #650 已合 main `6cec81dd`（兄弟同修法 #649 自行关闭为重复）
- (c)：R518-fresh 容器整窗（01:03:49Z→01:58Z，1653 请求）5xx 8 = 重建窗 3 条 503（R518 已归因）+ **5 条 500 = 01:30:29–49Z `POST mistakes ×3 / answer_log / team/create`**（`140.232.64.5` 探针网段 = 兄弟 W10 畸形参数矩阵，容器 5 条 Traceback `TypeError: expected string or bytes-like object, got 'list'|'int'|'dict'`，本轮已修）；R519 容器（01:58:41Z→02:05Z）5xx / assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；WAL `4,173,592` 同字节；probe=0 各表与 R518 相同；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`questions?module=时政` 0；`user_profile` 11→9 / `shared_questions` 19→17（`test-w10-*` 已被兄弟清理）。无新的外部真人证据。
- 簇：09-07 终值 1445/1443 不变；09-08 至 02:05Z 1972 行 / 1927 IP（15.8 行/分、UA 14、每 IP ≤2）仍在跑；`crawler-stats.json` 01:23Z `humans.page 09-08 1234 / ips 1189` 与复算一致 = 基本全簇。R519 发版重建窗 0 条 5xx（compose ~4 min 收敛未触顶）。
- 改后生产一手（`~/r519/post/`，375/1440 全对上）：`netfail` 空态「加载失败：网络错误，请检查网络后重试」+ 重试可恢复；`dclogged`（本地假 token）`nCommentsGET 1`、`focus=1` 聚焦、发布 abort → toast「网络错误，请检查网络后重试」；`dcguest` `focus=1` → modal「需要登录 / … / 取消·去登录」、取消留页、无 focus 不弹、去登录到 `#/pkgA/user/login`；`report` 纠错弹层 `kg-chips--wrap` 7/7 全显两行（375 弹层 375×386、1440 480×378）、未选 disabled、选「其他」→ `POST question_report` abort → toast「提交失败：网络错误，请检查网络后重试」；后端容器内直打 `{uid:1}/["u1"]/{u:1}/true` × `answer_log|mistakes|team/create` 全 400 `uid 格式错误`、Traceback 0。
- 发版：预检 mem_avail 269 MB / 5.1 G / load 1.72 / 兄弟构建 0；容器 `01:58:41Z rev=03f7d826` healthy 0 重启、`KG_COMPOSE_EXIT rc=0`；bundle 线上=本机 `index-DydCjYD3.js` gzip 123 KB；6b `/` 0.99 / a11y 1.00 / LCP 1747 / CLS 0.06、`/tiku/` 1.00；`DEPLOY_RC=0`。
- 门：vitest 128 文件 / 885、eslint、lint:tokens、lint-pages 0 error、build:h5；pytest 557、ruff、pyright 0；`diff --check` 空。源锁 `api-r519-net-fail-message` / `discuss-r519-logged-init-focus-gate` / `chip-row-r519-wrap` + `test_guard_account_uid` 追加 2 例。
- 如实：本机 CDP `X-Kg-Probe: 1`；非 GET 全 abort；`dclogged` 是本地假 token **不是真实登录用户证据**；后端 400 复测为容器内直打、被中间件拦下 0 写入；`umst3` 四表新增 0（32/45/22/1）、`mistake 1953/2784/2914`、`question_reports` 6、qid 246821 笔记评论 0/0 不变；`reportBusy` 态未量到；脚本 `selected` 判据（`--on` 类名）过窄回 `[]`，以 POST body `type:"其他"` 为准。
- 取证：`docs/iter/round-3/r519-registered-fixes-netfail-discuss-chiprow-uid-guard.md`；`~/r519/post_path.py`、`~/r519/post/{netfail,dclogged,dcguest,report}_{375,1440}.out`、`~/r519/post/*.png`、`~/r519_pre.out`（01:50Z）、`~/r519_post.out`（02:05Z）、`~/r519_deploy.log`、`~/r519_pytest.log`。
- 下一步 R520：按四维（操作台/核心功能/落地页首页 UI/架构）对标粉笔错题本/夸克，先一手核对方公开面 + 本站现状再定 P0/P1 项 → 设计论证 → 实现 → 发版 → 复采。

### R520 / R520b / R520c（2026-09-08）：四维对标粉笔错题本/夸克（只用 App Store 公开描述一手，不臆造对方「导出/打印」等功能；拍照/OCR 不立项）→ 首批 P0/P1 实修——R520 错题本批量条「重练所选」「导出所选」+ 排序「最早」+ `/api/mistakes/redo mids=`（uid 隔离 / `mastered=0` / 去重保序 / 空·非法·>25 → 400）；R520b（R520 复采命中 P0）a11y 弹层栈 z-index 基准 99 → 运行时读 `--z-overlay`（KgSheet 底栏打开的导出确认层此前 `maskZ 100 < popZ 1000` 不可点）；R520c（R520b 复采命中）H5 原生 `fetch()`/SSE `reader.read()` 英文 TypeError（「Failed to fetch」）经 `fetchNet`/`readNet` 落 R519 中文口径（四处 fetch + 三处 read，HTTP 非 2xx / SSE `error` / 分类口径不动）+ 复采再命中问答页横幅双「请重试」→ `api-policy.failBannerText`（`/再试|重试/` 不追加）；生产 `03f7d826` → `0bf2865b` → `e0b9c919` → `36ed9af1` → `c23ef35f`；PR #652 / #654 已合 main，#655 含 `c23ef35f` + 本节
- 改后生产一手（375/1440 全对上，`umst3` 只读数据）：`~/r520/post/{batch,done,sort}_*.out`（重练所选 `GET redo?limit=25&mids=2808,2784` → 练习页 1/2；导出所选「错题本 · 已选 / 2 题」；`sort=old` 前三 = API `created_at` 升序）；`~/r520/post/stackpost_{book,home}_*.out`（`maskZ 1001 / popZ 1000`，✕/确认/范围行 `hitInside=true`）；`~/r520c/post/{book,home}_*.out`（「导出失败：网络错误，请检查网络后重试」）；`~/r520c/post2/ask_*.out`（横幅「失败：网络错误，请检查网络后重试」单次、sheet/textarea 留存可重试；`post/ask_*.out` 是改前双「请重试」）；`~/r520c/post2/{book,home}_*.out` 导出回归不变。全部 errs []、非 GET 全 abort。
- (c)：R520c2 容器窗（03:22:34Z→03:25Z）5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；四次发版重建窗 0 条 5xx；WAL `4,173,592` 同字节；probe=0 各表与 R519 同；`umst3` 四表 32/45/22/1 新增 0、`mistake 1953/2784/2914` 不变；`shared_questions` 17→18（`#42 from_uid=test-w12-mp 03:11:42Z`）/ `user_profile` 9→11（`test-w12-ux-a/b`）边缘同刻 POST 均 probe=1 → **推断**兄弟 W12 生产回归造数（未求证，两表无 probe 列需人工剔）。无新的外部真人证据。
- 簇：09-07 终值 1445/1443；09-08 至 03:25Z 3127 行 / 3077 IP（15.2 行/分、UA 14、每 IP ≤2、503 ×72 = R516 重建窗旧账）仍在跑；日报 03:23Z `humans.page 09-08 3025 / ips 2975` 基本全簇。口径不改。
- 发版：四次均 `DEPLOY_RC=0`、bundle 线上=本机、healthy 0 重启、未触 600 s；R520 6b `/` a11y **0.94 WARN 一次**（R429 形态，后三次 1.00）；R520b 预检见 `other_builds=1` 让行等待 8 轮至 0（mem 262→473 MB）后 compose 02:54:27→02:55:49Z 收敛；R520c 6b `/` **perf 0.85 / LCP 3576 WARN 一次**（单次采样，R520c2 同页 0.99 / 1555 过）；R520c2 `index-BhqML2JL.js` `/` 0.99 / a11y 1.00 / LCP 1555 / CLS 0.06、`/tiku/` 1.00。本机无 brotli → 1b 跳过。
- 门：vitest 133 文件 / 914、eslint、lint:tokens、lint-pages 0 error、build:h5、`diff --check` 空；后端 pytest 565 / ruff / pyright 0（R520 后端改动，`c23ef35f` 上重跑）。源锁 `test_r520_redo_mids` / `book-r520-batch-redo-export-sort` / `modal-stack-r520b-overlay-tier` / `api-r520c-h5-fetch-net-fail`（含 `failBannerText` 与 `ask.vue errorText` 源结构锁）。
- 如实：本机 CDP `X-Kg-Probe: 1`；abort `POST export/pdf` **只证明 UI 到达处理函数与失败态可见，不证明生产生成过 PDF**；`GET review/cur` 本地桩 null；问答页失败为 abort 造的网络层失败、未触发 LLM、`explain_cache` 不变；SSE 中途断流（`readNet`）与面试两条流只有源锁/单测、生产未复现；「重练所选」到练习页未提交作答；点了批量条/排序/导出/讲解——浏览器本地路径，非真人证据。
- 登记：R520-1 夸克拍照/OCR、粉笔直播/预测分不立项（无诉求一手、超范围）；R520-2 跨页全选重做未做；R520-3 新增原生 `fetch` 必走 `fetchNet`（源锁拦 `await fetch(BASE_URL`）；R520-4 断流路径生产未复现；R520-5 兄弟 W12 造数建议先本地；R520-6 Lighthouse 单次抖动、6b 取样策略仍待定。
- 取证：`docs/iter/round-3/r520-book-batch-redo-export-overlay-tier-h5-fetch-netfail.md`；`~/r520/{post_path,stack_probe,stack_post,stack_home,local_stack_probe}.py`、`~/r520c/{netfail_post,ask_netfail}{,2}.py`、`~/r520b_pre.out`、`~/r520c_post.out`、`~/r520_deploy.log` / `~/r520b_deploy.log` / `~/r520c_deploy.log` / `~/r520c2_deploy.log`。
- 下一步 R521（SOP-10 四维审计）：R490–R520 复盘 + 复采本轮四次发版后 (c)；继续四维对标（下一候选：错题本「按知识点/错因聚合视图」与「导出所选」真下载链路的真人首条观察；练习页作答后「加入错题本」反馈态）——先一手核再定。

### R521（2026-09-08）：SOP-10 四维审计（R490–R520 复盘 + 四次发版后 (c) 补量）→ 三条候选（聚合视图 / 批量导出重练 / 「加入错题本」反馈态）源码一手核均已存在不重做 → 生产库只读命中 P1：时政错题 `mistakes.question_id IS NULL`（写入侧有意置空防与题库 id 撞号）在 `mistakes_redo_questions()` 回不到 `questions` 即 `continue` → 「错题重练」（`module=时政` 与 R520 `mids=`）静默丢时政题（28 行 NULL-qid 中 27 行题干首行可精确命中 `shizheng_questions`）→ 按题干首行回 `shizheng_questions`（同 `shizheng_daily` 形态 + `_sz` + 保留 `mistake_id`，命不中的手录题仍跳过不臆造；普通题/`mastered=0`/uid 隔离/`mids` 契约零变化）+ 小程序练习页 `toPQ()` `id: q._sz ? null : q.id` 守卫（后端开始返回 `_sz` 题后 redoSet 首次会拿到时政题，防写 `question_id`/`answer_log.qid`/挂社交）；生产 `c23ef35f` → `2e608c0c`（03:45:59Z）；分支 `r521-deploy`（基于已合 main 的 R520c）
- 为什么不回填 `question_id`：`shizheng_questions.id` 与 `questions.id` 两表独立自增（时政 118 ≠ 题库 118），R483/R484 核过 `shared_answers/pk/explain_cache/question_report/review_log` 全按 `question_id` JOIN `questions`，回填会污染社交/统计/纠错域；正确做法是保留 NULL、重练侧按题干回源。
- 改后生产一手（375/1440，`umst3` 只读数据，`~/r521/redo_sz.py`）：错题本点可见 chip「时政」（`?mod=时政` 不生效——`parseBookOpts()` 只认内部模块 key）→「错题重练」→ `GET redo?limit=10&module=时政` 200 **9 条全 `_sz:true`**（`id 118 / mistake_id 2914 …`）→ 练习页「刷题 时政 1/9」题干 + 4 选项；errs []、仅 `POST track` abort。截图 `~/r521/redo_sz_post_{375,1440}.png`。
- (c)：新容器窗（03:45:59Z→03:48Z，79 请求）5xx/assets 404/monitor/mpUA/非探针 POST/Traceback 全 0，401/403 仅探针网段 `GET /api/health` 403 1 条；重建窗 0 条 5xx；WAL `4,173,592` 同字节；probe=0 各表同 R520c；`umst3` 四表 32/45/22/1 新增 0、`mistake 1953/2784/2914` 不变；`shared_questions` 18 / `user_profile` 11 不变。无新的外部真人证据。
- 簇：09-07 终值 1445/1443；09-08 至 03:48Z 3487 行 / 3437 IP（15.2 行/分、UA 14、每 IP ≤2、503 ×72 旧账）仍在跑；日报 03:23Z `humans.page 09-08 3025` 基本全簇。口径不改。
- 发版：预检 mem 296 MB / load 0.38 / 兄弟构建 0；compose 79 s 收敛、healthy 0 重启；bundle `index-BhqML2JL.js` 线上=本机（前端未改）；`DEPLOY_RC=0`。门：pytest 568（+3 `test_r521_redo_shizheng`）/ ruff / `npx -y pyright app` 0；前端五门绿（无改动重跑）；小程序 `tsc`/eslint/lint-pages 0 error；`diff --check` 空。
- 如实：生产库 `mode=ro` 只读、0 写入/迁移/回填；改前 UI 探针只截到筛选态（脚本首版未接 `expect_response`），改前「丢时政题」由库查询 + 旧基线 worktree（`c23ef35f` + 新用例 3 failed）证明；混合 `mids`/手录题跳过只有源锁；练习页未提交作答、`mistake_id` 回写与 `answer_log qid null` 路径只有源锁；小程序未在开发者工具跑；非真人证据。
- 登记：R521-1 手录题重练仍跳过但无「N 题无法重练」提示（UX 定）；R521-2 时政题作答落库路径待真人/复采；R521-3 小程序 `_sz` 守卫未真机；R521-4 簇/宿主/证书/6b 照旧待定。
- 取证：`docs/iter/round-3/r521-redo-shizheng-null-qid-recover.md`；`~/r521_db{1..4}.sh`（宿主只读）、`~/r521_pre.out` / `~/r521_post.out` / `~/r521_deploy.log`、`~/r521/gate_backend.out`。
- 下一步 R522：R521 发版后 (c) 补量 + 到期项/簇；回真人主循环：练习页时政题（`_sz`，来自重练）作答后 `mistakes` 回写 / `answer_log qid null` / 完成页「错题已自动加入错题本」一手（本地起服务 + 生产只读对账，不向生产提交）；四维下一候选先一手核（错因聚合无数据不立项；复习完成态回错题本刷新）。

### R522（2026-09-08）：R521 发版后 (c) 补量 + 时政错题（`_sz`，来自重练）作答闭环一手（本地起服务 + 生产只读对账）+ 四维候选 A/B 一手核 → **不改码、0 部署、0 写入**；PR #657 已合入 main（`2b7d045e`）
- 本地一手（`~/r522/local_sz_answer.py`，`DB_PATH=~/r522/app.db`，种子 `shizheng_questions` 1 行 + `mistakes` NULL-qid 1 行，uid `r522local`）：错题本「错题重练」→ `GET redo` 回 `{"id":141,"mistake_id":2,"_sz":true,"answer":"C"}` → 练习页渲染 → 选错 → `POST answer_log {qid:null, mid:2, correct:false}` 200 `{"saved":1}` + `POST mistakes {question_id:null, module:时政, question_type:单选, question_text 首行=原题干, explanation 尾【出处】}` 200 → 完成页 hero「答对 0/1 · 最高连对 0 题，**错题已自动加入错题本**」→ 库 `mistakes.question_id NULL`、`times 1→2`、`answer_log.question_id NULL`、`questions` 0 新行，且本地 `questions.id 141`（行测题）与 `shizheng_questions.id 141`（本题）撞号互不串。1440 选对：`{"reviewed":[{"mistake_id":2,"streak":2}]}`（R371 归一推进），不发 `POST mistakes`、hero 无「已加入」。
- 生产只读对账（`~/r522/prod_sz_answer_abort.py 375`，`umst3`，非 GET 全 abort）：重练首题 `id 118 / mistake_id 2914` 选错 → 客户端发 `POST answer_log {qid:null, mid:2914}` + `POST mistakes {question_id:null, …}`（与本地形态逐字段一致）全 abort；abort 后 UI 仍显示「已自动存入错题本」且入 `offlineQueue`（一次性 context 丢弃）——**该文案≠落库**。审后 `umst3` 32/45/22/1、`mistake 2914` 不变；R521 发版后任意 uid `answer_log`/`mistakes`/`review_log` 新写 0 → 尚无真人走过时政重练作答。
- 候选 A（按错因聚合）：`error_reason` 非空全库 7 行 / 4 uid，候选真人集 4 行 / 2 uid，最新 09-06；**不立项**。候选 B（复习完成态回错题本刷新）：源码 `nextReview()`→`exitReview()`→`load()` 在 celebrate 之前重拉 `GET mistakes + GET review`；本地一手 sheet 打开时身后已是「0 题 今日待复习 / 15 天后复习」，关闭后同态；**无陈旧态、不立项**。
- (c)：R521 容器窗（03:45:59Z→04:07Z，385 请求）5xx/assets 404/monitor/mpUA/非探针 POST/Traceback 全 0；WAL `4,173,592`；probe=0 各表同 R521；`user_profile` 11→9（`test-w10-*` 已清）。簇 09-08 至 04:07Z 3792/3738 仍在跑。无新的外部真人证据。
- 登记：R522-1 完成页「仍错的已重置复习，**明天**优先再练」（`practice.vue:235`）vs `save_mistake()` 重复命中 `next_review=time.time()` 立即到期（错题本显示「今日待复习」）——文案偏差 P3，候选一行「今天起优先再练」并入下一次含发版轮次；R521-1/R521-3 照旧。
- 如实：本地 POST/落库只在本地成立；生产只抓请求体、0 写入；`r522local` 行为多次合成累积；`umst3` 09-06 时政 `answer_log` 10 行 probe=0 的成因未核；无 testing agent 录屏。
- 取证：`docs/iter/round-3/r522-sz-answer-loop-local-prod-readonly.md`；`~/r522/*.out|*.png`、`~/r522_db.sh`/`~/r522_db.out`、`~/r522_pre.out`。
- 下一步 R523：(c) 补量 + 到期项/簇；四维下一候选先一手核：练习页「错题重练效果」块与 R371 `reviewed` 回包的口径（已纠正/仍错/达成掌握是否用服务端结果）、错题本「按模块查看」→ 时政筛选态的到期项与「开始复习」是否吃 NULL-qid 行；下次含发版时顺带上 R522-1 文案。

### R523（2026-09-08）：R522 登记项 R522-1 实修上线（完成页「仍错的已重置复习，明天优先再练」→「已回到今日待复习」）+ 「错题重练效果」块与 R371 `reviewed` 口径核（正确不改）+ 时政 NULL-qid 复习入口核（R522 本地一手已覆盖，不改）；生产 `2e608c0c` → `6d568b6c`（04:25:52Z）；代码 PR #659
- 论证：`save_mistake()` 重复命中 `next_review=time.time()` 立即到期，完成页同屏「今日还有 N 题到期待复习」（本地 N=1 / 生产 `umst3` N=30）与「明天优先再练」矛盾 → 只改文案对齐错题本「今日待复习」口径，不动 SRS；源锁 `tests/practice-r523-redo-still-copy.test.js` 同时锁后端 `time.time()` 绑定（语义改了先红）与新文案。
- 块口径：`fixed/still` 按本地 `_picked===answer`（不依赖回包），`mastered=reviewedMasteredCount(_reviewed)`（`/api/answer_log` 回包 `reviewed[].mastered===true`）；R522 本地选对/选错两路读数与之一致。
- 改后生产 375/1440（`~/r523/prod_redo_still_copy.py`，`umst3` 只读 `GET redo?mids=2914` → 写 `redoSet` → 练习页 1/1 → 选错 → 完成）：sec-tip「答对的已推进复习计划；仍错的已重置复习，已回到今日待复习」+ 同屏「今日还有 30 题到期待复习」；abort `POST answer_log {qid:null,mid:2914}` / `POST mistakes {question_id:null}`；bundle `index-BCpYYxJh.js` = 本机；errs []。
- (c)：新容器窗（04:25:52Z→04:29Z，120 请求）5xx/assets 404/monitor/mpUA/非探针 POST/Traceback 全 0；重建窗源站 5xx 0；WAL `4,173,592`；probe=0 各表同 R522；`umst3` 四表 32/45/22/1 新增 0。簇 09-08 至 04:29Z 4174/4115 仍在跑，日报 humans 3957 基本全簇。无新的外部真人证据。
- 发版：预检 mem 318 MB / disk 5.5 G / load 0.55 / 兄弟 0；compose ~1 min；6b 全 OK；`DEPLOY_RC=0`。门：vitest 134/916、eslint、tokens、lint-pages 0 error、build:h5；pytest 568 / ruff；`diff --check` 空。
- 如实：复习入口只有本地合成一手（生产未提交复习）；完成页读数来自 abort 后客户端状态；本机 CDP 非真机；0 LLM；无 testing agent 录屏。
- 取证：`docs/iter/round-3/r523-redo-effect-card-still-copy-today.md`；`~/r523/prod_375.out|prod_1440.out|prod_done_*.png`、`~/r523_pre.out`/`~/r523_post.out`/`~/r523_deploy.log`。
- 下一步 R524：(c) 补量 + 到期项/簇；四维下一候选先一手核（错题本「按模块查看」时政筛选态下批量条「重练所选」对 NULL-qid 行的 `mids=` 路径生产只读一手；练习页完成页「强化 5 道新题」对时政组的池口径）；R521-1 提示待 UX 定。

### R524（2026-09-08）：错题本时政筛选态「重练所选」`mids=` 对 NULL-qid 行生产只读核（R521 契约成立，不改）+ 完成页「薄弱考点 · 趁热打铁 → 强化 5 道新题」对时政组恒空死入口（生产一手命中）→ `weakSpots()` 跳过 `_sz` 1 行实修上线；生产 `6d568b6c` → `77611f96`（04:52:15Z）
- `mids=`：`umst3` `mids=2914,2915` / `2915,2914,2916` → 200 全 `_sz:true`、`mistake_id` 逐条保留、`id` 为 `shizheng_questions.id` 不落 `questions` 域、练习页「时政 1/2 · 1/3」渲染、errs []。回包顺序 = `ORDER BY COALESCE(next_review, created_at), created_at DESC`（与不带 `mids` 一致），非勾选顺序；R520「去重保序」指参数解析 → 登记 R524-2（P3 不改）。
- 死入口（改前 375 一手）：时政 2 题全错 → 卡「单选 · 本组错 2 题 · 强化 5 道新题」→ `GET /api/questions?mode=reinforce&limit=5&uid=…&module=时政&submodule=单选` 200 `items:[]` → toast「该考点暂无新题，换个考点试试」。根因：`reinforce_questions()` 三段 `_pick` 全查 `questions`（排除按 `answer_log.question_id`），`shizheng_questions` 无分支、`module='时政'` 在 `questions` 0 行 → 任何时政组必空。论证三选（后端补时政池 / 前端排除 `_sz` / 换「再练一组时政」）采纳前端 fail-closed 1 行：`weak-spots.js` `if (!q || q._sz || …) continue`，源锁 `tests/weak-spots.test.js` +1（改前源码 1 failed）；后端补时政池需先定池口径与已做排除方式（`answer_log.qid` NULL）→ 登记 R524-1（P2 待产品/UX）。
- 改后生产 375/1440（`~/r524/prod_sz_weakspot.py <W> <mids> post`）：`weak: null` / `CTA_ABSENT` / `REINFORCE_REQ []`，完成页保留「错题重练效果」块 + 「今日还有 30 题到期待复习」；abort `track / answer_log {qid:null,mid:2914} / mistakes {question_id:null} / practice/progress`；bundle `index-B-fpyXVB.js` = 本机；errs []。
- (c)：新容器窗（04:52:15Z→04:55Z，89 请求）5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；重建窗源站 5xx 0；WAL `4,173,592`；probe=0 各表同 R523；`reinforce_log` 2/2 不变（回包 0 条未触发 `_reinforce_log_add`）；`umst3` 四表 32/45/22/1 新增 0。簇 09-08 至 04:55Z 4589/4529 仍在跑，日报 humans 3957 基本全簇。无新的外部真人证据。
- 发版：预检 mem 380 MB / disk 5.6 G / load 0.90 / 兄弟 0；compose ~3 min（poll ×12）；6b 全 OK；`DEPLOY_RC=0`；发版后 1 min 宿主 load 6.08（Lighthouse 余波，healthy 0 重启）。门：vitest 134/917、eslint、tokens、lint-pages 0 error、build:h5；后端未改；`diff --check` 空。
- 如实：改前死入口只采 375（1440 同函数未采改前）；日练完成页同函数隐藏按源码推断；完成页读数来自 abort 后客户端状态；本机 CDP 非真机；0 LLM；无 testing agent 录屏。
- 取证：`docs/iter/round-3/r524-book-mids-sz-weakspot-reinforce-dead-end.md`；`~/r524/prod_pre_375.out|prod_post_375.out|prod_post_1440.out|prod_*_done_*.png|prod_pre_cta_375.png`、`~/r524_pre.out`/`~/r524_post.out`/`~/r524_deploy.log`。
- 下一步 R525：(c) 补量 + 到期项/簇；四维下一候选先一手核（错题本时政筛选态「导出所选」对 NULL-qid 行的 PDF 内容口径——本地起服务真生成；复习答错后「同类题自动加练」对 `_sz` 行是否同样落 `questions` 池死入口）；R524-1 / R521-1 待产品/UX 定。

### R525（2026-09-08）：错题本「导出所选」对 NULL-qid 时政行的 PDF 内容口径（本地 `:8525` 真生成）命中机读答题卡串槽 → `sheet_questions()` 只给有题库 id 的题出槽 + 卷首/确认层注明；复习答错后「同类题自动加练」对 `_sz` 已 fail-closed 不改；生产 `77611f96` → `5d999920`（05:22:04Z）
- 请求形态（R520 起）：`book.vue exportSelected()` 有 `question_id` → `question_ids`，`!question_id && question_text` → `items[{module,question,answer,analysis}]`；后端 `questions_by_ids(question_ids) + items` 拼卷，时政题进正文/参考答案/解析、来源标「时政」，`paper_exports.question_ids` 只存有 id 的题。
- 命中（改前本地真 PDF）：`_omr_sheet_pdf` 对全部题出槽 → 混合卷答题卡第 2 槽（空条码）是时政题而 `question_ids=[110]` 只有 1 个 → `scan_sheet`/`paper_answers` 按槽位对回时槽 2 无题（时政在前则普通题错位到 `question_ids` 不存在的槽）；全时政卷会出一页只有空条码槽的答题卡、任何涂写都对不回。
- 修（最小、契约不动）：`pdf_export.sheet_questions()` → `[(卷内题号, q) for q if q.get('id')]`，槽位与 `save_paper_export` 存的 `question_ids` 同序、槽标号沿用卷内题号（不重编，混合卷会跳号 → 登记 R525-1 P3）；全内联卷不出答题卡页；卷首 meta「答题卡 N 题（时政/手录题 M 题不参与机读判分，请对照参考答案核对）」/「本卷均为时政/手录题，无机读答题卡…」；`export-confirm.vue sheetless` prop + `sheetlessNote`（「其中 M 题（时政/手录）不上机读答题卡…」/「所选均为…」；仅答案/关答题卡不显示），`book.vue exportSheetless` 谓词与 `items` 过滤逐字同串。否决：给时政题造 `questions` 域 id（撞号）/ 内联题不进 PDF（违背导出所选）。源锁后端 5 例 + 前端 1 文件。
- 改后本地：`post_mix.pdf` 3 页答题卡只有 `1 CS-DLGQ-000110`、正文 1 普通 + 「第二部分 时政 2.」、答案 `1. B 2. C` + 两解析、卷首「答题卡 1 题（时政/手录题 1 题不参与机读判分…）」；`post_sz.pdf` 2 页无答题卡页；UI 375 混选 / 1440 全时政真导出 200 + toast「PDF 已开始下载」+ `paper_exports (0A331F28,'[110]') / (14FA1B71,'[]')`。
- 复习加练对照（本地）：时政 NULL-qid 到期项答错 → `SIMILAR_BTN False`（看讲解仍在）/ `QUESTIONS_REQS []`；`changshi` 到期项答错 → `SIMILAR_BTN True` + `GET questions?limit=2&module=changshi&submodule=…` 200。`hasSimilarPool()` 只认五模块 → 不改。
- 改后生产 375/1440（`~/r525/prod_export_sel.py`，`umst3`，非 GET 全 abort）：375 时政筛选态勾 3 → 确认层「所选均为时政/手录题，无机读答题卡…」（12px，`NOTE_ONLY False`）→ abort 体 `question_ids:[] items:[×3]`；1440 混选 6 → 「其中 1 题（时政/手录）不上机读答题卡…」→ abort 体 `question_ids:[162861,…,296322] items:[×1]`；1440 纯普通 4 → 无提示、`items:[]`；toast「导出失败：网络错误…」（abort 造）；bundle `index-DPwKQFih.js` = 本机；GET 非 200 []、errs []。**生产未生成 PDF**：`paper_exports` 05:22Z 后 0 新行、Caddy 09-08 `/api/export/pdf` 0 条。
- (c)：R525 容器窗（05:22:04Z→05:25Z，116 请求）与 R524 容器窗（04:52:15Z→05:03Z，234）5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；WAL `4,173,592`；probe=0 各表同 R524；`reinforce_log` 2/2；`umst3` 四表 32/45/22/1 新增 0；发版后任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0 新行。**补账 R525-2（P3）**：09-08 源站 503 共 75 条全在 00:28–00:29 / 01:03（簇 `/tiku/q/*`，≈26 s），时序对上 R519 之前两次重建收尾窗（compose `94803e0b` 00:14:50Z 起 build 14.5 min、`rc=0 at 00:29:15Z`；`de94fde` `rc=0 at 01:03:49Z`）= R469 §4 「重建窗 5xx」形态；R519–R525 七次发版重建窗 0。簇 09-08 至 05:25Z 5074/5010 仍在跑，日报 humans 4925 基本全簇。无新的外部真人证据。
- 发版：预检 mem 320 MB / disk 5.5 G / load 0.77 / 兄弟 0；compose ~1.5 min（poll ×5）；bundle 首轮传播窗旧 hash、5 s 后一致；6b 全 OK；`DEPLOY_RC=0`。门：vitest 135/919、eslint、tokens、lint-pages 0 error、build:h5；pytest 573 / ruff / pyright 0；`diff --check` 空。
- 如实：PDF 内容证据全部本地合成（uid `r522local`）；生产只抓请求体与确认层文案，未生成 PDF、未写 `paper_exports`；`scan_sheet` 实拍回读未做（源锁按 `question_ids` 同序断言）；生产 1440 纯普通确认层截图被同名覆盖只剩 `.out` 文本；复习加练对照仅本地；本机 CDP 非真机；0 LLM、0 写入；503 归属与簇归因为推断；无 testing agent 录屏。
- 取证：`docs/iter/round-3/r525-export-null-qid-sheet-inline-review-similar.md`；`~/r525/{mix,sz,post_mix,post_sz}.pdf`、`post_375.out|post_1440_szonly2.out|review_sz_375.out|review_cs_1440.out|prod_375_sz.out|prod_1440_mix.out|prod_1440_all.out|r525_pre.out|r525_post.out|r525_deploy.log|fe_gates.out`、截图 `export_*.png|review_wrong_*.png|prod_export_*.png`。
- 下一步 R526：(c) 补量 + 到期项/簇；四维下一候选先一手核（`scan_sheet` 对含内联题混合卷的实拍回读——本地生成卷 + 合成涂卡图；错题本时政筛选态「标已掌握」/「删除」批量对 NULL-qid 行的 `mids` 路径；首页「导出为试卷 PDF」入口是否也该透出 `sheetless` 口径——只在有内联题时才需要）；R525-1 / R524-1 / R521-1 待产品/UX 定。

### R526（2026-09-08）：`scan_sheet` 对含内联题混合卷实拍回读（本地真卷 + 合成涂卡）+ 错题本 NULL-qid 行批量「标已掌握」/「删除」+ 首页导出 `sheetless` 口径——三项一手核均成立，不改码、0 部署；#662 已合入 main（`3145ed6a`）；生产仍 `5d999920`
- A `scan_sheet`（本地 `:8525`，`~/r526/local_scan_mix.py`）：`POST export/pdf question_ids:[110,111,112] + items:[时政 ×2]` → `code 340F4B53`、3 页、`paper_exports '[111, 112, 110]'`（`questions_by_ids` 按 module/submodule 排序，答题卡/正文/`question_ids` 同序）；答题卡在 **第 1 页**（首版取末页得解析页 → `omr` 抛「未找到四角定位块」，改逐页 `pdftotext` 找「机读卷码区」）；槽 `1 …111 / 2 …112 / 3 …110` 连续；按 `omr.bubble_rect()` 合成涂卡 `{0:D,1:A(错),2:B,3:A(无 id)}` → `omr.recognize()` 同值 → `POST scan_sheet` 200 `total 3 / correct 2 / saved`，rows `no1 qid111 ✓ / no2 qid112 ✗(C) / no3 qid110 ✓`，槽 3 被 `page_ids` 长度自然截掉；`answer_log` +3、`mistakes` +1（112）、NULL-qid 时政行不动、`questions` 0 新行；`POST paper_answers {1:D,2:C,3:B,4:D,5:D}` → `correct 3`，题号 4/5 忽略（同契约）。
- A' **R525-1 关闭**：`exam_api.py:20-33` 普通题在前、`items` append 在后，`group_by_material()` 只前聚 `ziliao` 同材料题 → 当前 API 下机读槽标号恒 1..N 连续、跳号不可达（唯一理论路径：手录 `ziliao` 题材料指纹撞普通资料题）；R525 文档/SKILL「混合卷会跳号」表述已修正。
- B 批量掌握/删除（`~/r526/local_batch_sz.py`）：`book.vue batchMaster()/batchDel()` 是逐行 `PATCH /api/mistakes/{mid} {uid,mastered}` / `DELETE /api/mistakes/{mid}?uid=`（按 `mistakes.id`，不走 `mids=`，与 `question_id` 无关）；两条 NULL-qid 时政行 mastered 1→`mastered_at` 置值→0→NULL；别 uid PATCH/DELETE 404；DELETE 只删 `mistakes` 行，`shizheng_questions` 141 行不动 → 不改。顺带：`GET /api/mistakes` 不吃 `module`/`mastered` 参数，筛选是前端 `shownPage` 本地完成（既有口径）。
- C 首页 `sheetless`：`home.vue:1153 exportPaper()` / `practice.vue:2404` / `pkgA/exam/list.vue:390` 题源均为 `GET /api/questions`（`questions` 表）或 `paper.question_ids`，`ids.filter(Boolean)`、不传 `items` → `sheetless` 恒 0，`export-confirm` 不传 prop 即空提示 → 不需要透出，不改。
- (c)（`~/r526/r526_post.out`）：容器窗 05:22:04Z→05:44Z 431 请求，5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0（非探针非 bot 383 全簇）；WAL `4,173,592`；probe=0 各表同 R525；`umst3` 32/45/22/1 新增 0；`paper_exports` 38 行、05:22Z 后 0；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0；09-08 503 仍 75 条（R525-2）无新增；簇 09-08 至 05:44Z 5387/5322 仍在跑（15.6 行/分、UA 14、每 IP ≤2），日报 humans 4925 基本全簇。**`scan_sheet`/`paper_answers`/`paper/{code}` 全历史 7 条全探针 `140.232.64.x`**（从未有外部真人扫过答题卡）；生产 `question_ids='[]'` 空卷 4 张全为 08-03 探针期。
- 登记 **R526-1（P3）**：手动录入层对 `n=0` 全内联卷显示「共 0 题 · 已选 0」+ 空列表 + 禁用「交卷判分（0 题）」无解释（`book.vue:393-395`）；确认层已告知「无机读答题卡」、无真人触达 → 并入下次含发版轮次（候选文案「本卷均为时政/手录题，请对照参考答案核对，无需录入」）。
- 如实：三项证据全部本地合成（uid `r522local`；涂卡图按 `omr.bubble_rect` 同几何程序合成，非手机实拍，只证槽位契约不证识别鲁棒性）；生产 0 写入 / 0 PDF / 0 LLM / 0 部署，读数 `mode=ro` + Caddy；未做批量条 UI 走查（R520/R524 已做）；首页结论为源码静态核；簇归因推断；无 testing agent 录屏。
- 取证：`docs/iter/round-3/r526-scan-sheet-mix-batch-sz-home-export.md`；`~/r526/{local_scan_mix.py,.out,mix.pdf,sheet.png,sheet_filled.png,local_batch_sz.py,.out,r526_post.sh,.out}`。
- 下一步 R527：(c) 补量 + 到期项/簇；四维下一候选先一手核（`home.vue`/`practice.vue exportPaper()` 复制两份的漂移风险逐字比对；错题本「扫描答题卡」结果 sheet 对 R525 后混合卷的题号/时政题提示口径——本地扫描结果 375/1440）；R526-1 / R524-1 / R521-1 待产品/UX 定。

### R527（2026-09-08，实现轮）：R521-1「N 题无法重练」提示 + R526-1 `n=0` 手动录入层文案 + 删练习页 `exportPaper()` 死副本；R524-1 论证后不立项；生产 `5d999920` → `b0d3c3e6`；#663 已合入 main（`3e3846d3`）
- 统筹者指令：R526 属审计-only，避免连续纯取证轮，把已确认登记项转为实现并部署。R520 对标清单 P0/P1 五项复核均已在 R520/R520b/R520c 上线，无遗留；本轮实修对象即 R521–R526 登记项。
- A R521-1：`GET /api/mistakes/redo?mids=` 回包少于勾选数时（手录 NULL-qid 行按 R521 设计跳过、不造题、不把时政 id 塞 `questions` 域），新增 `src/book-redo-skipped.js redoSkippedNote(sel, got)`（仅 `0<got<sel` 返回「已加载 N 题，另 M 题为手录/无题库原题，无法重练」）；`book.vue redoSel()` 写 `redoNote` 存储（在 `redoSet` 之后、`navigateTo` 之前），0 条仍 toast「选中的错题未能匹配到题库原题」；`practice.vue onLoad` 读后即 `removeStorageSync`，有说明 → toast「错题重练开始 · …」3.5 s，无 → 原文案。**为何交给练习页**：本地一手命中 `book.vue` 的 toast 被练习页 `onLoad` 的「错题重练开始」立即盖掉（uni toast 单例）。
- B R526-1：手动录入层 `manualPaper.n===0` → `<text class="manual-empty">这张卷的题目均为时政/手录题，不参与机读判分，无需在此录入；请对照卷末参考答案核对</text>` 替代题号行，「交卷判分」按钮 `v-if="manualPaper.n"` 不渲染，「换一份试卷」保留；后端 `sheet_questions()` 不动。
- C 漂移：逐字比对 `home.vue exportPaper(opts)`（`...opts`、收尾 `exportConfirm=false`）vs `practice.vue exportPaper()`（硬编 `include_answers/answer_sheet/include_questions` 三行、无收尾）；关键一手是练习页 v3 5-tab 后模板 0 处调用 `exportPaper/exportConfirm` → 删死方法 + `exportPdf` import + `exporting/expSheet/expAns/expOnly` 四字段（−36 行），导出只剩首页一份；源锁 `PRACTICE` 不含 `exportPaper|exportPdf|exp(Sheet|Ans|Only)`、`HOME` 仍含 `async exportPaper(opts) {`。
- D R524-1 不立项：时政加练池四个未知（池范围 / 已做排除依据——时政 `answer_log.question_id` NULL 无法按 qid 排除 / `reinforce_log` 口径 / `_sz` 回包守卫），且无用户诉求/行为一手 → 保持 R524 fail-closed。
- 本地（`~/r527/local_r527.py`，`:8525`，uid `r522local`，种子手录行 `id 7 qid NULL`）：`14FA1B71 '[]'` → `EMPTY_NOTE 1 / ROWS 0 / SUBMIT_BTN 0 / SWITCH_BTN 1`；`340F4B53` → `ROWS 3 / SUBMIT_BTN 1`；勾 4 → `redo?mids=7,4,3,2` 回 3（手录 7 跳过）→ 练习页 toast「错题重练开始 · 已加载 3 题，另 1 题为手录/无题库原题，无法重练」，375/1440 `errs []`。门：vitest 136/924（+1 文件 +5 例）、eslint 0 error、tokens、build:h5；pytest 573 / ruff（后端未改）；`diff --check` 空。
- 发版（`~/r527_deploy.log`）：预检 mem 223 MB（`free -m` 325）/ disk 5.4 G / load 0.60 / 兄弟 0；compose `rc=0 at 06:12:38Z`（~1 min）；线上 bundle 首轮读旧 `DPwKQFih`（传播窗）→ 5 s 重试 `index-DXKcHBUS.js` = 本机；6a 全 200；6b `/` 0.99/1.00/LCP 1405/CLS 0.06、`/tiku/` 1.00/LCP 955；`DEPLOY_RC=0`。
- 生产只读（`~/r527/prod_r527.py`，`umst3`，非 GET 全 abort，`prod_{375,1440}.out` + 截图）：`GET paper/259CBA70` `n:0` → 解释文案 + 无交卷按钮 + 换一份；对照 `9D29E4AB n:12` → 12 行 + 禁用「交卷判分（0 题）」。`umst3` 9 条 NULL-qid 全为时政且 `shizheng_questions` 命中、**无真手录行** → 用别 uid 的 `mid 999999999` 触发同一「回包少于勾选」前端路径：`redo?mids=2934,2914,999999999` 回 2 → toast「错题重练开始 · 已加载 2 题，另 1 题为手录/无题库原题，无法重练」、「时政 1/2」、`redoNote` 读后 `null`；abort 仅 `POST track boot`；GET 非 2xx 0；errs []；0 PDF / 0 LLM。**如实**：服务端「手录题跳过」只有本地一手（登记 R527-1 P3，不为此在生产造写入）。
- (c)（`~/r527/r527_post.out`）：新容器 06:12:37Z healthy 0 重启，容器窗 82 请求 5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0、重建窗源站 5xx 0；WAL `4,173,592`；disk 4.2 G（发版后镜像层，下次 4-pre prune 让行）；probe=0 各表同 R526；`umst3` 32/45/22/1 新增 0、`mistake 1953/2784/2914/2915/2934` 不变；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0、`paper_exports` 05:22Z 后 0（本轮 4 条 `paper/{code}` GET 全探针）；09-08 503 仍 75（R525-2）；簇 09-08 至 06:14Z 5819/5751 仍在跑，日报 humans 4925 基本全簇。无新的外部真人证据。
- 未做：R526 预告的「扫描答题卡结果 sheet 对混合卷题号/时政提示口径」转 R528；`redoNote` 长文案 375 两行可读性未量。
- 取证：`docs/iter/round-3/r527-redo-skipped-note-manual-empty-export-dead.md`；`~/r527/{local_r527.py,local_{375,1440}.out,prod_r527.py,prod_{375,1440}.out,r527_pick.sh,r527_pre.out,r527_post.sh,r527_post.out,*.png}`。
- 下一步 R528：(c) 补量 + 到期项/簇；错题本「扫描答题卡」结果 sheet 对混合卷的题号/时政题提示口径（本地 `scan_sheet` 结果 375/1440）+ 四维下一候选一手核后按实现轮推进；R524-1 四个未知待产品/UX 一手。

### R528（2026-09-08，实现轮）：错题本「扫描答题卡 / 手动录入」结果 sheet 与录入层对混合卷注明「另 M 题为时政/手录题，不参与机读判分」——`paper_exports.inline_n` 落库 + `paper/{code}`、`paper_answers`、`scan_sheet` 回包透出；生产 `b0d3c3e6` → `a52c3d92`；#664 已合入 main（`ea82b25c`）
- 命中（本地 `:8525` R526 混合卷 `340F4B53`：3 普通 `[111,112,110]` + 2 时政内联）：结果 sheet「已作答 3/3 · 答对 2 题」+ 3 行，对「卷面 5 题」0 提示 —— 卷末参考答案有 5 题、机读只判 3 题，`3/3` 会被当成整卷；录入层同形态（「共 3 题」）。不是 OMR 串槽（R525/R526 契约成立），是**范围口径未透出**。
- 修（最小、契约不动）：`db.save_paper_export(code, ids, title, inline_n=0)` 幂等 `add_column_if_missing("paper_exports","inline_n","INTEGER DEFAULT 0")`，`get_paper_export()` 读 `int(d.get("inline_n") or 0)`（列缺失/历史行 → 0，读路径不依赖列存在）；`exam_api` 导出时 `inline_n=sum(1 for q in questions if not q.get("id"))`，`GET paper/{code}` / `POST paper_answers` / `POST scan_sheet` 回包多 `inline_n` 字段，`total/answered/correct/items` 仍只算普通题；前端 `src/paper-inline-note.js inlineSkipNote(m)`（`m<=0 → ''`）在 `book.vue` 录入层（`manualPaper.n && inlineSkipNote(manualPaper.inline_n)`）与结果 sheet（`inlineSkipNote(scanResult.inline_n)`）各出一行 `.scan-note`（`--fs-sub` / `--ink-3` / lh 1.6）；R527 `n=0` 全内联文案保留。否决：把时政题塞进槽位 / 改 `total` 含内联题 / 回填历史行（无依据）。小程序显示层未接（回包字段向后兼容）→ 登记 R528-1 P3。
- 源锁：`backend/tests/test_r528_paper_inline_n.py`（4 例：落库+读回 / 默认 0 / 历史表兼容 + 幂等加列 / 三个 API 回包）+ `frontend-uni/tests/book-r528-paper-inline-note.test.js`（3 例：`inlineSkipNote` 边界 / 结果 sheet 与录入层源码含说明行且 `scan-row` 仍只吃 `scanResult.items` / R527 文案保留 + `.scan-note` 样式）。
- 本地（`~/r528/local_r528.py`）：`paper/340F4B53 {n:3, inline_n:2}`；真 `POST paper_answers` `{total 3, inline_n 2, correct 2}` → sheet 说明行 375 343×42 / 1440 448×21，`ROWS 3`；真 `POST scan_sheet`（R526 `sheet_filled.png`）`{page 1, total 3, inline_n 2, correct 2, saved}` → 同说明行 + 「第 1 页」；errs []。门：vitest 137/927、eslint 0 error / 19 warn（既有）、tokens、build:h5；pytest 577 / ruff；`diff --check` 空。
- 发版（`~/r528/r528_deploy.log`）：预检 mem 466 MB / disk 4.7 G（91%）/ load 0.59 / 兄弟 0；compose `rc=0 at 06:40:03Z`（~1.3 min）；bundle 两轮读旧 `DXKcHBUS`（传播窗）→ 第三轮 `index-tS3hWG0W.js` = 本机；6b `/` 0.99/**a11y 0.94 WARN**/LCP 1683/CLS 0、`/tiku/` 全 1.00 → 本机 `lighthouse --only-categories=accessibility` 生产复采 ×3 全 1.00（`~/r528/lh_a11y_*.json`，首页本轮 0 改动）→ R429 间歇形态，不改；`DEPLOY_RC=0`。
- 生产只读（`~/r528/prod_r528.py`，`umst3`，非 GET 全 abort，`prod_{375,1440}.out` + 截图）：真 `GET paper/9D29E4AB {n:12, inline_n:0}` / `259CBA70 {n:0, inline_n:0}` / `ZZZZZZZZ` 404；历史卷录入层 12 行、说明行 0（§0-D）。生产不造导出 / 不上传答题卡 → 用 route 把同一真 GET 回包的 `inline_n` 改 2、把被 abort 的 `POST paper_answers` fulfill 为本地真 `scan_sheet` 回包形态 → 录入层说明行 375 343×42 / 1440 433×21；结果 sheet「卷码 9D29E4AB · 第 1 页 · 已作答 3/3 · 答对 2 题 · 已记入做题记录 / 说明行 / 1 D ✓ 2 A ✗ 3 B ✓」`ROWS 3`；abort 仅 `POST track boot` + `POST paper_answers`；GET 非 2xx 0；errs []；0 PDF / 0 LLM / 0 写入。**如实**：生产段证明的是生产 bundle 显示层对回包字段的处理，服务端 `inline_n>0` 只有本地一手；生产 `paper_exports` 仍 4 列（首次导出才加列）。
- (c)（`~/r528/r528_post.out`，06:44Z）：新容器 06:40:03Z healthy 0 重启，容器窗 134 请求 5xx/assets 404/mpUA/非探针 POST/401·403/Traceback 全 0（monitor 仅探针 1）、重建窗源站 5xx 0；WAL `4,173,592` 同字节；disk 4.1 G / mem 267 MB；probe=0 各表同 R527；`umst3` 32/45/22/1 新增 0、`mistake 1953/2784/2914/2915/2934` 不变；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0、`paper_exports` 05:22Z 后 0（本轮 10 条 `paper/*` GET 全探针；`scan_sheet/paper_answers/paper/{code}` 全历史 18 条仍全探针）；09-08 503 仍 75（R525-2）；簇 09-08 至 06:44Z 6298/6225 仍在跑，日报 humans 5849 基本全簇。无新的外部真人证据。
- 四道把关：QA = 后端 4 例 + 前端 3 例源锁 + 本地真 `paper_answers`/`scan_sheet` 两路 375/1440；UX = 说明行 375 两行 / 1440 单行可读、与 R525 卷首 meta「时政/手录题 M 题不参与机读判分」同口径、R527 `n=0` 态不冲突；交叉 = 生产 bundle 同路径客户端改写复采 + 历史卷 `inline_n:0` 不出说明行；合规/安全 = 新字段只读展示、非 GET 全 abort、0 写入、`paper_exports` 加列幂等且旧行不回填。
- 未做/登记：R528-1（P3）小程序 `pages/book` 录入层/结果 sheet 接 `inline_n`；历史混合卷不回填；生产 `scan_sheet` 真上传不做。
- 取证：`docs/iter/round-3/r528-scan-sheet-mix-inline-note.md`；`~/r528/{local_r528.py,local_{375,1440}.out,local_scan_resp.json,prod_r528.py,prod_{375,1440}.out,r528_deploy.log,r528_post.sh,r528_post.out,lh_a11y_{1,2,3}.json,*.png}`。
- 下一步 R529：(c) 补量 + 到期项/簇；四维下一候选一手核（错题本「扫描答题卡」拍照入口对 `page` 多页卷的逐页提示 / 结果 sheet「已记入做题记录」后错题本列表是否即时刷新 / 导出确认层与录入层 M 题口径同串源锁）→ 命中即论证→实修→发版→复采。

### R529（2026-09-08，实现轮）：扫描答题卡多页卷结果 sheet 标「第 N/P 页」+「本卷答题卡共 P 页，本页只判第 a–b 题；其余页请分别扫描」（`omr.sheet_pages` 一式三用：出卡 / `paper/{code}` / `scan_sheet`）+ 结果 sheet ✕/遮罩/「完成」同走 `closeScan()`（已记入做题记录后错题本即时刷新）+ 导出确认层/录入层 M 题口径同串源锁；生产 `a52c3d92` → `74d56fef`；#665 已合入 main（`78335068`）
- 命中 A（本地 `:8525` 真导出 60 题卷 `5A43BB84`，答题卡 2 页 `PER_PAGE=50`，合成涂卡第 1 页真 `scan_sheet` 200 `{page 1, total 50, answered 3}`）：结果 sheet「第 1 页 · 已作答 3/50」，`paper/{code}` 只回 `n`，用户看不到整卷几页 / 本页题段 / 第 2 页要另扫 →「3/50」会被当整卷（R528 `3/3` 同形态，这次是页范围）。命中 B（改前一手）：「完成」`scanOpen=false; load()` 刷新，但 ✕/遮罩 `@update:model-value="scanOpen=$event"` **不刷新**（`CLOSE_X mistakes GET delta 0 / CLOSE_DONE 1`），`saved:true` 已写 `answer_log/mistakes` 而列表仍旧。C 核成立：确认层 `sheetlessNote()`（R525）与录入层/结果 sheet `inlineSkipNote()`（R528）M 同一计数（前端 `exportSheetless` 谓词 = 拼 `items` 谓词；后端 `inline_n = 无 id 题数`），措辞差异有意（导出前「不上答题卡」 vs 判后「不参与判分」）→ 只加源锁不改文案。
- 修（最小、OMR 契约不动）：`omr.sheet_pages(n) = max(1, ceil(n/PER_PAGE))`，`pdf_export._omr_sheet_pdf` 改用之（删自有 `math.ceil`），`GET paper/{code}` / `POST scan_sheet` 回包加 `pages`（`page/total/items` 页内口径不变、内联题仍不占槽）；前端 `src/paper-scan-pages.js scanPageLabel(r)`（`pages>1 → 第 N/P 页`，否则 `第 N 页`，`page<=0 → ''`）/ `scanPagesNote(r)`（`page<=0||pages<=1||total<=0 → ''`，`a=items[0].no||1, b=a+total-1`）；`book.vue` 标题行用 `scanPageLabel`，总结行下先 `scanPagesNote` 再 R528 `inlineSkipNote`；`closeScan(){ if(!scanOpen) return; scanOpen=false; load(); }` 三路关闭同出口。否决：只在 `saved` 时刷新（多一个未覆盖分支）/ 改 `total` 为整卷（破 R525/R526 页内契约）/ 前端自算页数（与出卡公式双源）。
- 源锁：`backend/tests/test_r529_scan_sheet_pages.py`（2 例：`sheet_pages` 0/1/50→1、51/60/100→2、101→3；60 题卷 `pages:2`、p1 `no 1..50`、p2 `no 51..60` 且 `items[0].question_id==qids[50]`；3 题卷 `pages:1`）+ `frontend-uni/tests/book-r529-scan-pages-close.test.js`（5 例：helper 边界 / `book.vue` 标题与两行顺序 / §0-C 口径 / `closeScan` 三路径 + 旧内联不再出现）；`book-r528-paper-inline-note.test.js` 相邻断言更新为「总结行 → pagesNote → inlineNote」。
- 本地（`~/r529/local_r529.py`，`local_{375,1440}_post.out`）：p1「第 1/2 页 · 已作答 3/50」+「…本页只判第 1–50 题…」`ROWS 50`；p2（合成涂卡第 2 页真 `scan_sheet` `{page 2, total 10}`）「第 2/2 页 · 3/10」+「51–60」`ROWS 10`；`CLOSE_X 1 / CLOSE_DONE 1`；errs []。门：pytest 579 / ruff；vitest 138/932、eslint 0 error、tokens、build:h5（`index-pYlODHuD.js`）；`diff --check` 空。
- 宿主级中途预警（已即时上报）：`/` 50G 可用 1.1G→263M（99–100%）+ 兄弟 `/opt/SoftCopyrightAgent compose up --build`（root）在跑、load 5.3 → 预检不满足暂缓发版，**未动任何非 kaogong Docker 资源**；兄弟构建结束后回落 3.5G/93%、`other_builds=0` 再发。
- 发版（`~/r529/r529_deploy.log`）：`--skip-build`，compose `rc=0`（新容器 07:12:10Z healthy 0 重启）；CF Pages 上传成功；bundle 首轮读旧 `tS3hWG0W`（传播窗）→ 重试 `index-pYlODHuD.js` = 本机、四路编码一致；回归 200；6b `/` 0.99/1.00/1.00/1.00/LCP 1396/CLS 0.06、`/tiku/` 全 1.00/LCP 960；`DEPLOY_RC=0`。
- 生产只读（`~/r529/prod_r529.py`，`umst3`，非 GET 全 abort，`prod_{375,1440}.out` + 截图）：**A 服务端一手**：真 `GET paper/71F09991`（生产历史卷 n=93）`pages:2`、`paper/9D29E4AB`（n=12）`pages:1`；**B 显示层**（`paper_answers` 被 abort → fulfill 本地真 `scan_sheet` p1/p2 回包形态）：375/1440 均「第 1/2 页 · 3/50」+「1–50」ROWS 50、「第 2/2 页 · 3/10」+「51–60」ROWS 10，说明行 375 343×42 / 1440 433–448×21；**C** ✕ 与「完成」各 `GET /api/mistakes +1`、sheet 关；ABORTED 仅 `track boot` + `paper_answers`×2；GET 非 2xx []；errs []。0 PDF / 0 LLM / 0 写入。
- (c)（`~/r529/r529_post.out`，07:15Z）：容器窗 63 请求 5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0、重建窗源站 5xx 0（09-08 503 仍 75 = R525-2）；`/` 4.7G / mem 368 MB / load 1.26；WAL `4,173,592` 同字节；probe=0 各表同 R528；`umst3` 32/45/22/1 新增 0、`mistake 1953/2784/2914/2915` 不变；任意 uid 三表 04:52Z 起 0、`paper_exports` 05:22Z 后 0（仍 4 列）；`scan_sheet/paper_answers/paper/{code}` 全历史仍全探针。簇 09-08 至 07:06:37Z 6575/6499（15.4 行/分、UA 14、每 IP ≤2），**07:06Z 后 9 min 无新行**（是否停待复查）；无新的外部真人证据。
- 四道把关：QA = 后端 2 例 + 前端 5 例源锁 + 本地真 `scan_sheet` p1/p2 两路 375/1440；UX = 页标签与卡面页眉「第 1/2 页」同口径、提示行 375 两行 / 1440 单行、三路关闭同出口；交叉 = 生产历史 n=93 卷真回 `pages:2` + bundle 同路径客户端替换复采；合规/安全 = 新字段只读、生产 0 写入 0 PDF 0 LLM、非 kaogong 资源未动。
- 未做/登记：小程序 `pages/book` 结果 sheet 未接 `pages`（并入 R528-1 P3）；生产 `scan_sheet` 真上传不做；涂卡图合成非实拍（只证页范围契约不证识别鲁棒性）；`umst3` 单页卷录入层「共 12 题」与替换后结果 sheet「1/2 页」不同源属预期。
- 取证：`docs/iter/round-3/r529-scan-sheet-pages-close-refresh.md`；`~/r529/{local_r529.py,local_{375,1440}_{pre,post}.out,scan_resp_post_p{1,2}.json,sheet{1,2}{,_filled}.png,prod_r529.py,prod_{375,1440}.out,prod_{375,1440}_scan_result_p{1,2}.png,prod_{375,1440}_after_done.png,r529_pre.sh,r529_pre.out,r529_post.sh,r529_post.out,r529_deploy.log}`。
- 下一步 R530：(c) 补量 + 到期项/簇（07:06Z 后簇是否停）；四维下一候选一手核（扫描结果 sheet 逐题行「✗」是否可直达该题错题详情/讲解 / 多页卷第 2 页扫完后是否有「本卷 P 页已全部判分」汇总 / 录入层对多页卷是否需分页）→ 命中即论证→实修→发版→复采。

### R530（2026-09-08，实现轮）：扫描答题卡结果 sheet「✗」行「看错题 ›」直达该题既有错题卡（saved + 普通涂卡 + 错 + 有题库 id 才可点；关 sheet → 重拉 → 按 `question_id` 找卡 → 切 tab/清筛选/扩页 → 展开 → 滚到 `#mc-<mistakes.id>`，不新造路由）+ 多页卷全部页扫完「本卷答题卡 P 页已全部判分 · 合计已作答 a/n · 答对 c 题」（前端按卷码/页号会话内累计，页内契约不动）+ track 白名单 `book_scan_jump`；录入层多页分页核成立不改；R530b 修非可跳行 a11y 落点；生产 `74d56fef` → `bbf978fb` → `f0527f0e`；#667 已合入 main，R530b 独立 PR
- 命中 A（本地 `:8525` 60 题卷 `5A43BB84` 真 `scan_sheet`）：结果行 `✗` 只是文本，从结果 sheet 到该题错题卡 0 路径（要关 sheet 手动翻找）；粉笔/夸克错题本判分后逐题可点是 P1。命中 B：p2 扫完只有「第 2/2 页 · 3/10」，整卷合计不可见（R529 只解决了「本页范围」）。C 录入层多页分页：手动录入契约一次提交整卷 `picks`（不分页也不串槽）→ 不改。
- 修：`src/paper-scan-jump.js scanRowJumpable(res,r)`（`res.saved && r.status==='ok' && !r.correct && r.question_id`）/ `findScanMistake(items,qid)`（优先未掌握）/ `pageNFor`；`book.vue` 结果行 `.jump` + `role=button` + 「看错题 ›」，`scanRowJump` 记 `_pendingScanQid` → `closeScan()` → `load()` 后 `locateScanMistake`（`tab` 按 `mastered`、清 `kw`、不在 `shownItems` 才清筛选、`pageN` 扩到目标、`kbId=m.id`、`toggleCard`、`scrollIntoView`），找不到 toast「错题本里未找到这道题」fail-closed；`.mcard { scroll-margin-top: calc(var(--window-top,0px) + var(--sp-8)) }`（首版滚到 top 0 被固定头盖）；`src/paper-scan-pages.js recordScanPage/scanAllPagesSummary/scanPagesNote(r, acc)`（同页重扫覆盖、`1..pages` 齐才出合计、单页/手动录入/缺页不出、账号重置清 `scanAcc`）；`team.py` 白名单 + `test_track.py` 1 例。空白/多涂行不可点（持久化与题目身份未证）。源锁 `frontend-uni/tests/book-r530-scan-jump-all-pages.test.js`（8 例）。
- **R530b（生产首轮 375 一手命中）**：全部 `.scan-row` 挂 `@click`（方法内再判）→ `a11y-focus.js` 给有 click 监听的短文本元素补 `tabindex`/`role=button` → 未涂/多涂/✓/`saved:false` 行 12 个（多页卷 49 个）无动作键盘落点；本地走查只读了 `link/jump` 没读 `role` 才漏。修 `v-on="scanRowJumpable(scanResult, r) ? { click: () => scanRowJump(r) } : {}"`，源锁改新串 + `not.toContain` 旧 `@click=`；从 `origin/main`（#667 已合）另开分支 `f0527f0e`。
- 门：pytest 580 / ruff；vitest 139/940、eslint 0 error（19 既有 warn）、tokens、build:h5（R530 `index-Diqff7wW.js` / R530b `index-CyDxXuU_.js`）；`diff --check` 空。
- 宿主级中途预警（同 R529 形态，已即时上报，未动非 kaogong 资源）：`/` 100%（0 可用）+ `SoftCopyrightAgent compose --build` + load 8.95 + apport → 暂缓；回落 4.3G/兄弟 0 后发 R530（`~/r530/r530_deploy.log`：新容器 07:59:24Z、rev/bundle = 本机、6b `/` 0.91/1.00/LCP 2867/CLS 0.08、`/tiku/` 全 1.00、`DEPLOY_RC=0`）；R530b 预检 load 0.37 / 5.3G / mem 236 MB / 兄弟 0 → 发（`r530b_deploy.log`：新容器 08:09:48Z、`f0527f0e`、bundle 传播窗后 `index-CyDxXuU_.js` = 本机、6b `/` 0.99/1.00/LCP 1027/CLS 0.06、`/tiku/` 1.00、`DEPLOY_RC=0`）。
- 生产只读（`~/r530/prod_r530.py`，`umst3`，非 GET 全 abort，`prod_{375,1440}.out` + 截图；`paper_answers`/`scan_sheet` fulfill 本地真回包形态，不上传不写库）：服务端一手 真 `GET paper/71F09991 {n:93,pages:2}`、health `f0527f0e`；A0 `saved:false` 12 行 0 可跳 **且 `role:None`**；A1 仅 no1（✗ `qid 162861`）`role=button` + 「看错题 ›」（高 45），其余 `role:None`；点 → sheet 关、`GET /api/mistakes` +1、`#mc-2934`（生产 `mistakes.id 2934 ↔ qid 162861`）展开、`top 52` 两视口同；B p1「第 1/2 页 · 2/50」+ R529 提示行 ROWS 50，p2「第 2/2 页 · 2/43」+ **「本卷答题卡 2 页已全部判分 · 合计已作答 4/93 · 答对 2 题」** ROWS 43；「完成」+1；GET 非 2xx []、errs []。改前 `bbf978fb` 首轮 375 逐字留 `prod_375_prefix_bbf978fb.out`（非可跳行 `role: button`）。
- (c)（`~/r530/r530b_{pre,post}.out`，08:07Z / 08:12Z）：两容器窗 62 / 80 请求 5xx/assets 404/monitor/mpUA/非探针 POST/Traceback 全 0、重建窗源站 5xx 0；WAL `4,173,592` 同字节；probe=0 各表同 R529；`umst3` 32/45/22/1 新增 0；任意 uid 三表 04:52Z 起 0、`paper_exports` 05:22Z 后 0（仍 4 列）；`scan_sheet/paper_answers/paper/{code}` 全历史 29 条仍全探针；09-08 503 仍 75（R525-2）。**簇** 09-08 终值 6575/6499，last 07:06:37Z，至 08:12Z 66 min 无新行（观测窗内已停；09-07 是 01:11Z–23:59Z 全天、09-08 00:00Z 接续 → 隔日是否再起 R531 复查）；日报 humans.page 09-08 6575 = 簇量。无新的外部真人证据。
- 四道把关：QA = 后端 1 例 + 前端 8 例源锁 + 本地/生产 375/1440 四次走查（含改前改后 role 读数）；UX = 可点行高 45 ≥ 44、非可点行无假按钮、卡顶 52 不被固定头盖、合计只在全页齐后出；交叉 = 生产 `umst3` 真错题按 `question_id` 定位 + 历史 n=93 卷真 `pages:2`；合规/安全 = 生产 0 写入 0 PDF 0 LLM、非 kaogong 资源未动。
- 登记：R528-1（P3）并入「小程序 `pages/book` 结果 sheet 未接看错题/整卷合计」；R530-1（P3，教训入 SKILL）条件可点行走查必读 `role`/`tabindex`；整卷合计不落存储（跨天分次扫不出合计，有诉求再议）。
- 取证：`docs/iter/round-3/r530-scan-row-mistake-jump-all-pages.md`；`~/r530/{localb_r530.py,localb_375.out,prod_r530.py,prod_{375,1440}.out,prod_375_prefix_bbf978fb.out,prod_*_a1_result.png,prod_*_a1_jumped.png,prod_*_b_p{1,2}.png,r530_pre.sh,r530_pre2.out,r530b_pre.out,r530b_post.out,r530_deploy.log,r530b_deploy.log}`。
- 下一步 R531：(c) 补量 + 到期项/簇（隔日是否再起）；四维下一候选一手核（错题卡内「看错题」落点后的返回路径——是否需回结果 sheet / 扫描入口对已全部判分卷的重复扫描提示 / 错题本「按卷筛选」是否能从扫描结果直达该卷）→ 命中即论证→实修→发版→复采。

### R531（2026-09-08，实现轮）：扫描答题卡 / 手动录入「同卷同页完全相同的作答」只落库一次（`paper_submits` 按 `uid+code+page+作答指纹` `INSERT OR IGNORE` 判重）+ 回包 `saved/dup/dup_at` + 结果 sheet dup 说明行 + dup 时「看错题 ›」仍可跳；整卷模考 attempt 不去重；R531b 结果行 v-for key 带可跳态（生产一手 stale `tabindex`）；生产 `f0527f0e` → `3c38f238` → `47dc7b0a`；#668 已合入 main，R531 独立 PR
- 命中 B（本地 `:8525` 60 题卷 `5A43BB84` 同图重扫 `scan_sheet` ×2 / 同 picks 重交 `paper_answers`）：第二次又 `saved:true`，`answer_log` 3→6、同题 `mistakes.times` 1→2、**已复习推进的 `review_streak 1 / next_review 明日` 被打回 `0 / 现在`**——不是「缺提示」而是重复写库 + 绕过 R371 SRS。A「看错题落点后返回路径」：dup 语义成立后重扫同卡即零成本回到同一结果 sheet，不新造 sheet↔卡双向态 → 不改；C「扫描结果直达按卷筛选」：既有 R368/R369 按卷筛选 + R530 逐题入口已覆盖，无缺陷一手 → 不改不登记。
- 修：`db.paper_picks_hash(items)`（`sorted(qid:normalize_answer(picked))` sha1，只含 `status=='ok'` 行）/ `claim_paper_submit(uid,code,page,hash)`（幂等建表 `paper_submits PK(uid,code,page,picks_hash)`，`INSERT OR IGNORE rowcount==1` 才 claim，否则回既有 `created_at`；并发双发只一方写库）；`exam_api._persist_graded(uid,code,page,log_items,wrong,probe)` 统一 claim → `save_mistake` → `save_answer_log`，`scan_sheet` 传实际页、`paper_answers` 页恒 1、`/api/exam/submit` `code=None` 不去重；回包 `dup/dup_at`（`saved` 仍 = 本次是否写库）。前端 `paper-scan-pages.js scanDupNote(r, now)`（扫描「这一页」/ 手动「这份答案」，同日「今天 HH:MM」/ 跨日「M月D日 HH:MM」，警告色 `--warn`/`--warn-bg`）；`scanRowJumpable` 谓词 `saved` → `saved || dup`；汇总行「已记入做题记录」只在 `saved`。匿名不 claim 不标 dup；答案任一不同即新指纹正常写库。测试 `backend/tests/test_r531_paper_submit_dedupe.py` 9 例 + `frontend-uni/tests/book-r531-scan-dup-note.test.js`。
- **R531b（生产 `3c38f238` 首采 375/1440 一手）**：S0 legacy `saved:false` 段 no1 行 `role:None` 但 **`tabindex=0` 残留**（`NONJUMP_WITH_ROLE [{'no':'1','role':None,'tab':'0'}]`）。根因：前一段 D0 no1 可跳时 `a11y-focus.js` 在挂 click 监听时补了 `tabindex=0`（补丁只在 `addEventListener('click')` 时补、不回收），S0 同题号变不可跳，`:key="r.no"` 不变 → Vue 复用节点只改 `role`/监听，`tabindex` 残留成无 role 的无动作键盘落点（比 R530b 轻）。修 `paper-scan-jump.js scanRowKey(res,r) = no + (jumpable ? ':jump' : '')`，`book.vue` 行 `:key="scanRowKey(scanResult, r)"`，源锁新串 + `not.toContain(':key="r.no" class="scan-row"')`；不动 `a11y-focus.js`（全站补丁、无其它一手）。复采 `47dc7b0a` 全段 `NONJUMP_WITH_ROLE []`。
- 门：pytest 584（+4）/ ruff；vitest 140/946（+1 文件；R531b +2 例）、eslint 0 error（19 既有 warn）、tokens、build:h5（R531 `index-D4VJZUr-.js` / R531b `index-DyXegtPT.js`）；`diff --check` 空。R530b pytest 偶发 1 例：R531 `-x` 584 过 + R531b 不带 cache 再过 → **未复现、无法归因**（记账不改码）。
- 发版（`~/r531/r531_deploy.log` / `r531b_deploy.log` + `r531b_deploy_resume.log`）：R531 预检 load 2.01 / 5.0G / mem 390 MB / 兄弟 0；4/6 期间兄弟构建再起把 `/` 压到 **1.1G(98%)**（六次采样 `other_builds=1`），回落后 compose `rc=0` 08:44:42Z、rev/bundle = 本机、6b `/` 0.93/1.00/LCP 2812/CLS 0.06、`/tiku/` 1.00、`DEPLOY_RC=0`。R531b 预检 load 1.91 / 5.0G / 兄弟 0，build 中 `SoftCopyrightAgent compose prod --build` 再起（load 11、`other_builds=3`）→ **600 s 触顶 FAIL（R468 形态）**，按脚本提示等 `KG_COMPOSE_EXIT rc=0 09:06:54Z` 后 `DEPLOY_RESUME=1 --skip-build` 续 4a–6：rev `47dc7b0a` / bundle `index-DyXegtPT.js` = 本机、6b `/` 0.90/1.00/LCP 2813/CLS 0.06（load 10+ 下采样）、`/tiku/` 1.00、`DEPLOY_RC=0`。**Recreate 窗一手**：源站 Caddy 08:52–09:10Z 155 请求，503 ×2 均 `GET /api/health` 带探针头、09:06:30–56Z（旧容器停 → 新容器 healthy ~25 s），非探针 5xx 0；600 s 触顶后 compose 自行 Recreate 的秒级窗不可控（R457 形态）。
- 生产只读（`~/r531/prod_r531.py`，`umst3`，非 GET 全 abort，`prod_{375,1440}.out` 改前 / `prod_{375,1440}_b.out` 改后 + 截图；`paper_answers`/`scan_sheet` fulfill 本地真回包形态，不上传不写库）：服务端一手 health `3c38f238`→`47dc7b0a`、真 `GET paper/9D29E4AB {n 12,pages 1}`、`GET /api/mistakes` 定位 `#mc-2934`；**生产 `paper_submits` 表不存在**（首次 claim 才建）= 0 次 dedupe 写入。显示层 375/1440 同：D0 首次 `saved` 12 行仅 no1 可跳 `NOTES []`；S0 legacy 0 可跳；D2 跨日 dup「这份答案已于 9月5日 08:46 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响」（343×58 / 433×58）；D1 同日「今天 08:36」，点 no1 → `sheet_visible False`、`GET /api/mistakes` +1、`#mc-2934 top 52`、`track book_scan_jump` 发出被 abort；D3 扫描 dup「第 1 页」+「这一页已于 今天 08:44 …」；GET 非 2xx []、errs []。
- (c)（`r531_pre.out` 08:10Z / `r531b_post.out` 09:10Z）：两容器窗 5xx/assets 404/monitor/mpUA/非探针 POST/Traceback 全 0（Recreate 窗 503 ×2 全探针）；WAL `4,173,592` 同字节；`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38`（仍 4 列）；probe=0 `answer_log 53/2`；`umst3` 32/45/22/1 新增 0；任意 uid 三表 04:52Z 起 0、`paper_exports` 05:22Z 后 0；`scan_sheet/paper_answers/paper/{code}` 全历史仍全探针；09-08 503 仍 75（R525-2）。**簇** 09-08 终值 6575/6499、last 07:06:37Z，至 09:08Z 无新簇行（08h 28 行/4 IP、09h 1/1 为零散形态）；**隔日（09-09 00:00Z）尚未到 → R532 复查**。无新的外部真人证据。**宿主级第三轮连续命中**：R531b 后 `/` 再到 **555M(99%)**、load 15、`other_builds=2`、MemAvailable 257 MB；未动非 kaogong 资源。
- 四道把关：QA = 后端 9 例 + 前端源锁 + 本地 DB 前后对账（`answer_log`/`times`/`streak`/`next_review` 三态）+ 生产 375/1440 改前改后；UX = dup 说明行警告色 58px 两行可读、汇总行不再误报「已记入」、dup 仍可跳；交叉 = 生产真错题按 `question_id` 定位 + legacy 回包兼容；合规/安全 = 生产 0 写入（`paper_submits` 不存在 + WAL 同字节）0 PDF 0 LLM、非 kaogong 资源未动。
- 登记：R528-1（P3）并入「小程序 `pages/book` 结果 sheet 未接 dup 说明行」；**R531-1（P3，教训入 SKILL）** `a11y-focus.js` 补的 `tabindex` 不随 Vue 节点复用回收——`v-for` 行可点态随数据变化时 key 必须带该态，走查须同一进页内先可点后不可点并读 `tabindex`；R468/R457 形态再现（600 s 触顶 + Recreate ~25 s 窗，仅探针 503 ×2）；跨日 dup 文案不带年、`paper_submits` 无清理策略（有诉求再议）。
- 取证：`docs/iter/round-3/r531-paper-submit-dedupe-row-key.md`；`~/r531/{local_r531.py,local_{375,1440}.out,local_dup.py,local_dup.out,prod_r531.py,prod_{375,1440}.out,prod_{375,1440}_b.out,prod_*_{d0_first,s0_legacy_unsaved,d2_dup_crossday,d1_dup_today,d1_jumped,d3_scan_dup}.png,r531_pre.sh,r531_pre.out,r531_extra.sh,r531b_post.sh,r531b_post.out,r531_deploy.log,r531b_deploy.log,r531b_deploy_resume.log,pytest_r531b.out}`。
- 下一步 R532：(c) 补量 + 到期项/簇（09-09 00:00Z 后隔日是否再起——必须过日界再查）；四维下一候选一手核（手动录入层对已判过的同卷再次进入是否需预填/提示 / dup 说明行「看错题」以外的「查看本卷错题」诉求一手 / 小程序 `pages/book` 接 R528–R531 回包字段的成本论证）→ 命中即论证→实修→发版→复采。

### R532（2026-09-08，实现轮）：手动录入层对「本 uid 已判过分的同卷」进入即出历史提示（`GET /api/paper/{code}?uid=` 回包加 `submitted_pages[{page,first_at,last_at,n}]`，按 `paper_submits` 聚合；手动整卷 page 0 / 扫描 1..P）+ **不预填答案**；「查看本卷错题」不新增入口（无一手诉求）；小程序 `pages/book` 接 R528–R531 字段成本论证后不立项（R528-1 P3 扩项）；生产 `47dc7b0a` → `5869b401`；#669 已合入 main，R532 独立 PR
- 命中 A（本地 `:8525` 12 题卷 `340F4B53` 已判过分再进录入层）：录入层与首次进入零差别（「共 12 题 · 已选 0」、无任何「此前判过」痕迹），用户只能在交卷后才看到 R531 dup 行才知道重复。设计论证：**提示而不预填**——`paper_submits` 只存 `picks_hash`（`sorted(qid:answer)` sha1）没有原始 picks，预填需新增答案回显存储（扩隐私面 + 新表/新列）；提示只需只读聚合，且「再交完全相同不会重复记录、有改动会记新作答」把 R531 契约提前告知。否决：前端 localStorage 记「已交过」（换设备/清存储即失效、与服务端不同源）/ 用 `answer_log` 反查（无卷码维度）/ 预填。
- 修：`db.paper_submitted_pages(uid, code)`（`GROUP BY page`，`MIN/MAX(created_at)`，`COUNT(*)`=不同作答指纹数；表未建 `OperationalError` → `[]`）；`exam_api.api_paper_info(code, uid="")` `uid` 可选、`[:64]` 与 claim 同截断，无 uid 回 `[]`（旧客户端/无匿名 uid 形态不变）；H5 `book.vue` 手动查卷改 `request('/api/paper/'+code+'?uid='+encodeURIComponent(anonUid()))`，`paper-scan-pages.js paperSubmittedNote(p, now)` 生成「这份卷你已判过分：手动录入 今天 HH:MM（N 次不同作答） · 答题卡第 K 页 M月D日 HH:MM；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答」，模板 `<text v-if="manualPaper.n && paperSubmittedNote(manualPaper)" class="scan-note scan-dup">` 放在 R528 `inlineSkipNote` 行之前、R527 `n===0` 分支之外（源锁保持）。
- B「查看本卷错题」：R368/R369 按卷筛选 + R530 逐行「看错题 ›」已覆盖；生产 `scan_sheet/paper_answers` 全历史仍全探针、0 真人 → 无诉求一手，不新增入口不登记。
- C 小程序 `pages/book`：源码一手 `miniapp-native/miniprogram/pages/book/book.ts` 无 `scanResult/inline_n/pages/dup/saved` 任何引用（扫描/手动录入 sheet 未接 R528–R531 字段），估算 ~150–250 行 TS/WXML + 本地无真机/DevTools 通道只能单测 → 不立项，R528-1（P3）扩为「接 `inline_n/pages/page/saved/dup/dup_at/submitted_pages` + 逐行看错题 + 多页合计」整包，有真机通道再议。
- 门：pytest 586（+2 文件 R532 10 例合计）/ ruff；vitest 141/951（+1 文件 +5 例）、eslint 0 error（19 既有 warn）、tokens、build:h5（`index-M9JnAcJA.js`）；`diff --check` 空。R530b/R531 pytest 偶发例本轮未复现。
- 发版（`~/r532/r532_deploy.log`）：预检 load 2.66 / 4.5G(91%) / mem 320 MB / 兄弟 0 → `--skip-build` compose `rc=0`、新容器 09:38:43Z healthy 0 重启（~1.4 min，无 600 s 触顶）；bundle = 本机；6b `/` 0.93/**a11y 0.94 WARN**/0.96/1.00/LCP 2814/CLS 0 → 本机 lighthouse a11y 复采 ×3 全 1.00（`~/r532/lh_a11y_{1,2,3}.json`，R429 间歇形态，不改）；`/tiku/` 全 1.00；Recreate 窗源站 5xx 0；`DEPLOY_RC=0`。
- 生产只读（`~/r532/prod_r532.py`，`umst3`，非 GET 全 abort，`prod_{375,1440}.out` + 截图）：服务端一手 health `5869b401`、真 `GET paper/9D29E4AB?uid=umst3…` → `submitted_pages []`（生产 `paper_submits` 表不存在 → `OperationalError` 分支）；显示层 P0 真回包 0 提示行 12 行 `picked 0`；P1 route 把同一真回包 `submitted_pages` 改 `[{page 0,n 1}]` → 提示行 343×58 / 433×58 警告色、`picked 0`（不预填）；P2 `[{page 0,n 2,3 天前},{page 1,n 1}]` → 「手动录入 9月5日 09:40（2 次不同作答） · 答题卡第 1 页 今天 09:35」343×78 / 433×78；P3 删字段 → 0 提示行（旧后端兼容）；abort 仅 `track boot`；GET 非 2xx []；errs []；0 PDF / 0 LLM / 0 写入。**边界**：服务端「有记录 → 非空」只有本地一手 + pytest，生产不造写入。
- (c)（`r532_pre.out` 09:31Z / `r532_post.out` + `r532_db{,2}.out` 09:42–09:44Z）：两容器窗 5xx/assets 404/mpUA/401·403/Traceback 全 0，非探针 POST 2 条均本机出口 `140.232.64.4`（deploy 6b Lighthouse moto g UA，网段在 `KG_PROBE_CIDRS`）；WAL `4,173,592` 同字节；`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38`（仍 4 列）；`paper_submits` 仍不存在；`umst3` 32/45/22/1 新增 0；任意 uid `answer_log` 04:52Z 起 0。**簇到期项改写**：09-09 日界未到但簇 **09:34Z 同日再起**（`r532_cluster{,2}.out`：8 min 350 行 / 332 IP / 322 个 /16、每 IP 1、同一 Win/Mac Chrome UA 对、10 个请求头集合完全一致、en-US、无 Referer、全经边缘全 200、`/tiku/q/*` 逐题 1 次，~40 行/分）→ R531「07:06Z 已停」是观测窗内结论，实为暂停 ~2.5 h；归因仍推断，`classify()` 口径待老板。无新的外部真人证据。
- 四道把关：QA = pytest 10 例（空/无 uid/page 0/同答案不增/改答案 n=2/uid·卷码隔离/60 题卷 page 2/page 0+2 并存/时间字段）+ vitest 5 例 + 本地 375/1440 一手 + 生产 375/1440 四态；UX = 提示行沿用 R531 dup 警告色、375 三行 78px 可读、不预填避免「替用户答题」误感；交叉 = 无 uid/旧回包/表不存在三种兼容态；合规 = `submitted_pages` 只回时间与次数不回答案、uid 隔离、生产 0 写入。
- 登记：R528-1（P3）扩项见 C；R532-1（P3）「查看本卷错题」等真人扫描出现后再评；R531 遗留（跨年 dup/提示文案不带年、`paper_submits` 无清理策略）不变；`local_r532.py` 收尾对已自动关闭 sheet 重复 `close_sheet()` 触发 30 s timeout（发生在全部输出之后、不影响读数）。
- 取证：`docs/iter/round-3/r532-manual-entry-submitted-note.md`；`~/r532/{local_r532.py,local_{375,1440}.out,prod_r532.py,prod_{375,1440}.out,prod_*_{p0_real_empty,p1_manual_today,p2_two_records,p3_legacy_absent}.png,r532_pre.out,r532_post.out,r532_db.out,r532_db2.out,r532_cluster.out,r532_cluster2.out,r532_deploy.log,lh_a11y_{1,2,3}.json}`。
- 下一步 R533：(c) 补量 + 到期项/簇（09-09 00:00Z 后是否接续 / 09:34Z 再起段何时停）；四维下一候选一手核（录入层提示行 → 是否需直达 R369 按卷筛选 / 结果 sheet 与录入层提示时间口径同源锁 / 导出确认层是否需提示「此卷已判过」）→ 命中即论证→实修→发版→复采。

### R533（2026-09-08，取证轮）：三候选一手核——A 录入层提示行直达 R369 按卷筛选 **不可行不立项**（R369 键 `m.paper.pid` 只覆盖真题卷 `psource`，导出卷 `paper_exports.code` 无映射；本地 47 条导出卷错题 0 条带 `paper`）/ B 结果 sheet `dup_at` 与录入层 `first_at/last_at` **已同源**（同 `paper_submits.created_at`、同 `scanWhen`）只加源锁 pytest +1 断言、vitest +1 例 / C 导出确认层「此卷已判过」**不立项**（卷码 = 题集 md5，同题集重导同码、`created_at` 刷新但 `paper_submits` 不动 → R532 提示行再进录入层仍出；确认层在 POST 前无卷码）；0 产品代码、0 部署，生产仍 `5869b401`；#670 已合入 main，R533 独立 PR
- 一手：`~/r533/a_pid_vs_code.out`（`GET /api/mistakes?uid=r531ui375` 47 条 `paper` 0）；`~/r533/c_reexport.out`（同 60 题再导出 → `X-Paper-Code 5A43BB84`、`created_at 1788856694→1788861491`、`paper_submits 6→6`、`paper/5A43BB84?uid=` 仍回 `[{page 0,n 1},{page 1,n 2}]`）；源码 `exam_api.api_export_pdf` md5 卷码 / `db._paper_by_psource` / `paper-scan-pages.js scanWhen`。
- 门：vitest 141/952（+1）、eslint 0 error、tokens、build:h5；pytest 586 / ruff；`diff --check` 空（`~/r533/gate.out`）。
- (c)（`~/r533/r533_cluster{,2}.out` 09:52:57Z / 09:59:02Z、`r533_posts.out`）：容器 healthy 0 重启；`/` 3.9G(92%)、mem 368 MB、load 1 min 尖峰 3.84（无 `compose build`，未归因）；DB `1324/360/37/38`（`paper_exports` 仍 4 列）、`paper_submits` **表不存在**（R532「paper_submits 0」= `sqlite_master` 计数非行数）、`answer_log` 04:52Z 起 0、`umst3` `answer_log 45 / mistakes 32 / review_log 1` 不变、WAL `4,173,592` 同字节；非探针头非 GET 80 条全为本机出口 `140.232.64.{3,4}`（track/answer_log/mistakes/progress，探针网段）+ `34.186.26.24` `POST /` 403 ×4（直连扫描），外部真人写 0。**簇**：09h 966/965，09:34Z 再起段至 **09:59Z 仍在跑**（22–56 行/分，同 Mac/Win Chrome UA 对）→ 「何时停」未到、09-09 日界未到，两项转 R534。脚本改 `fromtimestamp(ts, timezone.utc)`、WAL 用 `sudo ls`。
- 登记：R532-1 并入「pid ≠ code、需按 `paper_exports.question_ids` 反查」事实；R533-1 信息项（同题集重导同码 + `created_at` 刷新，前端无引用，预期）。
- 取证：`docs/iter/round-3/r533-time-source-lock-candidates.md`。
- 下一步 R534：(c) 补量 + 到期项/簇（09:34Z 段何时停 / 09-09 00:00Z 后是否接续 / load 尖峰归因）；四维下一候选一手核（扫描结果 sheet dup 行是否需直达 R532 录入层历史 / 「最近导出的试卷」chip 对已判过分卷是否需标记 / `paper_exports` 重导刷新 `created_at` 对「最近导出」排序的影响）→ 命中即论证→实修→发版→复采。

### R534（2026-09-08，实现轮）：`/api/mistakes/redo` 无 `question_id` 行**先**走 `shizheng_questions` 索引等值查（生产 0.9 ms），未命中才回落 `questions` LIKE 前缀扫（生产单次 3.34 s × 2–3 阶）——生产 28 条无 qid 行 27 条为时政题，此前每条先白扫 2–3 遍 10.9 万活跃行；三候选（dup 行直达 R532 历史 / 「最近导出」chip 标已判过 / 重导 `created_at` 对排序）均不立项；load 3.84 归因宿主级 swap/iowait + 兄弟栈重建（推断）；生产 `5869b401` → `8ede6eb7`；#671 已合入 main，R534 独立 PR
- 改动：`backend/app/db.py` redo 循环——有 qid 行 `questions.id` 直查不变；无 qid 行 `head` 先 `_shizheng_redo_item(conn, head)` 命中即 `_sz` 项 + `mistake_id` + `continue`，未命中才进原 LIKE 阶梯（全文前缀 → 首行%次行% → 首行%，手录题语义不变）；`_shizheng_redo_item` docstring 注明顺序。前端/小程序 0 改动。测试 `backend/tests/test_r534_redo_shizheng_first.py` +4（thread-local SQL trace 计数：时政行 0 LIKE / 传统行 2 等值 + 4 LIKE / 有 qid 行 0 shizheng / `EXPLAIN QUERY PLAN` 走 UNIQUE 索引）。
- 一手：生产 `mode=ro` DB `mistakes` 360、`question_id IS NULL` 28（全未掌握、9 uid）、首行精确匹配 `shizheng_questions` 27；容器内 SQL 计时 LIKE 非命中前缀 3.34 s / 等值 0.9 ms（`~/r534/redo_scan.out`、`r534_db.out`）；发版后容器内只读 GET `redo?uid=umst3&limit=25` **19/7 ms**（25 项含 `_sz` 9）、`umtgohmz…` 4 ms（8 项全 `_sz`）、`umsagbor…` 4 ms（`r534_redo_timing2.out`）；改前端到端未实测（0 真人重练、不造对比），改前估 60–90 s 为推算。
- 门：pytest 590（+4）/ ruff；vitest 141/952、eslint 0 error、tokens、build:h5 `index-M9JnAcJA.js` = 线上；`diff --check` 空。
- 发版（`~/r534/r534_pre.out` / `r534_deploy.log` / `r534_post.out`）：预检 load 0.79 / `/` 3.0G(94%) / mem 194 MB / 兄弟 0 → `--skip-build` 10:27:15Z 新容器 `8ede6eb7` healthy 0 重启（~1.9 min）；bundle = 本机；6b `/` 0.98/1.00/1.00/1.00/LCP 1678/CLS 0.06、`/tiku/` 全 1.00；`DEPLOY_RC=0`；Recreate 窗 10:25–10:32Z 源站 204 请求 5xx 0；DB `1324/360/37/38`、`paper_submits` 表不存在、WAL `4,173,592` 同字节。
- (c)（`r534_cluster.out` 10:20Z / `r534_spike.out` / `r534_db.out`）：6 h 容器日志 5xx/Traceback/assets 404 0、`mistakes/redo` 0 次；`/` 3.9G → 3.0G → 2.4G(95%)（`recruit` 09:58Z / `softcopyright` 10:10Z 兄弟栈重建）、MemAvailable 194–344 MB；非探针非 GET 80 条无新增。**簇** 09:34Z 段至 **10:28:37Z 仍在跑**（24–49 行/分、同 Mac/Win Chrome UA 对）→ 「何时停」未到、09-09 日界未到，转 R535。**load 3.84**：`sar` 17:50→18:00 CST `0.33→3.26`、同窗 iowait 14–33% / majflt 1.7–3.2k/s / pswpin 1.6–3k/s，6 min 后 `recruit` 栈重建；kaogong 09:50–09:56Z 240 请求 `>1s` 0、无重启无 OOM → 事实：宿主 swap 抖动 + iowait；推断：兄弟栈重建前争用；未知：`docker events` 回空无精确时序。**Caddy 17:48 CST 已把 `zalize.com`/`www.zalize.com` 证书排队续期**（剩 26.3 天），结果 R535 查 journal。
- 候选：B dup 行直达 R532 历史——3 行路径（`closeScan()` → `manualOpenSheet()` → `manualLookup(code)`）已核但生产 0 真人判分无诉求 → 并入 R532-1；C chip 标已判过——chips 是客户端 `recentPapers` localStorage，标记需 ≤10 次 GET 或新接口 → 不立项；D 排序由客户端 `rememberPaper` `unshift` 决定、`created_at` 前端无引用 → 成立无影响。
- 脚本教训（入 SKILL）：`docker exec -i … curl` 容器无 curl 时 exec 失败且 `-i` 吞掉脚本剩余 stdin → DB 段整段未跑；`docker exec` 不带 `-i` 的 `python3 -` 读空 stdin 静默无输出 → 用 `docker cp` + `python3 /tmp/x.py`。
- 登记：R534-1 到期项（簇何时停 / 日界 / 证书续期结果）；R534-2 信息项（`created_at` 前端无引用）。
- 取证：`docs/iter/round-3/r534-redo-shizheng-first-load-spike.md`。
- 下一步 R535：(c) 补量 + 到期项/簇（09:34Z 段何时停 / 09-09 00:00Z 后是否接续 / Caddy 证书续期是否成功）；回真人有量路径：练习页时政 `_sz` 题作答后 mistakes 回写的 `question` 首行是否始终等于 `shizheng_questions.question`（28 条里 1 条未匹配的成因）+ 四维下一候选一手核 → 命中即论证→实修→发版→复采。

### R535（2026-09-08，取证轮）：`zalize.com`/`www.zalize.com` Caddy 续期**持续失败**根因 = 两域名 DNS 已切 Cloudflare 代理且**不回源本 VPS**（LE http-01 校验 IP 就是 CF AAAA、边缘回 404；tls-alpn 经 CF 不可协商；ZeroSSL 回落 `caddy_legacy_user_removed`），公网由 CF 边缘证书（GTS WE1，至 10-30）服务、边缘页面与源站 `/var/www/landing` 不是同一站点 → Caddy 两块为死配置，对用户无影响、需老板定是否删块；28 条无 qid 错题里唯一未匹配时政表的 `id 2836` = 小程序 DevTools 探针「问答页加入错题本」LLM 改写题干（`140.232.64.5`、`servicewechat.com/touristappid/devtools`），非时政非真人 → 真人 `_sz` 首行恒等成立；0 产品代码 0 部署，生产仍 `8ede6eb7`；#672 open，R535 从 R534 分支续开（避免 handoff/SKILL 追加冲突）
- 证书一手（`~/r535/r535_cert2.out` / `r535_dns.out` / `r535_origin.out`）：journal 08:49Z `attempt=17 retrying_in=21600 elapsed=129703 s max_duration=2592000`；`dig` A `172.67.208.162/104.21.15.239`、AAAA `2606:4700:3031::6815:fef/::ac43:d0a2` 与 LE 错误行校验 IP 逐字同；边缘 `server: cloudflare` + `cf-ray`、证书 `notAfter Oct 30`，body 44546 B `<title>zalize – Small, honest tools…` vs 源站 21509 B `<title>Welcome | ZALIZE`（md5 不同）；源站 LE 证书 10-04 16:38Z 到期；`kaogong-origin` 不受影响（11-17）。Caddy 该块无 `log` 指令 → journal host 计 0 不能当「无流量」证据。CF 侧配置未查（无凭据）。
- 行 2836 一手（`~/r535/r535_unmatched.out` / `r535_u2.out` / `r535_u3.out`）：`uid umtpnlge4mrl9kyxq` yanyu 病句辨析、90 字、`2026-09-06T10:20:39Z`、同 uid `answer_log` 0；Caddy 同秒 `POST /api/mistakes` → `POST /api/ask/cur`，无 answer_log；时政表 `head[:20]%` 0 候选、`questions` 全文前缀 0 / 首行前缀 1（`1272810`）→ R534 顺序对它正确（等值查未命中 → 原 LIKE 阶梯命中）。H5 `ask.vue save()` 带 `askQid(r.qid)`，小程序端此次未带（R535-3 信息项，并入 R528-1）。
- 不立项：非时政无 qid 行生产仅此 1 条且为探针产物；根治 LIKE 阶梯需 `questions(substr(question,1,N))` 表达式索引（10.9 万行、盘 94%）→ R535-1（P3，条件：真人无 qid 非时政行出现）。
- (c)（`r535_cert_cluster.out` 10:34Z / `r535_cluster3.out` 10:38Z）：簇 09:34Z 段至 **10:38:03Z 仍在跑**（34–50 行/分）、日界未到；容器 healthy 0 重启；load 2.95→2.50；`/` 2.4G → **3.1G(94%)** 回落（兄弟栈重建收尾）。DB/WAL 未重采（无部署）。
- 登记：R535-1（P3）；R535-2 信息项/老板决策（删 Caddyfile 死块）；R535-3 信息项（小程序问答页加错题不带 qid）。
- 取证：`docs/iter/round-3/r535-zalize-cert-rootcause-unmatched-row.md`。
- 下一步 R536：(c) 补量 + 到期项/簇（09:34Z 段何时停 / 09-09 00:00Z 后是否接续）；四维下一候选一手核（小程序问答页「加入错题本」是否带 `question_id` 源码核 / 错题本对无 qid 非时政行「重练」回落链路的用户可见态 / R534 后 redo 生产自然请求首个耗时样本）→ 命中即论证→实修→发版→复采。

### R536（2026-09-08，实现轮·小程序端）：小程序问答页深链 qid **从未随 `/api/explain/stream` 上送**（`api/social.ts streamExplain` 表单只有 `text/user_answer`；`applyMeta` 用服务端 `m.qid` 无条件覆盖本地 qid，缓存命中不回 qid 即清空 → 「加入错题本」落 `question_id NULL`，R535 `2836` 形态）→ 实修 `ExplainArgs.questionId` + 表单 `question_id`（`>0` 才带，与 H5 `api.js:570` 同口径）+ `applyMeta` `askQid(m.qid) || r.qid` + `ask.ts` 调用带 qid；图片题/非流式降级不带（服务端 `/api/explain` 无该参数、H5 同）；无 qid 非时政行「重练」用户可见态核成立不改；redo 自然样本仍 0（15 行全探针）；**服务端/H5 0 改动无 VPS 发版**，生产仍 `8ede6eb7`；#673 已合入 main，R536 从 main 另开分支
- 一手：`~/r536/probe_social.js`（tsc 编 `api/social.ts` 真码 + `wx.request` 打桩）改后 `WIRE_BODY …&question_id=9` → 本地 `:8525` `meta.qid 9` 9–13 ms（`probe_a_full.out`）；qid 0 无键（`probe_b.out`）；本地无 LLM key → 讲解正文未跑。生产 `explain_cache 82 行 qid 非空 0`；非探针 `explain/stream` 全日志 3 条（09-06 真 appid vivo 2 条 = R475/R477 对），是否带 qid 未知（不记 body）。
- B（`~/r536/b_redo_local.out`）：`redo?mids=7`（手录无 qid）→ `[]` → toast「错题未能匹配到题库原题」；`mids=7,2` → 1 `_sz` + R527 说明行；入口卡 `limit=10` 无 mids → 未匹配行静默掉（R527 有意边界，服务端不回未匹配数）→ R536-2（P3）。
- 测试：`frontend-uni/tests/miniapp-r536-explain-qid.test.js` 8 例（真跑 TS：表单三键 / 0·null·负·缺省无键 / 图片题 `uploadFile` 无 qid / 源锁 ask.ts 与 askQid）。门：pytest 590 / ruff；vitest 960（+8）/ eslint / tokens / build:h5 bundle 同线上；miniapp tsc 0 / eslint 0；`diff --check` 空。
- (c)（`r536_c1b.out` 10:55Z / `r536_c1c.out` 11:01Z / `r536_c2b.out`）：簇 09:34Z 段至 **11:01:14Z 仍在跑**（per10 372–422，10h 1192 行/372 IP），日界未到；非探针非 GET 0；容器 healthy 0 重启、5xx/Traceback 0；load 0.52 / `/` 3.8G(92%)；DB `1324/360/37/38/82`、`null qid 28`、`paper_submits` 不存在、WAL `4,173,592` 同字节。
- 登记：R536-1（P2 资源缺口：小程序须 macOS/Windows DevTools 上传才到真机，并入 R528-1）；R536-2（P3）；R535-3 关闭。
- 取证：`docs/iter/round-3/r536-miniapp-explain-qid.md`。
- 下一步 R537：(c) 补量 + 到期项/簇（09:34Z 段何时停 / 09-09 00:00Z 后是否接续）；四维下一候选一手核（小程序其它写错题路径——练习页/复习页 `postMistake` 是否同样漏 qid 或 `_sz` 守卫 / 小程序 `ask-prefill` 六入口 qid 覆盖面 / `explain_cache` 首个 qid 非空行观察）→ 命中即论证→实修→本地全绿→（小程序改动无 VPS 发版）→ 复采。

### R537（2026-09-08，运维 + 取证轮）：VPS Caddyfile `zalize.com`/`www.zalize.com` 两块死配置**已删并复验**（统筹者授权；备份 `/etc/caddy/Caddyfile.bak-r537`，精确删 428 字节 → `caddy validate` Valid → reload active → `kaogong-origin` health `8ede6eb7`/证书 11-17 不变、公网三域 200、兄弟四站 200、续期任务 `context canceled`、之后 10-min tick 起 `zalize.com` journal 行 0 → **老板侧无需任何操作**，R535-2 关闭）；小程序全部写错题路径 qid/`_sz` 守卫覆盖面**成立不改码**（`postMistake` 全仓 3 处：practice `:89` `_sz` 置 null / daily `:362` `_sz ? null` / ask R536；问答入口 4 个全经 `openExplain`/`redoQid` 契约；小程序无错题本/报告页 AI 讲解入口 → 并入 R528-1）；0 产品代码 0 应用部署，生产仍 `8ede6eb7`；#674 已合入 main，R537 从 main 另开分支
- 一手：`~/r537/caddy_pre.out`（改前块逐字 + `SUDO_OK` + `active`）/ `~/r537/caddy_fix.sh` + `caddy_fix.out`（备份/删/validate/diff/reload/复验/journal）/ `~/r537/r537_c.sh` + `r537_c.out`（(c) + reload 后 `zalize.com` 行 0 + 源站 385 请求 5xx 0）。还原命令见取证文档 §1。
- 服务端对照：`ai_api.py` 原文 key 缓存命中分支 `meta0` 不回 `qid`（非缓存分支回、`save_explain_cache` 落 qid）→ 两端客户端均本地保留，生产 `explain_cache.qid` 非空恒 0 = 无自然「深链 + 题库命中 + LLM 完成」行，指标有效 → R537-1（P3）不动。
- (c)（`r537_c.out` 11:26Z）：簇 09:34Z 段至 **11:26:12Z 仍在跑**（per10 389/391/260，11h 1040 行/350 IP），日界未到；非探针非 GET 0；redo 自然样本 0；容器 healthy 0 重启、5xx/Traceback 0；load 1.70 / `/` 3.1G(94%) / MemAvailable 309 MB；DB `1324/360/37/38/82`、`null qid 28`、WAL `4,173,592` 同字节。
- 登记：R537-1（P3）；R535-2 关闭；R528-1 追加小程序 AI 讲解入口缺口。环境蓝图无需更新。
- 取证：`docs/iter/round-3/r537-caddy-deadblock-miniapp-qid-coverage.md`。
- 下一步 R538：(c) 补量 + 到期项/簇（09:34Z 段何时停 / **09-09 00:00Z 后是否接续** / 6 h 内 Caddy `zalize.com` 续期行确认 0）；四维对标粉笔错题本 P0/P1 下一候选一手核（H5「已掌握」后再答错的回流形态 / 「恢复复习」批量对 `_sz` 行 / 到期推送数与首页到期数同源）→ 命中即论证→实修→本地全绿→发版→复采。

### R538（2026-09-08，取证轮）：三候选一手核均成立不改码；Caddy `zalize.com` 续期行 reload 后确认 0；簇仍在跑、日界未到；0 产品代码 0 部署（生产仍 `8ede6eb7`）；从 R537 分支（#675）续开
- A「已掌握」后再答错：`save_mistake()` dup 分支 `mastered=0, mastered_at=NULL, review_streak=0, next_review=now, times+1` → 回「待复习」今日到期；`book.vue` todo/done 按 `mastered` 分桶、掌握统计按 `mastered_at`，两侧一致。B「恢复复习」批量走 `PATCH /api/mistakes/{id}` 逐 id，与 `question_id` 无关，`_sz` 行恢复后进 `due_reviews`（LEFT JOIN 允许 NULL）。C 推送 `due_review_count(uid)` 与首页 `plan.py` `due(created_before=cn_day_start) + new_today` 同一函数，差异为 R438/R440 有意切分（当日新错题单列）。三项不立项。
- (c)（`~/r537/r538_c1.out` 11:33Z）：Caddy 两域 renew/queue 行 0（跨两个 10-min tick）、源站 704 请求 5xx 0；簇 09:34Z 段至 **11:33:40Z 仍在跑**（11h 1359 行/390 IP），**09-09 日界未到**；非探针非 GET 0、redo 自然样本 0、容器 healthy 0 重启、DB `1324/360/37/38/82`、null qid 28、WAL 同字节。
- 存量判断：R520 P0/P1 已全部上线复采；R521–R538 候选核结果均为「成立不改」或 P3；当前无新的有一手证据的 H5 P0/P1 可立项，剩余缺口为小程序整包/上传通道（资源）与需真人数据的 P3 → 建议后续降频为到期项复查 + 真人首条触发实修。
- 取证：`docs/iter/round-3/r538-mastered-reflow-push-due-source.md`。环境蓝图无需更新。
- 下一步 R539：09-09 00:00Z 日界后簇是否接续 / Caddy 6 h 窗满确认 / R534 后 redo 自然首样本 / `explain_cache.qid` 首个非空行；真人无 qid 非时政行或深链缓存命中行一旦出现 → R536-2 / R537-1 转实修。

### R539（2026-09-08，实现轮·统筹者要求回到实现）：R536-2 + R537-1 转代码上线；生产 `8ede6eb7 → cc3d6de0`；从合入 #675 后 main 另开分支，#676 合入后 merge 入
- R536-2：`GET /api/mistakes/redo` 回 `{items, skipped}`（`items` 不动；`skipped` = 本次扫描中去重后对不回题库原题的未掌握行数——手录 / qid 指向下线题 / 时政等值 + 题干三阶 LIKE 全落空；不计重复题干、空题干、扫描停止后的行；不是「全部待掌握里几题永远练不到」）。`db.mistakes_redo()` 新增、`mistakes_redo_questions()` 保留为 list wrapper。H5 `book.vue redoAll()`（入口卡「开始重练」）把 `skipped` 折成 R527 `redoSkippedNote(items+skipped, items)` 写 `redoNote` → 练习页开场 toast「已加载 N 题，另 M 题为手录/无题库原题，无法重练」与「重练所选」逐字同口径；`redoSel()` 不碰 `skipped`；空结果仍「错题未能匹配到题库原题」；老后端无 `skipped` 行为同改前。小程序 `learn.ts {items, skipped?}` → `book.ts` 路由透传 → `practice.ts` 开场 toast（`utils/redo-note.ts` 文案同 H5）。
- R537-1：`ai_api.py` 缓存命中 `meta0` 补 `qid = _cached_qid(hit, question_id)`：落库 qid（正整数）> 请求深链 qid（正整数）> None；`0/负/字符串` 不当有效 qid；非缓存/图片题/非流式/同款题语义不动。
- 门：pytest 598（+8）/ ruff / pyright 0；vitest 143 文件 966（+6）/ eslint 0 error / tokens / build:h5（bundle `index-M9JnAcJA.js → index-B_AVZd0x.js`）；miniapp tsc 0 / eslint 0 error；`diff --check` 空。本地 `:8525` uid `r522local`：`redo?limit=10` → `items 4 / skipped 1`（手录行）、`mids=7` → `0/1`、`mids=7,2` → `1/1`。
- 发版：预检 load 0.56 / `/` 3.8G(93%) / mem 186 MB / 兄弟 0 → `--skip-build` 11:59Z，compose 1.5 min `rc=0`、新容器 12:00:53Z healthy 0 重启、Recreate 窗 222 请求 5xx 0；6b `/` 0.99 / **a11y 0.94（间歇项）** / 0.96 / 1.00 / LCP 1912 / CLS 0；`DEPLOY_RC=0`。
- 复采（容器内只读 GET + 隔离临时库 `/tmp/r539.db`，`~/r539/post.out` / `post2.out`）：rev `cc3d6de0`；5 个真 uid `redo` 全带 `skipped`（均 0：**生产尚无自然 `skipped>0` 样本**，`skipped>0` 只有本地 + pytest 一手）；R535 行 `2836` 在 redo 口径下**可命中**（`items 1 / skipped 0`，R535「未匹配」是与 `shizheng_questions` 首行恒等口径，勘误）；缓存命中 `qid` 五种优先级在**部署后代码**上全对（落库 4321 / 4321+请求 7 → 4321 / NULL+7 → 7 / NULL → None / NULL+0 → None），0 LLM；DB `1324/360/37/38/82`、`explain_cache.qid` 非空 0、null qid 28、WAL 同字节 → 0 写入 0 PDF；新容器 5xx/Traceback/redo 行 0；非探针非 GET 2 条为本机 6b Lighthouse（`140.232.64.4` 探针网段）。
- (c)：簇 09:34Z 段至 **12:03:30Z 仍在跑**（per10 402–445），09-09 日界未到；Caddy 两域续期行 reload 后 47 min 仍 0（6 h 窗未满）。
- 如实：H5 端到端（入口卡 → 练习页 toast）生产未录屏（未授权 testing agent），只核 bundle 一致 + 接口契约；小程序改动仍未上真机（R536-1）；a11y 0.94 未归因。登记 R539-1（P3：错题本级「K 题无法重练」提示需全表匹配，等真人反馈）；R535-1 收益再降。取证：`docs/iter/round-3/r539-redo-skipped-explain-cache-qid.md`。环境蓝图无需更新。
- 下一步 R540：到期项（09-09 日界后簇是否接续 / Caddy 6 h 窗满 / redo 自然首样本含 `skipped` 分布 / `explain_cache.qid` 首个非空行）+ 四维对标下一实现候选（错题本入口卡「开始重练」按当前筛选态传 `qtype/module/reason` 是否与列表一致 / 小程序练习页 `_sz` 开场 toast 与 H5 逐字 / R539-1 触发条件）→ 有一手即实修→发版→复采。

### R540（2026-09-08，取证·不改码）：入口卡「开始重练」筛选态透传成立
- `book.vue redoAll()` 按 kpFilter(module+noqt / qtype) / filterMod / rzFilter / srcFilter / kp3Filter 拼参，`study_api.py api_mistakes_redo` 收 `qtype/module/noqt/uid/rz/src/t3/mids` 逐项对得上（`rz` 白名单 `_REDO_REASONS`）；`pidFilter` 走 `redoPaper()` 单独路径（R369）。其余为到期项，按 R538 降频方案暂停（`~/r539/r540_c1_note.txt`）。

### R541（2026-09-08，实现轮·主循环「复习 → 掌握」段）：复习判定消费服务端 `mastered`；生产 `cc3d6de0 → 74a5d62a`；从合入 #677 后 main 另开分支
- 差距（一手）：`POST /api/review/{mid}` 早回 `mastered`（`_advance_review`：`streak > len([1,3,7,15,30])` 即 `mastered=1` 并剔出 `due_reviews`），但 H5 `book.vue` / 小程序 `book.wxml` 只消费 `streak`/`next_review_days`，第 6 次答对仍显示「答对了！连对 6 次（下次复习：30 天后）」而该题当场已移出复习计划（本地 `:8525` 连答 6 次 `~/r541/local_flow.out`）；完成小结也不告知达成掌握数。P1，最小修 = 客户端消费已有字段，SRS 服务端 0 改动。
- 实修：H5 `review-summary.js` 新增纯函数 `reviewVerdict({extra, requeued, wasCorrect, streak, nextDays, mastered})`（掌握态「答对了！连对 N 次 · 已掌握，移出复习计划 ✓」且不拼「下次复习」；extra 优先；其余四态文案逐字不变；`mastered === true` 严格判定 fail-closed）+ `reviewSummary().mastered`；`book.vue` 模板收成 `{{ verdictText }}`、回包写 `cur._streak/_mastered`、快照恢复回填 `streak`、完成弹层「达成掌握 N 道 · 已移到「已掌握」，不再安排复习」。小程序 `types.ts ReviewRecordResp.mastered`、`utils/review-verdict.ts`（措辞沿用「解析」无勾号）、`book.ts` `RItem.streak/masteredNow`（`Mistake.mastered` 是 number，布尔态另名避免 TS2430）+ `rVerdict`/`celebrateMastered`、`book.wxml` 同两处。测试 +1 pytest（契约：1–5 次 false + 各档天数 / 第 6 次精确 / 强制到期不在 due）+12 vitest（五态 / fail-closed / summary / 快照 / 两端源锁）。
- 门：pytest 599 / ruff / pyright 0；vitest 144 文件 978 / eslint 0 / tokens / build:h5（`index-B_AVZd0x.js → index-ZYsItKK5.js`）；miniapp tsc 0 / eslint 0；`diff --check` 空。
- 发版：预检 load 1.44 / `/` 4.0G(92%) / mem 380 MB / 兄弟 0 → `--skip-build` 12:39Z，compose 3.3 min rc=0、新容器 12:42:11Z healthy 0 重启、bundle 一致、6/6 200、6b `/` 0.93 / a11y **1.00** / 0.96 / 1.00 / LCP 2806 / CLS 0.06，`/tiku/` 全 1.00；`DEPLOY_RC=0`。
- 复采（`~/r541/post*.out`）：rev `74a5d62a`；`GET /api/review?uid=` 三真 uid `total 30/8/3`、到期项内 `mastered` 行 0；部署后容器代码 + 隔离库 `/tmp/r541.db` `TestClient` 连答 6 次 → 第 6 次 `{'streak': 6, 'next_review_days': 30, 'mastered': True}`、到期 `total 0`，临时库已删；生产库 `1324/360/37/38/82`、WAL 同字节 → 0 写入 0 LLM；**`max(review_streak)=2`、`mastered=1` 2 行（全表 streak ≤ 2，非经复习达阈值）→ 生产无人到过阈值，新文案无自然触达样本**；线上 chunk `pages-book-book.CADBJ7-G.js` 含「移出复习计划」「达成掌握」。**Recreate 窗 12:41:58–12:42:38Z 5xx 43**（42 × 503 `/tiku/q/*` 全是抓取簇 39 IP、1 × 502 部署脚本自轮询 curl；0 真人；R457 已知形态，簇持续抓则每次发版必出，不新立项）；非探针非 GET 1 + `/api/review/cur` 2 均为本机 6b Lighthouse（`140.232.64.4`）。
- 如实：H5 端到端未录屏（未授权 testing agent）；小程序未上真机（R536-1）；快照恢复只有纯函数 + 源锁。登记 R541-1（P2：完成弹层是否需「已掌握」直达/「恢复复习」入口，等首个自然 mastered 样本）。取证：`docs/iter/round-3/r541-review-mastered-verdict.md`。环境蓝图无需更新。
- 下一步 R542：到期项（09-09 日界后簇是否接续 / Caddy 6 h 窗满 / redo 自然首样本 / `explain_cache.qid` 首个非空行 / 首个自然 `mastered` 回包）+ 主循环下一实现候选（练习页答对曾错题 R371 服务端推进 SRS 后的「已掌握」反馈是否同样缺失 / 错题本列表项 streak 进度可视 / 小程序复习快照 `streak` 恢复运行时）→ 有一手即实修→发版→复采。

### R555（2026-09-09，研究+实现轮·普通练习混入 ≤2 道本人到期错题 `/api/questions?mix_due=1`，卡面「曾错题 · 到期复习」、`answer_log` 以 `due_mid` 上送走既有 `via=answer` 推进，后端+H5+小程序 + 热修两条预取路径）：#717 从 main `fa1cb7f0` 开 `devin/1788916552-r555-due-mix`（已合入）；热修 #718 从合入后 main `fc335ed4` 开 `devin/1788917822-r555-fix-home-prefetch`（已合入）；研究/实修/复验 `docs/iter/round-3/r555-due-mix.md`
- 研究（源码 + 生产只读 `~/r545/q555*.py`）：① R554 候选 `practice.vue startPaper` 计时分支——`practiceLaunch{kind:'paper'}` 写入方仅 `book.vue`/`exam/list.vue` 且均 `untimed:true`，真实计时模考在独立 `pkgA/exam/exam.vue`（30 天 `exam_attempts` 30 行/17 uid）→ `examMode/examTimer/finishExam/confirmFinishExam` + 模板 UI 不可达，**本轮不清理**（0 用户感知、牵涉模板/键盘/onBackPress，登记 R555-1 P4 顺手再做）；② 小程序 `redoReport` 与 H5 `syncRedoReviews` 同三字段同文案，差异仅小程序无 `fixReport` 而此前普通练习根本抽不到曾错题，不立项；③ **主项来源**：`random_questions(uid)` 按 `answer_log` 排除答过的题 → 普通练习结构性抽不到自己的错题，R371 `via=answer` 推进只能在题库耗尽时发生；生产 71 个有错题 uid 全部有到期项、只有 8 个有过复习记录、隔天回来的 9 个里 3 个只刷普通练习 0 复习，30 天 `review_log` 35 行 `via` 全 NULL。竞品粉笔/夸克在日常刷题里错题自然回流。
- 实修 #717（+341/-16）：后端 `db.due_mix_questions(uid, limit, module, submodule, exclude)`（未掌握 + 到期 + `question_id` 非空 + `q.disabled=0` + 30 min 内未答；最早到期优先；同题去重；`foreign_module_qid` fail-closed）、`qbank_api` `DUE_MIX_MAX=2`/`due_mix_slots(n)=min(2,n//5)`/`interleave_due`（不占首题、均匀插入、总量 ≤ limit）、`api_questions(mix_due=0)` 仅在无 real/year/region/tag3/adaptive 且有 uid 时混，reinforce/grouped 早返回不经此分支；返回项多 `due_mid/due_streak`。H5 `practice.vue` `start()` 主请求/回退 + `prefetchNextGroup` 带 `mix_due=1`，`qCard.dueMix`、`kg-question-card` tag、`answer_log mid: q.mistake_id || q.due_mid`（redo 报告仍只认 `mistake_id`）；小程序 `LearnDrawParams.mixDue`、`practice.start` 非 reinforce 带、`Question.due_mid/due_streak`、wxml tag、`mid` 同口径。测试：后端 +5、H5 源锁 +5（R542 `mid` 源锁同步）、小程序源锁 +4。
- 本地门：pytest 735 / ruff / pyright 0（**须 `npx -y pyright --pythonpath ~/venv-kg/bin/python app`**，否则 `pywebpush`/`jwt` 2 个假 import 错）；H5 vitest 1200 / eslint 0 / build:h5；小程序 tsc / eslint 0 / vitest 51；diff --check 空。
- 生产一：`695c4712 → 61b45662`（功能分支直发，`index-BcNCvlJc.js`）。复验（`~/kaogong-reports/r555-prod-verify.md`、`~/r555-verify/`、录像 `~/screencasts/r555-695c4712-production/`（目录名沿用，实录 61b45662）+ `r555-desktop/`）：冷路径两视口 10 题含 2 道 `due_mid`（index 4/7、首题不混、标签可见）、答对 → `reviewed`/DB `via=answer` streak 0→1 `next_review` 推后/fixReport 1、再错 → `times 1→2` streak 0 无重复行、下一组成员正确、real/tag3/adaptive/year/region/reinforce/grouped/无 uid 全 0 due、limit 5/9 混 1、10 混 2、R553 重练/错题本 redo/F5/按卷/独立模考回归 PASS；749 响应全 200、console/runtime/付费 0、41 表精确删 74 行 `test-r555-%` 0 残留。**两条 FAIL（真实缺陷）**：① 首页→模块首组命中 `home.vue prefetchModule` 的 `prefetchPack`，该请求不带 `mix_due` → 10 题 0 due；② 第 8 题 `prefetchNextGroup` 时当组未答的到期题尚无 `answer_log` 被再次选中，客户端 `seen` 过滤后缓存 9 题 → 「再来一组」1/9。**五类全局 hash 不变 FAIL 但非本轮残留**：`answer_log 1387→1484`/`explain_cache 82→83` 只读归属为同期 `test-w17-*`（`probe=1`）其他会话探测，未动其数据——**同机多会话探测时「全局 hash 不变」不可作为本轮口径，改按前缀精确清理 + 漂移归属分账**。
- 热修 #718（+40/-7）：`home.vue prefetchModule` 补 `&mix_due=1`；`/api/questions` 新增 `exclude=<qid,…>`（`parse_exclude` 纯数字、上限 100，**仅并入到期题排除集**，不影响新题抽取/未传参调用方）；`prefetchNextGroup` 带 `exclude=当组 qid` 且 `items.length < limit` 不缓存预取包（改「再来一组」实时拉取）。有意不改：`offline.js downloadPack`/PDF 导出不带 `mix_due`（离线包到期态会过期）；小程序无预取路径。本地门 pytest 735 / ruff / pyright 0 / H5 vitest 1201 / eslint 0 / build:h5 / diff --check 空。
- 生产二：`61b45662 → 798c154f`（修复分支直发，`index-CPSBIGyW.js`，LH `/` 0.97/1.00/1.00/1.00、`/tiku/` 全 1.00；容器 healthy/restarts 0）。二次黑盒（`~/kaogong-reports/r555-fix2-prod-verify.md`、`~/r555-fix2-verify/`、录像 `~/screencasts/r555-fix2-798c154f-{mobile,desktop}/`）：375/1440 **热路径**首页预取带 `mix_due=1`、首组消费同序 10 题缓存（无新请求）、due 第 5/8 题标签可见；375 中场预取在一道到期题未答时 `exclude` 覆盖当组 10 qid、回包/缓存 10、overlap 0、「再来一组」**1/10** 且与上组无重复；SRS `mid→via=answer` streak 0→1、错题本 redo 无 mix_due、不计时按卷、独立模考回归 PASS；499 响应全 200、console/runtime/付费 0、41 表精确删 36 行 0 残留、五类 hash 首尾一致。**附带既有 UX（非 #718）**：redo 完成页「返回首页」实际 `navigateBack` 回错题本（`quit()` 栈 >1 分支）→ 登记 R555-2 P3。
- 如实：小程序未上真机（R536-1 累计）；`practice.vue` 计时分支 UNTESTED（UI 不可达）；「不足一组不缓存→实时重拉」分支未触达（两次预取均满包）；`exclude` 边界仅 curl + 单测；grouped 抑制未造同模块到期候选；harness 自动下一题固定延迟撞转场多造 1 条错题（已披露、已清）；发版二遇宿主同机 6 build + prune、mem_avail 213–366 MB、load 10–16，首跑 900s 未收敛（context 传输 784s），按脚本提示轮询 `/tmp/kg-compose-<rev>-*.log` 至 `KG_COMPOSE_EXIT rc=0` 再 `DEPLOY_RESUME=1 --skip-build` 续跑（**不要叠第二个 build**）；SKILL 追加 R555 段（热/冷路径分测、下一组五层证据、自动下一题状态谓词、SEO 隐藏导航定位、hash 分账）；仓库无环境蓝图且本会话无蓝图权限。
- 教训：新增 opt-in 查询参数时要一次枚举**所有**发同一接口的调用点（含预取/缓存写入方——本轮 `home.vue prefetchModule` 漏接）；客户端「过滤重复」与服务端「排除」须在协议层对齐，否则缓存包被过滤成短包。
- 下一步 R556：① R555-2 redo 完成页「返回首页」文案/落点一致（小改）；② 上线 ≥1 天回看首批自然 `due_mid` 触达（`review_log.via='answer'` 非探针行）与「曾错题」答对率；③ 候选一手核实——到期错题在首页/练习完成页的「今日回流 n 道」可感知汇总、顺手位 R555-1 计时分支清理、小程序卡面错因可点等真机、probe 真人口径；无反馈即按此推进。

### R554（2026-09-09，研究+实现轮·删 `practice.vue` 死码 `startExam` + 小程序练习结算态底栏与 H5 R553 同层级（有错题：主按钮「只重练本组错题（N 题）」/ 次级「再来一组」）+ 修小程序重练后「再来一组」只出 N 题，H5+小程序，0 后端）：#714 从 main `303369a1` 开 `devin/1788914025-r554-dead-exam-mp-done-bar`（已合入）；研究/实修/复验 `docs/iter/round-3/r554-dead-exam-mp-done-bar.md`
- 研究（源码 + git 史 + 生产只读 `~/r545/q554b-d.py`）：① `startExam` 自 60402715 起 0 调用方（模考入口 `goMini/goExamList` 走 pkgA/exam）→ 删；② 小程序 `practice.wxml` 重练是完成卡内 secondary 小按钮、底栏 primary 仍「再来一组」，与 H5 R553 层级相反 → 对齐；③ R553 候选「重练后再来一组回原规模」H5 正确（`retryGroup → start(lastModule)` 用 groupSize），**小程序 `onRetry` 沿用 `onRedoWrong` 改写的 `_args`（count=wrong.length, ptitle=本组错题重练）→ 新一组只 N 题且标题错** → 修；R553 上线后 36h 自然样本 `answer_log` 5 行 / 4 uid、`review_log` 0 行，无法判定 via=answer 自然触发，继续观察；`practice_results` 近 30 天非测试仅 1 行不能出 groupSize 分布。教训：首轮查询写错表名 `practice_result`（实为 `practice_results`，列 `n` 非 `total`），「no table」是工具错不是产品事实。
- 实修 #714：H5 删 `startExam(full)`（-69），`examMode/examTimer/finishExam/confirmFinishExam` 仍由 `startPaper` 引用；`r553-fix-loading-reviewed.test.js` 去 startExam 项 + 新 `r554-dead-start-exam.test.js`。小程序 `utils/done-bar.ts` `doneBarPlan(wrongCount, beiMode)`（与 H5 `wrongRetryPlan` 同口径），`kg-action-bar` 文案/事件走 `doneBar.*` → `runDoneAct` 分派既有 `onRedoWrong/onRetry/onQuit`，删卡内小按钮；`_groupArgs`（`mode!=='redoset'` 时记）+ `onRetry` 取 `_groupArgs || _args`；`scripts/done-bar.test.ts` 8 例。
- 本地门：H5 vitest 1192 / eslint 0 / build:h5；小程序 tsc / eslint 0 / vitest 47；diff --check 空。
- 生产：发版分支 `devin/1788914360-r554-deploy`（`695c4712`）`db847006 → 695c4712`（`index-C0q6uHnI.js`，LH `/` 0.92/1.00/1.00/1.00、`/tiku/` 全 1.00）；③ 仅小程序在发版后提交，不重发。复验（`~/kaogong-reports/r554-prod-verify.md`、录像 `~/screencasts/r554-695c4712-production/`）：375/1440 错 2 → 重练 primary/再来一组 ghost → 1/2 原序未选 items=2/redo=0 → 重练全对 → 再来一组 **1/10** 普通标题；全对 CTA；真实卷库计时模考（`pkgA/exam/exam`，倒计时 69:59→69:54、交卷、报告 attempt 370）；更多→按卷练习（真实 `startPaper` 不计时）首题 loading 已隐藏；首页模考入口落 exam/list；已答 1 题物理 F5 恢复；`startPaper/startDaily` warning 0；1100 响应全 200、console/runtime/付费 0、41 表精确删 58 行 0 残留、五类哈希一致。
- 复验规划期一手发现：`practice.vue startPaper` **计时分支**（`untimed=false`）全仓 `practiceLaunch{kind:'paper'}` 写入方仅 `book.vue:1836`/`exam/list.vue:364` 且均 `untimed:true` → 与 `startExam` 同属 UI 不可达（真实计时模考在独立 `pkgA/exam/exam.vue`），列 R555 候选。
- 如实：小程序 ②③ 未上真机（R536-1 累计）；`practice.vue` 计时分支 UNTESTED；跨 F5 fixReport 累计未专项重跑；清理后一次系统 `urllib` health 403（`curl` 同 URL 200）单列为外部探测异常未证实；SKILL 追加 R554 段（真实路由归属 / 物理 F5 核实 / 切视口后再最大化 / 封账窗口边界）。仓库无环境蓝图且本会话无蓝图权限。
- 下一步 R555：候选一手核实后择一——① `practice.vue` 计时分支（`examMode/examLeft/examTimer/finishExam/confirmFinishExam` + 模板）是否整体死码 → 清理；② 小程序 `redoset` 完成态 `redoReport` 与 H5 完成页字段/文案逐项比对；③ 自然样本（`via=answer` / `source=redo`）与 probe 真人口径继续回看。无反馈即按此推进。

### R553（2026-09-08/09，研究+实现轮·练习完成页「只重练本组错题（N 题）」普通练习与按卷统一错题重练入口（与小程序 `onRedoWrong` 对齐）+ 热修 5 处启动器 loading 配对 / `startDaily` 死回退 / `pendingSession` 持久 `reviewed`，仅 H5，0 后端/小程序）：#708 从合入 #706 后 main `6c4759d2` 开 `devin/1788910151-r553-retry-wrong`；#711 从 main `d07e01d5` 开 `devin/1788911838-r553-fix-loading-reviewed`；研究/实修/两轮复验 `docs/iter/round-3/r553-retry-wrong.md`
- 收尾：#706 合入后 `--skip-build` `a952a1cb → 6c4759d2`，复验 F 项 `startReinforce` 路径 warning 0（#706 生产坐实）。
- 研究（生产只读 `~/r545/q553*.py` + 源码）：R552 五候选**均不立项**（到期 >20 仅 2 uid 且 R552 已覆盖分组语义；复习小结 UX 无一手竞品操作台；小程序可点缺真机；probe 样本少；推送 `push_subs` 0 / VAPID 未配）。主项来自数据：近 30 天非测试 `answer_log` 309 行 **302 来自普通练习**、答错 169、26/39 uid 有错题但仅 6 有 `review_log`；H5 完成页仅按卷有「重练本卷错题」、普通练习只有「再来一组」换新题，小程序任何场次都有「只重练本组错题」。服务端 `save_answer_log_detail` 按 qid 命中未掌握错题即 `_advance_review(via=answer)` → 0 后端改动闭环。
- 实修 #708：`paper-continue.js` `wrongRetryPlan(items, ptitle)`（无错 → null；文案随 `paperFinishState(ptitle).isPaper`：「重练本卷错题（N 题）」/「只重练本组错题（N 题）」）；`practice.vue` `paperWrongN/retryPaperWrong → wrongRetry()/retryWrong()`，`done-acts` 一个重练按钮 `v-if="!beiMode && wrongRetry()"` `icon="rotate-ccw"` primary，「回卷库」「再来一组」随之 ghost；`retryWrong` 复用 `paperWrongItems` 剥运行时字段、保 `lastModule/_source/_ptitle`、末尾 `saveSession()`（R548 口径）+ toast。测试 `r553-retry-wrong.test.js` +8。
- 热修 #711（复验坐实两条既有 P3 当轮修）：① `uni.showLoading` 6 处中 #706 只修 `startReinforce`，`startPaper/startExam/startDaily/startShizheng/reviewShizheng` 同形态 → 统一「回包后立即 hide 再交互；catch 先 hide 再 toast；finally 只复位 `_starting`」；② `startDaily` catch 内 `this.start()` 被自身 `_starting` 互斥挡掉（回退从未生效）→ `fallback` 标记 finally 后再 `start`；③ `saveSession` 快照加 `reviewed`，`adoptLocalPending` 经新纯函数 `reviewedFromPending`（去重/fail-closed）还原，`logAttempts` 回包 concat 后未答完再 `saveSession()` 补写，`start()` 清 `_reviewed`。测试 `r553-fix-loading-reviewed.test.js` +11。
- 本地门：vitest 全量 1096 → 1182 → 发版树 1190 / eslint 0 error / build:h5 / diff --check 空；后端/小程序未改不重跑。
- 生产：① `deploy_h5.sh` `6c4759d2 → 8e5322af`（`index-DdbZnRB6.js`）；复验期间老板侧 merge main W15 进 #708 分支发版 `7c80ef29`；② 发版分支 `devin/1788912168-r553-deploy`（`7c80ef29` merge `f90d4cac`）`→ db847006`（`index-MGGo0gNb.js`，2b 谱系闸 OK，compose ~14 min，6/6 全 200，LH `/` 0.99 / a11y 1.00 / LCP 1398，`/tiku/` 全 1.00）。#708 → main `d10ed355`、#711 → main `303369a1`。
- 复验一（`8e5322af`，`~/kaogong-reports/r553-prod-verify.md`、`~/r553-verify/`、录像 `~/screencasts/r553-8e5322af-production/`）：A–F 功能项 PASS——375 错 2 → 「只重练本组错题（2 题）」primary + 再来一组 ghost → 1/2 原序、`pendingSession` items=2/redo=0；未答/已答 F5 恢复（R548 口径）；重练全对 → `review_log` 两行 `via=answer`、无重复 mistakes；1440 同题再错 `times 1→2` 不建新行；按卷 59/60 → 「重练本卷错题（1 题）」→ 1/1；#706 强化路径 warning 0；1561 响应全 200、付费 0、41 表精确删 126 行、五类哈希不变。**两条 FAIL 均既有 P3 → #711**：跨 F5 完成页 fixReport 1 而非 2；`startPaper` 1 条 loading 配对 warning。
- 复验二（`db847006`，`~/kaogong-reports/r553-fix-prod-verify.md`、`~/r553fix-verify/`、录像 `~/screencasts/r553fix-db847006-production/`）：375 跨 F5 `pendingSession.reviewed` 1 项保住 → 完成页「本组答对 **2** 道曾错题」PASS、1440 不刷新对照 2；按卷首题 toast 时 loading 已隐藏、`startPaper/startDaily/startShizheng/reviewShizheng/startReinforce` warning 全 0；CDP 合成 `daily_set` 500 → 回退普通 10 题 PASS；#708 回归 PASS；1324 响应 = 1322×200 + 2 预期合成 500、付费 0、console error/warning 0、41 表精确删 70 行、五类哈希一致。
- 如实：`startExam` UNTESTED——源码 `frontend-uni/src` **无任何调用方（死码）**，生产不可达；默认自动下一题后 F5，未另测「停留首题反馈再手动 Next」变体；非法/重复 `reviewed` 快照与 `mastered` 变体仅单测；服务端跨设备恢复不带 reviewed；复验一录像最大化的是背景 Chrome（1440 裁切，Playwright 截图完整）、按卷完成 CTA 完整像素截图未补；复验二 5 条 runtime 异常全为测试器 MutationObserver 过早观察（应用 0）；小程序真机（R536-1 累计）。SKILL 追加 R553 段（测试窗口真最大化核查、切 uid 勿立即 reload、warning 按堆栈归属、自动下一题/缓存失效/observer 时序）。仓库无环境蓝图且本会话无蓝图权限。
- 下一步 R554：候选一手核实后择一——① `startExam` 死码清理（顺手）+ 完成页「再来一组」在重练后是否应回到原题组规模（生产 `groupSize` 分布）；② 小程序练习页完成态与 H5 新层级（重练 primary / 再来一组 ghost）对齐核对（wxml 现状）；③ 首个自然 `source='redo'`/普通重练推进 `via=answer` 样本回看（R553 上线后 ≥1 天）；④ 复习小结 UX / probe 真人口径继续等样本。无反馈即按此推进。

### R552（2026-09-08，研究+实现轮·复习小结分组口径「本组 N 道完成 · 还有 M 道到期」+「继续复习下一组」CTA + 加练同类每轮上限 6 + 小程序 celebrateN 与 H5 同口径，H5+小程序，0 后端）：从合入 #704 后 main `ac98c0b8` 开分支 `devin/1788906738-r552-review-batch`；研究/实修/复验 `docs/iter/round-3/r552-review-batch.md`
- 研究（生产只读 `~/r545/q552*.py` + 源码）：R551 四候选**均不立项**——① H5 无 `review.vue`，复习是 `book.vue` `reviewing` 分支且答错已有错因自评 chip（小程序同）；② 卡面错因×顶部筛选联动无数据支撑（错因 7/287）；③ 小程序卡面错因可点缺真机通道暂缓；④ `mistakes.probe` 非测试全 NULL、真人样本刚起步。研究中发现主项：后端 `api_review_due` 返回 `items=due_reviews(limit=20)` + `total=全量到期`，而 H5/小程序完成层硬编码「今日复习已清零」→ 到期 >20 时**误报清零**（生产 285 道到期 / 71 uid，有 uid 到期 >20）；且 H5 `celebrateN` 排除 `_extra/_requeued` 而小程序直接 `rItems.length` 两端口径不一；自动加练同类无会话级上限。
- 实修：H5 `review-summary.js` 加 `REVIEW_BATCH=20 / REVIEW_EXTRA_MAX=6 / similarRoom(rItems, perItem=2, max) / reviewDueLeft(dueTotal, done) / reviewDoneCopy(done, left)`；`book.vue` `dueTotal/dueLeft` 状态、`doneCopy` computed、小结标题/正文/CTA 三态（`left>0`：「本组复习完成」「本组 N 道复习完成 · 还有 M 道到期待复习」+ 主按钮「继续复习下一组（min(M,20) 道）›」+ 次级「强化 5 道新题/回错题本」；`left=0` 保持 R550 清零层），`continueReview()` 埋点 `review_entry_click/next_batch` → 关层 → **总是** `await load()` → 有到期 `startReview()` 否则 toast「到期错题已复习完」；`load()` 在 celebrate 打开时用服务端 `total` 覆盖估算 `dueLeft`；加练 `similarRoom` 为 0 直接 return，`limit=room`/`slice(0, room)`。小程序 `utils/review-verdict.ts` 同名同语义（清零标题保留「！」），`book.ts` `dueLeft/celebrateCopy` + `onContinueReview` + `appendSimilar` 上限 + `celebrateN` 改 `!extra && !requeued`；`book.wxml` 三态 + `.cb-left`。
- 本地门：pytest 726 / ruff / pyright 0；vitest 全量 1087（+10 `r552-review-batch-left.test.js`；R541/R549/R550 源锁按新 import/`setData`/`:title="doneCopy.title"` 更新）/ eslint+tokens+edge 0 / build:h5 `index-DGKBsjUz.js`；小程序 tsc+eslint 0 / vitest 29（`review-next.test.ts` 源锁更新）；diff --check 空。#705 合入 main `74eb19aa`。
- 生产：`deploy_h5.sh --skip-build` `f8fd391d → a952a1cb`（compose ~110s；回归全 200；LH `/` 0.99 / a11y 1.00 / LCP 1436，`/tiku/` 全 1.00）。**黑盒复验（testing agent，a952a1cb 双视口 uid `test-r552-{group,count,cap}-*`，`~/kaogong-reports/r552-prod-verify.md` + 录像 `~/screencasts/r552-a952a1cb-production/` + `~/r552-verify/`）A–D 双视口全 PASS**：23 道到期 → `total=23/items=20`「复习 1/20」→ 首组小结「本组 20 道 · 还有 3 道」+「继续复习下一组（3 道）›」无清零措辞 → 单击 CTA 新 GET review 直接「1/3」→ 清零层无 CTA、待复习 0；每宽 23 条 review_log 全 correct=1/probe=1；4 原题+1 重出+2 加练小结仍「到期 4」；8 题首四错加练 2/4/6/6、仅 3 次 `limit=2` 请求、第四错无请求；边界：组中途新增到期→小结由估算 1 更新为服务端 2、另一客户端清完余题后点 CTA 空回包 toast；R546/R549/R550/R551 回归 PASS；2266 响应全 200、429 API 全 probe、付费 0、console error/exception/rejection 0；41 表精确删 231 行 + 前缀 0 残留、五类全局 SHA-256 不变。
- 如实：**FAIL（严格零 warn）**——375 点「强化 5 道新题」console 1 条 uni-h5 `showLoading 与 hideLoading 必须配对使用`（`startReinforce`），功能正常进入 1/5；核源码为**既有 P3 非 R552 回归**（`try` 内 toast 顶掉 loading 后 `finally hideLoading`），**已热修 #706**（回包后先 hide 再 toast + 源锁，vitest 1088 / lint / build 绿，待合入随下轮发版回归）。埋点实发 `source=next_batch`（`trackEvent(event, source)` 一贯口径，测试指令写 `label` 为口径差异非缺陷）。UNTESTED：`limit=1` 加练分支、显式「退出复习」后重进独立断言、手录全流程/PDF 与 R545/R546 回归未重跑、小程序真机（R536-1 累计）。`dueLeft` 首帧为估算（`total - 本组原始到期完成数`），`load()` 回包后以服务端为准。SKILL 追加 R552 段（独立 mid 分组核证、加练上限逐步证据、CDP warning+error 双审计、取消按 requestId 对齐、并发边界隔离 uid）。仓库无环境蓝图且本会话无蓝图权限。
- 下一步 R553：#706 合入后发版并回归 warn 归零 → 候选一手核实后择一——① 复习小结「首答对 N 道（pct%）」与「连对/下次复习」信息层级 UX 走查（对标粉笔复习小结）；② 到期 >20 时错题本入口「今日待复习 N」是否需提示「分 k 组」；③ 小程序卡面错因可点（等真机通道）；④ `probe` 真人口径错因覆盖率（继续等样本）。无反馈即按此推进。

### R551（2026-09-08，研究+实现轮·H5 错题本列表卡直显「错因」标签（与小程序对齐，未掌握可点直达错因自评）+ `mistakes/review_log` 入库侧探针打标，后端+H5）：从合入 #702 后 main `9a969e53` 另开分支 `devin/*-r551-card-reason-probe`；研究/实修/复验 `docs/iter/round-3/r551-card-reason-probe.md`
- 研究（生产只读 `~/r545/q551*.py` + Caddy 日志 `~/r545/log551.sh` + 游客首页 375/1440 Playwright 截图 `~/r545/shot551.py` + 源码）：四候选中**只立项 H5 卡面错因**——小程序 `m-meta-warn` 卡面直显、H5 仅在更多操作层可改，生产非测试 287 行错题仅 7 行有错因（4/71 uid）；手录题编辑：`update_mistake` 白名单仅 `{error_reason, mastered}`、`source='manual'` 生产 0 行无需求信号，不立项；G3 游客首页：hero 已含「错题按遗忘曲线复习」叙事、`boot` 是每日版本心跳非转化事件（232 boot uid 仅 8 随后作答，但 56 作答 uid 无 boot），缺口径不立项；自然 manual 样本 0。研究中发现 `mistakes`/`review_log` 无 `probe` 列（`growth_events`/`answer_log` 自 R374 有，近 7 天 boot probe=1 占绝对多数），每轮研究只能 `uid NOT LIKE 'test-%'` 粗排 → 作为配套副项补齐。
- 实修：H5 `book.vue` mhead「手录/模考」后加 `<view v-if="m.error_reason && !m.mastered && !batchMode" class="rzbadge-hit" role="button" @click.stop="itemSheet(m)"><kg-tag tone="warn" icon="pen-line">` / 否则只读 `kg-tag`（可点条件与更多操作层「错因自评」`v-if="!mastered"` 对齐，`.rzbadge-hit` 复用 `.pbadge-hit` 40px 触达）；后端 `db.py` `mistakes`/`review_log` 加 `probe INTEGER`（前者 init 迁移、后者首次 review 懒迁移），`save_mistake(rec, probe)`/`record_review(..., probe)`/`_advance_review(..., probe)`（去重 UPDATE 不改原标）、`_hydrate_mistake` pop `probe` 不外泄；`study_api` `/api/mistakes`、`/api/review/{mid}` 传 `auth.probe_request(request)`，`exam_api._persist_graded` 沿用 probe。小程序 0 改动。
- 本地门：pytest 726（+4 `test_r551_mistake_probe.py`）/ ruff / pyright 0；vitest 全量 1077（+4 `r551-card-reason-badge.test.js`）/ eslint+tokens+edge 0 / build:h5 `index-UtFtKsU-.js`；小程序 tsc+eslint 0 / vitest 29；diff --check 空。#703 合入 main `ac98c0b8`。
- 生产：`deploy_h5.sh --skip-build` `3c3a582d → f8fd391d`（宿主空闲 compose ~90s；7 变体 JS，回归 200，LH `/` 0.97 / a11y 1.00 / LCP 1835，`/tiku/` 全 1.00）。**黑盒复验（testing agent，f8fd391d 双视口 uid `test-r551-*`，`~/r551-verify/R551-f8fd391d-production-verification.md` + 录像 `~/screencasts/r551-f8fd391d-production/`，#703 评论附两视口截图）全 PASS**：真实手录有/无错因两题 → 卡面 warn 标签 + `role=button` / 无错因无新元素 / mhead 无溢出；点标签开更多操作层 chip 选中 → 改选 PATCH 200 关层后卡面即时更新 → 再点取消标签消失 DB `''`；已掌握只读点击仅展开卡、恢复后可点、批量只读点击选卡；DB：浏览器 5 mistakes / 4 review_log `probe=1`、`review_log` 懒迁移已加列、列表无 `probe` 键、无探针头 curl（UA 路径）打 1、重复保存同 id `times=2` 标不变；回归：1 字题干客户端+服务端 400、自然复习清零一次返回、题型组 chips、redo→返回保留 `kp`；511 响应 = 509×200 + 2×预期 400、304 0、取消 3（2 图 + 1 测试器过早返回已重测）、console/runtime/rejection 0、付费 AI/OCR 0；41 表精确删 28 行 + `test-r551-%` 0 残留、四类全局哈希不变（`paper_exports` 38→38、`explain_cache` 82→82）。
- 如实：UNTESTED——`probe=0` 分支（伪造 `X-Kg-Ip` 被公网边缘覆写，生产无可信非探针出口）、异分类去重/模考错题打标/`via=answer` 连带打标/首次懒迁移仅单测；更多操作层改选 chip 不自动关层（既有行为）；历史 `probe NULL` 行不回填；小程序/真机（R536-1 累计）。SKILL 追加 R551 段（卡面标签 scope、probe 口径与懒迁移、probe=0 不可生产验证）。仓库无环境蓝图且本会话无蓝图权限。
- 下一步 R552：候选一手核实后择一——① 复习页/复盘卡是否同缺错因直显（H5 `review.vue` 核）；② 卡面错因标签与顶部错因筛选联动（UX 论证）；③ 小程序卡面错因可点对齐 H5；④ ≥3 天后按 `probe=0/NULL` 真人口径重跑错因覆盖率看卡面可见是否抬升填写；手录题编辑 / G3 首页叙事继续等样本与口径。无反馈即按此推进。

### R550（2026-09-08，研究+实现轮·错题本「手录错题」自由录入（免 AI / 不对回题库，`source='manual'`）+ 复习清零小结与强化建议合层、「回错题本」直达，后端+H5+小程序）：从合入 #699 后 main 另开分支 `devin/*-r550-manual-entry`（rebase 到 `96d73db7`）；研究/实修/复验 `docs/iter/round-3/r550-manual-entry-celebrate.md`
- 研究（生产只读 `~/r545/q550.py` + 源码）：清零 CTA「回错题本」实际是 `closeCelebrate → fetchReinforce()`，有 `picked` 弹第二层、无 `picked` 弹 success toast，文案与去向错配，且推荐层真实转化几乎为 0（`reinforce_log` 非测试 2 行 / 2 uid、`review_done_celebrate` 3 行）→ **立项**；G1「手动录入答案」实为卷码答题卡关联（`/api/paper/<code>`），`mistakes` 无 options 列、`question_id IS NULL` 非测试 28 行全为时政内联/言语，无任何自由手录来源 → **立项主项**；G3 游客首页叙事（71 uid 有作答 = 71 uid 有错题）属落地页 UI 维度留候选。
- 实修：后端 `manual_mistake.py`（`is_manual/normalize`：模块受限 6+时政 / 题干 ≥2 / 正确答案 A–D 归一 / 我的答案≠正确 / 错因 4 档 / 强制 `question_id=None, source='manual'` / 逐行 trim ≤2000），`study_api.api_save_mistake` 仅 `source=='manual'` 走 normalize，`ValueError→400`；`team.py` 白名单 + `manual_entry_open/save`。**不新增 schema**——选项让用户连题干一起粘贴（与时政内联题同形态复用列表/复习/PDF 三链路）。H5 `book-manual-entry.js` + `book.vue`：FAB 首项「手录错题」（原卷码功能改名「按卷码录入答案」保留）、kg-sheet 表单（模块 chips wrap / 题干 textarea / 正确+我的 A–D 格 / 错因 chips / 解析 / 行内错误 / 「加入错题本」+ 明示不参与重练）、列表卡「手录」、键盘守卫 + `entryOpen`；清零合层：最后一题判定即清旧建议→开小结→预取 `/api/reinforce/suggest`（回包晚于关闭丢弃），有 `picked` 内嵌考点卡 + 主按钮「强化 5 道新题（未做过）›」+ 次级「换个考点 / 回错题本」，无 `picked` 单一「回错题本 ›」，删独立强化 sheet /「下次再说」/ success toast。小程序 `utils/manual-entry.ts` + `api.postManualMistake` + `Mistake.source` + `book.wxml/ts/wxss` 同口径（工具格 `manual` 改开新 sheet，卷码录入作 sheet 内次级链接）。
- 本地门：pytest 722（+14 `test_r550_manual_mistake.py`：normalize 各分支 / API 400 / uid 隔离 / 去重 times / 非 manual 兼容 / review 可用 / redo skipped）/ ruff / pyright 0；vitest **全量** 1073（157 文件，+`r550-manual-entry-celebrate.test.js`，R519 wrap 源锁改为两处）/ eslint+tokens+edge 0 / build:h5 `index-BPibKz__.js`；小程序 tsc 0 / eslint 0 / vitest 29（+`scripts/manual-entry.test.ts` 12，R549 源锁按新 `setData` 更新）；`diff --check` 空。代码 #701（已合入 main `f193a69f`）。
- 生产：`deploy_h5.sh --skip-build` `34bb5207 → 3c3a582d`（宿主空闲 compose ~90s 收敛；bundle `index-BPibKz__.js`，7 变体 JS，回归 200，LH `/` 0.93 / a11y 1.00 / LCP 2802、`/tiku/` 全 1.00）。**黑盒复验（testing agent，3c3a582d 双视口 uid `test-r550-4418e8d625/990e16b2e9`，`~/r550-verify/R550-3c3a582d-production-verification.md` + 录像 `~/screencasts/r550-3c3a582d-production/`）功能项全 PASS**：FAB 命名 / 4 步客户端校验文案 / 真实表单保存 200 → DB `source=manual, question_id NULL`、逐行 trim / 「手录」标签 / 1440 同题干再存同 id `times=2` + 「再错一次」toast / 3 个非法体 400 中文 / 2500→2000 字 / 埋点 9 行落库 / uid 隔离 / 手录题**自然到期**复习 A–D 字母格 review 200 / 手录-only redo `items=[] skipped=2`、混合 redo 2+`skipped=1` 提示 / 手录-only PDF 实下载 `pdftotext` 核题干+答案+解析+「我的错答 A · 错因：概念不清」/ 375 sheet 滚动可达提交 A–D 双列不溢出 / J-K 守卫 / 无建议小结「明天 2 道」仅「回错题本 ›」/ 有建议小结「明天 3 道」+ 内嵌考点卡 + 三按钮 / 换个考点 / 两分支「回错题本」一次到列表、无旧层无 toast / 强化实取 `/api/questions?mode=reinforce&limit=5…` 5 题同考点与已答交集 0 / R546–R549 回归抽检；682 响应 = 679×200 + 3×**预期** 400（非法体项）、canceled 3 图、console/runtime/rejection 0、146 API 全 probe、付费 AI/OCR 0；41 表精确删 31 行 + `test-r550-%` 0 残留、全局 `paper_exports` 38→39→38 按 code 精确删、questions/taxonomy/explain_cache/paper_exports 四类 SHA-256 不变。testing agent 报的 2 项「FAIL」核源码后均为**测试指令口径写错**（H5 列表卡从不在卡面显示错因，错因在「更多操作」/筛选/复盘；H5 `startReinforce` 一贯经 `practiceLaunch` storage 启动而非小程序式 URL query），非产品缺陷，取证文档如实单列。
- 如实：UNTESTED——1440 独立 PDF 下载、完整物理键盘、mastered/多天/加练去重深分支、混合题库+手录 PDF、严格「先渲染再请求」像素时序（request 早于标题 DOM 观测 ≈45ms，Vue 同 tick 正常）、小程序/真机（R536-1 累计）。手录题不参与重练（表单明示）、选项无独立存储、多选答案允许但 UI 未标「多选」；H5 与小程序卡面错因显示两端既有不一致（H5 无 / 小程序有）登记候选。SKILL 追加 R550 段（手录 fixture、强化候选造数、时序口径、预期 400 分类、PDF 全局清理、controller 退出）。仓库无环境蓝图且本会话无蓝图权限。
- 下一步 R551：候选一手核实后择一——G3 游客首页错题本价值前置（落地页 UI 维度，需 UX/UI 出稿）/ H5 列表卡面错因标签与小程序对齐（小改）/ 手录题「编辑」入口（PATCH 既有 `question_text/explanation`？需核 `patchMistake` 白名单）/ 首个自然 `source='manual'` 与 `manual_entry_*` 生产样本回看；无反馈即按此推进。

### R549（2026-09-08，研究+实现轮·PDF 导出附「我的错答/错因」+ 复习清零小结「下次复习」排期与「回错题本」CTA（H5+小程序）+ `wd-segmented` H5 resize 重测，后端+H5+小程序）：从合入 #694 后 main `4e8cdf3c` 另开分支 `devin/*-r549-export-mistake-notes-review-next`；研究/实修/复验 `docs/iter/round-3/r549-export-notes-review-next.md`
- 研究（生产只读 `~/r545/q549*.py` + testing agent UX 走查 rev `9b4a511c` `~/r549-ux/R549-UX-report.md`）：R548 三候选均不立项——复习 `secs` 生产仅 1 行 `>0`（29s）样本不足；常识错题 63 行 `submodule` 全落现有 taxonomy 无别名漏网；每日一练无独立 `source` 值、`mid` 仍无证据；`answer_log.source='redo'` 首批 6 条已落。UX 走查坐实 G1 P2「手动录入答案」实为卷码关联无免 AI 自由手录表单（**未做，R550+ 候选**）、G2 P2 PDF 参考答案页丢用户 `error_reason/user_answer`、G3 P3 游客首页叙事偏刷题（未做）、G4 P3 清零 CTA「太棒了，继续 ›」不指路、G5 P3 讨论页 `wd-segmented` resize 后滑块错位（同宽 F5 对齐）。
- 实修：① `POST /api/export/pdf` 可选 `mistakes:{qid:{picked,reason}}` + `items[].picked/reason`（内联题）→ `pdf_export.mistake_note/parse_mistake_notes/note_text`，参考答案页 `n. 答案 X　<red>我的错答 B · 错因：粗心大意</red>　解析`，卷首 `· n 题附我的错答/错因`；无 `mistakes` 输出逐字不变。信任模型 = 请求方自带自己错题本数据（与 `items` 内联题干同），服务端不按 uid 查、`paper_exports` 不落批注。H5 `export-confirm.vue` prop `reviewable` → chip「含我的错答/错因」（默认开、需含解析或仅答案）→ `with_notes`；`book-export.js exportNote`（错选==标准答案不算错答）/`exportNotesMap`；首页/试卷导出不传 `reviewable` 不变。② `review-summary.js nextReviewText`：每题 `next_review_days` 落 `_nextDays` → `下次复习：明天 n 道 · k 天后 m 道`（重出以最后一条为准、`_mastered` 不排期、`_extra` 不计、无样本不显示）；CTA →「回错题本 ›」；小程序 `utils/review-verdict.ts nextReviewText` + `book.ts/wxml` 同口径。③ `seg-resize.js segResizeMixin`（H5 `uni.onWindowResize` 120ms 防抖 → `$refs.seg.updateActiveStyle(false)`，`beforeUnmount` off）接入全部 6 个 `wd-segmented` 页面（dev/design 除外，测试 `git ls-files` 枚举防漏）。
- 门：pytest 692（+14）/ ruff / pyright 0；vitest **#695 提交时只跑专项+改过的锁、全量未复跑 → 漏 `book-r541` 小程序 import 锁 1 红**，#696 补齐后 155 文件 1058 全绿；eslint + tokens + edge 0 / build:h5；小程序 tsc 0 / eslint 0 / vitest 17（+`scripts/review-next.test.ts`）；`diff --check` 空。教训：源锁改动后必须全量跑一次再提交。
- 生产：`deploy_h5.sh --skip-build` `9b4a511c → 8dc0c4b0`——宿主同机 3 个其他 build（load 8–17、mem_avail 2xxMB）致 compose 600s 未收敛、脚本按设计 FAIL 退出、后台 compose ~20 min 后 rc=0，`DEPLOY_RESUME=1` 续跑通过（bundle `index-BfI_81xM.js`，7 变体 JS，回归 200；部署时 LH `/` 0.83/LCP 3700 瞬时，独立重跑 0.92/2693）。#695 合入 main `39e92b63`。**黑盒复验（testing agent，8dc0c4b0 双视口 uid `test-r549-verify-*`，`~/r549-verify/R549-8dc0c4b0-production-verification.md` + 录像 `~/screencasts/r549-8dc0c4b0-production/`）**：A② 真实错题（UI 错选 B/A，1 题 UI 设错因）→ 请求含 `mistakes` → `pdftotext` 核 `我的错答 B · 错因：粗心大意`/无错因题仅 `我的错答 A`/卷首「2 题附」/题干答案解析机读卡仍在 PASS；A③ 关 chip 请求无 `mistakes` PDF 无「我的错答」PASS；A④ 1440 PASS；A⑤ 真实时政 UI 错答 `question_id=null` → `items[0].picked/reason` 入 PDF PASS；B 3 到期（1 错重出）+2 加练 → 「下次复习：明天 3 道」与 4 次回包按 mid 去重一致、CTA 文案 PASS；C 讨论/收藏 375↔1440 正反 + F5 滑块误差 0px（另 OS 拖 568→1352）PASS；D 首页/试卷无 chip、`?mod=` 切 tab 2→2、未答重练前进/F5 `redo=1` PASS；E 1023 = 1004×200 + 19×304、4xx/5xx/console/runtime/rejection 0、canceled 2 图、付费 AI/OCR 0；F 41 表精确删 16 行 + `test-r549-verify-%` 0 残留、全局 `paper_exports` 38→42→38 按 code 精确删 4、`explain_cache` 82/latest/SHA-256 不变。**FAIL 2 项**：A① 关含解析后 chip 灰态**单击**不亮需两次（`toggleMine` 只翻 `withMine`）→ **#696** `this.withMine = !this.withNotes` + 状态机测试（旧红新绿），发版 `8dc0c4b0 → cdbdf8b0`（LH `/` 0.97）；抽检前老板侧 W14 #697 再发版 `34bb5207`（R549 文件与 cdbdf8b0 无差），**A① 抽检（34bb5207，uid `test-r549-fix-a7902d9354`，`~/r549-verify/R549-34bb5207-spot-A1.md` + 录像 `~/screencasts/r549-34bb5207-spot-A1/`）375/1440 全 PASS**：关含解析后灰态单击即亮且含解析同亮、再单击仅关个人 chip、「仅答案」`withAns` 原值不变；359 = 352×200 + 7×304、错误/取消/付费 0；41 表精确删 4 行 + `test-r549-fix-%` 0 残留、`paper_exports` 38→38、`explain_cache` 不变。B「回错题本 ›」在本轮有错时先弹既有强化推荐层、点「下次再说」才到列表——既有行为非回归，登记 R550 候选。
- 如实：UNTESTED——错选==答案仅错因分支、24 字截断/多选归一、「仅答案页」批注、mastered/无样本/多天桶（生产均返 1 天）、resize 其余四页与所有首访、小程序真机（R536-1 累计）；精确 375↔1440 为 CDP 同页 viewport 非物理拖动；PDF 批注若未来作可信凭证需改服务端按 uid 取值；仓库无蓝图且本会话无蓝图权限。
- 下一步 R550：候选按价值——G1 自由手录表单（题干+选项+答案+错因 → `question_id=null` 入本，需 authoring UX + 重练/复习/导出全链路论证）/ 清零 CTA 与强化推荐层错配（推荐层加「回错题本」直达或 CTA 按有无推荐切换文案）/ G3 游客首页错题本价值前置（UI 维度需 UX 出稿）；一手核实后择一实修。

### R548（2026-09-08，实现轮·错题重练启动即落 `pendingSession`，H5 前进/刷新不再变默认练习，仅 H5）：从合入 #688 后 main 另开分支 `devin/*-r548-redo-pending-resume`；设计/证据 `docs/iter/round-3/r548-redo-pending-resume.md`
- 一手（`practice.vue` 生命周期源码核）：R546-2 P3 根因 = `redoSet` 在 `onShow` 一次性消费即 remove、`pendingSession` 只在作答后 `saveSession()` 才写 → 未答时前进/F5 `tryResume()` 本地/服务端皆空 → 兜底 `start(lastModule,'direct')`；普通 `start()` 同样未答刷新重拉一组。清理侧 `submitResult / leave(false) / 首页放弃 → remove + clearServerProgress`、`leave(true)` 保留、24h 过期，均不动。
- 实修：redoSet 分支 / `retryGroup` 重练分支 / 普通 `start()` 成功后 `session=true; startQTimer(); saveSession()`；redo 分支置 `_source='redo'`、`_ptitle=null`；快照加 `redo: _redoItems&&!lastModule ? 1 : 0`；`adoptLocalPending` 按位 `redoItemsFromPending(s)` 剥运行时字段还原 `_redoItems`（完成页 `redoReport`/「再来一组」语义不丢）+ toast「继续错题重练」；`tryResume` 弹窗标题 `pendingTitle(s)`（卷名 > 错题重练 > 空）；首页续练卡 `prLabel()` 同口径。`practice-progress.js` +`isRedoPending/pendingTitle/stripPracticeRuntime/redoItemsFromPending/REDO_PENDING_TITLE`，`parsePendingPractice` 多一位 `redo`。测试 +12 `tests/r548-redo-pending-resume.test.js`。后端/协议/小程序未改。
- 门：vitest 153 文件 1037 / eslint + tokens + edge 0 / build:h5；`diff --check` 空。
- 生产：`deploy_h5.sh --skip-build` `29c02a66 → b0747ae4`（回归全 200；Lighthouse `/` 0.99/1.00/1.00/1.00、`/tiku/` 全 1.00）；#690 已合入 main `abc65401`；复验中途老板侧合 W13 #691 发版 `9b4a511c`（R548 三文件两 rev diff 为空）。**黑盒复验（testing agent，b0747ae4 全量 375/1440 uid `test-r548-verify-38f34d719e` + 9b4a511c 仅 375 抽检第 1/2 项 uid `test-r548-verify-c4514ce083`，`~/r548-verify/R548-b0747ae4-production-verification.md` + 录像 `~/screencasts/r548-b0747ae4-production/`、`~/screencasts/r548-9b4a511c-spot/`）功能项全 PASS**：未答后退→前进 / F5 均恢复同 IDs 64/381、`redo=1/source=redo`、toast「继续错题重练」；答 1 题前进弹窗含「错题重练」「1/2 题」继续保留已选；「不用了」旧 redo 快照 remove → 5/6 ms 新普通快照 `redo=0/source=direct` 不含旧题、服务端 clear 200；完成页仍「错题重练效果」+ pending 清 + 「再来一组」重建 `redo=1`；未答显式退出清 pending；首页「错题重练 · 已做 1/2 题」→ 继续/放弃正确；普通数量练习对照 `redo=0` 恢复同 10 题、首页「数量关系 · 0/10」；R546/R547 返回与切 tab 回归保留。1161 = 1142×200 + 19×304（抽检 442 = 434 + 8）、400/HTTP 失败/console/runtime/rejection 0、canceled 6/4 单列；两 uid 41 表精确删 + `test-r548-%` 独立只读 0 残留、`explain_cache` 82 行 SHA-256 不变。
- 如实：3c 严格时序 UNTESTED（「不用了」本地 remove→新 set 仅 5/6 ms 且 start 命中缓存，无「网络返回前」窗口；server clear 200 已证但与新快照先后未证）；375「不用了」新快照 `lastModule=null`（该 uid 无 `lastModule`）/1440 `shuliang`；普通练习未答刷新现走 `adoptLocalPending` 恢复（新行为）；快照 `items` 存运行时对象，恢复母本靠 `PRACTICE_RUNTIME_KEYS` 白名单，新增运行时字段需同步；小程序无此问题域，R536-1 累计真机 UNTESTED。
- 下一步 R549：主循环候选一手核实后实修——复习页/历次作答消费新 `secs`（如「本题平均用时」，生产 R546 起 review_log 已有 secs 样本可查）/ 常识 taxonomy 别名内容侧 / 每日一练 `source` 打点后再核 `mid`；顺带核 `answer_log.source='redo'` 上线后首批样本。

### R547（2026-09-08，实现轮·错题本带筛选深链/刷新后切 tab 不再重建丢筛选，仅 H5）：从合入 #686 后 main `f1b37191` 另开分支 `devin/*-r547-book-tab-keepalive`；设计/证据 `docs/iter/round-3/r547-book-tab-keepalive.md`
- 一手（本地 `node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js` 源码核）：R546-1 P3 根因**不是** `switchTab` 一律重建 tabBar 页，而是复用判定 `isSamePage(url,$page)` 要求 `url === $page.fullPath` 全等，`$page.fullPath` 取进入时 `route.fullPath`（含 query），tabBar 点击 url 是纯路径 → **带 query 深链/刷新进入**的实例永远匹配不到 → `getTabBarPageId` 分配新 `__id__` → KeepAlive key 变 → 新实例 `onLoad({})`。首页点 tab 进入再 UI 筛选的实例 fullPath 无 query，切回本就复用。原候选「onHide 存/onLoad 回填 sessionStorage」在错的层面兜底，弃。
- 实修：`book-url.js` `normalizeTabPageFullPath(page)`（fullPath≠path 时归一为 path）；`book.vue` `onLoad` 首行 H5 条件编译内 `normalizeTabPageFullPath(this.$page)`，早于 `parseBookOpts`。切回命中同一实例，筛选留实例里，`onShow` 走 R546 `syncBookUrl()` 回写 query。测试 `tests/r547-book-tab-keepalive.test.js` 锁 uni-h5 三处口径源码（升级即红）。
- 门：vitest 152 文件 1025 / eslint + tokens + edge 0 / build:h5（产物含归一逻辑）；`diff --check` 空；后端/小程序未改。
- 生产：`deploy_h5.sh --skip-build` `0a930550 → 29c02a66`（回归全 200；Lighthouse `/` 0.92/1.00/0.96/1.00、`/tiku/` 全 1.00）；#688 已合入 main `91f8e964`。**黑盒复验（testing agent，rev `29c02a66` / bundle `index-DF5eMwkr.js`，uid `test-r547-verify-*`，375/1440，`~/r547-verify/R547-29c02a66-production-verification.md` + 录像 `~/screencasts/r547-29c02a66-production/`）全 PASS**：直接 `mod=` 深链 → 统计 → 错题本 4→4（R546 时 →5/→4）、UI 组+细分 → F5 → 切 tab `mod/kp/qt` 2→2、无 query 入口对照 5→4→4、显式 B 深链即时优先 A4→B2、B 深链 F5 → 切 tab B2→B2，6 组 `sameUrl/sameCount/sameComponent` 全 true；R546 回归（重练/复习/讨论返回 + F5）全保留；1978 响应 = 1920×200 + 58×304、HTTP 失败/console/runtime/rejection 0、canceled 24（17 图 + 7 XHR）单列；41 表精确删 24 行、`test-r547-%` 0 残留、`explain_cache` 82 行 SHA-256 不变。
- 如实：**既有 P4（非回归，不立项）**运行中地址栏手输深链 B → popstate 新建实例、旧 tab 实例 A 仍在 `currentPagesMap`（`__isActive` 未清）→ 再切 tab 按插入序命中 A 回旧筛选（实例 282→1048→282 / 293→1165→293）；修前同样命中 A。**R546-2 取证坐实**：前进变默认练习的条件是**未作答**——`redoSet` 一次性消费、`pendingSession` 只在 `saveSession()` 作答后才写 → `tryResume()` 空 → `start(lastModule)`（375 言语 1/10、1440 数量 1/10，随 `lastModule`）；答 1 题后前进弹「继续上次练习 (1/2)」可恢复原集合（`items=2, source=""`）。小程序无此问题域；R536-1 累计真机 UNTESTED。
- 下一步 R548：R546-2 实修（重练启动即落 `pendingSession`/`session=true` 后统一落一次，让前进/刷新走已有 resume；看 `_source` 是否标 `redo`）→ 主循环候选（复习页/历次作答消费 `secs`「本题平均用时」/ 常识 taxonomy 别名内容侧 / 每日一练 `source` 打点后再核 `mid`）一手核实后实修。

### R546（2026-09-08，实现轮·错题本重练返回 URL 同步 P2 + 复习单题 `secs` 上送 + 列表卡「连对 n/6」，后端+H5+小程序）：从合入 #685 后 main `cf3f5e37` 另开分支 `devin/*-r546-book-url-resync-review-secs-streak`
- 一手（`~/r545/q546.py` 生产只读；机制核 `uni-h5`/`vue-router` 本地源码）：P2 根因 = `syncBookUrl` `replaceState(null, …)` 清掉 router `history.state`，进重练页时 router 用缓存 `currentLocation`（无筛选）覆写当前条目，`navigateBack` `history.go(-1)` 回来即无筛选版，`onShow` 只 `load()` 不同步。候选：未掌握错题 `review_streak` 0:264 / 1:15 / 2:6、正 streak 用户 5（**有样本，列表卡此前看不到**）；近 30 天 `review_log` 35 行 `with_secs=0`（**缺口确认**）；`answer_log.source` 全 NULL 53 行 → 每日一练 `mid` **无样本可判，不立项**。设计取证 `docs/iter/round-3/r546-book-url-review-secs-streak.md`。
- 实修：H5 `book.vue` `onShow` `load()` 后 `if (!_pendingKp && !_pendingKp3) syncBookUrl()`（深链首进让位 `applyPendingKp`）、`replaceState(window.history.state, …)`；`review-snap.js`/`utils/review-snap.ts` `reviewElapsedSecs`（round 秒、[1,3600]、无起点/回拨 undefined 不上送），H5 `resetQ/resumeReview` 记 `_qStart`、`record` POST 带 `secs`，小程序 `postReviewRecord(mid, correct, picked?, secs?)`；后端 `api_review_record` `secs` 有限正数才收、`int` 后 86400 兜底（原 `int(secs)` 直落）；`review-summary.js`/`utils/review-verdict.ts` `MASTER_STREAK=6` + `streakProgressText`（1..5 →「连对 n/6」），H5 卡 `mhead` ok 标签（`/api/mistakes` `m.*` 已带 `review_streak`，0 后端改动）、小程序 `MRow.streakText` → `m-meta-ok`。测试 +15（pytest 2 / vitest 13），源锁改口径 4 处（R544 复习 POST 形态与签名、R541 两处 import）。
- 门：pytest 623 / ruff / pyright 0；vitest 151 文件 1020 / eslint + tokens + edge 0 / build:h5；miniapp tsc 0 / eslint 0；`diff --check` 空。
- 生产：`deploy_h5.sh --skip-build` `a707322a → 0a930550`（`~/r546/deploy.log`，回归全 200；Lighthouse `/` a11y 部署时 0.94、独立重跑 1.00 `~/r546/lh-home.json`，与 R545 同形态判瞬时）；#686 已合入 main `f1b37191`。**黑盒复验（testing agent，rev `0a930550` / bundle `index-CBJ12sqm.js` 三证一致，uid `test-r546-verify-3cfcd05ff5`，375/1440，`~/r546-verify/R546-0a930550-production-verification.md` + 录像 `~/screencasts/r546-0a930550-production/`）三项全 PASS**：`mod=shuliang` 与 `kp+qt` 深链 → 重练 → 页内返回 → 刷新，双视口筛选与数量均保留；浏览器后退、复习退出、讨论页 navigateTo 返回同样保留；复习第一题 ≈5.5s 上送 `secs:6`、第二题 ≈3.5s `secs:4`（非累计），`/api/attempts` `source=review` 行 + `review_log.via=review` + 卡片「用时 6s/4s」一致；连对标签 0 隐藏 → 1/6 → 2/6 → 答错清零隐藏，非零 streak 卡标掌握后只显「已掌握」；375 多标签无溢出、桌面焦点环可见。回归 1317 响应 = 1277×200 + 40×304、HTTP 失败/console/runtime/rejection 0、取消 17（15 图 + 2 XHR）单列、付费 AI 0。清理 41 表精确删 23 行、`test-r546-%` 0 残留、`explain_cache` 82 行全表 SHA-256 前后一致。
- 如实：每日一练 `mid` 未立项；小程序 secs/连对标签未上真机（R536-1 累计）UNTESTED；`MASTER_STREAK` 前端镜像服务端 `REVIEW_INTERVALS_DAYS` 长度，改档位需同步 H5/小程序两处；连对 3–5 逐档与自然连对六次自动掌握未在生产走（单测覆盖）。**既有/独立发现（非本轮回归，均双视口复现）**：R546-1 P3 底部 tab 统计 → 错题本 `switchTab` 走无 query 路由且页面重建，筛选与 query 一起重置（375 2→5 题、1440 2→4 题；筛选只活在 URL，切 tab 不带）；R546-2 P3 浏览器「前进」回到重练页变默认「言语理解 1/10」（redo 上下文不随 history 恢复，无空白/死循环）。
- 下一步 R547：R546-1（切 tab 保筛选：`onHide` 存 / `onLoad` 无 query 时回填 sessionStorage）与 R546-2 设计论证 → 主循环候选（复习页/历次作答消费新 `secs`（如「本题平均用时」）/ 常识 taxonomy 别名内容侧设计 / 每日一练 `source` 打点后再核 `mid`）一手核实后实修。

### R545（2026-09-08，实现轮·错题本题型二级聚合，后端+H5+小程序）：`type_group` 题型组主标签/主筛选 + `redo?sub=` 按组重练 + H5 细分 chips / `qt=` URL；从合入 #681 后 main 另开分支 `devin/*-r545-type-groups`
- 差距（一手，生产只读 `~/r545/q1.py q2.py`）：错题本用 `mistakes.question_type`（来源站细题型）而掌握度地图/同考点强化用 `questions.submodule → taxonomy 题型组`；数量关系 109 细题型 → 18 组、判断 24→14、言语 14→12、资料 60→25、常识 197→196（两侧都碎，不做）；生产 297 条错题、17 个 ≥5 条 uid 共 139 标签 vs 127 组，「排列组合 / 概率问题 / 排列组合与概率」平级三 chip；`redo?qtype=` 精确匹配细题型故碎片化影响重练不止标签。设计论证 `docs/iter/round-3/r545-type-groups.md`。
- 实修：`taxonomy.group_name(module, submodule)`（alias→规范组名 / 未知回原文 / 空 None）+ `group_submodules`（组名+aliases）；`_hydrate_mistake` 出 `type_group`；`mistakes_redo(sub=)` `question_id IN (SELECT id FROM questions WHERE submodule IN (...))` 与 `qtype`/`module` 可叠，`/api/mistakes/redo?sub=` 空/>40 字 400。H5 `book.vue` `groupKey = type_group || tagName || '其他'`、`qtFilter/fineTypes`（组内 ≥2 细题型才出「组 · 细分」行）、卡片 brand 组名 + neutral 细题型、`redoTypeQuery()`（组→`sub=` 叠 module/qtype；手录细题型→`qtype=`；模块名→`module&noqt`）、`book-url.js` `qt=` 只随 `kp`、`applyPendingKp` 校验 `qt` 属组。小程序 `book.ts` `typeName = type_group || tagName`、`onRedo` 命中组→`sub=`；`RedoFilter.sub`/`Mistake.type_group`。测试 +14（`test_r545_type_group` 3 / `r545-type-groups.test.js` 11），改 3 处源锁旧口径。
- 门：pytest 609 / ruff / pyright 0（需 `--pythonpath ~/venv-kg/bin/python`）；vitest 1005 / eslint / tokens / build:h5；miniapp tsc 0 / eslint 0；`diff --check` 空。合 main（W12 #682）后 pytest 621 / vitest 1009。
- 生产：`deploy_h5.sh --skip-build` `cda7af0d → 42df6d14`（回归全 200；Lighthouse `/` a11y 部署时 0.94、独立重跑 1.00 判瞬时）；设置期间老板侧合 main 再发版 → `a707322a`（R545 文件两 rev 无差）；#683 已合入 main `7566e0ba`。**黑盒复验（testing agent，rev `a707322a`，uid `test-r545-verify-0d1e368ad7`，375/1440，`~/r545-verify/R545-a707322a-production-verification.md` + 录像 `~/screencasts/r545-a707322a-production/`）全 PASS**：生产 `submodule='排列组合'` 0 条 / `'概率问题'` 1 条 disabled、规范组 6204 条 → 碎片化来源是 `mistakes.question_type`，fixture qid 63（排列组合）+ 64/381（概率问题）+ 8223（计算问题）+ 手录；`/api/mistakes`/`/api/review` 带 `type_group`（3 条同组、手录 null）；`redo?sub=` `[63,64,381]`、`+qtype=概率问题` `[64,381]`、`+module` 叠加正确、未知组空、空/空白/41 字 400；UI 单 chip「排列组合与概率 ×3」→ 细分行 ×2/×1 → 细分后 2 条、筛选标签「组 · 细分」→ 重练请求 `sub=`（1/3）/ `sub=&qtype=`（1/2）；`?kp=&qt=` 刷新恢复、切模块/清组去 `qt`、外组 `qt` 丢弃、手录 fallback 不变。回归 1271 响应 = 1223×200 + 45×304 + 3×预期 400、console 0、375 无溢出、焦点环可见、付费 AI 0。清理 41 表精确删 10 行、`test-r545-%` 0 残留。
- 如实：alias→组名归一生产无样本 **UNTESTED**（单测覆盖）；小程序未上真机（R536-1）、无二级 chips；`qtype=` 仍精确匹配 `question_type`（带前缀行 5/297 行为同前）。**P2 既有（非本轮回归）**：任意筛选（组+细分 / 旧 `mod=`）→ 重练 → 页内返回，UI 保留筛选但地址栏丢 `kp/qt/mod`，刷新丢筛选（uni-app 返回重写地址，`syncBookUrl` 只在 watch 触发）。
- 下一步 R546：P2 返回后 URL 同步（`onShow` 补 `syncBookUrl`）实修 → 主循环候选（错题本列表 streak 进度可视 / 复习页计时 `secs` 上送 / 每日一练 answer_log `mid`）一手核实后实修。

### R544（2026-09-08，实现轮·对标粉笔/夸克 生产 UX 走查 → 5 项可感知差距实修，后端+H5+小程序）：收藏入口落 fav / 选项键序归一 / 提示对比度 / 雷达「未练」口径 / 历次作答合并复习；从合入 #679 后 main 另开分支 `devin/*-r544-ux-gaps`
- 差距（一手，生产 rev `74a5d62a` 375/1440 走查 uid `test-r544-ux-20260908` 已清零；`~/r544-ux/R544-UX-report.md` + 录像）：①「我的收藏 0题」落待掌握 tab（P1）②题 1046897 选项 A/D/B/C（P1；生产库只读 `questions` 乱序 200 行/活跃 107，时政 0）③错题卡「点开看答案与详解」`--ink-4` 2.07:1（P2）④只练 1 模块时其余显 0% 且 77% 叫「最薄弱」（P2）⑤复习答对后「历次作答」仍只见练习错答（P2；`review_log` 与 `answer_log` 分表）⑥排列组合分类拆两标签（P2，**不做**，内容侧立项）。竞品为官方公开说明对标，未实测 App 内部。
- 实修：`book.vue` `bookShowFavs` 无条件切 fav；`db.options_json`（单大写字母键排序）接 seed/时政/import/admin 四条落库路径 + `_normalize_option_order` 一次性迁移（`seed_runs` `__option_order_v1`）；`.hint` `--ink-3`；H5/小程序雷达 `n=0 → 未练`、`weakTitle` `>=2 ? 最薄弱 : 已练模块`、按钮「去补弱/继续练」；`review_log` +`picked/secs/via`，`/api/review` 收 `picked/secs`，练习连带推进 `via='answer'`，`/api/attempts` 合并两表带 `source`（`via=answer` / legacy 3s 窗去重），H5+小程序历次作答行显「练习/复习」、复习 POST 带 `picked`。测试 +18（`test_option_order` 5 / `test_attempts_timeline` 4 / `r544-ux-gaps.test.js` 9）。取证 `docs/iter/round-3/r544-ux-gaps.md`。
- 门：pytest 606 / ruff / pyright 0；vitest 146 文件 994 / eslint + tokens + edge 0 / build:h5；miniapp tsc 0 / eslint 0；`diff --check` 空。
- 生产：`deploy_h5.sh --skip-build` 发版 `74a5d62a → cda7af0d`（#680 已合入 main `e612ea67`），部署脚本接口回归全 200、Lighthouse `/` perf 0.99 a11y 1.0、`/tiku/` perf 1.0；只读核 `seed_runs.__option_order_v1='200'`、`questions` 乱序 0、题 1046897 `A517/B516/C515/D514` answer 不变 `A`、容器 healthy 0 Traceback。**黑盒复验（testing agent，uid `test-r544-verify-dd47d4d800`，375/1440，`~/r544-verify/R544-production-verification.md` + 录像 `~/screencasts/r544-cda7af0d-production/`）五项全 PASS**：①待掌握 1/收藏 0 时「我的收藏」直落收藏空态、tabBar 无意图进入回待掌握；②深链/重练/SEO 三处 A/B/C/D，B 判错入本 `user_answer=B/correct_answer=A`，A 重练判对 `reviewed streak 2`，另抽 24 题键序全序；③`.hint` `rgb(107,114,128)` 4.83:1、可展开；④单模块四轴「未练」+「已练模块」+「继续练」，加练言语 5 全错后「最薄弱 / 言语 0% / 去补弱」；⑤复习后历次作答恰两行「复习 A ✓ / 练习 B ✗」，重练后三行无重复；`POST /api/review/3278` 带 `picked:"A"`，`review_log` 懒迁移后有 `picked/secs/via`，行 `via=review,picked=A` 与 `via=answer` 各一。回归：964 响应全 200、console/rejection 0、375 无横向溢出、焦点环可见、付费 AI 0。清理：41 张 uid 表精确删 36 行，`test-r544-verify-%` LEFTOVER 0，`explain_cache` 82 不变。
- 如实：小程序未上真机/DevTools（R536-1）；复习 POST 未带 `secs`（无计时器）；legacy review_log 行「选 —」；`_normalize_option_order` 首启全表扫一次（秒级）。
- 下一步 R545：生产复验发现的 P0/P1 → 分类树碎片化（#6）设计论证 → 主循环候选（错题本列表 streak 进度可视 / 复习页计时 secs / 每日一练 answer_log `mid`）。

### R542（2026-09-08，实现轮·小程序端 主循环「练习 → 作答 → 复习推进」段）：练习页上送 `mid` + 消费 `/api/answer_log` `reviewed`；0 服务端/H5 改动、无 VPS 发版（生产仍 `74a5d62a`）；从合入 #678 后 main 另开分支
- 差距（一手，本地 `:8525` `~/r542/local_flow2.out`）：H5 练习页 R371 起 answer_log 带 `mid` 并消费 `reviewed` 出「错题重练效果」三格 / 「本组答对 N 道曾错题…（M 道达成掌握）」；小程序 `practice.ts` 只送 `qid`、`postAnswerLog(): Promise<void>` 丢回包、`types.ts` 未声明 `mistake_id/AnswerLogResp`。服务端 `_log_answers` 定位错题**先 `mid` 再 `qid`**：`qid:null` 无 `mid` → `reviewed:[]` streak 不动（时政 `_sz`/手录错题重练答对不推进复习且无反馈）；同项加 `mid` 连打 6 次 `streak 1..6`、第 6 次 `mastered:true`、`GET /api/review` `total 0`。P1，最小修 = 客户端补上送 + 消费已有回包，SRS 不动。
- 实修：`types.ts` `Question.mistake_id?` / `AnswerLogItem.mid?` / `AnswerLogReviewed` / `AnswerLogResp{saved, reviewed?}`；`api/index.ts` 回包类型；新 `utils/review-advance.ts`（`reviewedMasteredCount` `=== true` 严判 / `redoReportOf` 只数带 `mistake_id` 已作答题 / `fixReportOf` / `fixReportText` 逐字同 H5 / `redoReportTip` 沿用 R523 文案）；`practice.ts` `logAttempts` 项 `mid: q.mistake_id || undefined`（`qid` 仍 `q.id || null`，`_sz` 守卫不动）、promise 入 `_logPending`、`Array.isArray(r.reviewed)` 才并入 `_reviewed`、失败仍入离线队列（队列项含 `mid`）；新 `syncRedoReviews(items)` 等在途请求 → `mode ∈ {redo,redoset}` 出 `redoReport` 否则/为 null 时 `fixReport`；`finish()` 串 `logAttempts → syncRedoReviews → loadDueReview`；`start()` 重置。`practice.wxml/.wxss` 完成页三格 + tip + 「回错题本查看」（既有 `onGoReview`）/ 一行可点，token 全走既有（无 `--bg-2`，`l-icon` tone 用 `muted`）。`mistake_id` 链路源码核：redo 接口 → `book.ts redoSet=d.items` → `toPQ()` 展开保留 → `logAttempts`。测试 +7 vitest（esbuild 真跑 ts + 源锁）。
- 门：pytest 599 / ruff / pyright 0；vitest 145 文件 985 / eslint 0 / build:h5；miniapp tsc 0 / eslint 0；`diff --check` 空。
- 生产：**未发版**（纯小程序源码；服务端契约 R371 起已在生产）；小程序 R536/R539/R541/R542 累计待 macOS/Windows 上传（R536-1）。
- (c) 13:14Z（`~/r542/c.out`，只读）：rev `74a5d62a` 容器 healthy 0 重启（12:42Z 起）、R541 后容器 5xx/Traceback 0、源站 12:45Z 后 1124 请求 5xx 0；簇 09:34Z 段**仍在跑**（12h 1294 行/363 IP、13h 前 14 min 547 行/239 IP，last 13:14:30Z）、09-09 日界未到；非探针非 GET 1 条 = 12:43:14Z `POST /api/track` `Cf-Connecting-Ip 140.232.64.4` moto g UA（本机 6b Lighthouse）→ 真人 0；redo 自然 0、answer_log 自然 POST 0；Caddy `zalize.com` 续期行 reload 后 ~2 h 仍 0（6 h 窗 17:17Z 满）；DB `1324/360/37/38/82`、`explain_cache.qid` 非空 0、null qid 28、`max(review_streak)=2`、WAL 同字节 → 0 写入；load 0.58 / `/` 4.0G(92%) / mem 329 MB。
- 如实：小程序只有 Node 打桩 + tsc + 本地真接口一手，**无真机 / 无 DevTools 运行时**；`redoset` 非错题本来源（收藏/报告）无 `mistake_id` → 小程序显 `fixReport` 一行而 H5 不显示（R542-1 P3）；离线补传的 `reviewed` 不展示（H5 同）；无 testing agent 录屏；生产 0 写入 0 LLM。取证：`docs/iter/round-3/r542-miniapp-practice-review-advance.md`。环境蓝图无需更新。
- 下一步 R543：到期项（09-09 日界后簇是否接续 / Caddy 6 h 窗满 / redo 自然首样本 / `explain_cache.qid` 首个非空行 / 首个自然 `mastered` 回包）+ 主循环下一实现候选（错题本列表项 streak 进度可视 / 小程序复习页断点续做快照 `streak` 恢复 / 每日一练页 answer_log 是否同样漏 `mid`）→ 有一手即实修→发版→复采。

### W9（守卫/阻塞收口 + 桌面让位/薄弱判定口径集成轮，分支 devin/wf-w9-integration，未建 PR/未部署）
- 集成：origin/main `35be115c`（#639）切 `devin/wf-w9-integration`，依次 merge W9-A（`132fa744`）/ W9-B（`17cc21c1`）/ W9-C（`3846f83e`），三次无冲突；dropped 无。生产 `/api/health` rev=`10e2eb82` 在 R510 分支上、是 main 的后代（+7 提交含 R511 `0c532532`）→ 生产 = main 超集无漂移；**R510/R511 尚未合 main**，与 W9-A 的 `main.py` 改动 merge-tree 预演无冲突。全量本地验证三端：backend ruff / pyright 0 / pytest 525（基线 516）；frontend-uni（Node 22.23.2）lint / vitest 843（基线 824）/ build:h5；miniapp tsc 0 / lint 0。
- W9-A（backend）：`/api/push/subscribe|unsubscribe` 改 `def(body: dict)`（非 JSON Content-Type 由 FastAPI 422，补上 R348-B1 守卫后唯一残余绕过）+ subscribe 显式 `owns_uid` 403；`guard_account_uid` 的 `owns_uid`（内含 httpx 5s）与 `scan_sheet` 的 OpenCV 走 `run_in_threadpool`；`init_db` 建 `idx_q_reinforce` 前 `_ensure_question_stat_cols`（新库 adaptive 不再 `no such column` 500）；`quality.answer_letter_conflict` 只取最后一处结论式字母、单选冲突扣 30 不下线。本地新库 uvicorn 实测：form 422 且 push_subs 0 行 / JSON 无 token 403 / 匿名 200→unsubscribe 200 归零 / scan_sheet 非法图 422 / PRAGMA 含 correct_ratio 且 adaptive 空库与 6 条作答后均 200 / 日志 0 error。**生产回归待部署**。
- W9-B（H5）：App.vue 208px 让位与 `.banner/.mask` 偏移仅 `uni-page[type="tabBar"]`（1280/1366 壳段拆「壳边基线 + tab 页 +208」）；pages.json tabBar `fontSize 12px`；`exam-weak.js`/`report.vue` 薄弱模块按 `answered`/`ansPct`（answered=0 或 <3 不判，部分作答附「（按已答 a/n 题折算）」）；`a11y-focus.js` 焦点环 `var(--brand)`。本地 dist CDP 实测：1440 五 tab 页 paddingLeft 208 / 侧栏 208×900 / label 15px，非 tab 页 exam/list、exam/report、settings/reminders paddingLeft 0 且 `docSW==cw`；375 五 tab label 12px 高 18 单行不裁切；本机 uvicorn 真实交卷造 attempt：数量模块 answered=0 → 无「薄弱模块」CTA、配速「未作答」，对照组 answered=3 correct=0 → CTA「本卷正确率 0%，全卷最低」。截图 `~/w9int/shots/`（21 张）。**生产 UI 待部署**；报告页两项既有 a11y 失败（配速 tag 4.35:1、`.cta` aria-label 不一致）登记未修。
- W9-C（小程序）：`kg-exam-report.ts` 薄弱判定与 H5 同规则（**集成时修正**：兜底 reason 由「本卷已答正确率 X%」改为与 H5 逐字一致的「本卷正确率 X%，全卷最低（按已答 a/n 题折算）」，测试同步）；`report.ts` 映射 answered/ansPct；`postPracticeResult` 带 `uid: anonUid()`（本地 uvicorn 实测落 uid）；`profile.ts` 抽 `refresh()`，退出登录先清角标再按匿名重拉；删零引用 `utils/exam-progress.ts`。wxml/wxss 静态核对无需改动。**运行时未核**（Linux 无微信开发者工具，需 macOS/Windows 会话）。
- 数据纪律：全部在本机临时库 `/tmp/w9int.db` + 本机 Chrome；生产仅 1 次只读 `GET /api/health`，未造数、未触发 LLM、未改配置。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W9 追加）」（部署后回归清单、stats_bundle 聚合、request.ts 韧性对齐、小程序真机清单、predict 重复请求、aside-first 设计、favorites 网格、md hex/class 口径、H5 视觉读数待截图、报告页 a11y 既有两项、`_ensure_*`/其余同步 IO 待量化、profile 契约、结论字母冲突 ≈1‰ 人审、内容台账沿用、真人样本不足结论、新需求提案、R510/R511 合 main 流程）；详证 docs/iter/workflow/w9.md。

### W10（连接层写锁泄漏 P0 + limit 夹紧 + 模考快照/排名池 + 社交入口对齐集成轮，分支 devin/wf-w10-integration，未建 PR/未部署）
- 集成：origin/main `bd6514f6`（#640 R510–R515 已合入）切 `devin/wf-w10-integration`，依次 merge W10-A（`0dc4edac`）/ W10-B（`1aaa3c9e`）/ W10-C（`b4aa85d4`），三次无冲突（db.py 两侧改动自动合并）；dropped 无；集成阶段零代码修正。审方时生产 `/api/health` rev=`22a38390` = #640 head，已是 main 祖先 → 生产 = main 子集无漂移（W9 登记的 R510/R511 待合 main 已解决）。全量本地验证三端：backend ruff / pyright 0 / pytest 548（+13）；frontend-uni（Node 22.23.2）lint / vitest 870 / build:h5；miniapp tsc 0 / lint 0。集成阶段未访问生产。
- W10-A（backend，P0）：`db.py _ConnProxy.execute/executemany` 任意异常即 rollback、绑定失败（`sqlite3.InterfaceError/ProgrammingError` + `binding parameter`）→ `ValueError("参数格式错误")` 走既有 400 handler，`get_conn` 复用连接时残留事务兜底回滚 —— 修掉「一次畸形 JSON 写请求泄漏写锁 → 全站写 30 s 后 500」P0（审方 origin/main TestClient 一手复现，#640 的 400 映射未覆盖此路径）；`deps.clamp_limit` + db.py 11 处 `min(max(limit,0),N)`（生产实测 `/api/shenlun/questions?limit=-1` 曾返 208/208 全表）；`exam_attempts.question_ids` 题序快照（start 写、submit/report 读，老 attempt 回退 active qids）；迷你模考排名池跨 `kind='mock'`（每场落新卷导致恒 1/1）；`_sharer_invite(conn, s, viewer_uid)` 对分享者本人/已入队者返 null（H5/小程序渲染条件不变即两端生效）；卷库 `takers<5` 不透出 takers/avg_score（`_SOCIAL_MIN_N=5`，两个既有契约测试改为凑满 5 真人断言、未弱化）。本地新库 uvicorn 实测 11/11：畸形 module ×3 → 400 各 <10 ms、外部 `BEGIN IMMEDIATE` 立即成功、随后写 200 4 ms；limit=-1 → 0 条 / 999 → 50；disable 第 2 题后报告 30 条不错位；两真人 UA uid mini 交卷 rank total 2、探针场不计；team_invite 本人/队员 null、外人/匿名有；1 人作答卷 takers 0/avg None；日志 0 error。**生产回归待部署**（test-w10-* 造数并清理）。
- W10-B（H5，P1）：`profile.vue` 学习分组「讨论消息」后追加「PK 对战」→ `/pkgA/pk/pk`、「学习小队」→ `/pkgA/team/team`（副标 `teamName || '组队打卡互相监督'`，teamName 只读 `snapPeek('/api/team/mine')` 本地快照，零新增请求）+ 源锁测试 3 例；与小程序 profile.ts 106/181 既有入口对齐（此前 H5 站内不可达）。本地 dist（uvicorn 同源托管）CDP 375/1440 实测：学习分组 7 条 cell `h=52 / x / 图标 32 / titleX` 逐行一致、顺序正确、两入口导航目标正确、pageerror 0。截图 `~/w10int/profile_{375,1440}.png`。**生产 UI 待部署**。
- W10-C（小程序，P2）：`pkgGrow/mastery-map/mastery-map.wxml:18` `class="sec head"` → `class="sec" body-class="head"`（kg-card `externalClasses ['body-class']` 挂 body，flex 才作用于 kg-progress + .head-r）。**运行时未核**（Linux 无微信开发者工具）。集成方同类 grep 新命中 `pkgSocial/reminders/reminders.wxml:36 class="tip"`（`.tip{display:flex;gap}` 挂宿主）同类误用，受 W10-C 单文件约束未改，已登记 deferred。
- 数据纪律：全部在本机临时库 `~/w10int/w10int.db` + 本机 Chrome；集成阶段生产零请求；未造生产数据、未触发 LLM、未改配置。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W10 追加）」（部署后回归清单、reminders tip 卡 body-class、真机清单追加、clamp_limit 下沉、mock_event 快照口径、mini 卷落库 W2 #45、`with conn:` 统一、真题卷缺题内容线、国考/2026 卷、收藏缓存 uid 隔离、首页 pstats 口径、练习页解析主次/扇出量化、#498 处置、小程序题卡组件补齐、W9 沿用项、hs 冲突/单 uid 结论、流程）；详证 docs/iter/workflow/w10.md。

### W11（merge_anon 归并覆盖通用化 + 统计页薄弱轴 n>0 口径 H5/小程序同源集成轮，分支 devin/wf-w11-integration，未建 PR/未部署）
- 集成：PR #643（W10）经 `git_view_pr` 实查已 merged → 基线 origin/main `f4d52d67`（#651），切 `devin/wf-w11-integration`，依次 merge W11-A（`df92cbfb`）/ W11-B（`16d0bba9`）/ W11-C（`4463b0ed`），三次无冲突（merge 点 `c9fa32b8`/`879df6ba`/`c545d204`）；dropped 无；集成阶段零代码修正。三分支 merge-base 均 `6cec81dd`。生产 rev `03f7d826`（#650）是 main 祖先 → 生产 = main 子集无漂移（W10/W11 均未部署）。合并后 diff 6 files +397/−36。全量本地验证三端（集成分支重跑）：backend ruff / pyright 0 / pytest 561（基线 557，+4）；frontend-uni（Node 22.23.2）lint + lint:tokens / vitest 130 文件 895（基线 885，+10）/ build:h5；miniapp tsc 0 / lint 0。集成阶段生产零请求。
- W11-A（backend，P1）：`auth.py` 删 `_UID_TABLES(6)`/`_UID_PK_TABLES(11)` 与 13 行 `db._ensure_*` 前置，改 `_uid_columns(conn)` schema 自省（`sqlite_master` + `PRAGMA table_info/index_list`，列名 `uid`/`*_uid`，跳过 `_MERGE_SKIP_TABLES={merged_anon,users,auth_tokens,zalize_bindings}`）+ `merge_uid_rows`（PK/唯一索引列 `UPDATE OR IGNORE`+DELETE 目标优先、否则 UPDATE），merged 键改 `table.col`；全 schema 下 38 列/22 keyed，相对旧 17 表新增 20 表 21 列（team_members/teams.creator_uid/shared_*/growth_events/question_comments/comment_*/mock_event_entries/weekly_reports/daily_set_entries/practice_progress/ask_*/review_cur/interview_sessions/pk_matches ×2/push_subs/practice_results/question_reports）；`merged_anon` 幂等、`u\d+` 拒绝、owns/require_user 不动；新增 `tests/test_w11_merge_anon_coverage.py` 4 例（源锁扫建表语句 vs 自省、keyed 标志、全表造数+目标优先+幂等、u1/自身）。本地新库 uvicorn 实测：匿名 `test-w11-int-anon2` 建队 + 续练 + 今日同题 → 注册 `u2` → 合并前 team/mine `[]`、resume `{}`（不带 Bearer 查账号 uid 403，守卫未动）→ merge_anon merged `team_members.uid 1 / teams.creator_uid 1 / practice_progress.uid 1 / daily_set_entries.uid 1`（四表均在旧清单外）→ team/mine 见队 is_creator、resume 3 题 idx 1 picks {1:A}、匿名查询空 → 二次 merge 全 0 → `u99` 400 / 自身 skipped；DB 直查匿名行 0、merged_anon 1；日志 0 Traceback。**生产回归待部署**。
- W11-B（H5，P2）：`stats.vue` `axes()` 两分支（growth.modules `s.n`、pstats `s.done`）带 `n`，`weakAxes` `filter(a.n>0)`、`hasRadar` `some(a.n>0)`（原 `a.pct>0` 把全错 0% 模块当「未答」剔出「最薄弱」、全错新用户判「还没有能力数据」——与 W9-B 模考报告同根因反方向）；模板/后端不动；新增 `tests/stats-w11-weak-axes.test.js` 6 例。本地 dist（uvicorn 同源托管，CDP 只 mock `/api/growth`）375/1440 实测：weak `{shuliang n3 c0, yanyu n10 c8}` → axis-label 数量 0%、「最薄弱」rs-row [数量 0%, 言语 80%]、去补弱、非空态；empty 全 n=0 → kg-empty「还没有能力数据」；pageerror/console.error 0。截图 `~/w11int/shots/{weak,empty}-{375,1440}.png`。**生产 UI 待部署**。
- W11-C（小程序，P2）：`stats.ts` `interface StatAxis extends RadarAxis {n}`，growth `s.n` / pstats `s.done`，`weakAxes`/`hasRadar` 改 `a.n > 0`，wxml/wxss 零 diff（`rs-row {{item.pct}}%` 已能渲染 0%）；测试落 `frontend-uni/tests/miniapp-w11-weak-axes.test.js` 4 例（`miniapp-native/.gitignore:3` 忽略 `miniprogram/**/*.js`，同 miniapp-w9/r506 惯例）。静态核对 L63/165/168/170/214 全对上、`a.pct > 0` 0 处。**运行时未核**（Linux 无微信开发者工具，真机清单已追加）。
- 数据纪律：全部在本机临时库 `~/w11int/db/app.db` + 本机 Chrome；生产零请求；本机造数 `test-w11-int-*` 随临时库丢弃；未触发 LLM、未改配置、未部署。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W11 追加）」（部署后回归清单、模考交卷超时宽限需产品决策、answer_log.correct 服务端复判口径、exam source='exam' 1 行、App.vue 桌面死 CSS + cellcard 描边阴影、kg-tag nowrap 加固、kg-card raised sh-2 + 11 处静态 raised 真机、W11-C 真机清单、小程序测试落点工程债、W11-C 内容缺口成本论证、方法名教研核对、W9/W10 沿用项、流程）；详证 docs/iter/workflow/w11.md。审方被拒 14 条（KgTag/KgCard 生产 41 tag/15 卡 0 命中误报、签到口径有意设计、搜索 FTS 无慢日志、#649/#650/#498 重复等）见 w11.md §2。

### W13（内容入库门禁 R8–R13 fail-closed + 榜单展示名「考友XXXX」口径统一 + H5 body 字体/解析卡来源占位值集成轮，分支 devin/wf-w13-integration）
- 集成：origin/main `58188f7e`（#687/#688 R546/R547）切 `devin/wf-w13-integration`，依次 merge W13-C1（`9c7083fd`）/ W13-B1（`bef1018c`）/ W13-H1（`d8baad05`），三次无冲突；integrate 子会话因组织并发上限（HTTP 429）未能创建，由项目负责人本机集成。diff 21 files +1169/−31。报告 `docs/iter/workflow/w13.md`，dry-run 台账 `docs/iter/workflow/w13-content-gate-ledger.md`。
- W13-C1（content，P1）：`quality.py` R8–R13 纯函数 + 新 `content_gate.py`（`gate_hs/gate_questions` → accepted+receipt；R8 逐条拒收、R9/R10 批内≥3 整批 422、R11–R13 软标、异常 fail-closed）+ `qbank_api.py` 两条 import 路由前置门禁（响应追加 `receipt`，`db.py` 零改动）+ `tools/content_gate_dryrun.py` 只读扫描。生产库只读 dry-run：R8 25 / R9 3,777 / R10 8,647+3,013 / R11 105 / R12 3,130（全 ziliao）/ R13 13,996（shuliang 10,942）；只拦新批次，存量处置留人工抽检后另立项。
- W13-B1（backend，P2）：`db.display_alias(uid, nickname)`（昵称优先，否则「考友」+sha1[:4]）替换 insights exam rank / `daily_set_board` / pk 周榜三处 `uid[:6]+'***'`（原会露 uid 前缀），`mock_event._alias` 委托；team/pk/social/mock_event/report 五处 `_clean_uid` → `db.clean_uid`；`exam_api._clean_int_map` 非 dict → 400（原 `[]` 当空卷交、str 500），`log_items` 补 `source='exam'`（backlog 既定「触碰即补」）。两处旧 `***` 测试期望有意改为新契约。
- W13-H1（H5，P1）：`App.vue` H5 `body{font-family: var(--font-sans)}`——生产 CDP 实测 `body`/`.uni-toast` computed 为 `"Times New Roman"`（uni-modal/toast 挂在 `uni-page-body` 外），修后三者一致 Inter 栈；`q-stat.js qSourceText` 过滤 original/unknown/ai（与小程序 `q-stat.ts sourceLabel` 同口径），`kg-analysis-card` `v-if="sourceText"`。
- 门禁：ruff 通过 / pytest **678**（py3.12；py3.10 下 `test_conn_begin_immediate` 为解释器版本既有失败）/ H5 lint+tokens 通过、vitest **1031**、build:h5 通过 / 小程序 tsc+eslint 通过（零改动）。本地 uvicorn 实测 hs_import R8 拒收、R9×3 → 422、无 token 401、daily board 名「考友B5E7」；exam/submit 形状守卫仅单测覆盖。
- 数据纪律：生产仅 health ×1 + 首页 CDP 只读 ×1；dry-run 对生产库 `?mode=ro`；本机造数随 `/tmp/w13.db` 丢弃；未部署。
- 遗留：部署后回归清单（hs_import 401 / 三榜单展示名 / 生产 body 字体 / 解析卡来源）；R12/R13 存量高占比需人工抽检后再决定加列与分发互斥；R9 存量重写需 LLM key；`save_mistake` uid strip 可接 `db.clean_uid`。

- 上线与回归（2026-09-08 18:13Z）：#691 合入 main `9b4a511c` 后 `deploy_h5.sh --skip-build` 发版 `b0747ae4 → 9b4a511c`（bundle `index-C6y4w2jt.js`，Traceback 0）；4c 因 npx 解析到 wrangler 4.86.0 认证失败，改钉 `wrangler@4.129.1` 手工完成 Pages 部署 + 5/5b/6 校验（本 PR 已把脚本钉为 `wrangler@4.129.1`）。生产回归：hs_import 无 token 401；日榜 `考友CB8C`；exam/submit `picks=[]|"abc"|123`、`secs=[1]` 均 400；`document.body` computed font Inter 栈。`test-w13-%` 40 行 + mock 卷 281 精确清理，LEFTOVER 0。详见 w13.md §7。

### W12-C 内容审计（content-human，只读，不改库）
- 报告 `docs/iter/workflow/w12c-content-human.md`：生产 `GET /api/questions` 五模块 6 组×10 题去重 296 题（uid `test-w12-*`，零写入零 AI）。W11-C 之外的新维度：① `source='original'` 合成题占分发样本 34%，ziliao「同比增长 28%」母版 13/56 且同组成串（ziliao-5 4/10）、shuliang-0 同结构克隆对相隔 1 题（P1）；② 合成题 explanation 伪排错句 11/102 vs 真题 0/194（P1）；③ hs 引用答题参考 2/296（R8 拒收）；④ hs 数字归一后整段复用 4 题组 0.97–1.0；⑤ 小程序 practice.wxml hs/原解析未去重（H5/SEO 已）。W11-C 项复核值：尾句 213/296、无非答案字母 105/296、原解析空 15、裸排除 0。规则 R8–R14 与 `hs_import` 批次级钩子设计见报告 §4/§5，未写代码。样本与脚本在审计机 `~/w12c/`，不入库。


### W12（账号 uid 守卫空白绕过 P0 + 小程序反馈口径对齐 + H5 v3 贴皮收尾集成轮，PR #682 已合入 main `760e60a4`，生产已部署 rev `a707322a`）
- 集成：origin/main `e612ea67`（#680 R544）切 `devin/wf-w12-integration`，依次 merge W12D-1（`26ba7971`）/ W12D-2（`6b6e2cce`）/ W12D-3（`d6d5708c`），三次无冲突（merge 点 `964cffe7`/`4bc357d6`/`e99e2b6f`）；三分支 merge-base 均 `7f53a5a4`，与 R544 文件无交集；dropped 无；集成阶段零代码修正。生产 `/api/health` rev `cda7af0d`（R544 提交）是 main 祖先 → 生产 = main 子集无漂移。合并后 diff 15 files +470/−73，未触碰并行热点（practice/book/report/study_api/db.py/小程序 practice.*/pkgLearn/kg-question-card）与 #498 文件。全量本地验证三端（集成分支重跑）：backend ruff / pyright 0 / pytest **618**（同机 main worktree 606，+12）；frontend-uni（Node 22.23.2）lint + lint:tokens（lint-pages 0 error / 20 warn 同基线）/ vitest 147 文件 998 / build:h5；miniapp tsc 0 / lint 0 + 手动 vitest 14。生产仅 3 次只读 GET（`X-Kg-Probe: 1`）。
- W12D-1（backend，P0）：`auth.is_account_uid` → `isinstance(uid,str) and _ACCOUNT_UID_RE.match(uid.strip())`、`owns_uid` 比较 `uid.strip()`（与 handler `uid.strip()[:64]` 同口径；`main.py guard_account_uid` 只加 docstring；不改 handler/存储格式，H5/小程序无需改）+ `_RATE` 过期键每 60 s `_sweep_rate` 回收（`login:/reg:<ip>` 不再随扫描 IP 增长，限速语义不变）+ 测试 12 例。根因：守卫用未 strip 原串匹配 `^u\d+$`，`' u1'` 判非账号 uid 直接放行，query/JSON/multipart 三路径同病。本地新库 uvicorn 实测：`%20u999999999`/`u999999999%20`/JSON `' u9… '`/multipart scan_sheet/push subscribe 无 token 均 403 且不落库；本人 token 带空白 uid 200；匿名 uid 200 不变；旧正则直算 `' u1'` False 对照。**生产只读复采 rev `cda7af0d`：`%20u999999999` 仍 200 / `u999999999` 403 → 漏洞在生产仍在，回归待部署**。附带发现 `db.save_mistake` 存 uid 原串不 strip（db.py 热点，deferred）。
- W12D-2（小程序，P2）：`login.ts` 两处 merge_anon 静默 catch → `MERGE_FAIL_TIP` toast（与 H5 `login.vue:61` 逐字一致，失败仍完成登录跳转、deviceAnonUid 保留）；`request.ts/sse.ts` fail 回调 `netFailMessage`（文案取 H5 `api-policy.js` 实际值「网络错误，请检查网络后重试」「请求超时，请稍后重试」，`kg-exam-progress.isNetMsg` 仍判可重试）；`kg-card/index.wxss .kg-card--raised` `--sh-2`→`--sh-1`（= H5）；`app.json preloadRule` exam→pkgExam(all)、home→pkgLearn,pkgGrow(wifi)、profile→pkgSocial,pkgGrow(wifi)（分包 56/153/144/69 KB）；`scripts/request.test.ts` 6 例。静态核对文案/token/分包 root 全对上。**运行时未核**（Linux 无微信开发者工具：编译与预下载告警、断网中文提示、raised 深浅目视、真机登录 merge 失败 toast）。
- W12D-3（H5，P2）：`rank-card.vue`/`predict-card.vue` 外层改 `<kg-card variant="flat">` 删自造 chrome、rpx 换 token（引用页 report/stats/home 不动）；`lint-pages.mjs` SHARED 收窄 `components/(kg-*|l-icon)`、其余 `components/**` 按页面层 warn（rank/predict 现 0 命中）；`App.vue` 深色段补 `.theme-dark uni-modal` 覆盖（uni-h5 原生 modal 写死 #fff/#000/#007aff 不随主题，实施方一手截图证实；按钮色内联 style 故 !important）+ 顺手 W11 #148 删 `.card/.stat-c` 死壳、`.cellcard/.searchbar` 去阴影；测试 4 例。本地 dist（uvicorn 同源托管 + `test-w12-int-*` 造数：60 题卷 13 人榜 / 92 题 answer_log 预测分）CDP 375/1440 明暗实测：`.rcard/.pcard` = `kg-card kg-card--flat` radius 14px / pad 16px / shadow none / 1px `--line`，文本逐字一致；深色「关于」modal bg rgb(29,31,40)=`--card`、文字 `--ink`/`--ink-2`、按钮 `--brand-text`；明色 modal 不受影响。截图 `~/w12int/shots/`（12 张）。**生产 UI 待部署**。
- 数据纪律：全部在本机临时库 `~/w12int/app.db` + 本机 Chrome；本机造数 `test-w12-int-*` 随临时库丢弃；生产 3 次只读 GET（health + mistakes 无 token ×2），未造数、未触发 LLM、未改配置、未部署。
- 上线与回归（2026-09-08 15:35Z）：#682 合入 main 后，线上 rev 已被另一会话部署为 `42df6d14`（PR #683 R545 分支，未进 main），谱系闸拦住直接部署 main；处理为把 origin/main（含 W12）merge 进 #683 分支（`a707322a`，0 冲突，本地 pytest 621 / vitest 1009 / lint / tsc+eslint 全绿）并从该分支部署，这样 #683 合入后 main 自然包含线上 rev。`deploy_h5.sh` 全程 OK：bundle `index-Dxu3v3c0.js` 一致、接口回归全 200、Lighthouse `/` 0.98/1.00/1.00、`/tiku/` 1.00/1.00/1.00；容器 0 Traceback / RestartCount 0。**W12D-1 生产实测**：`GET /api/mistakes?uid=%20u999999999` 无 token 200 → **403**，`u999999999` 403，匿名 `test-w12-anon-zz` / `%20test-w12-anon-zz` 200 不变。测试代理独立复验 PR #682（本地 uvicorn + dist + CDP 375/1440 明暗，录屏 + 19 张截图，见 PR 评论）：空白/制表/换行/CRLF/U+3000/NBSP/70 空格/300 位 uid 三路径全 403 不落库，`U1`/`u1\0`/ZWSP/`u1+` 视为匿名无泄露，重复 query 守卫与 handler 同取最后值，login 第 11 次 429，sweep 不提前回收；H5 rank/predict/modal/深色全站走查全过，lint-pages main 树用新脚本恰多 2 条即本 PR 修掉的两卡。备注：`_sweep_rate` horizon 取历史最大窗口（300s 键在 3600s 键存在时延后回收，安全侧）；`save_mistake` 存 uid 原串仍是 deferred。小程序运行时与 W12D-3 生产 UI 目视仍未核（部署后只做了 API 回归）。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W12 追加）」（部署后回归清单、收藏 favQuestions 口径待热点释放、exam source='exam' 1 行、save_mistake uid strip、小程序解析去重/exam.ts·social.ts errMsg/11 处 raised→flat 真机/shenlun page-scroll/profile 错题数 limit、_answer_state 与 _judge_paper 事务待量化、W12-C R8–R14、lint-pages 焦点环白名单、小程序测试落点、W9–W11 沿用项、流程）；详证 docs/iter/workflow/w12.md（被拒 8 条见 §2）。

### W14（题库分发互斥零 schema + async 端点同步 SQLite 入 threadpool/打卡 total 口径 + 错题计数走 `/api/growth.mistakes` 三端同源集成轮，分支 devin/wf-w14-integration，PR #697 merged → 生产 rev `34bb5207`，回归见 w14.md §7）
- 集成：origin/main `39e92b63`（#695 R549）切 `devin/wf-w14-integration`，依次 merge W14-C1（`2004aa77`，基于 `39e92b63`）/ W14-B1（`61dbf739`）/ W14-B2（`930adcce`，两者基于 `4e8cdf3c`），merge 点 `1882325b`/`ff5fa970`/`e7ca9d75`，三次无冲突；dropped 无。合并后 diff 24 files +830/−68。集成阶段代码修正 1 处：`frontend-uni/tests/book-r541-review-mastered-verdict.test.js:106` 小程序源锁在 main 上已随 R549 失效（`book.ts` import 多 `nextReviewText`），更新断言。全量本地验证三端（三端均受 B2 影响故全跑）：backend ruff / pytest **708**（抖动 3 文件 ×20 全过）；frontend-uni（Node 22.23.2）lint + lint:tokens / vitest **1061**（156 files）/ build:h5；miniapp tsc 0 / eslint 0。生产零请求。
- W14-C1（content，P1）：`quality.family_key(row)` = `mh:`（ziliao material_hash）/ `fam:`（R12 合成族）/ `ck:`（R13 归一题干，仅有选项题）/ None；`qbank_api._draw_questions` 首抽无同族原样返回，有同族才过采 3 倍（has_hs 优先）→ `_dedupe_family` 首见放行、不足回填、截 limit；只接普通 `/api/questions`，`grouped/reinforce/db.py` 零改动、不下架不改答案。`content_gate_dryrun.py --dist-sample K` 只读复刻抽法统计前后重复率。`w14c-r8-ledger.md` R8 25/25 逐题「现状/处置/最终文本」（q155207 存储答案 B 实为 D；类型④缺图 11 条回源），负责人用 `PATCH /api/admin/questions/{qid}` 应用，分支不写库。本地 uvicorn（种子库 9,217 题）五模块 ×20 组 ×10 题重复 0（基线直接 `random_questions` 1000 题重复 2），p95 ≤ 11.6 ms，三条不受影响路径 200 形状不变。
- W14-B1（backend，P1）：`ai_api`（explain/explain_stream 缓存读写、`mistake_analysis_stats`）/ `exam_api.api_scan_sheet` / `interview`（`_save_session/_update_review`）/ `shenlun_api`（`shenlun_question/save_shenlun_answer`）同步 SQLite 移入 `run_in_threadpool`；`social.api_checkin_summary` `total=sum(days.n)`（原只数 answer_log，review_log 打卡不计）；`test_w10_exam_snapshot_rank` 改 a 全对/b 全错去随机。本地实测：外部 `BEGIN IMMEDIATE` 持锁 3 s 期间 async analysis 并发下 `/api/health` ×5 各 3–6 ms；仅 review_log 3 次 → `total=3=sum(days)`。
- W14-B2（backend+H5+小程序，P2）：`db.mistake_counts(conn,uid)` → `/api/growth.mistakes{total,mastered,pending}`（原字段不变、uid 隔离）；H5 `profile.vue applyGrowth` 错题本数、`stats.vue masteredCount` computed 改读 growth，删 `/api/mistakes` 计数请求（老后端缺省：profile 只读本机旧快照/0，stats 0，均不再发请求）；小程序 `profile.ts` 删 `loadMistakes/fetchMistakes`，`loadGrowth` 一次 setData `mistakeN/mastered`，WXML/WXSS 零改动。本机 dist 同源托管 + CDP 375/1440 明暗 8 组：每组 `/api/growth` 1 次、`/api/mistakes` 列表 0 次、pageerror 0；profile「错题本 3」、stats 勋章「斩题十道 1/10」与造数 `{3,1,2}` 一致。截图 `~/w14-shots/`。**小程序运行时未核、生产 UI/API 待部署回归**。
- 数据纪律：全部在本机临时库 `~/w14-int.db` + 本机 Chrome；`test-w14-int-*` 造数全表精确删除 LEFTOVER 0；生产零请求、未触发 LLM、未改配置、未部署、未建 PR。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W14 追加）」（部署后回归清单、生产 `--dist-sample` 前后对照与持久化列决策、W14-C 内容缺陷人工处置、R8 台账 PATCH 应用、小池回填取舍、小程序真机、源锁漂移流程）；详证 docs/iter/workflow/w14.md（被拒/未立项 6 条见 §2）。
- 生产部署（09-08/09）：后端 rev `8dc0c4b0→34bb5207`，容器 RestartCount 0 / Traceback 0；CF Pages 4c 因 shell Node 20 失败后 nvm 22 手工重跑成功（`index-DcRpFrOn.js` 上线，5 种 Accept-Encoding 均 JS），脚本已加 Node <22 自动切 nvm 22 预检。生产回归：`/api/growth.mistakes` `{0,0,0}→{3,1,2}`；`checkin/summary` 仅 review ×2 → `total=2=sum(days)`；生产 H5 profile/stats 页 `/api/mistakes` 0 次 `/api/growth` 1 次；生产库 `--dist-sample` K=500 同族 0.3%→0.0%（增量 p95 0.8 ms），数学运算小池（42 题）5.5%→0.0%；`test-w14-%` 全表清理 LEFTOVER 0。未做：R8 25 条人工 PATCH、小程序运行时核对。

### W15（H5 请求层 GET in-flight 合并 + 只读白名单 3 s TTL，以及 `</style>` 外孤儿 CSS / 焦点环命中 input / 解析近重复 / 社交条 emoji / 雷达标签五处组件层根因 + 小程序 W15-M1 五点，分支 devin/wf-w15-integration）
- 集成：origin/main `ac98c0b8`（#703 R551）切 `devin/wf-w15-integration`，merge W15-H1（`368ac416`，基于 `f193a69f`，与 R550/R551 4 个提交文件零交集）→ merge 点 `39601294`，无冲突；集成阶段代码修正 0。**dropped：W15-C1（生成型文案模板感改写）、W15-M1（小程序 shenlun page-scroll/request.ts 超时/答题卡/PK 结果/segmented）**——实施方结果均「失败」无分支，集成方不代做，精确修法与前置样本口径原样登记 backlog。合并后 diff 13 files +477/−42 全在 `frontend-uni/`。
- W15-H1（H5，P1）：新增 `src/api-get-cache.js`（in-flight Map + fresh Map + gen 世代，uid 变化/非 GET 写请求整体作废，`/api/track` 例外），`api.js request()` GET 走 `getCache.run`（白名单 `READ_ONLY` 在 `snapCacheable` 上再收窄为纯 SELECT 端点，TTL 3 s；`questions/*`/`*/resume`/`review*` 只合并不缓存；带 `opts.timeout` 与非 GET 不进合并层；12s→20s 重试/guardStaleUid/snapSave/24h 快照回退顺序不变）；`exam.vue .multi-tip`、`share-q.vue .multi-bar/.multi-hint` 搬回 `<style>` 并 token 化、`login.vue` 5 行碎片删除（源锁测试扫 `src/**/*.vue`）；`a11y-focus.js` `:focus-visible` 排除 input/textarea/.uni-input-input/.uni-textarea-textarea，输入容器 `:focus-within` `--brand` 描边；`exp-dup.js` 归一化（空白/全半角/收束句）+ 句级覆盖率 ≥0.8，<20 字 fail-closed，practice.vue 零改动；`q-social-bar` 6 处 emoji → l-icon（CSS mask 单色）；`stats.vue` `.axis-label/.al-name/.al-val/.rs-name/.rs-pct` nowrap（根因 `uni-text{white-space:pre-line}` 元素选择器需在 text 本身覆盖）。
- 验证（本机，Node 22.23.2 / Py 3.12）：backend ruff 通过、pytest **726 passed**；H5 lint / lint:tokens（116 tokens、lint-pages 0 error/20 warn 存量）/ vitest **161 files 1160 passed**（main 同机 158/1077）/ build:h5 成功且 dist 含 `.multi-tip/.multi-hint/.rs-name{…nowrap}`；小程序 tsc + eslint 通过（零改动）。本机 uvicorn 临时库 + dist 静态托管，Playwright 375/1440 与 origin/main 基线 worktree 同脚本对照：搜索框 input outline none→容器 `--brand` 2px（基线环在 input 上）、Tab 非文本控件环保留、社交条 emoji→3 个 `.l-icon` mask、雷达 5 轴标单行 nowrap（**本机基线未复现「数量」竖排**，生产 375 待复核）；7 切 tab 请求数 基线 50/50/45/44 → W15 28/42/28/38（dwell 600/1200 ms 两序列），`/api/mistakes` 列表 0 次。**「≤20」目标未达成**（非幂等 resume/review 与 track 按设计不缓存，≥1.2 s 停留 TTL 到期回源），转 deferred。模考多选提示 UI 未核（只核 dist CSS）。
- 数据纪律：全部本机临时库 `~/w15-local/app.db`、`app-main.db` + 本机 Chrome，仅 `test-w15-int-local` 造数随库丢弃；生产零请求、未触发 LLM、未改配置、未部署、未建 PR。
- W15-M1（miniapp，P1，主会话补做，w15.md §7）：shenlun 页主体改 `<scroll-view class="page-scroll" scroll-top="{{scrollTop}}">` + `scrollToTop()`（1→0 触发）替换 `wx.pageScrollTo`；`utils/request.ts` 新增 `sendRequest()`——GET 默认 12 s、超时重试一次 20 s，非 GET/显式 timeout 不变；`kg-answer-card` `groupCells(cells, grouped)` grouped=false 单组 + grid `repeat(auto-fill,minmax(40px,1fr))`；`pk-result .mid` 可收缩 + 胜者标签 ellipsis（`kg-tag` 组件补 `max-width:100%`）；`kg-segmented` 标签下沉 `<text class="kg-seg__label">` 省略（外层不可 overflow:hidden，会裁 ::before 命中扩展）。新增 `scripts/{request-timeout,answer-card-group,page-scroll-lock}.test.ts`；小程序 tsc/eslint/tokens 0、vitest 7 files 42 passed。**运行时未核**（Linux 无开发者工具）。
- 遗留台账：docs/iter/workflow/backlog.md「Deferred（W15 追加）」（部署后回归清单、≤20 请求目标、W15-C1/W15-M1 整项、kg-card chevron、PK random_match 窗口 W16 backend 首位、book.vue/home.vue 热点项、小程序组件旁路迁移 P2、content 人工/规则项、R12/R13 不加列决策已关闭、新需求提案）；详证 docs/iter/workflow/w15.md（dropped/被拒 15 条见 §2，浏览器对照表见 §4.2）。

### W16 follow-up（#713 W15 生产回归两缺陷 + 部署 main `aa94f602`，2026-09-09）
- 生产真实回归（W15 #709 上线后 rev `db847006`）两项失败 → #713（分支 `devin/w16-followup`）：① `a11y-focus.js` `HOST_RE` 补 `UNI-BUTTON`（uni-h5 `<button>` 编译为自定义元素不在 Tab 序列，5 个 `kg-btn` 全 tabIndex=-1）；② `api.js request()` 非埋点写请求在发起 `getCache.clear()` 之外 settle 后再 clear 一次（写在途期间首页 GET 读到写前快照后不再按 3 s TTL 复用，生产曾见「0/20 直到 F5 才 10/20」）。新增 `tests/w16-write-window-cache-and-button-focus.test.js`，`api-w15-get-dedupe`/`api-r499-stale-uid-response` 源锁契约同步。本机 vitest 1193 / lint / build:h5 全绿；本地 dist Chrome CDP 实测 Tab 第 2 步到主按钮、焦点环、Enter→click。
- 部署：线上 `695c4712` 为另一会话 R554 分支的未推送 merge（本机构建 `93acc3b6` 前端 bundle hash `index-C0q6uHnI.js` 与线上一致 → 内容 ⊆ main），#714 合入后 `DEPLOY_FORCE=1` 部署 origin/main `aa94f602`（`index-FGt-wyTc.js`，6/6 全 200；6b `/` a11y 0.94 为容器刚重建 warm-up 期，随后连跑 3 次 1.00）。
- 生产复验（测试代理，隔离 context/375/uid `test-w16-prod-h5`，两组 10 题）：回首页 `home_bundle` 恰 1 次、`today_n` 正确，首帧仍为上次值 ≈200–340 ms 后 1 次 patch 到位（响应前渲染，非缓存命中，无 F5 依赖）；做题页答题/未答/完成态 `kg-btn` 14/14 tabindex=0+role=button，Tab 第 27 步到「下一题」焦点环；console 0/0、141 次 API 全 2xx；造数 35 行精确清理归零。**未复现**「完成→返回 <3 s」严格写窗口（工具延迟 4.84 s），该形态仅单测覆盖。
- W17 候选（本轮观察）：完成 daily set 后首页「再练一组」返回同样 10 题；做题页 a/b/c/d/Enter 快捷键在 375 模拟下未触发 `onPKeydown`；回首页首帧旧值可否用乐观本地累加抹平；部署非零停机窗口仍待零停机改造。
