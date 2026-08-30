# R62：首页 uid 请求聚合 /api/home_bundle——首屏 4–5 个 uid 请求合并为 1 个

## 背景与取证（2026-08-29 生产实测）

首页 onShow 实测发出 6 个 API 请求，其中 4 个 uid 专属、每个都必须穿透到共享 2GB origin
（1440 生产抓包）：

- `/api/announcement`、`/api/question_counts`：已边缘缓存（R56/R59，X-Edge-Cache 命中）；
- `/api/daily_plan?uid=`、`/api/profile?uid=`、`/api/checkin/badges?uid=`、
  `/api/checkin/summary?uid=`：各自独立穿透 origin；
- 已设置画像的用户 profile 返回后还会追发第 5 个 `/api/plan/today?uid=`（串行）；
- loadBadges 内 badges→summary 也是串行 await，两次 origin 往返；
- R61 RUM 实证 origin 长尾（daily_plan:45s、categories:21s、questions:13.5s）：
  首屏发 4–5 个独立 origin 请求 = 4–5 次抽中长尾的机会。

DB 层无问题（R62 前置排查）：answer_log 1275 行、idx_al_uid 覆盖索引、
daily_plan 单查 0.002s——慢的是共享宿主机的请求级长尾，不是 SQL。
减少请求数是当前边界下最有效的暴露面收敛。

## 方案

### 后端（study_api.py，零 schema 变更）

```python
@router.get("/api/home_bundle")
def api_home_bundle(uid: str):
    u = uid[:64]
    profile = db.get_user_profile(u)
    return {
        "plan": db.daily_plan(u),
        "profile": profile,
        "plan_today": plan.today_plan(u) if profile else None,
        "badges": api_checkin_badges(u),      # 复用 social.py 既有 handler 函数
        "summary": api_checkin_summary(u),
        "counts_ver": None,  # 预留
    }
```

- 各子结构与既有独立端点响应逐字段一致（直接调用同一函数）；
- 独立端点全部保留，旧客户端/其他页面零影响；
- uid 专属故不进边缘缓存清单（与 R56 设计一致）。

### 前端（home.vue）

onShow 改为先请求一次 `/api/home_bundle`，成功则分发到 plan/profile/planToday/
badgeInfo/svTodayN 既有状态（沿用各 loader 的后处理逻辑）；bundle 请求失败时
回退调用原 loadPlan/loadProfile/loadBadges（渐进增强，部署窗口新前端旧后端也不坏）。

## 验收标准

1. 后端本地实测 bundle 各子结构与独立端点响应逐字段一致；
2. 生产首页抓包：uid 请求 4–5 个 → 1 个（/api/home_bundle），
   任务卡/今日计划/连签徽章/tabbar 角标渲染与改前一致；
3. bundle 失败回退路径实测可用（本地拦截 bundle 请求返回 500）；
4. 1440/375 console 0 error、无水平溢出；
5. build:h5 全绿、部署 hash 一致。

## 验收结果（待部署后回填）
