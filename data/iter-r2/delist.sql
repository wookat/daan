-- iter-r2 delist
BEGIN;
UPDATE questions SET disabled=1 WHERE id=388817; -- T1 验算命中他项
UPDATE questions SET disabled=1 WHERE id=568209; -- T1 验算命中他项
UPDATE questions SET disabled=1 WHERE id=571477; -- T1 解析不可用
UPDATE questions SET disabled=1 WHERE id=585473; -- T1 二审不一致
UPDATE questions SET disabled=1 WHERE id=586175; -- T1 解析不可用
UPDATE questions SET disabled=1 WHERE id=592838; -- T1 二审不一致
UPDATE questions SET disabled=1 WHERE id=648447; -- T1 验算命中他项
UPDATE questions SET disabled=1 WHERE id=648716; -- T1 验算命中他项
COMMIT;
