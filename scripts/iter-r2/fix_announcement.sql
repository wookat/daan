-- 迭代轮2 修复项5：首页欢迎横幅公告文案与迷你模考入口卡统一（30 题 · 30 分钟）
-- 生产执行（由父会话部署时跑）：sqlite3 /data/data.db < fix_announcement.sql
UPDATE announcements
SET body = replace(body, '迷你模考（25题20分钟）', '迷你模考（30 题 · 30 分钟）')
WHERE body LIKE '%迷你模考（25题20分钟）%';
