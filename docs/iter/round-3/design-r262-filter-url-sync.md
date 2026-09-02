# R262 设计：申论题型/年份/地区筛选 URL 同步（补全 R261 挂候选项）

## 取证（verified）

- R251/R252 已打通 `?qtype/?year/?region` 入向深链（onLoad 白名单应用），R261 打通 paper 维度的出向 URL 同步；但 App 内 `setQtype/setYear/setRegion` 变更后 URL 不更新——用户在 App 内筛出「归纳概括 + 2023 + 江苏」后复制地址栏，得到的仍是进入时的旧链接，刷新/分享丢失筛选上下文（R157 搜索页、R243 详情、R261 paper 已确立「状态即深链」惯例，仅剩这三维缺口）。
- 生产 origin 复审计无新缺陷（近 6h 4 条 502 全为历史部署窗口样本；慢样本簇落部署预热窗口）。

## 方案

- `shenlun-url.js` 增纯函数 `buildShenlunFilterUrl({ paper, qtype, year, region })`：各维度省缺省值（paper 空/超长、qtype 空或「全部」、year 非正整数、region 空）则不带参；全部缺省回落基础路径；值经 encodeURIComponent。
- `shenlun.vue`：`syncPaperUrl` 升级为 `syncFilterUrl`（组合四维状态），`setQtype/setYear/setRegion/applyPaper/clearFlt` 变更后统一调用；detail watch 关详情回落改用 filter URL（保留全部筛选上下文，不再只回落 paper）。
- onLoad 入向解析零变化（R251/R252 白名单已就位）。

## 不做

- 素材 tab 的 mtype URL 同步（入向已有，出向挂候选）；SSR/SEO/后端零变化。

## 验收

- vitest 新增 buildShenlunFilterUrl 用例（组合/缺省/非法值）。
- 前端 lint/vitest/build 全绿；生产 1440/375：App 内筛选变更后 URL 实时带对应参数、刷新保持筛选、清除回落基础路径、溢出 0、console 0 error。
