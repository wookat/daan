---
name: testing-kaogong-assistant
description: How to run and test the 考公错题助手 (FastAPI + uni-app H5 frontend + 花生十三 knowledge base)
---

# Testing 考公错题助手

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
- Access codes are CANCELLED (ACCESS_CODE empty in prod since 2026-07): no endpoint returns 401 for a missing `X-Access-Code`. The frontend 401-modal code path is legacy fallback only.
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
- Live site: https://kaogong.zalize.com (no access code). LLM model: gpt-5.6-terra for both text and image.
- When testing against production, record the pre-test `/api/mistakes` id list first and only delete records created during the test.
- NEVER delete pre-existing mistake ids even if they don't match an older baseline — the owner uses the live app on his phone, so unknown recent ids are likely REAL user data. Only delete ids you created yourself this run; escalate discrepancies instead of cleaning them.
- Practice mode auto-saves wrong answers to the mistake book (no manual button) — every deliberate wrong answer creates a production record; record the id baseline before testing.
- The online review queue includes all due production items and cannot skip them; when testing requeue, answer production items correctly (minimal impact) and note it in the report.
- Verify deployment freshness by comparing the `assets/index-*.js` hash in the live index.html against local `frontend-uni/dist/build/h5/index.html`.

## DB backup for destructive tests
- SQLite DB is at repo root `data.db` (not backend/). Before destructive tests: `cp data.db /tmp/backup.db`; restore single rows via python sqlite3.

## Dark mode testing
- Use DevTools undocked window + Ctrl+Shift+P "Emulate CSS prefers-color-scheme: dark". Emulation is lost when DevTools closes.
