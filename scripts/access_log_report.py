#!/usr/bin/env python3
"""Caddy JSON access log 周报统计。

用法（本机）:
    python3 scripts/access_log_report.py /var/log/caddy/kaogong.zalize.com-access.log
或从 stdin（远程日志）:
    ssh <host> 'cat /var/log/caddy/kaogong.zalize.com-access.log*' | python3 scripts/access_log_report.py -
可选参数 --days N 只统计最近 N 天（默认全部）。
可选参数 --exclude-ip-file PATH：逐行 IP 或 CIDR 网段清单（# 注释），按 X-Kg-Ip（回退
remote_ip）剔除探针/自测流量，剔除量单独计数外显，保证统计不混入开发探针。

输出：总请求量、/tiku/ 请求量、UA 分类（搜索引擎爬虫/其他 bot/疑似真人）、
爬虫明细、/tiku/ Top20 URL、状态码分布、时间范围。
"""
import sys, json, argparse, datetime, ipaddress
from collections import Counter

BOT_ENGINES = {
    "bingbot": "Bing", "googlebot": "Google", "google-inspectiontool": "Google",
    "baiduspider": "Baidu",
    "yandex": "Yandex", "sogou": "Sogou", "360spider": "360",
    "bytespider": "ByteDance", "duckduckbot": "DuckDuckGo",
    "applebot": "Apple", "petalbot": "Petal(华为)", "yisouspider": "Yisou(神马)",
}
BOT_GENERIC = ("bot", "spider", "crawl", "curl", "python", "wget", "httpx",
               "headless", "phantom", "scrapy", "go-http", "okhttp", "libwww")

# /tiku/ 页族分段（前缀首匹配，长前缀在前）
SEGMENTS = (
    ("/tiku/y/", "年份页"),
    ("/tiku/t/", "考点页"),
    ("/tiku/q/", "题目页"),
    ("/tiku/papers", "真题卷"),
    ("/tiku/shenlun/p/", "申论套卷页"),
    ("/tiku/shenlun", "申论hub/题型页"),
    ("/tiku/daily", "每日一练页"),
    ("/tiku/discuss", "讨论聚合页"),
    ("/tiku/search", "站内搜索页"),
    ("/tiku/ziliao", "模块页"),
    ("/tiku/shuliang", "模块页"),
    ("/tiku/yanyu", "模块页"),
    ("/tiku/panduan", "模块页"),
    ("/tiku/changshi", "模块页"),
)


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
    ap.add_argument("--exclude-ip-file", default="", help="探针IP清单文件，逐行IP，#注释")
    args = ap.parse_args()

    exclude_ips = []
    if args.exclude_ip_file:
        try:
            with open(args.exclude_ip_file, errors="ignore") as ef:
                for raw in ef:
                    ip = raw.split("#")[0].strip()
                    if not ip:
                        continue
                    try:
                        exclude_ips.append(ipaddress.ip_network(ip, strict=False))
                    except ValueError:
                        continue
        except OSError:
            pass

    def excluded(ip: str) -> bool:
        try:
            addr = ipaddress.ip_address(ip.strip())
        except ValueError:
            return False
        return any(addr in n for n in exclude_ips)

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
    probe_excluded = 0

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
        if exclude_ips:
            ip = (req.get("headers", {}).get("X-Kg-Ip") or [""])[0] or req.get("remote_ip", "")
            if excluded(ip):
                probe_excluded += 1
                continue
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
            for pre, seg in SEGMENTS:
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
    if exclude_ips:
        print(f"探针流量已剔除: {probe_excluded}（IP/网段清单 {len(exclude_ips)} 个，不计入以上/以下统计）")
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
