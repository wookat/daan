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
- W3-C（content）：`quality.sanitize_explanation`（广告尾句 → 抓取源统计前缀/「解析」标签族循环剥 → normalize_cjk_spaces → 空白归一，数字/字母空格保留）+ `scripts/w3_content_cleanup.py`（w2 脚本模式，dry-run 默认、`--apply` 备份 .bak-w3、rescore、不下线）。本地临时库 dry-run 2500 → apply → 复扫 0，非 explanation 列/disabled 不变；实施方生产只读快照 dry-run rewrite 10,068（prefix 5383 / ad 192 / space 10045 / blank 6）、apply 预演 158,720 行非 explanation 列不变。**生产未 apply**：容器镜像尚无 sanitize_explanation，须先部署本分支 → 容器内 dry-run 复核 → 人审「解析」标签扩展规则与公式缺图空格 → `--apply` → `docker restart`。
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
