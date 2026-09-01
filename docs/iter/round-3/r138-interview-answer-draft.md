# R138（2026-08-29）：面试作答草稿自动保存

## 取证

- 源码核查 `pkgA/interview/interview.vue`：作答 textarea（maxlength 5000，提交门槛 ≥20 字、建议 200 字以上）为纯内存 `answer` 字段，无任何持久化；`draw()` 换题直接 `this.answer = ''`。
- 对照 `pkgA/shenlun/shenlun.vue`：申论作答已有 `slDraft:<qid>` 逐题草稿（`@input saveDraft`、打开恢复、批改成功清除、「已自动保存 · N 字」外显）。
- 影响路径（verified，均为长文全丢）：
  1. H5 刷新 / 移动端浏览器回收标签页；
  2. 误触返回 / 深链跳走；
  3. 「换一题」后想回到原题（draw 不会回到同题草稿，因为无草稿）。
- 提交失败路径已健壮：catch 保留内存 answer 并恢复计时，不在本轮范围。

## 方案（对称 shenlun 既有模式，零后端）

与申论「按题号打开」不同，面试是随机抽题：刷新后重抽大概率不是原题，逐题草稿键无法自然恢复。故改为「最近一份未提交作答」整体快照：

- 单键 `ivDraft`，值 `{ q: question, cat: pickedCategory, answer }`；textarea `@input saveDraft`：answer 非空 set、清空则 remove。
- `onLoad`（无 session_id 时）：存在草稿且 answer 非空 → 直接恢复 question/分类/作答进入作答步，toast「已恢复上次未提交的作答」；否则走原分类列表。
- `draw()` 换题：仅重置内存 answer，不动已存草稿（新题输入前，旧作答仍可通过刷新找回；新题一旦输入，快照自然被覆盖）。
- `submit()` 成功进入报告后 `removeStorageSync('ivDraft')`；失败不清除。
- 作答区计数行补「已自动保存」外显（对称 shenlun `d-save`），用户可感知。

## 验证

- 本地：eslint / vitest / build:h5 全绿。
- 生产 1440/375：输入→刷新重进→原题+作答整体恢复、提交成功后草稿清除不再恢复、console 0 error、溢出 0。
