# R245 设计：搜索页补「申论」筛选 tab

## 取证（verified）
- 生产 `/api/search?q=乡村振兴&type=shenlun` 已返回 `{q, shenlun, shenlun_mats}`（R241/R244 后端已支持 type=shenlun 分支），但搜索页 TABS 只有 全部/题目/考点/试卷——用户无法只看申论结果；申论命中在「全部」tab 侧栏与行测考点/试卷混排。
- 搜索页 `onLoad` 已按 `TABS.some(t.k===options.tab)` 白名单收 tab 深链、`syncUrl()` 已把 tab 写入 URL（R157）；`showSec('shenlun')` 已同时门禁真题/素材两个区块——加 tab 项即全链路生效。
- 本轮 origin 复审计：无新产品缺陷。近窗口 5xx 全部落在今日 R241–R244 各次部署容器重建时刻（container-events.log 逐条对时吻合），边缘按 R218/R226 设计出 miss→retry→品牌 503 链；容器 RestartCount=0、OOM=false。

## 方案
- `search.vue` TABS 追加 `{ k: 'shenlun', n: '申论' }`，其余零改动：
  - 请求走既有 `&type=` 透传；
  - 区块显隐走既有 `showSec('shenlun')`；
  - 空态走既有 `isEmpty`（type=shenlun 响应无 topics/questions 键，回退空数组判断成立）；
  - 深链/URL 同步走既有 TABS 白名单 + buildSearchUrl。

## 不做
- 不改后端；不为申论 tab 做独立布局/分页（素材/真题各 ≤5/10 条，小结果集）；SEO 零变化。

## 验证
- 本地：lint / vitest / build:h5 + 后端门禁不动重跑。
- 生产：搜索页点「申论」tab 仅显真题+素材区块、URL 带 tab=shenlun、刷新深链保持、空关键词/无命中空态正常、1440/375 溢出 0、console 0 error。
