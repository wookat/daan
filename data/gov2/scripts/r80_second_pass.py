#!/usr/bin/env python3
"""R80 残留下架题二次处理：202 条（r80 修复原题中当前仍 disabled=1）逐题判定。

输入：
  disabled_questions.json  生产导出（disabled=1 全量）
  r80_fixed.json           R80 轮修复稿（555 条，source=fix:<原题id>）
输出：
  final/r80_decisions.jsonl   逐题判定表
  final/01_r80_fix.sql        修复+重新上架 SQL（带保护条件）
"""
import json, re, sys, pathlib

BASE = pathlib.Path(__file__).resolve().parent.parent
DISABLED = sys.argv[1]
R80FIXED = sys.argv[2]

PM = re.compile(r'[-—]\s*\d{1,3}\s*[-—]')
AD = re.compile(r'获取试卷更新[^。]*。|[，,]?一个上岸考生分享经验和答疑的平台。?')
CJK = r'\u4e00-\u9fff，。：；？！“”‘’（）、《》…—'
SPACE_IN_CJK = re.compile(f'(?<=[{CJK}])[ \u3000]+(?=[{CJK}])')

def clean(s):
    if not s: return s
    s = PM.sub('', s)
    s = AD.sub('', s)
    s = SPACE_IN_CJK.sub('', s)
    return s.strip()

# ---- 逐题人工判定结果（人工复核记录见 report_r80_gov2.md）----
UNRECOVERABLE = {
    238652: "解析公式在 OCR 中丢失、引用图形缺失，且解析自述标准答案 28.6 不在选项中（题目本身有缺陷），无法修复",
    275975: "题干引用未给出的《条例》材料（解析依赖材料中“桶前值守”内容），且存档答案 A 与解析结论（①③）矛盾，无法修复",
}
ANSWER_FIX = {
    259979: ("B", "北回归线为北纬 23°26′（约 23.5°），是太阳直射点所能到达的最北界限，B 项正确。A 项错误，北回归线并非北纬 25°；C 项错误，北回归线不穿过欧洲大陆；D 项错误，北寒带与北温带的分界线是北极圈，北回归线是热带与北温带的分界线。故正确答案为 B。"),
    285650: ("D", "第一步：判断题干词语间逻辑关系。谎言的目的是欺骗，前者为名词，后者为动词。第二步：判断选项词语间逻辑关系。A 项，谣言的目的并非抱怨，排除；B 项，谗言为名词，无知为形容词，与题干词性不对应，排除；C 项，佯言与委婉不构成目的对应，排除；D 项，诤言意为直率地规劝人改正过错的话，诤言的目的为劝诫，与题干逻辑关系一致，当选。故正确答案为 D。"),
}
EXPL_REWRITE = {
    272714: "第一步，本题考查排列组合问题，属于基础排列组合。第二步，甲城市需要 1 名教师和 2 名学生：从 2 名教师中选 1 名有 C(2,1)=2 种，从 4 名学生中选 2 名有 C(4,2)=6 种，剩余教师和学生自动分到乙城市，只有 1 种选法。共 2×6=12（种）。因此，选择 B 选项。",
    285642: "运输机往返一次需 2×(1100÷550)=4 小时，单位时间运输 5 吨；货运列车往返一次需 2×(1100÷100)=22 小时。要使总时间最短，应让单位时间运量大的列车尽可能多运。货运列车运输能力 600 吨，运输两次共 2×600=1200 吨；剩余 1480-1200=280 吨由运输机运输，需 280÷20=14 次，且第 14 次不需计算返程时间，则最短时间为 13×4+2=54 小时。故正确答案为 B。",
    288499: "机械类比的关键是：将两个本质不同的事物按表面相似机械比较得出结论。A 项“何不食肉糜”将百姓无粟米与自己食肉糜机械类比，符合定义；B 项将台城柳的“依旧”与人事变迁相比，借表面相似抒发感慨，符合定义；C 项“子子孙孙无穷匮也，而山不加增”是对增减趋势的合理推理，并非按表面相似机械比较，不符合定义，当选；D 项东施效颦是典型的机械模仿类比，符合定义。本题为选非题，故正确答案为 C。",
    287923: "原价 25 元每半天可销 20 个，每降价 1 元销量增加 5 个。上午打八折，价格为 25×0.8=20 元，相当于降价 5 元，销量为 20+5×5=45 个，销售额 45×20=900 元；下午在上午价格基础上再打八折，价格为 20×0.8=16 元，相当于降价 9 元，销量为 20+9×5=65 个，销售额 65×16=1040 元。全天销售额为 900+1040=1940 元。故正确答案为 B。",
    331155: "第一步：找出定义关键词。“个体追求预期目标失败”“为了冲淡自己内心的不安”“百般提高现已实现的目标的价值”“达到心理平衡”。第二步：逐一分析选项。A 项：小明买了平板电脑后很满意并推荐，不符合“为了冲淡内心不安、百般提高现已实现目标的价值”，排除；B 项：小红仍是销售状元是客观事实，并非“百般提高现已实现目标的价值”，排除；C 项：老师对小文成绩的预期落空，符合“追求预期目标失败”，用“比起上一次还是有进步”安慰自己，符合“百般提高现已实现的目标的价值”，当选；D 项：小张是自己主动放弃目标，不符合定义，排除。故正确答案为 C。",
    285601: "昭陵六骏是陕西醴泉唐太宗李世民陵墓昭陵北面祭坛东西两侧的六块骏马青石浮雕石刻，六骏是李世民在唐朝建立前先后骑过的战马，分别名为“拳毛騧”“什伐赤”“白蹄乌”“特勒骠”“青骓”“飒露紫”。A 项马踏匈奴是表现霍去病战功的；B 项击鼓说唱俑是表现汉代说唱艺术的；D 项乾陵石雕属于唐高宗李治与武则天的合葬墓。故正确答案为 C。",
}
EXPL_PATCH = {  # (old, new) 局部替换
    261219: ("一覆盖各种类型弹道导弹的陆基弹道导弹系列。",
             "A 项，“东风”系列是我国自行研制、覆盖近程/中程/远程/洲际各种类型弹道导弹的陆基弹道导弹系列，我国现役洲际弹道导弹（如东风-31、东风-41）均属该系列，A 项正确。"),
    286051: ("共需要 天", "共需要 250÷(1/300+1/200)×(5/6)=100 天"),
    287375: ("由线段法可知： 则可得到两系人数比为 。",
             "由线段法（十字交叉法）可知：音乐系与美术系人数之比 =(40%-30%):(30%-25%)=10%:5%=2:1。"),
    287785: None,  # 截断到第一个“故正确答案为B。”
}
OPT_PATCH = {
    238757: ("D", "小红听奶奶回忆自己在旧社会的苦日子时，禁不住潸然泪下杨柳（", "小红听奶奶回忆自己在旧社会的苦日子时，禁不住潸然泪下"),
    275837: ("B", "某小贩做生意总是缺斤少两，他辩解天下乌鸦一般黑，", "某小贩做生意总是缺斤少两，他辩解天下乌鸦一般黑"),
}

def esc(s): return s.replace("'", "''")

def main():
    dis = {q['id']: q for q in json.load(open(DISABLED))}
    fx = json.load(open(R80FIXED))
    work = []
    for r in fx:
        oid = int(r['source'].split(':')[1])
        if oid in dis:
            work.append((oid, dis[oid], r))
    assert len(work) == 202, len(work)

    # 重复题分组（按修复稿题干+选项归一化）
    def norm(s): return re.sub(r'\s', '', s or '')
    groups = {}
    for r in fx:
        k = norm(r.get('question')) + norm(str(r.get('options')))
        groups.setdefault(k, []).append(int(r['source'].split(':')[1]))
    work_ids = {oid for oid, _, _ in work}
    dup_reason = {}
    for k, v in groups.items():
        if len(v) < 2: continue
        members = [i for i in v if i in work_ids]
        if not members: continue
        live = [i for i in v if i not in dis]
        if live:
            for i in members:
                dup_reason[i] = f"重复题：同题已有在线版本 id={live[0]}，保持下架"
        else:
            keep = min(members)
            for i in members:
                if i != keep:
                    dup_reason[i] = f"重复题：与 id={keep} 完全相同，保留 {keep}，本条保持下架"

    decisions, sqls = [], []
    for oid, orig, r in sorted(work):
        rec = {"question_id": oid, "module": orig['module'],
               "stem": (r.get('question') or '')[:40]}
        if oid in dup_reason and oid in UNRECOVERABLE:
            rec.update(decision="keep_disabled", reason=dup_reason[oid] + "；且" + UNRECOVERABLE[oid])
        elif oid in dup_reason:
            rec.update(decision="keep_disabled", reason=dup_reason[oid])
        elif oid in UNRECOVERABLE:
            rec.update(decision="keep_disabled", reason=UNRECOVERABLE[oid])
        else:
            q = clean(r.get('question'))
            e = clean(r.get('explanation'))
            a = (r.get('answer') or '').strip()
            opts = r.get('options')
            if isinstance(opts, str): opts = json.loads(opts)
            fixes = ["清理页码残留/广告水印/OCR 空格"]
            if oid in OPT_PATCH:
                k, old, new = OPT_PATCH[oid]
                assert norm(old) in norm(opts[k]), oid
                opts[k] = new
                fixes.append(f"修复选项 {k} 串入/截断文本")
            if oid in ANSWER_FIX:
                a, e = ANSWER_FIX[oid]
                fixes.append("纠正错误答案并重写解析")
            elif oid in EXPL_REWRITE:
                e = EXPL_REWRITE[oid]
                fixes.append("重写乱码/公式丢失的解析")
            elif oid in EXPL_PATCH:
                p = EXPL_PATCH[oid]
                if p is None:
                    e = e.split("故正确答案为B。")[0] + "故正确答案为B。"
                    fixes.append("截断串入其他题目的解析文本")
                else:
                    old, new = p
                    assert norm(old) in norm(e.replace('\n','')), oid
                    e = re.sub(r'\s*'.join(map(re.escape, old)), new, e) if old not in e else e.replace(old, new)
                    fixes.append("补全解析中丢失的公式/文本")
            rec.update(decision="repair_enable", fixes=fixes)
            oj = json.dumps(opts, ensure_ascii=False)
            sqls.append(
                f"UPDATE questions SET question='{esc(q)}', options='{esc(oj)}', "
                f"answer='{esc(a)}', explanation='{esc(e)}', disabled=0 "
                f"WHERE id={oid} AND disabled=1;")
        decisions.append(rec)

    outdir = BASE / 'final'
    with open(outdir / 'r80_decisions.jsonl', 'w') as f:
        for d in decisions:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
    with open(outdir / '01_r80_fix.sql', 'w') as f:
        f.write("-- R80 残留下架题二次处理：修复并重新上架（逐题人工判定，见 r80_decisions.jsonl）\n"
                "-- 执行前请备份 data.db\nBEGIN;\n")
        f.write("\n".join(sqls) + "\nCOMMIT;\n")
    from collections import Counter
    print(Counter(d['decision'] for d in decisions))
    print("sql:", len(sqls))

if __name__ == '__main__':
    main()
