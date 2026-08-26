# 错题邦 竞品逐屏地名录（Gazetteer）— SOP-10 A 阶段

- 采集日期：2026-08-26
- 采集方式：Playwright Chromium 实访（移动端 375×812 @2x，iPhone UA；桌面端 1440×900 @2x）
- 合规说明：仅采集公开网页与 App Store 官方公开截图作为研究素材，未复制竞品源码/文案/商标/字体；未使用临时邮箱或注册竞品账号；登录墙/App 内屏一律用公开素材补齐并在下表标注「App Store 公开截图」。
- 生产数据说明：实访错题邦时产生的 1 条测试错题（匿名 uid `umtaedscyqrorhikw`，mistake id 907）已通过 API 删除，生产数据无残留。

## 一、主标尺确认（实访结论）

**主标尺：粉笔（错题本/题库学习闭环）；能力标尺：夸克拍题批改（拍题/AI 讲解链路）；参照：小猿搜题（搜题解析/视频讲题交互）。**

理由（基于实访证据）：
1. 错题邦的核心身份是「考公刷题 + 错题本 + 学习统计」，与粉笔的「练习-错题-模考-统计」学习闭环同构（见 appstore-fenbi-01~05：练习主页含模块级进度 25/1540、考试切换器、模考大赛、错题本）。粉笔是考公赛道事实标准，用户心智基准，定为唯一主标尺符合 SOP-10「一个产品一个主标尺」。
2. 夸克不是学习闭环产品（主体是 AI 浏览器/网盘），不适合做整体主标尺；但其「拍题批改」相机链路（模式轮播：翻译/批改/拍题/扫描，历史|错题入口，深度解题/极速拍题双模式，AI 老师讲题卡）是拍题体验的最佳公开范本，作为「拍题/AI 问答」屏的能力标尺。
3. 小猿搜题的「拍照解题结果页」（题目/本题视频/题目解答三 Tab + 分步解析卡 + 加错题本/再拍一页/AI 问本题底栏）是搜题结果呈现的成熟范式，保留为参照。
4. 调整说明：任务给的候选是「粉笔错题本 + 夸克拍搜」双主标尺；按 SOP-10 单主标尺原则，收敛为 **粉笔为主标尺**、夸克降级为拍题链路能力标尺，不改变研究覆盖面。

## 二、竞品屏幕索引

### 粉笔（主标尺）
| 编号 | 屏幕 | 素材 | 来源/状态 |
|---|---|---|---|
| FB-W01 | 官网首页 | screens/fenbi-w01-home-desktop.png / fenbi-w01-home-mobile375.png | fenbi.com 公开网页，1440+375 全页 |
| FB-W02 | 网页题库（行测真题列表） | screens/fenbi-w02-tiku-desktop.png / fenbi-w02-tiku-mobile375.png | fenbi.com/spa/tiku 公开，未登录态 |
| FB-W02b | 题库点击试卷（登录墙触发态） | screens/fenbi-w02b-tiku-paper-click-desktop.png | 公开可达，做题需登录（登录墙已标注） |
| FB-W03 | 下载页 | screens/fenbi-w03-download-desktop.png | 公开网页 |
| FB-A01 | App 练习主页（学习中心/模块进度/底部五 Tab） | screens/appstore-fenbi-01.png | App Store 公开截图（id584660358） |
| FB-A02 | 添加考试/考试切换 | screens/appstore-fenbi-02.png | App Store 公开截图 |
| FB-A03 | 模考大赛 | screens/appstore-fenbi-03.png | App Store 公开截图 |
| FB-A04/05 | 课程/成绩报告等 | screens/appstore-fenbi-04.png、-05.png | App Store 公开截图 |
| — | App 内错题本/答题页/解析页细节 | ../design-benchmark/fenbi/appstore/（既有素材） | App Store 公开截图（前次采集） |

### 夸克（拍题链路能力标尺）
| 编号 | 屏幕 | 素材 | 来源/状态 |
|---|---|---|---|
| QK-W01 | 官网首页 | screens/quark-w01-home-desktop.png / quark-w01-home-mobile375.png | quark.cn 公开网页 |
| QK-A01 | App 主页（AI 搜索+相机入口） | screens/appstore-quark-01.png | App Store 公开截图（id1160172628） |
| QK-A02 | 千问 AI 助手（拍题答疑/作业批改工具位） | screens/appstore-quark-02.png | App Store 公开截图 |
| QK-A05 | 拍题批改相机（模式轮播/历史|错题/深度解题/示例搜题/AI 老师卡） | screens/appstore-quark-05.png | App Store 公开截图（拍题主链路关键屏） |
| QK-A03/04/06 | 扫描王/网盘/其他 | screens/appstore-quark-03/04/06.png | App Store 公开截图 |

### 小猿搜题（参照）
| 编号 | 屏幕 | 素材 | 来源/状态 |
|---|---|---|---|
| XY-W01 | 官网首页 | screens/xiaoyuan-w01-home-desktop.png / -mobile375.png | yuansouti.com 公开（xiaoyuansouti.com 证书 CN 不匹配，经跳转采集并忽略证书告警） |
| XY-A01 | 拍照解题结果页（题目/本题视频/题目解答 Tab + 分步解析） | screens/appstore-xiaoyuan-01.png | App Store 公开截图（id906995758） |
| XY-A03 | 作业批改相机（对错标注+模式轮播+快门） | screens/appstore-xiaoyuan-03.png | App Store 公开截图 |
| XY-A04 | 视频讲题（真人老师+结果多 Tab+加错题本/再拍一页/AI 问本题底栏） | screens/appstore-xiaoyuan-04.png | App Store 公开截图 |
| XY-A02/05/06 | 口算PK/扫码搜书/拍照翻译 | screens/appstore-xiaoyuan-02/05/06.png | App Store 公开截图 |

### 错题邦现状（实访 kaogong.zalize.com）
| 编号 | 屏幕/状态 | 素材 |
|---|---|---|
| OU-01 | 首页（视口）+ 全页 375 + 1440 | screens/ours-01-home-mobile375.png、ours-01b-home-full-mobile375.png、ours-01-home-desktop.png |
| OU-02 | AI 问答（空态） | screens/ours-02-ask-mobile375.png |
| OU-03 | 错题本（空态）375+1440 | screens/ours-03-book-mobile375.png、ours-03-book-desktop.png |
| OU-04a | 刷题加载态（直达路由 >36s 仍在「正在准备练习」） | screens/ours-04a-practice-loading-mobile375.png |
| OU-04b | 刷题模块列表+题型底部弹层 | screens/ours-04b-practice-module-sheet-mobile375.png |
| OU-04c | 刷题答题中（资料分析题组） | screens/ours-04c-practice-question-mobile375.png |
| OU-04d | 答错判分态（对错高亮+题干重点标注+自动入错题本+下一题） | screens/ours-04d-practice-answered-mobile375.png |
| OU-05 | 统计（未登录态：热力图/雷达/预测分占位） | screens/ours-05-stats-mobile375.png |
| OU-06 | 我的 | screens/ours-06-profile-mobile375.png |
| OU-07 | 模考列表 | screens/ours-07-examlist-mobile375.png |
| OU-08 | 申论 | screens/ours-08-shenlun-mobile375.png |

## 三、公开 DOM/CSS 参数（design-params.json 摘要）

原始数据：`design-params.json`（Playwright getComputedStyle 实测）。

| 项 | 粉笔官网 | 粉笔题库 SPA | 夸克官网 | 错题邦 |
|---|---|---|---|---|
| 正文字体 | system-ui/PingFang SC 系 14px/22px | -apple-system/PingFang SC 16px | 16px 系统字体 | 16px 系统字体 |
| 品牌主色 | #0099FF（链接/高亮 #1890FF 系） | 蓝 #0099FF 系 | 夸克蓝（渐变） | #3B5BFB~#4A6CF7 蓝 |
| 页面底色 | #FFFFFF | 透明+浅蓝渐变头部 | 透明/白 | #F6F7FB |
| 按钮圆角 | 6–8px（登录 6px、卡片按钮 8px） | 0/胶囊混用 | 大圆角胶囊 | 12–24px 胶囊为主 |
| 桌面容器宽 | 1430/1280/1180/1138/1106/1100 | 同左 SPA 栅格 | 全宽横幅 | H5 未做桌面适配（内容 375 栅格拉伸） |
| 动效 | color .3s；cubic-bezier(0.645,0.045,0.355,1) .3s | all 过渡 | — | 少量过渡 |

关键可复用参数（非素材，仅设计规格）：粉笔系 8px 圆角卡片 + 14px 正文 + 22px 行高 + 0.3s ease 过渡；主色蓝一致性（我方 #4A6CF7 与粉笔 #0099FF 同为蓝系，无需改色相，需统一深浅层级）。
