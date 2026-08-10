# 轮96：安全与合规审计线（鉴权/注入/限流 + 依赖漏洞快扫）

分支 devin/1786337495-r95（PR#122）。上轮 r95 报告见 docs/content/r95/README.md。

本轮为纯防御性安全审计：源码逐面审 + 生产受控 QA 探测，发现 **1 个 P0、3 个 P1 当轮修并上线**，依赖高危项全部定位为构建期 devDependencies（运行时零高危）。

## 1. 鉴权面

### 1.1 admin 接口越权尝试（结论：无问题）

`backend/app/main.py:check_admin` 统一比对 `ADMIN_TOKEN`（未配置时 503，不配置即全拒），`social.py`/`insights.py`/`report.py` 内 admin 路由各自调 `_check_admin`。源码扫描全部 `/api/admin*` 路由均经过校验，无遗漏；生产实测（无 token / 空 token / 错 token / 写接口）：

| 探测 | 结果 |
|---|---|
| GET /api/admin/{stats,dashboard,users,governance,comments,reports,questions} 无 token | 全 **401** |
| 错 `X-Admin-Token` / 空 `X-Admin-Token` | 401 / 401 |
| PATCH /api/admin/questions/1 无 token | **401** |

响应体仅「无效管理令牌」，不回显真实令牌、不区分「token 错」与「token 不存在」。

### 1.2 uid 越权访问他人数据（P0，已修）

**问题**：账号态 uid 形如 `u<自增 id>`（`auth.user_uid`），可被直接枚举；此前大量接口只凭 query/body 里的 uid 做隔离，因此 `GET /api/profile?uid=u1`、`/api/stats?uid=u1`、`/api/mistakes?uid=u1`、`/api/notes?uid=u1`、`/api/favs?uid=u1`、`/api/exam/attempts?uid=u1`、`/api/growth/summary?uid=u1` 等**匿名即可读取任意真实账号数据**，`POST /api/profile` 还能覆写他人计划。匿名随机 uid 本身是不可枚举凭据，不受此影响。

**修复**（`auth.py` + `main.py` 全局中间件 `guard_account_uid`）：

```python
_ACCOUNT_UID_RE = re.compile(r"^u\d+$")           # 账号态 uid 判定
def owns_uid(uid, authorization):                  # 匿名随机 uid 放行；账号 uid 需本人 token
    if not is_account_uid(uid): return True
    row = get_user_by_token(authorization)
    return bool(row) and user_uid(row["id"]) == uid
```

中间件同时覆盖 query 与 JSON body 两处 uid（body 读取后用 `_receive` 回灌，不影响下游解析），不匹配统一 403「无权访问该账号数据，请重新登录」。选择中间件而非逐端点改造，是为一次性覆盖 200+ 端点并对未来新增端点默认安全。

生产复验（u1 为真实账号，仅做读取尝试，不写入）：8 个读接口无 token 全 **403**、伪造 Bearer **403**、`POST /api/profile uid=u1` **403**；本地 TestClient 补验「本人 token 读本人 uid 200 / 本人 token 读他人 uid 403 / 匿名 uid 不受影响 200」。

### 1.3 PATCH/DELETE 任意写（P0 同源，已修）

**问题**：`PATCH /api/mistakes/{mid}`、`DELETE /api/mistakes/{mid}` 完全不校验归属，`mid` 自增可枚举 → 任意人可改写/删除任意用户错题（含 `mastered`、`error_reason`）；`POST /api/review/{mid}` 的 SRS 进度更新亦只按 `mid`。

**修复**：`db.update_mistake/delete_mistake/record_review` 统一走既有 `_uid_clause(uid)`（`uid` 为空时只匹配无归属历史记录），改写/删除返回 rowcount，端点在未命中时抛 **404**（而非 403，避免泄漏资源是否存在）；`record_review` 的 owner 预检、streak 读取与最终 UPDATE 三处**全部**带 uid 条件，不依赖单点预检。

三端客户端同步补齐 uid（否则修复后功能回归）：H5 `practice.vue`/`book.vue`、小程序 `api/index.ts` 的 `patchMistake`/`deleteMistake`、Flutter `core/api.dart`。

生产复验（受控 QA uid 自建自删）：

| 探测 | 结果 |
|---|---|
| PATCH 无 uid / 他人 uid | 404 / 404 |
| POST /api/review 他人 uid | 404 |
| DELETE 他人 uid | 404 |
| owner PATCH / review / DELETE | 200 / 200 / 200（功能不回归） |
| owner 重复 DELETE | 404 |

### 1.4 成绩报告/排名枚举（P1，已修）

`GET /api/exam/report/{attempt_id}`、`/api/exam/rank/{attempt_id}` 原先只在**传了 uid 时**校验归属 → 不传 uid 即可按自增 attempt_id 枚举他人成绩。改为强制与 attempt 的 uid 相等，否则 404。三端本就传 uid（H5 `pkgA/exam/report.vue`、小程序 `api/index.ts`、Flutter `core/api.dart`），零回归。生产复验：attempt 1/2/3 无 uid 与错 uid 全 404。

### 1.5 其余资源归属（复核通过，无改动）

`social.py` 评论删除 `WHERE id=? AND user_id=?` + `require_user`；收藏夹改名/删除 `WHERE id=? AND uid=?`；`team.py` 面板经 `_member()` 成员校验、`/share/{sid}/answers` 限创建者或已答者；`interview.py` 会话详情 `WHERE id=? AND uid=?`；`pk.py` 按 `code` 且 side 由内部推导。

## 2. 注入面（SQL 拼接抽查，结论：无注入点）

全量扫出 60 处含 f-string 的 SQL 语句逐条判定，动态片段分三类且均安全：

| 类别 | 例子 | 判定 |
|---|---|---|
| 占位符生成 | `f"id IN ({','.join('?'*len(ids))})"` | 只生成 `?`，值走参数 |
| 内部常量片段 | `random_questions` 的 `src`/`order`/`clause`、`pk.py` 的 `side`（`creator`/`opponent`）、`social.py` 的 `CN_DAY_SQL` | 与用户输入无关 |
| 白名单标识符 | `update_question` 的 `ADMIN_EDITABLE`、`update_mistake` 的 `allowed={"error_reason","mastered"}`、`user_profile` 字段集 | 交集过滤后才拼列名 |

所有用户值（module/submodule/tag3/uid/year/region/keyword/qtype…）无一例外走 `?`。`random_questions` 里唯一拼进 SQL 的数值 `target` 由服务端算术得出（`max(20, min(90, ...))`）。

生产 8 组注入探针（`'--`、`' OR 1=1--`、`UNION SELECT`、`'; DROP TABLE questions;--`、`") OR ("1"="1` 等，覆盖 questions/stats/mistakes/favs/shenlun/history）：全部 200/404，响应体无 `sqlite`/语法错误/traceback 泄漏，探测后 `questions` 表完好（回归 200）。

## 3. 限流面（AI/导出/纠错等写接口刷量，P1，已修）

**问题**：`auth.rate_limit` 此前只用于注册/登录/PK/组队/分享/评论；AI 与导出等高成本接口**完全无限流**，单机可无限刷（LLM key 到位后即为直接成本，OCR/PDF 为 CPU/内存放大面）。

**修复**：`main.py` 新增 `_rl(request, bucket, limit, window, uid=None)`——有 uid 按 uid、否则按来源 IP 分桶（`/api/explain` 为 multipart 无 uid，走 IP）。接入与生产实测：

| 端点 | 配额 | 实测 |
|---|---|---|
| /api/explain、/api/explain/stream | 20 / 5min | 第 21 次起 429（前 20 次为 502 友好降级） |
| /api/similar、/api/followup | 30 / 5min | 生效 |
| /api/coach | 20 / 5min | 生效 |
| /api/export/pdf | 20 / 5min | 第 21 次起 429 |
| /api/scan_sheet（OCR） | 20 / 5min | 生效 |
| /api/mistakes/analysis | 10 / 5min | 第 11 次起 429 |
| /api/shenlun/grade | 10 / 10min | 第 11 次起 429 |
| /api/interview/answer(+/stream) | 20 / 10min | 第 21 次起 429 |
| /api/question_report（纠错） | 30 / 1h | 第 31 次起 429 |

限流置于业务校验之前，故无效请求也计入配额（防「用坏请求探接口」）。**限制照实记**：`_RATE` 是进程内内存字典，单 uvicorn worker 单容器下有效，多副本/容器重启即重置，不是分布式限流；作为成本刹车足够，若后续多副本需换 Redis 计数（列 P2）。

## 4. 依赖漏洞快扫

### 4.1 Python（运行时，pip-audit）

对生产容器 `pip freeze`（24 个包，fastapi 0.141.1 / starlette 1.6.0 / uvicorn 0.52.1 / pypdf 6.15.0 / opencv-python-headless 5.0.0.93 / reportlab 5.0.0 / pillow 12.3.0 等）跑 pip-audit：**No known vulnerabilities found**（0 高危）。

### 4.2 Node（frontend-uni，npm audit）

`npm audit` 66 项（16 high / 17 moderate / 33 low）；`--omit=dev` 后 47 项（13 high）。逐条归因后**运行时高危为 0**：

| 高危包 | 归属 | 是否进生产 |
|---|---|---|
| vite / rollup / @dcloudio/uni-cli-shared / postcss / js-yaml / adm-zip / jimp / jpeg-js / ws / nanoid | 构建工具链（devDependencies 或仅被 uni-cli-shared/uni-automator 依赖） | 否——生产只部署 `dist/build/h5` 静态产物 + Python 后端 |
| @intlify/*（vue-i18n） | 直接 dep 声明存在，但 `src` 无任何 `vue-i18n`/`createI18n`/`$t(` 使用，构建产物中无 intlify 代码 | 否（高危 9.1.9 来自 devDependency uni-cli-shared；运行时 vue-i18n 已是 9.14.5，即两条 intlify 高危的修复版本） |

**不当轮升级**（照实立项）：vite/rollup 版本由 `@dcloudio/vite-plugin-uni` 生态约束，`npm audit fix --force` 会跨 major 升级构建链，风险等级远高于「本地/受控构建环境的构建期 DoS/路径穿越」收益。建议随 uni-app 版本升级（当前提示 5.23.2 可升）在独立分支验证四端构建后再动，并可将未使用的 `vue-i18n` 从 dependencies 移除以缩小面（P2）。

## 5. 验证与部署

- `ruff check backend/app`：70 → 70，**本轮零新增 lint**（基线 70 项历史问题：I001/B008/BLE001/RUF100 等，非本轮引入，未借机夹带修改）。
- 小程序 `tsc --noEmit` 0 错误、`eslint` 0 错误；`flutter analyze` No issues found。
- 本地 TestClient 全量安全用例通过（见 §1.2/1.3）。
- `deploy/deploy_h5.sh`：构建 → rsync → 重建容器 → 预热 9 端点（0.53-1.56s）→ 线上 bundle hash 与本机一致（index-cV21LdW7.js）→ 7 项接口回归全 200。
- 生产安全回归见各节表格，均在部署后执行。

## 6. 例行与数据观测

- health_scan.py 全绿：active 113,304 / full 156,792，`<50`、非 JSON options、乱码、推广残留、hs 一致性、台账外空 hs、卷内重复**全 0**，低覆盖率仅剩卷 112（65/112）；两条 intentional 空 hs 台账题（changshi:655861、panduan:334296）逐字未动。
- 近 7 天：39 次作答 / 14 uid（与前若干轮持平）；growth 事件 `team_join_open 5`、`share_open 4`、`share_answer 3`、`share_copy 1`、`share_team_join 1`、`task_card_click 1`、`team_report_copy 1`——r95 首现的疑似真实分享/组队链路**本轮仍在**。
- 爬虫/SEO（近 7 天归档 + 当日日志）：YandexBot 168、bingbot 2、Baiduspider 2；`/tiku/` 83、`/tiku/t/CS-LS-01/` 38、`/tiku/q/412606` 26、`/tiku/y/2024/changshi/` 26——r50 的考点聚合页与题目详情页均已被抓取。`/s/` 24 次仍无真实用户落地，Bing 收录仍未破零（站长验证仍是 P0 外部依赖）。
- QA 数据清理：本轮 7 个受控 QA uid（`r96qa_*`）在全部含 uid 列的表中清理（备份 `/data/bak_r96_qa.db`，事务提交），清理后 `LIKE 'r96qa%'` 残留 **0**；u1 等真实账号全程只做读取尝试，无任何写入。

## 7. 遗留与建议

| 项 | 级别 | 说明 |
|---|---|---|
| 限流为进程内内存计数 | P2 | 多副本部署前需换 Redis/SQLite 计数 |
| multipart 表单里的 uid 不过中间件 | P2 | 现有 multipart 端点（explain/scan_sheet）不按 uid 取他人数据，暂无越权面；新增 multipart 端点须自行校验 |
| 匿名 uid 仍是「持有即可用」凭据 | P2 | 与 r93 记录的「匿名 uid 迁移」同源，需登录体系起量后统一立项 |
| 未使用的 vue-i18n 依赖 + 构建链高危 | P2 | 见 §4.2，随 uni-app 升级独立分支处理 |
| 429 文案与前端提示 | P3 | 目前统一「操作过于频繁，请稍后再试」，可按端点细化（如导出/批改给出剩余等待） |

**本轮限制**：uid 越权面为端点抽样（8 个读接口 + 3 类写接口）而非 200+ 端点全覆盖，中间件是全局生效因此覆盖面由中间件保证；注入面为源码全量判定 + 8 组探针抽样；未做压测型限流验证（避免影响真实用户）；未涉及传输层/主机层加固（TLS、容器权限、Caddy 头）——建议下轮做「响应头与传输层合规」一轮（CSP/HSTS/X-Content-Type-Options、admin 面板暴露面、备份文件权限）。
