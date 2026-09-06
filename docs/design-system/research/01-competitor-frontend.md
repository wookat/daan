# 竞品与同类平台前端代码级设计提取（W5 研究 01）

- 取证日期：2026-09-05 ~ 09-06（UTC）
- 取证方式：本机 Chrome（CDP `http://localhost:29229`）+ Playwright 1.55 `connectOverCDP`，对公开网页读 DOM / `getComputedStyle` / 伪元素 / CSSOM 状态规则（`:hover/:active/:disabled/:focus`）。桌面视口 1440×900；移动视口 390×844 @2x iPhone UA。
- 合规边界：只读公开页面的样式数值与 DOM 结构；不抓题库题目内容、不下载/入库任何图片、插画、字体文件；本文所有代码片段只摘录样式数值和选择器。临时探针脚本与原始 JSON/截图留在取证机 `~/research/`（不入库）。
- 与已有资料的关系：`docs/design-benchmark/report.md`（2026-08 截图对标）负责“长什么样”，本文负责“代码里是什么数”。v3 IA 见 `docs/design-v3/DESIGN.md`，小程序 token 见 `docs/design/miniapp-v2/tokens.md`，上一轮排版专项与漂移统计见 R383（`origin/devin/1788633425-ui-type-scale` 分支上的 `docs/handoff-context.md` 末节，写作时尚未并入 main）。

---

## 0. 结论先行（TL;DR）

1. **国内四家没有一家在公开网页端暴露完整设计 token**：粉笔用 ng-zorro（`ant-*`）+ 自家 `fb-*` 类，华图 v.huatu.com 老页用手写 BEM（`tiku_*`），新公开题目页（`/gktk/*.html`）用 Tailwind 原子类，中公是传统固定宽 PC 页。可抄的是**数值与层级**，不是 token 体系。
2. **国际参照里 Khan Academy（Wonder Blocks `--wb-*`）与 Brilliant（Panda CSS `--panda-*`）都是“原始色阶 → 语义 token → 组件 token”三层结构**，且把 hover/press/disabled 直接做成语义变量（`--wb-semanticColor-action-primary-progressive-press-background: #1b50b3`、`--panda-colors-bg-danger-hover: var(--panda-colors-red-600)`）。这正是我们 R383 留档的“131 种色值 / 36 种圆角收敛”缺的那一层。
3. **按压反馈**：国内站基本只有 `transition: all` + hover 换色/opacity（粉笔登录按钮 `:hover{opacity:.8}`）；Duolingo/Brilliant 用 `::before` + `box-shadow: 0 4px 0 <深一档色>` 做 3D 按钮，Khan 用语义色 press 变量 + 2px focus ring。移动端 H5 应学 Khan（色阶 press）而非 Duolingo（3D 在 wot-design-uni 里没有现成实现，属于“增实体”）。
4. **题干行高**：华图公开题目页题干/选项 `16px/32px`（2.0），粉笔备考文章正文 `16px/32px`，Khan 练习题干 `28px/32px`（桌面）/`16px/20px`（移动）。我们 v3 规定题干 1.7，方向一致，可以维持。
5. **正文字号**：国内 PC 端普遍 14px 正文（粉笔 14/22、华图 14/26、中公 14、一起公考 14/21），Duolingo 17px、Brilliant 16/24、Khan 14/19.6。我们 H5 `$kg-font-body: 30rpx`（=15px@375）介于两者之间，无需改。
6. **我们自己的跨端漂移比竞品差距更值得先修**：品牌主色 H5 `--brand:#2e5bff` / 小程序 `--brand-500:#2e5bff`（但 `--brand-400:#5c82ff` 与 H5 `$kg-primary-500:#5c82ff` 阶位不同）/ Flutter `brand = 0xFF3B6FF5`（v3 文档色）；success H5 `#16a34a` vs 小程序 `#10b981`。三端三套值，先统一再谈借鉴。

---

## 1. 站点与可达性矩阵

| # | 站点 | 取证 URL | 视口 | 状态 | 原始证据文件（取证机） |
|---|---|---|---|---|---|
| 1 | 粉笔 官网首页 | `https://www.fenbi.com/` | D | ✅ 一手 | `fenbi-home.json/.png` |
| 2 | 粉笔 题库（行测） | `https://spa.fenbi.com/tiku/guide/home/xingce/xingce?labelId=1` | D / M | ✅ 一手；点击卷条目 → **登录弹层**（题目/解析页未进入） | `fenbi-tiku-d/m.json`, `fenbi-paper-d.json`, `pseudo-fenbi.json` |
| 3 | 粉笔 备考资料（公开 SEO 文章） | `https://www.fenbi.com/page/exam-preparation-material-detail/178/454687111017472` | D | ✅ 一手 | `fenbi-seo-q-d.json` |
| 4 | 华图 题库首页 | `https://v.huatu.com/tiku/` | D | ✅ 一手 | `huatu-v-tiku-d.json/.png`, `pseudo-huatu.json` |
| 5 | 华图 真题列表 | `https://v.huatu.com/tiku/truelist/1/1` | D | ✅ 一手 | `huatu-truelist-d.json` |
| 6 | 华图 模考 | `https://v.huatu.com/tiku/mockindex/1/1` | D | ✅ 一手（首屏即登录弹层） | `huatu-mock-d.json` |
| 7 | 华图 公开题目页（SEO） | `https://v.huatu.com/gktk/2en50.html` | D / M | ✅ 一手，含题干 + 选项 + “查看解析”按钮 | `huatu-q-d/m.json` |
| 8 | 华图 移动 H5 | `https://m.v.huatu.com/wap/#/home` | M | ⚠️ 结构化样式极少，以截图为主 | `huatu-mv-m.json/.png`, `huatu-mv-m2.json` |
| 9 | 中公 题库 | `https://tiku.offcn.com/`、`http://tiku.offcn.com/gqzp` | D | ✅ 一手（练习中心）；作答/解析页未验证；`www.offcn.com` 403 | `offcn-tiku-d.json`, `offcn-gqzp-d.json` |
| 10 | 一起公考 | `https://www.17kgk.com/` | D / M | ✅ 一手（首页）；`www.yiqigongkao.com` 不可达 | `yiqi-home-d/m.json` |
| 11 | 腰果 | `https://www.yaoguo.com/` | D | ❌ 公开入口是**腰果商城**（电商），无公开刷题 H5，不作为公考产品证据 | `yaoguo-home-d.json` |
| 12 | Duolingo | `https://www.duolingo.com/`、`/course/es/en/Learn-Spanish` | D / M | ✅ 一手 | `duo-*.json`, pseudo 输出 |
| 13 | Brilliant | `https://brilliant.org/`、`/courses/logic-deduction/` | D / M | ✅ 一手，含 703 个 `--panda-*` CSS 变量 | `brilliant-*.json`, `pseudo-brilliant-*.json` |
| 14 | Khan Academy | `https://www.khanacademy.org/`、`/math/algebra/.../e/linear_equations_3` | D / M | ✅ 一手，含公开 CDN CSS 中 `--wb-*` 变量 | `khan-*.json`, `pseudo-khan-check.json`, `khan-main.css` |
| 15 | Quizlet | `https://quizlet.com/` | D | ❌ 返回“请稍候…/One more step”防护等待页，**未取到真实产品 UI** | `quizlet-home-d.json` |

> 一句话：可用于设计参照的一手样本 = 粉笔 3 页、华图 5 页、中公 2 页、一起公考 1 页、Duolingo 2 页、Brilliant 2 页、Khan 2 页。腰果、Quizlet 只记录边界。

---

## 2. 复现方法

### 2.1 探针核心逻辑（Node + Playwright，连本机 Chrome）

```js
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://localhost:29229');
const ctx = await browser.newContext(mobile
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN', userAgent: '<iPhone UA>' }
  : { viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'commit' }).catch(() => {});          // SPA 用 commit，避免 domcontentloaded 卡死
await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(6000);
const data = await page.evaluate(() => {
  const props = ['fontFamily','fontSize','lineHeight','fontWeight','color','backgroundColor','backgroundImage',
    'borderRadius','border','boxShadow','padding','height','width','gap','transition','opacity'];
  const pick = el => { const cs = getComputedStyle(el), o = {}; for (const p of props) o[p] = cs[p]; return o; };
  const sel = 'button,[role=button],a.btn,input,textarea,[class*=card],[class*=item],[class*=tab],[class*=tag],[class*=chip],nav,header,footer,h1,h2,h3,[class*=progress],[class*=num]';
  return [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0).slice(0, 400)
    .map(e => ({ tag: e.tagName, cls: e.className, text: (e.textContent || '').trim().slice(0, 30), rect: e.getBoundingClientRect().toJSON(), style: pick(e) }));
});
```

### 2.2 伪元素 + 状态规则（按压反馈证据）

```js
// node pseudo.js <url> <selector> [desktop|mobile] [waitMs] [textFilter]
// 对命中元素输出 self / ::before / ::after 的 computed style，
// 并遍历同源 CSSOM，收集 selectorText 含 :hover/:active/:disabled/:focus 且引用该元素 class 的规则。
```

已知限制：跨域样式表（Duolingo、粉笔部分 CDN CSS）`cssRules` 抛 SecurityError，状态规则取不到，只能靠 computed style + `transition` 值判断“有反馈”；Khan 的变量在外链 CSS 里，改为下载公开 CDN CSS（`cdn.kastatic.org/khanacademy/khanacademy.*.css`）grep `--wb-`，再用 `getComputedStyle(document.documentElement).getPropertyValue()` 核对当前值。

### 2.3 读数口径

- 表中 `W×H` 为 `getBoundingClientRect()`；`字号/行高/字重` 为 computed 值；颜色统一转 hex（`@0.85` 表示 alpha）。
- “**已验证**”= 本次 computed style / CSSOM 直接读到；“**未验证**”= 页面存在但被登录墙/防护页/跨域挡住；“**推断**”= 从数值规律或类名反推，会明确标注。

---

## 3. 逐站取证

### 3.1 粉笔（fenbi.com / spa.fenbi.com）

**技术栈痕迹**：Angular（`ng-tns-*`、`ng-star-inserted`）+ ng-zorro-antd（`ant-btn`、`ant-menu-submenu`、`ant-select-selection-item`），自家前缀 `fb-*`。spa.fenbi.com 题库页**不响应移动视口**：390px 宽下 `header`/`.paper-item` 仍是 1180px（`fenbi-tiku-m.json`），说明 H5 走的是独立入口，不在本次公开取证范围。

**页面 IA（已验证部分）**
- 官网首页 `/`：顶部导航 60px（首页 / 课程 / 题库 / 关于粉笔 / 下载客户端 / 投资者关系），下方是“选岗/招考日历”工具区（日期 chip 组 + 搜索输入 + 「开始选岗」主 CTA），再是考试分类菜单（国考/省考… `ant-menu-submenu` 250×34）。
- 题库 `/tiku/guide/home/xingce/xingce`：左侧科目/labelId 导航，主体是**真题卷列表**（`.paper-item` 84px 一行：标题 14/500 + 「难度 4.5」12px 副标 + 右侧动作），底部 `footer.question-list-pager` 分页（padding 40px 0 42px）。点击卷 → `web-modal` 登录/注册弹层。**题目卡、解析卡、错题本、报告页均在登录墙后，未验证。**
- 备考资料文章页：面包屑（`.exam-preparation-materials-detail-navigator-wrapper` 14/22 蓝 `#1890ff`）→ `h1.article-title` 28px/600 → 正文 16px/32px → 右栏「相关文章 换一换」。

**按钮**

| 用途 | 选择器 | W×H | 字号/字重 | 圆角 | 颜色 | padding | 反馈 |
|---|---|---|---|---|---|---|---|
| 顶栏登录（主/深色） | `button.header-content-logon-btn` | 80×36 | 14/400 | 6px | 白字 `#000` 底 | — | `transition .1s ease-in-out`；CSSOM `:hover{opacity:.8}` ✅ |
| 顶栏登录（ant 版） | `button.login-button.ant-btn` | 80×36 | 14/400 lh14 | 6px | 白字 `#000` 底 | — | `box-shadow: rgba(0,0,0,.016) 0 2px 0`；`transition .3s cubic-bezier(.645,.045,.355,1)` |
| 首页主 CTA「开始选岗」 | `button.fb-quick-pick-positions-quick-pick-button.ant-btn` | 260×48 | 17/600 lh22 | 8px | 白字；computed `background-color:#fff`，实际色来自 background-image（渐变，未摘录） | 0 4px 0 0 | `box-shadow: rgba(60,124,252,.2) 0 2px 20px` |
| 登录弹层主按钮 | `button.form-item-btn` | 180×48 | 20/400 | 24px（胶囊） | `#3c7cfc` 底白字 | — | `box-shadow: rgba(60,124,252,.2) 0 10px …` |
| 文字按钮「账号密码登录」 | `button.form-item-btn-3` | 84×14 | 14/400 | — | `#3c7cfc` 字 | 0 | — |
| 文字按钮「换一换」 | `.fb-exam-preparation-material-related-exam-preparation-materials-butto…` | 64×20 | 14/500 lh20 | 2px | `#aeb7cb` 字（弱化） | — | gap 4px |
| 日期 chip（选中） | 首页日期切换 | 56×30 | 14/600 | 4px | 字 `#ff693b` / 底 `#fff2eb` | — | — |
| 日期 chip（未选） | 同上 | ≈37×30 | 14/500 | 4px | 灰字白底 | — | — |
| 分页项 | `.item` | 30×30 | 13/400 lh30 | 2px | `#9ea5bb` 字，`1px solid #f2f2f5` 边 | — | — |

危险 / 禁用 / 加载态：公开页面无样本，**未验证**。

**输入框**：首页搜索 256×44、14/400、透明底、2px 圆角；登录弹层 `input.form-input` 320×34、16/400、placeholder `#b1b5b9`、`box-shadow: #fff 0 0 0 30px inset`（autofill 覆盖技巧）。

**卡片 / 列表行**：`.paper-item` 1180×84、`padding:16px 24px`、`border-radius:8px`、默认透明底、`:hover{background:#fff; border-radius:8px; box-shadow: rgba(207,218,230,.4) 0 4px 30px}` ✅（CSSOM）。行内：`.item-info-title.h-5` 14/500/26 `#222`，`.item-info-subtitle.h-6.m-t-8` 12/400 `#8a9095`（类名 `h-5/h-6/m-t-8` 表明有自家 utility 字阶 h1–h6 与 4px 倍数间距）。

**导航**：`header` 1425×60，白底，`box-shadow: rgba(207,218,230,.2) 0 0 30px`，`border-radius:2px`；一级项 `.navigator-title` 18px，选中 600 `#3c7cfc`，未选 400 `#3c464f`；`transition: color .3s`。轮播指示点 `.slick-active` 23×6、2px 圆角。

**弹层**：登录 `web-modal`：标题 `h1.web-modal-title` 26px/400 `#3c7cfc`、400px 宽内容列、主按钮胶囊 180×48。

**排版**：首页 body `14px/22.001px` 400，字体栈 `system-ui,-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI","Microsoft YaHei",Roboto,…,sans-serif`；题库页 body 16px，`-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI","Microsoft YaHei","Hiragino Sans GB","Helvetica Neue",Helvetica,Arial,sans-serif`。观察到的字阶：12 / 13 / 14 / 16 / 17 / 18 / 20 / 26 / 28；行高 22.001（ant 的 1.5715）、26、32、40.6（1.45）。

**色彩**：品牌蓝 `#3c7cfc`（登录按钮/选中导航/弹层标题），链接 `#1890ff`（ant 默认，说明未完全覆写 ant 主题），强调橙 `#ff693b`/`#fff2eb`，文字 `#000 @.85`（ant）、`#3c464f`、`#222`、`#8a9095`、`#9ea5bb`、`#aeb7cb`，阴影基色 `rgb(207,218,230)`（蓝灰）。深色模式：无 `prefers-color-scheme` 或主题变量痕迹，**未提供**。

**圆角/阴影/分割线**：2 / 4 / 6 / 8 / 10 / 24px；阴影统一“蓝灰大模糊低透明”（`0 0 30px @.2`、`0 4px 30px @.4`）；分割线 `1px solid #f2f2f5`。

**空态 / Toast / 进度数字**：未见（登录墙后）。

**复合组件（可见）**：真题卷行 = [卷图标 | 标题 14/500 + 难度 12 灰 | 右侧动作]，一行 84px，hover 浮起；进入即登录 → 题目/解析卡未验证。

---

### 3.2 华图在线（v.huatu.com / m.v.huatu.com）

**技术栈痕迹**：老题库页手写 BEM（`tiku_*`、`paper-*`、`fun_search_*`）；新公开题目页 `/gktk/*.html` 为 Tailwind（`max-w-7xl mx-auto px-5 py-3 rounded-full bg-gray-100 indent-5 leading-loose`）；移动 H5 `m.v.huatu.com` 用 rem 弹性布局（body 12.48px、行高 31.2px 等 375→390 缩放痕迹，class 带 hash `login-1NLpmbl8`）。

**页面 IA（已验证）** — 见 `huatu-v-tiku-d.png`
- 题库首页 `/tiku/`：顶部 `div.g-header-wrap` 64px 白底导航（logo 127×28 / 首页 / **题库**（截图可见红色下划线）/ 25 冲刺礼包 / 加微福利 + 搜索 + 登录/注册，1180px 内容列）→ `div.tiku_nav` 90px（`padding:32px 0 26px`）→ 「公务员 ▾ 国家公务员」标题 + 二级 tab（行测 | 申论）→ **4 个练习入口卡**（真题演练 / 模考大赛 / 智能刷题 / 错题重练，`li.tiku_me_practice` 220×120，渐变色块 + 右侧插画位）→ 「专项练习」左侧知识点树（资料分析 › 综合分析类…）+ 右侧知识点卡片网格（`li.tiku_spcal_item` 286×96，名称 14/700 + `已做0/6546题` 12px 进度）+ 每组「随机练10道题 ›」。右上角工具：答题记录 / 评估报告 / 收藏夹。
- 真题列表 `/tiku/truelist/1/1`：地区 chip（`.paper-city-item.active` 54×25、3px 圆角、`#ff6666` 底白字）+ 卷卡（`.paper-name-item-in` 278×180、padding 8px、`.name-title.fs16` 16/500/20）。
- 模考 `/tiku/mockindex/1/1`：首屏登录弹层（`h2` 28/600「欢迎登录/注册」，输入 318×40，按钮 320×40 红 20px 圆角）；背景可见「我的报告 2027年国考」标题 14/700。**模考卷卡与成绩报告内容未验证。**
- 公开题目页 `/gktk/2en50.html`（桌面/移动都可读）：Tailwind 顶部导航 52px（首页 课程 题库 资讯 师资 加微福利 APP）+ 搜索 `rounded-full bg-gray-100` 204×28 → `h1.font-bold` 16/700/32 题干 → `article.indent-5.leading-loose` 16/400/32 含 `(单选题)` + A/B/C/D 选项 → 「查看解析」按钮 → 「返回顶部」14 `#a8a29e`。**这是四家里唯一公开可读的“题干 + 选项 + 解析入口”一手样本。**

**按钮**

| 用途 | 选择器 | W×H | 字号/字重 | 圆角 | 颜色 | padding | 反馈 |
|---|---|---|---|---|---|---|---|
| 主（登录/注册） | mock 弹层 button | 320×40 | 16/400 | 20px | `#ff4e45` 底白字 | — | 未见状态规则 |
| 次（随机练10道题） | `.tiku_spcs_random` 等 | 117×32 | 14/400 | 16px | 白底 `#ff4e45` 字 `1px solid #ff4e45` | — | `transition:all` |
| 解析入口（Tailwind） | `.bg-red-500.rounded` | 120×32 | 16/400 | 4px | `#ef4444` 底白字 | 0 12px | Tailwind 默认无 hover 类 |
| 地区 chip 选中 | `.paper-city-item.active` | 54×25 | 14/400 lh25 | 3px | `#ff6666` 底白字 | — | — |
| 文字（答题记录/评估报告/收藏夹） | `a.tiku_no_item` | 108×32 | 14/400 lh32 | — | `#666` | 0 0 0 30px（留图标位） | — |

**输入框**：`.fun_search_input` 149×16、12px、`#f3f4f7` 底（题库首页搜索）；公开题目页搜索 176×28（桌面）/ 232×28（移动）、9999px 圆角、`#f3f4f6`；登录输入 318×40、`padding 11px`、`1px` 边、4px 圆角。

**卡片**：`li.tiku_spcal_item` 286×96、`padding:16px`、`border-radius:8px`、`#f7f8fb` 底（无边框无阴影，靠底色分层）；`li.tiku_me_practice` 220×120、`padding:24px 0 0 24px`、16/500 白字，背景为渐变色块（值为 background-image，未摘录）；`.paper-name-item-in` 278×180、padding 8px 白底。

**导航**：题库页 header 64px（`.g-header-wrap`，内容列 1180）；`h2.tiku_nav_name` 24/600 `#170101`；分区标题 `h2` 20/700/67（用 67px 行高撑区块高度）；三级标题 `h2` 16/700/22、`h3` 14/700/22。移动 H5：顶部工具行 31.2px，右侧悬浮圆按钮 `.sideItem` 45.75×45.75、`border-radius:50%`、`box-shadow: rgba(0,0,0,.2) 0 0 10.4px`。

**进度/统计数字**：`.tiku_practice_num` `已做0/6546题` 12px、行高 22–32、左右 padding 16px，**纯文本无进度条**；`.tiku_spcal_item` 内的 `已做0/161题` 12px `#333`。

**排版**：body `14px/26px` 400，字体栈 `微软雅黑,黑体,PingFangSC-Medium,"PingFang SC",Arial,sans-serif`（PC 优先微软雅黑）；公开题目页 body 16px/24px（Tailwind base），题干/选项 16/32（`leading-loose`=2.0）。字阶：12 / 14 / 16 / 18 / 20 / 24 / 28。

**色彩**：品牌红三档并存 `#ff4e45`（老页）/ `#ef4444`（Tailwind red-500）/ `#ff6666`（chip）；文字 `#170101`、`#333`、`#666`、`#999`、`#a8a29e`（Tailwind stone-400）；浅底 `#f7f8fb`、`#f3f4f7`、`#f3f4f6`。深色模式：**未提供**。

**圆角/阴影**：3 / 4 / 8 / 14 / 16 / 20 / 9999px；阴影只在移动悬浮按钮见到。

**空态 / Toast / 弹层**：登录弹层（模考页）已验证；空态、Toast 未见。

---

### 3.3 中公（tiku.offcn.com）

**技术栈痕迹**：固定宽 PC 页（1000px 内容列），类名 `NavActive / eCnav_active / eTc_txt / oIndexConItem`，字体栈 Arial/宋体，body `#f4f5fa`。`www.offcn.com` 返回 403。

**IA（已验证）**：练习中心 `/gqzp`：一级 tab `li.NavActive`「练习中心」500×67、25px/65px 蓝 `#2bacef`；二级科目 tab `li.eCnav_active`「职业能力测验」内容宽 108、18/700、`1px solid #2bacef`、4px 圆角、`padding 0 32px`；主体 `.oIndexConItem` 1000×492 大图文块（`h3` 22/400 `#555`「专项练习」+ `h4` 18/400 `#999`「弱项集中练习，考点逐一击破；」），知识点选择面板 `h3.eTc_tit` 800×66、16/700、`#f7f7f7` 底、`border-radius 15px 15px 0 0`。搜索 `.eTc_txt` 613×35 白底 + 提交 79×35 灰蓝。**作答页、解析、报告均未验证。**

**要点**：正文 14，标题 25/22/18 用 400 字重靠字号区分层级；蓝 `#2bacef` 单一品牌色；无卡片阴影、无圆角体系（4 / 15px 各一处）。移动端未取到独立 H5。

---

### 3.4 一起公考（17kgk.com）

body `14px/21px`，`PingFangSC-Regular,sans-serif`；顶部导航 80px（`li.active`「首页」16/400 `#333`，48×78）；登录/注册按钮均 ≈50×30、4px 圆角，注册 `#44befe` 底白字、登录白底蓝字；题库卡 `.question-card` 312×120、10px 圆角、`1px solid #e6e6e6`、透明底，内含「资料分析 94万学习者」统计文案（14px 与正文同级，**无数字强调**）；大标题 `.index-ad-title` 44/600/66、`padding-top 80px`。移动 UA 下几乎无结构化样式（`yiqi-home-m.json` 极少节点），移动 IA 未验证。

### 3.5 腰果（yaoguo.com）— 仅边界

公开入口是「腰果商城」：body 12px/18px `tahoma,arial,宋体`，`#f4f4f4` 底，antd 分页（`ant-pagination-*` 32px、6px 圆角），黄色主题 `#ffd732 @.1` 卡底 / `#ffe249` 选中；卡片 8–10px 圆角、padding 12px。**与公考刷题无关，不进入任何借鉴清单。**

---

### 3.6 Duolingo（duolingo.com）

**排版**：body `17px/20px` 500，`duolingo-sans,sans-serif`（自有字体，仅记录栈名）；首页 H1 32/700，超大标 48/700、64/700，移动端降至 36。按钮文案 `15px/700`、`letter-spacing:.8px`、`text-transform:uppercase`。

**按钮（课程页 `/course/es/en/Learn-Spanish`，`pseudo.js` 读 ::before）**

| 用途 | W×H | 圆角 | 字 | 本体 | `::before` |
|---|---|---|---|---|---|
| 主「开始」 | 330×50 | 12px | 15/700 白 | 透明底、`padding 0 16px`、`border-bottom:4px solid transparent`、`transition:all` | 底 `#58cc02`、高 46px、`box-shadow: #58a700 0 4px 0` |
| 次「已有帐户」 | 330×50 | 12px | 15/700 `#1cb0f6` | 同上 | 白底、`2px solid #e5e5e5`、`box-shadow: #e5e5e5 0 2px 0` |

3D 结构 = 本体高 50 = 面 46 + 底边 4；按下时（社区通用实现为 `:active` 去掉阴影 + `translateY(4px)`）**本次因跨域 CSS 未读到 :active 规则，标“推断”**。

**导航/间距**：桌面顶栏 ≈70px，移动顶栏 70px + 左右 padding 15px；section 垂直 padding 96px；移动内容 gap 32px。

**色彩**：绿 `#58cc02`（面）/ `#58a700`（底边，约深 15%）、蓝 `#1cb0f6`、深蓝 `#042c60`、边线 `#e5e5e5`。深色模式：首页未提供。

**IA**：营销首页 + 课程落地页（大标题 + 双 CTA），**学习中的题目/进度 UI 在登录后，未验证。**

---

### 3.7 Brilliant（brilliant.org）

**Token 体系（一手，`brilliant-home-d.json` 读到 703 个 `--panda-*` 变量）**：三层结构——

```text
原始色阶  --panda-colors-blue-50…950   (#f6f8ff … #080f28, 500=#456dff)
           --panda-colors-green-50…950 (500=#29cc57, 600=#15b441, 700=#009b2b)
           --panda-colors-red-50…950   (500=#ff5d5d, 600=#e14b4b, 700=#c43939)
           --panda-colors-gray-50…950  (#f8f8f8 #f2f2f2 #e5e5e5 #ccc #b3b3b3 #999 gray #666 #4c4c4c #383838 #141414)
           --panda-colors-black-alpha-50…1000 (#00000006 … #000)   ← 文字/边线/hover 全部走 alpha
语义      --panda-colors-text-primary=black / secondary=black-alpha-700 / tertiary=black-alpha-500 / disabled=black-alpha-300 / link=blue-500
           --panda-colors-border-primary=black-alpha-200 / secondary=black-alpha-100 / select=blue-500
           --panda-colors-bg-primary=white / secondary=gray-50 / hover=black-alpha-200 / active=black-alpha-300 / disabled=black-alpha-100
           --panda-colors-bg-success-primary=green-500 / -hover=green-600 / -active=green-700 / -disabled=green-100
           --panda-colors-bg-danger-primary=red-500 / -hover=red-600 / -active=red-700 / -disabled=red-100
           --panda-colors-bg-warning-primary=yellow-500 …
尺度      --panda-spacing-1=.25rem … 96=24rem（4px 网格，含 0.5/1.5/2.5 半档）
           --panda-radii-sm .125rem / xs .375 / base .25 / md .5 / lg .75 / xl 1 / 2xl 1.25 / 3xl 2rem / full 9999px / circle 50%
           --panda-shadows-elevation-subtle 0 1px 3px #0000000a / base 0 0 15px black-alpha-200 / md 0 0 25px black-alpha-300 / outline 0 0 0 3px border-select
           --panda-letter-spacings tighter -.05em … widest .1em
           --panda-z-index base 0 / docked 10 / dropdown 1000 / sticky 1100 / banner 1200 / overlay 1300 / modal 1400 / popover 1500 / skip-nav 1600 / toast 1700 / tooltip 1800
           --panda-sizes-container-sm/md 432px, lg/xl 1216px
```

**排版**：body `16px/24px` 400，`"CoFo Brilliant",sans-serif`（自有字体）；首页 H1 76/79.8/500（display 行高 1.05），课程页 24/30、20/30、16/24、14/21；数学用 `KaTeX_Main`。

**按钮**

| 用途 | 选择器/文本 | W×H | 字 | 圆角 | 颜色 | padding | 阴影 |
|---|---|---|---|---|---|---|---|
| 主 CTA「I'm a learner」 | 首页 | 284×60 | 20/25/500 白 | 9999px | `#29cc57` | 12px 20px | `rgba(0,0,0,.05) 0 4px 7px` |
| 次 CTA「I'm a parent or teacher」 | 首页 | 284×60 | 20/25/500 `#000 @.6` | 9999px | 白 | 12px 20px | 同上 |
| 课程 Start | `pseudo-brilliant-start.json`，class 含 `panda-bdr_[calc(56px/var(--button3d-x-scale,1))/56px]` `hover:panda-op_0.85` `focusVisible:panda-bx-sh_elevation.outline` `[data-disabled]` `[data-loading]` | 全宽×48 | 16 | 56px | 本体透明（蓝面由内层子元素绘制，未摘录） | — | hover opacity .85；focus 用 `elevation.outline`（0 0 0 3px blue-500）；disabled/loading 用 data 属性 |
| Tabs「Math / Computer Science」 | 首页 | h44 | 16 | 9999px | 选中黑底白字 / 未选白底 `#000 @.6` | 0 16px | — |
| 课程级别行「LEVEL 1 Order Logic」 | 课程页 | 456×64 | 16/24 | 18px | 白底 | — | — |

**圆角/阴影观察值**：17 / 20 / 24 / 32 / 44 / 9999px；`rgba(0,0,0,.1) 0 0 15px`。中性底 `--panda-colors-oat-50 #f5f3f1`（暖灰纸色，与蓝品牌色形成暖冷对比）。深色模式：变量里有 `dark-gray #1e1e1e / dark-gray-alpha`，但页面未切换主题，**未验证**。

**IA**：首页（Hero + 双 CTA + Math/CS tabs 课程网格）；课程页（课程标题 → 级别列表行 → Start 3D 按钮）。题目/解析 UI 登录后，未验证。

---

### 3.8 Khan Academy（khanacademy.org）

**Token 体系（一手，公开 CDN CSS + `getComputedStyle(html)`）**：Wonder Blocks `--wb-*`，同样三层——

```text
原始     --wb-border-width-thin 1px / medium 2px / thick 4px；radius 1/4/8/12/24px + full 50%
语义     --wb-semanticColor-core-foreground-neutral-strong: #21242c
         --wb-semanticColor-core-background-base-default: #fff
         --wb-semanticColor-action-primary-progressive-default-background: #1865f2
         --wb-semanticColor-action-primary-progressive-hover-background:   #1865f2   (hover 不变色，靠 focus/press 表达)
         --wb-semanticColor-action-primary-progressive-press-background:   #1b50b3   (深一档)
         --wb-semanticColor-focus-outer: #1865f2
组件     --wb-c-button-root-border-radius-hover: 4px / -press: 4px
主题     选择器 [data-wb-theme$=-dark]、[data-wb-theme=syl-dark] 存在（有深色主题机制，本次未切换验证）
```

Check 按钮 CSSOM 规则 ✅（`pseudo-khan-check.json`）：`:hover` → hover-background 变量；`:active` → press-background；`:focus-visible` → 2px focus outline（`--wb-border-width-medium` + `--wb-semanticColor-focus-outer`）。

**练习页 `/e/linear_equations_3` 结构（一手，见 `khan-ex-d.png`）**：深蓝顶栏（Explore ▾ | Search 200×40 | Logo | Donate / Log in / Sign up）→ 左侧课程目录列（视频/练习列表）→ 右侧 `.framework-perseus` 题目容器（`h1` 28/32/700 桌面、16/20/700 移动）→ **底部固定操作栏 ≈1009×66**：左侧无障碍/重做图标，中间「Do 4 problems」16/700 + 4 个圆点进度，右侧 `Skip` 44×40 文字按钮（蓝字透明底 4px 圆角）+ `Check` 130×40 主按钮（`#1865f2` 白字、4px 圆角、`padding 0 16px`）。

**按钮/输入**

| 用途 | W×H | 字 | 圆角 | 颜色 | padding | 反馈 |
|---|---|---|---|---|---|---|
| 主 Check | 130×40 | 16/700 | 4px | `#1865f2` 白字 | 0 16px | press `#1b50b3`，focus 2px 环 ✅ |
| 文字 Skip | 44×40 | 16/700 | 4px | `#1865f2` 字透明底 | — | 同变量体系 |
| 首页 Search | 200×40 | 13.333 | 8px | `#ebf1fd` 底 `1px` 边 | 0 16px | — |
| 练习答案输入 | 80×32 | 18 | 3px | `1px solid rgb(144,146,150)` | 4px 5px | — |

**排版**：首页 body `"Plus Jakarta Sans","Noto Sans",sans-serif` 14/19.6；练习页 body `Lato,"Noto Sans",Helvetica,Corbel,sans-serif` 14/19.6；首页 H1 42/46.2/700；练习 H1 28/32/700。数值以 rem 表达（14px = 1.4rem，推断根字号 10px）。

**色彩**：品牌蓝 `#1865f2`、press `#1b50b3`、文字 `#21242c`；顶栏深蓝与顶部信息条“浅蓝底 + 左侧蓝色竖边”为截图观察（`khan-ex-d.png`），未读数。深色主题机制存在（`data-wb-theme`），**视觉未验证**。

**IA（练习闭环，四站唯一公开可见）**：题目区 + 底部固定操作栏（进度点 + Skip + Check），左侧课程上下文；作答后反馈/解析（登录可选）本次未点到答案提交，**解析卡样式未验证**。

---

### 3.9 Quizlet — 仅边界

`https://quizlet.com/` 返回标题「请稍候…」/「One more step…」防护页；探针记录到的 `"hurmegeo sans no2"` 字体、40/56 标题、`#4255FF` 品牌色均属于等待页，**不作为 Quizlet 产品 UI 证据**。

---

## 4. 横向对照表

### 4.1 排版

| 站点 | body 字体栈（首项） | 正文 | 行高比 | 标题层级（已见） | 题干/长文 |
|---|---|---|---|---|---|
| 粉笔 | system-ui / PingFang SC / Microsoft YaHei | 14 | 1.57（ant） | 28/600 · 18/600 · 16/600 · 14/500 · 12/400 | 16/32（备考文章） |
| 华图 | 微软雅黑 → PingFang SC | 14 | 1.86 | 28/600 · 24/600 · 20/700 · 16/700 · 14/700 | 16/32（`leading-loose`） |
| 中公 | Arial/宋体 | 14 | — | 25/400 · 22/400 · 18/400 · 16/700 | — |
| 一起公考 | PingFangSC-Regular | 14 | 1.5 | 44/600 · 16/400 | — |
| Duolingo | duolingo-sans | 17/500 | 1.18 | 64 · 48 · 32 /700，移动 36 | — |
| Brilliant | CoFo Brilliant | 16 | 1.5 | 76/500 · 24 · 20 · 16 · 14 | — |
| Khan | Plus Jakarta Sans / Lato | 14 | 1.4 | 42 · 28 · 16 /700 | 28/32 桌面，16/20 移动 |
| **我们 H5** | 系统栈（uni） | 30rpx≈15 | v3 1.55 | display 48 / h1 40 / h2 34 / body 30 / sub 26 / caption 22 rpx | v3 题干 1.7 |

### 4.2 按钮尺寸与反馈

| 站点 | 主按钮高 | 圆角 | 字号/字重 | 反馈机制 | 危险/禁用/加载 |
|---|---|---|---|---|---|
| 粉笔 | 36（顶栏）/ 48（CTA、弹层） | 6 / 8 / 24 | 14–20 / 400–600 | `:hover{opacity:.8}`；`transition .1–.3s` | 未验证 |
| 华图 | 32 / 40 | 4 / 16 / 20 | 14–16 / 400 | 仅 `transition:all`，无状态规则 | 未验证 |
| 中公 | 35（搜索） | 0 / 4 | 14–18 | 无 | 未验证 |
| 一起公考 | 30 | 4 | 14 | 无 | 未验证 |
| Duolingo | 50（=46 面 + 4 底） | 12 | 15/700 大写 | `::before` 3D 底边 `0 4px 0` 深色 | 未验证 |
| Brilliant | 48 / 60 | 56 / 9999 | 16–20 / 500 | hover opacity .85 + focus 3px 外环；语义 hover/active/disabled 变量 | 变量层已定义（`bg-danger-*`、`bg-disabled`）；按钮用 `data-disabled/data-loading` |
| Khan | 40 | 4 | 16/700 | press 变量深一档 + 2px focus 环 | 变量层已定义 |
| **我们** | v3 ≥44 / v2 48 | 12/20/28/40 rpx | 30rpx | wot-design-uni 默认 | `$kg-error/-bg/-deep` 已有，press 无 token |

### 4.3 色彩

| 站点 | 品牌 | 品牌深一档 | 强文字 | 弱文字 | 边线/浅底 | 深色模式 |
|---|---|---|---|---|---|---|
| 粉笔 | `#3c7cfc` | — | `#000@.85` / `#222` | `#8a9095` `#9ea5bb` `#aeb7cb` | `#f2f2f5` | 无 |
| 华图 | `#ff4e45` / `#ef4444` / `#ff6666` | — | `#170101` `#333` | `#666` `#999` `#a8a29e` | `#f7f8fb` `#f3f4f6` | 无 |
| 中公 | `#2bacef` | — | `#333` `#555` | `#999` | `#f4f5fa` `#f7f7f7` | 无 |
| 一起公考 | `#44befe` | — | `#333` | — | `#e6e6e6` | 无 |
| Duolingo | `#58cc02` / `#1cb0f6` | `#58a700` | `#042c60` | — | `#e5e5e5` | 未提供 |
| Brilliant | `#456dff` / `#29cc57` | blue-600 `#375ce3` / green-600 `#15b441` | `#000` | `#000@.7` `@.5` `@.3` | `#000@.2` / `#000@.1`；纸底 `#f5f3f1` | 变量有，未验证 |
| Khan | `#1865f2` | `#1b50b3` | `#21242c` | — | `#ebf1fd` | 机制有，未验证 |
| **我们 H5** | `#2e5bff` | `#1d4ed8` | `#17181c` | `#5f6575` `#6b7280` `#b0b4c0` | `#e7e9f0` / `#f2f3f7` | 有（App.vue 变量） |
| **我们小程序** | `--brand-500 #2e5bff` | `#1e44d9` | — | — | `#f1f3f8` | — |
| **我们 Flutter** | `#3B6FF5` | `#2F5CD8` | — | — | — | — |

### 4.4 圆角 / 阴影 / 间距

| 站点 | 圆角集合 | 阴影 | 基准网格证据 | 页边距/容器 |
|---|---|---|---|---|
| 粉笔 | 2 4 6 8 10 24 | 蓝灰 `0 0 30px @.2` / `0 4px 30px @.4` | `h-5/h-6/m-t-8` utility → 4px 倍数 | 1180 内容列；行 padding 16×24 |
| 华图 | 3 4 8 14 16 20 9999 | 仅悬浮按钮 `0 0 10px @.2` | padding 8/16/24 | 1180 列；卡 padding 16 |
| 中公 | 4、15 | 无 | 无 | 1000 列 |
| Duolingo | 12 | 3D 底边 | 15/16/32/96 | 移动 15px 边距 |
| Brilliant | .125–2rem + full | subtle/base/md 三档 | `--panda-spacing` 4px 网格 | 容器 432 / 1216 |
| Khan | 1 4 8 12 24 + full | 无卡片阴影 | rem（1.4rem 正文） | — |
| **我们** | 12/20/28/40/999 rpx（=6/10/14/20 px） | `$kg-shadow-1/2/3` | `$kg-space` 8rpx 网格 | 32rpx=16px |

---

## 5. 复合组件的组织方式（仅写已验证部分）

| 复合组件 | 已验证样本 | 结构 | 数值要点 |
|---|---|---|---|
| 题目卡 + 选项组 + 解析卡 | 华图 `/gktk/2en50.html`；Khan 练习页 | 华图：`h1` 题干 → `article` 内 `(单选题)` 前缀 + A–D 选项同一段落流、缩进 `indent-5` → 「查看解析」红按钮（解析默认折叠）。Khan：题干 → 输入/选项 → **底部固定操作栏**（进度点 + Skip + Check），解析在提交后 | 题干/选项 16/32；Check 40px 高 4px 圆角；操作栏 66px 高 |
| 练习入口卡 | 华图 `li.tiku_me_practice` ×4；中公 `.oIndexConItem` | 华图：四张等宽 220×120 渐变卡横排，左上标题 16/500 白，右下插画位；中公：单列大图文 | 华图 padding 24 0 0 24；中公 h3 22 + h4 18 |
| 模考卷卡 | 华图 `.paper-name-item-in`（真题卷） | 卡 278×180 白底 padding 8，标题 16/500/20 三行区（高 60）+ 元信息 12px | 粉笔卷为**列表行**（84px）而非卡 |
| 成绩报告卡 | — | 四站均在登录墙后 | **未验证** |
| 学习进度 hero | 华图知识点卡内 `已做0/6546题` | 纯文本 12px，无进度条、无大数字 | 一起公考「94万学习者」14px 与正文同级 |

结论：国内公开页对“进度/统计数字”几乎零强调（12–14px 灰字），这是我们 v2 tokens 里 `tabular-nums + 800` 大数字 hero 的差异化空间，不必向竞品收敛。

---

## 6. 页面布局与 IA 对照

| 页面 | 粉笔（公开） | 华图（公开） | 中公（公开） | Khan | 我们 v3（`docs/design-v3/DESIGN.md`） |
|---|---|---|---|---|---|
| 首页 | 招考日历/选岗工具 → 考试分类菜单 → 课程 | 顶栏「题库」高亮 → 考试切换 → 4 入口卡 → 知识点网格 | 练习中心 tab → 科目 tab → 大图文入口 | 顶栏搜索 + 课程目录 | 今日任务 hero → 快捷入口 → 错题/统计 |
| 练习 | 真题卷列表行 + 分页（登录后作答） | 知识点树 + 卡片网格 + 「随机练 10 道」 | 「请选择知识点」面板 | 课程目录列 | 题型/方法路由 |
| 题目 | 登录墙 | ✅ 题干 + 选项 + 解析折叠 | 未验证 | ✅ 题干 + 底部操作栏 | 题卡 + 选项组 |
| 解析 | 登录墙 | 按钮触发，内容未展开验证 | 未验证 | 提交后，未验证 | 解析卡（方法库） |
| 错题本 | 登录墙 | 入口卡「错题重练」 | 未见 | 无对应 | 错题本 tab |
| 模考 | 卷列表（登录作答） | `/mockindex` 登录墙，背景见「我的报告」 | 未见 | 无对应 | 模考/真题卷 |
| 报告 | 登录墙 | 「评估报告」入口文字链 | 未见 | 登录后 | 成绩报告卡 |
| 个人中心 | 登录墙 | 「答题记录 / 收藏夹」文字链 | 未见 | 登录后 | 我的页 |

优先级观察（一手）：华图把「真题演练 / 模考大赛 / 智能刷题 / 错题重练」四卡放在题库首屏折叠线以上，知识点网格占剩余全部高度；粉笔题库首屏就是卷列表，无入口卡；两家都把「答题记录 / 评估报告 / 收藏夹」降为右上角文字链。

---

## 7. 与我们现状的对照（一手：仓库代码）

| 维度 | 我们的现值 | 竞品/参照 | 判断 |
|---|---|---|---|
| 品牌色跨端 | H5 `--brand #2e5bff`（`frontend-uni/src/App.vue:78`）；小程序 `--brand-500 #2e5bff` 但 `--brand-400 #5c82ff`（`app.wxss:7-8`），H5 同色叫 `$kg-primary-500`（`uni.scss:19`）；Flutter `brand 0xFF3B6FF5`（`theme.dart:5`） | Brilliant/Khan 单一原始色阶 + 语义别名 | **三端阶位与色值都不一致**，先统一 |
| 语义色跨端 | H5 `$kg-success #16a34a` / 小程序 `--success #10b981` | Brilliant `bg-success-primary=green-500`、`-hover=600`、`-active=700`、`-disabled=100` | 值不一致且缺 hover/active/disabled 档 |
| 中性色 | `$kg-text-1..4` 4 档实色 + `--line/--fill` | Brilliant 文字/边线全部 `black-alpha`（在任何底色上可用）；Khan 实色 | R383 131 种色值收敛时可考虑 alpha 中性色（深色模式只需换 1 个基色） |
| 字阶 | 22/26/30/34/40/48/56 rpx（R383 已偶数化 360 处） | 粉笔 12–28 九档；Brilliant 14/16/20/24 | 我们已够用，不加档 |
| 行高 | v3 正文 1.55 / 题干 1.7 | 华图/粉笔长文 2.0；Khan 题干 1.14 | 保持 1.7，不学 2.0（移动端太松） |
| 圆角 | 12/20/28/40/999 rpx；R383 统计 36 种实际值 | Brilliant 9 档 token；Khan 5 档；粉笔 6 值无 token | 收敛到 5 档 token 是主流做法 |
| 按钮高 | v3 ≥44 / v2 48 | Khan 40、粉笔 48、Duolingo 50、Brilliant 48–60 | 48 主 / 40 次 / 32 chip 三档足够 |
| 按压反馈 | wot-design-uni 默认（未在 token 定义） | Khan press 变量深一档 | 新增 `--brand-press` 一档即可，不做 3D |
| 深色模式 | App.vue 已有 dark 变量组（`App.vue:154-172`） | 四家国内均无；Khan/Brilliant 有机制未验证 | 我们领先，保留 |
| z-index | 未见集中 token | Brilliant 十档 z-index token | 弹层/Toast/抽屉并存时值得引入 |

---

## 8. 对我们最值得借鉴的 15 条

每条：做法 → 证据 → 落到哪（遵循“代码即架构”，落点是 token/组件而非文档）。

1. **色彩三层化：原始色阶 → 语义 → 组件**。证据：Brilliant `--panda-colors-blue-500` → `--panda-colors-bg-blue-primary` → 按钮；Khan `--wb-semanticColor-action-primary-progressive-*` → `--wb-c-button-root-*`。落点：`uni.scss` 保留 `$kg-primary-*` 为原始层，`App.vue` 的 `--brand/--brand-soft/--brand-strong` 明确为语义层，并让 `app.wxss`/`theme.dart` 只引用语义名。
2. **交互态进 token：每个语义色带 hover/press/disabled 档**。证据：Khan `press-background #1b50b3`（默认 `#1865f2`）；Brilliant `bg-success-hover=green-600`、`-active=green-700`、`-disabled=green-100`。落点：`--brand-press`、`--bad-press`、`--ok-press` + `--disabled-bg`，wot-design-uni 主按钮 `:active` 用它。
3. **press 用“深一档”而不是 opacity**。证据：粉笔 `:hover{opacity:.8}` 会让白字变灰、对比度掉；Khan/Brilliant 用色阶。落点：同 2。
4. **中性文字/边线用 alpha 黑**。证据：Brilliant `text-secondary=#000@.7 / tertiary=@.5 / disabled=@.3`，`border-primary=#000@.2`。落点：R383 留档的 131 色收敛时，`--ink-2/3/4` 与 `--line` 可改为 alpha（深色模式只换基色）。
5. **圆角收敛为 ≤6 档并给语义名**。证据：Khan 1/4/8/12/24+full；Brilliant sm…3xl+full。落点：36 种圆角映射到 `$kg-radius-s/m/l/xl/full` 五档，禁止页面内写字面量。
6. **spacing 4px 网格显式命名，含 0.5 档**。证据：Brilliant `--panda-spacing-0.5 … 96`；粉笔 `m-t-8` utility。落点：`$kg-space-*` 已是 8rpx 网格（=4px），补 `$kg-space-0 4rpx` 半档给图标间距。
7. **z-index 层级 token**。证据：Brilliant docked 10 / dropdown 1000 / sticky 1100 / overlay 1300 / modal 1400 / toast 1700 / tooltip 1800。落点：`App.vue` 增 `--z-sticky/--z-overlay/--z-sheet/--z-toast`，与 wot 弹层 z-index 对齐。
8. **题目页“底部固定操作栏”**：进度 + 跳过 + 主动作一行。证据：Khan 练习页操作栏 66px，`Skip` 文字按钮 + `Check` 130×40 主按钮 + 4 个进度点。落点：练习/模考作答页共用一个 `q-action-bar` 组件（现有 `q-social-bar` 可参考位置）。
9. **题干与选项同一段落流 + 解析默认折叠**。证据：华图 `/gktk/2en50.html` `article.leading-loose` 16/32，「查看解析」红按钮。落点：解析卡默认折叠、按钮展开，减少首屏高度。
10. **练习入口用“4 卡等宽横排”而非长列表**。证据：华图 `li.tiku_me_practice` 220×120 ×4（真题演练 / 模考大赛 / 智能刷题 / 错题重练）。落点：首页快捷入口收敛为 4 个，与 v3 hero 下方入口对齐。
11. **列表行 hover/press 用“浮起”而非换底色**。证据：粉笔 `.paper-item:hover{background:#fff; box-shadow: rgba(207,218,230,.4) 0 4px 30px}` 默认透明底。落点：卷库列表行 `:active` 用 `$kg-shadow-2`，不改字色。
12. **阴影基色带品牌冷调、大模糊低透明**。证据：粉笔 `rgb(207,218,230)` 蓝灰 30px 模糊 `.2/.4`；Brilliant `0 0 15px black-alpha-200`。落点：`$kg-shadow-*` 目前基色 `#17181c`，可改为 `rgba(46,91,255,.08)` 系与品牌一致。
13. **胶囊次按钮 = 白底 + 1px 品牌色描边 + 品牌色字**。证据：华图「随机练10道题」117×32、16px 圆角、`1px solid #ff4e45`。落点：wot `wd-button plain` 主题色即可，不新增组件。
14. **搜索框统一 `rounded-full` + 浅灰底、高 28–40**。证据：华图 Tailwind 版 204×28 `#f3f4f6` 9999px；Khan 200×40 `#ebf1fd` 8px。落点：题库搜索用 `wd-search` 设 `--fill` 底 + `$kg-radius-full`。
15. **移动端标题层级“缩号不缩重”**。证据：Khan 题干 28/700 → 移动 16/700；Duolingo 48/700 → 36/700。落点：H5 `h1/h2` 在 ≤375 视口只降字号档位，字重保持。

## 9. 不该学的 5 条

1. **3D 立体按钮（Duolingo 的 `::before` + `0 4px 0` 底边，Brilliant 的 `--button3d-x-scale` 变体）**。证据：Duolingo 本体 50 = 46 面 + 4 底，需要伪元素双层与 `:active` 位移；wot-design-uni 无此能力 → 要么魔改要么新组件，违反“如无必要勿增实体”，且与我们现有扁平卡片语言不搭。
2. **正文/题干行高 2.0**。证据：华图 `leading-loose` 16/32、粉笔文章 16/32。PC 宽栏成立，390px 屏上 4 个选项就占半屏；v3 题干 1.7 已是移动端上限。
3. **一个品牌色三种值并存**。证据：华图 `#ff4e45` / `#ef4444` / `#ff6666` 分别出现在老页、Tailwind 页和 chip。我们三端现状正是这种状态（`#2e5bff` / `#3B6FF5` / 阶位错位），要修的是它，不是复制它。
4. **进度/统计只做 12px 灰字**。证据：华图 `已做0/6546题` 12px、一起公考「94万学习者」14px 与正文同级、无进度条。我们 v2 的 `tabular-nums + 800` 大数字 hero 才是差异点。
5. **登录墙前置到题目/模考首屏 + 桌面固定宽不响应移动视口**。证据：华图 `/mockindex` 首屏即弹登录；粉笔点卷即弹登录；spa.fenbi.com 在 390px 下仍 1180px 布局；中公 1000px 固定宽。我们 SEO 页族（`/tiku/q/*`）公开可读是既有优势，保持“先看题、后登录”。

---

## 10. 未验证清单与下一步

**未验证（本次不能下结论）**：粉笔题目卡/解析卡/错题本/报告/个人中心（登录墙）；华图作答页、解析展开态、模考卷卡、成绩报告（登录墙）；中公作答与解析页；一起公考移动端；腰果公考产品（公开入口为商城）；Quizlet 全部（防护页）；Duolingo 学习中 UI 与 `:active` 规则（跨域 CSS）；Khan/Brilliant 深色主题视觉；所有站点的 Toast、空态、加载态、危险态按钮（公开页无样本）。

**下一步（建议按“代码即架构”直接落 PR，不再写文档）**：
1. 三端品牌色/语义色对齐（§7 第 1–2 行）——先出一张“原始 → 语义 → 三端别名”映射表并改 `uni.scss` / `App.vue` / `app.wxss` / `theme.dart`。
2. 新增 `--brand-press / --ok-press / --bad-press / --disabled-bg` 与 `--z-*`，接到 wot-design-uni 主题变量。
3. R383 留档的 36 圆角 / 131 色值收敛脚本化：字面量 → 五档圆角 token、alpha 中性色。
4. 作答页 `q-action-bar`（进度点 + 跳过 + 主动作）作为练习/模考/错题重练三处共用组件。
