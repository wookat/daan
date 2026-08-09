---
name: testing-kaogong-assistant
description: How to run and test the 考公错题助手 (FastAPI + uni-app H5 frontend + 花生十三 knowledge base)
---

# Testing 考公错题助手

## 本地 H5 测试环境（PR #32 起）
- 本地后端：`cd backend && ADMIN_TOKEN=devtoken IMPORT_TOKEN=devtoken LLM_API_KEY=x LLM_BASE_URL=http://localhost:1/v1 APP_CORS_ORIGINS="http://localhost:5173" uvicorn app.main:app --port 8300`；SQLite 在 **仓库根** `data.db`（不是 backend/data.db）。
- H5：`cd frontend-uni && npm run dev:h5`（:5173）；要打到本地后端需建 `frontend-uni/.env.local` 写 `VITE_API_BASE=http://localhost:8300`（勿提交）。
- 浅色主题录屏：设 `localStorage.themeMode='light'` 不够——OS 深色时 Chrome 的 prefers-color-scheme 仍为 dark。用 CDP `Emulation.setEmulatedMedia`（prefers-color-scheme: light）并**保持 websocket 常连**（断开即失效）；连 ws://localhost:29229 需 `suppress_origin=True` 否则 403。
- 已知桌面端浅色瑕疵：`App.vue` 的 `.theme-dark page { background:#15161c }` 被 uni H5 编译成裸 `body{background:#15161c}`，浅色模式下宽屏内容以下区域呈深色（若未修可在报告中注明，非测试环境问题）。
- 时政「时效」标签（admin #/content）：即将过期=到期前 ≤90 天、已过期=date+12 月已过；种子数据全为时效内，可临时 INSERT 旧日期行验证后删除。admin 令牌存 localStorage `admToken`。

## 生产站 /admin 与模考（P5）
- 线上 https://kaogong.zalize.com/admin 管理令牌 = 容器 `IMPORT_TOKEN`；纠错处理的「已修复/驳回」用原生 JS `prompt` 弹窗填备注。
- 纠错去重键为 `uid+question_id`：同一 uid 重复提交同一题会更新同一条记录（内容取最新）。
- 全真模考「中途退出恢复进度」依赖本机 localStorage + 服务端未完成 attempt：测试恢复必须用同一浏览器重进同一套卷。

## 社区功能（PR #21：讨论区 / 收藏夹+笔记 / 打卡海报）
- 账号登录：`POST /api/auth/register` body `{"phone","password","nickname"}` 可先建号（如 13900000002/pass123），UI 在 `#/pkgA/user/login` 登录，token 存 localStorage `authToken`。
- 已知坑：讨论区 `discuss.vue` 的 `logged` computed 依赖非响应式 `getToken()`——从登录页返回后登录态不刷新，必须 F5 后才能发帖。
- CJK 无法用 computer `type` 直接输入（会丢字）：用 `printf '中文' | DISPLAY=:0 xclip -selection clipboard` 再 ctrl+v 粘贴到输入框/uni modal。
- 讨论区频控 3 条/60 秒（第 4 条 toast「操作过于频繁」）；违规词表在 `backend/app/social.py` `_BANNED_WORDS`（如「加微信」）。
- 打卡海报入口：统计→学习日历页底部按钮恒可用；刷题首页横幅链接需 todayCount ≥ dailyGoal，dailyGoal 存 localStorage `dailyGoal`（UI 最小档 20，可注入小值触发）。保存图片会下载 `~/Downloads/kaogong-checkin-YYYY-MM-DD.png`。
- 收藏夹页 `#/pkgA/social/favorites`：点收藏项展开出现「移动到…/讨论区/取消收藏」操作行；新建夹用 uni editable modal（粘贴填名）。

## P6：学习计划 / 考点树 / 时政
- 时政每日一练完成态存本机 localStorage `szDaily`，同日重测需先清该 key。
- 后台「考点树」在生产 tag3 全空时列表恒「暂无题目」；验证编辑闭环可先 API 打标一题（`PATCH /api/admin/questions/{id}` body `{"tag3":code}`，header `x-admin-token`）再经 UI 清空还原。
- 服务器 DB 精确核对：容器 `deploy-kaogong-1` 内 `/data/data.db`（`answer_log.created_at` 为 epoch 秒非日期串）。

## tag3 三级考点
- tag3 覆盖率核对须过滤 disabled（已下架题 tag3 恒空属预期）。
- 抽审队列 API `/api/admin/tag3_review`（x-admin-token=容器 IMPORT_TOKEN）；容器内无 curl，用 python urllib。
- 错题本三级子行仅对有 question_id 的错题显示（tag3_name 由 /api/mistakes join questions 注入）。

## P7 多端分包路由
- P7 起 exam 三页/shenlun/login 在 pkgA 分包，H5 路由为 `#/pkgA/exam/list|exam|report`、`#/pkgA/shenlun/shenlun`、`#/pkgA/user/login`；旧 `#/pages/...` 路径由 App.vue onLaunch 重定向到 pkgA。
- H5 的 API base 为空串同源相对路径（api.js `BASE_URL`），非 H5 端为 `https://kaogong.zalize.com`。

## R21 裂变链路（share-q 组队引导 / 周排行 / 周战报）
- 匿名 uid 存 localStorage `anonUid`：设置新值 + F5 即可切换身份（测「击败 X%」需新 uid 作答）。
- 后端 :8300 直接服务已构建的 H5（`frontend-uni/dist/build/h5`），无需起 vite dev server。
- 小队周排行与 `q_stats`（击败 X%）均派生自 `answer_log`：可直接向仓库根 `data.db` 用 python sqlite3 种入 answer_log 行造数据。
- 验证复制类功能（周战报/分享文案）用 `xclip -selection clipboard -o` 读剪贴板。

## 题目纠错 (question reports, PR #2)
- Admin console requires `ADMIN_TOKEN` env var on uvicorn (e.g. `ADMIN_TOKEN=testtok`); login at `/admin` with that token. 纠错处理 tab badge = count of open `question_reports`.
- H5 entry points: practice answer view link「题目有问题？纠错」below the explanation card (must answer first; scroll down), and 错题本 expanded item footer「纠错」/ ··· sheet「题目纠错」. Sheet requires picking a type chip before 提交纠错 enables.
- Dedupe: `POST /api/question_report` with same uid+question_id updates the existing row and returns `{"updated":true}`. The H5 anon uid is `localStorage` — easiest to read it from a row already inserted in `question_reports`.
- Admin 标记已修复/驳回/重新打开 all pop a JS `prompt` for a note; paste CJK via xclip + ctrl+v into the prompt.
- If the managed Chrome crashes (wrapper `~/.local/bin/google-chrome` fails with "connect to localhost:29229 refused"), relaunch the real binary: `DISPLAY=:0 setsid /opt/.devin/chrome/chrome/linux-*/chrome-linux64/chrome --remote-debugging-port=29229 --no-first-run --user-data-dir=~/.config/devin-chrome &`.

## Run the app
```
cd /home/ubuntu/repos/kaogong-assistant/backend
LLM_BASE_URL=$LLM_RELAY_BASE_URL LLM_API_KEY=$LLM_RELAY_API_KEY LLM_MODEL=gpt-5.6-terra \
  uvicorn app.main:app --host 0.0.0.0 --port 8000
```
**IMPORTANT (recurring failure): bind `LLM_RELAY_BASE_URL`/`LLM_RELAY_API_KEY` via the exec tool's `env` parameter. Writing `secret:personal:...` literally into the command string passes it through unresolved and every explain request returns 502. Verify after start: `tr '\0' '\n' < /proc/$(pgrep -f 'uvicorn app.main')/environ | grep -c '=secret:'` must be 0.**

Before testing backend changes, verify the running process is newer than the edited files: compare `ps -o lstart= -p $(pgrep -f 'uvicorn app.main')` with the file mtimes — if the process is older, restart it (with secrets bound via exec env params) or you will test stale code.

H5 explain now uses `POST /api/explain/stream` (SSE: `event: meta`, then `data: {"d": delta}`, `event: done`). To verify streaming visually, take two screenshots a few seconds apart and confirm content grows. For image-question tests, generate a Chinese question image with PIL + wqy-zenhei font.

Practice mode: `GET /api/questions?module=&limit=&submodule=` (URL-encode Chinese submodule values) returns random questions + per-module counts; `GET /api/submodules?module=xxx` lists second-level question types with counts. Clicking a module card opens a bottom sheet to pick a submodule (direct start when <2 submodules; 混合刷题 / smart-weak entry / stats deep-link start directly with no sheet); pre-fetch answers via API to deliberately answer right/wrong in the UI. Seed bank lives at `knowledge/questions_bank.jsonl` (imported on startup, deduped by question text UNIQUE).

Frontend served at http://localhost:8000 — uni-app H5 build (`frontend-uni/dist/build/h5`) if present, else legacy `frontend/index.html`. Rebuild after frontend changes: `cd frontend-uni && npm run build:h5`. SQLite DB at repo root `data.db`.

## Devin Secrets Needed
- `LLM_RELAY_BASE_URL`, `LLM_RELAY_API_KEY` (OpenAI-compatible relay)

## API testing
- Access codes were cancelled 2026-07 but RESTORED in prod later (deploy/.env ACCESS_CODE set): `GET /api/access_info` returns `{"required":true}` and AI 功能（问答/申论/面试）提交前会弹访问码框。访问码值向 lead/用户索取，只在浏览器运行时输入，勿写入任何提交/报告/计划文件。若 AI 返回 503「AI 服务暂时不可用」，先怀疑中转站渠道/模型下线（曾发生 gpt-5.6-terra 下线，切 grok-4.5 恢复），报 lead 而非自行改配置。
- `POST /api/explain` is multipart form: fields `text`, `user_answer`, optional file `image` (≤8MB). Responses take 20–90s — always run curl in background and wait.
- Verify cited method names really exist: `grep -r '方法名' knowledge/references/`.
- 错题本 CRUD: `POST/GET /api/mistakes`, `DELETE /api/mistakes/{id}`, stats at `GET /api/stats`.
- 错题字段更新: `PATCH /api/mistakes/{id}` body may set `error_reason` (错因标签) and/or `mastered` (0/1, 已斩). Mastered items are excluded from `/api/review`.
- 复习模式: `GET /api/review` (due items), `POST /api/review/{id}` body `{"correct": bool}` — two consecutive correct reviews return `mastered: true` and auto-remove the item from the review queue. When verifying auto-mastery, call the API against a mistake id you created this run instead of walking the live review UI (which would touch the user's due items).
- Frontend localStorage keys: `fontLv` (答题字号档 0/1/2) and `dailyGoal` (10/20/50) persist across sessions; cycle them back to defaults after UI tests if changed.
- To create due review test data, `POST /api/mistakes` (no access code needed) with a `correct_answer` letter field — new mistakes are immediately due. To reset due times, edit `next_review` in `data.db` via python3's sqlite3 module (no sqlite3 CLI on this box).

## 试卷导出 / 手动录入答案（R119）
- 导出 PDF 响应带 `X-Paper-Code` 头；前端把卷码写入 `localStorage.recentPapers`，测试时可直接读取。参考答案可用 pymupdf 从导出 PDF 的答案页提取用于比对。
- 手动判分（`POST /api/paper_answers`）与扫描答题卡共用 `_judge_paper`：写 answer_log、错题按 question_text 去重合并进错题本。
- 手动录入弹层内题目列表是内部 scroll-view，「交卷判分」按钮初始可能在视口外，需先滚动弹层内部再点击。

## Browser UI testing gotchas
- `computer type` drops CJK characters (xdotool). To enter Chinese text, install xclip (`sudo apt-get install -y xclip`), pipe text via `xclip -selection clipboard`, then ctrl+v into the field.
- The three tabs are a bottom fixed tabbar: 拍题讲解 / 错题本 / 薄弱分析. Save button 存入错题本 appears at the bottom of the explanation card; success is a native alert.
- Mobile check: shrink window with `wmctrl -r :ACTIVE: -e 0,50,30,400,720`.
- Desktop layout breakpoint is 768px (App.vue): at ≥768px the bottom tabbar becomes a 208px left sidebar and fixed banners/masks shift right by 208px. To verify, resize Chrome to ≥1200px wide and hard-refresh.
- localStorage `pstats` is stored wrapped as `{"type":"object","data":{...}}` — JSON.parse the raw value and read `.data`; preserve the wrapper when writing back.
- After a correct answer the practice page auto-advances in ~1.2s; screenshot the green-answer state immediately after clicking, without waits.
- Sound effects (H5 WebAudio): toggle stored as `sfxOff` ('1'=off, ''=on). To verify sound fires, hook `window.AudioContext` constructor via console/CDP BEFORE starting a practice group (`practice.vue` caches `_actx`), then count constructions after a graded answer.
- To test empty states, back up `localStorage.getItem('pstats')` fully before clearing and write it back afterwards (keep the `{"type":"object","data":{...}}` wrapper).

## Production testing
- Live site: https://kaogong.zalize.com（AI 功能需访问码，见 API testing 节）. LLM model: grok-4.5 (LLM_MODEL/LLM_TEXT_MODEL, since 2026-08), fallback deepseek-chat; base URL 不带 /v1（后端自动追加）。
- When testing against production, record the pre-test `/api/mistakes` id list first and only delete records created during the test.
- NEVER delete pre-existing mistake ids even if they don't match an older baseline — the owner uses the live app on his phone, so unknown recent ids are likely REAL user data. Only delete ids you created yourself this run; escalate discrepancies instead of cleaning them.
- Practice mode auto-saves wrong answers to the mistake book (no manual button) — every deliberate wrong answer creates a production record; record the id baseline before testing.
- The online review queue includes all due production items and cannot skip them; when testing requeue, answer production items correctly (minimal impact) and note it in the report.
- Verify deployment freshness by comparing the `assets/index-*.js` hash in the live index.html against local `frontend-uni/dist/build/h5/index.html`.

## DB backup for destructive tests
- SQLite DB is at repo root `data.db` (not backend/). Before destructive tests: `cp data.db /tmp/backup.db`; restore single rows via python sqlite3.

## Dark mode testing
- Use DevTools undocked window + Ctrl+Shift+P "Emulate CSS prefers-color-scheme: dark". Emulation is lost when DevTools closes.

## R22 增长功能（徽章/PK 战绩分享）生产测试
- 徽章连击造数据：SSH 进服务器 `sudo docker exec deploy-kaogong-1 python3` 往 `/data/data.db` 的 answer_log INSERT 3 行（created_at=今天/昨天/前天 epoch 秒，source='qa23类前缀'，question_id 取任一存在题如 1046924）。徽章 API `/api/checkin/badges?uid=...` 由 answer_log 推导连击。
- 「🏅 解锁新徽章」弹窗由**本地 pstats.days**（非服务端）计算 streak 触发：仅设 anonUid 不够，需把 localStorage `pstats`（wrapped 格式）的 `days` 写成连续 3 天各≥1，并清 `badgeSeenMax`，再在练习页答 1 题。
- 我的页顶部「连续打卡」用本地 pstats，徽章墙「当前连续/历史最长」用服务端 answer_log——同页两处可能不一致，属已知设计（换 uid 未同步本地数据时明显）。
- PK 无真正"自动开局机器人"：`random_match` 无等待局时只是新建 waiting 局。要打完一整局，用第二个 anonUid（改 localStorage 后刷新）join 同一 code 并作答，双方都提交后 status=finished。
- PK 昵称默认存本地（同浏览器两个 uid 会显示相同昵称如 考友5CD9），非 bug。
- 战绩落地页 `#/pkgA/share/pk-result?rid=CODE`；边界 rid（不存在/waiting）应显示「战绩不存在或对局未结束」，API `/api/pk/result/{code}` 返回 404。
- 落库核对表 growth_events：pk_result_open/pk_result_copy（source=pk_share）、badge_unlock（source=badge, ref=天数）。注意 pk_result_open 对任意 rid（含无效）都会记一条。
- share-q 页出现「一键加入小队」CTA 的条件：分享者本人在某小队（后端 `_sharer_invite`）；找 `shared_questions` 表里 from_uid 为小队成员的 sid 来测。
- 深色模式生产站可直接用 我的→外观模式 循环切换（跟随系统→浅色→深色），比 DevTools emulation 稳，测完记得切回跟随系统。

## SEO 页（/tiku/*）测试
- `/tiku/q/{id}` 详情页有 `lru_cache`：改 DB 后必须重启 uvicorn/容器才会反映新数据。
- 本地起后端可能需先 `pip install reportlab`（pdf_export 依赖）。
- sitemap/试卷页 HTML 为单行：统计 URL 数用 `grep -o '<loc>' | wc -l`，不能用 `grep -c`。
