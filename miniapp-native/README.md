# 考公错题助手 · 微信原生小程序（miniapp-native）

微信原生小程序全量重写（一期 + 二期 + 三期），替代 uni-app 产物，与网页端功能全面对齐。

## 技术栈

- 微信原生小程序框架 + **TypeScript**（官方 typescript 模板规范：`miniprogram/` 目录 + `tsconfig.json` + npm 构建）
- 渲染层：**Skyline**（`app.json` 全局 `renderer: "skyline"`，glass-easel 组件框架；登录页因使用 TDesign 表单组件页面级降级 `webview`）
- 组件库：**TDesign 小程序组件库**（`tdesign-miniprogram`，npm 引入）
- 设计对齐 `docs/design-v3/` 原型；design token 见 `miniprogram/app.wxss`（brand `#3B6FF5`，浅色 + 深色）
- 后端复用现有 FastAPI：`https://kaogong.zalize.com/api/*`

## 微信开发者工具导入步骤

1. `cd miniapp-native && npm install`
2. 打开微信开发者工具 → 导入项目 → 选择 `miniapp-native/` 目录（`project.config.json` 所在层级），AppID 可先用测试号
3. 菜单「工具 → 构建 npm」（生成 `miniprogram/miniprogram_npm/tdesign-miniprogram`）
4. 详情 → 本地设置：勾选「将 JS 编译成 ES5」「使用 npm 模块」；基础库选 3.x（Skyline 需要）
5. 编译预览。真机预览需在小程序后台把 `kaogong.zalize.com` 加入 request 合法域名（开发阶段可勾选「不校验合法域名」）

## 本地校验

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint miniprogram --ext .ts
```

## 目录结构

```
miniapp-native/
├── project.config.json        # 开发者工具项目配置（packNpmRelationList 已配置）
├── tsconfig.json / .eslintrc.js
├── package.json               # tdesign-miniprogram + typescript 工具链
└── miniprogram/
    ├── app.ts / app.json / app.wxss / theme.json   # Skyline、darkmode、design token
    ├── custom-tab-bar/        # 自定义 TabBar（Lucide 风格线性图标，data-URI SVG）
    ├── components/navbar/     # 自定义导航栏（Skyline 要求 navigationStyle: custom）
    ├── utils/                 # request 封装 / 登录态+匿名 uid / 本地统计 / 图标
    ├── api/                   # 类型化 API 层（复用现有 FastAPI 字段）
    └── pages/
        ├── home/              # 首页：今日目标 hero、学习计划三步设置弹层、今日计划卡(source=reco)、全局搜索入口
        ├── practice/          # 刷题闭环：抽题→判分→解析(含 hs_explanation)→answer_log 上报；支持 tag3 同考点强化
        ├── book/              # 错题本：待掌握/已掌握/收藏 + 错题详情弹层 + 同考点强化 + PDF 导出（三选项确认）
        ├── exam/              # 模考：真题卷库（地区/年份筛选）、迷你模考、模考大赛入口、历史成绩
        ├── exam-run/          # 整卷计时作答：答题卡、标记、退出恢复(examProgress)、超时自动交卷
        ├── exam-report/       # 成绩报告：模块正确率、逐题对错与解析、排名卡、历史趋势
        ├── contest/           # 模考大赛：赛事列表、报名/进入
        ├── contest-report/    # 大赛成绩与排名
        ├── stats/             # 统计：做题量/正确率 7 日趋势、模块雷达(canvas)、薄弱模块 CTA
        ├── mastery/           # 掌握度地图（tag3 瓦片 + 详情弹层 + 强化练习）
        ├── weekly/            # 周学习报告：学习数据、掌握度变化、建议行动
        ├── search/            # 全局搜索：题号/题干/知识点/试卷，历史记录，题目详情弹层
        ├── favorites/         # 收藏夹（文件夹管理）+ 笔记列表
        ├── poster/            # 打卡分享海报（canvas 绘制，保存相册/分享）
        ├── profile/           # 我的：能力预测分卡、打卡卡片、收藏/笔记/面试记录/时政收藏入口、深色三档、学习提醒、登录态
        ├── login/             # 登录/注册（/api/auth，登录后 merge_anon 合并匿名记录）
        ├── ask/               # AI 问答：会话式拍题/文字问题、答案卡、追问、评价、存错题本、最近讲解、本地会话归档
        ├── interview/         # AI 面试陪练：分类抽题→计时作答→5 维打分+点评+参考框架
        ├── interview-history/ # AI 面试历史记录
        ├── pk/                # 答题 PK：发起/挑战码应战/随机匹配、10 题限时、胜负页、周榜、我的对局、微信分享
        ├── shenlun/           # 申论：真题库(题型/年份/地区筛选)、作答(草稿自动保存)、AI 批改报告、素材库+收藏、作答记录
        ├── discuss/           # 每题讨论区：最热/最新、评论/回复/点赞/删除自己的评论（发言需登录，游客可浏览）
        ├── szfav/             # 时政收藏（本机 storage，与 uni 端 szFavs 一致）
        └── reminders/         # 学习提醒设置：开关+时间选择+效果预览，订阅消息占位（模板 ID 待配置）
```

时政每日一练复用 `pages/practice/practice?mode=shizheng`（完成后 `mode=szreview` 回顾），题目页解析下方提供「讨论区」与「题目纠错」入口（/api/question_report）。

## 与现有 uni-app 端对齐的关键逻辑

- **请求封装**（`utils/request.ts`）：`X-Access-Code` / `Authorization: Bearer` 头；401「未登录/登录已过期」才清登录态；「访问码」错误弹窗输入后自动重试一次。
- **匿名 uid**（`utils/auth.ts`）：storage key（`anonUid`/`deviceAnonUid`/`authToken`/`authUser`/`accessCode`）与 `frontend-uni/src/api.js` 完全一致；登录时保留本机匿名 uid 供 `merge_anon` 合并。
- **answer_log 去重**（`pages/practice/practice.ts`）：每题作答即上报 + 完成/退出时兜底批量补报；发送前先标记 `_logged`，避免在途并发重复落库；携带 `source` 埋点（如错题重练 `source=redo`）。
- **错题自动入本**：答错即 `POST /api/mistakes`（题干+选项文本、我的答案、正确答案、解析）。

## 二期新增页面清单

- 模考：`exam`（真题卷库+筛选）、`exam-run`（整卷计时/答题卡/退出恢复）、`exam-report`（成绩报告+排名卡）、`contest`、`contest-report`
- 统计：`stats`（趋势+雷达）、`mastery`（tag3 掌握度地图）、`weekly`（周学习报告）
- 我的：`profile`（能力预测分卡/打卡/设置）、`poster`（打卡分享海报）、`favorites`（收藏夹+笔记）
- 首页：学习计划三步设置弹层 + 今日计划卡（source=reco）、`search`（全局搜索）
- 错题本：错题详情弹层、同考点强化（tag3 推题）、PDF 导出入口（/api/export/pdf，确认弹层三选项）

## 三期新增页面清单

- AI：`ask`（问答/拍题讲解，文字题走 `enableChunked` 分块接收 SSE 流式输出，图片题走 `wx.uploadFile` 一次性返回）、`interview` + `interview-history`（面试陪练，原生端用非流式 `/api/interview/answer`）
- 对战：`pk`（创建/应战/随机匹配/周榜/我的对局/分享，未完赛局 4s 轮询对手成绩）
- 时政：首页「时政每日一练」卡片（完成状态 `szDaily` 与 uni 端一致）+ `szfav` 时政收藏
- 申论：`shenlun`（题库/素材/记录三 tab，草稿 `slDraft:<id>` 自动保存，AI 批改报告，素材收藏走后端 /api/shenlun/mat_favs）
- 社区：`discuss` 每题讨论区 + 刷题页题目纠错弹层（7 类型 + 500 字说明）
- 提醒：`reminders` 设置页（storage key `remindOn`/`remindTime` 与 uni 端一致）

## 与网页端（frontend-uni）功能对齐清单

| 功能域 | 网页端 | 原生小程序 | 说明 |
| --- | --- | --- | --- |
| 刷题闭环/错题本/模考/大赛/统计/掌握度/周报/搜索/收藏夹/海报/登录 | ✅ | ✅ | 一期/二期 |
| AI 问答（拍题/文字、答案卡、追问、评价、存错题、最近讲解、访问码） | ✅ | ✅ | 文字题流式（分块接收），图片题非流式 |
| AI 面试陪练（5 维打分/点评/参考框架/历史） | ✅ | ✅ | 原生用非流式接口 |
| 答题 PK（创建/应战/随机匹配/周榜/我的对局/分享） | ✅ | ✅ | 小程序额外支持微信会话分享 |
| 时政每日一练 + 时政收藏 | ✅ | ✅ | 完成/回顾/收藏 storage 结构一致 |
| 申论（题库/筛选/作答/批改/素材/记录） | ✅ | ✅ | 草稿本机自动保存 |
| 每题讨论区（热/新、回复、点赞、删除） | ✅ | ✅ | 发言需登录 |
| 题目纠错 | ✅ | ✅ | 同 7 种类型 |
| 学习提醒 | ✅（H5 Notification） | ✅（设置页+订阅消息占位） | 模板 ID 待正式 AppID 后配置 |

## 未覆盖项

- 订阅消息正式下发：需正式 AppID 申请模板后在 `utils/reminder.ts` 填入 `MP_SUBSCRIBE_TEMPLATE_ID` 即可启用（`wx.requestSubscribeMessage` 流程已就绪）。
- AI 面试逐字流式输出（H5 专属 stream 接口）：原生端用非流式接口一次性返回，体验降级不影响功能。
- miniprogram-ci 自动化预览/上传未接入（无小程序私钥）；以开发者工具手动导入为准。
