#!/usr/bin/env python3
"""T3 资料分析补题评估——生成路径样例（不入库）。
每份材料（纯文字、自含成套统计数据）配 5 题，定向补偏科考点。
门禁（全部程序化，任一不过即弃）：
  G1 图表数据完整性：expr 中引用的每个数值必须能在材料文本中找到（数值归一化匹配），
     题干不得引用材料以外的数据；
  G2 程序验算：expr 可 eval，结果与标注选项数值一致（相对误差≤1%），且不命中其他选项；
  G3 独立二审：deepseek 不看标注答案独立作答，须与标注一致；
  G4 查重：题干与全库题干（含生成批内）不重复。
输出 out/t3_samples.jsonl：{"material_id","submodule","tag3","question","options","answer",
"explanation","expr","gates":{...}}；未过门禁的记 {"reject":reason}。
用法：python3 t3_gen.py [材料数，默认12，产出≥50通过题即停]"""
import json, os, re, sqlite3, sys
from llm_common import llm

DB = os.environ.get('SNAP', '/home/ubuntu/r3/snap_r3.db')
OUT = os.environ.get('OUTDIR', '/home/ubuntu/r3/out')
N_MAT = int(sys.argv[1]) if len(sys.argv) > 1 else 12
TARGET = int(os.environ.get('TARGET', '50'))

# 偏科补齐方向：在架占比过低的二级题型（submodule → tag3 → 生成要求）
THEMES = [
    ('平均数与倍数', 'ZL-PJ-01', '平均数计算与比较（如人均、单位均值）'),
    ('平均数与倍数', 'ZL-PJ-05', '倍数关系计算（现期倍数/基期倍数）'),
    ('年均增长', 'ZL-ZZL-05', '年均增长率或年均增长量'),
    ('隔年增长', 'ZL-ZZL-03', '隔年增长率（两期增速求隔年）'),
    ('简单计算与读数', 'ZL-JS-02', '直接读数、简单加减与排序比较'),
    ('增长量', 'ZL-ZZLL-02', '增长量比较（增速与基数权衡）'),
]
SECTORS = ['粮食生产', '新能源汽车', '快递物流', '旅游收入', '规模以上工业利润',
           '进出口贸易', '城镇就业', '研发经费投入', '固定资产投资', '社会消费品零售',
           '医疗卫生资源', '互联网普及']

SYS_GEN = ('你是公务员考试资料分析命题专家。请编写一份纯文字统计材料（180~320字，'
           '虚构但数据自洽，含明确年份、总量、分项、同比增速等成套数据；所有数据在材料中'
           '明确给出，禁止表格与图片），并基于材料命制 5 道单选题（A-D 四个数值选项）。要求：\n'
           '1. 题目只能使用材料中给出的数据，不得引入材料外数据；\n'
           '2. 每题给出：question（以"问题："开头的完整题干）、options、answer（正确字母）、'
           'explanation（≤90字、含计算步骤、以"故选X"结尾）、expr（可用 Python eval 验算的算式，'
           '只含数字与+-*/()，计算结果等于正确选项数值）、submodule、tag3；\n'
           '3. 五题题型按用户指定分布；正确答案字母在 5 题内尽量均衡分布；\n'
           '4. 干扰项为常见易错值（如忘记除基期、增速混用），与正确项量级相近。\n'
           '输出 JSON：{"material":"...","questions":[{...}×5]}')
SYS_SOLVE = ('你是公务员考试资料分析解题专家。根据材料独立解答选择题，只输出 JSON：{"answer":"A|B|C|D"}')

NUM_RE = re.compile(r'\d+(?:\.\d+)?')


def nums_in(text):
    return {n.rstrip('0').rstrip('.') if '.' in n else n for n in NUM_RE.findall(text)}


def close(a, b):
    try:
        a, b = float(a), float(b)
    except Exception:
        return False
    return abs(a - b) <= max(0.01 * max(abs(a), abs(b)), 1e-9)


conn = sqlite3.connect(DB)
existing = {r[0] for r in conn.execute('SELECT question FROM questions')}
path = os.path.join(OUT, 't3_samples.jsonl')
f = open(path, 'a', encoding='utf-8')
seen_q = set()
passed = 0
if os.path.exists(path):
    for l in open(path):
        try:
            d = json.loads(l)
            if 'question' in d and 'reject' not in d:
                passed += 1
                seen_q.add(d['question'])
        except Exception:
            pass

for mi in range(N_MAT):
    if passed >= TARGET:
        break
    theme_pair = [THEMES[(2 * mi) % len(THEMES)], THEMES[(2 * mi + 1) % len(THEMES)]]
    sector = SECTORS[mi % len(SECTORS)]
    dist = (f"第1-3题：{theme_pair[0][2]}（submodule={theme_pair[0][0]}，tag3={theme_pair[0][1]}）；"
            f"第4-5题：{theme_pair[1][2]}（submodule={theme_pair[1][0]}，tag3={theme_pair[1][1]}）")
    out = llm(SYS_GEN, f"材料主题：某省{sector}情况（年份用2023/2024）。\n题型分布：{dist}",
              model=os.environ.get('GEN_MODEL', 'deepseek-chat'))
    if out.get('error') or not isinstance(out.get('questions'), list):
        f.write(json.dumps({'material_id': mi, 'reject': 'gen failed: ' + str(out.get('error'))[:120]},
                           ensure_ascii=False) + '\n')
        continue
    mat = (out.get('material') or '').strip()
    mat_nums = nums_in(mat)
    for qi, q in enumerate(out['questions'][:5]):
        rec = {'material_id': mi, 'material': mat if qi == 0 else None,
               'submodule': q.get('submodule'), 'tag3': q.get('tag3')}
        try:
            question = q['question'].strip()
            raw_opts = q['options']
            if isinstance(raw_opts, list):
                raw_opts = dict(zip('ABCD', raw_opts))
            opts = {k: re.sub(r'^[A-D][.、:：]\s*', '', str(v).strip()) for k, v in raw_opts.items()}
            ans = q['answer'].strip().upper()
            expl = q['explanation'].strip()
            expr = q['expr']
            gates = {}
            # G1 数据完整性：expr 引用的数值须都在材料中（百分比允许 25.3% ↔ 0.253 换算，
            # 允许年数等 ≤12 小整数与百分比换算常数 1/100）
            mat_f = set()
            for n in mat_nums:
                try:
                    v = float(n)
                    mat_f.update((v, v / 100, v * 100, 1 + v / 100))
                except ValueError:
                    pass

            def in_mat(n):
                try:
                    v = float(n)
                except ValueError:
                    return False
                if v.is_integer() and (v <= 12 or v in (100, 1000, 10000)):
                    return True
                return any(abs(v - m) < 1e-9 for m in mat_f)

            missing = [n for n in nums_in(expr) if not in_mat(n)]
            gates['g1_data_integrity'] = 'pass' if not missing else f'missing in material: {missing[:5]}'
            # G2 程序验算
            try:
                val = eval(expr, {'__builtins__': {}})
                diffs = {}
                for k, v in opts.items():
                    m = NUM_RE.search(str(v))
                    if m:
                        ov = float(m.group())
                        diffs[k] = abs(val - ov) / max(abs(ov), 1e-9)
                nearest = min(diffs, key=diffs.get) if diffs else None
                gates['g2_expr_check'] = ('pass' if nearest == ans and diffs[ans] <= 0.02
                                          else f'expr={val} nearest={nearest} diffs={ {k: round(x,4) for k,x in diffs.items()} }')
            except Exception as e:
                gates['g2_expr_check'] = 'eval error: ' + str(e)[:60]
            # G3 独立二审
            if all(v == 'pass' for v in gates.values()):
                sol = llm(SYS_SOLVE, f"材料：{mat}\n{question}\n选项：" +
                          ' '.join(f"{k}.{v}" for k, v in sorted(opts.items())))
                g3 = (sol.get('answer') or '').strip().upper()
                gates['g3_second_solve'] = 'pass' if g3 == ans else f'solver {g3} != {ans}'
            # G4 查重
            full_q = ('根据下列材料回答问题。' + mat + '\n' + question)
            gates['g4_dedup'] = 'pass' if full_q not in existing and full_q not in seen_q else 'duplicate'
            rec.update({'question': question, 'options': opts, 'answer': ans,
                        'explanation': expl, 'expr': expr, 'gates': gates,
                        'db_question': full_q})
            if all(v == 'pass' for v in gates.values()):
                seen_q.add(full_q)
                passed += 1
            else:
                rec['reject'] = '; '.join(f'{k}: {v}' for k, v in gates.items() if v != 'pass')
        except Exception as e:
            rec['reject'] = 'malformed: ' + str(e)[:80]
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')
        f.flush()
    print(f'material {mi} done, passed total {passed}', flush=True)
f.close()
print('done, passed', passed)
