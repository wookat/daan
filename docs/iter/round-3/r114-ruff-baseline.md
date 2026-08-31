# R114：后端 Ruff 存量清零 + lint 基线固化

## 取证（verified facts）

- 仓库无任何 ruff 配置文件，`ruff check backend` 长期报 83 errors——历轮只保证「本轮触碰文件」全绿，验收口径不统一（从仓库根 vs backend/ 运行结果都不同：isort first-party 判定漂移，conftest.py 在一处全绿另一处报 I001）。
- 83 条分布：BLE001×27 / EXE001×8 / S110×6 / SIM115×4 / SIM102×4 / F401×4 / RUF100×4 / ISC004×3 / B008×3 / ASYNC230×3 / I001×3 / UP009×3 / DTZ007×2 / 其余单条。

## 方案

1. 新增 `backend/ruff.toml` 作为唯一规则来源：显式 ignore 属于既定风格/惯用法的类别（BLE001/S110/S112 防御式降级、B008 FastAPI File()/Depends() 默认值、SIM102、ASYNC230、EXE001、DTZ007 +8h 显式时区换算），并固定 `known-first-party = ["app"]` 消除运行目录漂移。
2. 其余存量全部真实修复（非 noqa 掩盖）：
   - 机械类：F401 未用 import、UP009 编码声明、I001 排序、RUF100 失效 noqa、FURB167。
   - 语义等价重写：PIE810 startswith tuple、FURB161 `bit_count()`、RUF015 `next(iter(...))`、RUF034 无效 if-else（`"rule" if x else "rule"`→`"rule"`）、SIM103、F841 死代码 opt_text 块删除、SIM115 taxonomy 加载 with 上下文、ISC004 隐式拼接加括号。
3. 验收口径升级：自本轮起 `ruff check backend` 整体全绿是硬门槛（不再是「本轮文件」）。

## 边界

- 不改前端 lint（eslint 已有既定流程）。
- 全部改动语义等价，不触碰任何接口契约；pytest 18 例回归全绿背书。

## 验证

- 仓库根与 backend/ 双目录 `ruff check` 全绿；`pytest tests` 18 passed；关键模块 import + `hamming()` 行为抽查一致。
- 生产部署后 /api/health rev 校验 + 关键路由回归。
