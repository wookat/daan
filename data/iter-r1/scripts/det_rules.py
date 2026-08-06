#!/usr/bin/env python3
"""迭代轮1 修复线B：确定性规则治理（T1页码/T3b同义合并/T4回填/T5清洗/T6回填/T7来源映射）。

读取快照 → 产出 out/det_*.jsonl 决策记录（后续 build_outputs.py 汇总为 fixes.sql/delist.sql/ledger.jsonl）。
"""
import sqlite3, re, json, os, unicodedata

DB = os.environ.get('DB', '/home/ubuntu/snap_iter.db')
OUT = os.environ.get('OUT', '/home/ubuntu/work/out')
os.makedirs(OUT, exist_ok=True)
conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row

def w(name):
    return open(os.path.join(OUT, name), 'w', encoding='utf-8')

def dump(f, obj):
    f.write(json.dumps(obj, ensure_ascii=False) + '\n')

CJK = re.compile(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef“”‘’、。，；：？！（）]')
PG = re.compile(r'\s*[-－—]\s+\d{1,3}\s+[-－—]\s*')

def clean_text(s: str):
    """通用文本清洗：页码残留、嵌套 ASCII 引号、全角空格/空白折叠。返回 (new, tags)"""
    tags = []
    t = s
    if PG.search(t):
        t = PG.sub('', t); tags.append('PAGE_RESIDUE')
    # “'X'” 型嵌套 ASCII 引号：CJK 语境中的 ASCII 单引号成对转为 ‘ ’，落单则删除
    if "'" in t and ('“' in t or '”' in t):
        chars = list(t); idxs = []
        for i, ch in enumerate(chars):
            if ch == "'":
                prev = chars[i-1] if i > 0 else ''
                nxt = chars[i+1] if i+1 < len(chars) else ''
                def _cjk(c):
                    return not c or CJK.match(c) or c.isdigit() or c in '“”‘’'
                if (prev in '“”' or nxt in '“”') or (_cjk(prev) and _cjk(nxt)):
                    idxs.append(i)
        if idxs:
            if len(idxs) % 2 == 0:
                for k, i in enumerate(idxs):
                    chars[i] = '‘' if k % 2 == 0 else '’'
                t = ''.join(chars)
            else:
                t = ''.join(c for i, c in enumerate(chars) if i not in set(idxs))
            tags.append('NESTED_QUOTE')
    if '  ' in t or '\u3000' in t or '\t' in t:
        t2 = re.sub(r'[ \u3000\t]{2,}', ' ', t.replace('\u3000', ' '))
        if t2 != t:
            t = t2; tags.append('WS_NOISE')
    t = t.strip()
    return t, tags

# ---------- T1 + T5：题干/解析文本清洗（全库在架题） ----------
f_clean = w('det_text_clean.jsonl')
rows = conn.execute("SELECT id,module,question,explanation,quality_score FROM questions WHERE disabled=0").fetchall()
n_clean = 0
for r in rows:
    upd = {}
    all_tags = set()
    for col in ('question', 'explanation'):
        v = r[col]
        if not v:
            continue
        nv, tags = clean_text(v)
        if nv != v and nv:
            upd[col] = nv; all_tags.update(tags)
    if upd:
        n_clean += 1
        dump(f_clean, {'id': r['id'], 'module': r['module'], 'task': 'T1/T5-text-clean',
                       'tags': sorted(all_tags), 'set': upd,
                       'in_low_cluster': bool(r['quality_score'] is not None and 40 <= r['quality_score'] <= 49)})
f_clean.close()
print('text clean rows:', n_clean)

# ---------- T1b：公式丢失检测（供 LLM/人工复核集） ----------
UNITS = '小时|种|人|元|棵|吨|天|次|分钟|米|千米|页|个|辆|台|件|只|层|分|秒|倍|岁|间|艘|箱|克|千克|升|亩|场|环|题|字|枚|瓶|桶|双|块|张|颗|根|条|支|袋|趟'
VERBS = set('需为是共有得即各要走坐付用')
def formula_lost(text):
    if not text:
        return 0
    n = 0
    for m in re.finditer(r'（(?:%s)）' % UNITS, text):
        i = m.start()
        prev = text[i-1] if i > 0 else ''
        if prev and not prev.isdigit() and (prev in VERBS or prev in '，。；：'):
            n += 1
    return n

f_fl = w('det_formula_loss.jsonl')
for r in conn.execute("SELECT id,module,is_real,question,options,answer,explanation FROM questions WHERE disabled=0").fetchall():
    qn = formula_lost(r['question'])
    en = formula_lost(r['explanation'])
    if qn or en:
        dump(f_fl, {'id': r['id'], 'module': r['module'], 'is_real': r['is_real'],
                    'q_slots': qn, 'e_slots': en,
                    'question': r['question'], 'options': r['options'], 'answer': r['answer'],
                    'explanation': r['explanation']})
f_fl.close()

# ---------- T3b：submodule 同义合并（全库扫描 + 定案映射） ----------
MERGE = {
    'changshi': {
        '公文': '管理与公文', '应急': '管理与公文',
        '地理': '地理国情',
        '环保': '生态', '环境': '生态',
        '婚家': '婚姻',
        '消保': '消费',
        '个人信息': '个保',
        '未保': '未成年',
        '科技常识': '科技', '科技-物理': '科技', '物理': '科技',
        '网安': '网络',
        '道交': '交通',
    },
    'shuliang': {
        '钟表问题': '周期与日期', '牛吃草问题': '工程问题',
        '抽屉原理': '最值问题', '最不利原则': '最值问题',
        '和倍问题': '计算问题', '还原问题': '计算问题', '平均数问题': '计算问题',
        '不定方程': '计算问题', '盈亏问题': '计算问题',
        '植树问题': '植树与方阵', '方阵问题': '植树与方阵',
        '数列问题': '数字推理',
        '爬楼问题': '行程问题', '鸡兔同笼': '计算问题', '锯木问题': '植树与方阵',
        '敲钟问题': '周期与日期', '队列问题': '行程问题', '构造类问题': '最值问题',
        '数字推理-多重数列': '数字推理',
    },
    'yanyu': {'意图判断': '中心理解', '片段阅读': '中心理解', '词句理解': '细节理解',
              '语句排序': '语句表达', '语句填空': '语句表达', '接语选择': '语句表达',
              '逻辑推理': None},
    'panduan': {'逻辑推理': '逻辑判断'},
    'ziliao': {'基期现期': '基期与现期', '基期量': '基期与现期', '现期量': '基期与现期',
               '增长问题': '增长率', '比重问题': '比重', '简单计算': '简单计算与读数',
               '平均数': '平均数与倍数', '倍数': '平均数与倍数'},
}
f_merge = w('det_submodule_merge.jsonl')
for mod, mp in MERGE.items():
    for old, new in mp.items():
        if not new:
            continue
        n = conn.execute("SELECT count(*) FROM questions WHERE module=? AND submodule=?", (mod, old)).fetchone()[0]
        if n:
            dump(f_merge, {'task': 'T3b-submodule-merge', 'module': mod, 'from': old, 'to': new, 'count': n})
f_merge.close()

# ---------- T6：submodule 空值按 tag3 回填 ----------
import json as _json
tax = _json.load(open('/home/ubuntu/repos/kaogong-assistant/backend/app/data/taxonomy.json'))
GROUP_NAME = {}
for m in tax['modules']:
    for g in m['groups']:
        GROUP_NAME[g['code']] = (m['key'], g['name'])
# 常识канonical 与现存主流值对齐（合并后口径）
CANON_OVERRIDE = {'CS-FL': '法律', 'CS-DL': '地理国情', 'CS-LS': '历史人文', 'CS-ZZ': '政治',
                  'CS-JJ': '经济', 'CS-KJ': '科技', 'CS-GL': '管理与公文'}
f_bf = w('det_submodule_backfill.jsonl')
for r in conn.execute("SELECT tag3, module, count(*) n FROM questions WHERE disabled=0 AND (submodule IS NULL OR trim(submodule)='') AND tag3 IS NOT NULL AND tag3!='' AND tag3!='UNKNOWN' GROUP BY 1,2").fetchall():
    code = '-'.join(r['tag3'].split('-')[:-1])
    if code in GROUP_NAME and GROUP_NAME[code][0] == r['module']:
        name = CANON_OVERRIDE.get(code, GROUP_NAME[code][1])
        dump(f_bf, {'task': 'T6-submodule-backfill', 'module': r['module'], 'tag3': r['tag3'], 'to': name, 'count': r['n']})
f_bf.close()

# ---------- T4：mistakes.question_id 回填 ----------
f_mk = w('det_mistakes_backfill.jsonl')
qmap = {}
def norm(s):
    s = unicodedata.normalize('NFKC', s or '')
    s = re.split(r'\n\s*A[.．、]', s)[0]  # 去除附带选项
    s = re.sub(r"[\s'‘’“”\"]+", '', s)
    return s.strip()
for r in conn.execute("SELECT id, question FROM questions").fetchall():
    qmap.setdefault(norm(r['question']), []).append(r['id'])
miss = conn.execute("SELECT id, question_text FROM mistakes WHERE question_id IS NULL OR question_id=''").fetchall()
n_exact = n_fuzzy = n_none = 0
unmatched = []
for m in miss:
    key = norm(m['question_text'])
    ids = qmap.get(key)
    if ids and len(ids) == 1:
        dump(f_mk, {'task': 'T4-mistakes-backfill', 'mistake_id': m['id'], 'question_id': ids[0], 'method': 'exact'})
        n_exact += 1
    elif ids:
        dump(f_mk, {'task': 'T4-mistakes-backfill', 'mistake_id': m['id'], 'question_id': ids[0], 'method': 'exact-multi', 'candidates': ids})
        n_exact += 1
    else:
        # 前缀模糊：题干截断（如 OCR 截断/省略号）
        cand = None
        if len(key) >= 20:
            pref = key[:20]
            hits = [(k, v) for k, v in qmap.items() if k.startswith(pref)]
            if len(hits) == 1 and len(hits[0][1]) == 1:
                cand = hits[0][1][0]
        if cand:
            dump(f_mk, {'task': 'T4-mistakes-backfill', 'mistake_id': m['id'], 'question_id': cand, 'method': 'prefix-fuzzy'})
            n_fuzzy += 1
        else:
            # 二次尝试：选项以空格衔接（" A.xxx B.xxx"）
            key2 = norm(re.split(r'\s+A[.．、]', unicodedata.normalize('NFKC', m['question_text'] or ''))[0])
            ids2 = qmap.get(key2)
            if ids2:
                dump(f_mk, {'task': 'T4-mistakes-backfill', 'mistake_id': m['id'], 'question_id': ids2[0], 'method': 'strip-inline-options'})
                n_fuzzy += 1
            else:
                n_none += 1
                unmatched.append({'mistake_id': m['id'], 'text': (m['question_text'] or '')[:80]})
dump(f_mk, {'task': 'T4-summary', 'missing': len(miss), 'exact': n_exact, 'fuzzy': n_fuzzy, 'unmatched': n_none, 'unmatched_list': unmatched})
f_mk.close()
print('mistakes:', len(miss), 'exact', n_exact, 'fuzzy', n_fuzzy, 'none', n_none)

# ---------- T7：source 人类可读映射 ----------
f_src = w('det_source_map.jsonl')
REGION = '国考|联考|北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|深圳|广州'
PINYIN = {'beijing': '北京', 'tianjin': '天津', 'hebei': '河北', 'shanxi': '山西', 'neimenggu': '内蒙古', 'liaoning': '辽宁', 'jilin': '吉林',
          'heilongjiang': '黑龙江', 'shanghai': '上海', 'jiangsu': '江苏', 'zhejiang': '浙江', 'anhui': '安徽', 'fujian': '福建', 'jiangxi': '江西',
          'shandong': '山东', 'henan': '河南', 'hubei': '湖北', 'hunan': '湖南', 'guangdong': '广东', 'guangxi': '广西', 'hainan': '海南',
          'chongqing': '重庆', 'sichuan': '四川', 'guizhou': '贵州', 'yunnan': '云南', 'xizang': '西藏', 'shaanxi': '陕西', 'gansu': '甘肃',
          'qinghai': '青海', 'ningxia': '宁夏', 'xinjiang': '新疆', 'shenzhen': '深圳', 'guangzhou': '广州'}
def humanize(src):
    if not src or src == 'original':
        return None
    s = src
    low = s.lower()
    for py in sorted(PINYIN, key=len, reverse=True):
        if py in low:
            i = low.find(py)
            s = s[:i] + PINYIN[py] + s[i+len(py):]
            low = s.lower()
    year = None
    m = re.search(r'(19|20)\d{2}', s)
    if m:
        year = m.group(0)
    reg = None
    m2 = re.search(r'(%s)' % REGION, s)
    if m2:
        reg = m2.group(1)
    lk = '联考' in s or re.search(r'4\d{2}联考|32\d联考', s)
    kind = '行测' if ('行测' in s or '真题' in s or 'AdministrativeAptitudeTest' in s) else None
    is_pathy = ('github' in s.lower() or '.pdf' in s.lower() or '/' in s or 'saduck' in s or 'AdministrativeAptitudeTest' in s)
    if not is_pathy:
        return None
    sub = ''
    m3 = re.search(r'副省级|地市级|行政执法', s)
    if m3:
        sub = f'（{m3.group(0)}）'
    if year and reg:
        if reg == '国考':
            return f'{year}年国考行测真题{sub}'
        if lk and reg not in ('联考',):
            return f'{year}年联考行测真题（{reg}卷）'
        if reg == '联考':
            return f'{year}年联考行测真题'
        return f'{year}年{reg}省考行测真题' if reg not in ('北京', '上海', '天津', '重庆', '深圳', '广州') else f'{year}年{reg}市考行测真题'
    if year:
        return f'{year}年行测真题'
    return '历年行测真题'
for r in conn.execute("SELECT source, count(*) n FROM questions GROUP BY source").fetchall():
    h = humanize(r['source'])
    if h and h != r['source']:
        dump(f_src, {'task': 'T7-source-map', 'from': r['source'], 'to': h, 'count': r['n']})
f_src.close()
print('done')
