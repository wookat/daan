# 轮33：三端复习闭环对齐 + P2 清理（updated_at / sitemap lastmod / 清零空态）

日期：2026-08-09 ｜ 分支：devin/1786283562-r33-parity ｜ 生产：https://kaogong.zalize.com

## 1. 三端复习闭环入口对齐

轮32 的 H5 复习闭环入口（首页到期卡 / 练习完成页引导 / 错题本入口 + `review_entry_click` 埋点）复刻到原生小程序与 Flutter：

### 原生小程序（miniapp-native）
- `api/types.ts` / `api/index.ts`：新增 `ReviewResp`、`ReviewRecordResp`、`fetchReviewDue()`、`postReviewRecord()`（复用 `/api/review`、`/api/review/{mid}`）。
- `pages/home/*`：首页蓝卡「今日到期复习 N 题」（source=home_card），到期 0 题时显示灰白「今日复习已清零 ✓」空态卡（dueLoaded 后才显示，不再隐藏）。
- `pages/book/*`：错题本页「今日待复习 N 道」卡（source=book_card）+ 完整复习流程（A–D 选项作答 / 无法提取字母时自我判定、判定结果、讲解、下次复习天数、答错本轮重排一次）。首页/完成页跳入时通过 `autoStartReview` 存储位自动开始复习。
- `pages/practice/*`：练习完成页「今日还有 N 题到期待复习」引导条（source=practice_done），跳转错题本自动进入复习。
- 校验：`npm run typecheck`（tsc）与 `npm run lint`（eslint）均通过。

### Flutter（app-flutter）
- `home_page.dart`：`_loadDueReview()` 拉取 `/api/review` total；蓝色渐变到期卡（source=home_card → `/practice?mode=review`，返回后刷新），0 题显示「今日复习已清零 ✓」空态卡。
- `practice_page.dart`：正常练习 `_finish()` 后异步拉取到期数，>0 显示完成页引导（source=practice_done → `pushReplacement('/practice?mode=review')`）。
- `book_page.dart`：既有到期复习卡点击前补 `review_entry_click`（source=book_card）埋点。
- 校验：`flutter analyze` → No issues found。

### H5（frontend-uni）
- `pages/home/home.vue`：新增 `planFetched` 状态；到期 0 题时首页蓝卡位置显示灰白「今日复习已清零 ✓」空态卡（donebar，绿色 check 图标），不再隐藏。
- 构建：`npm run build:h5` 成功。

## 2. P2 清理

### questions.updated_at
- `backend/app/db.py`：启动迁移 `ALTER TABLE questions ADD COLUMN updated_at REAL`（历史行保持 NULL，不回填）。
- 新写入/更新路径统一维护时间戳：`_seed_questions`、`import_questions`、`admin_update_question`、`set_question_hs_explanation`、去重下架、批量裁定、hs/xp 讲解导入等。

### sitemap lastmod
- `backend/app/seo.py`：新增 `_lastmod()`/`_urlset()`，题目分片查询 `id, updated_at`，**仅当 updated_at 非空才输出 `<lastmod>`**（UTC 日期）；导航页不输出。
- 线上验证：历史题 URL 无 lastmod；通过真实更新路径写一条后对应 URL 出现 `<lastmod>2026-08-09</lastmod>`（分片7 /tiku/q/273028）。

## 3. 部署与回归

- 部署前备份：`VACUUM INTO /data/bak_r33_pre.db`。
- rsync backend + H5 构建产物 → `docker compose up -d --build` 重建 deploy-kaogong-1。
- 回归：/api/stats、/indexnow-key.txt、/robots.txt、/sitemap.xml 均 200；13 个题目分片合计 112,971 URL（与 active 一致）；历史行 updated_at 全 NULL（with_updated_at=0，验证写入前）；/api/review、/api/track 200。

## 4. 浏览器 QA（生产实测，录屏）

全新匿名用户实测，P0/P1/P2 = 0：
- 到期 0 题：首页显示灰白清零空态卡，375px 与桌面均无破版/横向溢出。
- 制造 1 条错题 → 首页蓝卡「今日到期复习 1 题」出现、tab 角标=1 → 点击（track 200，home_card）自动进入复习 → 答对（下次复习 1 天后）→ 清零后回首页恢复空态卡。
- 核心路径快扫（练习→讲解→错题本）正常。
- 注意事项（非本轮代码问题）：老访客可能命中缓存旧 bundle，强刷后正常；HTML/bundle 缓存 TTL 会短暂延迟老用户看到新空态卡。

测试数据（uid umslv2vsh5577e8u1：mistake 540、answer_log、review_log、review_entry_click 埋点）已 `VACUUM INTO /data/bak_r33_qa.db` 备份后守卫清理；回归用 devtest_r33 埋点亦已清理。

## 5. 遗留

- 无新增 P2。历史行 lastmod 将随后续真实内容更新逐步补齐（不编造时间戳）。
