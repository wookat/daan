"""时政每日一练：题库生成脚本。

基于 data/shizheng_topics.json 的主题清单（2026年2-7月国内重大时政，事实来自公开权威报道），
用仓库现有 llm.py 通道为每个主题生成 2-3 道规范单选题（题干+4选项+答案+解析+出处说明），
输出到 knowledge/shizheng_bank.jsonl（随后端启动自动导入 shizheng_questions 表）。

用法：
    cd backend && python -m scripts.collect_shizheng            # 生成全部主题
    cd backend && python -m scripts.collect_shizheng --topic t01  # 只生成指定主题

注意：LLM 调用有限速（主题间 sleep），题目事实必须严格来自主题 facts，脚本会做结构校验，
生成后仍需人工抽审事实正确性（出处不实的删除）。
"""
import argparse
import asyncio
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import llm

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
TOPICS_PATH = os.path.join(ROOT, "data", "shizheng_topics.json")
OUT_PATH = os.path.join(ROOT, "knowledge", "shizheng_bank.jsonl")

RATE_LIMIT_SECS = 3  # 主题之间的间隔，避免触发限速

PROMPT = """你是公考时政题命题专家。请严格根据下面给定的【事实材料】命制 {n} 道时政单选题。

主题：{topic}
归属月份：{period}
【事实材料】（题目考点必须完全来自这些事实，禁止使用材料之外的任何数字、人名、日期或结论）：
{facts}

命题要求：
1. 每题为规范单选题：题干 + A/B/C/D 四个选项 + 唯一正确答案 + 解析。
2. 错误选项要有干扰性（如相近数字、相近日期、相近提法），但正确答案必须与事实材料完全一致。
3. 解析需引用事实材料说明为什么选该项。
3.5 题干中绝对不能出现正确答案的内容或提示（不得把考点事实直接写进题干再问考生），题干只给背景、选项才给具体事实。
4. 每题带一句话出处说明（source_note），可直接使用：{source_note}
5. {n} 道题考查不同角度，不要重复考同一个点。

只输出 JSON，格式：
{{"questions": [{{"question": "题干", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A", "explanation": "解析", "source_note": "出处一句话"}}]}}
"""


def _valid(q: dict) -> bool:
    if not isinstance(q, dict):
        return False
    opts = q.get("options")
    if not isinstance(opts, dict) or set(opts.keys()) != {"A", "B", "C", "D"}:
        return False
    if q.get("answer") not in ("A", "B", "C", "D"):
        return False
    return bool(q.get("question") and q.get("explanation"))


async def gen_topic(t: dict) -> list[dict]:
    prompt = PROMPT.format(
        n=t.get("n_questions", 3),
        topic=t["topic"],
        period=t["period"],
        facts="\n".join(f"- {f}" for f in t["facts"]),
        source_note=t["source_note"],
    )
    for attempt in range(2):
        try:
            data = await llm.chat_json([{"role": "user", "content": prompt}], temperature=0.3)
            qs = [q for q in data.get("questions", []) if _valid(q)]
            if qs:
                for q in qs:
                    q["date"] = t["period"]
                    q["topic_id"] = t["id"]
                    q["topic"] = t["topic"]
                    if not q.get("source_note"):
                        q["source_note"] = t["source_note"]
                    q["question"] = re.sub(r"\s+", " ", q["question"]).strip()
                return qs
        except Exception as e:
            print(f"  [{t['id']}] 第{attempt + 1}次生成失败: {e}")
            await asyncio.sleep(RATE_LIMIT_SECS * 2)
    return []


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", help="只生成指定主题 id")
    args = ap.parse_args()

    with open(TOPICS_PATH, encoding="utf-8") as f:
        topics = json.load(f)["topics"]
    if args.topic:
        topics = [t for t in topics if t["id"] == args.topic]

    existing = {}
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        q = json.loads(line)
                        existing.setdefault(q.get("topic_id"), []).append(q)
                    except json.JSONDecodeError:
                        pass

    total = sum(len(v) for v in existing.values())
    with open(OUT_PATH, "a", encoding="utf-8") as out:
        for t in topics:
            if existing.get(t["id"]):
                print(f"[{t['id']}] 已有 {len(existing[t['id']])} 题，跳过")
                continue
            print(f"[{t['id']}] 生成中：{t['topic']}")
            qs = await gen_topic(t)
            for q in qs:
                out.write(json.dumps(q, ensure_ascii=False) + "\n")
            out.flush()
            total += len(qs)
            print(f"  -> {len(qs)} 题（累计 {total}）")
            await asyncio.sleep(RATE_LIMIT_SECS)
    print(f"完成，共 {total} 题 -> {OUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
