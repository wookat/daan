# 考公错题助手 · 微信原生小程序（miniapp-native）

微信原生小程序全量重写（一期 + 二期），替代 uni-app 产物。

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
        ├── profile/           # 我的：能力预测分卡、打卡卡片、收藏/笔记入口、深色三档、学习提醒占位、登录态
        └── login/             # 登录/注册（/api/auth，登录后 merge_anon 合并匿名记录）
```

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

## 三期未覆盖项

- AI 问答/讲解流、面试、PK 对战、时政每日一练、申论——三期排期。
- 学习提醒为本地占位（订阅消息模板 ID 待配置后接入 `wx.requestSubscribeMessage`）。
- miniprogram-ci 自动化预览/上传未接入（无小程序私钥）；以开发者工具手动导入为准。
