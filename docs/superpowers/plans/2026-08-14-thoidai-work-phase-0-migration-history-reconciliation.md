# THỜI ĐẠI WORK Phase 0: Migration-History Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the exact application status of eleven THỜI ĐẠI WORK migration versions and reconcile them with `supabase_migrations.schema_migrations` only if every version becomes `exact-applied` under the all-or-nothing gate, without blindly replaying SQL, weakening password-reset/session protections, changing application routing, or exposing production identities or secrets.

**Architecture:** Freeze the exact source chain and production metadata, create a retained schema-only disposable database with synthetic fixtures, and compare source, catalog, function-body, grant, policy, and aggregate fingerprints version by version. Classify every target as `exact-applied`, `semantically-applied-but-source-differs`, `partially-applied`, or `not-applied`; the history-only transaction is reachable only when all eleven are `exact-applied`. Any safe production source replay is a separately gated Phase-0 execution action after disposable proof, a full root-only backup, a rollback-clean production transaction rehearsal, and explicit preservation checks.

**Tech Stack:** PostgreSQL 17, Supabase migration history, Docker, Bash, `psql`, `pg_dump`/`pg_restore`, Git, SHA-256 manifests, systemd, nginx, and non-interactive SSH to `vps-aylaspa`.

---

## Scope boundary

This runbook targets only these eleven versions and exact source files:

| Version | Source file | SHA-256 | Audited source state |
|---|---|---|---|
| `20260813172000` | `supabase/migrations/20260813172000_task_plans_recipients_self_claim.sql` | `dfc8eee060abf1c9b1f7322521152ce123f304a2095493f6d70e26fe17785a3f` | untracked |
| `20260813210000` | `supabase/migrations/20260813210000_password_reset_security.sql` | `a87f815d5494eb733f525917053f1668875aa9d0c03b38c326387a9312a58212` | tracked |
| `20260813220000` | `supabase/migrations/20260813220000_task_evaluation_total_score.sql` | `0c605442e6b40f3114f931791b1620cd4f8c486b9a0557171b0fe83f04f36105` | untracked |
| `20260813230000` | `supabase/migrations/20260813230000_admin_role_user_policy.sql` | `465b99f9333c52c55fd4ea0821fb0e1e151ff2e8f855610dbf1061124ff397e6` | untracked |
| `20260813233000` | `supabase/migrations/20260813233000_tbt_evaluation_guard.sql` | `064a215f15aa9855ec2568796adf9ceefb992d842d0b809ad341690219688978` | untracked |
| `20260813234500` | `supabase/migrations/20260813234500_creator_evaluation_guard.sql` | `186b20cae2f1b940bb5ebabe3ef622daac852d15952b0f3903d735a1946f8d8b` | untracked |
| `20260814070000` | `supabase/migrations/20260814070000_job_titles.sql` | `191ce77f3d978bee56425589b0735c807b088327134eca122518e75890f77e3a` | untracked |
| `20260814102000` | `supabase/migrations/20260814102000_bulk_task_plans.sql` | `b3ae48c9ede223f92823827a813fa6409a90c797d5b37eea45683b3f4b1a5931` | untracked |
| `20260814130000` | `supabase/migrations/20260814130000_staff_list_order.sql` | `69a8105146379aa57bd9449b909a6898caa87955a637a0385990c2b352b42213` | untracked |
| `20260814160000` | `supabase/migrations/20260814160000_employee_password_reset_admin.sql` | `21198e8092da7a557fc9351aaa5fd8cf02fa7217acabc543561f824eb9a28dbb` | tracked |
| `20260814170000` | `supabase/migrations/20260814170000_employee_password_reset_hardening.sql` | `5583bfa2cf1af13f88e11fce3a58d6afd2c87172f8ce1d837c9c4d649837c533` | tracked |

Five recorded companion versions must be replayed in chronological order on the disposable database because they change the same object chain, but this runbook never inserts or alters their history rows:

| Version | Source file | SHA-256 | Production history count |
|---|---|---|---|
| `20260813110000` | `supabase/migrations/20260813110000_task_evaluation_checkpoints.sql` | `8dc597934a90f01e43b0ff68723daf50b0e361e8f8e362f3bd4ed986384c24f7` | `1` |
| `20260813155000` | `supabase/migrations/20260813155000_allow_tbt_task_evaluation.sql` | `e64047bbde866727e42dc20d58bd64d9e4950a02c5d2e99d003137fc4ec7c5c0` | `1` |
| `20260813184000` | `supabase/migrations/20260813184000_secure_task_rpc_execution.sql` | `6a412f010049c120d06167e6f1622e0923a73401f50dc234f4f1ae20b4353879` | `1` |
| `20260814090000` | `supabase/migrations/20260814090000_task_priority_neutral_default.sql` | `f2d9e4e5ba2a627d70fcf45751e9a05bd8077e4eecc8fe5dab094c8624e293a7` | `1` |
| `20260814113000` | `supabase/migrations/20260814113000_localize_role_names.sql` | `b0c90ccf46a75dca2d6ace9d3d56cd730500853996d44942ceb5e347a6be03c6` | `1` |

Explicit non-goals:

- Never run `supabase db push`, bulk migration application, or an unreviewed `supabase migration repair`.
- Never replay a production migration merely because its history row is absent.
- Never print or persist plaintext passwords, password hashes, reset tokens, session cookies, API keys, environment values, staff identities, emails, task titles, or migration statement bodies.
- Never copy production rows into the disposable database. Its restore is schema-only and its fixtures are synthetic.
- Never stage, commit, revert, stash, reset, clean, or overwrite unrelated dirty-root paths.
- Never change employee password-reset behavior, `session_version`, the active provider/model, CLIProxyAPI, `9router`, systemd units, nginx configuration, application source, or the active build.
- Never drop the retained disposable database, remove backups, delete migration-history rows, restart a service, or restore a database without the separately required authorization for that action.

## Audited starting evidence

- Approved Phase-1 plan commit: `b2916c1a0a5c06ffea1a95414c6ae2cd7fc50485`.
- Production database container: `supabase_db_thoidai-work`; no environment inspection is permitted.
- Production `schema_migrations` currently has nine rows. Its columns are `version text not null`, `statements text[]`, and `name text`; all existing rows have non-null names and statement arrays.
- Every target version has production history count `0`; every companion version has count `1`.
- All eleven target source files exist with the hashes above. Three are tracked and eight are untracked, so checksum evidence—not assumed Git provenance—is mandatory.
- The selected production columns, indexes, constraints, triggers, RLS flags, policies, and RPC signatures exist. Terminal `pg_proc.prosrc` MD5 values match the corresponding terminal source bodies for all thirteen audited functions.
- Production aggregate evidence contains no invalid task compatibility rows, no evaluation score mismatch, no missing password hashes, no legacy password values, no invalid session epochs, no invalid job-title references, and exactly three positive list-order slots with values `1..3`; identities were not read or emitted.
- The current TBT permission flags differ from the literal `20260813230000` end state. This is an unresolved chain/supersession question, not permission to label that version partial or to replay it.
- `20260813210000` contains protected one-time identity/credential DML whose exact historical execution cannot be proven from safe aggregate output alone.
- `20260813233000` is fully superseded at the same function/grant boundary by `20260813234500`; terminal state alone cannot prove the earlier file executed.
- Root-only production apply evidence exists for `20260814160000` and `20260814170000`, with matching source SHA-256, single-transaction exit `0`, no bulk push, and no history repair.

## Decision taxonomy and all-or-nothing gate

Each target gets exactly one classification:

1. `exact-applied`: exact source checksum is locked; all durable object/data/grant effects match the terminal chronological chain; any superseded effect has trusted execution evidence or a rollback-clean exact replay; and protected one-time DML is proven without exposing values.
2. `semantically-applied-but-source-differs`: intended behavior is present, but source/catalog/data fingerprints differ or a one-time effect cannot be proven exact. Do not mark applied. Record a forward-only superseding migration or approved decision record first. A decision record alone never upgrades this category or authorizes a history row; exact execution/evidence must independently satisfy every `exact-applied` requirement.
3. `partially-applied`: only some required effects exist or an intended postcondition is false. Do not replay blindly and do not mark applied. Build a separately reviewed forward-only completion migration or, only after all replay gates pass, execute the exact source transactionally.
4. `not-applied`: no reliable required effects exist. Do not mark applied. Schedule the normal forward migration under a separate reviewed execution.

History repair is all-or-nothing for these eleven versions. If even one row is not `exact-applied`, stop with zero history writes.

## Locked execution artifacts

Phase-0 execution creates artifacts only below a new mode-0700 directory `/opt/thoidai-reconciliation/phase0-{UTC-stamp}` and a retained database named `thoidai_phase0_history_{UTC-stamp}_{random-suffix}` inside the existing PostgreSQL container. No repository source file is created or modified by execution.

---

## Task 1: Freeze Git, source, history, and preservation baselines

**Files:**
- Verify: `/opt/thoidai-work/supabase/migrations/*.sql`
- Create outside Git: `/opt/thoidai-reconciliation/phase0-{stamp}/*`
- No repository modification

- [ ] **Step 1: Prove the approved source ancestry and capture the dirty-root fingerprint**

Run on `vps-aylaspa`:

```bash
set -euo pipefail
cd /opt/thoidai-work
git merge-base --is-ancestor b2916c1a0a5c06ffea1a95414c6ae2cd7fc50485 HEAD
test "$(git diff --cached --name-only | wc -l)" -eq 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
evidence_root="/opt/thoidai-reconciliation/phase0-$stamp"
install -d -m 0700 "$evidence_root"
git rev-parse HEAD > "$evidence_root/head.before"
git rev-parse HEAD^{tree} > "$evidence_root/tree.before"
git status --porcelain=v1 --untracked-files=all > "$evidence_root/root-status.before"
sha256sum "$evidence_root/root-status.before" > "$evidence_root/root-status.before.sha256"
printf '%s\n' "$evidence_root" > /opt/thoidai-reconciliation/phase0.latest
chmod 0600 "$evidence_root"/* /opt/thoidai-reconciliation/phase0.latest
```

Expected: ancestry and empty-index checks exit `0`; only root-readable aggregate/status evidence is written. Never print `root-status.before` because it may contain unrelated path names.

- [ ] **Step 2: Lock the exact sixteen-file chronological source manifest**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
cat > "$evidence_root/source.sha256" <<'EOF'
8dc597934a90f01e43b0ff68723daf50b0e361e8f8e362f3bd4ed986384c24f7  supabase/migrations/20260813110000_task_evaluation_checkpoints.sql
e64047bbde866727e42dc20d58bd64d9e4950a02c5d2e99d003137fc4ec7c5c0  supabase/migrations/20260813155000_allow_tbt_task_evaluation.sql
dfc8eee060abf1c9b1f7322521152ce123f304a2095493f6d70e26fe17785a3f  supabase/migrations/20260813172000_task_plans_recipients_self_claim.sql
6a412f010049c120d06167e6f1622e0923a73401f50dc234f4f1ae20b4353879  supabase/migrations/20260813184000_secure_task_rpc_execution.sql
a87f815d5494eb733f525917053f1668875aa9d0c03b38c326387a9312a58212  supabase/migrations/20260813210000_password_reset_security.sql
0c605442e6b40f3114f931791b1620cd4f8c486b9a0557171b0fe83f04f36105  supabase/migrations/20260813220000_task_evaluation_total_score.sql
465b99f9333c52c55fd4ea0821fb0e1e151ff2e8f855610dbf1061124ff397e6  supabase/migrations/20260813230000_admin_role_user_policy.sql
064a215f15aa9855ec2568796adf9ceefb992d842d0b809ad341690219688978  supabase/migrations/20260813233000_tbt_evaluation_guard.sql
186b20cae2f1b940bb5ebabe3ef622daac852d15952b0f3903d735a1946f8d8b  supabase/migrations/20260813234500_creator_evaluation_guard.sql
191ce77f3d978bee56425589b0735c807b088327134eca122518e75890f77e3a  supabase/migrations/20260814070000_job_titles.sql
f2d9e4e5ba2a627d70fcf45751e9a05bd8077e4eecc8fe5dab094c8624e293a7  supabase/migrations/20260814090000_task_priority_neutral_default.sql
b3ae48c9ede223f92823827a813fa6409a90c797d5b37eea45683b3f4b1a5931  supabase/migrations/20260814102000_bulk_task_plans.sql
b0c90ccf46a75dca2d6ace9d3d56cd730500853996d44942ceb5e347a6be03c6  supabase/migrations/20260814113000_localize_role_names.sql
69a8105146379aa57bd9449b909a6898caa87955a637a0385990c2b352b42213  supabase/migrations/20260814130000_staff_list_order.sql
21198e8092da7a557fc9351aaa5fd8cf02fa7217acabc543561f824eb9a28dbb  supabase/migrations/20260814160000_employee_password_reset_admin.sql
5583bfa2cf1af13f88e11fce3a58d6afd2c87172f8ce1d837c9c4d649837c533  supabase/migrations/20260814170000_employee_password_reset_hardening.sql
EOF
chmod 0600 "$evidence_root/source.sha256"
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256"
```

Expected: sixteen `OK` lines. Any missing or mismatched file is a stop; do not choose a nearby migration or edit a source file.

- [ ] **Step 3: Verify tracked/untracked provenance without changing it**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
git ls-files -- \
  supabase/migrations/20260813210000_password_reset_security.sql \
  supabase/migrations/20260814160000_employee_password_reset_admin.sql \
  supabase/migrations/20260814170000_employee_password_reset_hardening.sql \
  > "$evidence_root/tracked-targets.txt"
test "$(wc -l < "$evidence_root/tracked-targets.txt")" -eq 3
git status --porcelain=v1 --untracked-files=all -- supabase/migrations \
  | grep -E '20260813(172000|220000|230000|233000|234500)|20260814(070000|102000|130000)' \
  > "$evidence_root/untracked-targets.txt"
test "$(wc -l < "$evidence_root/untracked-targets.txt")" -eq 8
chmod 0600 "$evidence_root/tracked-targets.txt" "$evidence_root/untracked-targets.txt"
```

Expected: three tracked and eight untracked target paths, exactly as audited. A later byte-identical baseline commit may change provenance, but it must preserve every source SHA-256 and be recorded before execution resumes.

- [ ] **Step 4: Prove target history is absent and companion history is present**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version,expected) as (values
 ('20260813110000',1),('20260813155000',1),('20260813172000',0),
 ('20260813184000',1),('20260813210000',0),('20260813220000',0),
 ('20260813230000',0),('20260813233000',0),('20260813234500',0),
 ('20260814070000',0),('20260814090000',1),('20260814102000',0),
 ('20260814113000',1),('20260814130000',0),('20260814160000',0),
 ('20260814170000',0)
)
select target.version,target.expected,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version,target.expected
order by target.version;" > "$evidence_root/history.before.tsv"
chmod 0600 "$evidence_root/history.before.tsv"
test "$(awk -F '|' '$2!=$3{bad++} END{print bad+0}' "$evidence_root/history.before.tsv")" -eq 0
```

Expected: sixteen metadata-only rows and zero expected/actual mismatches. Any target already present or companion missing is a stop.

- [ ] **Step 5: Commit no source change**

There is deliberately no Git commit in Phase-0 execution. Re-run:

```bash
cd /opt/thoidai-work
test "$(git diff --cached --name-only | wc -l)" -eq 0
```

Expected: `0`.

## Task 2: Create root-only recovery and pre-change evidence

**Files:**
- Create outside Git: `$evidence_root/database.full.dump`
- Create outside Git: `$evidence_root/*.before.tsv`
- No repository modification

- [ ] **Step 1: Verify the exact production target and service baseline**

```bash
set -euo pipefail
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
nginx -t
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = true
docker exec supabase_db_thoidai-work pg_isready -U postgres -d postgres
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
systemctl show thoidai-work -p NRestarts --value > "$evidence_root/nrestarts.before"
chmod 0600 "$evidence_root/nrestarts.before"
```

Expected: application, nginx, and database are healthy; `NRestarts` is a non-negative integer. Do not read container environment variables.

- [ ] **Step 2: Create and validate a full root-only production database backup**

```bash
set -euo pipefail
umask 077
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
install -m 0600 /dev/null "$evidence_root/database.full.dump"
docker exec supabase_db_thoidai-work pg_dump -U postgres -d postgres --format=custom \
  > "$evidence_root/database.full.dump"
test "$(stat -c '%a' "$evidence_root/database.full.dump")" = 600
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
sha256sum "$evidence_root/database.full.dump" > "$evidence_root/database.full.dump.sha256"
chmod 0600 "$evidence_root/database.full.dump.sha256"
```

Expected: PostgreSQL-17 `pg_dump`, the matching container `pg_restore --list`, and checksum commands exit `0`. The older host `pg_restore` is not used. Never inspect or print dump contents. Never delete or restore this dump during normal reconciliation.

- [ ] **Step 3: Preserve source provenance without copying migration bodies**

```bash
set -euo pipefail
umask 077
cd /opt/thoidai-work
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum -c "$evidence_root/source.sha256"
git rev-parse HEAD > "$evidence_root/source-head.txt"
git rev-parse HEAD^{tree} > "$evidence_root/source-tree.txt"
sha256sum "$evidence_root/source.sha256" "$evidence_root/source-head.txt" \
  "$evidence_root/source-tree.txt" > "$evidence_root/source-provenance.sha256"
chmod 0600 "$evidence_root/source-head.txt" "$evidence_root/source-tree.txt" \
  "$evidence_root/source-provenance.sha256"
```

Expected: exact source hashes and Git provenance are retained without creating another copy of migration bodies. The production root and the pre-existing approved backups remain the recovery sources; Phase 0 never edits a migration file.

- [ ] **Step 4: Capture password/session and business aggregate invariants**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.tasks),
 (select count(*) from public.staff_users),
 (select count(*) from public.staff_users where password_hash is null or password_hash=''),
 (select count(*) from public.staff_users where password is not null),
 (select count(*) from public.staff_users where session_version is null or session_version<0),
 (select coalesce(sum(session_version),0) from public.staff_users),
 (select count(*) from public.password_reset_tokens),
 (select count(*) from public.password_reset_tokens where used_at is null),
 (select count(*) from public.password_reset_attempts),
 (select count(*) from public.task_evaluation_checkpoints),
 (select count(*) from public.task_evaluation_checkpoints
   where total_score is distinct from rating*effort_weight),
 (select count(*) from public.job_titles),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null),
 (select count(*) from public.staff_users where list_order<0),
 (select count(*) from public.staff_users where list_order>0),
 (select count(distinct list_order) from public.staff_users where list_order>0);
" > "$evidence_root/aggregates.before.tsv"
chmod 0600 "$evidence_root/aggregates.before.tsv"
test "$(wc -l < "$evidence_root/aggregates.before.tsv")" -eq 1
```

Expected: one aggregate-only row. No identity, email, password material, token, or business-row value is emitted.

- [ ] **Step 5: Checksum the immutable pre-change evidence set**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum \
  "$evidence_root/head.before" \
  "$evidence_root/tree.before" \
  "$evidence_root/root-status.before" \
  "$evidence_root/source.sha256" \
  "$evidence_root/history.before.tsv" \
  "$evidence_root/nrestarts.before" \
  "$evidence_root/aggregates.before.tsv" \
  > "$evidence_root/PRECHANGE-SHA256SUMS"
chmod 0600 "$evidence_root/PRECHANGE-SHA256SUMS"
(cd "$evidence_root" && sha256sum -c PRECHANGE-SHA256SUMS)
```

Expected: all listed evidence verifies.

## Task 3: Capture production catalog, function, grant, and apply-manifest evidence

**Files:**
- Create outside Git: `$evidence_root/production-catalog.before.tsv`
- Create outside Git: `$evidence_root/production-function-body.before.tsv`
- Verify: existing employee-password-reset apply manifests
- No production write

- [ ] **Step 1: Capture selected columns, tables, constraints, indexes, triggers, and policies**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'COLUMN',table_name,column_name,data_type,is_nullable,
       case when column_default is null then 'no_default' else 'has_default' end,
       is_generated,md5(coalesce(generation_expression,''))
from information_schema.columns
where table_schema='public' and (
 (table_name='tasks' and column_name in ('plan_period','self_claimable','plan_batch_id'))
 or (table_name='staff_users' and column_name in
   ('password','password_hash','job_title_id','list_order','session_version'))
 or (table_name='task_evaluation_checkpoints' and column_name='total_score'))
union all
select 'TABLE',c.relname,'-',c.relkind::text,c.relrowsecurity::text,
       c.relforcerowsecurity::text,'-',
       md5((select string_agg(x.column_name||':'||x.data_type,',' order by x.ordinal_position)
            from information_schema.columns x
            where x.table_schema='public' and x.table_name=c.relname))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('job_titles','password_reset_tokens','password_reset_attempts')
order by 1,2,3;" > "$evidence_root/production-catalog.before.tsv"

docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'INDEX',c.relname,md5(pg_get_indexdef(c.oid))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='i'
  and c.relname in (
   'idx_tasks_self_claimable','idx_password_reset_tokens_user_created',
   'idx_password_reset_tokens_expiry','idx_password_reset_attempts_fingerprint_created',
   'job_titles_code_lower_uidx','job_titles_name_lower_uidx',
   'staff_users_job_title_id_idx','idx_tasks_plan_batch_id','staff_users_list_order_idx')
union all
select 'CONSTRAINT',conname,md5(pg_get_constraintdef(oid,true))
from pg_constraint
where conname in ('tasks_plan_period_check','staff_users_list_order_nonnegative',
                  'staff_users_session_version_nonnegative')
union all
select 'TRIGGER',trigger_name,md5(string_agg(event_manipulation,',' order by event_manipulation))
from information_schema.triggers
where trigger_schema='public' and trigger_name in (
 'validate_task_report_recipient','trg_staff_users_password_hash',
 'job_titles_set_updated_at','staff_users_guard_job_title_write')
group by trigger_name
union all
select 'POLICY',policyname,md5(cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''))
from pg_policies
where schemaname='public' and policyname in (
 'public read job_titles','protect_password_reset_audit_insert',
 'protect_password_reset_audit_update','protect_password_reset_audit_delete')
order by 1,2;" >> "$evidence_root/production-catalog.before.tsv"
chmod 0600 "$evidence_root/production-catalog.before.tsv"
```

Expected: metadata and hashes only; no function body, policy expression, column default, or row value is printed.

- [ ] **Step 2: Capture terminal function body hashes, ownership, configuration, and grants**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select p.proname,pg_get_function_identity_arguments(p.oid),
       pg_get_function_result(p.oid),p.prosecdef,pg_get_userbyid(p.proowner),
       md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan',
 'save_task_evaluation_checkpoint','ensure_staff_password_hash',
 'consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write',
 'create_bulk_task_plan','report_task_progress','review_task_completion',
 'prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" \
  > "$evidence_root/production-function-body.before.tsv"
chmod 0600 "$evidence_root/production-function-body.before.tsv"
test "$(wc -l < "$evidence_root/production-function-body.before.tsv")" -eq 13
```

Expected: thirteen function signature/hash rows. No function body is emitted.

- [ ] **Step 3: Capture role-policy and one-time DML evidence only as aggregates**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'ADMIN_POLICY',
 count(*) filter(where r.code='admin'),
 count(*) filter(where r.code='admin' and rp.can_manage_users and rp.can_manage_permissions
   and rp.can_create_task and rp.can_edit_all_tasks and rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'TBT_POLICY',
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')),
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')
   and not rp.can_manage_users and not rp.can_manage_permissions
   and not rp.can_create_task and not rp.can_edit_all_tasks and not rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'JOB_TITLE',count(*),
 (select count(*) from public.staff_users where job_title_id is not null),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null)
from public.job_titles;
select 'LIST_ORDER',
 count(*) filter(where list_order<0),count(*) filter(where list_order>0),
 count(distinct list_order) filter(where list_order>0),
 coalesce(min(list_order) filter(where list_order>0),0),
 coalesce(max(list_order) filter(where list_order>0),0)
from public.staff_users;" > "$evidence_root/production-data-evidence.before.tsv"
chmod 0600 "$evidence_root/production-data-evidence.before.tsv"
```

Expected: four aggregate-only rows. The audited baseline records the TBT end-state mismatch without printing any staff identity.

- [ ] **Step 4: Verify trusted apply evidence for the two password-reset execution records**

```bash
set -euo pipefail
test -f /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'migration_exit=0' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'single_transaction=true' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'migration_history_modified=false' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'migration_sha256=21198e8092da7a557fc9351aaa5fd8cf02fa7217acabc543561f824eb9a28dbb' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/MANIFEST.txt
(cd /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration && sha256sum -c SHA256SUMS >/dev/null)

test -f /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/migration/apply-status.txt
grep -Fx 'migration_exit=0' /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/migration/apply-status.txt
grep -Fx 'single_transaction=true' /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/migration/apply-status.txt
grep -Fx 'migration_sha256=5583bfa2cf1af13f88e11fce3a58d6afd2c87172f8ce1d837c9c4d649837c533' /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/MANIFEST.txt
(cd /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy && sha256sum -c SHA256SUMS >/dev/null && sha256sum -c POSTDEPLOY-SHA256SUMS >/dev/null)
```

Expected: both exact source hashes, transactional exits, and backup checksum sets verify without reading dump or sensitive evidence contents.

- [ ] **Step 5: Hash the production evidence**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum "$evidence_root"/production-*.before.tsv > "$evidence_root/production-evidence.sha256"
chmod 0600 "$evidence_root/production-evidence.sha256"
(cd "$evidence_root" && sha256sum -c production-evidence.sha256)
```

Expected: all production metadata files verify.

## Task 4: Create a retained schema-only disposable replay database

**Files:**
- Create outside Git: `$evidence_root/public-history-schema.dump`
- Create retained database inside `supabase_db_thoidai-work`
- No production rows copied

- [ ] **Step 1: Create a unique retained database and schema-only dump**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
stamp=${evidence_root##*-}
suffix=$(openssl rand -hex 4)
test_db="thoidai_phase0_history_${stamp,,}_$suffix"
[[ "$test_db" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -Atqc \
  "select count(*) from pg_database where datname='$test_db'" | grep -Fx 0
docker exec supabase_db_thoidai-work pg_dump -U postgres -d postgres \
  --schema=public --schema=supabase_migrations --schema-only --format=custom --no-owner \
  > "$evidence_root/public-history-schema.dump"
chmod 0600 "$evidence_root/public-history-schema.dump"
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/public-history-schema.dump" >/dev/null
docker exec supabase_db_thoidai-work createdb -U postgres --template=template0 "$test_db"
printf '%s\n' "$test_db" > "$evidence_root/disposable-database.name"
chmod 0600 "$evidence_root/disposable-database.name"
```

Expected: a unique retained database exists and the custom schema-only dump validates. This plan never drops it.

- [ ] **Step 2: Restore only schema and required extension plumbing**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c \
  "alter schema public rename to phase0_template_public; create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;"
docker exec -i supabase_db_thoidai-work pg_restore -U postgres -d "$test_db" --no-owner \
  < "$evidence_root/public-history-schema.dump"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -Atqc \
  "select count(*) from public.staff_users" | grep -Fx 0
```

Expected: the empty `template0` public schema is retained under `phase0_template_public`, the archived public/history schemas restore without a schema-name collision, and `staff_users` has zero rows. PostgreSQL-17 `pg_restore` reads the archive from stdin; no dump copy or production data is written into the container filesystem.

- [ ] **Step 3: Seed only synthetic role/permission fixtures for chain decisions**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.roles(id,code,name,level) values
('71000000-0000-4000-8000-000000000001','tong_bien_tap','Synthetic TBT',4),
('71000000-0000-4000-8000-000000000002','tbt_read_only','Synthetic Read Only',0),
('71000000-0000-4000-8000-000000000003','pho_tong_bien_tap','Synthetic Deputy',3),
('71000000-0000-4000-8000-000000000004','phu_trach_phong_tri_su','Synthetic Manager A',3),
('71000000-0000-4000-8000-000000000005','phu_trach_phong_phong_vien','Synthetic Manager B',3),
('71000000-0000-4000-8000-000000000006','phu_trach_phong_bien_tap','Synthetic Manager C',3)
on conflict(code) do nothing;

insert into public.role_permissions(
 role_id,can_manage_users,can_manage_permissions,
 can_create_task,can_edit_all_tasks,can_comment
)
select id,false,false,true,true,true from public.roles
where code in (
 'tong_bien_tap','tbt_read_only','pho_tong_bien_tap',
 'phu_trach_phong_tri_su','phu_trach_phong_phong_vien',
 'phu_trach_phong_bien_tap'
)
on conflict(role_id) do update set
 can_manage_users=excluded.can_manage_users,
 can_manage_permissions=excluded.can_manage_permissions,
 can_create_task=excluded.can_create_task,
 can_edit_all_tasks=excluded.can_edit_all_tasks,
 can_comment=excluded.can_comment;
SQL
```

Expected: only synthetic role metadata is inserted. No staff, password, token, email, task, or audit row is seeded.

- [ ] **Step 4: Record the disposable baseline**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.roles),
 (select count(*) from public.role_permissions),
 (select count(*) from public.staff_users),
 (select count(*) from supabase_migrations.schema_migrations);" \
  > "$evidence_root/disposable.before.tsv"
chmod 0600 "$evidence_root/disposable.before.tsv"
```

Expected: one aggregate-only baseline row; staff and migration-history counts are `0`.

## Task 5: Replay the exact chronological chain on the disposable database

**Files:**
- Verify only: the sixteen locked migration sources
- Create outside Git: `$evidence_root/replay-status.tsv`
- No production write

- [ ] **Step 1: Verify the exact locked chain before streaming it**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum -c "$evidence_root/source.sha256"
```

Expected: all checksums pass. Migration bodies remain only in the existing repository and are streamed to `psql` when needed; no duplicate body is written or printed.

- [ ] **Step 2: Attempt exact sequential replay and hash all command output**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
cd /opt/thoidai-work
install -m 0600 /dev/null "$evidence_root/replay-status.tsv"
chain=(
  20260813110000_task_evaluation_checkpoints.sql
  20260813155000_allow_tbt_task_evaluation.sql
  20260813172000_task_plans_recipients_self_claim.sql
  20260813184000_secure_task_rpc_execution.sql
  20260813210000_password_reset_security.sql
  20260813220000_task_evaluation_total_score.sql
  20260813230000_admin_role_user_policy.sql
  20260813233000_tbt_evaluation_guard.sql
  20260813234500_creator_evaluation_guard.sql
  20260814070000_job_titles.sql
  20260814090000_task_priority_neutral_default.sql
  20260814102000_bulk_task_plans.sql
  20260814113000_localize_role_names.sql
  20260814130000_staff_list_order.sql
  20260814160000_employee_password_reset_admin.sql
  20260814170000_employee_password_reset_hardening.sql
)
for migration in "${chain[@]}"; do
  hash_file="$evidence_root/replay-${migration%%_*}.output.sha256"
  install -m 0600 /dev/null "$hash_file"
  set +e
  docker exec -i supabase_db_thoidai-work psql -X -U postgres -d "$test_db" \
    --single-transaction -v ON_ERROR_STOP=1 -f - \
    < "supabase/migrations/$migration" 2>&1 \
    | sha256sum | cut -d' ' -f1 > "$hash_file"
  replay_pipeline=("${PIPESTATUS[@]}")
  status=${replay_pipeline[0]}
  set -e
  test "${replay_pipeline[1]}" -eq 0
  test "${replay_pipeline[2]}" -eq 0
  read -r output_hash < "$hash_file"
  [[ "$output_hash" =~ ^[0-9a-f]{64}$ ]]
  printf '%s|%s|%s\n' "${migration%%_*}" "$status" "$output_hash" \
    >> "$evidence_root/replay-status.tsv"
  if test "${migration%%_*}" = 20260814130000; then
    test "$status" -ne 0
  else
    test "$status" -eq 0
  fi
done
```

Expected: every version except `20260814130000` exits `0`. The targeted list-order seed must fail on de-identified fixtures rather than guessing identities; only a hash of its error/output stream is retained. Any other failure stops execution.

- [ ] **Step 3: Prove the failed targeted migration rolled back cleanly**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.staff_users),
 (select count(*) from public.audit_logs),
 (select count(*) from public.staff_users where list_order>0),
 (select count(*) from pg_constraint where conrelid='public.staff_users'::regclass
   and conname='staff_users_list_order_nonnegative');" \
  > "$evidence_root/list-order-rollback.tsv"
chmod 0600 "$evidence_root/list-order-rollback.tsv"
grep -Fx '0|0|0|1' "$evidence_root/list-order-rollback.tsv"
```

Expected: no staff/audit/positive-order row exists. The constraint count is `1` because it was already present in the schema-only snapshot, not because a partial transaction survived.

- [ ] **Step 4: Prove source-chain TBT policy and terminal function bodies**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select r.code,rp.can_manage_users,rp.can_manage_permissions,
       rp.can_create_task,rp.can_edit_all_tasks,rp.can_comment
from public.roles r join public.role_permissions rp on rp.role_id=r.id
where r.code in ('tong_bien_tap','tbt_read_only') order by r.code;
select p.proname,pg_get_function_identity_arguments(p.oid),md5(p.prosrc)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan',
 'save_task_evaluation_checkpoint','ensure_staff_password_hash',
 'consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write',
 'create_bulk_task_plan','report_task_progress','review_task_completion',
 'prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" \
  > "$evidence_root/disposable-chain-evidence.tsv"
chmod 0600 "$evidence_root/disposable-chain-evidence.tsv"
```

Expected: both TBT fixture rows have all five legacy booleans `false`; terminal function-body hashes match the locked source chain. This proves `20260813233000`/`20260813234500` supersession and shows that later files do not restore the audited production TBT booleans.

- [ ] **Step 5: Re-run every safe migration to prove idempotency**

Exclude only the targeted identity seed that intentionally failed:

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
cd /opt/thoidai-work
awk -F '|' '$1!="20260814130000"{print $1}' "$evidence_root/replay-status.tsv" \
  > "$evidence_root/idempotent-versions.list"
while read -r version; do
  migration=$(awk -v v="$version" '$2 ~ ("/" v "_"){sub(/^.*\//, "", $2); print $2}' "$evidence_root/source.sha256")
  test -n "$migration"
  hash_file="$evidence_root/idempotency-${version}.output.sha256"
  install -m 0600 /dev/null "$hash_file"
  set +e
  docker exec -i supabase_db_thoidai-work psql -X -U postgres -d "$test_db" \
    --single-transaction -v ON_ERROR_STOP=1 -f - \
    < "supabase/migrations/$migration" 2>&1 \
    | sha256sum | cut -d' ' -f1 > "$hash_file"
  idempotency_pipeline=("${PIPESTATUS[@]}")
  status=${idempotency_pipeline[0]}
  set -e
  test "${idempotency_pipeline[1]}" -eq 0
  test "${idempotency_pipeline[2]}" -eq 0
  read -r output_hash < "$hash_file"
  [[ "$output_hash" =~ ^[0-9a-f]{64}$ ]]
  printf '%s|%s|%s\n' "$version" "$status" "$output_hash" \
    >> "$evidence_root/idempotency-status.tsv"
  test "$status" -eq 0
done < "$evidence_root/idempotent-versions.list"
chmod 0600 "$evidence_root/idempotent-versions.list" "$evidence_root/idempotency-status.tsv"
```

Expected: all fifteen safe-chain files exit `0` on the second pass. This proves technical idempotency only; it does not prove protected one-time DML executed historically.

- [ ] **Step 6: Retain the disposable database and evidence**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum "$evidence_root"/replay-status.tsv \
  "$evidence_root"/idempotency-status.tsv \
  "$evidence_root"/disposable-chain-evidence.tsv \
  > "$evidence_root/disposable-evidence.sha256"
chmod 0600 "$evidence_root/disposable-evidence.sha256"
(cd "$evidence_root" && sha256sum -c disposable-evidence.sha256)
```

Expected: evidence verifies. Do not drop the database or delete its schema dump.

## Task 6: Classify every target and choose a safe action

**Files:**
- Create outside Git: `$evidence_root/classification.tsv`
- No production write

- [ ] **Step 1: Record the audited provisional classifications**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
cat > "$evidence_root/classification.tsv" <<'EOF'
20260813172000|exact-applied-candidate|history-only-after-all-exact|durable-catalog-and-terminal-chain-match
20260813210000|semantically-applied-but-source-differs|stop-forward-only-decision|required-protected-one-time-dml-unprovable
20260813220000|exact-applied-candidate|history-only-after-all-exact|generated-score-and-grant-match
20260813230000|semantically-applied-but-source-differs|stop-chain-decision|production-tbt-flags-differ-from-full-chain
20260813233000|semantically-applied-but-source-differs|stop-or-transactional-pair-replay|effect-fully-superseded-without-independent-apply-record
20260813234500|exact-applied-candidate|history-only-after-all-exact|terminal-function-and-grants-match
20260814070000|exact-applied-candidate|history-only-after-all-exact|catalog-policy-trigger-and-aggregate-match
20260814102000|exact-applied-candidate|history-only-after-all-exact|catalog-rpc-body-and-grants-match
20260814130000|exact-applied-candidate|stop-until-targeted-dml-proof|aggregate-footprint-matches-but-deidentified-replay-blocks
20260814160000|exact-applied|history-only-after-all-exact|trusted-transactional-apply-manifest-and-terminal-state
20260814170000|exact-applied|history-only-after-all-exact|trusted-transactional-apply-manifest-and-terminal-state
EOF
chmod 0600 "$evidence_root/classification.tsv"
```

Expected: eleven rows. `*-candidate` is not an allowed final category and therefore blocks history repair.

- [ ] **Step 2: Apply the exact final-category validator**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
test "$(wc -l < "$evidence_root/classification.tsv")" -eq 11
expected_versions='20260813172000,20260813210000,20260813220000,20260813230000,20260813233000,20260813234500,20260814070000,20260814102000,20260814130000,20260814160000,20260814170000'
test "$(cut -d'|' -f1 "$evidence_root/classification.tsv" | sort -u | paste -sd, -)" = "$expected_versions"
test "$(awk -F '|' 'NF!=4{bad++} END{print bad+0}' "$evidence_root/classification.tsv")" -eq 0
gate_file="$evidence_root/HISTORY-GATE.status"
gate_tmp="$gate_file.tmp"
if test "$(awk -F '|' '$2!="exact-applied"{bad++} END{print bad+0}' "$evidence_root/classification.tsv")" -ne 0; then
  printf '%s\n' 'STOP: at least one target is not exact-applied' \
    > "$gate_tmp"
else
  printf '%s\n' 'EXACT: all eleven targets are exact-applied' > "$gate_tmp"
fi
chmod 0600 "$gate_tmp"
mv -f -- "$gate_tmp" "$gate_file"
grep -Fx 'STOP: at least one target is not exact-applied' "$gate_file"
```

Expected for the audited baseline: the gate contains the exact `STOP` line. Re-run this validator after any approved classification update; it overwrites the status atomically at the shell-redirection level and never treats a stale stop marker as current evidence. Do not execute Task 8 while the gate is `STOP`.

- [ ] **Step 3: Decision procedure for `exact-applied`**

A version may be changed from `exact-applied-candidate` to `exact-applied` only when all of these exact checks pass:

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256"
(cd "$evidence_root" && sha256sum -c production-evidence.sha256 && sha256sum -c disposable-evidence.sha256)
test "$(awk -F '|' '$2!=$3{bad++} END{print bad+0}' "$evidence_root/history.before.tsv")" -eq 0
```

Expected: source, production, disposable, and history evidence all verify; version-specific durable and supersession requirements must also have a trusted proof path.

- [ ] **Step 4: Decision procedure for `semantically-applied-but-source-differs`**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
grep -F '|semantically-applied-but-source-differs|' "$evidence_root/classification.tsv" \
  > "$evidence_root/semantic-drift.list"
chmod 0600 "$evidence_root/semantic-drift.list"
test -s "$evidence_root/semantic-drift.list"
```

Expected: each row remains blocked. Produce a separately reviewed forward-only migration or an approved chain decision record; do not change its history row.

- [ ] **Step 5: Decision procedure for `partially-applied`**

If a later audit proves only a subset of effects, change that row to `partially-applied|stop-forward-only-completion|aggregate-reason-code`, replacing the final field with an approved non-sensitive reason token, and run:

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
if grep -F '|partially-applied|' "$evidence_root/classification.tsv" >/dev/null; then
  grep -Fx 'STOP: at least one target is not exact-applied' "$evidence_root/HISTORY-GATE.status"
fi
```

Expected: history remains unchanged. The completion migration is a separate implementation plan and must not reuse an already ambiguous version number.

- [ ] **Step 6: Decision procedure for `not-applied`**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
if grep -F '|not-applied|' "$evidence_root/classification.tsv" >/dev/null; then
  grep -Fx 'STOP: at least one target is not exact-applied' "$evidence_root/HISTORY-GATE.status"
fi
```

Expected: history remains unchanged. Schedule normal forward execution under its own backup/test/deploy gate.

## Task 7: Resolve the protected and superseded versions without weakening security

**Files:**
- Create outside Git: decision evidence under `$evidence_root`
- No automatic history write

- [ ] **Step 1: Keep `20260813210000` blocked from production replay**

The exact file includes protected one-time identity/credential transformation. Disposable idempotency cannot prove that production DML executed, and replay could alter password/session state. Enforce the block:

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
grep -Fx '20260813210000|semantically-applied-but-source-differs|stop-forward-only-decision|required-protected-one-time-dml-unprovable' \
  "$evidence_root/classification.tsv"
(cd "$evidence_root" && sha256sum -c PRECHANGE-SHA256SUMS)
test "$(awk -F '|' 'NF!=16 || $3!=0 || $4!=0 || $5!=0{bad++} END{print bad+0}' \
  "$evidence_root/aggregates.before.tsv")" -eq 0
```

Expected: the row remains non-exact, the sealed pre-change evidence verifies, and aggregate fields prove zero missing password hashes, zero surviving legacy-password values, and zero invalid session epochs without printing values. Recommended resolution is a new forward-only superseding migration plus an approved decision record that asserts current password-hash, legacy-password-null, reset-table, and session-epoch postconditions without repeating historical targeted DML. Neither artifact alone marks the old version applied; do not change `20260813210000` to `exact-applied` until exact execution/evidence satisfies the category requirements.

- [ ] **Step 2: Resolve the `20260813230000` TBT flag difference through full-chain evidence**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
grep -F '20260813230000|' "$evidence_root/classification.tsv"
test "$(awk -F '|' '$1=="TBT_POLICY"{print $3}' "$evidence_root/production-data-evidence.before.tsv")" -ne 2
test "$(awk -F '|' '$1=="tong_bien_tap" || $1=="tbt_read_only" {if($2!="f"||$3!="f"||$4!="f"||$5!="f"||$6!="f") bad++} END{print bad+0}' "$evidence_root/disposable-chain-evidence.tsv")" -eq 0
```

Expected for the audited baseline: production differs while exact chronological replay leaves both synthetic TBT roles false. Stop for a business/source-chain decision. Do not assume the difference is accidental, and do not replay `20260813230000` until a separately reviewed decision proves the exact source end state is still desired.

- [ ] **Step 3: Resolve `20260813233000` only with paired terminal replay evidence**

`20260813233000` may become exact only if its exact source and the superseding `20260813234500` are replayed in order in one rollback-clean transaction, with no table data, password/session aggregate, or terminal function/grant drift.

First, rehearse on the retained disposable database:

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
read -r test_db < "$evidence_root/disposable-database.name"
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256"
pair_hash_file="$evidence_root/evaluation-pair-rollback.output.sha256"
install -m 0600 /dev/null "$pair_hash_file"
set +e
{
  printf 'begin;\n'
  cat -- supabase/migrations/20260813233000_tbt_evaluation_guard.sql || exit
  printf '\n'
  cat -- supabase/migrations/20260813234500_creator_evaluation_guard.sql || exit
  printf '\nrollback;\n'
} | docker exec -i supabase_db_thoidai-work psql -X -U postgres -d "$test_db" \
  -v ON_ERROR_STOP=1 2>&1 | sha256sum | cut -d' ' -f1 > "$pair_hash_file"
pair_pipeline=("${PIPESTATUS[@]}")
pair_source_status=${pair_pipeline[0]}
pair_status=${pair_pipeline[1]}
set -e
read -r pair_hash < "$pair_hash_file"
printf '%s|%s|%s\n' "$pair_source_status" "$pair_status" "$pair_hash" \
  > "$evidence_root/evaluation-pair-rollback.tsv"
chmod 0600 "$evidence_root/evaluation-pair-rollback.tsv"
test "$pair_source_status" -eq 0
test "$pair_status" -eq 0
test "${pair_pipeline[2]}" -eq 0
test "${pair_pipeline[3]}" -eq 0
[[ "$pair_hash" =~ ^[0-9a-f]{64}$ ]]
```

Expected: transaction exits `0` and rolls back. This is necessary but not sufficient for production replay.

- [ ] **Step 4: Gate any production exact-source replay**

Production replay is forbidden unless all of these hold:

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
test -f "$evidence_root/database.full.dump"
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
(cd "$evidence_root" && sha256sum -c database.full.dump.sha256)
test "$(awk -F '|' '$1=="20260813210000" || $1=="20260814130000" {if($3 ~ /replay/) bad++} END{print bad+0}' "$evidence_root/classification.tsv")" -eq 0
test "$(git -C /opt/thoidai-work diff --cached --name-only | wc -l)" -eq 0
```

Expected: full backup verifies, protected targeted-DML versions are absent from replay actions, and index is empty. If the separately reviewed decision does not name an exact replay set and prove disposable final-state equivalence, stop.

- [ ] **Step 5: Rehearse an approved safe replay on production with mandatory rollback**

For the currently plausible function-only pair, hash all output and force rollback:

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256"
dry_hash_file="$evidence_root/production-safe-replay-rollback.output.sha256"
install -m 0600 /dev/null "$dry_hash_file"
set +e
{
  printf 'begin;\n'
  cat -- supabase/migrations/20260813233000_tbt_evaluation_guard.sql || exit
  printf '\n'
  cat -- supabase/migrations/20260813234500_creator_evaluation_guard.sql || exit
  printf '\n'
  cat <<'SQL'
do $check$
begin
  if md5((select prosrc from pg_proc where oid='public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure))
     <> 'fd7d6a8ac47f607f135a323ef73572c0' then
    raise exception 'terminal function fingerprint mismatch';
  end if;
end
$check$;
rollback;
SQL
} | docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres \
  -v ON_ERROR_STOP=1 2>&1 | sha256sum | cut -d' ' -f1 > "$dry_hash_file"
dry_pipeline=("${PIPESTATUS[@]}")
dry_source_status=${dry_pipeline[0]}
dry_status=${dry_pipeline[1]}
set -e
read -r dry_hash < "$dry_hash_file"
printf '%s|%s|%s\n' "$dry_source_status" "$dry_status" "$dry_hash" \
  > "$evidence_root/production-safe-replay-rollback.tsv"
chmod 0600 "$evidence_root/production-safe-replay-rollback.tsv"
test "$dry_source_status" -eq 0
test "$dry_status" -eq 0
test "${dry_pipeline[2]}" -eq 0
test "${dry_pipeline[3]}" -eq 0
[[ "$dry_hash" =~ ^[0-9a-f]{64}$ ]]
```

Expected: exact pair runs and rolls back with terminal body hash intact. Password/session aggregates must still compare byte-for-byte with `aggregates.before.tsv` after rollback.

- [ ] **Step 6: Execute a safe replay only after the replay decision is approved**

This step is MODIFY and is skipped in the audited baseline unless the active Phase-0 execution decision explicitly approves the function-only pair. It must never include `20260813210000` or `20260814130000`.

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
test -f "$evidence_root/production-safe-replay-rollback.tsv"
grep -E '^0\|0\|' "$evidence_root/production-safe-replay-rollback.tsv"
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256"
set +e
{
  printf 'begin;\n'
  cat -- supabase/migrations/20260813233000_tbt_evaluation_guard.sql || exit
  printf '\n'
  cat -- supabase/migrations/20260813234500_creator_evaluation_guard.sql || exit
  printf '\n'
  cat <<'SQL'
do $check$
begin
  if md5((select prosrc from pg_proc where oid='public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure))
     <> 'fd7d6a8ac47f607f135a323ef73572c0' then
    raise exception 'terminal function fingerprint mismatch';
  end if;
end
$check$;
commit;
SQL
} | docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -v ON_ERROR_STOP=1
commit_pipeline=("${PIPESTATUS[@]}")
set -e
test "${commit_pipeline[0]}" -eq 0
test "${commit_pipeline[1]}" -eq 0
```

Expected when explicitly eligible: one transaction commits only the exact function/grant pair; no table row or session epoch changes. Re-capture and compare all aggregates immediately. If any protected aggregate differs, stop and use the full backup only under a separately confirmed restore procedure.

- [ ] **Step 7: Keep targeted list-order replay blocked without de-identified exact proof**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
grep -F '20260814130000|' "$evidence_root/classification.tsv"
grep -F '20260814130000|' "$evidence_root/replay-status.tsv" | awk -F '|' '$2!=0{ok=1} END{exit(ok?0:1)}'
```

Expected: the exact migration cannot replay on identity-free fixtures. Preserve the aggregate production footprint and source checksum, but do not replay or mark applied until a trusted apply record or approved non-identifying proof exists.

## Task 8: Insert all eleven history rows in one transaction only after all evidence is exact

**Files:**
- Modify conditionally: production `supabase_migrations.schema_migrations`
- No schema, application, source, or service modification

- [ ] **Step 1: Enforce the all-exact precondition**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
grep -Fx 'EXACT: all eleven targets are exact-applied' "$evidence_root/HISTORY-GATE.status"
test "$(wc -l < "$evidence_root/classification.tsv")" -eq 11
expected_versions='20260813172000,20260813210000,20260813220000,20260813230000,20260813233000,20260813234500,20260814070000,20260814102000,20260814130000,20260814160000,20260814170000'
test "$(cut -d'|' -f1 "$evidence_root/classification.tsv" | sort -u | paste -sd, -)" = "$expected_versions"
test "$(awk -F '|' '$2!="exact-applied"{bad++} END{print bad+0}' "$evidence_root/classification.tsv")" -eq 0
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256"
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
(cd "$evidence_root" && sha256sum -c database.full.dump.sha256 && sha256sum -c PRECHANGE-SHA256SUMS)
```

Expected for the current audited baseline: this step stops because unresolved rows exist. History remains unchanged.

- [ ] **Step 2: Re-read history immediately before the write**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version) as (values
 ('20260813172000'),('20260813210000'),('20260813220000'),
 ('20260813230000'),('20260813233000'),('20260813234500'),
 ('20260814070000'),('20260814102000'),('20260814130000'),
 ('20260814160000'),('20260814170000'))
select target.version,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version order by target.version;" > "$evidence_root/history.immediate-before.tsv"
chmod 0600 "$evidence_root/history.immediate-before.tsv"
test "$(awk -F '|' '$2!=0{bad++} END{print bad+0}' "$evidence_root/history.immediate-before.tsv")" -eq 0
```

Expected: all eleven counts remain `0`. Any non-zero count stops the transaction.

- [ ] **Step 3: Insert exact metadata atomically and verify inside the transaction**

This is the only history MODIFY command in the runbook. The audited table has a primary key only on `version`; `statements` is `text[]` with no default or check constraint, and `name` is `text`. Every inserted name is the exact filename suffix. Empty statement arrays are therefore type/schema-compatible and intentionally avoid copying migration bodies or protected literals into history; source SHA-256 evidence remains in the root-only evidence directory.

```bash
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
begin isolation level serializable;
lock table supabase_migrations.schema_migrations in exclusive mode;

do $pre$
declare v_count integer;
begin
  select count(*) into v_count
  from supabase_migrations.schema_migrations
  where version in (
    '20260813172000','20260813210000','20260813220000',
    '20260813230000','20260813233000','20260813234500',
    '20260814070000','20260814102000','20260814130000',
    '20260814160000','20260814170000'
  );
  if v_count<>0 then raise exception 'target history changed'; end if;
end
$pre$;

insert into supabase_migrations.schema_migrations(version,name,statements) values
('20260813172000','task_plans_recipients_self_claim',array[]::text[]),
('20260813210000','password_reset_security',array[]::text[]),
('20260813220000','task_evaluation_total_score',array[]::text[]),
('20260813230000','admin_role_user_policy',array[]::text[]),
('20260813233000','tbt_evaluation_guard',array[]::text[]),
('20260813234500','creator_evaluation_guard',array[]::text[]),
('20260814070000','job_titles',array[]::text[]),
('20260814102000','bulk_task_plans',array[]::text[]),
('20260814130000','staff_list_order',array[]::text[]),
('20260814160000','employee_password_reset_admin',array[]::text[]),
('20260814170000','employee_password_reset_hardening',array[]::text[]);

do $post$
declare v_count integer;
begin
  select count(*) into v_count
  from supabase_migrations.schema_migrations
  where version in (
    '20260813172000','20260813210000','20260813220000',
    '20260813230000','20260813233000','20260813234500',
    '20260814070000','20260814102000','20260814130000',
    '20260814160000','20260814170000'
  ) and name is not null and statements='{}'::text[];
  if v_count<>11 then raise exception 'history read-back mismatch'; end if;
end
$post$;

commit;
SQL
```

Expected only after every prior gate passes: `INSERT 0 11`, both assertion blocks succeed, and one commit completes. Any error rolls back all eleven rows.

- [ ] **Step 4: Read back exact history metadata**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select version,name,cardinality(statements)
from supabase_migrations.schema_migrations
where version in (
 '20260813172000','20260813210000','20260813220000',
 '20260813230000','20260813233000','20260813234500',
 '20260814070000','20260814102000','20260814130000',
 '20260814160000','20260814170000')
order by version;" > "$evidence_root/history.after.tsv"
chmod 0600 "$evidence_root/history.after.tsv"
test "$(wc -l < "$evidence_root/history.after.tsv")" -eq 11
test "$(awk -F '|' '$3!=0{bad++} END{print bad+0}' "$evidence_root/history.after.tsv")" -eq 0
```

Expected: eleven exact version/name rows with statement cardinality `0`.

- [ ] **Step 5: Define abort and rollback strategy without executing deletion**

Before commit, every failure aborts through the transaction automatically. After commit, do not delete history rows automatically. If read-back later proves wrong, stop migration runners, preserve all evidence, and request immediate explicit confirmation before either:

1. deleting only the eleven exact version/name/empty-statement rows in one reviewed transaction; or
2. restoring the full dump under a separately approved database-restore runbook.

Expected: no rollback action occurs during a successful Phase-0 run.

## Task 9: Verify preservation invariants and report VPS health

**Files:**
- Create outside Git: `$evidence_root/*.after.tsv`
- No application source/build/config modification

- [ ] **Step 1: Re-capture and compare protected aggregates**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.tasks),
 (select count(*) from public.staff_users),
 (select count(*) from public.staff_users where password_hash is null or password_hash=''),
 (select count(*) from public.staff_users where password is not null),
 (select count(*) from public.staff_users where session_version is null or session_version<0),
 (select coalesce(sum(session_version),0) from public.staff_users),
 (select count(*) from public.password_reset_tokens),
 (select count(*) from public.password_reset_tokens where used_at is null),
 (select count(*) from public.password_reset_attempts),
 (select count(*) from public.task_evaluation_checkpoints),
 (select count(*) from public.task_evaluation_checkpoints
   where total_score is distinct from rating*effort_weight),
 (select count(*) from public.job_titles),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null),
 (select count(*) from public.staff_users where list_order<0),
 (select count(*) from public.staff_users where list_order>0),
 (select count(distinct list_order) from public.staff_users where list_order>0);
" > "$evidence_root/aggregates.after.tsv"
chmod 0600 "$evidence_root/aggregates.after.tsv"
cmp -s "$evidence_root/aggregates.before.tsv" "$evidence_root/aggregates.after.tsv"
```

Expected for history-only reconciliation: byte-identical aggregate rows. If an explicitly approved safe replay preceded history repair, its decision record must define the exact permitted aggregate delta; password/session/reset aggregates still must remain identical.

- [ ] **Step 2: Prove Git/source/config preservation**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
test "$(git diff --cached --name-only | wc -l)" -eq 0
sha256sum -c "$evidence_root/source.sha256"
git rev-parse HEAD > "$evidence_root/head.after"
git rev-parse HEAD^{tree} > "$evidence_root/tree.after"
git status --porcelain=v1 --untracked-files=all > "$evidence_root/root-status.after"
cmp -s "$evidence_root/head.before" "$evidence_root/head.after"
cmp -s "$evidence_root/tree.before" "$evidence_root/tree.after"
cmp -s "$evidence_root/root-status.before" "$evidence_root/root-status.after"
```

Expected: HEAD/tree/status/source checks match byte-for-byte. Because Phase 0 creates no Git source/config change, provider/model, CLIProxyAPI, `9router`, password-reset/session source, systemd, and nginx remain untouched even if unrelated protected paths were already dirty before execution.

- [ ] **Step 3: Run local/public HTTP and restart-count checks**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/login)" = 200
test "$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/login)" = 200
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/api/auth/session)" = 401
test "$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/api/auth/session)" = 401
read -r nrestarts_before < "$evidence_root/nrestarts.before"
nrestarts_after=$(systemctl show thoidai-work -p NRestarts --value)
test "$nrestarts_after" -eq "$nrestarts_before"
printf '%s\n' "$nrestarts_after" > "$evidence_root/nrestarts.after"
chmod 0600 "$evidence_root/nrestarts.after"
nginx -t
```

Expected: login `200`, unauthenticated session `401`, `NRestarts` unchanged, and nginx syntax valid. No service restart occurs.

- [ ] **Step 4: Report the complete aggregate VPS health matrix**

```bash
printf 'VPS=vps-aylaspa\n'
printf 'STATUS=%s\n' "$(systemctl is-system-running 2>/dev/null || true)"
printf 'CPU=%s vCPU\n' "$(nproc)"
free -m | awk '/^Mem:/ {printf "RAM=%d/%d MiB (%.1f%%)\n",$3,$2,100*$3/$2}'
df -hP /opt/thoidai-work | awk 'NR==2 {printf "DISK=%s/%s (%s), free=%s\n",$3,$2,$5,$4}'
awk '{print "LOAD="$1"/"$2"/"$3}' /proc/loadavg
printf 'SERVICES=thoidai-work:%s\n' "$(systemctl is-active thoidai-work)"
printf 'DOCKER=%s running=%s unhealthy=%s\n' "$(systemctl is-active docker)" "$(docker ps -q | wc -l)" "$(docker ps --filter health=unhealthy -q | wc -l)"
printf 'NGINX=%s\n' "$(systemctl is-active nginx)"
printf 'DATABASE='; docker exec supabase_db_thoidai-work pg_isready -U postgres -d postgres
printf 'WARNINGS=%s (60m)\n' "$(journalctl -u thoidai-work --since '60 minutes ago' -p warning --no-pager --output=cat | wc -l)"
printf 'ERRORS=%s (60m)\n' "$(journalctl -u thoidai-work --since '60 minutes ago' -p err --no-pager --output=cat | wc -l)"
```

Report exactly: VPS, STATUS, CPU, RAM, DISK, LOAD, SERVICES, DOCKER, NGINX, DATABASE, WARNINGS, ERRORS, and RECOMMENDED ACTION. Mark unavailable components not installed/not applicable. Never print journal bodies.

- [ ] **Step 5: Seal final evidence**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum "$evidence_root"/*.tsv "$evidence_root"/*.sha256 \
  > "$evidence_root/FINAL-SHA256SUMS"
chmod 0600 "$evidence_root/FINAL-SHA256SUMS"
```

Expected: a root-only evidence index exists. Record source/history decisions, backup verification, transaction exit, read-back, protected aggregate comparison, Git fingerprint, HTTP codes, restart counts, and health matrix; never include sensitive values.

## Task 10: Execution handoff and current stop state

**Files:**
- No repository modification

- [ ] **Step 1: Honor the audited stop condition**

The currently audited evidence does not authorize history writes because `20260813210000`, `20260813230000`, `20260813233000`, and targeted DML proof for `20260814130000` are unresolved. Phase-0 execution must stop after Task 7 unless later evidence changes all eleven rows to `exact-applied`.

- [ ] **Step 2: Use the already chosen inline execution method**

The user already selected the recommended no-questions execution path. When execution resumes from approved evidence, continue inline through the existing matching custom agent `/root/aylaspa_thoidai` and use `superpowers:executing-plans`; the one-VPS routing requirement overrides the generic fresh-worker option in the writing-plans header. Do not spawn another worker or run any database backup, replay, production rehearsal, history write, or shared-state step in parallel; all execution is strictly sequential.

- [ ] **Step 3: Keep the plan itself uncommitted until primary review**

```bash
cd /opt/thoidai-work
git status --porcelain=v1 --untracked-files=all -- \
  docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
test "$(git diff --cached --name-only | wc -l)" -eq 0
```

Expected during planning review: the Phase-0 plan is `??` and the index is empty. Do not begin Phase-0 execution merely because this draft exists.
