#!/usr/bin/env python3
"""搜索引擎爬虫抓取日报：从小时级归档 access-YYYYMMDD.jsonl 聚合各引擎抓取量，落一个 JSON 供管理台外显。

用法（VPS cron，每小时）:
    crawler_stats.py <archive_dir> <out_json> [--days 14] [--exclude-ip-file probe-ips.txt]

--exclude-ip-file 与周报同一份探针 IP/CIDR 清单：开发会话伪装 Googlebot UA 做 SSR 自测的请求
必须剔除，否则「Google 从未来过」会被自己的探针假装成「来过」。

输出 JSON：
    {"generated_at": <epoch>, "days": ["2026-09-03", ...],
     "engines": {"Google": {"hits": {"2026-09-03": 3}, "err5xx": {...}, "tiku": {...},
                            "sitemap": {...}, "last_seen": <epoch|null>}, ...}}
只含聚合计数，不含 IP/UA 原文；UA 优先取 Worker 透传的 X-Kg-Ua（源站 User-Agent 可能是回源层的）。
"""
import argparse
import datetime
import ipaddress
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from access_log_report import BOT_ENGINES

SITEMAP_PREFIXES = ("/sitemap", "/robots.txt")


def engine_of(ua: str) -> str | None:
    low = (ua or "").lower()
    for key, name in BOT_ENGINES.items():
        if key in low:
            return name
    return None


def _ua(req: dict) -> str:
    headers = req.get("headers") or {}
    for key in ("X-Kg-Ua", "User-Agent"):
        vals = headers.get(key)
        if vals and vals[0]:
            return vals[0]
    return ""


def load_exclude_networks(path: str | None) -> list:
    nets = []
    if not path:
        return nets
    try:
        with open(path, errors="ignore") as f:
            for raw in f:
                ip = raw.split("#")[0].strip()
                if not ip:
                    continue
                try:
                    nets.append(ipaddress.ip_network(ip, strict=False))
                except ValueError:
                    continue
    except OSError:
        pass
    return nets


def _client_ip(req: dict) -> str:
    headers = req.get("headers") or {}
    for key in ("X-Kg-Ip", "Cf-Connecting-Ip"):
        vals = headers.get(key)
        if vals and vals[0]:
            return vals[0]
    return req.get("remote_ip") or ""


def _excluded(ip: str, nets: list) -> bool:
    if not nets:
        return False
    try:
        addr = ipaddress.ip_address(ip.strip())
    except ValueError:
        return False
    return any(addr in n for n in nets)


def aggregate(lines, days: int, now: float | None = None, exclude_nets: list | None = None) -> dict:
    """把 Caddy JSON 行迭代器聚合成引擎×天计数；窗口为最近 days 个 UTC 自然日（含今天）。"""
    now = now or time.time()
    exclude_nets = exclude_nets or []
    probe_excluded = 0
    today = datetime.datetime.fromtimestamp(now, datetime.UTC).date()
    day_list = [(today - datetime.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    day_set = set(day_list)
    engines: dict[str, dict] = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = rec.get("ts")
        if not isinstance(ts, (int, float)):
            continue
        req = rec.get("request") or {}
        name = engine_of(_ua(req))
        if not name:
            continue
        if _excluded(_client_ip(req), exclude_nets):
            probe_excluded += 1
            continue
        day = datetime.datetime.fromtimestamp(ts, datetime.UTC).date().isoformat()
        e = engines.setdefault(
            name, {"hits": {}, "err5xx": {}, "tiku": {}, "sitemap": {}, "last_seen": None},
        )
        if e["last_seen"] is None or ts > e["last_seen"]:
            e["last_seen"] = ts
        if day not in day_set:
            continue
        uri = req.get("uri") or ""
        e["hits"][day] = e["hits"].get(day, 0) + 1
        if int(rec.get("status") or 0) >= 500:
            e["err5xx"][day] = e["err5xx"].get(day, 0) + 1
        if uri.startswith("/tiku"):
            e["tiku"][day] = e["tiku"].get(day, 0) + 1
        if uri.startswith(SITEMAP_PREFIXES):
            e["sitemap"][day] = e["sitemap"].get(day, 0) + 1
    return {
        "generated_at": now,
        "days": day_list,
        "engines": engines,
        "probe_excluded": probe_excluded,
    }


def iter_archive(archive_dir: str, days: int, now: float | None = None):
    """只读窗口内（多留 1 天容忍时区边界）的按天归档文件。"""
    now = now or time.time()
    today = datetime.datetime.fromtimestamp(now, datetime.UTC).date()
    wanted = {
        (today - datetime.timedelta(days=i)).strftime("access-%Y%m%d.jsonl")
        for i in range(days + 1)
    }
    for fn in sorted(os.listdir(archive_dir)):
        if fn not in wanted:
            continue
        with open(os.path.join(archive_dir, fn), errors="ignore") as f:
            yield from f


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("archive_dir")
    ap.add_argument("out_json")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--exclude-ip-file", default="", help="探针 IP/CIDR 清单，逐行，# 注释")
    args = ap.parse_args()
    try:
        os.nice(19)
    except OSError:
        pass
    if not os.path.isdir(args.archive_dir):
        print(f"archive dir missing: {args.archive_dir}", file=sys.stderr)
        return 1
    result = aggregate(
        iter_archive(args.archive_dir, args.days),
        args.days,
        exclude_nets=load_exclude_networks(args.exclude_ip_file),
    )
    tmp = args.out_json + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, args.out_json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
