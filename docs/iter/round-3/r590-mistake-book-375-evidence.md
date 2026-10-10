# R590 错题本 375px 生产链路取证

## 结论

R590 研究完成：本轮没有足够的一手证据证明普通用户可感知缺陷，**不修改产品源码、不实施 R580-1、不创建 R590 产品功能 PR**。实修、本地门、部署、生产复验均记为 N/A；仅回填研究证据、handoff、状态、SOP-04 与 testing SKILL。

生产后端 health 全程为 `ec8206e5`。走查固定 375px H5 视口，导航前 stub `/api/track`；所有业务请求和错误均单列记录，并区分 harness 流量与自然流量。

## 研究证据

### Case A：FAB「错题重练」

- 列表初始 `scrollY=0`、`scrollHeight=2945`、8 张卡片；手动滚动后 `scrollY=995`，目标卡片约在 top 60。
- 打开 FAB 与进入练习前后，原列表滚动位置没有被 FAB 改变。
- 练习页标题为「错题重练」，路由为 `#/pages/practice/practice`，进入时 `scrollY=0`。
- 返回错题本时 `scrollY=0`，卡片折叠；相关 API 全部正常。
- `bad=[]`、`failed=[]`、console/page error 均为空。

判断：练习页从页首进入、返回页首和卡片折叠均符合现有设计，未证明缺陷。

### Case B：更多操作层 → 关闭 → FAB 重练

- 展开目标卡后保持 `scrollY=995`；打开、关闭更多操作层均未改变滚动位置。
- sheet 打开时 history length 从 2 增至 3，并出现 sheet marker；关闭后卡片仍展开。
- FAB 重练进入练习页时 `scrollY=0`；返回错题本时 `scrollY=0`，卡片重新折叠。
- API、request、console、page error 均正常。

判断：sheet history 与滚动行为符合现有实现，未证明用户可感知缺陷。

### Case C：练同考点 5 道新题

- 展开卡片、打开 sheet 均保留手动滚动位置；选择「练同考点 5 道新题」后观察到真实请求：
  `/api/questions?mode=reinforce&limit=5&uid=test-r590-walk&module=shuliang&submodule=…`
- 练习页标题为「数量关系 · 强化练习」，进入时 `scrollY=0`。
- 返回错题本时 `scrollY=1395`，但目标卡片 top 约 59，仍在原卡片上下文且可用；卡片折叠。
- API 全部为 2xx，request failure、console、page error 均为空。

判断：`scrollY=1395` 是返回后保留原卡片上下文的合理结果，不是空白区、页首错位或不可用位置；不立项。

### Case D：AI 详解 → AI 问答 → 返回错题本

- 目标卡片手动滚动后 `scrollY=973`、卡片 top 约 60；展开后仍保持该位置。
- 点击「AI 详解」进入「AI 问答」，路由为 `#/pages/ask/ask`，进入时 `scrollY=0`。
- `/api/ask/sessions`、`/api/ask/cur`、`/api/attempts`、`/api/notes`、`/api/comments/count` 等相关请求均为 200。
- 从 AI 问答返回错题本后 `scrollY=973`，目标卡片仍在 top 60 左右；卡片折叠。
- `bad=[]`、`failed=[]`、console/page error 均为空。第一次 pointer click 被 AI 页面 CTA 拦截，属于 harness 交互问题；改为 direct DOM click 后重跑成功，未改产品源码。

判断：返回时保留原卡片上下文、重新折叠卡片符合 `onShow()` 重新加载的现有设计；本轮只验证进入问答和返回，未验证 AI 实际回答生成。

## 自然流量与触发条件

- host probe 观察窗口约 167.8 小时、相关 POST 约 6702 条。
- 自然 `/api/practice_result` 仅观察到 HTTP 200；自然非 2xx/status 0 样本为 0。
- 观察到的 400/500/502/503 均归类为 harness 流量，不能作为 R580-1 触发证据。
- 因此 R580-1「服务端幂等键 + pending 重投」继续登记为设计定稿但不实施。

## 清理与保护范围

测试 UID：`test-r590-walk`。

清理前 baseline 与删除数量完全一致：

```text
mistakes 10
practice_results 1
answer_log 18
reinforce_log 1
daily_set_entries 1
practice_progress 1
```

独立 post-clean 验证：

- 目标 UID hits `{}`，目标 UID 列表 `[]`；
- 共享 fixture `test-r562-modal-%` 仍为 42 行；
- shared fixture digest 为 `9fcf8d1102622bad8a6079e4031a115a83d99dd44ee467b63a2cb9e8b724816b`；
- protected-table narrow aggregates 未变化。

## 证据边界

以下范围明确为 **UNTESTED**：miniapp runtime；真实跨设备滚动/状态恢复；其他浏览器；true offline/service-worker；本轮未执行的 filter/deep-link 变体；AI 实际回答生成的完整链路；以及未由本轮生产实测覆盖的其他变体。

脚本和截图保存在本机 `/home/ubuntu/r590/`，包括 `walk590b.py`、`walkb-A.log` 至 `walkb-D.log`、`shots/`、host probe 与清理记录；这些取证辅助文件不进入仓库。

## SOP-04 收口

- **下一步**：继续观察自然 `/api/practice_result` 非 2xx/status 0；首个自然失败再重开 R580-1 设计与实现论证。R584-2、R584-3、R585-1、R578-1 继续按样本驱动，不因本轮 harness 现象主动改。
- **需注意**：本轮没有运行产品本地门、部署或生产功能复验，也没有建立产品功能 PR；原因是没有被一手证据证明的产品缺陷。AI 答案生成、小程序 runtime、跨设备及其他未直接测量变体不能从本轮结果外推。
