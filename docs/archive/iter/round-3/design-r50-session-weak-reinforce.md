# R50 设计方案：完成页「薄弱考点强化」直练入口

## 一手证据（2026-08-29 生产取证）

- 竞品标尺：粉笔/夸克刷题在作答报告页均提供「错题相似题/举一反三」入口，答错后可就地补练同考点新题，是错题闭环的关键一跳。
- 我方生产刷题页完成/结算页（`pages/practice/practice.vue` done card）实测：有正确率环、错题重练效果卡、模块正确率条、题号回看、到期复习 nudge，但**没有任何按错题考点的强化入口**——答错后用户需自行进错题本逐题点 `···` 才能触发「同考点强化」（book.vue L1254），或等复习完成卡（spec-03）。
- 既有能力：practice 页已有 `startReinforce(launch)`（/api/questions?mode=reinforce&tag3=…，仅未做过新题），错题本已复用；题目 item 自带 `module/question_type/tag3` 字段（生产 /api/questions 实测确认）。
- 深色模式全站扫描（1440，practice/book/stats/plaza 四页运行时亮背景检测）无 P0 残留，不立项。

## 方案

完成页（非背题模式、非模考态、本组有错题时）在错题重练卡之后新增「薄弱考点 · 趁热打铁」区块：

- 本组错题按 `tag3 || question_type || module` 聚合，展示考点名（复用 book.tagName 语义：question_type 去模块前缀，缺省模块名）+「本组错 n 题」，按错题数倒序取前 3。
- 每行「强化 5 道新题」按钮，直接调用本页既有 `startReinforce({ module, submodule, tag3, count: 5, source: 'session-report' })`，无新接口、无跳页。
- 复用 `.redoreport` 视觉族（soft 底卡 + var token），375/桌面同结构。

## 验收标准

- 混模块组答错后完成页出现分考点强化行，点击即开新一组 5 道未做过同考点题；全对组不出现该区块；背题/模考态不出现。
- 1440/375 无溢出、console 0 error；游客真实作答取证；保护 uid 零 mutation。

## 风险与未覆盖

- 纯前端复用既有 reinforce 通道；该考点无新题时既有 toast 兜底「换个考点试试」。回滚删块即可。
