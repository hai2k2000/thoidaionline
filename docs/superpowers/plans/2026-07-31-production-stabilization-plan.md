# Production Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the complete production state, convert the dirty server checkout into a clean and documented canonical branch, and establish a tested blue/green deployment path with no observed downtime.

**Architecture:** Back up Git, filesystem, database, and runtime configuration before touching the dirty tree. Overlay the authoritative server state into an isolated worktree, classify and commit only maintainable non-secret content, then deploy an immutable candidate release to the inactive application slot and switch Nginx gracefully after health checks.

**Tech Stack:** Bash, Git worktrees, rsync, tar, PostgreSQL `pg_dump`/`pg_restore`, Docker, Next.js 16, npm, Flutter, systemd, Nginx, curl.

---

## File Map

- Create `AGENTS.md` and six files under `memory-bank/` for authoritative project guidance.
- Modify root, Flutter, and Android `.gitignore` files to separate source from artifacts and secrets.
- Create `docs/operations/dirty-worktree-inventory-2026-07-31.txt` and `docs/operations/production-runbook.md`.
- Create `scripts/ops/lib/common.sh`, secret scanning, health, release, and slot-switch scripts.
- Create shell tests under `scripts/ops/tests/`.
- Create blue/green systemd and Nginx templates under `deploy/`.

## Task 1: Capture and Verify the Emergency Recovery Baseline

**Files:**
- Create outside Git: `/opt/thoidai-backups/<timestamp>/`
- Read only: `/opt/thoidai-work`, active Nginx config, active systemd config

- [ ] **Step 1: Record the unchanged production baseline**

```bash
cd /opt/thoidai-work
git status --short --branch
git rev-parse HEAD
systemctl is-active thoidai-work.service
curl -fsS -o /dev/null https://thoidai.online/
curl -fsS -o /dev/null https://thoidai.online/supa/rest/v1/
```

Expected: known dirty status, active service, and successful HTTPS/Supabase checks.

- [ ] **Step 2: Create root-only backup directories**

```bash
set -euo pipefail
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/opt/thoidai-backups/$STAMP"
case "$BACKUP_DIR" in /opt/thoidai-backups/*) ;; *) exit 1 ;; esac
install -d -m 0700 "$BACKUP_DIR"/{git,source,sensitive,database,config}
printf '%s\n' "$BACKUP_DIR" >/opt/thoidai-backups/LATEST
chmod 0600 /opt/thoidai-backups/LATEST
```

Expected: backup root is owned by root with mode `0700`.

- [ ] **Step 3: Capture Git and the non-secret worktree**

```bash
cd /opt/thoidai-work
git bundle create "$BACKUP_DIR/git/thoidai-work.bundle" --all
tar -C /opt/thoidai-work -czf "$BACKUP_DIR/source/worktree-source.tgz" \
  --exclude='./.git' --exclude='./.env.local' --exclude='./.env.production' \
  --exclude='./node_modules' --exclude='./.next' --exclude='./backups' \
  --exclude='./releases' --exclude='./mobile/thoidai_work_flutter/.dart_tool' \
  --exclude='./mobile/thoidai_work_flutter/build' \
  --exclude='./mobile/thoidai_work_flutter/android/.gradle' \
  --exclude='./mobile/thoidai_work_flutter/android/local.properties' \
  --exclude='./mobile/thoidai_work_flutter/android/key.properties' .
```

Expected: bundle and source archive are non-empty; archive includes web, mobile source, SQL, and docs.

- [ ] **Step 4: Capture sensitive/operational files separately**

```bash
cd /opt/thoidai-work
SENSITIVE=(.env.local .env.production backups releases mobile/thoidai_work_flutter/android/key.properties)
for path in "${SENSITIVE[@]}"; do test -e "$path" || exit 1; done
tar -czf "$BACKUP_DIR/sensitive/project-sensitive.tgz" "${SENSITIVE[@]}"
chmod 0600 "$BACKUP_DIR/sensitive/project-sensitive.tgz"
```

Expected: archive contains all explicit paths without printing their contents.

- [ ] **Step 5: Dump PostgreSQL and runtime configuration**

```bash
docker exec supabase_db_thoidai-work pg_dump -U postgres -d postgres -Fc \
  >"$BACKUP_DIR/database/thoidai-work.dump"
tar -C / -czf "$BACKUP_DIR/config/runtime-config.tgz" \
  etc/nginx/sites-available/thoidai-work \
  etc/systemd/system/thoidai-work.service \
  etc/systemd/system/thoidai-work.service.d/10-memory-guard.conf \
  opt/thoidai-work/supabase/config.toml
chmod 0600 "$BACKUP_DIR/database/thoidai-work.dump" "$BACKUP_DIR/config/runtime-config.tgz"
```

Expected: `pg_restore --list` and `tar -tzf` can read both artifacts.

- [ ] **Step 6: Create manifest/checksums and verify every format**

```bash
HEAD_COMMIT="$(git -C /opt/thoidai-work rev-parse HEAD)"
cat >"$BACKUP_DIR/MANIFEST.txt" <<EOF
created_utc=$STAMP
source=/opt/thoidai-work
git_commit=$HEAD_COMMIT
database_container=supabase_db_thoidai-work
git_restore=git clone $BACKUP_DIR/git/thoidai-work.bundle RESTORE_REPOSITORY
source_restore=tar -xzf $BACKUP_DIR/source/worktree-source.tgz -C RESTORE_DIRECTORY
database_restore=pg_restore -U postgres -d RESTORE_DATABASE $BACKUP_DIR/database/thoidai-work.dump
EOF
chmod 0600 "$BACKUP_DIR/MANIFEST.txt"
find "$BACKUP_DIR" -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum \
  >"$BACKUP_DIR/SHA256SUMS"
chmod 0600 "$BACKUP_DIR/SHA256SUMS"
git bundle verify "$BACKUP_DIR/git/thoidai-work.bundle"
tar -tzf "$BACKUP_DIR/source/worktree-source.tgz" >/dev/null
tar -tzf "$BACKUP_DIR/sensitive/project-sensitive.tgz" >/dev/null
tar -tzf "$BACKUP_DIR/config/runtime-config.tgz" >/dev/null
pg_restore --list "$BACKUP_DIR/database/thoidai-work.dump" >/dev/null
sha256sum -c "$BACKUP_DIR/SHA256SUMS"
```

Expected: every validation exits 0.

- [ ] **Step 7: Restore into and remove a validated disposable database**

```bash
RESTORE_DB="thoidai_restore_verify_$(date -u +%Y%m%d%H%M%S)"
case "$RESTORE_DB" in thoidai_restore_verify_[0-9]*) ;; *) exit 1 ;; esac
docker exec supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $RESTORE_DB"
cat "$BACKUP_DIR/database/thoidai-work.dump" | docker exec -i supabase_db_thoidai-work \
  pg_restore -U postgres -d "$RESTORE_DB" --exit-on-error
docker exec supabase_db_thoidai-work psql -U postgres -d "$RESTORE_DB" -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'; SELECT count(*) FROM supabase_migrations.schema_migrations;"
docker exec supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE $RESTORE_DB WITH (FORCE)"
```

Expected: restored database reports 17 public tables and 4 migration rows before the explicitly prefixed disposable database is removed.

## Task 2: Create the Isolated Stabilization Worktree

**Files:**
- Create worktree: `/opt/thoidai-worktrees/production-stabilization`
- Create: `docs/operations/dirty-worktree-inventory-2026-07-31.txt`

- [ ] **Step 1: Invoke `superpowers:using-git-worktrees`**

Use the skill before creating the worktree. The target is outside the production checkout.

- [ ] **Step 2: Record the exact dirty inventory**

```bash
BACKUP_DIR="$(cat /opt/thoidai-backups/LATEST)"
git -C /opt/thoidai-work status --porcelain=v1 -uall \
  >"$BACKUP_DIR/source/original-git-status.txt"
chmod 0600 "$BACKUP_DIR/source/original-git-status.txt"
```

Expected: inventory includes all tracked and untracked dirty paths.

- [ ] **Step 3: Create the safety ref, branch, and worktree**

```bash
test ! -e /opt/thoidai-worktrees/production-stabilization
git -C /opt/thoidai-work branch safety/server-state-20260731 HEAD
git -C /opt/thoidai-work worktree add -b stabilize/production-20260731 \
  /opt/thoidai-worktrees/production-stabilization HEAD
git -C /opt/thoidai-work worktree list
```

Expected: production and stabilization paths appear on separate branches.

- [ ] **Step 4: Preview and apply the authoritative overlay**

Run first with `-aivn`, inspect it, then repeat with `-aiv`:

```bash
rsync -aivn \
  --exclude='/.git' --include='/.env.example' --exclude='/.env*' \
  --exclude='/node_modules' --exclude='/.next' --exclude='/backups' --exclude='/releases' \
  --exclude='/mobile/thoidai_work_flutter/.dart_tool' \
  --exclude='/mobile/thoidai_work_flutter/build' \
  --exclude='/mobile/thoidai_work_flutter/android/.gradle' \
  --exclude='/mobile/thoidai_work_flutter/android/local.properties' \
  --exclude='/mobile/thoidai_work_flutter/android/key.properties' \
  --exclude='/mobile/thoidai_work_flutter/**/*.iml' \
  --exclude='/supabase/.branches' --exclude='/supabase/.temp' \
  /opt/thoidai-work/ /opt/thoidai-worktrees/production-stabilization/
```

Expected: no deletion; no secrets, backups, releases, or generated caches in the preview.

Reproduce the known tracked deletion only in the isolated worktree:

```bash
git -C /opt/thoidai-worktrees/production-stabilization rm -- vercel.json
```

Expected: `vercel.json` is staged as deleted in the stabilization worktree while the production filesystem remains unchanged.

- [ ] **Step 5: Create the classification inventory document**

Create `docs/operations/dirty-worktree-inventory-2026-07-31.txt`:

```text
Source: /opt/thoidai-work on main
Safety ref: safety/server-state-20260731
Stabilization branch: stabilize/production-20260731
Recovery pointer: /opt/thoidai-backups/LATEST

Commit: maintainable source, migrations, documentation, assets, and lockfiles.
Ignore: reproducible build output and tool caches.
External only: environment files, signing material, dumps, backups, and release binaries.
Ambiguous paths remain preserved in the recovery snapshot until classified.
```

Append the captured path list so every original dirty path remains auditable:

```bash
{
  printf '\nOriginal git status:\n'
  cat "$(cat /opt/thoidai-backups/LATEST)/source/original-git-status.txt"
} >>docs/operations/dirty-worktree-inventory-2026-07-31.txt
```

Expected: the document contains every original dirty filename but no file contents.

## Task 3: Enforce Artifact and Secret Policy with Tests

**Files:**
- Modify: `.gitignore`, Flutter `.gitignore`, Android `.gitignore`
- Create: `scripts/ops/check-no-secrets.sh`
- Create: `scripts/ops/tests/test-ignore-policy.sh`
- Create: `scripts/ops/tests/test-secret-scan.sh`

- [ ] **Step 1: Write and run the failing ignore-policy test**

Create `scripts/ops/tests/test-ignore-policy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
ignored() { git check-ignore --no-index -q "$1" || { echo "Expected ignored: $1" >&2; exit 1; }; }
trackable() { if git check-ignore --no-index -q "$1"; then echo "Expected trackable: $1" >&2; exit 1; fi; }
ignored '.env.production'
ignored 'backups/example.dump'
ignored 'releases/mobile/app-release.aab'
ignored 'mobile/thoidai_work_flutter/build/app.apk'
ignored 'mobile/thoidai_work_flutter/android/key.properties'
ignored 'supabase/.temp/cli-latest'
trackable '.env.example'
trackable 'mobile/thoidai_work_flutter/pubspec.lock'
trackable 'mobile/thoidai_work_flutter/android/gradlew'
trackable 'mobile/thoidai_work_flutter/android/gradle/wrapper/gradle-wrapper.jar'
echo 'ignore policy: PASS'
```

Run `bash scripts/ops/tests/test-ignore-policy.sh`.

Expected: FAIL because server artifacts are not fully ignored and lock/wrapper files are ignored.

- [ ] **Step 2: Implement the ignore policy**

Append to root `.gitignore`:

```gitignore
/backups/
/releases/
*.dump
*.aab
*.apk
*.jks
*.keystore
**/key.properties
/supabase/.branches/
/supabase/.temp/
/mobile/**/.dart_tool/
/mobile/**/.gradle/
/mobile/**/build/
/mobile/**/local.properties
```

Replace `mobile/thoidai_work_flutter/.gitignore` with:

```gitignore
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
build/
coverage/

android/local.properties
ios/Flutter/Generated.xcconfig
ios/Flutter/flutter_export_environment.sh

*.iml
.idea/
.vscode/
```

Replace `mobile/thoidai_work_flutter/android/.gitignore` with:

```gitignore
/.gradle
/captures/
/local.properties
GeneratedPluginRegistrant.java
.cxx/

# Signing material is provisioned outside Git.
key.properties
**/*.keystore
**/*.jks
```

Run the test again; expected output is `ignore policy: PASS`.

- [ ] **Step 3: Write and run the failing secret-scanner test**

Create `scripts/ops/tests/test-secret-scan.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
git -C "$TMP" init -q
git -C "$TMP" config user.name test
git -C "$TMP" config user.email test@example.invalid
printf 'safe=true\n' >"$TMP/safe.txt"
git -C "$TMP" add safe.txt && git -C "$TMP" commit -qm safe
"$REPO/scripts/ops/check-no-secrets.sh" "$TMP"
printf 'storePassword=do-not-commit\n' >"$TMP/key.properties"
git -C "$TMP" add -f key.properties && git -C "$TMP" commit -qm secret
if "$REPO/scripts/ops/check-no-secrets.sh" "$TMP"; then exit 1; fi
echo 'secret scanner: PASS'
```

Expected: FAIL because the scanner does not exist.

- [ ] **Step 4: Implement the tracked-file scanner**

Create `scripts/ops/check-no-secrets.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-$(git rev-parse --show-toplevel)}"
cd "$REPO"
name_pattern='(^|/)(\.env($|\.)|key\.properties$|.*\.(jks|keystore|dump|aab|apk)$)'
if git ls-files | grep -E "$name_pattern" | grep -vE '^\.env\.example$'; then
  echo 'Tracked sensitive filename detected.' >&2
  exit 1
fi
pattern='BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|storePassword=|keyPassword=|SUPABASE_SERVICE_ROLE_KEY=[^[:space:]]+|RESEND_API_KEY=[^[:space:]]+|TELEGRAM_BOT_TOKEN=[^[:space:]]+'
if git grep -IlE "$pattern" -- ':!scripts/ops/tests/test-secret-scan.sh' ':!docs/superpowers/**'; then
  echo 'Tracked credential pattern detected.' >&2
  exit 1
fi
echo 'tracked secret scan: PASS'
```

Run both tests; expected output is two `PASS` lines.

- [ ] **Step 5: Commit the guardrails**

```bash
git add .gitignore mobile/thoidai_work_flutter/.gitignore \
  mobile/thoidai_work_flutter/android/.gitignore scripts/ops
git commit -m "chore: enforce artifact and secret policy"
```

Expected: only ignore/scanner/test files are committed.

## Task 4: Import and Verify Web, Database, and Documentation Changes

**Files:**
- Modify: `.env.example`, `DEPLOY_CHECKLIST.md`, `README.md`, `package.json`, `package-lock.json`
- Delete: `vercel.json`
- Add: project assets, `src/lib/services/*.ts`, Supabase configuration/migrations, standalone SQL, rollout documentation, dirty inventory

- [ ] **Step 1: Confirm forbidden paths are absent**

```bash
git status --short --untracked-files=all \
  | grep -E '(^|/)(backups|releases|node_modules|\.next|\.dart_tool|build|key\.properties)' \
  && exit 1 || true
```

Expected: no forbidden operational path.

- [ ] **Step 2: Verify dependencies and the web application before staging**

```bash
npm ci --no-audit --no-fund
npm ls --depth=0
npm run lint
npm run build
```

Expected: all commands exit 0. On failure, stop and use `superpowers:systematic-debugging` before editing source.

- [ ] **Step 3: Check SQL files for empty or broadly destructive content**

```bash
for file in supabase/migrations/*.sql sql/*.sql supabase-init.sql; do
  test -s "$file" || { echo "Empty SQL file: $file" >&2; exit 1; }
done
if grep -RInE 'DROP DATABASE|DROP SCHEMA public|TRUNCATE .*staff_users' supabase/migrations sql; then
  echo 'Potentially destructive SQL requires a separate review.' >&2
  exit 1
fi
```

Expected: no empty file and no broad destructive statement.

- [ ] **Step 4: Stage only maintainable web/database content**

```bash
git add -- .env.example DEPLOY_CHECKLIST.md README.md package.json package-lock.json \
  public/favicon-td.png public/thoidai-logo.png src/lib/services \
  supabase/.gitignore supabase/config.toml supabase/migrations sql \
  docs/HR_ASSET_DOCUMENT_PERFORMANCE_ROLLOUT.md \
  docs/operations/dirty-worktree-inventory-2026-07-31.txt
git add -u -- vercel.json
bash scripts/ops/check-no-secrets.sh
git diff --cached --check
git diff --cached --stat
```

Expected: no secret, backup, cache, build output, or release binary is staged.

- [ ] **Step 5: Commit recovered web/infrastructure state**

```bash
git commit -m "chore: recover server web and database state"
```

Expected: commit contains only paths reviewed in Step 4.

## Task 5: Import and Verify the Flutter Project

**Files:**
- Add: `mobile/thoidai_work_flutter/**` except ignored signing, machine-local, cache, and build paths

- [ ] **Step 1: Verify ignore behavior for mobile paths**

```bash
bash scripts/ops/tests/test-ignore-policy.sh
git status --short --untracked-files=all mobile/thoidai_work_flutter \
  | grep -E '(key\.properties|/build/|/\.dart_tool/|/\.gradle/|local\.properties|\.iml$)' \
  && exit 1 || true
```

Expected: no forbidden path.

- [ ] **Step 2: Resolve dependencies and analyze Flutter**

```bash
cd mobile/thoidai_work_flutter
FLUTTER_SUPPRESS_ANALYTICS=true /opt/flutter/bin/flutter pub get
test -s pubspec.lock
FLUTTER_SUPPRESS_ANALYTICS=true /opt/flutter/bin/flutter analyze
```

Expected: commands exit 0. On failure, stop and use `superpowers:systematic-debugging` before editing Dart.

- [ ] **Step 3: Stage and validate the mobile tracked set**

```bash
cd /opt/thoidai-worktrees/production-stabilization
git add mobile/thoidai_work_flutter
if git diff --cached --name-only \
  | grep -E '(key\.properties|/build/|/\.dart_tool/|/\.gradle/|local\.properties|\.iml$|\.aab$|\.apk$)'; then
  exit 1
fi
git diff --cached --name-only | grep -q 'mobile/thoidai_work_flutter/pubspec.lock'
git diff --cached --name-only | grep -q 'mobile/thoidai_work_flutter/android/gradlew$'
bash scripts/ops/check-no-secrets.sh
git diff --cached --check
```

Expected: Flutter lockfile and Gradle wrapper are staged; sensitive/generated files are absent.

- [ ] **Step 4: Commit mobile source**

```bash
git commit -m "feat: recover Flutter mobile application"
```

Expected: reproducible Flutter and Android source only.

## Task 6: Add AGENTS.md and Memory Bank

**Files:**
- Create: `AGENTS.md`
- Create: `memory-bank/projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md`

- [ ] **Step 1: Create `AGENTS.md`**

```markdown
# AGENTS.md

## Scope
These rules apply to the entire `thoidai-work` repository and production deployment.

## Safety
- Preserve production/user changes; never reset, delete, overwrite, or migrate without verified recovery.
- Use isolated worktrees for development and release preparation.
- Keep environments, signing files, dumps, backups, binaries, caches, and build output outside Git.
- Validate explicit absolute targets before any destructive temporary cleanup.

## Development
- Web uses Next.js App Router, React, strict TypeScript, and Tailwind CSS.
- Mobile uses Flutter/Dart. Commit `pubspec.lock` and Gradle wrapper; never commit signing/local Android files.
- UI copy is Vietnamese; preserve the orange/slate responsive navigation language.
- Database identifiers use `snake_case`; add ordered Supabase migrations with rollback notes.

## Verification
- Run web lint and production build sequentially.
- Run Flutter analysis separately; check RAM/swap before heavy commands.
- Run `scripts/ops/check-no-secrets.sh` before configuration/deploy/mobile commits.

## Production
- Deploy immutable blue/green releases; verify inactive slot before switching Nginx.
- Run `nginx -t` before reload and retain the previous slot for rollback.
- Do not change authentication or RLS in unrelated releases.

## Context
Read all `memory-bank/` files before changes; update active context and progress after material work.
```

- [ ] **Step 2: Create the Memory Bank files**

`memory-bank/projectbrief.md`:

```markdown
# Project Brief
Thời Đại Work is the internal system for task assignment/review, staff, departments, permissions, HR profiles, attendance, performance, assets, official documents, reports, reminders, and Flutter mobile access for Báo Thời Đại.
```

`memory-bank/productContext.md`:

```markdown
# Product Context
Primary users are editorial leadership, department managers, operations staff, editors, and reporters. The Vietnamese interface prioritizes assignment accountability, progress review, internal records, and mobile access. Non-managers see their own operational records while authorized roles see broader scopes.
```

`memory-bank/systemPatterns.md`:

```markdown
# System Patterns
- Next.js 16 App Router and React 19 provide the web UI.
- Client pages use the Supabase browser client; newer modules also use `src/lib/services` result wrappers.
- Supabase is self-hosted in Docker and exposed by Nginx under `/supa/`.
- Tasks use a legacy primary assignee plus `task_assignees` for multiple users.
- Authorization currently combines permission rows and hard-coded role rules in `src/lib/auth.tsx`.
- Production uses blue/green Next.js slots behind a named Nginx upstream.
```

`memory-bank/techContext.md`:

```markdown
# Technical Context
- Production root: `/opt/thoidai-work`; stabilization worktree: `/opt/thoidai-worktrees/production-stabilization`.
- Node 22, npm 10, Next.js 16.1.6, React 19.2.3, TypeScript 5, Tailwind CSS 4.
- Flutter 3.41.9 and Dart 3.11.5.
- Self-hosted Supabase/PostgreSQL 17; `/supa/` proxies to port 54331.
- Blue slot is port 3001; green slot is port 3002.
- Web verification: `npm ci`, `npm run lint`, `npm run build`.
- Mobile verification: Flutter `pub get` then `analyze`.
- Heavy builds run sequentially because the host has shared workloads and active swap.
```

`memory-bank/activeContext.md`:

```markdown
# Active Context
The active phase is production stabilization. The server state is authoritative and preserved in a root-only recovery set. Work occurs in an isolated worktree. This phase does not change authentication, RLS, or production data schemas; it establishes a clean branch, documentation, verification, and blue/green deployment.
```

`memory-bank/progress.md`:

```markdown
# Progress

## Implemented
- Tasks, multi-assignee workflow, comments, progress logs, and review states.
- Users, roles, permissions, departments, HR, assets, documents, performance, audit, reports, reminders.
- Flutter MVP source and self-hosted Supabase/Next.js deployment.

## Data at Stabilization Start
- 29 active staff, 7 departments, no task/HR/asset/document/performance rows, 4 recorded migrations.

## Outstanding
- Replace plaintext/custom authentication; restrict RLS and APIs/uploads.
- Add attendance and push-token migrations; configure notification timers.
- Investigate Server Action noise and add operational monitoring.
```

- [ ] **Step 3: Verify and commit guidance**

```bash
test -s AGENTS.md
for file in projectbrief.md productContext.md systemPatterns.md techContext.md activeContext.md progress.md; do
  test -s "memory-bank/$file" || exit 1
done
if grep -RInE 'TBD|TODO|FIXME' AGENTS.md memory-bank; then exit 1; fi
bash scripts/ops/check-no-secrets.sh
git add AGENTS.md memory-bank
git commit -m "docs: add project guidance and memory bank"
```

Expected: exactly seven guidance/context files committed.

## Task 7: Add Tested Operational Helpers

**Files:**
- Create: `scripts/ops/lib/common.sh`, `scripts/ops/health-check.sh`, `scripts/ops/tests/test-common.sh`

- [ ] **Step 1: Write and run the failing helper test**

Create `scripts/ops/tests/test-common.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(git rev-parse --show-toplevel)/scripts/ops/lib/common.sh"
assert_under /opt/thoidai-backups/run /opt/thoidai-backups
if assert_under /tmp/run /opt/thoidai-backups; then exit 1; fi
valid_slot blue
valid_slot green
if valid_slot red; then exit 1; fi
test "$(slot_port blue)" = 3001
test "$(slot_port green)" = 3002
echo 'common helpers: PASS'
```

Run `bash scripts/ops/tests/test-common.sh`.

Expected: FAIL because the library does not exist.

- [ ] **Step 2: Implement the helper library**

Create `scripts/ops/lib/common.sh`:

```bash
#!/usr/bin/env bash
die() { echo "ERROR: $*" >&2; return 1; }
require_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]] || die 'This command must run as root.'; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }
assert_under() { [[ "$1" = "$2"/* ]] || die "Unsafe path: $1 is not under $2"; }
valid_slot() { [[ "$1" = blue || "$1" = green ]] || die "Invalid slot: $1"; }
slot_port() { case "$1" in blue) echo 3001 ;; green) echo 3002 ;; *) die "Invalid slot: $1" ;; esac; }
```

Run the test again; expected output is `common helpers: PASS`.

- [ ] **Step 3: Create the health check**

Create `scripts/ops/health-check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-}"
BASE_URL="${2:-}"
case "$MODE" in
  app) PATHS=(/ /login) ;;
  public) PATHS=(/ /login /supa/rest/v1/) ;;
  *) echo 'Usage: health-check.sh app|public BASE_URL' >&2; exit 2 ;;
esac
[[ "$BASE_URL" =~ ^https?:// ]] || exit 2
for path in "${PATHS[@]}"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 20 "$BASE_URL$path")"
  case "$code" in 200|204|301|302|307|308) ;; *) echo "$BASE_URL$path -> $code" >&2; exit 1 ;; esac
done
echo "health check: PASS ($MODE $BASE_URL)"
```

Run:

```bash
chmod +x scripts/ops/lib/common.sh scripts/ops/health-check.sh scripts/ops/tests/test-common.sh
bash scripts/ops/tests/test-common.sh
bash scripts/ops/health-check.sh app http://127.0.0.1:3001
bash scripts/ops/health-check.sh public https://thoidai.online
```

Expected: helper and both health modes pass.

- [ ] **Step 4: Commit helpers**

```bash
git add scripts/ops/lib/common.sh scripts/ops/health-check.sh scripts/ops/tests/test-common.sh
git commit -m "ops: add safe production health helpers"
```

## Task 8: Add Blue/Green Release Tooling

**Files:**
- Create: `deploy/systemd/thoidai-work@.service`, slot env files
- Create: Nginx site and blue/green upstream files
- Create: `scripts/ops/prepare-release.sh`, `scripts/ops/switch-slot.sh`, slot test

- [ ] **Step 1: Write and run the failing slot test**

Create `scripts/ops/tests/test-slot-config.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
grep -qx 'PORT=3001' "$REPO/deploy/systemd/blue.env"
grep -qx 'PORT=3002' "$REPO/deploy/systemd/green.env"
grep -q '127.0.0.1:3001' "$REPO/deploy/nginx/upstream-blue.conf"
grep -q '127.0.0.1:3002' "$REPO/deploy/nginx/upstream-green.conf"
grep -q 'proxy_pass http://thoidai_work_active;' "$REPO/deploy/nginx/thoidai-work-site.conf"
grep -q 'WorkingDirectory=/opt/thoidai-slots/%i' "$REPO/deploy/systemd/thoidai-work@.service"
echo 'slot config: PASS'
```

Expected: FAIL because deployment files do not exist.

- [ ] **Step 2: Create systemd slot configuration**

`deploy/systemd/thoidai-work@.service`:

```ini
[Unit]
Description=ThoiDai Work Next.js slot %i
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/thoidai-slots/%i
Environment=NODE_ENV=production
EnvironmentFile=/etc/thoidai-work/app.env
EnvironmentFile=/etc/thoidai-work/%i.env
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port ${PORT}
Restart=always
RestartSec=3
MemoryHigh=500M
MemoryMax=650M
TasksMax=250
ExecStartPre=/usr/bin/test -f /opt/thoidai-slots/%i/.next/BUILD_ID

[Install]
WantedBy=multi-user.target
```

`deploy/systemd/blue.env` is `PORT=3001`; `deploy/systemd/green.env` is `PORT=3002`.

- [ ] **Step 3: Create Nginx configurations**

`deploy/nginx/upstream-blue.conf`:

```nginx
upstream thoidai_work_active { server 127.0.0.1:3001; keepalive 32; }
```

`deploy/nginx/upstream-green.conf`:

```nginx
upstream thoidai_work_active { server 127.0.0.1:3002; keepalive 32; }
```

Create `deploy/nginx/thoidai-work-site.conf`:

```nginx
server {
    server_name thoidai.online www.thoidai.online;

    location = /supa {
        return 308 /supa/rest/v1;
    }

    location = /supa/ {
        return 308 /supa/rest/v1;
    }

    location /supa/ {
        proxy_pass http://127.0.0.1:54331/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://thoidai_work_active;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/thoidai.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/thoidai.online/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name thoidai.online www.thoidai.online;
    return 301 https://$host$request_uri;
}
```

- [ ] **Step 4: Implement immutable release preparation**

Create `scripts/ops/prepare-release.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
require_root
SLOT="${1:-}"
COMMIT="${2:-HEAD}"
REPO="${REPO:-/opt/thoidai-worktrees/production-stabilization}"
RELEASE_ROOT=/opt/thoidai-releases
SLOT_ROOT=/opt/thoidai-slots
valid_slot "$SLOT"
for cmd in git tar npm systemctl curl; do require_command "$cmd"; done
test -z "$(git -C "$REPO" status --porcelain)" || die 'Repository must be clean.'
git -C "$REPO" rev-parse --verify "$COMMIT^{commit}" >/dev/null
test -r /etc/thoidai-work/app.env || die 'Missing runtime environment.'
SHA="$(git -C "$REPO" rev-parse --short=12 "$COMMIT")"
ID="$(date -u +%Y%m%dT%H%M%SZ)-$SHA"
TMP="$RELEASE_ROOT/.tmp-$ID"
FINAL="$RELEASE_ROOT/$ID"
assert_under "$TMP" "$RELEASE_ROOT"
assert_under "$FINAL" "$RELEASE_ROOT"
test ! -e "$TMP" && test ! -e "$FINAL"
install -d -m 0755 "$RELEASE_ROOT" "$SLOT_ROOT" "$TMP"
trap 'if [[ -d "$TMP" ]]; then rm -rf -- "$TMP"; fi' EXIT
git -C "$REPO" archive "$COMMIT" | tar -x -C "$TMP"
(
  cd "$TMP"
  set -a
  source /etc/thoidai-work/app.env
  set +a
  npm ci --no-audit --no-fund
  npm run lint
  npm run build
)
mv -- "$TMP" "$FINAL"
trap - EXIT
ln -sfn "$FINAL" "$SLOT_ROOT/.${SLOT}.new"
mv -Tf "$SLOT_ROOT/.${SLOT}.new" "$SLOT_ROOT/$SLOT"
systemctl restart "thoidai-work@$SLOT.service"
bash "$SCRIPT_DIR/health-check.sh" app "http://127.0.0.1:$(slot_port "$SLOT")"
echo "$FINAL"
```

- [ ] **Step 5: Implement guarded traffic switching**

Create `scripts/ops/switch-slot.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
require_root
SLOT="${1:-}"
valid_slot "$SLOT"
SOURCE="$REPO/deploy/nginx/upstream-$SLOT.conf"
TARGET=/etc/nginx/conf.d/thoidai-work-upstream.conf
PREVIOUS="$(mktemp /etc/nginx/conf.d/thoidai-work-upstream.previous.XXXXXX)"
trap 'rm -f -- "$PREVIOUS"' EXIT
test -s "$SOURCE"
if [[ -f "$TARGET" ]]; then cp -- "$TARGET" "$PREVIOUS"; else : >"$PREVIOUS"; fi
install -m 0644 "$SOURCE" "$TARGET"
if ! nginx -t; then
  if [[ -s "$PREVIOUS" ]]; then install -m 0644 "$PREVIOUS" "$TARGET"; else rm -f -- "$TARGET"; fi
  exit 1
fi
systemctl reload nginx
if ! bash "$SCRIPT_DIR/health-check.sh" public https://thoidai.online; then
  if [[ -s "$PREVIOUS" ]]; then install -m 0644 "$PREVIOUS" "$TARGET"; else rm -f -- "$TARGET"; fi
  nginx -t && systemctl reload nginx
  exit 1
fi
echo "active slot: $SLOT"
```

- [ ] **Step 6: Verify and commit release tooling**

```bash
chmod +x scripts/ops/prepare-release.sh scripts/ops/switch-slot.sh scripts/ops/tests/test-slot-config.sh
bash scripts/ops/tests/test-slot-config.sh
bash -n scripts/ops/prepare-release.sh scripts/ops/switch-slot.sh
bash scripts/ops/check-no-secrets.sh
git add deploy scripts/ops/prepare-release.sh scripts/ops/switch-slot.sh scripts/ops/tests/test-slot-config.sh
git commit -m "ops: add blue green release workflow"
```

Expected: slot test and shell syntax pass.

## Task 9: Install and Exercise Blue/Green Production

**Files:**
- Install systemd/Nginx templates under `/etc`
- Create immutable releases and `/opt/thoidai-slots/{blue,green}`

- [ ] **Step 1: Verify the clean candidate branch**

```bash
cd /opt/thoidai-worktrees/production-stabilization
test -z "$(git status --porcelain)"
bash scripts/ops/tests/test-ignore-policy.sh
bash scripts/ops/tests/test-secret-scan.sh
bash scripts/ops/tests/test-common.sh
bash scripts/ops/tests/test-slot-config.sh
npm ci --no-audit --no-fund
npm run lint
npm run build
bash scripts/ops/health-check.sh public https://thoidai.online
```

Expected: all pass while legacy port 3001 still serves production.

- [ ] **Step 2: Preserve the running legacy build as an immutable rollback release**

```bash
LEGACY_ID="legacy-$(cat /opt/thoidai-work/.next/BUILD_ID)-$(date -u +%Y%m%dT%H%M%SZ)"
LEGACY_RELEASE="/opt/thoidai-releases/$LEGACY_ID"
case "$LEGACY_RELEASE" in /opt/thoidai-releases/legacy-*) ;; *) exit 1 ;; esac
test ! -e "$LEGACY_RELEASE"
install -d -m 0755 "$LEGACY_RELEASE"
rsync -a --exclude='/.git' --exclude='/.env*' --exclude='/backups' --exclude='/releases' \
  --exclude='/mobile' --exclude='/supabase' --exclude='/sql' \
  /opt/thoidai-work/ "$LEGACY_RELEASE/"
test -f "$LEGACY_RELEASE/.next/BUILD_ID"
test -d "$LEGACY_RELEASE/node_modules"
```

- [ ] **Step 3: Install runtime/systemd/Nginx configuration while Nginx still targets 3001**

```bash
install -d -m 0700 /etc/thoidai-work
install -m 0600 /opt/thoidai-work/.env.production /etc/thoidai-work/app.env
install -m 0644 deploy/systemd/blue.env /etc/thoidai-work/blue.env
install -m 0644 deploy/systemd/green.env /etc/thoidai-work/green.env
install -m 0644 deploy/systemd/thoidai-work@.service /etc/systemd/system/thoidai-work@.service
install -m 0644 deploy/nginx/upstream-blue.conf /etc/nginx/conf.d/thoidai-work-upstream.conf
cp /etc/nginx/sites-available/thoidai-work /etc/nginx/sites-available/thoidai-work.pre-blue-green
install -m 0644 deploy/nginx/thoidai-work-site.conf /etc/nginx/sites-available/thoidai-work
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/thoidai-work@.service
if ! nginx -t; then
  install -m 0644 /etc/nginx/sites-available/thoidai-work.pre-blue-green /etc/nginx/sites-available/thoidai-work
  nginx -t
  exit 1
fi
systemctl reload nginx
bash scripts/ops/health-check.sh public https://thoidai.online
```

Expected: public health remains on the legacy app with no interruption.

- [ ] **Step 4: Build green, switch traffic, and observe for 15 minutes**

```bash
REPO=/opt/thoidai-worktrees/production-stabilization bash scripts/ops/prepare-release.sh green HEAD
GREEN_RELEASE="$(readlink -f /opt/thoidai-slots/green)"
test -d "$GREEN_RELEASE"
systemctl is-active thoidai-work@green.service
bash scripts/ops/switch-slot.sh green
for check in $(seq 1 30); do
  bash scripts/ops/health-check.sh public https://thoidai.online
  sleep 30
done
```

Expected: all 30 checks pass. On first failure, run `bash scripts/ops/switch-slot.sh blue` and stop.

- [ ] **Step 5: Convert legacy to managed blue and exercise rollback**

```bash
systemctl stop thoidai-work.service
systemctl disable thoidai-work.service
install -d -m 0755 /opt/thoidai-slots
ln -sfn "$LEGACY_RELEASE" /opt/thoidai-slots/.blue.new
mv -Tf /opt/thoidai-slots/.blue.new /opt/thoidai-slots/blue
systemctl enable --now thoidai-work@blue.service
bash scripts/ops/health-check.sh app http://127.0.0.1:3001
bash scripts/ops/switch-slot.sh blue
bash scripts/ops/switch-slot.sh green
```

Expected: both managed slots are active, each can serve traffic, and final active slot is green.

## Task 10: Document and Verify the Stabilized State

**Files:**
- Create: `docs/operations/production-runbook.md`
- Modify: `memory-bank/activeContext.md`, `memory-bank/progress.md`

- [ ] **Step 1: Write the runbook**

The runbook must record these exact locations and commands:

```markdown
# Production Runbook

- Canonical worktree: `/opt/thoidai-worktrees/production-stabilization`
- Recovery pointer: `/opt/thoidai-backups/LATEST`
- Releases: `/opt/thoidai-releases/`
- Slots: `/opt/thoidai-slots/blue`, `/opt/thoidai-slots/green`
- Runtime environment: `/etc/thoidai-work/app.env`
- Active upstream: `/etc/nginx/conf.d/thoidai-work-upstream.conf`

Verify with policy tests, `npm run lint`, `npm run build`, Flutter analyze, `nginx -t`, and public health.
Release with `scripts/ops/prepare-release.sh SLOT HEAD` and `scripts/ops/switch-slot.sh SLOT`.
Rollback by switching to the known-good inactive slot.
Restore only from a checksum-verified recovery set and never over the live database without a separate incident plan.
```

- [ ] **Step 2: Mark stabilization complete in Memory Bank**

Replace `memory-bank/activeContext.md` with:

```markdown
# Active Context
Production stabilization is complete. Recovery artifacts are verified, the canonical branch is clean and documented, and `thoidai.online` runs managed blue/green Next.js slots behind Nginx. The next phase is authentication and authorization hardening: migrate plaintext passwords, use authenticated Supabase sessions, restrict RLS, and protect API/upload routes. No security-phase database change has been applied yet.
```

Append to `memory-bank/progress.md`:

```markdown

## Stabilization Completed
- Verified Git, filesystem, database, and runtime recovery artifacts.
- Classified and committed maintainable server-only source.
- Excluded secrets, caches, backups, and release artifacts from Git.
- Added authoritative AGENTS and Memory Bank context.
- Verified web and Flutter source.
- Installed and exercised blue/green deployment and rollback without observed downtime.
```

- [ ] **Step 3: Commit docs and run final verification**

```bash
git add docs/operations/production-runbook.md memory-bank/activeContext.md memory-bank/progress.md
bash scripts/ops/check-no-secrets.sh
git diff --cached --check
git commit -m "docs: record stabilized production operations"
test -z "$(git status --porcelain)"
bash scripts/ops/tests/test-ignore-policy.sh
bash scripts/ops/tests/test-secret-scan.sh
bash scripts/ops/tests/test-common.sh
bash scripts/ops/tests/test-slot-config.sh
npm run lint
npm run build
cd mobile/thoidai_work_flutter
FLUTTER_SUPPRESS_ANALYTICS=true /opt/flutter/bin/flutter analyze
cd ../..
systemctl is-active thoidai-work@blue.service
systemctl is-active thoidai-work@green.service
nginx -t
bash scripts/ops/health-check.sh app http://127.0.0.1:3001
bash scripts/ops/health-check.sh app http://127.0.0.1:3002
bash scripts/ops/health-check.sh public https://thoidai.online
git status --short --branch
```

Expected: tests/builds/analysis/health checks pass, both slots are active, and the stabilization branch is clean.

- [ ] **Step 4: Save final evidence beside the recovery set**

```bash
EVIDENCE_DIR="$(cat /opt/thoidai-backups/LATEST)/evidence"
case "$EVIDENCE_DIR" in /opt/thoidai-backups/*/evidence) ;; *) exit 1 ;; esac
install -d -m 0700 "$EVIDENCE_DIR"
git log --oneline --decorate -20 >"$EVIDENCE_DIR/final-git-log.txt"
git status --short --branch >"$EVIDENCE_DIR/final-git-status.txt"
systemctl status thoidai-work@blue.service thoidai-work@green.service --no-pager \
  >"$EVIDENCE_DIR/final-services.txt"
nginx -T >"$EVIDENCE_DIR/final-nginx.txt" 2>&1
curl -sS -o /dev/null -w 'status=%{http_code} total=%{time_total}\n' https://thoidai.online/ \
  >"$EVIDENCE_DIR/final-http.txt"
chmod 0600 "$EVIDENCE_DIR"/*
```

Expected: evidence exists outside Git with mode `0600` and contains no credential values.
