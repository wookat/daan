# R246 设计：搜索素材命中直达具体素材（mid 深链置顶）

## 取证（verified）
- R244 搜索素材命中点击后跳 `?tab=m&mtype=<type>`，只到类型过滤列表首页（20 条/页）。生产「政策理论」73 条：命中项若在第 2+ 页，用户需连点「加载更多」逐条翻找——搜索直达断在最后一跳。
- `/api/shenlun/materials` 仅支持 topic/type/limit/offset，无按 id 取单条能力。
- 本轮 origin 复审计无新缺陷：近窗口 5xx/慢样本与 deploy-history.log/container-events.log 部署重建时刻逐条对时吻合（lb_try 排队与 SWR 回源设计行为），容器 RestartCount=0/OOM=false。

## 方案
- 后端：`db.shenlun_materials` 增可选 `mid` 参数（`AND id=?`，disabled 守卫不变）；`/api/shenlun/materials` 增可选 `id` 查询参数透传。既有调用零变化。+1 例 pytest（按 id 取单条 / 下架 id 取不到）。
- 搜索页：`goShenlunMat` 追加 `&mid=<id>`。
- 申论页：`onLoad` 纯数字校验 `opts.mid`；素材列表加载后若命中项不在当前页则按 id 拉取单条置顶（带「搜索命中」角标，列表内按 id 去重），并自动展开全文（expanded=mid）。

## 不做
- 不做素材详情页/SSR/SEO 变化；不改列表排序语义（置顶仅 mid 深链会话内生效）。

## 验证
- 本地：backend ruff/pytest/pyright + frontend lint/vitest/build。
- 生产：搜索命中一条 offset>20 的素材 → 点击直达素材 tab 置顶展开；无 mid 行为与 R244 一致；1440/375 溢出 0、console 0 error、性能预算。
