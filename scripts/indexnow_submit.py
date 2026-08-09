"""批量提交站点 URL 到 IndexNow（Bing/Yandex 等自动收录）。

用法：
    python scripts/indexnow_submit.py --key <INDEXNOW_KEY> [--pages-only] [--limit N] [--batch 5000] [--sleep 3]

URL 列表直接从站点 sitemap 分片抓取（sitemap-pages.xml + sitemap-questions-*.xml），
key 校验文件由后端 /indexnow-key.txt 提供（提交时带 keyLocation）。
每批 ≤10000 条（协议上限），批间 sleep 限速。
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request

SITE = "https://kaogong.zalize.com"
API = "https://api.indexnow.org/indexnow"


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read().decode("utf-8")


def sitemap_urls(pages_only: bool) -> list[str]:
    idx = fetch(f"{SITE}/sitemap.xml")
    shards = re.findall(r"<loc>([^<]+)</loc>", idx)
    urls: list[str] = []
    for s in shards:
        if pages_only and "sitemap-questions" in s:
            continue
        urls += re.findall(r"<loc>([^<]+)</loc>", fetch(s))
    return urls


def submit(urls: list[str], key: str) -> int:
    payload = {
        "host": SITE.split("//")[1],
        "key": key,
        "keyLocation": f"{SITE}/indexnow-key.txt",
        "urlList": urls,
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True)
    ap.add_argument("--pages-only", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=5000)
    ap.add_argument("--sleep", type=float, default=3.0)
    args = ap.parse_args()

    urls = sitemap_urls(args.pages_only)
    if args.limit:
        urls = urls[: args.limit]
    print(f"total urls: {len(urls)}")
    codes: dict[int, int] = {}
    for i in range(0, len(urls), args.batch):
        chunk = urls[i : i + args.batch]
        code = submit(chunk, args.key)
        codes[code] = codes.get(code, 0) + len(chunk)
        print(f"batch {i // args.batch + 1}: {len(chunk)} urls -> HTTP {code}")
        if code not in (200, 202):
            print("non-success response, aborting", file=sys.stderr)
            sys.exit(1)
        if i + args.batch < len(urls):
            time.sleep(args.sleep)
    print("done:", codes)


if __name__ == "__main__":
    main()
