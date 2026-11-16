# R425 · 首个有量 probe=0 设备逐页复盘 / 小程序 wxlogin 503 用户反馈 / 面试点评字数与总时长

日期：2026-09-06（服务器时间）。本轮**只取证、登记，不改代码、不部署**——三项起点均未取到支持改动的一手证据。

## 1. 设备 `umst3tuisd7lgzaka` 逐页复盘（caddy 全量 + DB 对账）

数据源：`/var/log/caddy/kaogong*.log{,.gz}` 全部 9 个文件按 IP `39.158.40.85` 或 uid 过滤（脚本 `~/r425_caddy.py`，输出 `~/r425_device_path.txt`，327 行），容器内 `sqlite3` 只读对账。

**客户端不是 H5 浏览器，是已发布的微信小程序**：Referer 全为 `https://servicewechat.com/wx01f2f29cfe51baba/0/page-frame.html`（appid 与 `miniapp-native/project.config.json` 一致），UA vivo V2405A Android WebView。到访分布：

| 日期 UTC | 请求 | 内容 |
|---|---|---|
| 08-14 15:31 | 42 | 首访 |
| 09-02 18:40–41 | 43 | 作答（`answer_log.probe=NULL`，R374 打标前口径） |
| 09-04 12:20 | 1 | 单次 |
| 09-06 00:10–11 | 43 | tab 巡览 + **wxlogin 503 ×1** |
| 09-06 08:34–36 | 50 | tab 巡览 + 资料 1 题 |
| 09-06 08:54–59 | 148 | **wxlogin 503 ×2** → 资料 10 题 → 综合 10 题 → 复习 1 题 → 错题标掌握 ×2 → 成长页 ×7 |

08:55–08:58 主链路（去掉 tab onShow 的 badges/profile/review/mistakes/favs/reminders 轮询）：

```
08:55:11 GET  /api/papers                     08:55:13 GET /api/growth
08:55:24 POST /api/auth/wxlogin 503 20ms      08:55:26 POST /api/auth/wxlogin 503 10ms   ← 2 s 内两次
08:55:29 GET  /api/questions?limit=10&module=ziliao
08:55:37 answer_log ×1 → 08:55:39 share/create + track
08:55:58–08:56:09 answer_log ×9 + mistakes ×7（间隔 1 s）→ practice_result
08:56:22 GET  /api/questions?limit=10（综合）→ 08:56:24–08:57:54 answer_log ×10 + mistakes ×8 → practice_result
08:58:03 POST /api/review/1952（复习答题）+ GET questions?limit=2&module=ziliao
08:58:21 PATCH /api/mistakes/2819   08:58:25 PATCH /api/mistakes/2815   （标已掌握）
08:58:29–08:59:05 GET /api/growth ×7
```

DB 对账：`answer_log` 20 行 08:55:37–08:57:54 与日志逐条对应（`picked` 全单字母、`probe=0`）；`mistakes` 2806–2819 共 14 行新建 + 1952 `review_count 0→1`（next_review 推到 +24h）；2815/2819 `mastered=1`（小程序错题页手动标掌握）；`error_reason` 该 uid 全 NULL；`users` 无 `wx:` 行（3 次登录全失败，账号未建）。所有 API 200、耗时 ≤0.66 s（唯一 >0.1 s 是 08:36:39 无模块随机抽题 0.66 s，同查询 08:56:22 为 0.08 s）。

**归因不变**：10 题 11 s、1 题/秒、20 题对 6，是「点过去」不是「做题」；R386 已登记同一台 vivo 为 MiniProgramEnv 走查设备 → 仍按**候选真人 / 内部走查**登记，不归因外部真人；不改 probe 标记。

## 2. 小程序对 `wxlogin` 503 的用户反馈

- 后端：`WX_MINIAPP_SECRET` 未配 → `HTTPException(503, "微信登录暂未开通（服务端未配置小程序密钥）")`（`backend/app/auth.py`）。
- 小程序请求层 `miniapp-native/miniprogram/utils/request.ts`：非 2xx 取 `res.data.detail` → `reject(new Error(detail || 'HTTP 503'))`；登录页 `pages/login/login.ts` `onWxLogin` catch → `setData({ err: e.message })`；`login.wxml` `<text wx:if="{{err}}" class="l-err">{{err}}</text>` 渲染。
- 结论（**源码推断，未在真机截图验证**）：用户能看到「微信登录暂未开通（服务端未配置小程序密钥）」原文，反馈可理解；2 s 内两次 503 更像连点/读完再点一次（`wxBusy` 只在请求在途时 loading，503 20 ms 返回后按钮立即可再点）。
- **不改**：① 根因是资源缺口 `WX_MINIAPP_SECRET`（R386 起已登记待老板提供），不是文案/交互；② 小程序端改动需微信开发者工具上传+审核发布，不在 `deploy_h5.sh` 管线内，本会话无法交付验证；③ 文案已是明确的「未开通」而非泛化「登录失败」。登记 P3：密钥到位后应在真机复验一次登录成功路径（`users` 出现 `wx:` 行）。

## 3. 面试点评 30–38 s 总时长是否该收字数

R424 容器内直连数据（pro 关推理，两次）：正文 2939 字 / 1787 completion token 用 38.0−6.6 = 31.4 s；2758 字 / 1666 token 用 30.2−1.8 = 28.4 s → 上游吐字 **57–59 token/s ≈ 95 汉字/s**。生产 SSE（R424 复验）：meta 后 1.3–1.6 s 出首字，随后 2386/2641/2998 字在 ~28–33 s 内流完，同一量级。

- 总时长 = 首字前（已由 R424 从 30–47 s 压到 1.3–4 s）+ 正文长度 ÷ 吐字速率；后者已是纯线性，无隐藏等待。
- 用户视角：流式渲染 95 字/s 远快于阅读速度（中文阅读 5–10 字/s），正文出到底之前用户仍在读前面段落，「总时长」不构成可感知等待；只有正文本身是否过长（2.7–3k 字点评 300 字作答）是产品问题。
- `_review_prompt` 无字数约束（三节：逐段点评 / 参考答题框架 / 提升建议）。生产 `interview_sessions` 有正文的会话全部是探针/走查 uid，**没有真实用户读点评的行为数据**（停留、滚动到底、再看一次）支持「太长」判断。
- **不改**：不据自己的观感收字数；登记 P3——待有 probe=0 面试会话后看点评页停留/滚动再定；若要收，改提示词加「全文 1200–1800 字」并保留三节结构，需重跑 R424 四变体质量对照。

## 4. error_reason（到期日 09-11）

未到期。该 uid 0 行；全局 `mistakes.error_reason` 非空 6 行经 uid 关联 `answer_log.probe` 全在 `probe=NULL`，`probe=0` 0 行（与 R423/R424 一致）。`mistakes` 表无 `probe` 列，只能经 uid 关联，口径不变。

## 5. 本轮未做 / 如实说明

- 无代码改动、无部署、无 testing agent 复验（无需）；本地 gate 不涉及。
- 小程序错误文案展示为源码推断，未真机截图。
- 设备归属仍待老板确认（若是老板/团队手机，可按 R418 方式回填 probe=1 并登记 uid；未确认前不动）。
- 宿主：load ~10、free ~76–100 MB、磁盘 94%/2.9 G（R424 末值，本轮未部署未变）。
