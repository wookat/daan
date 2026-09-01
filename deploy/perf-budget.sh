#!/usr/bin/env bash
# 性能预算回归护栏：对生产 URL 集跑 Lighthouse，按预算断言分数与核心指标。
# 用法: ./deploy/perf-budget.sh [url ...]   （默认 / 与 /tiku/）
# 环境: SITE 站点基址；CHROME_PATH 无头 Chrome 路径；违例 exit 1。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${SITE:-https://kaogong.zalize.com}"
CHROME="${CHROME_PATH:-$(command -v google-chrome || command -v chromium-browser || echo /home/ubuntu/.local/bin/google-chrome)}"

# 预算（依据 docs/iter/round-3/r196-perf-budget.md 的近期稳定水位）
MIN_PERF="${MIN_PERF:-0.90}"
MIN_A11Y="${MIN_A11Y:-1.00}"
MIN_BP="${MIN_BP:-0.90}"
MIN_SEO="${MIN_SEO:-0.95}"
MAX_LCP_MS="${MAX_LCP_MS:-2500}"
MAX_CLS="${MAX_CLS:-0.10}"
MAX_BUNDLE_GZ_KB="${MAX_BUNDLE_GZ_KB:-160}"

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
  echo "==> Lighthouse $SITE$u"
  CHROME_PATH="$CHROME" npx --yes lighthouse "$SITE$u" \
    --quiet --output=json --output-path="$out" \
    --chrome-flags="--headless=new --no-sandbox" >/dev/null 2>&1 \
    || { echo "FAIL Lighthouse 运行失败: $u"; FAIL=1; continue; }
  python3 - "$out" "$u" "$MIN_PERF" "$MIN_A11Y" "$MIN_BP" "$MIN_SEO" "$MAX_LCP_MS" "$MAX_CLS" <<'EOF' || FAIL=1
import json, sys
p, u, mperf, ma11y, mbp, mseo, mlcp, mcls = sys.argv[1:9]
r = json.load(open(p))
cats = r["categories"]
lcp = r["audits"]["largest-contentful-paint"]["numericValue"]
cls = r["audits"]["cumulative-layout-shift"]["numericValue"]
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
