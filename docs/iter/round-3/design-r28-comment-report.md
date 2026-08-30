# R28 设计方案：讨论区评论举报 + 阈值自动隐藏

## 1. 取证（生产现状）

- 生产 discuss 页（pkgA/social/discuss.vue）评论操作只有 赞 / 回复 / 删除(仅本人)，无任何举报入口（grep「举报」0 命中）。
- 后端 social.py 只有本人删除与管理端删除；违规内容只能靠发布时敏感词表拦截，发布后无人工/群体反馈通道。
- 竞品标尺：粉笔/夸克讨论区每条评论均有「举报」入口（理由选择→提交→提示已受理），且被多人举报的内容会被隐藏待审核。这是 UGC 社区合规的基础能力（社区公约卡里也承诺「违规内容将被删除」，但用户无路径触发）。

## 2. 方案

### 后端（social.py，新增表 + 2 个接口）

新表（init_social_db 内 CREATE TABLE IF NOT EXISTS，附带既有库自动建表，零迁移脚本）：

```sql
CREATE TABLE IF NOT EXISTS comment_reports (
  comment_id INTEGER NOT NULL,
  uid TEXT NOT NULL,
  reason TEXT,
  created_at REAL NOT NULL,
  PRIMARY KEY (comment_id, uid)
)
```

`POST /api/comments/{cid}/report`（需登录，与点赞同模式）：
- require_user + user_uid；rate_limit `cmt_report:{uid}` 10 次/10 分钟；
- 评论不存在或已删除 → 404；举报自己的评论 → 400；
- reason 取白名单 {"广告导流","人身攻击","违法违规","色情低俗","其他"}，非法值归"其他"；
- INSERT OR IGNORE（同一用户重复举报幂等，返回 already=true）；
- 统计该评论去重举报人数，≥REPORT_HIDE_THRESHOLD(3) 时置 `status='hidden'`（likes 等保留，审核可恢复）；
- 返回 {ok, already, hidden}。

`GET /api/admin/comment-reports`（x-admin-token）：按评论聚合返回举报数、理由分布、评论内容与状态，供管理端复核；`api_admin_comments` 的 status 白名单加入 "hidden"。

展示语义：_comment_payload 对 status='hidden' 显示「该评论已被举报，待审核」（deleted 仍显示「该评论已删除」）；顶层被隐藏时保持占位不折叠楼中楼（与 deleted 现行为一致——现行为顶层 status!='ok' 直接从列表剔除，保持不变，hidden 同样剔除，楼中楼同）。

### 前端（discuss.vue + api.js）

- api.js 新增 `reportComment(cid, reason)`。
- 每条评论/楼中楼操作行新增「举报」（非本人时显示；本人显示删除）；点击弹 uni.showActionSheet 选理由 → 提交 → toast「已收到举报，我们会尽快处理」；重复举报 toast「你已举报过这条评论」。
- 若返回 hidden=true，前端就地将该条内容替换为占位文案。

## 3. 不做

- 不做举报人通知/处理进度查询；
- 不做评论分页（当前每题评论量级小，全部返回 + 前端渲染无性能问题，留观察）;
- 不改敏感词表与发布拦截逻辑。

## 4. 验收标准（生产）

- 登录用户对他人评论可举报，选理由后提交成功且幂等；
- 第 3 个不同账号举报后评论自动隐藏，列表不再展示该评论；
- 举报自己的评论 400；未登录点举报走登录引导；
- admin comment-reports 可见聚合记录；
- 375/1440 无溢出、console 0 error，正常发布/点赞/回复/删除无回归。
