# R159：搜索「加载更多」连点防重——同 offset 重复请求与重复结果收口

## 取证（事实）

- 生产实测（1440，CDP 将分页响应延迟 2s 模拟真实网络）：搜「增长率」切题目 tab，
  连点「加载更多」两次 → 发出两个 `offset=20` 请求 → 列表 20→60 条，其中 20 条 code 重复；
- `search.vue` `loadMore()` 无 in-flight 防重、无加载反馈：请求期间按钮仍显示「加载更多」可继续点；
- R158 的引用比对只防「换词后旧分页串写」，不防同词同 offset 并发重复；
- 粉笔/夸克列表分页均为加载中置灰/文案变化且不重复追加。

## 方案（零后端、零依赖）

- 新增 `moreLoading` 状态：`loadMore()` 入口 `if (this.moreLoading) return;`，请求期间置 true，
  结束（成功/失败，且仍为当前结果）置 false；
- 「加载更多」按钮加载期间显示「加载中…」并跳过点击；
- 追加前按已有 id 去重兜底：`const seen = new Set(r.questions.items.map((x) => x.id))`，
  只 push 未出现的 item（防极端窗口下的重复）。

## 验收

- 本地 ESLint / vitest / build 全绿；
- 生产 1440/375：延迟分页响应下连点「加载更多」两次 → 仅 1 个 offset 请求、
  文案变「加载中…」、加载完成无重复 code；溢出 0、console 无非预期 error。
