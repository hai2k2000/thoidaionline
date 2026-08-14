# Employee Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Admin-only employee password-reset action that sends a one-use 60-minute email link, records delivery audit state without sensitive data, invalidates older reset links, and revokes all pre-reset sessions when the new password is consumed.

**Architecture:** Keep the current Next.js App Router and HMAC cookie flow. Add a backward-compatible `session_version` epoch to `staff_users` and the signed session payload, use security-definer PostgreSQL functions for atomic reset preparation/finalization/consumption, keep provider delivery behind a dependency-injected server workflow, and add a small pure UI helper for deterministic disabled reasons and API messages. Production currently uses one systemd slot at `/opt/thoidai-work` on port 3001, so deployment builds in an isolated worktree and performs a recoverable `.next` swap with short downtime; it must not pretend blue/green infrastructure exists.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Node.js 22 `node:test`, Supabase JS 2, PostgreSQL/PLpgSQL, bcryptjs, systemd, Nginx, Docker-hosted PostgreSQL.

---

## Execution constraints discovered on 2026-08-14

- The approved design is commit `0fb2af9b57c4c2e6c2bc14398cd7e63c74b36df9` at `docs/superpowers/specs/2026-08-14-employee-password-reset-design.md`.
- The tracked runtime baseline is already modified in `package.json`, `package-lock.json`, `src/app/login/page.tsx`, `src/app/users/page.tsx`, `src/lib/auth.tsx`, and `src/components/appNavState.ts`; `src/components/appNavState.test.mjs` is its modified companion test. The users modal is compressed into one long line, so feature changes overlap that pre-existing hunk and cannot be safely separated with blind path staging.
- These runtime baselines are currently untracked: all six active routes under `src/app/api/auth/`, both forgot/reset password pages, `src/lib/password.ts`, `src/lib/passwordReset.ts`, `src/lib/serverSession.ts`, `src/lib/serverSupabase.ts`, `src/lib/services/audit.ts`, `src/lib/services/common.ts`, and `supabase/migrations/20260813210000_password_reset_security.sql`.
- `src/lib/supabase.ts` is the tracked-clean direct local dependency of `src/lib/auth.tsx` and `src/lib/services/common.ts`. External auth dependencies are represented by the reviewed `package.json` and `package-lock.json` pair, including `bcryptjs` and `@supabase/supabase-js`.
- The untracked `*.pre-forgot` files are archival copies, are not imported or compiled, and are not part of the canonical runtime manifest. Preserve them in the active checkout, but do not stage them as feature or baseline code.
- An untracked file cannot be hunk-staged relative to `HEAD` without committing its entire pre-existing content. Do not claim any reviewed baseline as authored by this feature.
- PostgreSQL already contains `password_hash`, reset-token tables, and `consume_password_reset`, but migration history does not list `20260813210000`. Do not run `supabase db push`; it could replay unrelated unrecorded migrations.
- Production is single-slot: `thoidai-work.service` uses `WorkingDirectory=/opt/thoidai-work`, `ExecStart=/usr/bin/npm run start -- --hostname 0.0.0.0 --port 3001`, and Nginx proxies `thoidai.online` to `127.0.0.1:3001`.
- Preserve the active Codex provider/model and CLIProxyAPI/9router routing. Never read or print runtime environment values, credentials, cookies, raw reset tokens, password values, token hashes, or provider payloads.

## File map

### Create

- `src/lib/sessionToken.ts`: pure HMAC token creation/verification and legacy-version normalization.
- `src/lib/sessionToken.test.mjs`: Node tests for signature, expiry, version validation, and legacy payloads.
- `src/lib/adminPasswordReset.ts`: pure dependency-injected Admin reset workflow and target eligibility.
- `src/lib/adminPasswordReset.test.mjs`: workflow ordering and failure-path tests.
- `src/lib/adminPasswordResetRoute.test.mjs`: source-contract tests for same-origin, Admin-only guards, no-store responses, and explicit API codes.
- `src/lib/adminPasswordResetUi.ts`: pure disabled-reason and API-message mapping.
- `src/lib/adminPasswordResetUi.test.mjs`: UI helper and source-contract tests.
- `supabase/migrations/20260814160000_employee_password_reset_admin.sql`: additive `session_version`, atomic prepare/finalize functions, hardened consume function, and grants.
- `supabase/tests/employee_password_reset_security.sql`: transactional database smoke test.

### Modify

- `src/lib/serverSession.ts`: delegate signing to `sessionToken.ts`, read and compare `session_version`.
- `src/app/api/auth/login/route.ts`: select the current session version and include it in the new cookie.
- `src/app/api/auth/admin-reset/route.ts`: explicit guard/error contract and prepare/send/finalize orchestration.
- `src/app/users/page.tsx`: Admin-only button, disabled reason, confirm dialog, loading state, and safe toast.
- `src/lib/services/audit.ts`: only extend the TypeScript action union if the server route reuses this helper; do not switch the server route to the anon client.

### Verify without changing

- `package.json` and `package-lock.json`: preserve the reviewed `bcryptjs` and `@supabase/supabase-js` dependency baseline required by the current password/session routes.
- `src/app/login/page.tsx`, `src/lib/auth.tsx`, `src/components/appNavState.ts`, and `src/components/appNavState.test.mjs`: preserve the existing forgot-password link, cookie-session client, Admin role policy, and its companion tests before feature work starts.
- `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/logout/route.ts`, and `src/app/api/auth/session/route.ts`: preserve the existing forgot-password request and session lifecycle endpoints.
- `src/app/api/auth/reset-password/route.ts`: continue calling `consume_password_reset` with the same signature.
- `src/app/forgot-password/page.tsx` and `src/app/reset-password/page.tsx`: preserve the existing user-facing reset flow and its token query-parameter contract.
- `src/lib/password.ts`: preserve bcrypt hashing and verification used by login and password consumption.
- `src/lib/passwordReset.ts`: reuse `createResetToken()`, `hashResetToken()`, and `sendResetEmail()`; change only if an explicit typed delivery result is needed.
- `src/lib/serverSupabase.ts`: preserve the service-role server client used by every auth/reset route; never print its environment values.
- `src/lib/services/common.ts`, `src/lib/services/audit.ts`, and `src/lib/supabase.ts`: preserve the direct audit dependency chain and its existing client boundary.
- `supabase/migrations/20260813210000_password_reset_security.sql`: preserve the existing reset-token schema/RPC baseline while adding only the separately numbered admin-reset migration.
- `/etc/systemd/system/thoidai-work.service` and `/etc/systemd/system/thoidai-work.service.d/10-memory-guard.conf`: deployment topology only; no edits in this feature.
- `/etc/nginx/sites-available/thoidai-work`: health/rollback verification only; no edits in this feature.

### Task 1: Establish a recoverable execution base without claiming dirty work

**Files:**
- Read: `/opt/thoidai-work`
- Backup: `/opt/thoidai-backups/employee-password-reset/`
- Future worktree: `/opt/thoidai-worktrees/employee-password-reset`

- [ ] **Step 1: Re-read the approved spec and record the exact source state**

Run:

```bash
git -C /opt/thoidai-work rev-parse HEAD
git -C /opt/thoidai-work status --short
git -C /opt/thoidai-work show --stat --oneline 0fb2af9
```

Expected: `HEAD` is at or descends from `0fb2af9`; status still shows the known dirty paths. If the spec commit is missing, stop.

- [ ] **Step 2: Classify overlap paths and audit direct imports before any implementation edit**

Run from `/opt/thoidai-work`:

```bash
baseline_files=(
  package.json package-lock.json
  src/app/login/page.tsx src/app/users/page.tsx
  src/components/appNavState.ts src/components/appNavState.test.mjs
  src/lib/auth.tsx src/lib/supabase.ts
  src/app/api/auth/admin-reset/route.ts
  src/app/api/auth/forgot-password/route.ts
  src/app/api/auth/login/route.ts
  src/app/api/auth/logout/route.ts
  src/app/api/auth/reset-password/route.ts
  src/app/api/auth/session/route.ts
  src/app/forgot-password/page.tsx src/app/reset-password/page.tsx
  src/lib/password.ts src/lib/passwordReset.ts
  src/lib/serverSession.ts src/lib/serverSupabase.ts
  src/lib/services/audit.ts src/lib/services/common.ts
  supabase/migrations/20260813210000_password_reset_security.sql
)
git status --short -- "${baseline_files[@]}"
for file in "${baseline_files[@]}"; do
  test -f "$file"
  grep -nE '^(import|export)' "$file" || true
done
```

Expected: seven listed tracked files are modified, fifteen listed runtime files are untracked, and `src/lib/supabase.ts` is tracked-clean; archival `*.pre-forgot` files remain outside this manifest. The import scan must show only the reviewed local dependencies (`serverSession`, `serverSupabase`, `password`, `passwordReset`, `auth`, `appNavState`, `services/common`, and `supabase`) plus approved external packages. This is an execution gate, not a prompt to stage files.

- [ ] **Step 3: Create a timestamped source backup and canonical baseline manifest before any commit**

Run from `/opt/thoidai-work`:

```bash
feature_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_root=/opt/thoidai-backups/employee-password-reset/$feature_stamp
install -d -m 0700 "$backup_root/source"
baseline_files=(
  package.json package-lock.json
  src/app/login/page.tsx src/app/users/page.tsx
  src/components/appNavState.ts src/components/appNavState.test.mjs
  src/lib/auth.tsx src/lib/supabase.ts
  src/app/api/auth/admin-reset/route.ts
  src/app/api/auth/forgot-password/route.ts
  src/app/api/auth/login/route.ts
  src/app/api/auth/logout/route.ts
  src/app/api/auth/reset-password/route.ts
  src/app/api/auth/session/route.ts
  src/app/forgot-password/page.tsx src/app/reset-password/page.tsx
  src/lib/password.ts src/lib/passwordReset.ts
  src/lib/serverSession.ts src/lib/serverSupabase.ts
  src/lib/services/audit.ts src/lib/services/common.ts
  supabase/migrations/20260813210000_password_reset_security.sql
)
printf '%s\n' "${baseline_files[@]}" > "$backup_root/canonical-baseline-files.txt"
git status --short > "$backup_root/git-status-before.txt"
git rev-parse HEAD > "$backup_root/head-before.txt"
git diff --binary -- "${baseline_files[@]}" > "$backup_root/pre-feature-tracked.patch"
cp --parents "${baseline_files[@]}" "$backup_root/source"
(
  cd "$backup_root/source"
  find . -type f -print0 | sort -z | xargs -0 sha256sum
) > "$backup_root/source-checksums.txt"
test "$(find "$backup_root/source" -type f | wc -l)" -eq 23
sha256sum "$backup_root/canonical-baseline-files.txt" > "$backup_root/canonical-baseline-files.sha256"
sha256sum "$backup_root/source-checksums.txt" > "$backup_root/source-checksums.sha256"
chmod -R go-rwx "$backup_root"
printf '%s\n' "$backup_root" > /opt/thoidai-backups/employee-password-reset/latest-source-backup.path
```

Expected: the root-only backup contains all twenty-three named baseline files, `source-checksums.txt` is a relative-path SHA-256 manifest, and no secret-bearing environment file was copied.

- [ ] **Step 4: Create the separately authorized canonical baseline commit**

After Step 3 succeeds, review the saved status, tracked patch, and `source-checksums.txt`. The owner-authorized canonicalization may then use only the exact manifest paths:

```bash
cd /opt/thoidai-work
read -r backup_root < /opt/thoidai-backups/employee-password-reset/latest-source-backup.path
mapfile -t baseline_files < "$backup_root/canonical-baseline-files.txt"
test ! -e .git/index.lock
git diff --cached --quiet
git add -- "${baseline_files[@]}"
git diff --cached --name-status -- "${baseline_files[@]}"
test "$(git diff --cached --name-only | wc -l)" -eq 22
git commit -m "chore: record existing auth reset baseline" -- "${baseline_files[@]}"
```

Expected: the pre-commit index is empty, the staged list contains exactly the twenty-two dirty/untracked manifest paths, and tracked-clean `src/lib/supabase.ts` remains inherited from the parent commit and verified by the checksum manifest. The canonical commit contains no unrelated dirty path or feature implementation. Never use `git add -A`, `git add .`, `git commit -a`, `git reset`, `git clean`, `git stash`, or checkout-based overwrite.

- [ ] **Step 5: Create and checksum-verify the isolated feature worktree after canonicalization**

At execution time invoke `superpowers:using-git-worktrees`, then run:

```bash
read -r backup_root < /opt/thoidai-backups/employee-password-reset/latest-source-backup.path
test ! -e /opt/thoidai-worktrees/employee-password-reset
git -C /opt/thoidai-work worktree add \
  -b feat/employee-password-reset \
  /opt/thoidai-worktrees/employee-password-reset \
  main
(
  cd /opt/thoidai-worktrees/employee-password-reset
  sha256sum -c "$backup_root/source-checksums.txt"
  test -z "$(git status --short)"
)
```

Expected: every baseline checksum passes, the new worktree is clean, and it contains the reviewed auth/reset baseline. If any required file is absent or differs, stop before writing tests or implementation code; do not copy untracked files into the feature worktree.

- [ ] **Step 6: Create and verify a recoverable schema inventory without copying authentication material**

Run:

```bash
feature_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_root=/opt/thoidai-backups/employee-password-reset/$feature_stamp
install -d -m 0700 "$backup_root/database"
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -Atc \
  'select current_database(); select to_regclass('"'"'public.staff_users'"'"'), to_regclass('"'"'public.password_reset_tokens'"'"'), to_regclass('"'"'public.password_reset_attempts'"'"'), to_regclass('"'"'public.audit_logs'"'"');' \
  > "$backup_root/database/schema-inventory.txt"
test -s "$backup_root/database/schema-inventory.txt"
sha256sum "$backup_root/database/schema-inventory.txt" \
  > "$backup_root/database/sha256.txt"
```

Expected: `test -s` exits 0. Do not create, read, print, or copy a raw database dump containing password hashes, reset tokens, or other authentication material. A full encrypted database snapshot must be taken and restored only through an already-approved operations mechanism; if no such mechanism exists, stop and request it rather than inventing a dump workflow.

- [ ] **Step 7: Create a dynamic schema-only disposable database with synthetic-data guards**

The fixed database name is unsafe because it can collide and was never provisioned. Create a unique validated name and persist only its name, source path, schema state, and aggregate row counts under a root-only metadata directory. Restore only the `public` schema: the dump also contains managed `realtime`, `auth`, and `storage` objects, and the container's non-superuser `postgres` role cannot restore their privileged function settings. Never perform a full or all-schema restore.

Run from `/opt/thoidai-worktrees/employee-password-reset`:

```bash
set -euo pipefail
feature_stamp=$(date -u +%Y%m%dT%H%M%SZ)
metadata_root=/opt/thoidai-backups/employee-password-reset/$feature_stamp/disposable-db
install -d -m 0700 "$metadata_root"
test_db="thoidai_employee_reset_test_$(date -u +%Y%m%d%H%M%S)"
case "$test_db" in
  thoidai_employee_reset_test_[0-9]*) ;;
  *) echo "invalid disposable database name" >&2; exit 1 ;;
esac
schema_dump=/opt/thoidai-backups/20260731T085309Z/database/thoidai-work.dump
test -s "$schema_dump"
printf '%s\n' "$test_db" > "$metadata_root/test-db.name"
printf '%s\n' "$schema_dump" > "$metadata_root/source-dump.path"
printf '%s\n' 'schema-only --schema=public --no-owner --no-privileges' > "$metadata_root/restore-mode.txt"
chmod 0600 "$metadata_root/test-db.name" "$metadata_root/source-dump.path" "$metadata_root/restore-mode.txt"
printf '%s\n' "$metadata_root" > /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
chmod 0600 /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
if docker exec supabase_db_thoidai-work psql -U postgres -d postgres -Atc \
  "select 1 from pg_database where datname='$test_db';" | grep -q '^1$'; then
  echo "disposable database name collision" >&2
  exit 1
fi
docker exec supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "create database $test_db"
cat "$schema_dump" | docker exec -i supabase_db_thoidai-work \
  pg_restore -U postgres -d "$test_db" \
  --schema-only --schema=public --no-owner --no-privileges --exit-on-error
```

Record schema state using metadata-only queries. Apply the exact existing password-reset migration only when all reset objects are absent:

```bash
read -r metadata_root < /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
read -r test_db < "$metadata_root/test-db.name"
schema_state=$(docker exec supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" -Atc \
  "select to_regclass('public.staff_users') is not null,
          to_regclass('public.password_reset_tokens') is not null,
          to_regclass('public.password_reset_attempts') is not null,
          to_regprocedure('public.consume_password_reset(text,text)') is not null,
          exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='staff_users'
                    and column_name='password_hash');")
printf '%s\n' "$schema_state" > "$metadata_root/schema-state-before.txt"
case "$schema_state" in
  "t|f|f|f|f")
    migration=supabase/migrations/20260813210000_password_reset_security.sql
    account_marker=$(sed -nE "s/.*lower\\(username\\)[[:space:]]*=[[:space:]]*'([^']+)'.*/\\1/p" "$migration" | head -1)
    test -n "$account_marker"
    {
      printf '%s\n' 'begin;'
      cat <<'SQL'
insert into public.roles (id, code, name, level)
values ('00000000-0000-4000-8000-000000000001', 'admin', 'Synthetic Admin', 1);
insert into public.departments (id, code, name, active)
values ('00000000-0000-4000-8000-000000000002', 'fixture', 'Synthetic Department', true);
insert into public.staff_users (
  id, full_name, username, email, phone, password, role_id, department_id, active
) values (
  '00000000-0000-4000-8000-000000000003',
  'Synthetic Reset Admin',
  :'account_marker',
  'reset-admin@example.invalid',
  null,
  repeat('f', 64),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  true
);
SQL
      cat "$migration"
      cat <<'SQL'
delete from public.staff_users where id = '00000000-0000-4000-8000-000000000003';
delete from public.roles where id = '00000000-0000-4000-8000-000000000001';
delete from public.departments where id = '00000000-0000-4000-8000-000000000002';
commit;
SQL
    } | docker exec -i supabase_db_thoidai-work \
      psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -v account_marker="$account_marker"
    printf '%s\n' "$migration" > "$metadata_root/baseline-migration.path"
    ;;
  "t|t|t|t|t")
    printf '%s\n' 'already-present; migration-not-applied' > "$metadata_root/baseline-migration.path"
    ;;
  *) echo "unexpected partial password-reset schema state" >&2; exit 1 ;;
esac
schema_state_after=$(docker exec supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" -Atc \
  "select to_regclass('public.staff_users') is not null,
          to_regclass('public.password_reset_tokens') is not null,
          to_regclass('public.password_reset_attempts') is not null,
          to_regprocedure('public.consume_password_reset(text,text)') is not null,
          exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='staff_users'
                    and column_name='password_hash');")
printf '%s\n' "$schema_state_after" > "$metadata_root/schema-state-after.txt"
test "$schema_state_after" = 't|t|t|t|t'
```

The baseline migration contains a production-account assertion before it creates reset objects. Satisfy that assertion only inside the same transaction as the exact unmodified migration, using deterministic synthetic rows; delete all fixture rows before commit. Extract the required account marker from the migration without printing it, and never persist the migration's account/email literals as data.

Verify that schema-only restore and migration copied no live authentication data, then checksum only metadata files:

```bash
read -r metadata_root < /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
read -r test_db < "$metadata_root/test-db.name"
case "$test_db" in thoidai_employee_reset_test_[0-9]*) ;; *) exit 1 ;; esac
row_counts=$(docker exec supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" -Atc \
  "select 'staff_users', count(*) from public.staff_users
   union all select 'password_reset_tokens', count(*) from public.password_reset_tokens
   union all select 'password_reset_attempts', count(*) from public.password_reset_attempts
   union all select 'audit_logs', count(*) from public.audit_logs
   order by 1;")
printf '%s\n' "$row_counts" > "$metadata_root/row-counts.txt"
test "$(printf '%s\n' "$row_counts" | awk -F'|' '$2 != 0 { print; bad=1 } END { exit bad }')" = ""
sha256sum \
  "$metadata_root/test-db.name" \
  "$metadata_root/source-dump.path" \
  "$metadata_root/restore-mode.txt" \
  "$metadata_root/baseline-migration.path" \
  "$metadata_root/schema-state-before.txt" \
  "$metadata_root/schema-state-after.txt" \
  "$metadata_root/row-counts.txt" \
  > "$metadata_root/sha256.txt"
chmod -R go-rwx "$metadata_root"
```

Expected: the dynamic name matches the allowlisted prefix, the restore excludes managed schemas, schema state is `t|t|t|t|t`, all four row counts are zero, and only root-owned metadata/checksums are persisted. Never retry an all-schema restore after the known managed-schema permission failure. Never insert fixture rows in this step; later fixtures must use deterministic UUIDs, `example.invalid` addresses, and synthetic bcrypt hashes rather than seed credential literals. Retain the database for the checkpoint; dropping it requires explicit confirmation immediately before execution.

### Task 2: Add the database contract with a failing SQL smoke test

**Files:**
- Create: `supabase/tests/employee_password_reset_security.sql`
- Create: `supabase/migrations/20260814160000_employee_password_reset_admin.sql`

- [ ] **Step 1: Write the failing transactional SQL smoke test**

Create `supabase/tests/employee_password_reset_security.sql` with this behavior-focused structure:

```sql
begin;

do $$
declare
  role_id_value uuid := '00000000-0000-4000-8000-000000000001';
  department_id_value uuid := '00000000-0000-4000-8000-000000000002';
  actor_id_value uuid := '00000000-0000-4000-8000-000000000003';
  version_before bigint;
  old_hash text := encode(digest('employee-reset-old-token-fixture', 'sha256'), 'hex');
  new_hash text := encode(digest('employee-reset-new-token-fixture', 'sha256'), 'hex');
  fixture_password_hash text := crypt(
    encode(digest('employee-reset-fixture-password', 'sha256'), 'hex'),
    '$2a$04$abcdefghijklmnopqrstuu'
  );
  prepared record;
  consumed boolean;
begin
  insert into public.roles (id, code, name, level)
  values (role_id_value, 'admin', 'Synthetic Admin', 1);

  insert into public.departments (id, code, name, active)
  values (department_id_value, 'fixture', 'Synthetic Department', true);

  insert into public.staff_users (
    id, full_name, email, phone, password, password_hash,
    role_id, department_id, active
  ) values (
    actor_id_value,
    'Synthetic Reset Admin',
    'reset-admin@example.invalid',
    null,
    null,
    fixture_password_hash,
    role_id_value,
    department_id_value,
    true
  );

  select session_version into version_before
    from public.staff_users
   where id = actor_id_value;

  insert into public.password_reset_tokens (user_id, token_hash, expires_at)
  values (actor_id_value, old_hash, now() + interval '60 minutes');

  select * into prepared
    from public.prepare_admin_password_reset(
      actor_id_value,
      actor_id_value,
      new_hash,
      now() + interval '60 minutes'
    );

  if prepared.token_id is null or prepared.audit_id is null then
    raise exception 'Prepare did not return token and audit ids';
  end if;

  if exists (
    select 1 from public.password_reset_tokens
     where token_hash = old_hash and used_at is null
  ) then
    raise exception 'Older reset token remains active';
  end if;

  if not exists (
    select 1 from public.audit_logs
     where id = prepared.audit_id
       and audit_logs.actor_id = actor_id_value
       and action = 'password_reset'
       and new_data->>'status' = 'pending'
  ) then
    raise exception 'Pending audit was not created';
  end if;

  if not public.finalize_admin_password_reset(
    prepared.token_id,
    prepared.audit_id,
    'sent'
  ) then
    raise exception 'Audit finalization failed';
  end if;

  select public.consume_password_reset(
    new_hash,
    fixture_password_hash
  ) into consumed;

  if consumed is not true then
    raise exception 'Prepared token was not consumed';
  end if;

  if (select session_version from public.staff_users where id = actor_id_value)
     <> version_before + 1 then
    raise exception 'Session version was not incremented exactly once';
  end if;

  if public.consume_password_reset(
    new_hash,
    fixture_password_hash
  ) then
    raise exception 'Token was consumed twice';
  end if;
end;
$$;

rollback;
select 'employee_password_reset_security ok' as result;
```

The fixture is created inside the transaction and rolled back. Its UUIDs and `example.invalid` email are deterministic; its password is generated as a deterministic synthetic bcrypt value from a fixture-only digest. It must never use the seed file's credential literals or any live identifier.

- [ ] **Step 2: Run the SQL test before the migration**

Run:

```bash
read -r metadata_root < /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
read -r test_db < "$metadata_root/test-db.name"
case "$test_db" in thoidai_employee_reset_test_[0-9]*) ;; *) exit 1 ;; esac
docker exec -i supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" \
  -v ON_ERROR_STOP=1 \
  < supabase/tests/employee_password_reset_security.sql
```

Expected: FAIL because `staff_users.session_version` and `prepare_admin_password_reset` do not exist.

- [ ] **Step 3: Write the additive migration**

Create `supabase/migrations/20260814160000_employee_password_reset_admin.sql` with these exact interfaces and constraints:

```sql
alter table public.staff_users
  add column if not exists session_version bigint not null default 0;
alter table public.staff_users
  alter column session_version set default 0;
update public.staff_users set session_version = 0 where session_version is null;
alter table public.staff_users
  alter column session_version set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.staff_users'::regclass
       and conname = 'staff_users_session_version_nonnegative'
  ) then
    alter table public.staff_users
      add constraint staff_users_session_version_nonnegative
      check (session_version >= 0);
  end if;
end;
$$;

create or replace function public.prepare_admin_password_reset(
  p_actor_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table(token_id uuid, audit_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_token_id uuid;
  created_audit_id uuid;
begin
  if not exists (
    select 1
      from public.staff_users actor
      join public.roles actor_role on actor_role.id = actor.role_id
     where actor.id = p_actor_id
       and actor.active = true
       and actor_role.code = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Admin required';
  end if;

  perform 1
    from public.staff_users target
   where target.id = p_user_id
     and target.active = true
     and nullif(btrim(target.email), '') is not null
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Target unavailable';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '61 minutes' then
    raise exception using errcode = '22023', message = 'Invalid reset parameters';
  end if;

  update public.password_reset_tokens
     set used_at = coalesce(used_at, now())
   where user_id = p_user_id
     and used_at is null;

  insert into public.password_reset_tokens (user_id, token_hash, expires_at)
  values (p_user_id, p_token_hash, p_expires_at)
  returning id into created_token_id;

  insert into public.audit_logs (
    actor_id, module, entity_type, entity_id, action, old_data, new_data
  ) values (
    p_actor_id,
    'admin',
    'staff_user',
    p_user_id,
    'password_reset',
    null,
    jsonb_build_object(
      'event', 'employee_password_reset_email',
      'channel', 'email',
      'status', 'pending'
    )
  ) returning id into created_audit_id;

  return query select created_token_id, created_audit_id;
end;
$$;

create or replace function public.finalize_admin_password_reset(
  p_token_id uuid,
  p_audit_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if p_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid audit status';
  end if;

  update public.audit_logs
     set new_data = jsonb_set(
       coalesce(new_data, '{}'::jsonb),
       '{status}',
       to_jsonb(p_status),
       true
     ) || case
       when p_status = 'failed'
       then jsonb_build_object('failure_code', 'delivery_failed')
       else '{}'::jsonb
     end
   where id = p_audit_id
     and module = 'admin'
     and entity_type = 'staff_user'
     and action = 'password_reset'
     and new_data->>'status' = 'pending'
  returning entity_id into target_user_id;

  if target_user_id is null then return false; end if;

  if p_status = 'failed' then
    update public.password_reset_tokens
       set used_at = coalesce(used_at, now())
     where id = p_token_id
       and user_id = target_user_id;
  end if;

  return true;
end;
$$;

create or replace function public.consume_password_reset(
  p_token_hash text,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_user_id uuid;
begin
  update public.password_reset_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now()
  returning user_id into reset_user_id;

  if reset_user_id is null then return false; end if;

  update public.staff_users
     set password_hash = p_password_hash,
         password = null,
         session_version = session_version + 1
   where id = reset_user_id
     and active = true;
  if not found then return false; end if;

  update public.password_reset_tokens
     set used_at = coalesce(used_at, now())
   where user_id = reset_user_id
     and used_at is null;

  return true;
end;
$$;

revoke all on function public.prepare_admin_password_reset(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.finalize_admin_password_reset(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.consume_password_reset(text, text)
  from public, anon, authenticated;

grant execute on function public.prepare_admin_password_reset(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.finalize_admin_password_reset(uuid, uuid, text)
  to service_role;
grant execute on function public.consume_password_reset(text, text)
  to service_role;
```

- [ ] **Step 4: Apply the migration only to the disposable database**

Run:

```bash
read -r metadata_root < /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
read -r test_db < "$metadata_root/test-db.name"
case "$test_db" in thoidai_employee_reset_test_[0-9]*) ;; *) exit 1 ;; esac
docker exec -i supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" \
  -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260814160000_employee_password_reset_admin.sql
```

Expected: exit 0 with `CREATE FUNCTION`, `ALTER TABLE`, `REVOKE`, and `GRANT` notices only.

- [ ] **Step 5: Run the SQL test again**

Run the same `psql` test command from Step 2.

Expected: PASS and final output `employee_password_reset_security ok`.

- [ ] **Step 6: Verify function ACL and schema on the disposable database**

Run:

```bash
read -r metadata_root < /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
read -r test_db < "$metadata_root/test-db.name"
case "$test_db" in thoidai_employee_reset_test_[0-9]*) ;; *) exit 1 ;; esac
docker exec supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" \
  -P pager=off -c '\d public.staff_users'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" \
  -P pager=off -c '\df+ public.prepare_admin_password_reset'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" \
  -P pager=off -c '\df+ public.finalize_admin_password_reset'
```

Expected: `session_version` is non-null with default 0; Admin functions grant execute only to owner and `service_role`.

- [ ] **Step 7: Commit the database contract only**

Run in the isolated worktree:

```bash
git add -- \
  supabase/migrations/20260814160000_employee_password_reset_admin.sql \
  supabase/tests/employee_password_reset_security.sql
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(db): secure employee password reset lifecycle"
```

Expected: the commit contains exactly the new migration and SQL test. If an earlier untracked migration appears, unstage it and stop.

### Task 3: Add backward-compatible signed session versions with TDD

**Files:**
- Create: `src/lib/sessionToken.ts`
- Create: `src/lib/sessionToken.test.mjs`
- Modify: `src/lib/serverSession.ts:3-110`
- Modify: `src/app/api/auth/login/route.ts:13-33`

- [ ] **Step 1: Write failing token tests**

Create `src/lib/sessionToken.test.mjs`:

```js
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  createSignedSessionToken,
  signSessionPayload,
  verifySignedSessionToken,
} from "./sessionToken.ts";

const signingSecret = () => randomBytes(32).toString("base64url");

test("new sessions preserve the database session version", () => {
  const secret = signingSecret();
  const token = createSignedSessionToken({
    userId: "00000000-0000-4000-8000-000000000001",
    sessionVersion: 4,
    secret,
    nowSeconds: 100,
  });
  assert.deepEqual(verifySignedSessionToken({ token, secret, nowSeconds: 101 }), {
    userId: "00000000-0000-4000-8000-000000000001",
    expiresAt: 28900,
    sessionVersion: 4,
  });
});

test("legacy sessions without a version normalize to zero", () => {
  const secret = signingSecret();
  const token = signSessionPayload({
    userId: "00000000-0000-4000-8000-000000000001",
    expiresAt: 200,
  }, secret);
  assert.equal(
    verifySignedSessionToken({ token, secret, nowSeconds: 100 })?.sessionVersion,
    0,
  );
});

test("expired, negative-version and fractional-version sessions are rejected", () => {
  const secret = signingSecret();
  const expired = signSessionPayload({ userId: "u", expiresAt: 99 }, secret);
  const negative = signSessionPayload({ userId: "u", expiresAt: 200, sessionVersion: -1 }, secret);
  const fractional = signSessionPayload({ userId: "u", expiresAt: 200, sessionVersion: 1.5 }, secret);
  assert.equal(verifySignedSessionToken({ token: expired, secret, nowSeconds: 100 }), null);
  assert.equal(verifySignedSessionToken({ token: negative, secret, nowSeconds: 100 }), null);
  assert.equal(verifySignedSessionToken({ token: fractional, secret, nowSeconds: 100 }), null);
});

test("tampered signatures are rejected", () => {
  const secret = signingSecret();
  const token = createSignedSessionToken({ userId: "u", sessionVersion: 0, secret, nowSeconds: 100 });
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(verifySignedSessionToken({ token: tampered, secret, nowSeconds: 101 }), null);
});
```

- [ ] **Step 2: Run the token tests before implementation**

Run:

```bash
node --test src/lib/sessionToken.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `sessionToken.ts`.

- [ ] **Step 3: Implement the pure token module**

Create `src/lib/sessionToken.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type SessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion?: number;
};

export type VerifiedSessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion: number;
};

const signature = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function signSessionPayload(payload: SessionPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function createSignedSessionToken({
  userId,
  sessionVersion,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  userId: string;
  sessionVersion: number;
  secret: string;
  nowSeconds?: number;
}) {
  return signSessionPayload({
    userId,
    expiresAt: nowSeconds + SESSION_TTL_SECONDS,
    sessionVersion,
  }, secret);
}

export function verifySignedSessionToken({
  token,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  token: string | undefined;
  secret: string;
  nowSeconds?: number;
}): VerifiedSessionPayload | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    const sessionVersion = parsed.sessionVersion ?? 0;
    if (!parsed.userId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowSeconds) return null;
    if (!Number.isInteger(sessionVersion) || sessionVersion < 0) return null;
    return { userId: parsed.userId, expiresAt: parsed.expiresAt, sessionVersion };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the token tests after implementation**

Run `node --test src/lib/sessionToken.test.mjs`.

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Wire the pure module into `serverSession.ts`**

Replace the local HMAC/payload implementation with imports and wrappers:

```ts
import { cookies, headers } from "next/headers";
import { serverSupabase } from "@/lib/serverSupabase";
import {
  createSignedSessionToken,
  SESSION_TTL_SECONDS,
  verifySignedSessionToken,
} from "@/lib/sessionToken";

export function createSessionToken(userId: string, sessionVersion: number) {
  return createSignedSessionToken({ userId, sessionVersion, secret: secret() });
}

export function verifySessionToken(token: string | undefined) {
  return verifySignedSessionToken({ token, secret: secret() });
}
```

Extend the `staff_users` select and row check:

```ts
.select("id,full_name,email,username,active,session_version,roles(code,name,role_permissions(can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment))")
```

```ts
const row = data as unknown as {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  active: boolean;
  session_version: number;
  roles: { code: string; name: string; role_permissions: ServerAuthUser["permissions"] | null } | null;
};
if (session.sessionVersion !== row.session_version) return null;
```

Keep cookie name/options and the 8-hour TTL unchanged.

- [ ] **Step 6: Include the current version at login**

In `src/app/api/auth/login/route.ts`, select and type `session_version`, then set:

```ts
response.cookies.set(
  SESSION_COOKIE,
  createSessionToken(row.id, row.session_version),
  sessionCookieOptions,
);
```

Do not change password verification behavior in this task.

- [ ] **Step 7: Type-check and rerun focused tests**

Run:

```bash
node --test src/lib/sessionToken.test.mjs
npx tsc --noEmit
```

Expected: token tests pass; TypeScript exits 0.

- [ ] **Step 8: Commit only the session epoch work**

```bash
git add -- \
  src/lib/sessionToken.ts \
  src/lib/sessionToken.test.mjs \
  src/lib/serverSession.ts \
  src/app/api/auth/login/route.ts
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(auth): revoke sessions with password epoch"
```

Expected: exactly four paths. Compare staged versions of the two pre-existing auth files to the approved canonical base; no earlier untracked work may appear as feature-authored additions.

### Task 4: Build the Admin reset workflow with dependency-injected TDD

**Files:**
- Create: `src/lib/adminPasswordReset.ts`
- Create: `src/lib/adminPasswordReset.test.mjs`

- [ ] **Step 1: Write failing workflow tests**

Create `src/lib/adminPasswordReset.test.mjs` with generated in-memory token material and event-order assertions:

```js
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import {
  executeAdminPasswordReset,
  getAdminResetTargetError,
} from "./adminPasswordReset.ts";

const tokenPair = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
};

const target = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "employee@example.invalid",
  active: true,
};

test("target eligibility distinguishes missing, inactive and missing-email users", () => {
  assert.equal(getAdminResetTargetError(null), "user_not_found");
  assert.equal(getAdminResetTargetError({ ...target, active: false }), "user_inactive");
  assert.equal(getAdminResetTargetError({ ...target, email: null }), "email_missing");
  assert.equal(getAdminResetTargetError(target), null);
});

test("successful delivery prepares before send and finalizes sent", async () => {
  const events = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => { events.push("prepare"); return { tokenId: "t", auditId: "a" }; },
    sendEmail: async () => { events.push("send"); return true; },
    finalize: async ({ status }) => { events.push(`finalize:${status}`); return true; },
  });
  assert.deepEqual(events, ["prepare", "send", "finalize:sent"]);
  assert.deepEqual(result, { ok: true, code: "reset_email_sent" });
});

test("prepare failure never calls the email sender", async () => {
  let sent = false;
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => null,
    sendEmail: async () => { sent = true; return true; },
    finalize: async () => true,
  });
  assert.equal(sent, false);
  assert.deepEqual(result, { ok: false, code: "reset_prepare_failed" });
});

test("prepare exceptions map safely and stop before send", async () => {
  const events = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => { events.push("prepare"); throw new Error("prepare exception"); },
    sendEmail: async () => { events.push("send"); return true; },
    finalize: async () => { events.push("finalize"); return true; },
  });
  assert.deepEqual(events, ["prepare"]);
  assert.deepEqual(result, { ok: false, code: "reset_prepare_failed" });
});

test("delivery failure finalizes failed", async () => {
  const statuses = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => ({ tokenId: "t", auditId: "a" }),
    sendEmail: async () => false,
    finalize: async ({ status }) => { statuses.push(status); return true; },
  });
  assert.deepEqual(statuses, ["failed"]);
  assert.deepEqual(result, { ok: false, code: "email_delivery_failed" });
});

test("sendEmail exceptions are treated as failed delivery and still finalize", async () => {
  const events = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => { events.push("prepare"); return { tokenId: "t", auditId: "a" }; },
    sendEmail: async () => { events.push("send"); throw new Error("delivery exception"); },
    finalize: async ({ status }) => { events.push(`finalize:${status}`); return true; },
  });
  assert.deepEqual(events, ["prepare", "send", "finalize:failed"]);
  assert.deepEqual(result, { ok: false, code: "email_delivery_failed" });
});

test("finalize failure returns an audit error without retrying email", async () => {
  let sends = 0;
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => ({ tokenId: "t", auditId: "a" }),
    sendEmail: async () => { sends += 1; return true; },
    finalize: async () => false,
  });
  assert.equal(sends, 1);
  assert.deepEqual(result, { ok: false, code: "audit_finalize_failed" });
});
```

The example.invalid address is test-only and must never be copied into production data or audit.

- [ ] **Step 2: Run the workflow tests before implementation**

Run `node --test src/lib/adminPasswordReset.test.mjs`.

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the minimal workflow**

Create `src/lib/adminPasswordReset.ts`:

```ts
export type AdminResetTarget = {
  id: string;
  email: string | null;
  active: boolean;
};

export type AdminResetCode =
  | "reset_email_sent"
  | "reset_prepare_failed"
  | "email_delivery_failed"
  | "audit_finalize_failed";

type PreparedReset = { tokenId: string; auditId: string };

export function getAdminResetTargetError(target: AdminResetTarget | null) {
  if (!target) return "user_not_found" as const;
  if (!target.active) return "user_inactive" as const;
  if (!target.email?.trim()) return "email_missing" as const;
  return null;
}

export async function executeAdminPasswordReset({
  actorId,
  target,
  request,
  createToken,
  prepare,
  sendEmail,
  finalize,
}: {
  actorId: string;
  target: AdminResetTarget & { email: string };
  request: Request;
  createToken: () => { token: string; hash: string };
  prepare: (input: {
    actorId: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }) => Promise<PreparedReset | null>;
  sendEmail: (email: string, token: string, request: Request) => Promise<boolean>;
  finalize: (input: PreparedReset & { status: "sent" | "failed" }) => Promise<boolean>;
}): Promise<{ ok: true; code: "reset_email_sent" } | { ok: false; code: Exclude<AdminResetCode, "reset_email_sent"> }> {
  const { token, hash } = createToken();
  let prepared: PreparedReset | null;
  try {
    prepared = await prepare({
      actorId,
      userId: target.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch {
    return { ok: false, code: "reset_prepare_failed" };
  }
  if (!prepared) return { ok: false, code: "reset_prepare_failed" };

  let delivered = false;
  try {
    delivered = await sendEmail(target.email, token, request);
  } catch {
    delivered = false;
  }

  let finalized = false;
  try {
    finalized = await finalize({
      ...prepared,
      status: delivered ? "sent" : "failed",
    });
  } catch {
    return { ok: false, code: "audit_finalize_failed" };
  }
  if (!finalized) return { ok: false, code: "audit_finalize_failed" };
  return delivered
    ? { ok: true, code: "reset_email_sent" }
    : { ok: false, code: "email_delivery_failed" };
}
```

- [ ] **Step 4: Run workflow tests after implementation**

Run `node --test src/lib/adminPasswordReset.test.mjs`.

Expected: 7 tests pass, 0 fail.

- [ ] **Step 5: Commit the pure workflow**

```bash
git add -- src/lib/adminPasswordReset.ts src/lib/adminPasswordReset.test.mjs
git diff --cached --check
git diff --cached --name-status
git commit -m "test(auth): define admin password reset workflow"
```

Expected: exactly two new files.

### Task 5: Harden the Admin reset route with explicit contracts

**Files:**
- Create: `src/lib/adminPasswordResetRoute.test.mjs`
- Modify: `src/app/api/auth/admin-reset/route.ts:1-15`
- Verify: `src/lib/passwordReset.ts:1-60`

- [ ] **Step 1: Write a failing source-contract test for the route**

Create `src/lib/adminPasswordResetRoute.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/api/auth/admin-reset/route.ts", import.meta.url),
  "utf8",
);

test("admin reset route enforces origin, session and exact admin role", () => {
  assert.match(source, /isSameOriginRequest\(\)/);
  assert.match(source, /getSessionUser\(\)/);
  assert.match(source, /actor\.role_code\s*!==\s*["']admin["']/);
});

test("admin reset route exposes explicit safe error codes and no-store responses", () => {
  for (const code of [
    "invalid_request",
    "unauthenticated",
    "invalid_origin",
    "forbidden",
    "user_not_found",
    "user_inactive",
    "email_missing",
    "reset_prepare_failed",
    "audit_finalize_failed",
    "email_delivery_failed",
  ]) assert.match(source, new RegExp(code));
  assert.match(source, /Cache-Control["']:\s*["']private, no-store/);
});

test("admin reset route uses atomic prepare and finalize RPCs", () => {
  assert.match(source, /prepare_admin_password_reset/);
  assert.match(source, /finalize_admin_password_reset/);
  assert.match(source, /executeAdminPasswordReset/);
});

test("admin reset route safely maps unexpected workflow exceptions", () => {
  assert.match(
    source,
    /try\s*\{[\s\S]*executeAdminPasswordReset[\s\S]*\}\s*catch\s*\{[\s\S]*code:\s*["']reset_prepare_failed["']/,
  );
  assert.doesNotMatch(source, /console\.(?:error|warn|log)/);
});
```

- [ ] **Step 2: Run the route contract test before implementation**

Run `node --test src/lib/adminPasswordResetRoute.test.mjs`.

Expected: FAIL because the current 15-line route lacks explicit codes, no-store headers, and atomic RPC calls.

- [ ] **Step 3: Replace the route with the explicit guard and workflow**

Use this structure in `src/app/api/auth/admin-reset/route.ts`:

```ts
import { NextResponse } from "next/server";
import { executeAdminPasswordReset, getAdminResetTargetError } from "@/lib/adminPasswordReset";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createResetToken, sendResetEmail } from "@/lib/passwordReset";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const messages = {
  invalid_request: "Yêu cầu không hợp lệ.",
  unauthenticated: "Phiên đăng nhập không hợp lệ.",
  invalid_origin: "Nguồn yêu cầu không hợp lệ.",
  forbidden: "Chỉ Admin được đặt lại mật khẩu nhân viên.",
  user_not_found: "Không tìm thấy nhân viên.",
  user_inactive: "Không thể đặt lại mật khẩu cho tài khoản đã khóa.",
  email_missing: "Nhân viên chưa có email đăng ký.",
  reset_prepare_failed: "Không thể chuẩn bị yêu cầu đặt lại mật khẩu.",
  audit_finalize_failed: "Không thể hoàn tất nhật ký gửi email.",
  email_delivery_failed: "Không thể gửi email đặt lại mật khẩu.",
  reset_email_sent: "Đã gửi liên kết đặt lại mật khẩu.",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE_HEADERS });

const errorStatus = {
  reset_prepare_failed: 500,
  audit_finalize_failed: 500,
  email_delivery_failed: 502,
} as const;

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) {
    return json({ ok: false, code: "invalid_origin", error: messages.invalid_origin }, 403);
  }
  const actor = await getSessionUser();
  if (!actor) return json({ ok: false, code: "unauthenticated", error: messages.unauthenticated }, 401);
  if (actor.role_code !== "admin") return json({ ok: false, code: "forbidden", error: messages.forbidden }, 403);

  const body = await request.json().catch(() => null) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!UUID_PATTERN.test(userId)) {
    return json({ ok: false, code: "invalid_request", error: messages.invalid_request }, 400);
  }

  const { data, error } = await serverSupabase
    .from("staff_users")
    .select("id,email,active")
    .eq("id", userId)
    .maybeSingle();
  if (error) return json({ ok: false, code: "reset_prepare_failed", error: messages.reset_prepare_failed }, 500);

  const targetError = getAdminResetTargetError(data);
  if (targetError) {
    const status = targetError === "user_not_found" ? 404 : targetError === "user_inactive" ? 409 : 422;
    return json({ ok: false, code: targetError, error: messages[targetError] }, status);
  }

  let result: Awaited<ReturnType<typeof executeAdminPasswordReset>>;
  try {
    result = await executeAdminPasswordReset({
      actorId: actor.id,
      target: { ...data, email: data.email as string },
      request,
      createToken: createResetToken,
      prepare: async ({ actorId, userId: targetId, tokenHash, expiresAt }) => {
        const { data: prepared, error: prepareError } = await serverSupabase.rpc(
          "prepare_admin_password_reset",
          { p_actor_id: actorId, p_user_id: targetId, p_token_hash: tokenHash, p_expires_at: expiresAt },
        );
        const row = Array.isArray(prepared) ? prepared[0] : prepared;
        return prepareError || !row?.token_id || !row?.audit_id
          ? null
          : { tokenId: row.token_id, auditId: row.audit_id };
      },
      sendEmail: sendResetEmail,
      finalize: async ({ tokenId, auditId, status }) => {
        const { data: finalized, error: finalizeError } = await serverSupabase.rpc(
          "finalize_admin_password_reset",
          { p_token_id: tokenId, p_audit_id: auditId, p_status: status },
        );
        return !finalizeError && finalized === true;
      },
    });
  } catch {
    return json(
      { ok: false, code: "reset_prepare_failed", error: messages.reset_prepare_failed },
      500,
    );
  }

  if (!result.ok) {
    return json({ ok: false, code: result.code, error: messages[result.code] }, errorStatus[result.code]);
  }
  return json({ ok: true, code: result.code, message: messages[result.code] });
}
```

Do not log Supabase errors, exception details, target email, raw token, token hash, password fields, cookies, or provider responses. A workflow-level finalize exception leaves the already-created audit row in `pending`; the route returns the safe error and must not retry the workflow or send the email again.

- [ ] **Step 4: Run route and workflow tests**

```bash
node --test \
  src/lib/adminPasswordReset.test.mjs \
  src/lib/adminPasswordResetRoute.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Type-check the route**

Run `npx tsc --noEmit`.

Expected: exit 0. If Supabase generated types make RPC data `unknown`, add a local narrow return type; do not use broad `any`.

- [ ] **Step 6: Commit only the route contract**

```bash
git add -- \
  src/app/api/auth/admin-reset/route.ts \
  src/lib/adminPasswordResetRoute.test.mjs
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(auth): send audited admin reset links"
```

Expected: exactly two paths and no pre-existing auth baseline added as unrelated content.

### Task 6: Add deterministic UI eligibility, confirmation, loading, and toast states

**Files:**
- Create: `src/lib/adminPasswordResetUi.ts`
- Create: `src/lib/adminPasswordResetUi.test.mjs`
- Modify: `src/app/users/page.tsx:30-146`

- [ ] **Step 1: Write failing UI helper and source-contract tests**

Create `src/lib/adminPasswordResetUi.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getPasswordResetDisabledReason,
  passwordResetMessage,
} from "./adminPasswordResetUi.ts";

test("reset eligibility explains inactive, missing-email and submitting states", () => {
  assert.equal(getPasswordResetDisabledReason({ active: false, email: "employee@example.invalid" }, false), "Không thể đặt lại mật khẩu cho tài khoản đã khóa.");
  assert.equal(getPasswordResetDisabledReason({ active: true, email: null }, false), "Nhân viên chưa có email đăng ký.");
  assert.equal(getPasswordResetDisabledReason({ active: true, email: "employee@example.invalid" }, true), "Đang gửi liên kết đặt lại mật khẩu.");
  assert.equal(getPasswordResetDisabledReason({ active: true, email: "employee@example.invalid" }, false), null);
});

test("API error codes map to stable Vietnamese messages", () => {
  assert.equal(passwordResetMessage("email_missing"), "Nhân viên chưa có email đăng ký.");
  assert.equal(passwordResetMessage("user_inactive"), "Không thể đặt lại mật khẩu cho tài khoản đã khóa.");
  assert.equal(passwordResetMessage("reset_email_sent"), "Đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 60 phút.");
  assert.equal(passwordResetMessage("network_error"), "Không thể gửi liên kết đặt lại mật khẩu.");
  assert.equal(passwordResetMessage("unknown"), "Không thể gửi liên kết đặt lại mật khẩu.");
});

test("users page contains admin-only reset confirmation and accessible toast", () => {
  const source = readFileSync(new URL("../app/users/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Đặt lại mật khẩu/);
  assert.match(source, /\/api\/auth\/admin-reset/);
  assert.match(source, /resetState\s*===\s*["']confirming["']/);
  assert.match(source, /resetState\s*===\s*["']submitting["']/);
  assert.match(source, /role=\{resetState\s*===\s*["']error["']\s*\?\s*["']alert["']\s*:\s*["']status["']\}/);
  assert.match(source, /email đã đăng ký/);
  assert.match(source, /isAdmin\s*\?/);
});
```

- [ ] **Step 2: Run UI tests before implementation**

Run `node --test src/lib/adminPasswordResetUi.test.mjs`.

Expected: FAIL because `adminPasswordResetUi.ts` and the reset controls do not exist.

- [ ] **Step 3: Implement the pure UI helper**

Create `src/lib/adminPasswordResetUi.ts`:

```ts
type ResettableEmployee = { active: boolean; email: string | null };

const RESET_MESSAGES: Record<string, string> = {
  email_missing: "Nhân viên chưa có email đăng ký.",
  user_inactive: "Không thể đặt lại mật khẩu cho tài khoản đã khóa.",
  reset_email_sent: "Đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 60 phút.",
  invalid_request: "Yêu cầu đặt lại mật khẩu không hợp lệ.",
  unauthenticated: "Phiên đăng nhập không hợp lệ.",
  forbidden: "Chỉ Admin được đặt lại mật khẩu nhân viên.",
  user_not_found: "Không tìm thấy nhân viên.",
  reset_prepare_failed: "Không thể chuẩn bị yêu cầu đặt lại mật khẩu.",
  audit_finalize_failed: "Không thể hoàn tất nhật ký gửi email.",
  email_delivery_failed: "Không thể gửi email đặt lại mật khẩu.",
  network_error: "Không thể gửi liên kết đặt lại mật khẩu.",
};

export function getPasswordResetDisabledReason(
  employee: ResettableEmployee,
  submitting: boolean,
) {
  if (!employee.active) return RESET_MESSAGES.user_inactive;
  if (!employee.email?.trim()) return RESET_MESSAGES.email_missing;
  if (submitting) return "Đang gửi liên kết đặt lại mật khẩu.";
  return null;
}

export const passwordResetMessage = (code: string) =>
  RESET_MESSAGES[code] ?? "Không thể gửi liên kết đặt lại mật khẩu.";
```

- [ ] **Step 4: Add modal state and submit handler**

In `src/app/users/page.tsx`, import the helper and add:

```ts
type ResetState = "idle" | "confirming" | "submitting" | "success" | "error";

const [resetState, setResetState] = useState<ResetState>("idle");
const [resetToast, setResetToast] = useState("");

const clearPasswordResetState = () => {
  setResetState("idle");
  setResetToast("");
};
```

Call `clearPasswordResetState()` when selecting a fresh employee and when closing the modal. Add the submit handler:

```ts
const submitPasswordReset = async () => {
  if (!selected || !isAdmin || resetState === "submitting") return;
  setResetState("submitting");
  setResetToast("");
  try {
    const response = await fetch("/api/auth/admin-reset", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: selected.id }),
    });
    const payload = await response.json() as { code?: string };
    const code = payload?.code ?? "unknown";
    setResetToast(passwordResetMessage(code));
    setResetState(response.ok ? "success" : "error");
  } catch {
    setResetToast(passwordResetMessage("network_error"));
    setResetState("error");
  } finally {
    setResetState((current) => current === "submitting" ? "error" : current);
  }
};
```

- [ ] **Step 5: Add the Admin-only button, reason, confirm dialog, and toast**

Inside the existing selected-user modal, compute:

```ts
const resetDisabledReason = selected
  ? getPasswordResetDisabledReason(selected, resetState === "submitting")
  : null;
```

Render the button only for Admin:

```tsx
{isAdmin ? (
  <div className="mr-auto">
    <button
      type="button"
      disabled={resetDisabledReason !== null}
      onClick={() => setResetState("confirming")}
      className="rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {resetState === "submitting" ? "Đang gửi..." : "Đặt lại mật khẩu"}
    </button>
    {resetDisabledReason && resetState !== "submitting" ? (
      <p className="mt-1 max-w-xs text-xs text-slate-500">{resetDisabledReason}</p>
    ) : null}
  </div>
) : null}
```

Render a nested confirmation dialog when `resetState === "confirming"`:

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="password-reset-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
  <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
    <h3 id="password-reset-title" className="text-lg font-semibold">Xác nhận đặt lại mật khẩu</h3>
    <p className="mt-2 text-sm text-slate-600">
      Gửi liên kết đặt lại mật khẩu tới email đã đăng ký của {selected.full_name}?
    </p>
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={() => setResetState("idle")} className="rounded bg-slate-200 px-3 py-2 text-sm">Hủy</button>
      <button type="button" onClick={() => void submitPasswordReset()} className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Gửi liên kết</button>
    </div>
  </div>
</div>
```

While submitting, change the visible button text to `Đang gửi...` and disable close/duplicate submission. Render the result inside the employee modal:

```tsx
{resetToast ? (
  <p role={resetState === "error" ? "alert" : "status"} className="mt-3 text-sm text-slate-700">
    {resetToast}
  </p>
) : null}
```

Do not display the target email in confirmation/toast, even though the existing details section may continue showing the registered email.

- [ ] **Step 6: Run UI tests and type-check**

```bash
node --test src/lib/adminPasswordResetUi.test.mjs
npx tsc --noEmit
```

Expected: UI tests pass and TypeScript exits 0.

- [ ] **Step 7: Inspect the UI diff for pre-existing modal content**

```bash
git diff -- src/app/users/page.tsx src/lib/adminPasswordResetUi.ts src/lib/adminPasswordResetUi.test.mjs
```

Expected: the page diff adds only reset-related state/controls plus necessary formatting. If the canonical base still differs from the authoritative pre-feature modal, stop; do not stage the whole line as feature work.

- [ ] **Step 8: Commit only the UI feature**

```bash
git add -- \
  src/app/users/page.tsx \
  src/lib/adminPasswordResetUi.ts \
  src/lib/adminPasswordResetUi.test.mjs
git diff --cached --check
git diff --cached --name-status
git commit -m "feat(users): add employee password reset action"
```

Expected: exactly three paths and no unrelated user-page changes.

### Task 7: Run complete application and security verification

**Files:**
- Test: all new Node tests
- Test: `supabase/tests/employee_password_reset_security.sql`
- Verify: all feature-modified source paths

- [ ] **Step 1: Run all Node tests**

```bash
node --test \
  src/components/appNavState.test.mjs \
  src/lib/evaluationUi.test.mjs \
  src/lib/staffOrdering.test.mjs \
  src/lib/taskEvaluation.test.mjs \
  src/lib/taskPriorityRemoval.test.mjs \
  src/lib/sessionToken.test.mjs \
  src/lib/adminPasswordReset.test.mjs \
  src/lib/adminPasswordResetRoute.test.mjs \
  src/lib/adminPasswordResetUi.test.mjs
```

Expected: 0 failed tests. The Node module-type warning is known and not a failure.

- [ ] **Step 2: Run the SQL smoke test on the disposable database**

```bash
read -r metadata_root < /opt/thoidai-backups/employee-password-reset/latest-test-db-metadata.path
read -r test_db < "$metadata_root/test-db.name"
case "$test_db" in thoidai_employee_reset_test_[0-9]*) ;; *) exit 1 ;; esac
docker exec -i supabase_db_thoidai-work \
  psql -U postgres -d "$test_db" \
  -v ON_ERROR_STOP=1 \
  < supabase/tests/employee_password_reset_security.sql
```

Expected: `employee_password_reset_security ok` and exit 0.

- [ ] **Step 3: Run lint and TypeScript**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both exit 0 with no errors.

- [ ] **Step 4: Build the production candidate in the isolated worktree**

```bash
npm run build
test -s .next/BUILD_ID
```

Expected: Next.js build exits 0 and `.next/BUILD_ID` exists.

- [ ] **Step 5: Check the complete feature diff and commit boundaries**

```bash
git status --short
git log --oneline --decorate main..HEAD
git diff --check main...HEAD
git diff --name-status main...HEAD
```

Expected: only files listed in the File map appear. Each commit is path-specific and contains no pre-existing dirty baseline.

- [ ] **Step 6: Scan changed files without printing matching secret values**

Run a filename-only scan:

```bash
git diff --name-only main...HEAD \
  | grep -E '\.(ts|tsx|mjs|sql|md)$' \
  > /tmp/employee-password-reset-changed-files.txt
test -s /tmp/employee-password-reset-changed-files.txt
```

Review the changed files directly for accidental logging of email, raw token, token hash, password fields, cookie values, provider responses, or credential values. Do not use a command that prints matching lines from possible secret-bearing files. Remove the temporary filename list after review with a non-recursive exact-file operation.

- [ ] **Step 7: Commit verification fixes separately if needed**

If verification required a narrow fix, stage only its exact paths, rerun the failed command, and commit with a specific `fix:` or `test:` message. If no fix was needed, do not create an empty commit.

### Task 8: Apply the database migration with drift controls

**Files:**
- Apply: `supabase/migrations/20260814160000_employee_password_reset_admin.sql`
- Verify: `supabase/tests/employee_password_reset_security.sql`
- Backup: `/opt/thoidai-backups/employee-password-reset/`

- [ ] **Step 1: Take a fresh production database backup immediately before migration**

Repeat Task 1 Step 6 with a new UTC timestamp. Expected: a new root-only schema inventory and checksum, plus confirmation that the approved encrypted snapshot mechanism has produced a recoverable snapshot without this agent reading or copying authentication material.

- [ ] **Step 2: Capture migration history and object definitions read-only**

```bash
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -Atc \
  'select version,name from supabase_migrations.schema_migrations order by version;'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -P pager=off -c \
  '\sf public.consume_password_reset'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -P pager=off -c \
  '\d public.password_reset_tokens'
```

Expected today: reset objects exist while `20260813210000` is absent from migration history. Record this warning in rollout notes; do not run a bulk migration command.

- [ ] **Step 3: Require an explicit migration-history decision**

Recommended: after verifying that the live reset objects match `20260813210000_password_reset_security.sql`, obtain user authorization to record that historical version as applied. If authorization is not granted, continue only with the exact-file manual migration and document that Supabase migration history remains drifted. Never let this plan replay every unrecorded migration.

- [ ] **Step 4: Apply only the approved additive migration**

From `/opt/thoidai-work` after the feature commit is merged or the exact migration file is otherwise verified:

```bash
docker exec -i supabase_db_thoidai-work \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260814160000_employee_password_reset_admin.sql
```

Expected: exit 0. Stop immediately on any error; do not rerun blindly.

- [ ] **Step 5: Verify production schema and grants without reading user rows**

```bash
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -P pager=off -c '\d public.staff_users'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -P pager=off -c '\df+ public.prepare_admin_password_reset'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -P pager=off -c '\df+ public.finalize_admin_password_reset'
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -P pager=off -c '\df+ public.consume_password_reset'
```

Expected: `session_version` exists; Admin functions are not executable by anon/authenticated; consume retains its original signature.

- [ ] **Step 6: Do not run mutation smoke tests against production data**

The behavioral SQL test already passed on the schema-only disposable database with transactional synthetic fixtures. Production verification is schema/ACL-only until a controlled test account is explicitly selected.

### Task 9: Merge and deploy the application through the actual single-slot service

**Files:**
- Source: `/opt/thoidai-work`
- Candidate build: `/opt/thoidai-worktrees/employee-password-reset/.next`
- Service: `thoidai-work.service`
- Nginx: `/etc/nginx/sites-available/thoidai-work`

- [ ] **Step 1: Verify the active checkout cannot lose unrelated dirty work**

```bash
git -C /opt/thoidai-work status --short
git -C /opt/thoidai-work status --short -- \
  src/app/users/page.tsx \
  src/app/api/auth/admin-reset/route.ts \
  src/app/api/auth/login/route.ts \
  src/lib/serverSession.ts \
  src/lib/passwordReset.ts \
  src/lib/services/audit.ts \
  supabase/migrations/20260814160000_employee_password_reset_admin.sql
git -C /opt/thoidai-work diff --cached --name-only
```

Expected: unrelated dirty paths may remain, but every feature-overlap path is clean relative to the canonical base and the index is empty. Otherwise stop; do not merge.

- [ ] **Step 2: Verify the feature branch changes only the approved file map**

```bash
git -C /opt/thoidai-work diff --name-status main...feat/employee-password-reset
git -C /opt/thoidai-work log --oneline main..feat/employee-password-reset
```

Expected: only feature files and frequent feature commits. If any baseline/user change appears, stop.

- [ ] **Step 3: Record the pre-merge commit and fast-forward main**

```bash
feature_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_root=/opt/thoidai-backups/employee-password-reset/$feature_stamp
install -d -m 0700 "$backup_root/deploy"
git -C /opt/thoidai-work rev-parse HEAD > "$backup_root/deploy/pre-merge-head.txt"
printf '%s\n' "$backup_root" \
  > /opt/thoidai-backups/employee-password-reset/latest-deploy-backup.path
git -C /opt/thoidai-work merge --ff-only feat/employee-password-reset
```

Expected: fast-forward only. A merge conflict or non-fast-forward result is a stop condition.

- [ ] **Step 4: Stage the already-built candidate output beside the active build**

```bash
feature_stamp=$(date -u +%Y%m%dT%H%M%SZ)
read -r backup_root \
  < /opt/thoidai-backups/employee-password-reset/latest-deploy-backup.path
candidate_next=/opt/thoidai-work/.next.candidate-$feature_stamp
test ! -e "$candidate_next"
install -d -m 0755 "$candidate_next"
rsync -a /opt/thoidai-worktrees/employee-password-reset/.next/ "$candidate_next/"
test -s "$candidate_next/BUILD_ID"
printf '%s\n' "$candidate_next" > "$backup_root/deploy/candidate-next.path"
```

Expected: candidate has a non-empty `BUILD_ID`. Do not use `rsync --delete` against the active checkout.

- [ ] **Step 5: Validate service and Nginx before the swap**

```bash
systemctl is-active thoidai-work.service
nginx -t
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/login
curl -sS -o /dev/null -w '%{http_code}\n' https://thoidai.online/login
```

Expected: service active, Nginx syntax OK, both HTTP checks return 200.

- [ ] **Step 6: Perform the recoverable `.next` swap**

This host has one application slot, so expect short downtime:

```bash
feature_stamp=$(date -u +%Y%m%dT%H%M%SZ)
read -r backup_root \
  < /opt/thoidai-backups/employee-password-reset/latest-deploy-backup.path
read -r candidate_next < "$backup_root/deploy/candidate-next.path"
previous_next=/opt/thoidai-work/.next.previous-$feature_stamp
test -n "$candidate_next"
test -s "$candidate_next/BUILD_ID"
test ! -e "$previous_next"
systemctl stop thoidai-work.service
mv /opt/thoidai-work/.next "$previous_next"
mv "$candidate_next" /opt/thoidai-work/.next
printf '%s\n' "$previous_next" > "$backup_root/deploy/previous-next.path"
systemctl start thoidai-work.service
systemctl is-active thoidai-work.service
```

Expected: service returns `active`. Keep the previous `.next` directory; do not delete it.

- [ ] **Step 7: Run the complete post-deploy health check**

```bash
hostname
systemctl is-active thoidai-work.service nginx
ps -p "$(systemctl show -p MainPID --value thoidai-work.service)" -o pid,pcpu,pmem,etime,cmd
free -h
df -h /opt
uptime
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'thoidai-work|aylaspa-work'
nginx -t
curl -sS -o /dev/null -w 'LOCAL_HTTP=%{http_code}\n' http://127.0.0.1:3001/login
curl -sS -o /dev/null -w 'PUBLIC_HTTPS=%{http_code}\n' https://thoidai.online/login
docker exec supabase_db_thoidai-work pg_isready -U postgres -d postgres
```

Report exactly: `VPS`, `STATUS`, `CPU`, `RAM`, `DISK`, `LOAD`, `SERVICES`, `DOCKER`, `NGINX`, `DATABASE`, `WARNINGS`, `ERRORS`, `RECOMMENDED ACTION`.

Expected: service and Nginx active, local/public 200, database accepting connections. Mark the single-slot topology and migration-history drift as warnings until separately resolved.

- [ ] **Step 8: Run controlled feature acceptance without exposing identifiers**

Using an explicitly approved test account in the browser:

1. Confirm non-Admin cannot see or call the action.
2. Confirm inactive and missing-email targets show the specified disabled reason.
3. Confirm the dialog prevents duplicate submits and shows loading.
4. Confirm success shows the 60-minute toast.
5. Confirm the older link fails after a newer request.
6. Confirm a link works once and fails on second use.
7. Confirm a pre-reset session receives 401 after consume while another user remains signed in.
8. Query only aggregate audit status counts; do not print target identity or `new_data` wholesale.

Run this exact aggregate-only read-only query for check 8:

```bash
docker exec supabase_db_thoidai-work \
  psql -U postgres -d postgres -Atc \
  "select action, coalesce(new_data->>'status','missing') as status, count(*) from public.audit_logs where action='password_reset' group by action, coalesce(new_data->>'status','missing') order by action,status;"
```

Expected: output contains only action, status, and count fields; it never includes identifiers or raw JSON.

Expected: all eight checks pass and no sensitive value appears in logs or the report.

- [ ] **Step 9: Roll back the application build narrowly if health fails**

Immediate rollback restores the preserved build and does not reset Git or drop schema:

```bash
failed_stamp=$(date -u +%Y%m%dT%H%M%SZ)
failed_next=/opt/thoidai-work/.next.failed-$failed_stamp
read -r backup_root \
  < /opt/thoidai-backups/employee-password-reset/latest-deploy-backup.path
read -r previous_next < "$backup_root/deploy/previous-next.path"
test -n "$previous_next"
test -s "$previous_next/BUILD_ID"
systemctl stop thoidai-work.service
mv /opt/thoidai-work/.next "$failed_next"
mv "$previous_next" /opt/thoidai-work/.next
systemctl start thoidai-work.service
systemctl is-active thoidai-work.service
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/login
```

Expected: old build returns 200. Keep the failed build and all backups for diagnosis.

- [ ] **Step 10: Leave additive database state in place during app rollback**

The previous app ignores `session_version`; `consume_password_reset` keeps its signature. Do not drop the column, reset token tables, audit rows, database, Docker volume, backups, users, or credentials. Restoring an earlier function definition is a separate database change requiring current-state inspection, verified backup, and explicit approval.

- [ ] **Step 11: Decide Git source rollback separately after service recovery**

Do not use `git reset` or checkout overwrite. After reviewing the feature-only commits and confirming overlap paths are clean, use `git revert` only on the feature commit range if the user approves source rollback. Re-run tests/build/health before redeploying the reverted build.

## Final execution evidence

Before calling the feature complete, attach:

- The canonical-base decision and proof no old dirty change was staged or committed by this feature.
- Backup paths, permissions, non-empty checks, and checksums without dump content.
- Red/green outputs for every new Node and SQL test.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` exit results.
- `git diff --name-status main...feat/employee-password-reset` and per-commit file lists.
- Production schema/ACL verification and documented migration-history status.
- Full VPS health report in the required field format.
- Controlled acceptance results without user identity, email, cookies, tokens, hashes, passwords, provider payloads, or credentials.
- Rollback artifact locations; do not delete them as part of this plan.
