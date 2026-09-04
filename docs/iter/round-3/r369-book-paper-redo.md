# R369 错题本按卷筛选下「错题重练」归卷直达

## 一手生产证据（2026-09-04，kaogong.zalize.com rev 1c1e18b，/data/data.db 只读实查 + 线上代码走读）

- 近 14 天：`mistakes` 新增 129 条 / 37 uid；`review_log` 仅 24 条 / 3 uid；全库 `mistakes` 222 条中 `review_count=0` 202 条、`mastered=1` 0 条——错题「进得多、消得少」，重练/复习是错题本的主漏斗。
- R368 上线后错题本可按卷筛选（`pidFilter`），但页顶「错题重练」卡 `redoAll()` 拼的 `/api/mistakes/redo` 只识别 `module/qtype/rz/src/t3`，**不识别 pid**：用户筛到「2015年新疆省考行测真题」看着 3 条错题点「开始」，实际拉到的是全局最多 10 道待掌握错题，卡片文案也回落成「把待掌握错题按刷题模式重做一遍」——筛选态与重练动作口径不一致，是 R368 遗留缺口。
- 现有直达路径需 3 跳：错题本「练本卷 ›」→ 卷库卷卡（高亮滚动）→ 点卷卡 → action sheet「只练错题」（R367）。
- 竞品：粉笔错题本按来源筛选后「重做」只重做该来源错题；我方缺一跳直达。

## 目标体验

1. 错题本 `pidFilter` 生效时，「错题重练」卡文案切换为「重练本卷错题 · {卷名}」/「按卷面顺序只练本卷上次答错的题（答对过即不再算错）」。
2. 点「开始」不再走 `/api/mistakes/redo`，而是复用 R367 按卷「只练错题」协议：`practiceLaunch={kind:'paper', source, pid, title, untimed:true, wrong:true}` → 刷题页 `startPaper` 直接取 `paperWrongPlan(items)`，跳过 action sheet；沿用纸卷顺序、归卷 `_source/_ptitle`、完成页「本卷练完」+「重练本卷错题」+「回卷库」。
3. 若该卷已无「上次答错」题（错题本里的题后来答对了），fail-open 回落既有按卷流程（续练 / 已练完重练弹窗），不静默空转。
4. 「练本卷 ›」chip 保留（去卷库看整卷/重新练一遍）。

## 口径与边界

- 「本卷错题」= R367 口径（该 uid 该题最近一次 `answer_log.correct=0`），与错题本 `mistakes` 条数可能不一致（已答对的题不再算错），卡片文案不写具体题数、明示口径。
- 零新表/新列/新端点；新增埋点 `book_redo_paper` 进 `/api/track` 白名单。
- 非 pid 筛选态的「错题重练」卡与 `redoAll` 行为零变化；模考/普通练习/计时模考零变化。

## 验证

- 前端 `tests/paper-continue.test.js`：`paperWrongLaunch(items, wantWrong)`——`wantWrong!==true`→null；有 wrong→只含 wrong 且去 done/wrong 标记、保持卷面顺序；无 wrong→null；非数组→null。
- 本地 ruff/pytest/eslint/vitest/build:h5 全绿 → PR（base=main）→ 部署 → 生产 1440/375：按卷筛选态卡片文案切换、点开始直接进只练错题（toast「只练本卷上次答错的题」、题数=卷卡「错 W 题」）、完成页归卷、无错题回落弹窗、非 pid 态卡片零回归、375 无横向溢出、console 0 error。
