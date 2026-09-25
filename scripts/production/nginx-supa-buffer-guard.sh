#!/usr/bin/env bash
set -Eeuo pipefail

config=$(nginx -T 2>/dev/null)
grep -Fq 'proxy_buffer_size 16k;' <<<"$config" || {
  echo "NGINX SUPA BUFFER CHECK FAILED: proxy_buffer_size 16k is missing" >&2
  exit 1
}
grep -Fq 'proxy_buffers 8 16k;' <<<"$config" || {
  echo "NGINX SUPA BUFFER CHECK FAILED: proxy_buffers 8 16k is missing" >&2
  exit 1
}
echo "nginx-supa-buffer-guard: PASS"
