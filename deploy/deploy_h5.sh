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
SSH_OPTS=(-o StrictHostKeyChecking=no)
REMOTE="$TICKETS_VPS_SSH_USER@$TICKETS_VPS_SSH_HOST"

step() { echo; echo "==> $*"; }

if [[ "${1:-}" != "--skip-build" ]]; then
  step "1/6 构建 H5"
  (cd "$REPO_DIR/frontend-uni" && npm run build:h5)
else
  step "1/6 跳过构建（--skip-build）"
fi

DIST="$REPO_DIR/frontend-uni/dist/build/h5"
LOCAL_INDEX_REF=$(grep -o 'index-[^"]*\.js' "$DIST/index.html" | head -1)
[[ -n "$LOCAL_INDEX_REF" ]] || { echo "本机构建产物缺 index.html bundle 引用"; exit 1; }
echo "本机 bundle: $LOCAL_INDEX_REF"

step "2/6 生产 .env 预检"
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" "test -s $REMOTE_DIR/deploy/.env" \
  || { echo "FAIL: 生产 $REMOTE_DIR/deploy/.env 不存在或为空（轮40曾被 rsync --delete 误删导致密钥丢失），先恢复再部署！"; exit 1; }

step "3/6 rsync backend/deploy/dist 到生产"
(cd "$REPO_DIR" && sshpass -e rsync -azR --delete -e "ssh ${SSH_OPTS[*]}" \
  backend deploy frontend knowledge frontend-uni/dist "$REMOTE:$REMOTE_DIR/" \
  --exclude '.git' --exclude '__pycache__' --exclude 'node_modules' --exclude '.env')

step "4/6 重建容器"
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "cd $REMOTE_DIR/deploy && docker compose up -d --build 2>&1 | tail -2"
sleep 8
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "docker inspect deploy-kaogong-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^ADMIN_TOKEN=..'" \
  || { echo "FAIL: 容器 ADMIN_TOKEN 为空，.env 未正确注入！"; exit 1; }

step "5/6 线上 bundle hash 校验"
ONLINE_INDEX_REF=$(curl -s "$SITE/" | grep -o 'index-[^"]*\.js' | head -1)
echo "线上 bundle: $ONLINE_INDEX_REF"
if [[ "$ONLINE_INDEX_REF" != "$LOCAL_INDEX_REF" ]]; then
  echo "FAIL: 线上 bundle ($ONLINE_INDEX_REF) != 本机构建 ($LOCAL_INDEX_REF)，部署未生效！"
  exit 1
fi
ONLINE_HOME_CHUNK=$(curl -s "$SITE/assets/$ONLINE_INDEX_REF" | grep -o 'pages-home-home\.[^"]*\.js' | head -1)
if [[ -n "$ONLINE_HOME_CHUNK" && ! -f "$DIST/assets/$ONLINE_HOME_CHUNK" ]]; then
  echo "FAIL: 线上 home chunk $ONLINE_HOME_CHUNK 不在本机构建产物中！"
  exit 1
fi
echo "OK: 线上 bundle 与本机构建一致"

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
