#!/usr/bin/env python3
"""极简解析批量重写（分批模式）：每请求 K 题，中转站 grok-4.5。

第一遍分批产出；未过校验的题写 action=retry，由 rewrite.py 逐题带反馈收口。
用法：python3 rewrite_batch.py <targets.jsonl> <out.jsonl> [shard_idx shard_total]
"""
import json, os, re, sys, threading, time, urllib.request

from rewrite import validate, fmt, slen  # noqa: E402

BASE = os.environ['LLM_RELAY_BASE_URL'].rstrip('/')
KEY = os.environ['LLM_RELAY_API_KEY']
MODEL = os.environ.get('MODEL', 'grok-4.5')
WORKERS = int(os.environ.get('WORKERS', '50'))
K = int(os.environ.get('BATCH', '8'))

SYSTEM = (
    '你是公务员考试题库的解析编辑。下面给出若干道题（各有编号 id、题干、选项、正确答案、旧的极简解析），'
    '为每道题重写一段高质量解析。对每道题要求：\n'
    '1. 不改变答案：解析必须论证给定的正确答案成立；\n'
    '2. 内容：先讲清正确项成立的理由/考点/计算过程，再简要说明其余干扰项为何排除'
    '（至少点到一个干扰项，或指出本题考点与易错点）；\n'
    '3. 篇幅：每题解析去掉空白后 60–200 个字符，自然流畅的中文，不用 markdown；\n'
    '4. 禁止模板腔：不要写「故选X。」「故本题选X。」这类孤立收尾句式，'
    '答案指向要自然融入行文（如「因此A项正确」「排除B、C后应选D」）；\n'
    '5. 不得编造题目没有的数据；数量/资料题要给出关键计算步骤；\n'
    '6. 只输出 JSON：{"items": [{"id": <题目id>, "explanation": "..."}, ...]}，逐题对应，不得遗漏。'
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
            with urllib.request.urlopen(req, timeout=600) as r:
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


def process_batch(batch):
    user = '\n\n'.join(f"【id={it['id']}】\n" + fmt(it) for it in batch)
    r = llm(user)
    got = {}
    if isinstance(r.get('items'), list):
        for x in r['items']:
            if isinstance(x, dict) and isinstance(x.get('explanation'), str):
                got[x.get('id')] = x['explanation'].strip()
    out = []
    for it in batch:
        new = got.get(it['id'])
        if new is None:
            out.append({'id': it['id'], 'action': 'retry', 'reason': 'batch missing/error'})
            continue
        err = validate(new, it)
        if err:
            out.append({'id': it['id'], 'action': 'retry', 'reason': err, 'draft': new})
        else:
            out.append({'id': it['id'], 'action': 'fix', 'explanation': new, 'attempts': 1})
    return out


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
    batches = [items[i:i + K] for i in range(0, len(items), K)]
    print(f'shard {si}/{st}: todo {len(items)} in {len(batches)} batches', flush=True)
    lock = threading.Lock()
    out = open(dst, 'a', encoding='utf-8')
    idx = [0]
    nw = [0]

    def worker():
        while True:
            with lock:
                if idx[0] >= len(batches):
                    return
                b = batches[idx[0]]
                idx[0] += 1
            rs = process_batch(b)
            with lock:
                for r in rs:
                    out.write(json.dumps(r, ensure_ascii=False) + '\n')
                nw[0] += len(rs)
                out.flush()
                if nw[0] // 200 != (nw[0] - len(rs)) // 200:
                    print(f'{nw[0]}/{len(items)}', flush=True)

    ts = [threading.Thread(target=worker) for _ in range(WORKERS)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    print('done', flush=True)


if __name__ == '__main__':
    main()
