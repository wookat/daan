-- 图片专项审计：引用图示但无图且文字不足以作答 → 下架。
BEGIN TRANSACTION;
-- id=246793 (changshi): 电路连接方式（串/并联拓扑）仅见于图，文字未描述，无法判断各选项
UPDATE questions SET disabled=1 WHERE id=246793;
-- id=321565 (changshi): 小球初始位置、木块几何形状仅见于图，文字不足以作答
UPDATE questions SET disabled=1 WHERE id=321565;
-- id=321955 (changshi): 小球相对桌面的运动轨迹曲线仅见于图（俯视图），无轨迹即无法判断
UPDATE questions SET disabled=1 WHERE id=321955;
COMMIT;
