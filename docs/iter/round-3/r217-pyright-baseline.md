# R217：pyright 存量清零并固化基线

## 取证（verified）
- R215 用 pyright 甄别出两处真实运行时 500 后，剩余 39 errors 挂候选未治理；无基线则新增缺陷会淹没在存量噪声里（R215 的两处即长期潜伏）。
- 24h 生产窗口无新 verified 产品缺陷（非探针流量仅 1 次重启窗口 502、403 均为直连 origin 爬虫按设计拦截），选代码治理轮。

## 方案（逐项甄别，非机械压制）
39 处逐项分类处理：
- 真实 Optional 收窄缺口（修实义）：mock_event 赛后报告 attempt/paper 缺失原会 TypeError 500，改 404「成绩数据缺失」；_freeze_ranks 后 entry 重取补 `or entry` 兜底；llm.chat 重试循环耗尽路径补显式 RuntimeError（原隐式返回 None 会在上层报难解的 AttributeError）；main.py uid=None 时不再进入 owns_uid；db.py 存量 `taxonomy._alias_idx.get`（直摸私有可空变量）收敛为新增 `taxonomy.alias_index()` 访问器。
- 类型收窄等价改写（零行为变化）：`MODULES.get(x or "")`、`max(scores, key=lambda k: scores[k])`、惰性缓存 `return _x or {}`、`args: list`/`urls: list[tuple[str, float | None]]`/`block: list` 显式注解。
- 可选依赖噪声（定点豁免）：cv2/pypdf 运行时可选导入加 `# pyright: ignore[reportMissingImports]`；pk._grade 的 try/except 已是预期防线，加定点 ignore。
- 新增 pyrightconfig.json（basic、py3.12、include app）固化基线；`npx -y pyright app` 纳入本地门禁清单（0 errors 为基线）。

## 验证
- pyright 39→0；ruff 全绿；pytest 92 全绿（含 mock_event/pk 既有回归集）。
- 生产行为变化仅错误路径（500→404 / 隐式 None→显式异常），部署后回归验证。

## 限制（如实）
- basic 模式非 strict；strict 需大量注解投入，收益边际低，不纳入。
- pyright 经 npx 临时运行，未加为 package.json 依赖（后端目录无 node 工程）。
