-- 数量关系模块逐题人工质检 fixes（答案修正 + tag3 重归档）
-- 由父会话确认后在生产执行
BEGIN TRANSACTION;
UPDATE questions SET tag3='SL-PL-01' WHERE id=236570; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JH-02' WHERE id=244790; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-01' WHERE id=260976; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET answer='C' WHERE id=262318; -- 人工验证原答案错误
UPDATE questions SET answer='A' WHERE id=264307; -- 人工验证原答案错误
UPDATE questions SET answer='C' WHERE id=264588; -- 人工验证原答案错误
UPDATE questions SET answer='C' WHERE id=264604; -- 人工验证原答案错误
UPDATE questions SET answer='C' WHERE id=264917; -- 人工验证原答案错误
UPDATE questions SET tag3='SL-PL-02' WHERE id=274522; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-RC-02' WHERE id=284136; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-06' WHERE id=286269; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-XC-01' WHERE id=286416; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-05' WHERE id=332364; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-01' WHERE id=333703; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JH-01' WHERE id=334045; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-05' WHERE id=896385; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-03' WHERE id=896387; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-03' WHERE id=1046839; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-GC-04' WHERE id=1046840; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-02' WHERE id=1046841; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-04' WHERE id=1046842; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-03' WHERE id=1046843; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZZ-02' WHERE id=1046844; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-01' WHERE id=1046845; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-XC-02' WHERE id=1046847; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-TC-01' WHERE id=1046848; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-05' WHERE id=1046849; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046850; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-03' WHERE id=1046851; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-04' WHERE id=1046852; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-01' WHERE id=1046853; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-07' WHERE id=1046854; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046855; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-01' WHERE id=1046856; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-QT-01' WHERE id=1046857; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-01' WHERE id=1046860; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-06' WHERE id=1046861; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-02' WHERE id=1046862; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-03' WHERE id=1046863; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JH-02' WHERE id=1046864; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZQ-01' WHERE id=1046865; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JH-02' WHERE id=1046866; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046867; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046868; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-03' WHERE id=1046869; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046870; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-XC-05' WHERE id=1046871; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046872; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-GC-02' WHERE id=1046873; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZZ-02' WHERE id=1046874; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-03' WHERE id=1046875; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JH-02' WHERE id=1046876; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZQ-02' WHERE id=1046877; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-GC-01' WHERE id=1046878; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-05' WHERE id=1046879; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-QT-01' WHERE id=1046880; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-RC-01' WHERE id=1046881; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-03' WHERE id=1046883; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-01' WHERE id=1046885; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-04' WHERE id=1046886; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-GC-02' WHERE id=1046887; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZZ-02' WHERE id=1046888; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-01' WHERE id=1046889; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-03' WHERE id=1046890; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-01' WHERE id=1046891; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-05' WHERE id=1046892; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-06' WHERE id=1046893; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-01' WHERE id=1046894; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-TC-02' WHERE id=1046895; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-02' WHERE id=1046896; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-RC-02' WHERE id=1046897; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-QT-02' WHERE id=1046898; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZZ-01' WHERE id=1046899; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-01' WHERE id=1046900; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-01' WHERE id=1046901; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ND-01' WHERE id=1046903; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZQ-03' WHERE id=1046904; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-PL-07' WHERE id=1046905; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-03' WHERE id=1046906; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-03' WHERE id=1046907; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-SZ-02' WHERE id=1046908; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-GC-01' WHERE id=1046909; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JJ-03' WHERE id=1046910; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-GC-01' WHERE id=1046911; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-XC-01' WHERE id=1046912; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-ZQ-01' WHERE id=1046913; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-03' WHERE id=1046914; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET tag3='SL-JS-02' WHERE id=1046915; -- 人工重归档（原 tag3 缺失/无效）
UPDATE questions SET answer='C' WHERE id=1272206; -- 人工验证原答案错误
UPDATE questions SET answer='D' WHERE id=1272268; -- 人工验证原答案错误
UPDATE questions SET answer='B' WHERE id=1272365; -- 人工验证原答案错误
COMMIT;
