#!/usr/bin/env python3
"""公共 LLM 调用（deepseek-chat 主通道；LLM_RELAY grok-4.5 备用）。"""
import json, os, time, urllib.request

DS_KEY = os.environ['DEEPSEEK_API_KEY']
RELAY_BASE = os.environ.get('LLM_RELAY_BASE_URL', '').rstrip('/')
RELAY_KEY = os.environ.get('LLM_RELAY_API_KEY', '')


def parse_json(text):
    text = text.strip()
    if text.startswith('```'):
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
    i = text.find('{')
    if i < 0:
        raise ValueError('no json object')
    dec = json.JSONDecoder(strict=False)
    obj, _ = dec.raw_decode(text[i:])
    return obj


def llm(system, user, model='deepseek-chat', retries=4, temperature=0):
    model = os.environ.get('LLM_MODEL_OVERRIDE', model)
    if model == 'deepseek-chat':
        url, key = 'https://api.deepseek.com/v1/chat/completions', DS_KEY
    else:
        url, key = RELAY_BASE + '/v1/chat/completions', RELAY_KEY
    body = json.dumps({'model': model, 'temperature': temperature,
                       'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system},
                                    {'role': 'user', 'content': user}]}).encode()
    for a in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers={
                'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.loads(r.read())
            return parse_json(d['choices'][0]['message']['content'])
        except Exception as e:
            if a == retries - 1:
                return {'error': str(e)[:200]}
            time.sleep(2 * (a + 1))


def fmt_options(o):
    return ' '.join(f"{k}.{v}" for k, v in sorted(o.items()))
