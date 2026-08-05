-- PR#45 后续：21 条 UNIQUE(questions.question) 冲突 fixes 的逐条人工裁定（父会话统一执行）
-- 结论：17 条为真重复（同题同选项同答案）→ 下架本题保留库内同文题；2 条为答案冲突的重复 → 保留同文题并修正其答案；2 条非重复（题干过泛撞文）→ 改用不冲突的修复文本。

-- 一、真重复 / 答案冲突重复：下架（19 条）
-- id=260744: 与 236357 同题同选项同答案（C），保留 236357（题干干净、解析完整）
UPDATE questions SET disabled=1 WHERE id=260744 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262230: 与 288278 同题同选项同答案（B），保留 288278
UPDATE questions SET disabled=1 WHERE id=262230 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262233: 与 288282 同题同选项同答案（D），保留 288282
UPDATE questions SET disabled=1 WHERE id=262233 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306211: 与 240363 同题同选项同答案（A），保留 240363
UPDATE questions SET disabled=1 WHERE id=306211 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306212: 与 240351 同题同选项同答案（D），保留 240351
UPDATE questions SET disabled=1 WHERE id=306212 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306213: 与 240354 同题同选项同答案（B），保留 240354
UPDATE questions SET disabled=1 WHERE id=306213 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306214: 与 240361 同题同选项同答案（A），保留 240361
UPDATE questions SET disabled=1 WHERE id=306214 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306215: 与 240355 同题同选项同答案（C），保留 240355
UPDATE questions SET disabled=1 WHERE id=306215 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306216: 与 240357 同题同选项同答案（B），保留 240357
UPDATE questions SET disabled=1 WHERE id=306216 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319228: 与 253394 同题同选项同答案（A），保留 253394
UPDATE questions SET disabled=1 WHERE id=319228 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319229: 与 298220 同题同选项同答案（A），保留 298220
UPDATE questions SET disabled=1 WHERE id=319229 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=321519: 与 297273 同题同选项同答案（A），保留 297273
UPDATE questions SET disabled=1 WHERE id=321519 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046537: 与 1046573 同题同选项同答案（D），保留 1046573
UPDATE questions SET disabled=1 WHERE id=1046537 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046564: 与 241505 同题同选项同答案（C），保留 241505
UPDATE questions SET disabled=1 WHERE id=1046564 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046581: 与 241419 同题同选项同答案（C），保留 241419
UPDATE questions SET disabled=1 WHERE id=1046581 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046585: 与 241502 同题同选项同答案（A），保留 241502
UPDATE questions SET disabled=1 WHERE id=1046585 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046586: 与 241749 同题同答案（A）且本题选项串题损坏（B 混入 D 文本、D 为卷面小节标题），保留 241749
UPDATE questions SET disabled=1 WHERE id=1046586 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262231: 与 261667 同题同选项，答案冲突人工裁定为 A（海上丝路非陆上丝路的补充形式；马可·波罗确经海路回国、B 正确；C 表述为通行说法），保留 261667 并修正其答案 C→A
UPDATE questions SET disabled=1 WHERE id=262231 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262232: 与 261668 同题同选项，答案冲突人工裁定为 B（胡夫金字塔为现存最大；《理想国》作者是柏拉图、罗马帝国 395 年分裂、四大文明古国无古希腊），保留 261668 并修正其答案 A→B
UPDATE questions SET disabled=1 WHERE id=262232 AND module='changshi' AND (disabled IS NULL OR disabled=0);

-- 二、保留题修正（答案冲突裁定 + 噪声清理）
-- id=261667: 答案冲突裁定 C→A；解析同步更正
UPDATE questions SET answer='A', explanation='海上丝绸之路是独立发展的中外海上贸易与交往通道，兴起后逐步取代陆上丝绸之路成为主要通道，并非陆上丝绸之路的补充形式，A 说法错误。B 项马可·波罗返回意大利即经海上丝绸之路；C 项“始于秦汉、繁荣于唐宋、衰落于明清”为通行说法；D 项正确。故选A。' WHERE id=261667 AND module='changshi';
-- id=261668: 答案冲突裁定 A→B；解析同步更正
UPDATE questions SET answer='B', explanation='B 项正确：古埃及胡夫金字塔是世界上现存规模最大的金字塔。A 项《理想国》作者是柏拉图而非苏格拉底；C 项罗马帝国于公元 395 年（4 世纪末）分裂为东西两部，并非公元 1 世纪前后；D 项世界四大文明古国为古埃及、古巴比伦、古印度和中国，不含古希腊。故选B。' WHERE id=261668 AND module='changshi';
-- id=236357: 选项 A 末尾页码噪声“1”清理（保留题）
UPDATE questions SET options='{"A": "婚前房屋在婚后所得的租金", "B": "夫妻关系存续期间，军人的复员费和自主择业费", "C": "婚后由一方父母出资购买的不动产，产权登记在出资人子女名下", "D": "婚姻存续期间虽未实际取得，但明确可以取得的知识产权收益"}' WHERE id=236357 AND module='changshi';

-- 三、非重复（题干撞文）：改用不冲突的修复文本（2 条）
-- id=262228: 原修复文本“下列说法错误的是：”与 265781（发展理念题）撞文；本题为奥运常识题，改用带主题限定的题干
UPDATE questions SET question='下列关于奥运会的说法错误的是：' WHERE id=262228 AND module='changshi';
-- id=319230: 原修复文本与库内他题撞文（changshi 导出内未见同文，疑为跨模块）；改用等义变体题干
UPDATE questions SET question='关于常见用电器的工作情况，下列说法不准确的是：' WHERE id=319230 AND module='changshi';
