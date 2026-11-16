# 轮18：组队打卡 + 题目分享裂变

老板需求：组队一起刷题、查看队友今天有没有刷题；把刷出的题分享给队友作答并确认对错，以此实现分享/组队裂变。

## 后端接口（backend/app/team.py，前缀 /api）

### 小队

| 接口 | 方法 | 参数 | 说明 |
|---|---|---|---|
| `/api/team/create` | POST | `{uid, nickname, name}` | 创建小队，生成 6 位邀请码，创建者自动入队。返回 `{team}` |
| `/api/team/join` | POST | `{uid, nickname, code}` | 凭邀请码加入。已在队返回 `already:true`。满 20 人 / 已加 5 队报 400 |
| `/api/team/leave` | POST | `{uid, team_id}` | 退出小队；最后一人退出时删除小队 |
| `/api/team/mine` | GET | `?uid=` | 我的小队列表，返回 `{items, max_teams}` |
| `/api/team/{id}/panel` | GET | `?uid=` | 小队面板。**仅成员可见（403）**。每成员：`nickname / today_n / today_acc / streak / last_active / week[7]`（聚合 answer_log，本周一至周日做题数格子） |

限制：小队上限 20 人；一人最多同时加入 5 个小队；创建/加入均有 rate limit。

邀请链接：`https://kaogong.zalize.com/#/pages/team/join?code=XXX`（H5 免登录直达加入）。

### 题目分享

| 接口 | 方法 | 参数 | 说明 |
|---|---|---|---|
| `/api/share/create` | POST | `{uid, nickname, question_id, team_id?}` | 创建分享，返回 `{sid}`（8 位分享码） |
| `/api/share/{sid}` | GET | `?uid=` | 分享详情（题干+选项，可匿名打开）。**答案/解析/作答列表仅分享者或已作答者可见** |
| `/api/share/{sid}/answer` | POST | `{uid, nickname, picked, secs}` | 提交作答（匿名 uid 即可）。判对错、写 answer_log（source=share），返回答案+解析+全部作答 |
| `/api/share/{sid}/answers` | GET | `?uid=` | 作答列表（各人选项与对错）。未作答且非分享者 403 |

分享链接：`https://kaogong.zalize.com/#/pkgA/share/share-q?sid=xxx`。

### 裂变埋点

| 接口 | 方法 | 参数 | 说明 |
|---|---|---|---|
| `/api/track` | POST | `{uid?, event, source?, ref?}` | 事件白名单：`share_open / share_answer / team_join_open / register`，写 growth_events 表 |

source 归因：分享作答写 `answer_log.source='share'`；落地页「去刷同类题」带 `source=share/team`；注册转化上报 `register` 事件（source 取落地页写入的 regSource）。

### 表结构

- `teams(id, name, invite_code UNIQUE, creator_uid, created_at)`
- `team_members(team_id, uid, nickname, joined_at, PRIMARY KEY(team_id, uid))`
- `shared_questions(id, sid UNIQUE, question_id, from_uid, from_name, team_id NULL, open_count, created_at)`
- `shared_answers(share_id, uid, nickname, picked, correct, created_at, PRIMARY KEY(share_id, uid))`
- `growth_events(id, uid, event, source, ref, created_at)`

## H5 页面

- `pages/team/join`（主包，免登录落地页）：邀请码直达加入 → 成功后引导「看队友打卡 / 立刻刷 10 题打卡」
- `pkgA/team/team`：我的小队列表 + 创建/加入 + 小队面板（成员本周 7 天打卡矩阵、连续打卡、今日正确率、最近活跃；今日 0 题队友显示「提醒 TA」→ 复制催打卡文案+邀请链接）
- `pkgA/share/share-q`（免登录落地页）：先作答 → 揭示对错/答案/解析 + 大家的选择 → 「去刷同类题」+ 底部注册引导
- 入口：我的页「刷题小队」；练习页/错题详情题卡 q-social-bar「分享给队友」；错题本条目菜单「分享给队友」

## 测试记录（2026-08-09 本地实测）

后端 `uvicorn app.main:app --port 8300`，脚本共 26 项断言全部通过：

- 创建小队/生成邀请码/凭码加入/重复加入 already/无效码 404 ✓
- 我的小队/面板成员可见（today_n、week 格子正确）✓
- **uid 隔离：非成员看面板 403「仅小队成员可查看」；退出后同样 403** ✓
- 退出小队 ✓
- 创建分享/未作答者可见题干但**不泄露 answer/explanation 字段** ✓
- 匿名 uid 作答判对错/重复作答 409/分享者不能自答 ✓
- 作答列表：分享者与已作答者可见，未作答者 403 ✓
- 作答写 answer_log（source=share，picked/correct 正确）✓
- 埋点写 growth_events；非白名单事件 400 ✓

`ruff check backend/app/team.py` 通过（0 错误）；`npm run build:h5` 通过。
