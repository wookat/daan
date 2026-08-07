#!/usr/bin/env python3
"""极简解析批量重写：中转站 grok-4.5，逐题带反馈重试 + 程序校验。

环境：LLM_RELAY_BASE_URL / LLM_RELAY_API_KEY；
用法：python3 rewrite.py <targets.jsonl> <out.jsonl> [shard_idx shard_total]
输出行：{"id":..,"action":"fix","explanation":..} 或 {"id":..,"action":"keep","reason":..}
"""
import json, os, re, sys, threading, time, urllib.request

BASE = os.environ['LLM_RELAY_BASE_URL'].rstrip('/')
KEY = os.environ['LLM_RELAY_API_KEY']
MODEL = os.environ.get('MODEL', 'grok-4.5')
WORKERS = int(os.environ.get('WORKERS', '24'))

SYSTEM = (
    '你是公务员考试题库的解析编辑。给定一道题（题干、选项、正确答案、旧的极简解析），'
    '重写一段高质量解析。要求：\n'
    '1. 不改变答案：解析必须论证给定的正确答案成立；\n'
    '2. 内容：先讲清正确项成立的理由/考点/计算过程，再简要说明其余干扰项为何排除'
    '（至少点到一个干扰项，或指出本题考点与易错点）；\n'
    '3. 篇幅：去掉空白后 60–200 个字符，自然流畅的中文，不用 markdown；\n'
    '4. 禁止模板腔：不要写「故选X。」「故本题选X。」这类孤立收尾句式，'
    '答案指向要自然融入行文（如「因此A项正确」「排除B、C后应选D」）；\n'
    '5. 不得编造题目没有的数据；数量/资料题要给出关键计算步骤；\n'
    '6. 只输出 JSON：{"explanation": "..."}'
)


def llm(user, retries=5):
    body = json.dumps({'model': MODEL, 'temperature': 0.3,
                       'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': SYSTEM},
                                    {'role': 'user', 'content': user}]}).encode()
    for a in range(retries):
        try:
            req = urllib.request.Request(BASE + '/v1/chat/completions', data=body, headers={
                'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=300) as r:
                d = json.loads(r.read())
            t = d['choices'][0]['message']['content'].strip()
            if t.startswith('```'):
                t = t.split('```')[1]
                if t.startswith('json'):
                    t = t[4:]
            i = t.find('{')
            obj, _ = json.JSONDecoder(strict=False).raw_decode(t[i:])
            return obj
        except Exception as e:
            if a == retries - 1:
                return {'error': str(e)[:200]}
            time.sleep(3 * (a + 1))


def slen(s):
    return len(re.sub(r'\s', '', s or ''))


BAD_TAIL = re.compile(r'故(本题)?选\s*[A-D]\s*[。.．]?\s*$')
ANS_REF = re.compile(r'(?:选|答案是|答案为|应选|当选|正确答案[是为]?)\s*([A-D])')
POS_REF = re.compile(
    r'([A-D])\s*(?:项|选项)?\s*(?:正确|当选|成立|最恰当|符合题意|是正确答案)'
    r'|正确答案(?:为|是)\s*[「“]?([A-D])'
    r'|(?:故|因此|所以|应)选\s*[「“]?([A-D])')


def validate(new, item):
    n = slen(new)
    if n < 60:
        return f'过短({n}<60字符)，请扩写：补充考点说明或干扰项排除理由'
    if n > 200:
        return f'过长({n}>200字符)，请精炼'
    if BAD_TAIL.search(new.strip()):
        return '结尾是「故选X。」孤句式，请把答案指向自然融入行文'
    if '之_是' in new:
        return '出现「之_是」占位符'
    if '\t' in new or re.search(r'\\(times|frac|div|cdot|sqrt)', new):
        return '出现制表符或 LaTeX 记号（如 \\times），请用 ×、÷ 等普通符号'
    refs = set(ANS_REF.findall(new))
    if refs and item['answer'] not in refs and refs - {item['answer']}:
        return f"解析中指向的答案 {sorted(refs)} 与标准答案 {item['answer']} 不一致"
    pos = {x for m in POS_REF.findall(new) for x in m if x}
    if pos - {item['answer']}:
        return (f"解析中把 {sorted(pos - {item['answer']})} 说成正确项，"
                f"与标准答案 {item['answer']} 矛盾，请只论证 {item['answer']} 成立")
    a = item['answer']
    if a not in refs and not re.search(
            rf'{a}\s*(项|选项)|[选择为是]\s*[「“]?{a}[」”]?|{a}\s*(正确|当选|成立)', new):
        return f"解析未明确指向正确答案 {item['answer']}（请写明如「{item['answer']}项正确」）"
    return None


def fmt(item):
    opts = ' '.join(f"{k}.{v}" for k, v in sorted(item['options'].items()))
    return (f"模块：{item['module']}/{item.get('submodule') or ''}\n"
            f"题干：{item['question']}\n选项：{opts}\n"
            f"正确答案：{item['answer']}\n旧解析：{item['explanation']}")


def process(item):
    user = fmt(item)
    fb = None
    for attempt in range(3):
        u = user if not fb else user + f"\n\n上一稿：{fb[0]}\n未通过校验：{fb[1]}\n请修正后重新输出 JSON。"
        r = llm(u)
        if 'error' in r or not isinstance(r.get('explanation'), str):
            fb = ('', r.get('error', 'no explanation field'))
            continue
        new = r['explanation'].strip()
        err = validate(new, item)
        if not err:
            return {'id': item['id'], 'action': 'fix', 'explanation': new, 'attempts': attempt + 1}
        fb = (new, err)
    return {'id': item['id'], 'action': 'keep', 'reason': f'3轮带反馈重写未过校验：{fb[1]}'}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    si, st = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, 1)
    done = set()
    if os.path.exists(dst):
        for l in open(dst):
            try:
                done.add(json.loads(l)['id'])
            except Exception:
                pass
    items = []
    for i, l in enumerate(open(src)):
        if i % st != si:
            continue
        it = json.loads(l)
        if it['id'] not in done:
            items.append(it)
    print(f'shard {si}/{st}: todo {len(items)} (done {len(done)})', flush=True)
    lock = threading.Lock()
    out = open(dst, 'a', encoding='utf-8')
    idx = [0]

    def worker():
        while True:
            with lock:
                if idx[0] >= len(items):
                    return
                it = items[idx[0]]
                idx[0] += 1
            r = process(it)
            with lock:
                out.write(json.dumps(r, ensure_ascii=False) + '\n')
                out.flush()
                if idx[0] % 100 == 0:
                    print(f'{idx[0]}/{len(items)}', flush=True)

    ts = [threading.Thread(target=worker) for _ in range(WORKERS)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    print('done', flush=True)


if __name__ == '__main__':
    main()
