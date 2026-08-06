-- 迭代轮1 修复线B delist.sql（下架，disabled=1）
BEGIN;

-- ===== T1b QA P1-1 公式丢失且解析不可读（规则检出，人工复核）=====
UPDATE questions SET disabled=1 WHERE id=236159;  -- 公式占位丢失 q:0 e:3
UPDATE questions SET disabled=1 WHERE id=236161;  -- 公式占位丢失 q:0 e:1
UPDATE questions SET disabled=1 WHERE id=236397;  -- 公式占位丢失 q:0 e:2
UPDATE questions SET disabled=1 WHERE id=236400;  -- 公式占位丢失 q:0 e:1
UPDATE questions SET disabled=1 WHERE id=236781;  -- 公式占位丢失 q:0 e:3
UPDATE questions SET disabled=1 WHERE id=236873;  -- 公式占位丢失 q:0 e:2
UPDATE questions SET disabled=1 WHERE id=236935;  -- 公式占位丢失 q:0 e:4
UPDATE questions SET disabled=1 WHERE id=236938;  -- 公式占位丢失 q:0 e:1
UPDATE questions SET disabled=1 WHERE id=237011;  -- 公式占位丢失 q:0 e:2
UPDATE questions SET disabled=1 WHERE id=237138;  -- 公式占位丢失 q:0 e:1
UPDATE questions SET disabled=1 WHERE id=237209;  -- 公式占位丢失 q:0 e:3
UPDATE questions SET disabled=1 WHERE id=272808;  -- 公式占位丢失 q:0 e:1
UPDATE questions SET disabled=1 WHERE id=319299;  -- 公式占位丢失 q:0 e:1
UPDATE questions SET disabled=1 WHERE id=320013;  -- 公式占位丢失 q:0 e:1

-- ===== T2 QA P1-2 original 低质题下架（LLM 逐题审查）=====
UPDATE questions SET disabled=1 WHERE id=227224;  -- 二审：独立作答 B ≠ 标注 D，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=427823;  -- 一审：选项B/C/D荒谬，解析空洞，题目质量差
UPDATE questions SET disabled=1 WHERE id=589205;  -- 一审：题干表述混乱，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=589890;  -- 二审：独立作答 B ≠ 标注 A，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=589919;  -- 一审：选项与题干不匹配，非人物选项，答案荒谬
UPDATE questions SET disabled=1 WHERE id=590063;  -- 一审：题干表述不通，选项与史实不符，答案存疑。
UPDATE questions SET disabled=1 WHERE id=590095;  -- 一审：题干表述不通，选项与题干不匹配，答案存疑
UPDATE questions SET disabled=1 WHERE id=590741;  -- 一审：选项D为完整事件而非罪名，与题干不匹配，且其他选项为行为描述，答案错误。
UPDATE questions SET disabled=1 WHERE id=591752;  -- 一审：题干与选项严重不符，答案荒谬
UPDATE questions SET disabled=1 WHERE id=592536;  -- 一审：题干表述不清，选项B非独立选项，答案荒谬
UPDATE questions SET disabled=1 WHERE id=592720;  -- 一审：选项与题干无关，答案荒谬，解析空洞
UPDATE questions SET disabled=1 WHERE id=611834;  -- 一审：答案错误，题干与选项不匹配
UPDATE questions SET disabled=1 WHERE id=612001;  -- 一审：题干表述错误，昆曲才是百戏之祖，且选项D本身是题干重复，无意义。
UPDATE questions SET disabled=1 WHERE id=612006;  -- 一审：选项为文言文句，非器物名，题干与选项不匹配
UPDATE questions SET disabled=1 WHERE id=612021;  -- 一审：题干与选项不匹配，选项D是具体项目而非规划，且其他选项荒谬
UPDATE questions SET disabled=1 WHERE id=618593;  -- 一审：选项与题干无关，答案C为题干同义重复，题目无效
UPDATE questions SET disabled=1 WHERE id=618611;  -- 一审：题干与选项不匹配，选项非病原体名称，答案无依据
UPDATE questions SET disabled=1 WHERE id=618619;  -- 一审：题干与选项不匹配，选项非具体岛屿，答案错误
UPDATE questions SET disabled=1 WHERE id=618805;  -- 一审：题干与选项严重不匹配，选项为画作类型而非具体作品，且解析无信息量。
UPDATE questions SET disabled=1 WHERE id=618969;  -- 一审：选项与题干不匹配，选项为行为描述而非人名，题目严重错误
UPDATE questions SET disabled=1 WHERE id=618973;  -- 一审：题干与选项不匹配，选项非数值或历法内容，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=618987;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=619005;  -- 一审：题干表述混乱，选项C冗长且非标准表述，答案存疑。
UPDATE questions SET disabled=1 WHERE id=619191;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=619197;  -- 一审：选项D为陈述句非成语，且解析无信息量
UPDATE questions SET disabled=1 WHERE id=619368;  -- 一审：题干表述混乱，选项B为叙述而非答案，且选项荒谬
UPDATE questions SET disabled=1 WHERE id=619463;  -- 一审：题干表述不清，选项D为叙述而非选项，答案无依据。
UPDATE questions SET disabled=1 WHERE id=619487;  -- 一审：题干表述混乱，选项D为史实陈述而非题干所问，答案与题干不匹配。
UPDATE questions SET disabled=1 WHERE id=619499;  -- 一审：题干表述不清且选项与题干逻辑矛盾，无法修复
UPDATE questions SET disabled=1 WHERE id=619825;  -- 一审：题干表述不清，选项与题干不匹配，解析无信息量
UPDATE questions SET disabled=1 WHERE id=619893;  -- 一审：题干表述错误，八一南昌起义是建军之始，但选项C是事件意义而非起义名称，且选项A/B/D均为起义名称，与题干不匹配。
UPDATE questions SET disabled=1 WHERE id=619946;  -- 一审：题干表述不通，选项D非标准表述，答案存疑。
UPDATE questions SET disabled=1 WHERE id=620284;  -- 一审：选项与题干严重不符，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=620293;  -- 一审：选项D为题干同义重复，非有效选项；答案无意义。
UPDATE questions SET disabled=1 WHERE id=620297;  -- 一审：题干表述不清，选项D非标准表述，答案存疑。
UPDATE questions SET disabled=1 WHERE id=620313;  -- 一审：选项D为叙述句非成语，且解析空洞无信息
UPDATE questions SET disabled=1 WHERE id=620411;  -- 一审：题干表述不清且选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=620581;  -- 一审：选项B/C/D与题干完全无关，干扰项荒谬，题目严重缺陷
UPDATE questions SET disabled=1 WHERE id=620592;  -- 一审：选项D为陈述句非行为，且解析空洞无信息
UPDATE questions SET disabled=1 WHERE id=620614;  -- 一审：题干与选项严重不匹配，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=620619;  -- 一审：题干表述不通，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=620700;  -- 一审：选项与题干不匹配，答案荒谬
UPDATE questions SET disabled=1 WHERE id=620702;  -- 一审：题干与选项严重不匹配，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=620964;  -- 一审：题干表述不通，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=633859;  -- 一审：题干表述错误，问天实验舱并非首个实验舱，且选项D非实验舱名称。
UPDATE questions SET disabled=1 WHERE id=634093;  -- 一审：题干与选项不匹配，选项非零关税内容，答案无依据
UPDATE questions SET disabled=1 WHERE id=634094;  -- 一审：选项与题干不匹配，答案C为解释而非选项，题目严重错误
UPDATE questions SET disabled=1 WHERE id=634120;  -- 一审：题干表述不通，选项B/C/D与题干无关且荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=640704;  -- 一审：选项与题干不匹配，非经学之师姓名，题目严重错误
UPDATE questions SET disabled=1 WHERE id=640744;  -- 一审：选项表述不清且与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=641102;  -- 一审：选项与题干无关，解析错误且无信息量
UPDATE questions SET disabled=1 WHERE id=641107;  -- 一审：题干表述不通，选项D为完整句而非选项，题目严重问题
UPDATE questions SET disabled=1 WHERE id=641190;  -- 一审：题干表述不清，选项D为做法而非现象，答案无依据。
UPDATE questions SET disabled=1 WHERE id=641242;  -- 一审：选项D非标准表述，题干指向不明，答案存疑。
UPDATE questions SET disabled=1 WHERE id=641455;  -- 一审：题干表述混乱，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=641603;  -- 一审：选项与题干不匹配，A/B/D为任务描述而非人物，题干问人但选项混乱。
UPDATE questions SET disabled=1 WHERE id=641619;  -- 一审：题干表述混乱，选项与题干不匹配，答案无意义。
UPDATE questions SET disabled=1 WHERE id=641933;  -- 一审：选项D是题干本身，非扣费前状态，答案错误
UPDATE questions SET disabled=1 WHERE id=648399;  -- 一审：题干与选项严重不匹配，选项为地理区域而非景观，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=648428;  -- 一审：题干表述不通，选项D为句子而非选项，答案存疑。
UPDATE questions SET disabled=1 WHERE id=648429;  -- 一审：题干与选项不匹配，选项为人物评价而非地理著作，答案无依据。
UPDATE questions SET disabled=1 WHERE id=648435;  -- 一审：题干表述混乱无意义，选项与题干不匹配，答案无法判断。
UPDATE questions SET disabled=1 WHERE id=648769;  -- 二审：独立作答 B ≠ 标注 D，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=655218;  -- 一审：题干与选项不匹配，选项非经济圈定位，答案荒谬
UPDATE questions SET disabled=1 WHERE id=655438;  -- 一审：选项A非盐类，题干与选项不匹配，答案错误
UPDATE questions SET disabled=1 WHERE id=655629;  -- 一审：选项C为叙述性表述而非行为，且其他选项荒谬，题目严重缺陷
UPDATE questions SET disabled=1 WHERE id=655642;  -- 一审：选项D非治河之策，题干问疏浚之议，答案错误。
UPDATE questions SET disabled=1 WHERE id=655651;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=655673;  -- 一审：题干与选项严重不符，选项为无关行为描述，题目无法成立。
UPDATE questions SET disabled=1 WHERE id=655685;  -- 一审：题干与选项不匹配，选项为地点而非沙类型，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=655830;  -- 一审：选项与题干无关，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=655871;  -- 一审：题干表述不通，选项与题干不匹配，答案无法验证。
UPDATE questions SET disabled=1 WHERE id=655955;  -- 二审：独立作答 ACD ≠ 标注 B，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=655960;  -- 一审：题干语序混乱，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=662458;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=662460;  -- 一审：选项与题干不匹配，选项为行为描述而非人物，答案荒谬
UPDATE questions SET disabled=1 WHERE id=662463;  -- 二审：独立作答 B ≠ 标注 A，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=662469;  -- 一审：题干表述不通，选项C为同义重复，其余干扰项荒谬
UPDATE questions SET disabled=1 WHERE id=662568;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=662577;  -- 一审：题干与选项严重不符，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=662578;  -- 一审：题干表述混乱，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=662584;  -- 二审：独立作答 D ≠ 标注 C，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=662602;  -- 一审：题干表述不通，选项与题干不匹配，答案存疑。
UPDATE questions SET disabled=1 WHERE id=662939;  -- 一审：选项D为完整句子，非标准选项，且解析无信息量
UPDATE questions SET disabled=1 WHERE id=662943;  -- 一审：题干表述不清且选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=675579;  -- 一审：选项荒谬且解析空洞，题目表述不清
UPDATE questions SET disabled=1 WHERE id=675580;  -- 一审：题干表述不清，选项与问题不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=675586;  -- 二审：独立作答 B ≠ 标注 A，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=675608;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=675782;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=675786;  -- 一审：选项与题干严重不符，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=675799;  -- 一审：题干与选项严重不匹配，选项非题目选项形式，答案荒谬
UPDATE questions SET disabled=1 WHERE id=675800;  -- 一审：题干表述混乱，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=675808;  -- 一审：选项与题干不匹配，题干问现象而非行为
UPDATE questions SET disabled=1 WHERE id=675993;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=675995;  -- 一审：题干表述不清且选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=676202;  -- 一审：题干与选项严重不匹配，选项为行为描述而非人名，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=676220;  -- 一审：题干与选项严重不匹配，选项非窑名，答案荒谬
UPDATE questions SET disabled=1 WHERE id=676226;  -- 一审：题干表述不清，选项与题干不匹配，答案存疑。
UPDATE questions SET disabled=1 WHERE id=676238;  -- 一审：选项D为题干同义重复，非独立选项，题目无效
UPDATE questions SET disabled=1 WHERE id=682579;  -- 一审：选项D为成语而非策略，题干与选项不匹配，答案错误。
UPDATE questions SET disabled=1 WHERE id=682585;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=682588;  -- 二审：独立作答 B ≠ 标注 A，疑似答案错误
UPDATE questions SET disabled=1 WHERE id=682593;  -- 一审：题干表述混乱，选项荒谬，答案无实际意义
UPDATE questions SET disabled=1 WHERE id=682594;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=682597;  -- 一审：选项与题干不匹配，答案错误
UPDATE questions SET disabled=1 WHERE id=682611;  -- 一审：选项D为陈述句非辞令，且题干表述不清，答案存疑。
UPDATE questions SET disabled=1 WHERE id=682832;  -- 一审：题干表述不通，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=682836;  -- 一审：题干与选项严重不匹配，选项非史实描述，答案荒谬
UPDATE questions SET disabled=1 WHERE id=682842;  -- 一审：题干与选项严重不匹配，选项非地名，答案荒谬
UPDATE questions SET disabled=1 WHERE id=682850;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=682857;  -- 一审：题干表述不通，选项荒谬，答案虽指向B但题干有误
UPDATE questions SET disabled=1 WHERE id=683036;  -- 一审：题干表述混乱，选项荒谬，答案无依据
UPDATE questions SET disabled=1 WHERE id=683058;  -- 一审：选项与题干严重不符，答案荒谬，题目无法修复
UPDATE questions SET disabled=1 WHERE id=689448;  -- 一审：答案D为诗句非史实选项，且与题干重复，干扰项过弱。
UPDATE questions SET disabled=1 WHERE id=689467;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=689476;  -- 一审：题干表述不通，选项D非行为描述，答案牵强
UPDATE questions SET disabled=1 WHERE id=689486;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=689496;  -- 一审：题干表述不通，选项D非地理区域，答案与题干不匹配
UPDATE questions SET disabled=1 WHERE id=689647;  -- 一审：选项D直接重复题干，无干扰性；解析同义反复无信息量。
UPDATE questions SET disabled=1 WHERE id=689659;  -- 一审：选项D为评价性表述而非具体措施，且其他选项与题干无关，题目严重缺陷。
UPDATE questions SET disabled=1 WHERE id=689661;  -- 一审：题干表述不清，选项与题干不匹配，答案荒谬
UPDATE questions SET disabled=1 WHERE id=689665;  -- 一审：题干与选项不匹配，选项B是人物评价而非谋略，答案错误。
UPDATE questions SET disabled=1 WHERE id=689671;  -- 一审：答案D为描述性短语而非具体行为，且解析空洞无信息
UPDATE questions SET disabled=1 WHERE id=689682;  -- 一审：选项与题干不匹配，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=696070;  -- 一审：选项D为典故本身而非行为，答案错误
UPDATE questions SET disabled=1 WHERE id=696072;  -- 一审：题干表述错误，悬瓠之谋非韦孝宽事，且选项非史实表述。
UPDATE questions SET disabled=1 WHERE id=696074;  -- 一审：选项与题干不匹配，答案错误
UPDATE questions SET disabled=1 WHERE id=696094;  -- 一审：选项D非谏言内容，且题干表述不清，答案错误。
UPDATE questions SET disabled=1 WHERE id=696097;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=696098;  -- 一审：选项D为描述性短语而非谏言内容，且解析空洞无信息
UPDATE questions SET disabled=1 WHERE id=696111;  -- 一审：选项A非疏名，题干与选项严重不符，答案错误
UPDATE questions SET disabled=1 WHERE id=702531;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=702535;  -- 一审：选项D为题干同义重复，非选项；其余选项与题干无关，题目无效。
UPDATE questions SET disabled=1 WHERE id=702539;  -- 一审：题干表述不通，选项与题干不匹配，答案荒谬
UPDATE questions SET disabled=1 WHERE id=702540;  -- 一审：题干表述不通，选项与题干不匹配，答案无依据。
UPDATE questions SET disabled=1 WHERE id=702546;  -- 一审：选项C为同义重复，非考据特点，答案错误
UPDATE questions SET disabled=1 WHERE id=702557;  -- 一审：题干与选项严重不匹配，选项非人物，答案荒谬
UPDATE questions SET disabled=1 WHERE id=702695;  -- 一审：题干表述混乱，选项与题干不匹配，答案荒谬
UPDATE questions SET disabled=1 WHERE id=702701;  -- 一审：题干与选项不匹配，选项为成语而非人物，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=702722;  -- 一审：选项C为题干同义重复，非独立选项，题目无效。
UPDATE questions SET disabled=1 WHERE id=702729;  -- 一审：题干表述不清且选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=702741;  -- 一审：题干表述不清且选项荒谬，无法判断答案正确性
UPDATE questions SET disabled=1 WHERE id=709135;  -- 一审：选项D为陈述句非事件，且与题干问法不符，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=709139;  -- 一审：选项与题干不匹配，答案荒谬，解析空洞
UPDATE questions SET disabled=1 WHERE id=709140;  -- 一审：题干与选项不匹配，选项非人物，无法作答
UPDATE questions SET disabled=1 WHERE id=709146;  -- 一审：题干表述不清且选项荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=709154;  -- 一审：题干表述不清且选项与题干重复，答案无意义
UPDATE questions SET disabled=1 WHERE id=709163;  -- 一审：选项D为诗句非史实，答案错误且选项荒谬
UPDATE questions SET disabled=1 WHERE id=709166;  -- 一审：题干表述不通，选项C非标准表述，答案存疑。
UPDATE questions SET disabled=1 WHERE id=709168;  -- 一审：题干与选项严重不匹配，选项非人物，答案荒谬
UPDATE questions SET disabled=1 WHERE id=709179;  -- 一审：选项D为完整句子而非成语，且题干表述不清，答案无依据。
UPDATE questions SET disabled=1 WHERE id=709180;  -- 一审：选项与题干不匹配，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=709326;  -- 一审：题干表述不通，选项与题干不匹配，答案错误
UPDATE questions SET disabled=1 WHERE id=709331;  -- 一审：选项与题干不匹配，D为描述而非选项，题目严重问题
UPDATE questions SET disabled=1 WHERE id=709343;  -- 一审：题干表述不通，选项D非史实评价，答案无依据。
UPDATE questions SET disabled=1 WHERE id=709347;  -- 一审：选项D非学术内容，题干问学说却给人物称谓，答案荒谬
UPDATE questions SET disabled=1 WHERE id=709348;  -- 一审：题干与选项严重不符，答案荒谬，无法修复
UPDATE questions SET disabled=1 WHERE id=709354;  -- 一审：选项C为描述性短语而非具体谏言内容，且题干与选项不匹配，答案荒谬。
UPDATE questions SET disabled=1 WHERE id=709363;  -- 一审：选项D为题干同义重复，非独立选项，题目无效。
UPDATE questions SET disabled=1 WHERE id=709367;  -- 一审：选项D为人物评价而非谋略，且解析空洞无信息
UPDATE questions SET disabled=1 WHERE id=709510;  -- 一审：题干与选项不匹配，选项C非具体政策，且其他选项荒谬。
UPDATE questions SET disabled=1 WHERE id=709527;  -- 一审：选项D非具体剧种，题干与选项矛盾，答案荒谬
UPDATE questions SET disabled=1 WHERE id=709530;  -- 一审：题干与选项不匹配，选项C非考功之课内容，答案错误。
UPDATE questions SET disabled=1 WHERE id=709535;  -- 一审：题干与选项严重不符，选项D非使金之录名称，答案错误。
UPDATE questions SET disabled=1 WHERE id=709537;  -- 一审：题干表述不清，选项与题干不匹配，答案无依据
UPDATE questions SET disabled=1 WHERE id=709539;  -- 一审：选项D为题干同义重复，非选项；其余选项与题干无关，题目无效。
UPDATE questions SET disabled=1 WHERE id=709543;  -- 一审：题干表述不通，选项D非干扰项而是答案描述，题目严重问题

-- ===== T2 不可能干扰项且无法修复 =====

COMMIT;
