# R389：首页 `<title>` 从未上线（uni 构建覆写）+ 三引擎收录实况入档

日期：2026-09-04 · 生产 rev 起点 2dd6b98（R388）

## 1. 一手证据

### 1.1 三引擎 `site:kaogong.zalize.com`（09-04 23:0xZ 浏览器实查，未登录态）

| 引擎 | 结果 | 与抓取日志对照 |
|---|---|---|
| Google | **2 页已收录**：`/`（标题「错题邦」）、`/tiku/`（标题「公务员考试题库_行测真题在线刷题 - zalize」） | R377 时「无法识别此网址」→ 今首次出现收录；`/tiku/q/*` 仅抓过 1 页（404717），未收录 |
| Bing | 0 页（`site:` 回落到无关结果） | 日志 Bingbot 已抓 `/tiku/*` 60+ 次、IndexNow 在推 |
| Yandex | 0 页（No results） | 日志 Yandex 已抓 `/tiku/*` 189+ 次（抓得最多） |
| Baidu | 未取到（`site:` 触发滑块验证） | 日志 Baiduspider 近 2 日 `/tiku/*` 1 次 |

GSC 同刻：站点地图「成功 · 已发现 109,903」，「网页索引编制」仍显示「正在处理数据，请过 1 天左右再来查看」——收录数以 `site:` 实查为准，GSC 报表下轮再核。

结论边界：「已收录 2 页」≠ 有排名 ≠ 有真人点击；近 3 天 referer 0 条来自任何搜索引擎，`source=seo*` 真人作答仍 0。

### 1.2 Google 收录的首页标题就是全站最弱的一处

线上 `https://kaogong.zalize.com/` 原始 HTML：

```html
<title>错题邦</title>
```

而仓库 `frontend-uni/index.html` 里写的是 `<title>错题邦 - 考公行测真题在线刷（原上岸错题）</title>`。差异根因（读 `@dcloudio/uni-h5-vite/dist/plugin/transformIndexHtml/index.js`）：

```js
const title = webManifest?.title || manifestJson.name || '';
html.replace(/<title>(.*?)<\/title>/, `<title>${title}</title>`)
```

uni H5 构建**无条件**用 `manifest.json` 的 `h5.title`（缺省 `name`=「错题邦」）覆写 `<title>`。本仓库 manifest 没有 `h5` 段，所以源码里那行 SEO 标题从写下那天起就没上过线。`dist/build/h5/index.html` 实查同为 `<title>错题邦</title>`。

挂载后 uni 再把 `document.title` 改成首页 `navigationBarTitleText`=「刷题」（Playwright 实测 `/` → title「刷题」、h1「刷题」；`/#/pkgA/exam/list` →「真题卷库」）。Google 索引展示的是静态「错题邦」，即取的是原始 HTML 的 `<title>`。

对照：`/tiku/` 为后端 SSR，`<title>公务员考试题库_行测真题在线刷题_错题邦</title>` 带检索词，Google 展示正常。粉笔首页标题「粉笔 - 公考、教师、事业单位、考研、四六级备考平台」也是品牌 + 检索词结构。

## 2. 方案（零功能、bundle 不变、只动 index.html）

1. `frontend-uni/src/manifest.json` 新增 `h5.title`（uni 唯一真正读取的 H5 标题来源）：
   `错题邦 - 公务员考试行测真题免费在线刷题 · 错题本 · 模考`（29 字，移动端 SERP 截断线内；含「公务员/行测/真题/错题本」四个检索词，`/tiku/` 与首页不重复主词序）。
2. `index.html` 的 `<title>` 与 `og:title` 改成同一字符串（`<title>` 本身会被覆写，保持一致只为避免再出现「源码写了、线上没有」）。
3. 新增 `tests/seo-title.test.js`：断言 `manifest.h5.title` 存在、含四个检索词、≤34 字，且与 `index.html` 的 `<title>`/`og:title` 三处一致。

不做：
- 不改 `navigationBarTitleText`「刷题」（挂载后的 tab 标题是应用内语义，与首页头部标题栏同源，改长会把页头撑坏）；
- 不改 `App.vue` 的 a11y h1（取页头标题，是无障碍语义，不是 SEO 位）；
- 不动 `/tiku/*` SSR 标题（已带检索词、Google 展示正常）；
- Bing/Yandex「抓了不收」：站点无 Bing 站长工具资源、无诊断数据，本轮只入档，不拍脑袋改页面。

## 3. 本地验证

- `npm run lint`（eslint src tests + edge）绿；`vitest run` 63 文件 547 通过（含新增 2 例）。
- `npm run build:h5` 绿；`dist/build/h5/index.html` 的 `<title>` 为新标题；bundle 仍为 `index-Bctw4Xpu.js`（与 R387/R388 一致，只有 index.html 变化）。

## 4. 部署 / 生产复验

- [ ] 部署（bundle 不变，CF Pages 静态层 index.html 更新即生效）
- [ ] 生产 `curl /` 原始 HTML `<title>` 为新标题；挂载后 `document.title` 仍「刷题」（应用内行为不变）
- [ ] 1440/375 首页/练习/卷库/错题本回归、console 0、/api 全 2xx、容器 0 重启
- [ ] GSC 对 `/` 重新请求编入索引；Google 展示标题更新需等再抓取（不在本轮验收内）
