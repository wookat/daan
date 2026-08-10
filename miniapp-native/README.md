# 考公错题助手 · 微信原生小程序（miniapp-native）

微信原生小程序全量重写（一期），替代 uni-app 产物。

## 技术栈

- 微信原生小程序框架 + **TypeScript**（官方 typescript 模板规范：`miniprogram/` 目录 + `tsconfig.json` + npm 构建）
- 渲染层：**Skyline**（`app.json` 全局 `renderer: "skyline"`，glass-easel 组件框架；登录页因使用 TDesign 表单组件页面级降级 `webview`）
- 组件库：**TDesign 小程序组件库**（`tdesign-miniprogram`，npm 引入）
- 设计对齐 `docs/design-v3/` 原型；design token 见 `miniprogram/app.wxss`（brand `#3B6FF5`，浅色 + 深色）
- 后端复用现有 FastAPI：`https://kaogong.zalize.com/api/*`

## 微信开发者工具导入步骤

1. `cd miniapp-native && npm install`
2. 打开微信开发者工具 → 导入项目 → 选择 `miniapp-native/` 目录（`project.config.json` 所在层级），AppID 已配置为正式号 `wx01f2f29cfe51baba`
3. 菜单「工具 → 构建 npm」（生成 `miniprogram/miniprogram_npm/tdesign-miniprogram`）
4. 详情 → 本地设置：勾选「将 JS 编译成 ES5」「使用 npm 模块」；基础库选 3.x（Skyline 需要）
5. 编译预览。真机预览需在小程序后台把 `kaogong.zalize.com` 加入 request 合法域名（开发阶段可勾选「不校验合法域名」）

## 发布前配置清单（小程序后台，需管理员）

在 https://mp.weixin.qq.com （AppID `wx01f2f29cfe51baba`）：

1. 开发 → 开发管理 → 开发设置 → 服务器域名：
   - request 合法域名：`https://kaogong.zalize.com`
   - downloadFile 合法域名：`https://kaogong.zalize.com`（PDF 导出/图片题）
2. 成员管理：把开发者微信号加入「开发者」（真机预览需要）
3. 订阅消息：按需申请「学习提醒」类模板，模板 ID 回填 `pages/profile` 提醒逻辑
4. 版本管理：开发者工具「上传」后在后台提交审核（类目建议：教育→在线教育）

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
        ├── home/              # 首页：今日目标 hero、学习计划卡、专项练习入口
        ├── practice/          # 刷题闭环：抽题→判分→解析(含 hs_explanation)→answer_log 上报
        ├── book/              # 错题本：待掌握/已掌握/收藏 + 错题重练
        ├── exam/              # 模考：迷你模考 + 真题卷库列表（全真模考二期）
        ├── stats/             # 统计：本机分模块正确率
        ├── profile/           # 我的：登录态、本机标识
        └── login/             # 登录/注册（/api/auth，登录后 merge_anon 合并匿名记录）
```

## 与现有 uni-app 端对齐的关键逻辑

- **请求封装**（`utils/request.ts`）：`X-Access-Code` / `Authorization: Bearer` 头；401「未登录/登录已过期」才清登录态；「访问码」错误弹窗输入后自动重试一次。
- **匿名 uid**（`utils/auth.ts`）：storage key（`anonUid`/`deviceAnonUid`/`authToken`/`authUser`/`accessCode`）与 `frontend-uni/src/api.js` 完全一致；登录时保留本机匿名 uid 供 `merge_anon` 合并。
- **answer_log 去重**（`pages/practice/practice.ts`）：每题作答即上报 + 完成/退出时兜底批量补报；发送前先标记 `_logged`，避免在途并发重复落库；携带 `source` 埋点（如错题重练 `source=redo`）。
- **错题自动入本**：答错即 `POST /api/mistakes`（题干+选项文本、我的答案、正确答案、解析）。

## 一期未覆盖项

- 全真模考（整卷计时/交卷统一判分/成绩报告）、时政每日一练、AI 问答/讲解流、离线题包、社区（讨论/收藏夹管理/打卡海报）、申论、PDF 导出——二期起排期。
- 收藏 Tab 目前只读列表（收藏动作在刷题页二期加入）。
- miniprogram-ci 自动化预览/上传未接入（无小程序私钥）；以开发者工具手动导入为准。
