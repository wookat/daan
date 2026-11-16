# 轮99：无障碍与可用性线——WCAG AA 走查 + 超小屏/横屏快查

日期：2026-08-10。分支 devin/1786341111-r96（PR#123）。改动：frontend-uni/index.html、
src/App.vue、src/pages.json、src/pages/home/home.vue、src/pages/practice/practice.vue。
deploy_h5.sh 部署上线，bundle hash 一致、接口回归全 200，全程 JS console error 0。

## 1. H5 无障碍走查（axe-core 4.10 · WCAG 2A/AA · 375px 五页）

### 当轮修的 P1（4 处）

| 问题 | 修复 | 复验 |
|---|---|---|
| viewport `user-scalable=no, maximum-scale=1.0` 全站禁用捏合缩放（WCAG 1.4.4，axe critical） | index.html 改 `user-scalable=yes, maximum-scale=5.0` | axe meta-viewport 违规消失，线上 meta 已带 5.0 |
| 正文次级文字对比度不足：--ink-2 #7d818f (3.88:1)、--ink-3 #8f959e (3.02:1)，首页 37 处违规 | 浅色 tokens 加深为 #5f6575 (5.8:1) / #6b7280 (4.8:1)，深色态原本已达标（5.5:1）未动 | 首页 color-contrast 37→9、练习页 6→3（余为品牌色，见 P2） |
| tabbar 未选中文字 #8a90a0 (3.19:1) | pages.json tabBar color → #6b7280 | 该 4 处违规消失 |
| 练习页头部「···」工具按钮可点区域仅 24×18px | .fontbtn 加 ::after 扩展热区（视觉不变，热区约 58×54px） | 实测热区生效 |

另修：首页「今日更新」标签 #d97706/#fffbeb (3.07:1) → #b45309 (4.84:1)。

### P2 清单（照实列，不当轮动）

1. 品牌色 #3b6ff5 在白底 4.39:1（差 0.11 达标），首页/统计余 9-10 处违规均为此——改品牌
   色是全局视觉决策（含深色态 16 处同源），建议设计层面统一微调（如 #2f63e8 即 5.1:1）。
2. 装饰性 SVG 图标（l-icon data-uri img）无 alt，axe image-alt critical 24 处——组件级加
   `aria-hidden`/空 alt，需改 l-icon 封装，一次性小改立项。
3. 键盘可达性：uni-app H5 全 div/uni-view 渲染，Tab 无任何焦点停留（15 次 Tab activeElement
   均 body）、无焦点样式——键盘/读屏路径整体不可用，属框架级（需系统性加 tabindex/role/
   aria），照实立项为专项（工作量大，收益视目标用户读屏比例定）。
4. scrollable-region-focusable（body 可滚不可聚焦）与 3 同源。
5. 200% 文字缩放：站内字号为 px（rpx 编译）不随浏览器字体设置缩放；本轮 viewport 修复后用户
   可捏合放大到 500% 达到等效可读性（WCAG 1.4.4 放大路径已通）；文字级缩放跟随系统设置为
   框架级改造，列 P3。

## 2. 320px 超小屏与横屏快查

- 320×650：首页/练习/错题本/统计四页横向溢出 0（首页首测出现过一次 55px 瞬时溢出，稳定
  复测 0，判定为加载中间态非稳定缺陷），布局无断裂、截图留存。
- 横屏 740×360：四页横向溢出 0，内容可滚可用。

## 3. 例行 + health_scan（全绿）

- health_scan：active 113,304 / lt50 0 / badjson 0 / 乱码 0 / 推广残留 0 / hs_mismatch 0 /
  台账外空 hs 0（两条 intentional 未动）/ 卷内重复 0 / 低覆盖仅卷 112。
- 近 7 天：39 次 / 14 uid，growth 与基线持平。
- 爬虫 7 天：YandexBot 84（/tiku 80）+ bingbot 1（08-09）+ Baiduspider 1（08-10）；
  Bing 收录仍未破零、Baiduspider 未上量，站长验证仍是 P0 外部卡点。
- QA 清理：走查触发的 4 条 heatmap_view（QA uid umsmszssbd151j0am）已删，残留 0。

## 4. 结论

4 处 P1 当轮修复上线并 axe 复验通过；剩余违规集中在品牌色 0.11 差距与框架级键盘/读屏能力，
已按性价比列 P2/P3。320px 与横屏无缺陷。
