# R286：真题卷 SSR 详情 CTA 直达目标卷——卷库列表 ?pid= 定位深链

## 取证（生产 + 源码实查）

- R283 挑战分享 / R284–R285 社会证明把流量导向 `/tiku/papers/{pid}` SSR 详情页，但该页 CTA「在线模考本卷」只带 `?year=&region=`（R278），落到卷库列表后被挑战者需在同年同地区多卷（生产实查 2022 年 6 卷）中自行找到目标卷——挑战闭环最后一跳断链。
- `exam.vue` 已支持 `?paper_id=` 直接开卷，但 onLoad 即建 attempt 并起倒计时，外链冷落地直接开考对用户是突袭，不采用。
- `list.vue` 已有 `parseExamListOpts` 白名单深链模式（R277 year/region），扩展成本最小。

## 方案

1. `exam-list-url.js`：`parseExamListOpts` 增 `pid`（正整数校验，非法为 0）；`buildExamListUrl` 不产出 pid（pid 是一次性落地定位参数，不进出向同步，避免筛选变更后残留误导）。
2. `list.vue`：onLoad 暂存 pid，列表真实数据返回后若含该卷则置 `pinnedId`——目标卷卡片高亮描边 + 「邀你挑战的卷」角标 + scrollIntoView 定位；列表不含该卷（如被年份筛选过滤）不生效不报错。用户任何筛选操作即清除 pinned 态。
3. SSR `pages.py`：详情页 CTA `_exam_list_query` 追加 `pid={pid}`。
4. 隐私/边界：pid 是公开卷 id，无个人数据；`kind=zhenti` 边界不变；不新增路由/API。

## 验证

- vitest：parse pid 合法/非法/缺省；build 不产出 pid。
- 生产：SSR 详情 CTA 带 pid → 点击落地列表目标卷高亮定位；非法 pid 与无参一致；1440/375 双视口、溢出 0、console 0 error、性能预算。
