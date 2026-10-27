#!/usr/bin/env bash
set -euo pipefail

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
BIN="$ROOT/bin"; DATA="$ROOT/data"; mkdir -p "$BIN" "$DATA"

OLD_ANON=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
RECENT_ANON=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
export OLD_ANON RECENT_ANON

cat > "$BIN/docker" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "volume ls"*) printf '%s\n' attached-vol prod-vol other-vol "$OLD_ANON" "$RECENT_ANON" ;;
  "volume inspect"*)
    n="${@: -1}"
    case "$n" in
      attached-vol) printf 'attached-vol|2026-10-01T00:00:00Z|%s/attached-vol|{}\n' "$ANALYSIS_VOLUME_ROOT" ;;
      prod-vol) printf 'prod-vol|2026-09-01T00:00:00Z|%s/prod-vol|{"com.docker.compose.project":"thoidai-work"}\n' "$ANALYSIS_VOLUME_ROOT" ;;
      other-vol) printf 'other-vol|2026-09-01T00:00:00Z|%s/other-vol|{"com.docker.compose.project":"other-app"}\n' "$ANALYSIS_VOLUME_ROOT" ;;
      "$OLD_ANON") printf '%s|2026-09-01T00:00:00Z|%s/%s|{}\n' "$OLD_ANON" "$ANALYSIS_VOLUME_ROOT" "$OLD_ANON" ;;
      "$RECENT_ANON") printf '%s|2026-10-26T00:00:00Z|%s/%s|{}\n' "$RECENT_ANON" "$ANALYSIS_VOLUME_ROOT" "$RECENT_ANON" ;;
    esac ;;
  "ps -a"*) printf 'supabase_db_thoidai-work\tUp 2 days\tattached-vol\n' ;;
  "system df"*) printf 'DOCKER_DF_FIXTURE\n' ;;
  *) exit 2 ;;
esac
EOF
chmod +x "$BIN/docker"
for n in attached-vol prod-vol other-vol "$OLD_ANON" "$RECENT_ANON"; do mkdir -p "$DATA/$n"; done
printf '15\n' > "$DATA/attached-vol/PG_VERSION"
printf '15\n' > "$DATA/$OLD_ANON/PG_VERSION"
printf '15\n' > "$DATA/$RECENT_ANON/PG_VERSION"
touch -d '2026-10-10' "$DATA/$OLD_ANON/PG_VERSION"
touch -d '2026-10-26' "$DATA/$RECENT_ANON/PG_VERSION"

out=$(PATH="$BIN:$PATH" ANALYSIS_VOLUME_ROOT="$DATA" ANALYSIS_NOW=2026-10-27 scripts/production/docker-volume-analysis.sh)
printf '%s\n' "$out" | grep -q $'KEEP\tattached-vol\t.*\t.*\t.*\t.*\tpostgres-data\t.*\tattached-to-supabase_db_thoidai-work'
printf '%s\n' "$out" | grep -q $'KEEP\tprod-vol\t'
printf '%s\n' "$out" | grep -q $'KEEP\tother-vol\t.*other-project'
printf '%s\n' "$out" | grep -q $'CANDIDATE\t'"$OLD_ANON"$'\t.*anonymous,postgres-data pg15,last-write=2026-10-0'
printf '%s\n' "$out" | grep -q $'KEEP\t'"$RECENT_ANON"$'\t.*recent-write'
printf '%s\n' "$out" | grep -q '^SUMMARY'

if rg -n 'docker (rm|inspect [^-]|exec|top|logs|volume rm|prune)|rm ' scripts/production/docker-volume-analysis.sh; then exit 1; fi
bash -n scripts/production/docker-volume-analysis.test.sh
echo PASS
