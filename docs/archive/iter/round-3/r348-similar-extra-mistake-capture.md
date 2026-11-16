# R348：加练同类题答错入错题本——收口复习流「练了白练」缺口

## 取证（verified，代码级）

- `book.vue appendSimilar()`（答错自动加推 2 道同类新题）构造的 `_extra` 条目**丢弃了 `x.id` 与 `x.question_type`**——只保留 module/question_text/correct_answer/explanation。
- `record()` 首行 `if (this.cur._extra) return;`：加练题答错后**完全丢弃**——不入错题本、不写任何记录。用户在加练题上暴露的薄弱点无任何沉淀，下次复习/重练/错因画像全部看不到；粉笔错题本任何来源答错均收录。
- 因无 `question_id`，加练题即使想挂 AI 回看关联（R336 redoQid）、社交栏（R346 fail-closed 不渲染）也不可能。
- 后端 `/api/mistakes` `save_mistake()` 已有 question_id/question_text 双重去重（重复答错→times+1 复活），无需后端改动。
- `/api/questions` items 为 `SELECT *`：id/module/question_type/submodule/question/options/answer/explanation/hs_explanation 全部就位，纯前端可取。

## 方案（纯前端零后端/零契约）

1. 新增 `src/utils/review-similar.js` 纯函数（fail-closed）：
   - `similarItemFromQuestion(x)`：/api/questions item → `_extra` 复习条目，保留 `question_id`（正整数校验）与 `question_type`；无题干返回 null。
   - `mistakeRecFromExtra(item, userAnswer, uid)`：`_extra` 条目 → POST /api/mistakes 请求体；非 _extra/缺题干/缺正解返回 null。
2. `appendSimilar()` map 改用 `similarItemFromQuestion`，过滤 null 与同题 id。
3. `record()`：`_extra` 且答错 → `saveExtraWrong()` POST /api/mistakes（`_saved` 防重，失败静默非关键路径）；仍不写 SRS、不 requeue（加练语义不变）。
4. 答错的加练题 verdict 下补一行提示「已加入错题本，之后会安排复习」（`_saved` 成功才显示）。
5. 附带收益：`_extra` 有 question_id 后，「AI 详解本题」自动带 redoQid（askFromReview 已按 cur.question_id 写入，无需改）。

## 不做

- 不改后端/契约/表；不写 SRS（加练不占复习记录语义保持）；不给加练题挂社交栏（列表下轮 load 自然出现）；不改埋点。

## 验证

- vitest：两纯函数正反例；本地 lint/build 全绿。
- 生产实测：复习流答错→加练题答错→POST /api/mistakes 200 + 提示出现→退出复习列表出现该题（带 question_id、可挂社交栏/AI 入口）；加练题答对不入本；测试 uid 清理。
