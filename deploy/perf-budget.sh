#!/usr/bin/env bash
# 性能预算回归护栏：对生产 URL 集跑 Lighthouse，按预算断言分数与核心指标。
# 用法: ./deploy/perf-budget.sh [url ...]   （默认 / 与 /tiku/）
# 环境: SITE 站点基址；CHROME_PATH 无头 Chrome 路径；违例 exit 1。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${SITE:-https://kaogong.zalize.com}"
CHROME="${CHROME_PATH:-$(command -v google-chrome || command -v chromium-browser || echo /home/ubuntu/.local/bin/google-chrome)}"

# 预算（依据 docs/iter/round-3/r196-perf-budget.md 的近期稳定水位）
# LCP 线 3000：Lighthouse 默认 simulate 口径下 `/` 的 LCP 是 Lantern 按「观测 FCP 前收完的
# High 优先级模块分包」当阻塞资源折算的 ~2.73 s 稳定值（真节流实测 0.7 s），
# 见 docs/iter/round-3/r443-lcp-budget-lantern-calibration.md。
MIN_PERF="${MIN_PERF:-0.90}"
MIN_A11Y="${MIN_A11Y:-1.00}"
MIN_BP="${MIN_BP:-0.90}"
MIN_SEO="${MIN_SEO:-0.95}"
MAX_LCP_MS="${MAX_LCP_MS:-3000}"
MAX_CLS="${MAX_CLS:-0.10}"
MAX_BUNDLE_GZ_KB="${MAX_BUNDLE_GZ_KB:-160}"
# Lighthouse 本机 CPU 基准（environment.benchmarkIndex）低于此值时 performance/LCP 只作 WARN 提示不可信，仍按预算判定
MIN_BENCH="${MIN_BENCH:-1800}"

FAIL=0

# 本地构建产物预算（存在才检查）
DIST="$REPO_DIR/frontend-uni/dist/build/h5"
if [[ -f "$DIST/index.html" ]]; then
  BUNDLE=$(grep -o 'index-[^"]*\.js' "$DIST/index.html" | head -1)
  if [[ -n "$BUNDLE" && -f "$DIST/assets/$BUNDLE" ]]; then
    GZ_KB=$(( $(gzip -c "$DIST/assets/$BUNDLE" | wc -c) / 1024 ))
    if (( GZ_KB > MAX_BUNDLE_GZ_KB )); then
      echo "FAIL bundle $BUNDLE gzip ${GZ_KB}KB > ${MAX_BUNDLE_GZ_KB}KB"; FAIL=1
    else
      echo "OK   bundle $BUNDLE gzip ${GZ_KB}KB <= ${MAX_BUNDLE_GZ_KB}KB"
    fi
  fi
fi

URLS=("$@")
[[ ${#URLS[@]} -gt 0 ]] || URLS=("/" "/tiku/")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for u in "${URLS[@]}"; do
  out="$TMP/$(echo "$u" | tr '/?' '__').json"
  err="${out%.json}.err"
  echo "==> Lighthouse $SITE$u"
  CHROME_PATH="$CHROME" npx --yes lighthouse "$SITE$u" \
    --quiet --output=json --output-path="$out" \
    --chrome-flags="--headless=new --no-sandbox" >/dev/null 2>"$err" \
    || { rc=$?
         echo "FAIL Lighthouse 运行失败: $u (rc=$rc, load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null))"
         echo "---- lighthouse stderr (tail 20) ----"; tail -n 20 "$err"; echo "----"
         FAIL=1; continue; }
  python3 - "$out" "$u" "$MIN_PERF" "$MIN_A11Y" "$MIN_BP" "$MIN_SEO" "$MAX_LCP_MS" "$MAX_CLS" "$MIN_BENCH" <<'EOF' || FAIL=1
import json, sys
p, u, mperf, ma11y, mbp, mseo, mlcp, mcls, mbench = sys.argv[1:10]
r = json.load(open(p))
cats = r["categories"]
lcp = r["audits"]["largest-contentful-paint"]["numericValue"]
cls = r["audits"]["cumulative-layout-shift"]["numericValue"]
env = r.get("environment", {})
bench = float(env.get("benchmarkIndex") or 0)
metrics = (r["audits"].get("metrics", {}).get("details", {}).get("items") or [{}])[0]
print(f"INFO {u} benchmarkIndex={bench:.0f} observedLCP={metrics.get('observedLargestContentfulPaint')}ms "
      f"observedFCP={metrics.get('observedFirstContentfulPaint')}ms TTFB={r['audits']['server-response-time']['numericValue']:.0f}ms")
if bench and bench < float(mbench):
    print(f"WARN {u} 本机 benchmarkIndex {bench:.0f} < {mbench}：Lantern 模拟的 performance/LCP 随本机 CPU 空闲度漂移，"
          f"本次分数不可作回归结论（R562 实测：空闲 ~2600 → LCP ~1.0–1.4s；双核占满 ~1230 → LCP 2.3s），请空闲后重跑")
rows = [
    ("performance", cats["performance"]["score"], float(mperf), ">="),
    ("accessibility", cats["accessibility"]["score"], float(ma11y), ">="),
    ("best-practices", cats["best-practices"]["score"], float(mbp), ">="),
    ("seo", cats["seo"]["score"], float(mseo), ">="),
    ("LCP(ms)", lcp, float(mlcp), "<="),
    ("CLS", cls, float(mcls), "<="),
]
bad = 0
for name, val, budget, op in rows:
    ok = val >= budget if op == ">=" else val <= budget
    print(f"{'OK  ' if ok else 'FAIL'} {u} {name}={val:.2f} 预算{op}{budget}")
    bad |= not ok
sys.exit(1 if bad else 0)
EOF
done

if (( FAIL )); then
  echo; echo "性能预算存在违例。"; exit 1
fi
echo; echo "性能预算全部通过。"
