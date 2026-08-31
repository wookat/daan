#!/usr/bin/env bash
# 部署脚本：本机构建 H5 → rsync 到生产 → 重建容器 → 线上 bundle hash 校验 → 接口回归
# 用法: TICKETS_VPS_SSH_USER=.. TICKETS_VPS_SSH_HOST=.. TICKETS_VPS_SSH_CREDENTIAL=.. ./deploy/deploy_h5.sh [--skip-build]
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/home/ubuntu/kaogong-assistant"
SITE="https://kaogong.zalize.com"

: "${TICKETS_VPS_SSH_USER:?need TICKETS_VPS_SSH_USER}"
: "${TICKETS_VPS_SSH_HOST:?need TICKETS_VPS_SSH_HOST}"
: "${TICKETS_VPS_SSH_CREDENTIAL:?need TICKETS_VPS_SSH_CREDENTIAL}"
export SSHPASS="$TICKETS_VPS_SSH_CREDENTIAL"
SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
REMOTE="$TICKETS_VPS_SSH_USER@$TICKETS_VPS_SSH_HOST"

step() { echo; echo "==> $*"; }

if [[ "${1:-}" != "--skip-build" ]]; then
  step "1/6 构建 H5"
  (cd "$REPO_DIR/frontend-uni" && npm run build:h5)
else
  step "1/6 跳过构建（--skip-build）"
fi

DIST="$REPO_DIR/frontend-uni/dist/build/h5"

step "1b 预压缩 assets（brotli，后端按 Accept-Encoding 返回 .br）"
if command -v brotli >/dev/null; then
  find "$DIST/assets" -type f \( -name '*.js' -o -name '*.css' \) -print0 \
    | xargs -0 -n1 brotli -f -k -q 11
  echo "已生成 $(find "$DIST/assets" -name '*.br' | wc -l) 个 .br 文件"
else
  echo "WARN: 本机无 brotli，跳过预压缩（线上将回退 Caddy gzip）"
fi
LOCAL_INDEX_REF=$(grep -o 'index-[^"]*\.js' "$DIST/index.html" | head -1)
[[ -n "$LOCAL_INDEX_REF" ]] || { echo "本机构建产物缺 index.html bundle 引用"; exit 1; }
echo "本机 bundle: $LOCAL_INDEX_REF"

step "2/6 生产 .env 预检"
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" "test -s $REMOTE_DIR/deploy/.env" \
  || { echo "FAIL: 生产 $REMOTE_DIR/deploy/.env 不存在或为空（轮40曾被 rsync --delete 误删导致密钥丢失），先恢复再部署！"; exit 1; }

BUILD_REV=$(git -C "$REPO_DIR" rev-parse --short HEAD)
git -C "$REPO_DIR" diff --quiet HEAD -- backend || BUILD_REV="$BUILD_REV-dirty"
echo "$BUILD_REV" > "$REPO_DIR/backend/BUILD_REV"
echo "本机后端 rev: $BUILD_REV"

step "3/6 rsync backend/deploy/dist 到生产"
(cd "$REPO_DIR" && sshpass -e rsync -azR --delete -e "ssh ${SSH_OPTS[*]}" \
  backend deploy frontend knowledge frontend-uni/dist "$REMOTE:$REMOTE_DIR/" \
  --exclude '.git' --exclude '__pycache__' --exclude 'node_modules' --exclude '.env')

step "3b 边缘缓存预热（重建前刷新入口级可缓存副本，容器重建窗口内 stale-if-error 必有副本可退）"
for u in "/tiku/" "/tiku/daily/" "/tiku/discuss/" "/robots.txt" "/sitemap.xml" \
         "/api/announcement" "/api/question_counts" "/api/daily_set" \
         "/api/submodules?module=yanyu" "/api/submodules?module=changshi" \
         "/api/submodules?module=panduan" "/api/submodules?module=shuliang" \
         "/api/submodules?module=ziliao" \
         "/api/real_filters" "/api/papers" "/api/comments/plaza"; do
  code=$(curl -s -o /dev/null --max-time 30 -w "%{http_code}" "$SITE$u" || true)
  echo "prime $u -> ${code:-fail}"
  [[ "$code" == "200" ]] || echo "  WARN: 预热非 200（不阻塞部署）"
done

step "4/6 重建容器（远端后台执行 + rev/StartedAt 轮询收敛，防高负载宿主 ssh 通道挂起）"
PREV_STARTED=$(sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "docker inspect deploy-kaogong-1 --format '{{.State.StartedAt}}' 2>/dev/null" || true)
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "cd $REMOTE_DIR/deploy && nohup docker compose up -d --build > /tmp/kg-compose.log 2>&1 < /dev/null & echo compose-started"
DEADLINE=$((SECONDS + 600))
REBUILT=0
while (( SECONDS < DEADLINE )); do
  sleep 10
  CUR_STARTED=$(sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" \
    "docker inspect deploy-kaogong-1 --format '{{.State.StartedAt}}' 2>/dev/null" || true)
  CUR_REV=$(curl -s --max-time 15 "$SITE/api/health" | grep -o '"rev":"[^"]*"' | cut -d'"' -f4 || true)
  echo "  poll: started=${CUR_STARTED:-?} rev=${CUR_REV:-?}"
  if [[ -n "$CUR_STARTED" && "$CUR_STARTED" != "$PREV_STARTED" && "$CUR_REV" == "$BUILD_REV" ]]; then
    REBUILT=1; break
  fi
done
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" "tail -3 /tmp/kg-compose.log" || true
if [[ "$REBUILT" != "1" ]]; then
  echo "FAIL: 600s 内容器未完成重建或线上 rev 未收敛到 $BUILD_REV！"; exit 1
fi
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "docker inspect deploy-kaogong-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^ADMIN_TOKEN=..'" \
  || { echo "FAIL: 容器 ADMIN_TOKEN 为空，.env 未正确注入！"; exit 1; }

step "4a 线上后端 rev 校验"
ONLINE_REV=$(curl -s "$SITE/api/health" | grep -o '"rev":"[^"]*"' | cut -d'"' -f4)
echo "线上后端 rev: $ONLINE_REV"
if [[ "$ONLINE_REV" != "$BUILD_REV" ]]; then
  echo "FAIL: 线上后端 rev ($ONLINE_REV) != 本机 ($BUILD_REV)，容器未用新代码重建！"
  exit 1
fi
echo "OK: 线上后端与本机代码一致"

step "4b 容器预热（读接口拉升 OS 页缓存，消除冷启动长尾）"
for u in "/api/stats" \
         "/api/questions?limit=10&module=yanyu" \
         "/api/questions?limit=10&module=changshi" \
         "/api/questions?limit=10&module=panduan" \
         "/api/questions?limit=10&module=shuliang" \
         "/api/questions?limit=10&module=ziliao" \
         "/api/questions?limit=10&tag3=CS-LS-01&module=changshi" \
         "/api/exam/papers" \
         "/api/papers"; do
  t=$(curl -s -o /dev/null -w "%{time_total}" "$SITE$u")
  echo "warm $u ${t}s"
done

step "4c CF Pages 部署（kaogong.zalize.com 静态层；动态路由经 functions 代理回源 kaogong-origin）"
: "${CLOUDFLARE_API_TOKEN:?need CLOUDFLARE_API_TOKEN (Pages deploy)}"
PAGES_DIR=$(mktemp -d)
cp -r "$DIST" "$PAGES_DIR/dist"
mkdir -p "$PAGES_DIR/functions"
cp -r "$REPO_DIR/deploy/cf-pages/functions/." "$PAGES_DIR/functions/"
cp "$REPO_DIR/deploy/cf-pages/_routes.json" "$REPO_DIR/deploy/cf-pages/_headers" "$PAGES_DIR/dist/"
(cd "$PAGES_DIR" && npx wrangler pages deploy dist --project-name kaogong-h5 --branch main --commit-dirty=true)
rm -rf "$PAGES_DIR"

step "5/6 线上 bundle hash 校验"
ONLINE_INDEX_REF=$(curl -s "$SITE/" | grep -o 'index-[^"]*\.js' | head -1)
echo "线上 bundle: $ONLINE_INDEX_REF"
if [[ "$ONLINE_INDEX_REF" != "$LOCAL_INDEX_REF" ]]; then
  echo "FAIL: 线上 bundle ($ONLINE_INDEX_REF) != 本机构建 ($LOCAL_INDEX_REF)，部署未生效！"
  exit 1
fi
ONLINE_HOME_CHUNK=$(curl -s --compressed "$SITE/assets/$ONLINE_INDEX_REF" | grep -o 'pages-home-home\.[^"]*\.js' | head -1 || true)
if [[ -n "$ONLINE_HOME_CHUNK" && ! -f "$DIST/assets/$ONLINE_HOME_CHUNK" ]]; then
  echo "FAIL: 线上 home chunk $ONLINE_HOME_CHUNK 不在本机构建产物中！"
  exit 1
fi
echo "OK: 线上 bundle 与本机构建一致"

step "5b 线上 bundle 各 Accept-Encoding 变体校验（防 HTML 回退缓存投毒）"
ENC_FAIL=0
for enc in "identity" "gzip" "br" "gzip, deflate" "gzip, deflate, br" "gzip, deflate, br, zstd" "zstd"; do
  ct=$(curl -s -o /dev/null -w "%{content_type}" -H "Accept-Encoding: $enc" "$SITE/assets/$ONLINE_INDEX_REF")
  echo "encoding [$enc] -> $ct"
  [[ "$ct" == *javascript* ]] || ENC_FAIL=1
done
[[ "$ENC_FAIL" == "0" ]] || { echo "FAIL: 存在非 JS 变体（疑似 HTML 回退投毒），检查 /assets 守卫与边缘缓存！"; exit 1; }

step "6/6 接口回归"
FAIL=0
for u in "/api/stats" \
         "/api/questions?module=yanyu&count=5" \
         "/api/questions?module=changshi&count=5" \
         "/tiku/" \
         "/robots.txt" \
         "/indexnow-key.txt" \
         "/admin"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE$u")
  echo "$u -> $code"
  [[ "$code" == "200" ]] || FAIL=1
done
[[ "$FAIL" == "0" ]] || { echo "FAIL: 回归存在非200"; exit 1; }
echo
echo "部署完成，回归全部 200。"
