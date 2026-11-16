# R269 设计：搜索行测题详情「复制本题链接」出向分享（指向 /tiku/q/{id}/ 公开页）

## 取证（生产 + 源码一手证据）

- R243/R247 已为申论真题详情、申论素材卡建立「复制链接」出向分享；行测侧每题已有公开 SSR 页 /tiku/q/{id}/（canonical + og 卡 + App CTA 回流，R97/R116），是现成的最佳分享落地页。
- 源码实查 `search.vue`：行测题详情展开块（code_hit 直达 + 题目列表两处 `q-detail`）只有选项/答案/解析，无任何出向分享出口——用户搜到题、看完解析想发给考友，只能手动摘抄。
- 错题本已有 shareToMates（/s/ 短链带私域文案），但那是错题语境；搜索语境下直接给公开题目页链接更轻、零后端依赖。

## 方案

- `search.vue` 两处 `q-detail` 块尾部追加 `<text class="d-copy" role="button" aria-label="复制本题链接" @click="copyQLink(detail.id)">复制本题链接</text>`（对齐申论 d-copy 样式/aria 先例）。
- `copyQLink(id)`：`location.origin + '/tiku/q/' + id + '/'` 写剪贴板 + toast。纯前端，零后端/SSR/SEO 变化。
- 纯函数 `buildTikuQUrl(id)` 入 `shenlun-url.js` 旁新建？——否：该文件是申论专属；放 `search-url.js`（已存在搜索 URL 纯函数模块）并补 vitest。

## 不做

- 不改错题本 shareToMates（语境不同）。
- 不为申论搜索命中加复制（点击即深链直达，已闭环）。
