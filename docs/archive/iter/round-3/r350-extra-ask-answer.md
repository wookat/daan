# R350：加练同类题「AI 详解本题」带上本次作答

## 取证（verified）

- `book.vue` 复习流 `askFromReview()`（R326/R327 引入）：
  ```js
  const ans = askAnswerLetter(this.cur.user_answer);
  if (ans) uni.setStorageSync('redoAnswer', ans);
  else uni.removeStorageSync('redoAnswer');
  ```
- 普通复习条目来自 `/api/mistakes`，`user_answer` 是当年答错的选项，R327 语义成立。
- `_extra` 加练条目由 `similarItemFromQuestion()` 构造，**没有 `user_answer` 字段**——
  用户刚在本轮对该题作答（`this.picked`），点「AI 详解本题」时该作答被丢弃，
  `redoAnswer` 被显式清除，AI 讲解拿不到「我选了什么」这一最有价值的上下文。
- 对照：练习历史逐题 AI 入口（R335）同场景「有真实作答」时透传 picked，语义已有先例。

## 方案（纯前端，零后端/零契约/零新埋点）

`review-similar.js` 新增 fail-closed 纯函数：

```js
reviewAskAnswer(cur, picked)
// _extra 条目 → askAnswerLetter(picked)（本轮作答）
// 普通条目   → askAnswerLetter(cur.user_answer)（历史作答）
// 非对象/无效值一律 ''（askAnswerLetter 单选语义：多选/非法 fail-closed）
```

`askFromReview()` 改为 `const ans = reviewAskAnswer(this.cur, this.picked);`，
写/清 `redoAnswer` 逻辑不变。普通条目行为零变化。

## 不做

- 不改 askPrefill/redoQid 协议；不改 ask 页消费端；
- 多选作答不强行拼接（askAnswerLetter 单选语义保持，多选 fail-closed 清除）。

## 验证

- vitest：_extra+picked、普通+user_answer、_extra 无 picked、多选/非法/非对象 fail-closed；
- 本地 lint/vitest/build 全绿 + 后端基线 ruff/pytest/pyright；
- 生产 testing agent：加练题答错→AI 详解入口→ask 页预填含本次作答 chip；
  普通条目回归（user_answer chip）；不触发真实 /api/explain。
