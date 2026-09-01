# R173：部署脚本 5/5b 校验容忍 Pages 传播窗口（轮询重试）

## 取证（2026-08-29，一手证据）

连续两轮部署，`deploy/deploy_h5.sh` 的部署后校验在 CF Pages 新部署传播窗口内单次探测误报 FAIL：

- R171 部署：step 5b 变体校验一次打印全部 `text/plain` 并 exit 1；随即人工 7 编码变体 curl 复测全部 `application/javascript`（含 gzip/br content-encoding 正确）。
- R172 部署：step 5 bundle hash 校验取到旧 bundle `index-XULKivM7.js` 并 exit 1；约 20s 后同一 URL 复测返回新 bundle `index-DdQa75Tq.js`，preview 域同为新 bundle。

根因：`wrangler pages deploy` 返回「Deployment complete」只代表上传/发布完成，别名域（kaogong.zalize.com）切到新版本存在数秒到数十秒的传播窗口；期间边缘仍可能命中旧部署（旧 HTML 或对新 asset 路径返回回退响应）。脚本 5/5b 均为单次探测、命中窗口即误报，且 5b 误报会在 5 已通过后再次中断，留下「部署实际成功但脚本 FAIL」的假红，后续轮次需要人工复核浪费一轮排查（R171/R172 各一次）。

## 方案

不改变校验语义（该抓的投毒/未生效仍要抓），只把「单次探测」改为「窗口内轮询直至通过或超时」：

- 新增 `retry_check <deadline_s> <fn>`：循环调用校验函数，通过即返回 0；未过则 sleep 5 重试，超时返回 1。
- step 5（bundle hash）：单次比对抽成 `check_bundle()`，`retry_check 120` 包裹；超时才 FAIL exit 1。home chunk 存在性校验保持在 hash 收敛后单次执行（同一部署内一致）。
- step 5b（编码变体）：7 变体循环抽成 `check_encodings()`（全部 `*javascript*` 才算过），`retry_check 120` 包裹；每轮重试打印当前各变体 content-type 以便超时后留证。
- 传播成功路径零等待：首轮探测即过则与现行为完全一致，不增加部署时长。
- 真正的投毒/未生效（>120s 仍错）仍然 FAIL exit 1，误报窗口被消除、漏报语义不变。

不改动：构建、rsync、容器重建轮询（step 4 已是轮询收敛）、预热、step 6 回归。

## 验收

- bash -n 语法检查通过；
- 对生产现状（已收敛的部署）直跑 5/5b 校验函数：首轮即过，行为与旧脚本一致；
- retry 路径单元验证：用临时 stub 函数模拟「前 N 次失败后成功」与「一直失败」，确认 retry_check 分别返回 0/1 且超时受控。
