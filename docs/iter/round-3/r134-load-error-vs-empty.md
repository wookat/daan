# R134：分包页加载失败误呈现为空态收口

## 取证（2026-08-31，生产一手）

方法：生产站预热壳后 `page.route('**/api/**', abort)` 模拟接口全挂，逐页直入 8 个分包路由（1440）。

结果（verified）：

| 页面 | 失败时呈现 | 问题 |
|---|---|---|
| /pkgA/social/plaza | 「还没有讨论」空态 | 失败≠无数据，误导用户以为全站无讨论 |
| /pkgA/stats/practice-history | 「还没有练习记录」空态 | 用户会以为练习记录丢失 |
| /pkgA/social/favorites | 「这里还没有收藏」空态 | 用户会以为收藏被清空（笔记 tab 同理） |
| /pkgA/exam/list | 「暂无成套真题卷」空态 | 误导为题库无卷 |
| /pkgA/exam/contest | 「暂无比赛场次」空态 | 误导为无赛事 |
| /pkgA/stats/weekly-report | 「加载失败 + 重试 ›」 | ✅ 正确参照 |
| /pkgA/stats/mastery-map | 「加载失败：request:fail」 | ✅ 有错误态 |
| /pages/stats/calendar | 本地 pstats 降级 | ✅ 既定降级设计，不立项 |

共性根因：`catch` 只 `uni.showToast`（约 1.5s 即消失），随后 `loaded=true`/`loading=false` → 模板按「无数据」渲染空态。toast 消失后失败态无任何驻留痕迹、无重试出路。

## 方案

对 5 个页面统一按 weekly-report 模式补驻留错误态：

- data 增 `loadErr: ''`；load() 开头清空、catch 时置 `e.message`（保留 toast）。
- 模板在空态分支前插入 `v-else-if="loadErr"` 错误卡：「加载失败 + {{loadErr}} + 重试 ›」，点击重跑 load()。
- favorites 两个 tab（收藏/笔记）共用 `loadErr`，重试按当前 tab 重载。
- 零后端/零边缘改动；成功路径行为不变。

## 验收

- 本地 lint/vitest/build:h5 全绿。
- 生产部署后复跑取证脚本：5 页失败态均出现「重试」且不再渲染空态文案；放行 API 后点重试原位恢复数据。
- 1440/375 双视口、console 0 error、无横向溢出。
