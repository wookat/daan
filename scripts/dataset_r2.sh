#!/usr/bin/env bash
# 题库分发包 R2 私有桶发布与签名链接（内部/合作方按需发放，不公开）。
#
#   scripts/dataset_r2.sh publish <export_dir>          打包 tar.zst 并上传目录 + 包到 s3://$BUCKET/<version>/
#   scripts/dataset_r2.sh link <version> [days<=7]      对 tar.zst 与 kaogong-bank.sqlite 生成预签名下载链接（R2 上限 7 天）
#   scripts/dataset_r2.sh ls                            列出已发布版本
#
# 环境：R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID（或 R2_ENDPOINT）；可选 DATASET_BUCKET（默认 kaogong-datasets）。
set -euo pipefail

: "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID:?need R2_ACCOUNT_ID or R2_ENDPOINT}.r2.cloudflarestorage.com}"
BUCKET="${DATASET_BUCKET:-kaogong-datasets}"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
s3() { aws s3 --endpoint-url "$ENDPOINT" "$@"; }
s3api() { aws s3api --endpoint-url "$ENDPOINT" "$@"; }

case "${1:-}" in
  publish)
    DIR="$(cd "${2:?export_dir}" && pwd)"
    VER="$(basename "$DIR")"
    [[ -f "$DIR/SHA256SUMS" ]] || { echo "缺 SHA256SUMS，先跑 export_dataset.py"; exit 1; }
    (cd "$DIR" && sha256sum -c SHA256SUMS --quiet)
    TAR="$(dirname "$DIR")/$VER.tar.zst"
    tar -C "$(dirname "$DIR")" --zstd -cf "$TAR" "$VER"
    s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1 || s3api create-bucket --bucket "$BUCKET" >/dev/null
    s3 sync "$DIR" "s3://$BUCKET/$VER/" --only-show-errors
    s3 cp "$TAR" "s3://$BUCKET/$VER.tar.zst" --only-show-errors
    echo "published: s3://$BUCKET/$VER/  +  s3://$BUCKET/$VER.tar.zst ($(du -h "$TAR" | cut -f1))"
    ;;
  link)
    VER="${2:?version}"; DAYS="${3:-7}"
    (( DAYS >= 1 && DAYS <= 7 )) || { echo "days 取 1-7（R2 预签名上限 7 天）"; exit 1; }
    EXP=$(( DAYS * 86400 ))
    echo "有效期 ${DAYS} 天，到期需重新生成："
    for key in "$VER.tar.zst" "$VER/kaogong-bank.sqlite" "$VER/README.md" "$VER/SHA256SUMS"; do
      printf '%s\n  %s\n' "$key" "$(s3 presign "s3://$BUCKET/$key" --expires-in "$EXP")"
    done
    ;;
  ls)
    s3 ls "s3://$BUCKET/"
    ;;
  *)
    sed -n '2,9p' "$0"; exit 1
    ;;
esac
