# R112：后端回归测试种子套件（公开契约优先）

## 取证（verified facts）

- 仓库自建立以来 `python -m pytest -q` 恒为 `no tests ran`：`backend/` 下 0 个测试文件（仅残留 `.pytest_cache`），13,383 行后端代码零自动化回归。
- 历轮多起回归/缺陷只能靠生产才发现：R102 推送深链落地失效（上线前无契约测试）、R81 抽题池惊群、R39 全站 403 卡死等。
- 后端可测性良好：`db.DB_PATH = os.environ.get("DB_PATH", …)` 支持环境变量注入临时库；`app/main.py` import 时依次跑全部 `init_*_db()` 建全 schema，TestClient 即可拉起完整应用。
- 老板长期指令明确点名「代码架构治理与测试补强」为不依赖真实流量的候选方向。

## hypotheses / unknown

- 假设：以「公开只读契约 + 埋点白名单 + 数据语义」为切入的小型种子套件，未来每轮迭代自然增量扩展（新端点带测试），比一次性全量补测更可持续。
- unknown：CI 是否启用不在本轮范围（GitHub Actions 保持禁用，本地 `python -m pytest` 即验收）。

## 方案

新增 `backend/tests/`（pytest，零新依赖——fastapi 自带 TestClient）：

- `conftest.py`：import 应用前把 `DB_PATH` 指到临时 SQLite；提供 `client` fixture 与 `seed_*` 帮助函数（questions/pk_matches/shared_questions 直插）。
- `test_health.py`：/api/health ok/rev 契约（R92 部署校验依赖）。
- `test_seo_landing.py`：/s/{sid} 与 /p/{rid}（R111）——有效 200+OG 动态字段+noindex；无效/未结束/注入串 302 首页；不泄露答案/解析。
- `test_track.py`：/api/track 白名单外 400；白名单内落库；slow_load 服务端追加 `;ua:`/`;hs:`（R75/R82 语义）。
- `test_pk_public.py`：/api/pk/result/{code} 仅 finished 可见、仅昵称/比分等展示字段（不含 answers/uid）；waiting 404。
- `test_daily_set.py`：/api/daily_set 确定性选题（同日两次一致、每模块 2 题）；`?date=` 仅近 7 天，无效/未来回退今天（R78 语义）；submit 幂等不覆盖 + streak（R76/R74 语义）。

## 边界（本轮不做）

- 不启用 GitHub Actions；不测需要 LLM key/外网的端点；不补前端测试；不动生产。

## 验证

- `cd backend && python -m pytest -q` 全绿；`ruff check backend/tests` 全过；不影响生产部署（tests 不进镜像路径亦无妨，纯增量文件）。
