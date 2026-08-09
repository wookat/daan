# 轮42：部署加固 + 高杠杆改进实施

日期：2026-08-09（UTC）。分支 devin/1786294310-r38-weak（PR#110）。

## 0. 开工即发现并处置的 P0：生产 deploy/.env 丢失

- 根因：轮40 部署用 `rsync --delete` 同步 `deploy` 目录时，把生产 `deploy/.env`（不在 git 中）连带删除；轮41 重建容器后生效——容器内 ADMIN_TOKEN / INDEXNOW_KEY / LLM_API_KEY / ACCESS_CODE / IMPORT_TOKEN 全部为空。
- 影响：/indexnow-key.txt 404、后台令牌登录失效、AI 生成功能降级；核心练习/题库/SEO 页面不受影响（ACCESS_CODE 为空=不启用门禁，IMPORT_TOKEN 为空=导入接口关闭，风险可控）。
- 处置：服务器与本机均无 .env 备份，无法找回旧值。
  - ADMIN_TOKEN、INDEXNOW_KEY：服务器上以 `openssl rand -hex 16` 重新生成并写回 `deploy/.env`（umask 077，另备份至部署目录之外的 `~/.kaogong.env.bak`），重建容器后验证：正确令牌 200 / 错误令牌 401，/indexnow-key.txt 200 且与 .env 一致（IndexNow key 无需向引擎注册，换新 key 即可）。
  - LLM_API_KEY（及 text/rescue 系列）、ACCESS_CODE：需老板重新提供，已上报。缺失期间 AI 相关功能降级。
- 防复发（已固化进部署脚本）：rsync 增加 `--exclude '.env'`；部署前预检生产 `deploy/.env` 非空；重建后校验容器 ADMIN_TOKEN 非空，任一失败即中止。

## 1. 部署脚本固化：deploy/deploy_h5.sh

六步：①本机 `npm run build:h5` → ②生产 .env 预检 → ③`rsync -azR --delete`（backend/deploy/frontend/knowledge/frontend-uni/dist，排除 .git/__pycache__/node_modules/.env）→ ④远程 `docker compose up -d --build` + 容器 ADMIN_TOKEN 非空校验 → ⑤线上 bundle 校验（线上 index.html 引用的 `index-<hash>.js` 必须与本机构建一致，且线上 home chunk 必须存在于本机产物）→ ⑥接口回归清单（/api/stats、yanyu/changshi 抽题、/tiku/、/robots.txt、/indexnow-key.txt、/admin 全部须 200）。

- rsync 采用 `-R` 保留相对路径，确保 `frontend-uni/dist` 落到远端正确位置供 Docker 构建取用（不带 `-R` 时 `rsync frontend-uni/dist` 会落到远端根目录 `dist/`，是「假上线」的一类成因）。
- 本轮部署即用此脚本完成，全部 6 步通过，本机与线上 bundle 均为 `index-WgOpEAD3.js`，回归 7 项全 200。

## 2. 高杠杆项选择与实施（从 r39/r41 建议清单）

选择理由：Bing Webmaster Tools 需老板账号/DNS 授权（排除）；召回转化观测需自然流量积累（暂无输入）。选定零外部依赖、当轮可闭环的两项：

### 2a. 16 条引号撞重题去重裁定（内容治理收尾）

对轮40 跳过的 16 条「规范化后与既有题 UNIQUE 撞重」在架题逐对人工比对（题干/选项/答案/解析/hs/禁用状态/历史作答量）：

- 16 条源题历史作答量全部为 0，全部与对应撞重题为同一知识点的语义重复题（选项措辞/顺序不同但考点与正确事实一致）。
- **9 条下架**（撞重对象在架且内容更规范，保留对象、下架冗余源题）：388632、388953、395661、395915、396459、405472、413222、413392、419785。
- **7 条保留在架**（撞重对象已下架，源题是该考点唯一在架版本；题干中 `“‘X’”` 叠加引号仅为外观问题，不影响作答）：397443、398098、412285、413221、413370、426831、434736 —— 记入台账为永久例外。
- 顺带发现并修复 1 条 P1：保留题 188956（日月潭）hs 讲解正文字母错乱（正文写「A正确…排除C」而正确答案为 C=台湾省），已重写为字母正确版本。

流程：新鲜快照 → dry-run（9 条下架+1 条 hs 修复全部命中）→ 生产备份 `/data/bak_r42_dedup.db` → 守卫事务（`where id=? and disabled=0` 等，行数不符即回滚）→ 复核：active 112,971→112,962，9 条线上 404，188956 修复后正常渲染。

### 2b. access log 周报统计脚本：scripts/access_log_report.py

解析 Caddy JSON access log，输出：时间范围、总请求、/tiku/ 请求量（含其中爬虫量）、UA 三分类（搜索引擎爬虫/其他 bot 含自测 curl/疑似真人）、引擎与 bot 明细、状态码分布、/tiku/ Top20 URL。支持文件或 stdin（`ssh <host> 'cat …access.log*' | python3 scripts/access_log_report.py -`）、`--days N` 窗口。内置 11 家搜索引擎 UA 识别（Bing/Google/Baidu/Yandex/Sogou/360/ByteDance/DuckDuckGo/Apple/Petal/Yisou）。

本轮实测（当前日志窗口）：总请求 120、/tiku/ 16、搜索引擎爬虫 0、其他 bot 43（curl 33+python 10，均为自测）、疑似真人 77（亦为自测浏览器）。与轮41 结论一致：尚无真实爬虫流量。

## 3. 健康快扫

- active 112,962（=112,971 − 本轮下架 9）
- 四模块 hs 空缺：仅 655861、334296（已知台账存疑题）
- options 非 JSON：0；(cid: 乱码：0
- 题干含 `“‘`（在架）：467 = 460 合法嵌套 + 7 条本轮裁定保留的永久例外

## 4. 遗留

- LLM_API_KEY / ACCESS_CODE 待老板补发后写入生产 `deploy/.env` 并重建容器。
- IndexNow key 已更换，后续批量提交自动使用新 key，无需额外操作。
- 真实爬虫流量仍为 0，建议每周用 2b 脚本出观测报告。
