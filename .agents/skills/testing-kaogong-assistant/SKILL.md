---
name: testing-kaogong-assistant
description: How to run and test the 考公错题助手 (FastAPI + uni-app H5 frontend + 花生十三 knowledge base)
---

# Testing 考公错题助手

## Run the app
```
cd /home/ubuntu/repos/kaogong-assistant/backend
LLM_BASE_URL=$LLM_RELAY_BASE_URL LLM_API_KEY=$LLM_RELAY_API_KEY LLM_MODEL=gpt-5.5 \
  ACCESS_CODE=kg2026 uvicorn app.main:app --host 0.0.0.0 --port 8000
```
IMPORTANT: bind `LLM_RELAY_BASE_URL`/`LLM_RELAY_API_KEY` via the exec tool's `env` parameter; writing `secret:personal:...` literally into the command string passes it through unresolved and causes 502 errors.

Frontend served at http://localhost:8000 — uni-app H5 build (`frontend-uni/dist/build/h5`) if present, else legacy `frontend/index.html`. Rebuild after frontend changes: `cd frontend-uni && npm run build:h5`. SQLite DB at repo root `data.db`.

## Devin Secrets Needed
- `LLM_RELAY_BASE_URL`, `LLM_RELAY_API_KEY` (OpenAI-compatible relay)

## API testing
- `/api/explain` and `/api/similar` require header `X-Access-Code` (current code: kg2026); missing/wrong code returns 401. The H5 UI prompts for the code via modal on first 401 and stores it in storage key `accessCode`.
- `POST /api/explain` is multipart form: fields `text`, `user_answer`, optional file `image` (≤8MB). Responses take 20–90s — always run curl in background and wait.
- Verify cited method names really exist: `grep -r '方法名' knowledge/references/`.
- 错题本 CRUD: `POST/GET /api/mistakes`, `DELETE /api/mistakes/{id}`, stats at `GET /api/stats`.
- 复习模式: `GET /api/review` (due items), `POST /api/review/{id}` body `{"correct": bool}`. To create due review test data, `POST /api/mistakes` (no access code needed) with a `correct_answer` letter field — new mistakes are immediately due. To reset due times, edit `next_review` in `data.db` via python3's sqlite3 module (no sqlite3 CLI on this box).

## Browser UI testing gotchas
- `computer type` drops CJK characters (xdotool). To enter Chinese text, install xclip (`sudo apt-get install -y xclip`), pipe text via `xclip -selection clipboard`, then ctrl+v into the field.
- The three tabs are a bottom fixed tabbar: 拍题讲解 / 错题本 / 薄弱分析. Save button 存入错题本 appears at the bottom of the explanation card; success is a native alert.
- Mobile check: shrink window with `wmctrl -r :ACTIVE: -e 0,50,30,400,720`.
