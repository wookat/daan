# 轮32：发现线 + 留存（错题复习闭环入口强化）

分支：devin/1786279951-r31-growth（PR#105），代码提交 940afa5。

## 1. H5 错题复习闭环入口（本轮改动）

改动文件（仅 H5 + 后端埋点白名单，小程序/Flutter 未动）：
- `frontend-uni/src/pages/home/home.vue`：hero 下方新增蓝色「今日到期复习 N 题」卡片（`plan.due_mistakes>0` 时显示），点击埋点并跳转错题本自动开始复习；宽屏下卡片占满整行。
- `frontend-uni/src/pages/practice/practice.vue`：练习完成页（非背题模式）提交成绩后调用 `/api/review` 拉取到期数，>0 时显示「今日还有 N 题到期待复习」引导条。
- `frontend-uni/src/pages/book/book.vue`：原到期复习卡片点击补充埋点；`onShow` 消费 `autoStartReview` 标记，加载到期题后自动进入复习流程。
- `backend/app/team.py`：`/api/track` 事件白名单加入 `review_entry_click`。

埋点：`review_entry_click`，source 取值 `home_card` / `practice_done` / `book_card`，写入 growth_events。

## 2. 部署

本机 `npm ci && npm run build:h5` → rsync H5 产物与 `backend/app/team.py` 到生产 → `docker compose up -d --build` 重建 deploy-kaogong-1。
回归：/api/stats、/indexnow-key.txt、/robots.txt、/sitemap.xml、/tiku/q/273028、/api/questions、/api/review 均 200；/api/track 接受 review_entry_click（返回 {"ok":true}）。

## 3. QA 回归（生产实测，375px + 桌面，录屏）

全部通过，P0/P1/P2 = 0：
- SEO 详情页 /tiku/q/273028、261854、386530：375px 与桌面「花生十三讲解」+「原解析」分节渲染正常，无横向溢出、无乱码。
- IndexNow key 路由：/indexnow-key.txt 200，32 位 hex。
- H5 核心路径：新匿名用户 首页→常识判断练习10题（错2）→讲解卡正常→练习完成页出现「今日还有 2 题到期待复习」引导条→点击 track 200(source=practice_done) 并自动进入复习；首页蓝卡出现→点击 track 200(source=home_card)；错题本卡片点击 track 200(source=book_card)，复习完成 2/2 后「下次复习：1 天后」、待复习清零、首页蓝卡消失。
- 三处入口均实测触发 POST /api/track 200，payload source 正确。

测试数据已清理（先 VACUUM INTO /data/bak_r32_qa.db 备份）：uid umsltn9qextqg7vmy 的 mistakes 2 / answer_log 10 / review_log 2 / growth_events 3 条全部删除，清理后 /api/stats 200。

## 4. 全站健康快扫

- active 在架：112,971（不变）
- 四模块 hs 空缺：2（334296、655861，即轮29保留的存疑台账题）
- hs 结论字母 vs answer 不一致：0
- options 非 JSON：0
- 题干/选项 (cid: 乱码残留：0

## 5. 遗留 / P2

- sitemap 无 lastmod（questions 无逐题更新时间字段，沿轮31 P2）。
- 首页蓝卡在桌面宽度的全宽样式因复习清零未单独可视验证（代码已含 grid 整行规则），属条件性未覆盖小项。
- 埋点后续观察：growth_events 中 review_entry_click 按 source 分布，用于评估三入口触达与复习完成率。
