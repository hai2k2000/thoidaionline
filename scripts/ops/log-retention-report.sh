#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_JOURNALCTL_BIN:=journalctl}"
: "${THOIDAI_LOG_ROOT:=/var/log}"
: "${THOIDAI_LOG_MAX_GIB:=2}"
bytes_for(){ du -sx --bytes -- "$1" 2>/dev/null | awk 'NR==1{print $1}'; }
if [[ -d "$THOIDAI_LOG_ROOT" ]] && bytes=$(bytes_for "$THOIDAI_LOG_ROOT"); then
  [[ "$bytes" =~ ^[0-9]+$ ]] || { printf 'logs\tUNKNOWN\t0\t%s\tsize-ambiguous\n' "$THOIDAI_LOG_ROOT"; exit 0; }
  limit=$(awk -v g="$THOIDAI_LOG_MAX_GIB" 'BEGIN{printf "%.0f", g*1024*1024*1024}')
  if (( bytes > limit )); then printf 'logs\tCANDIDATE\t%s\t%s\tover-limit-%sGiB\n' "$bytes" "$THOIDAI_LOG_ROOT" "$THOIDAI_LOG_MAX_GIB"; else printf 'logs\tKEEP\t%s\t%s\twithin-limit\n' "$bytes" "$THOIDAI_LOG_ROOT"; fi
else printf 'logs\tUNKNOWN\t0\t%s\tinspection-failed\n' "$THOIDAI_LOG_ROOT"; fi
if command -v "$THOIDAI_JOURNALCTL_BIN" >/dev/null 2>&1; then
  if usage=$("$THOIDAI_JOURNALCTL_BIN" --disk-usage 2>/dev/null); then printf 'journal\tINFO\t0\tjournalctl\t%s\n' "$(tr '\n' ' ' <<<"$usage")"; else printf 'journal\tUNKNOWN\t0\tjournalctl\tinspection-failed\n'; fi
else printf 'journal\tUNKNOWN\t0\tjournalctl\tunavailable\n'; fi
printf 'log-policy\tINFO\t0\tpolicy\tno-automatic-delete; owner-approval-required\n'