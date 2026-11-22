#!/bin/sh
# Runtime entrypoint: ensure /data volume is writable by unprivileged appuser (UID 1000),
# then drop privileges before exec'ing uvicorn so the app never runs as root.
set -eu

if [ "$(id -u)" = "0" ]; then
  if [ -d /data ]; then
    chown -R 1000:1000 /data || true
  fi
  exec setpriv --reuid=1000 --regid=1000 --clear-groups "$@"
fi

exec "$@"
