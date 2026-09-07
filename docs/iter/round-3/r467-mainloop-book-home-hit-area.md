# R467 · 主循环页错题本 `pages/book` / 首页 `pages/home` 首次强制只读读数 → 可点元素 40px 命中带修复 → 部署 → 375/1440 复验（+ 部署脚本 600 s 中止后手工续跑 4c/5/6 的一次一手记录）

R465 SKILL 新条要求每 10 轮 SOP-10 至少把 `pages/practice` `pages/book` `pages/index` 三个主循环页强制过一遍字号/热区读数；R465 已过 `practice`，本轮过剩下两个。
**路径勘误先记**：R465/R466 handoff 写的 `pages/index` 不存在，首页实际是 `src/pages/home/home.vue`（`pages.json` 首项、TabBar 第 2 项），本文以下都写 `home`。
本轮：只读读数（源码 + 生产 DOM）→ 命中真可点且外层无撑高的元素 → 只改 **2 个前端文件的 `<style>` + `book.vue` 1 处模板包一层**（0 后端、无 DB 写入）+ 1 个源锁 → 生产 `7e2e2b3` → `a49b52c`（同一分支 PR #619，base=main，仍 open 待人工 Merge）。

## 1. 结论先行

1. **字号**：两页样式块 `<24rpx` 声明 **0 处**（`grep -nE 'font-size: (1[0-9]|2[0-3])rpx'` 空），生产 375/1440 全页 `<11.9px` 叶节点只剩 uni TabBar label ×5（uni 内置）→ 字号维度**无需改**。R430–R466 历轮修过的字号规则覆盖了这两页。
2. **热区（改前生产一手，375 仿真 360 / 1440 实宽 1425）**——按模板逐个 `grep @click` 后核外层：

   | 页 | 元素 | 模板 | 改前高 375 / 1440 | 外层 | 判定 |
   |---|---|---|---|---|---|
   | book | `.seg-i` ×3 待掌握/已掌握/收藏 | `<view class="seg-i" @click="tab=…">` | 30.4 / 33 | `.seg` 36.2（工具行 44） | 真可点、外层 <40 → 修 |
   | book | `.pbadge` 卷源徽标（点了按卷筛选） | `<text class="pbadge" @click.stop>` | 19.8 / 21 | `.mhead` 19.8 / 21 | 真可点、无撑高 → 修（不能撑药丸、不能抬 `.mhead`） |
   | book | `.mg-go` 「查看 ›」 | `<text class="mg-go" @click.stop="pickGroup">` | 33.3 / 35 | `.mg-row` 57（整行另有 `toggleGroup`） | `@click.stop` 独立动作、自身 <40 → 修 |
   | book | `.recap-h` 月复盘头（收起/展开） | `<view class="recap-h" @click>` | 18 / 19 | `.card.recap` 内首行 | 真可点、无撑高 → 修（负外边距） |
   | book | `.recap-link` 错因行（筛选） | `<view class="recap-row recap-link" role="button" @click>` | 源码无 min-height（改前一手未取，只读脚本第一版未列） | 进度条行 | 修 |
   | book | `.kbd-more` 「按 ? 查看全部 ›」（桌面卡） | `<text class="kbd-more" @click>` | 隐藏 / 17 | 桌面侧栏卡 | 修（负外边距） |
   | book | `.sheet-x` 弹层 ✕ ×N | `<text class="sheet-x" @click>` | 源码 `30rpx 字 + padding 10rpx 20rpx` ≈ 24–28（改前一手未取；`.sheet-h` 行 28） | — | 修 40×40（负外边距保 `.sheet-h` 28） |
   | book | `.rf-alt` `.resume-drop` `.manual-back` `.retry` `.sim-row` | 各态文字链 | 源码无 min-height | — | 未在生产真实走到态，按源码同规则补（§5） |
   | home | `.ld-x` 新访客首屏 ✕ | `<text class="ld-x" @click="closeLanding">` | 22.7 / 23 | 绝对定位 | 修 40×40 |
   | home | `.ann-x` 公告 ✕ | `<view class="ann-x" role="button" @click>` | 19.8 / 20 | `.ann` 公告条 | 修 40×40（负外边距不抬公告条） |
   | home | `.cb-go` `.cb-x` 续练/续考横幅 | `@click` | 源码无 min-height | — | 未在生产走到态（无未完成练习），按源码补 |
   | home | `.tk-go` 「去刷题 ›」 | `<text class="tk-go">` **无 `@click`** | 16 / 17 | `.tk-row` **52.3 / 55** 整行 `@click="taskGo"` | **不改**：外层已是命中区，典型「读数小但外层够」 |
   | home | `.searchbar` | 搜索框 | 33.3 / 37 | `.hero-top` 行 44 | 输入框（非按钮），44 行内 → 不改，登记 |

   同页已达标的（改前即 ≥40）：book `.op` 44 / `.filterbtn` 44 / `.loadmore` 94.7 / `.fab-main` 49.9 / `.mg-row` 57；home `.hero-btn` 44 / `.sec-more` 44 / `.guide-x` 44 / `.examsw` 44 / `.ld-btn` 44 / `.hero-ds-arc` 40 / `.sz-arc` 40。
3. **改法**（页面层 40px 口径，同 R410+/R464–R466；会抬行的用负外边距）：

   | 元素 | 改法 | 行高影响（生产改后） |
   |---|---|---|
   | `.seg-i` | `flex center; min-height:40px; padding:0`；`.seg padding 6→4rpx` | `.seg` 36.2 → 43.8 / 44，仍在 44 工具行内（`.filterbtn` 44 同行）|
   | `.pbadge` | 模板 `<view class="pbadge-hit" @click.stop><text class="pbadge">…</text></view>`；`.pbadge-hit inline-flex; min-height:40px; margin:-10px 0; max-width:40vw; position:relative; z-index:1`；`.pbadge` 保持 20px 药丸 + ellipsis | `.mhead` **19.8 / 21 不变**；徽标宽 146.4 与改前一致（`max-width` 从徽标挪到外包）|
   | `.mg-go` | `inline-flex; min-height:40px; padding-left 24rpx` | `.mg-row` **57 不变** |
   | `.recap-h` | `flex; min-height:40px; margin:-11px 0; position:relative; z-index:1` | 收起态 `.card.recap` 44（1440 一手）|
   | `.recap-link` | `min-height:40px; margin-top:0` | 错因行 40（进度条行整行可点）|
   | `.kbd-more` | `inline-flex; min-height:40px; margin:-4px 0 -11px` | 桌面卡 151.5 |
   | `.sheet-x` | `inline-flex center; min-width/height:40px; margin:-6px -8rpx -6px 0; padding:0` | `.sheet-h` **28 不变** |
   | `.rf-alt .resume-drop .manual-back .retry .sim-row` | `min-height:40px`（`.resume-drop` 负外边距）| 源码 + 源锁 |
   | home `.ld-x` | `40×40 flex center`，`right 8rpx` | 首屏卡 299 |
   | home `.ann-x` | `flex center; min-width/height:40px; margin:-10px -8rpx -10px 0` | `.ann` 改后 106 / 62（`-10px` 上下外边距恰抵 40−20，设计上不抬；改前 `.ann` 一手未取）|
   | home `.cb-go` / `.cb-x` | `min-height:40px` / `40×40` | 源码 + 源锁 |
   | home `.tk-go` | **不动**（源锁反向锁「不含 min-height」+ `.tk-row @click` 存在）| — |

   `.pbadge-hit` / `.recap-h` 加 `position:relative; z-index:1` 的原因：负外边距撑出的 40px 带在 1440（`.mhead` 21 单行）下半段会被下方题干 `.q` 盖住，本地 dist 预检 `elementFromPoint(+19)` 一次不命中；置顶后 ±19 全命中（§3）。
4. **生产复验（§3）**：全部改动元素 375/1440 **40 / `elementFromPoint` ±19 命中、±21 不命中**；`.mhead` 1440 21 与改前同值（375 读 41.8 = 时间标签折行，徽标宽 146.4 同改前，见 §5）、`.mg-row` 57、`.sheet-h` 28 不变；`.tk-row` 52.3/55 整行命中 ±21 全 true；两页 `<11.9px` 叶节点仍只剩 TabBar label。本地 dist 预检数值与生产逐项一致。
5. **部署本身出了一次可复用的坑（§2b）**：`deploy_h5.sh` 远端 `compose up --build` 两次都超 600 s 轮询上限被脚本判 FAIL 退出，但 compose 仍在宿主后台跑；第一次 pip 层 `exit code 4294967295` 失败（同时刻宿主有兄弟会话的 `docker builder prune -f --keep-storage 1GB` 在跑、load 25、mem_avail 98 MB；FAIL 现场的 `other_builds=2` **R468 勘误**：那是本次部署自己的 `bash -c 'docker compose up …'` 包装壳 + `docker compose` CLI 两个进程，`host_probe.sh` 的 pgrep 正则不区分本家/别家、也不计 `builder prune`，不是「另有 2 个 build」），第二次 17 分钟后 rc=0 容器 00:48:06Z 起。脚本中止后 **4c CF Pages 部署 / 5 bundle 校验 / 6 回归 没跑**——线上 `/` 仍指旧 bundle `index-CbCTdalC.js` 而后端已是 `a49b52c`，手工补跑 4c（`wrangler pages deploy` → `9c6bdd6c.kaogong-h5.pages.dev`）后 5 s 内 `/` 切到 `index-D6cTFb18.js`，5b 五种 `Accept-Encoding` 全 `application/javascript`，6/6 回归 7/7 200，perf 一次全 OK（`/` 0.93 / LCP 2772 / CLS 0.06；`/tiku/` 1.00 / LCP 961）。
6. 到期项无增量（§4）；(c) R466 发版后 321 请求 `/assets/*` 404 0 / monitor 0（其中 R467 容器起后 47 请求）。WAL 仍 4,124,152 B、`ckpt_seq 1`（R466 高水位复用结论维持）。

## 2. 本地门 + 本地 dist 预检

- `npx vitest run` **657/657**（+7 源锁 `frontend-uni/tests/mainloop-r467-hitarea.test.js`：book 4 条 / home 3 条，含 `.tk-go` 反向锁）；`npx eslint src --ext .vue,.js` 0；`npm run build:h5` 绿（bundle `index-D6cTFb18.js`）。
- 本地 dist 预检（R464 法：`http.server 8765` + Playwright CDP，`/api/**` GET 转发生产带探针头、非 GET abort）：第一版 `.ann-x/.pbadge-hit/.mg-go` 命中带出现假阴性——目标在视口外或被相邻内容盖住时 `elementFromPoint` 落到别处；量测脚本改为先 `el.scrollIntoView({block:'center'})` 再取中心点后，`.ann-x/.mg-go` 全命中；`.pbadge-hit`（1440 +19）与 `.recap-h`（375 下半段）仍不命中 → 是真被下方内容盖住，加 `position:relative; z-index:1` 后命中，再建再测一致才部署。

### 2b. 部署时序一手（宿主 `deploy-kaogong-1`，UTC）

| 时刻 | 事件 |
|---|---|
| 00:10:51 | 第 1 次 `deploy_h5.sh --skip-build`：rsync 完成，远端 `compose up -d --build` 起；宿主 `mem_avail=438MB disk 2.4G(96%) load=4.64 other_builds=0` |
| ~00:13–00:16 | 镜像层缓存不在（`#8 apt-get` 从头跑 178.5 s、`#5` 113 s）→ 推断是此前/同期兄弟会话 `docker builder prune` 清掉了 kaogong 的层缓存 |
| 00:20:51 | 脚本 600 s 到 → FAIL 退出（线上仍 `7e2e2b3`，旧容器 healthy 未动）；现场 `mem_avail=293MB load=25.10 other_builds=2`（= 本次 compose 自身两进程，见 §1.5 R468 勘误） |
| 00:22:05 | 手工 ssh：`docker builder prune -f --keep-storage 1GB`（PID 653735，非本仓库任何脚本）与 compose 并存；`free` avail **98 MB**；`docker system df` 挂起 >3 min |
| 00:27:27 | compose 退出 **rc=1**：`#10 RUN pip install … did not complete successfully: exit code: 4294967295`（=-1，非 pip 自身退出码；内核 20 min 内无 OOM 行）→ 推断为 buildkit 构建被并发 prune / 资源压力打断 |
| 00:31:10 | 第 2 次 `deploy_h5.sh --skip-build`（盘 4.3G 91%、load 11.5、`other_builds=0`）；期间 ssh 一次 `Connection timed out during banner exchange`；`#10 pip` 313.5 s、`#11 COPY backend` 53 s |
| 00:41:10 | 脚本 600 s 到 → 再 FAIL 退出（`other_builds=2` 同为自身；另见 `docker builder prune` PID 678467） |
| 00:48:07 | compose **rc=0**（`#16` 导出 128.7 s、`#17` 18.9 s）；新容器 `StartedAt 00:48:06.92Z` healthy、`/api/health rev a49b52c` |
| 00:52 | 发现 `/` 仍 `index-CbCTdalC.js`（Pages 静态层未发）→ 手工跑 4c → `/` 5 s 内切 `index-D6cTFb18.js` → 5b / 6 / perf 全过 |

- 旧容器 `7e2e2b3` 在两次 FAIL 期间一直 healthy 对外服务（脚本先 build 再换容器），用户侧无中断；容器换入窗口本轮未取逐秒时序（R457 已有 5.5 s 基线）。
- 源站 (c) 窗口内非 2xx：`304 /sw.js` ×3、`304 /robots.txt`、`403 /` ×1（无边缘头直连，R388 口径）。

## 3. 生产复验（`a49b52c` + Pages `9c6bdd6c`，Playwright CDP 只读，`X-Kg-Probe: 1`，非 GET 全 abort → 无库写入；book 页用已知内部 uid `umst3tuisd7lgzaka` 27 张卡）

| 元素 | 375（`clientWidth` 360 仿真） | 1440（1425） |
|---|---|---|
| book `.seg-i` ×2 可见 | 30.4 → **40** / 命中 ±19 ✓ ±21 ✗；字 12px；`.seg` 43.8（父 44） | 33 → **40** / 同；`.seg` 44 |
| book `.pbadge-hit` ×2 | **40** / 命中 ±19 ✓ ±21 ✗；`.pbadge` 视觉 19.8、宽 146.4；`.mhead` **41.8**（时间折行，宽同改前） | **40** / 同；`.pbadge` 21；`.mhead` **21** |
| book `.mg-go` ×2 | 33.3 → **40** / ✓；`.mg-row` **57** | 35 → **40** / ✓；57 |
| book `.recap-h` | 18 → **40** / ✓（展开态卡 323.9） | 19 → **40** / ✓（收起态卡 44） |
| book `.recap-link` ×2 | **40** / ✓ | 未展开（脚本点击后 1440 侧栏卡未在 3.5 s 内展开，未取） |
| book `.kbd-more` | 桌面卡隐藏（h 0，预期） | 17 → **40** / ✓ |
| book `.sheet-x`（··· 弹层） | **40×40** / ✓；`.sheet-h` **28** | 同 |
| book 已达标对照 | `.op` 44 / `.filterbtn` 44 / `.loadmore` 94.7 / `.fab-main` 49.9 | 44 / 44 / 99 / 52 |
| home `.ld-x` | 22.7 → **40×40** / ✓；字 12.48px | 23 → **40×40** / ✓ |
| home `.ann-x` | 19.8 → **40×40** / ✓；`.ann` 106 | 20 → **40×40** / ✓；`.ann` 62 |
| home `.tk-row` ×2 | 52.3 / ±21 全 ✓（`.tk-go` 16 不动） | 55 / 同（`.tk-go` 17） |
| home 对照 | `.searchbar` 33.3（行 44）/ `.hero-btn` 44 / `.sec-more` 44 | 37 / 44 / 44 |
| 两页 `<11.9px` 叶节点 | `uni-tabbar__label` ×5 | **0** |

截图（375）：`r467_prod_book_375_top.png`（月复盘头/错因行/待掌握·已掌握·收藏 40 页签行）、`r467_prod_book_375_pbadge.png`（卷源徽标视觉 20px 药丸不变、`.mhead` 不抬）、`r467_prod_book_375_sheet.png`（··· 弹层 ✕ 40×40、标题行 28 不变）、`r467_prod_home_375_top.png`（首屏 ✕ / 公告 ✕ 40×40）。

## 4. 到期项（00:51Z，`a49b52c` 起后 3.5 min，严格 `WHERE probe=0`）

| 项 | R466 | R467 |
|---|---|---|
| `answer_log` probe=0 行/uid | 33/1 | 33/1 |
| `growth_events` probe=0 | 20/4 | 20/4 |
| `mistakes.error_reason` 非空 / ≥09-11 | 7 / 0 | 7 / 0 |
| `push_subs` / `weekly_reports` | 0 / 2 | 0 / 2 |
| `quick_check` | ok | ok |
| WAL | 4,124,152 B，`ckpt_seq 1` | **4,124,152 B 同字节，`ckpt_seq 1`**（头 `0000100000000001`）|
| 容器 | healthy restarts=0（23:50:21Z） | healthy restarts=0（**00:48:06Z** 重建，rev `a49b52c`；events 只此一次起动，健康检查 exec 正常）|
| (c) R466 发版后 origin（23:50Z 起） | 70 请求 | **321 请求**（R467 起后 47）`/assets/*` 404 0 / monitor 0 / 小程序 UA 0 |
| 宿主盘 | 93% / 3.7 G | 部署起点 **96% / 2.4 G** → prune 后 91% / 4.3 G → 复验时 **95% / 2.8 G** |

## 5. 未做 / 如实说明

- 375 为 360 仿真直读（11.52px = 24rpx 仿真差异），真机未量；无 testing agent 录屏（未另行授权）。
- 未在生产真实走到、按源码 + 本地 dist 同规则 + 源锁推断的态：book `.rf-alt`（强化卡）/ `.resume-drop`（续练放弃）/ `.manual-back`（换一份试卷）/ `.retry` / `.sim-row`（复习页）；home `.cb-go .cb-x`（续练横幅，需有未完成练习）。1440 `.recap-link` 未取到（侧栏卡展开时序），375 已取。
- `.tk-go` 16px 不改是有意的（外层 `.tk-row` 52 整行可点、`elementFromPoint` ±21 全命中）；`.searchbar` 33 是输入框在 44 行内，不按按钮口径。
- `.seg` 内边距 6→4rpx 与 `.seg-i` 40 让分段条从 36.2 抬到 43.8/44，但工具行本来就是 44（`.filterbtn`），整行高不变；`.pbadge-hit` 在 375 的 `.mhead` 41.8 是时间标签折行（徽标宽度与改前同 146.4），按宽度同值推断折行状态与改前一致，未取改前 `.mhead` 一手高度对照。
- `4294967295` 归因兄弟会话 `docker builder prune` / 资源压力是时序相关推断（并发 PID 一手、内核无 OOM 一手；buildkit 日志未翻）；`deploy_h5.sh` 600 s 上限在层缓存被清 + 宿主 load 25 下不够，脚本本身不在本轮改（只登记：中止后需手工续跑 4c/5/6，否则出现「后端新、`/` 静态旧」的半发版态——本轮已发生并在 ~4 min 内补齐）。
- 仍无可确认外部真人作答者、`WX_MINIAPP_SECRET` 未配、R385 第二冷样本未达标；`www.zalize.com` 证书 10-04 到期、宿主盘扩盘/迁出待定（本轮部署起点 96% / 2.4 G 是历轮最低水位）。
