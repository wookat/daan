#!/usr/bin/env python3
"""LLM 审查（DeepSeek v4-flash）：
job=module  错模块/错题型题归位（T3a）
job=orig    original 低质题审查（T2）：verdict ok|fix|delist
job=absurd  不可能干扰项修复（T2，questions + shizheng_questions）
可重入：已有结果的 id 跳过。
"""
import sqlite3, re, json, os, sys, time, threading
from concurrent.futures import ThreadPoolExecutor
import urllib.request

DB = '/home/ubuntu/snap_iter.db'
OUT = '/home/ubuntu/work/out'
KEY = os.environ['DEEPSEEK_API_KEY']
JOB = sys.argv[1]
conn = sqlite3.connect(DB, check_same_thread=False); conn.row_factory = sqlite3.Row
lock = threading.Lock()

def llm(system, user, retries=4):
    body = json.dumps({'model': 'deepseek-chat', 'temperature': 0,
                       'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}).encode()
    for a in range(retries):
        try:
            req = urllib.request.Request('https://api.deepseek.com/v1/chat/completions', data=body,
                                         headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read())
            return json.loads(d['choices'][0]['message']['content'])
        except Exception as e:
            if a == retries - 1:
                return {'error': str(e)[:200]}
            time.sleep(2 * (a + 1))

tax = json.load(open('/home/ubuntu/repos/kaogong-assistant/backend/app/data/taxonomy.json'))
TAXTXT = []
VALID = {}
for m in tax['modules']:
    for g in m['groups']:
        TAXTXT.append(f"{m['key']} {g['name']}: " + ' '.join(f"{t['code']}={t['name']}" for t in g['topics']))
        for t in g['topics']:
            VALID[t['code']] = (m['key'], g['name'])
TAXTXT = '\n'.join(TAXTXT)

def run(items, outfile, worker, conc=48):
    path = os.path.join(OUT, outfile)
    done = set()
    if os.path.exists(path):
        for l in open(path):
            try: done.add(json.loads(l)['id'])
            except Exception: pass
    items = [it for it in items if it['id'] not in done]
    print(len(items), 'to do ->', path)
    f = open(path, 'a', encoding='utf-8')
    cnt = [0]
    def go(it):
        res = worker(it)
        res['id'] = it['id']
        with lock:
            f.write(json.dumps(res, ensure_ascii=False) + '\n'); f.flush()
            cnt[0] += 1
            if cnt[0] % 200 == 0: print(cnt[0], flush=True)
    with ThreadPoolExecutor(conc) as ex:
        list(ex.map(go, items))
    f.close()

if JOB == 'module':
    MOD = {'资料分析': 'ziliao', '数量关系': 'shuliang', '言语理解': 'yanyu', '言语理解与表达': 'yanyu', '判断推理': 'panduan', '常识判断': 'changshi'}
    BADSUB = {'逻辑判断', '分析推理', '经济', '增长率', '基期量', '简单计算'}
    rows = conn.execute("SELECT id,module,question_type,submodule,tag3,question,options,answer,explanation FROM questions WHERE disabled=0").fetchall()
    items = []
    for r in rows:
        qt = (r['question_type'] or '').split('-')[0]
        bad = (qt in MOD and MOD[qt] != r['module']) or (r['module'] == 'shuliang' and (r['submodule'] or '') in BADSUB)
        if bad:
            items.append(dict(r))
    sysmsg = ('你是公务员考试题库分类专家。给定一道题，判断它真正属于的行测模块，并在给定考点树中为它选定二级题型与三级考点。'
              '模块取值：ziliao(资料分析) shuliang(数量关系) yanyu(言语理解) panduan(判断推理) changshi(常识判断)。'
              '只输出 JSON：{"module":"...","submodule":"二级题型名","tag3":"三级考点code"}。tag3 必须取自考点树中该模块下的 code。\n考点树：\n' + TAXTXT)
    def worker(it):
        u = f"题干：{it['question']}\n选项：{it['options']}\n答案：{it['answer']}\n解析：{(it['explanation'] or '')[:300]}\n当前标注 module={it['module']} question_type={it['question_type']} submodule={it['submodule']} tag3={it['tag3']}"
        res = llm(sysmsg, u)
        res['old'] = {'module': it['module'], 'submodule': it['submodule'], 'tag3': it['tag3'], 'question_type': it['question_type']}
        if 'tag3' in res and res.get('tag3') not in VALID:
            res['invalid_tag3'] = True
        return res
    run(items, 'llm_module_fix.jsonl', worker)

elif JOB == 'orig':
    rows = conn.execute("SELECT id,module,question,options,answer,explanation FROM questions WHERE disabled=0 AND source='original'").fetchall()
    items = []
    for r in rows:
        e = (r['explanation'] or '').strip()
        core = re.sub(r'。?故选\s*[A-D]。?$', '', e).strip()
        if 0 < len(core) <= 10 and not re.search(r'[0-9=×÷]', core):
            qs = set(r['question'])
            if sum(1 for ch in core if ch in qs) / max(1, len(core)) >= 0.5:
                items.append(dict(r))
    sysmsg = ('你是公务员考试题库质检专家。审查一道 AI 自产题（来源 original），重点看：1) 答案是否正确；2) 干扰项是否过弱/荒谬（如与题干领域完全无关、一眼可排除、数值不可能）；3) 解析是否只是同义反复、没有信息量。\n'
              '输出 JSON：{"verdict":"ok|fix|delist","reason":"≤30字","explanation":"仅 verdict=fix 且需要重写解析时给出，≤90字、须包含具体知识依据","options":仅当干扰项需替换时给出完整新选项对象(保持正确答案字母与内容不变，干扰项须同领域、有迷惑性)}\n'
              '判定标准：答案错误或题目本身有严重问题且无法修复→delist；答案正确但解析空洞或干扰项过弱→fix；题目和解析基本合格（解析简短但含具体知识点即算合格）→ok。不确定答案正确性时倾向 delist。')
    def worker(it):
        u = f"题干：{it['question']}\n选项：{it['options']}\n标注答案：{it['answer']}\n解析：{it['explanation']}"
        return llm(sysmsg, u)
    run(items, 'llm_orig_audit.jsonl', worker)

elif JOB == 'absurd':
    items = []
    for r in conn.execute("SELECT id,question,options,answer,explanation FROM questions WHERE disabled=0").fetchall():
        try: o = json.loads(r['options'] or '{}')
        except Exception: continue
        if any(re.search(r'(\d{3,}(?:\.\d+)?)\s*%', str(v)) and float(re.search(r'(\d{3,}(?:\.\d+)?)\s*%', str(v)).group(1)) >= 200 for v in o.values()):
            items.append({'id': r['id'], 'table': 'questions', 'question': r['question'], 'options': r['options'], 'answer': r['answer'], 'explanation': r['explanation']})
    for r in conn.execute("SELECT id,question,options,answer,explanation FROM shizheng_questions").fetchall():
        try: o = json.loads(r['options'] or '{}')
        except Exception: continue
        if any(re.search(r'(\d{3,}(?:\.\d+)?)\s*%', str(v)) and float(re.search(r'(\d{3,}(?:\.\d+)?)\s*%', str(v)).group(1)) >= 200 for v in o.values()):
            items.append({'id': 'sz-%d' % r['id'], 'table': 'shizheng_questions', 'question': r['question'], 'options': r['options'], 'answer': r['answer'], 'explanation': r['explanation']})
    sysmsg = ('你是公务员考试题库质检专家。这道题的干扰项含有不可能的数值（如超过 200% 的比例）。'
              '若题目答案正确且可通过替换荒谬干扰项修复，给出新选项；若题目本身有误无法修复则 delist。\n'
              '输出 JSON：{"verdict":"fix|delist|ok","reason":"≤30字","options":verdict=fix 时给出完整新选项对象(保持正确答案字母与内容不变，干扰项数值须合理且有迷惑性)}\n'
              '注意：若荒谬数值恰是干扰项且答案项数值合理，用 fix；若答案项本身数值荒谬或事实错误，用 delist；若数值虽大但在语境中真实可能（如同比增长 300% 的小基数指标），用 ok。')
    def worker(it):
        u = f"题干：{it['question']}\n选项：{it['options']}\n标注答案：{it['answer']}\n解析：{it['explanation']}"
        res = llm(sysmsg, u)
        res['table'] = it['table']
        return res
    run(items, 'llm_absurd_fix.jsonl', worker, conc=8)
else:
    print('unknown job')
