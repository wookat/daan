#!/usr/bin/env python3
"""Caddy JSON access log 周报统计。

用法（本机）:
    python3 scripts/access_log_report.py /var/log/caddy/kaogong.zalize.com-access.log
或从 stdin（远程日志）:
    ssh <host> 'cat /var/log/caddy/kaogong.zalize.com-access.log*' | python3 scripts/access_log_report.py -
可选参数 --days N 只统计最近 N 天（默认全部）。

输出：总请求量、/tiku/ 请求量、UA 分类（搜索引擎爬虫/其他 bot/疑似真人）、
爬虫明细、/tiku/ Top20 URL、状态码分布、时间范围。
"""
import sys, json, argparse, datetime
from collections import Counter

BOT_ENGINES = {
    "bingbot": "Bing", "googlebot": "Google", "baiduspider": "Baidu",
    "yandex": "Yandex", "sogou": "Sogou", "360spider": "360",
    "bytespider": "ByteDance", "duckduckbot": "DuckDuckGo",
    "applebot": "Apple", "petalbot": "Petal(华为)", "yisouspider": "Yisou(神马)",
}
BOT_GENERIC = ("bot", "spider", "crawl", "curl", "python", "wget", "httpx",
               "headless", "phantom", "scrapy", "go-http", "okhttp", "libwww")


def classify(ua: str):
    low = ua.lower()
    for k, name in BOT_ENGINES.items():
        if k in low:
            return "engine", name
    for k in BOT_GENERIC:
        if k in low:
            return "bot", k
    return "human", None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logfile", help="日志路径，- 表示 stdin")
    ap.add_argument("--days", type=int, default=0, help="只统计最近N天")
    args = ap.parse_args()

    fh = sys.stdin if args.logfile == "-" else open(args.logfile, errors="ignore")
    cutoff = None
    if args.days:
        cutoff = datetime.datetime.now().timestamp() - args.days * 86400

    total = tiku = 0
    ts_min = ts_max = None
    cat_counter = Counter()
    engine_counter = Counter()
    bot_counter = Counter()
    tiku_urls = Counter()
    status_counter = Counter()
    tiku_engine = 0
    seg_counter = Counter()
    seg_engine = Counter()

    for line in fh:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = rec.get("ts")
        if cutoff and isinstance(ts, (int, float)) and ts < cutoff:
            continue
        if isinstance(ts, (int, float)):
            ts_min = ts if ts_min is None else min(ts_min, ts)
            ts_max = ts if ts_max is None else max(ts_max, ts)
        req = rec.get("request", {})
        uri = req.get("uri", "")
        ua = (req.get("headers", {}).get("User-Agent") or [""])[0]
        cat, name = classify(ua)
        total += 1
        cat_counter[cat] += 1
        status_counter[rec.get("status", 0)] += 1
        if cat == "engine":
            engine_counter[name] += 1
        elif cat == "bot":
            bot_counter[name] += 1
        if uri.startswith("/tiku"):
            tiku += 1
            path = uri.split("?")[0]
            tiku_urls[path] += 1
            if cat == "engine":
                tiku_engine += 1
            for pre, seg in (("/tiku/y/", "年份页"), ("/tiku/t/", "考点页"), ("/tiku/q/", "题目页"), ("/tiku/papers", "真题卷")):
                if path.startswith(pre):
                    seg_counter[seg] += 1
                    if cat == "engine":
                        seg_engine[seg] += 1
                    break
            else:
                seg_counter["其他/导航"] += 1
                if cat == "engine":
                    seg_engine["其他/导航"] += 1

    def fmt(ts):
        return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else "-"

    print(f"时间范围: {fmt(ts_min)} ~ {fmt(ts_max)}")
    print(f"总请求: {total}")
    print(f"/tiku/ 请求: {tiku}（其中搜索引擎爬虫 {tiku_engine}）")
    if seg_counter:
        print("/tiku/ 分段命中（总/爬虫）:", {k: f"{v}/{seg_engine.get(k, 0)}" for k, v in seg_counter.most_common()})
    print(f"UA 分类: 搜索引擎爬虫 {cat_counter['engine']} / 其他bot(含自测curl等) {cat_counter['bot']} / 疑似真人 {cat_counter['human']}")
    if engine_counter:
        print("搜索引擎明细:", dict(engine_counter.most_common()))
    if bot_counter:
        print("其他bot明细:", dict(bot_counter.most_common()))
    print("状态码:", dict(status_counter.most_common()))
    print("/tiku/ Top20 URL:")
    for u, n in tiku_urls.most_common(20):
        print(f"  {n:6d}  {u}")


if __name__ == "__main__":
    main()
