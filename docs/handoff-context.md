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

### R101（2026-08-31）：首载静态启动屏——消除慢网络首访白屏
- 取证：RUM 实录真实用户首载 nav:16s/dom:7.5s/tx:10.6s，index.html #app 为空、Vue 挂载前全程白屏（历史 60/90s 聚簇同理）；明日 08:00 推送深链 /?daily=1 也走该路径。
- 实现：index.html #app 内静态启动屏（logo+错题邦+副标题+CSS spinner，纯内联零请求），prefers-color-scheme 深色适配，Vue mount 整树替换无需清理。设计文档 docs/iter/round-3/r101-boot-splash.md。
- 生产验收：1440+375 新 context 60KB/s 节流实测——加载期启动屏全屏可见，挂载后移除、首页正常、溢出 0、console 0 error。已订阅 SW 的存量客户端拿旧壳无启动屏，随 R71 壳更新通道自然获得。
