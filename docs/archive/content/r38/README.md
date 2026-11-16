# 轮38：迷你模考报告「薄弱考点」卡 + r37 P2 遗留清理

日期：2026-08-09。分支：devin/1786294310-r38-weak（主体功能 feb159a 已随 PR#109 合并进 main；本分支追加 admin 修复+本报告）。

## 1. 迷你模考报告薄弱考点卡

### 后端（backend/app/main.py）
`GET /api/exam/report/{attempt_id}` 新增返回 `weak_tags`：
- 按本卷题目的 tag3 聚合（跳过空/UNKNOWN），`n`=该 tag 本卷题数（含未作答），`wrong`=已作答且答错数；
- 仅保留 wrong>0 的 tag，按 wrong 降序、n 降序取前 3；
- 形状 `{tag3, name, n, wrong}`，name 取自 taxonomy topic 索引，与模考大赛报告（mock_event.py）口径一致。

### H5（frontend-uni/src/pkgA/exam/report.vue）
- 「本卷薄弱考点」卡：逐行展示考点名 + 「错 x/y 题」+「去练 ›」；
- 点击写入 `practiceLaunch`（kind=start, tag3, count=10, adaptive）后跳转练习页，复用现有强化入口；
- 无弱项时空态文案「本卷错题较少，暂未形成薄弱考点结论，继续保持！」。

### Flutter（app-flutter/lib/pages/exam_report_page.dart）
- 同卡片 `_weakCard()`，点击 `/practice?tag3=...&count=10`；`flutter analyze` 通过。

### 原生小程序
- 未复刻：miniapp-native 一期未覆盖全真模考/成绩报告页（README 明确），无迷你模考报告页可挂载该卡，属功能新增而非同步，留待后续轮决策。tsc + eslint 复跑通过（0 错误）。

## 2. r37 P2 遗留 4 项处置

| # | 项 | 处置 |
|---|----|------|
| 1 | 迷你模考报告无薄弱考点卡 | 本轮主功能，已实施（见上） |
| 2 | 首页首屏密度高、「今日建议」需滚动 | 移除独立「今日复习已清零」灰白卡（任务卡内清零行保留），hero padding/margin 压缩 |
| 3 | 深色热力图口径说明对比度低 | stats.vue `.hm-note` 改用 var(--ink-2)，深色 #9ba0b0 可读 |
| 4 | 后台登录无法区分未配置/令牌错误 | 后端：未配置 ADMIN_TOKEN 返回 503「服务端未配置管理令牌，请联系管理员」；错令牌 401「无效管理令牌」。前端 core.js 分别展示 |

## 3. 构建与部署

- H5 `npm run build:h5` 通过；miniapp `tsc --noEmit`+`eslint` 0 错误；Flutter analyze 0 issue。
- 部署：生产先备份 /data/bak_r38_pre.db → rsync backend + h5 dist → docker compose up -d --build；回归 /api/stats、/api/questions、首页均 200，错误令牌 401。

## 4. 生产三态回归 QA（375px/桌面/深色，匿名新 uid，全程录屏）

- 迷你模考（故意错 5 题跨多 tag3）→ 报告薄弱考点卡渲染 3 行，数字与 /api/exam/report 的 weak_tags 逐行一致；点「去练 ›」进入对应 tag3 题组练习 — 通过；
- 空态（仅答 1 题全对交卷）→ 空态文案展示 — 通过；
- 深色/桌面/375px 报告页与首页无破版（scrollWidth=375）；首页独立清零卡已消失、任务卡清零行保留 — 通过；
- 热力图说明深色对比度较上轮明显提升 — 通过；
- 管理后台错令牌：无旧「令牌无效：」前缀 — 通过；但发现新 P2：登录 catch 用 `e.message`（短文案「令牌无效」）覆盖了完整提示 → **当轮已修**：401 分支 throw 完整文案，并给 admin 静态 JS 加 `?v=r38` cache-busting（旧缓存用户此前会看到旧文案）；重新部署后线上 core.js/index.html 均已验证。
- 503「未配置令牌」分支：生产已配置令牌，线上不可触发，仅源码只读确认文案存在（untested）。

## 5. 测试数据

- 备份 /data/bak_r38_qa.db 后按 uid 守卫事务清理：umsm0y17x8i2h9osv（exam_attempts 2、mistakes 5、answer_log 10）+ umsm18in97rtymof1（growth_events 3），删除后残留 0，/api/stats 200。

## 6. 限制与遗留

- 原生小程序无迷你模考报告页，薄弱考点卡未复刻（见 §1）；
- `weak_tags` 的 `n` 含未作答题（分母为本卷该 tag 总题数），如需改为「已作答数」需重新确认口径；
- admin 503 分支线上未实测（生产不可触发）。
