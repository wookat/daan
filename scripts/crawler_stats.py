#!/usr/bin/env python3
"""搜索引擎爬虫抓取日报：从小时级归档 access-YYYYMMDD.jsonl 聚合各引擎抓取量，落一个 JSON 供管理台外显。

用法（VPS cron，每小时）:
    crawler_stats.py <archive_dir> <out_json> [--days 14] [--exclude-ip-file probe-ips.txt]

--exclude-ip-file 与周报同一份探针 IP/CIDR 清单：开发会话伪装 Googlebot UA 做 SSR 自测的请求
必须剔除，否则「Google 从未来过」会被自己的探针假装成「来过」。

输出 JSON：
    {"generated_at": <epoch>, "days": ["2026-09-03", ...],
     "engines": {"Google": {"hits": {"2026-09-03": 3}, "err5xx": {...}, "tiku": {...},
                            "sitemap": {...}, "last_seen": <epoch|null>}, ...},
     "humans": {"api": {"2026-09-03": 17}, "api5xx": {...}, "page": {...}, "ips": {...},
                "direct": {...}}}
humans = 剔除探针网段、搜索引擎与通用 bot UA、test-/probe- 测试 uid、未经边缘直连源站的请求后的余量
（R382：此前只有爬虫可见，「真人到底有没有来、来了有没有撞 5xx」全靠临时脚本翻日志）。
direct = 绕过 Cloudflare 边缘直打源站主机名的请求数（无 X-Kg-Ip/Cf-Connecting-Ip，源站一律 403）：
用户只能经公网域名进来，直连源站的只有扫描器，不进真人口径但单独计数便于对账。
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
from access_log_report import BOT_ENGINES, BOT_GENERIC

SITEMAP_PREFIXES = ("/sitemap", "/robots.txt")
# 探针/冒烟会话的 uid 前缀（R374 只按网段打标，跨网段跑的测试会话靠 uid 兜底）
TEST_UID_MARKERS = ("uid=test-", "uid=probe")
# 真人口径不计的内部/心跳路径
HUMAN_SKIP_PREFIXES = ("/api/health", "/api/admin", "/admin")
# 用户可达的正式域名；边缘回源带 X-Forwarded-Host，其它主机名（Pages 预览域名等）只有内部走查
SITE_HOSTS = ("kaogong.zalize.com",)


def is_generic_bot(ua: str) -> bool:
    low = (ua or "").lower()
    return not low or any(k in low for k in BOT_GENERIC)


def human_kind(uri: str) -> str | None:
    """真人请求归类：api / page（HTML 落地页与首页）；内部路径与静态资源返回 None。"""
    path = uri.split("?", 1)[0]
    if path.startswith(HUMAN_SKIP_PREFIXES):
        return None
    if path.startswith("/api/"):
        return "api"
    if path == "/" or path.startswith(("/tiku", "/s/", "/p/")):
        return "page"
    return None


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


def _via_edge(req: dict) -> bool:
    """是否经 Cloudflare 边缘进入源站（直连源站主机名的请求没有这两个头，Caddy 一律 403）。"""
    headers = req.get("headers") or {}
    return any(headers.get(k) and headers[k][0] for k in ("X-Kg-Ip", "Cf-Connecting-Ip"))


def _explicit_probe(req: dict) -> bool:
    headers = req.get("headers") or {}
    vals = headers.get("X-Kg-Probe")
    return bool(vals) and vals[0] == "1"


def _forwarded_host(req: dict) -> str:
    headers = req.get("headers") or {}
    vals = headers.get("X-Forwarded-Host")
    return (vals[0] if vals else "").strip().lower()


def _excluded(ip: str, nets: list) -> bool:
    if not nets:
        return False
    try:
        addr = ipaddress.ip_address(ip.strip())
    except ValueError:
        return False
    return any(addr in n for n in nets)


def aggregate(
    lines,
    days: int,
    now: float | None = None,
    exclude_nets: list | None = None,
    site_hosts: tuple[str, ...] | list[str] | None = None,
) -> dict:
    """把 Caddy JSON 行迭代器聚合成引擎×天计数；窗口为最近 days 个 UTC 自然日（含今天）。"""
    now = now or time.time()
    exclude_nets = exclude_nets or []
    hosts = {h.strip().lower() for h in (site_hosts or SITE_HOSTS) if h.strip()}
    probe_excluded = 0
    today = datetime.datetime.fromtimestamp(now, datetime.UTC).date()
    day_list = [(today - datetime.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    day_set = set(day_list)
    engines: dict[str, dict] = {}
    humans: dict[str, dict] = {"api": {}, "api5xx": {}, "page": {}, "direct": {}, "offhost": {}}
    human_ips: dict[str, set] = {}
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
        ua = _ua(req)
        name = engine_of(ua)
        day = datetime.datetime.fromtimestamp(ts, datetime.UTC).date().isoformat()
        if not name:
            if day not in day_set or is_generic_bot(ua):
                continue
            uri = req.get("uri") or ""
            kind = human_kind(uri)
            if not kind or any(m in uri for m in TEST_UID_MARKERS):
                continue
            if not _via_edge(req):
                humans["direct"][day] = humans["direct"].get(day, 0) + 1
                continue
            if _explicit_probe(req):
                continue
            fwd_host = _forwarded_host(req)
            if fwd_host and fwd_host not in hosts:
                humans["offhost"][day] = humans["offhost"].get(day, 0) + 1
                continue
            ip = _client_ip(req)
            if _excluded(ip, exclude_nets):
                continue
            humans[kind][day] = humans[kind].get(day, 0) + 1
            if kind == "api" and int(rec.get("status") or 0) >= 500:
                humans["api5xx"][day] = humans["api5xx"].get(day, 0) + 1
            if ip:
                human_ips.setdefault(day, set()).add(ip)
            continue
        if _excluded(_client_ip(req), exclude_nets):
            probe_excluded += 1
            continue
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
    humans["ips"] = {d: len(s) for d, s in human_ips.items()}
    return {
        "generated_at": now,
        "days": day_list,
        "engines": engines,
        "humans": humans,
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
    ap.add_argument("--site-host", action="append", default=[],
                    help="用户可达的正式域名（可重复；默认 kaogong.zalize.com），其它 X-Forwarded-Host 计 offhost")
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
        site_hosts=args.site_host or None,
    )
    tmp = args.out_json + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, args.out_json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
