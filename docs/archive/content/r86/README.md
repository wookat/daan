# 轮86：AI 问答降级体验走查 + 统计页数据一致性核对 + 例行观测

分支 `devin/1786330334-r86`。本轮改动：`backend/app/main.py`（AI 端点异常兜底 4 处）+ 本报告。已 `deploy/deploy_h5.sh` 部署上线并复验。

## 1. 三端 AI 功能降级走查（LLM key 缺失场景）

### 1.1 发现的 P1（当轮修复）
后端 `/api/followup`、`/api/coach`、`/api/mistakes/analysis` 调 LLM 无异常兜底，key 缺失时直接向前端返回裸 `Internal Server Error`（500）。修复：与 `/api/explain` 等既有端点同款 `_friendly_ai_err` 兜底，改为 502 + 友好中文 detail：

```python
try:
    answer = await engine.followup(...)
except Exception as e:  # noqa: BLE001
    raise HTTPException(502, _friendly_ai_err(e)) from e
```

同时修正双重前缀问题：H5 catch 已自带场景前缀（「追问失败：」「生成失败：」「出题失败：」），后端 `/api/similar` 原样返回 `生成失败：…` 会拼成「生成失败：生成失败：…」——后端改为仅返回友好正文（`解析失败：`/`批改失败：` 两处端点前端无前缀，维持现状）。

### 1.2 线上复验（部署后）
API 层（curl 实测生产）：
- `/api/followup` → 502 `{"detail":"AI 服务连接失败，请稍后再试"}`
- `/api/coach` → 502 同上
- `/api/similar` → 502 同上（无双前缀）
- `/api/explain/stream`（multipart text）→ `event: error` + `AI 服务连接失败，请稍后再试`
- `/api/interview/answer` 及 `/answer/stream` → 502 detail / SSE error 同款友好文案
- `/api/mistakes/analysis`（空错题本）→ 200 引导文案「先去刷题吧」

H5 UI 层（Playwright 375px 生产实测）：
- AI 问答页粘贴题干提交 →「失败：AI 服务连接失败，请稍后再试」toast，无 JS 异常；
- 统计页 AI 学习教练「生成建议」→「生成失败：AI 服务连接失败，请稍后再试」（修复前为「生成失败：生成失败：…」双前缀）；
- 面试陪练入口/答题 → 友好错误提示，页面不崩。
- console 仅浏览器自动记录的 `Failed to load resource: 502` 网络日志（非 JS 报错、用户不可见），无报错裸奔。

### 1.3 三端结论与「入口不误导」判断
- **H5**：所有 AI 入口 catch 均带场景前缀 toast，降级体验达标。
- **原生小程序**：代码走查确认当前版本**没有任何 AI 功能**（无 explain/followup/coach/similar/interview 调用，仅海报文案含"AI 刷题上岸"字样），无降级链路需要处理。
- **Flutter**：ask/stats/interview 页 catch 全部走 `Api.errMsg`（提取后端 detail），后端修复后自动获得友好文案，零端上改动。
- 入口标注判断：AI 入口文案描述的是功能本身（非虚假宣传），失败时即时给出友好提示；LLM key 缺失是临时运维状态，**不加静态「服务不可用」标注**——避免 key 恢复后文案反向误导。如需常态化可后续加健康探测动态开关（记 P2 备选）。

## 2. 统计页四口径 vs answer_log 抽样验算

方法：生产库种入 QA uid `qa_r86_stat` 共 52 条受控 answer_log（本周 40 条跨五模块受控对错、上周 12 条资料分析 8/12 三天分布），调用生产 API，并用独立脚本按源码口径从原始行重算比对。**验算后 QA 数据已全部清理（answer_log/weekly_reports 0 残留）。**

| 口径 | API 实测 | 独立重算 | 结论 |
|---|---|---|---|
| 预测分 `/api/predict` | 总分 58.7；五模块 6.3/15.9/5.2/19.0/12.2 | 58.7；逐模块一致 | **完全吻合**（贝叶斯平滑+近30天0.5/全量0.3加权+盲猜底线） |
| 掌握度地图 `/api/mastery/map` | 涉及 24 个 tag3 | n/掌握度值逐项重算（平滑正确率×时间衰减 0.6+0.4·decay） | **24/24 吻合** |
| 周报 `/api/report/weekly` | n=12 correct=8 acc=0.667 secs=480 days=3 | 12/8/0.667/480/3 | **完全吻合**（东八区日界） |
| 雷达（五模块能力） | 前端本地 pstats 源 | 注入受控 pstats（70/50/33/89/60%）后页面显示逐项一致，最薄弱排序正确 | **显示口径吻合** |

口径备注（非缺陷，照实记录）：雷达图数据源是**设备本地 pstats**（含离线作答），与服务端 answer_log 系两套自洽口径；预测分/掌握度/周报均为服务端 answer_log 同源。

## 3. 例行观测 + 健康快扫（scripts/health_scan.py 生产容器内运行）

全绿：full 156,792 / active 113,304；`<50`=0、非JSON=0、乱码=0、推广残留=0、hs 一致性=0、台账外空 hs=0、卷内重复=0；低覆盖仅卷 112（58.0%）；近7天 39 答/14 uid。

爬虫（当日）：**bingbot 22 次（此前长期仅 1 次，明显上量）**、YandexBot 129、Googlebot 首次现身 2 次、Baiduspider 1；/tiku/y* 57、/tiku/papers* 10。/s/ 仍无真实用户落地（当日命中均为扫描器/自测 UA）。Bing 收录破零待下轮复查（抓取上量是先行信号）。

growth：share_open 5 / team_join_open 5 / share_answer 3 等与基线持平；heatmap_view 今日新增 10 条经核全部为本轮 QA 匿名走查所产生（8 小时窗口内、uid 无任何作答记录），已清理归 0。

## 4. 检查与限制

- ruff：本轮新增代码与文件既有风格一致（仓库无 ruff 配置，默认规则下的 I001/BLE001 等均为存量风格项）；`py_compile` 通过；H5 构建随 deploy_h5.sh 成功（bundle index-CLBuEQ6f.js 线上一致）；接口回归 7 端点全 200。
- 限制：小程序为代码走查结论（无 AI 功能）、未真机运行；Flutter 为代码走查+后端 detail 链路推导，未构建 APK 实测 UI toast；统计验算为单 uid 受控样本，非全量用户重算。
