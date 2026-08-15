# THỜI ĐẠI WORK Phase 0: Migration-History Reconciliation Implementation Plan

> **Execution model:** Run sequentially through the Aylaspa-only operator on `vps-aylaspa`. Do not delegate runtime work or run database/container steps in parallel. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the exact application status of eleven THỜI ĐẠI WORK migration versions and reconcile them with `supabase_migrations.schema_migrations` only if every version becomes `exact-applied` under the all-or-nothing gate, without blindly replaying SQL, weakening password-reset/session protections, changing application routing, or exposing production identities or secrets.

**Architecture:** Quarantine the existing retained PostgreSQL container, volume, databases, secret, and Docker log as historical Tasks 1–4 evidence: no log read, no runtime session, and no mutation. After an immutable committed handoff package passes before any runtime creation, build a newly named PostgreSQL 17 container and volume from the pinned image with network mode `none`, no ports, log driver `none`, exact resource/security limits, and statement/error-statement logging disabled. Restore and normalize a fresh zero-row template, clone a new identity-free diagnostic database and a separate protected-shell successor, run both expected-negative paths only in that new lane with exact sanitized SQLSTATE `P0001`, and preserve the all-or-nothing STOP. Production remains SELECT-only and Task 8 contains zero history-write SQL.

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

Five recorded companion versions must be replayed in chronological order on the isolated replay database because they change the same object chain, but this runbook never inserts or alters their history rows:

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
- Never copy production rows into the isolated cluster. Its restore is schema-only and its fixtures are synthetic.
- Never stage, commit, revert, stash, reset, clean, or overwrite unrelated dirty-root paths.
- Never change employee password-reset behavior, `session_version`, the active provider/model, CLIProxyAPI, `9router`, systemd units, nginx configuration, application source, or the active build.
- Never remove the retained isolated container, named volume, password file, prior disposable databases, or backups; never delete migration-history rows, restart a service, or restore a database without the separately required authorization for that action.

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

Completed Tasks 1–4 and the measured stop are sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`. Their dump, archive, manifests, retained container/volume/secret/databases, and log are quarantine inputs: never regenerated, queried, read for log content, hashed for log content, deleted, truncated, renamed, restarted, or rewound. Corrected execution creates a separate mode-0700 evidence directory, separate secret, separate named volume, separate no-log container, one fresh template, one identity-free diagnostic clone, and one successor clone. No repository source file is created or modified by runtime execution, and no image pull, package installation, production-row copy, or automatic cleanup is permitted.

## Approved design coverage

| Design boundary | Implementation location |
|---|---|
| Quarantine of retained container/volume/database/log | Task 4 corrected failure branch; Task 5 Steps 2 and 6; Task 9 Step 2 |
| Immutable committed-package gate | Task 5 Step 1; Task 10 |
| New pinned-image no-log lane | Task 5 Steps 3–4 |
| Fresh template plus diagnostic/successor clones | Task 5 Step 5 |
| Selector containment and successor-only fixture | Task 6 Step 1 |
| Exact sanitized `P0001` in both negative paths | Task 6 Steps 2–3 |
| Chronological replay and safe idempotency | Task 6 Steps 3–4 |
| Four-class taxonomy and mandatory STOP | Task 7 |
| Unreachable zero-SQL history boundary | Task 8 |
| Production, provider/routing/build, quarantine, and lane preservation | Task 9 |
| Post-review/post-commit atomic handoff | Task 10 |

---

## Task 1: Freeze Git, source, history, and preservation baselines

**Status:** Completed and sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; verify but do not regenerate this evidence.

**Files:**
- Verify: `/opt/thoidai-work/supabase/migrations/*.sql`
- Existing outside Git: `/opt/thoidai-reconciliation/phase0-20260814T135943Z/*`
- No repository modification

- [x] **Step 1: Prove the approved source ancestry and capture the dirty-root fingerprint**

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

- [x] **Step 2: Lock the exact sixteen-file chronological source manifest**

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

- [x] **Step 3: Verify tracked/untracked provenance without changing it**

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

- [x] **Step 4: Prove target history is absent and companion history is present**

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

- [x] **Step 5: Commit no source change**

There is deliberately no Git commit in Phase-0 execution. Re-run:

```bash
cd /opt/thoidai-work
test "$(git diff --cached --name-only | wc -l)" -eq 0
```

Expected: `0`.

## Task 2: Create root-only recovery and pre-change evidence

**Status:** Completed and sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; verify but do not regenerate this evidence.

**Files:**
- Create outside Git: `$evidence_root/database.full.dump`
- Create outside Git: `$evidence_root/*.before.tsv`
- No repository modification

- [x] **Step 1: Verify the exact production target and service baseline**

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

- [x] **Step 2: Create and validate a full root-only production database backup**

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

- [x] **Step 3: Preserve source provenance without copying migration bodies**

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

- [x] **Step 4: Capture password/session and business aggregate invariants**

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

- [x] **Step 5: Checksum the immutable pre-change evidence set**

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

**Status:** Completed and sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; verify but do not regenerate this evidence.

**Files:**
- Create outside Git: `$evidence_root/production-catalog.before.tsv`
- Create outside Git: `$evidence_root/production-function-body.before.tsv`
- Verify: existing employee-password-reset apply manifests
- No production write

- [x] **Step 1: Capture selected columns, tables, constraints, indexes, triggers, and policies**

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

- [x] **Step 2: Capture terminal function body hashes, ownership, configuration, and grants**

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

- [x] **Step 3: Capture role-policy and one-time DML evidence only as aggregates**

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

- [x] **Step 4: Verify trusted apply evidence for the two password-reset execution records**

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

- [x] **Step 5: Hash the production evidence**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
sha256sum "$evidence_root"/production-*.before.tsv > "$evidence_root/production-evidence.sha256"
chmod 0600 "$evidence_root/production-evidence.sha256"
(cd "$evidence_root" && sha256sum -c production-evidence.sha256)
```

Expected: all production metadata files verify.

## Task 4: Create and validate the retained network-isolated PostgreSQL replay cluster

**Files:**
- Verify: `/opt/thoidai-work/docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md`
- Verify: `/opt/thoidai-reconciliation/phase0-20260814T135943Z/*`
- Create outside Git: one mode-0700 child run directory under `/opt/thoidai-reconciliation/phase0-20260814T135943Z`
- Create outside Git: one mode-0600 bootstrap password file, one retained Docker volume, and one retained Docker container
- Read production only; create no object in `supabase_db_thoidai-work`

> **Execution status note (2026-08-15):** Tasks 1–4 are complete and sealed. The guarded isolated-only PUBLIC-USAGE normalization committed in the original replay database, all Task-4 fidelity gates passed, and `TASK4-SHA256SUMS` verifies. The former Task 5 then inserted exactly six role/permission pairs, ran the first four migrations with exit `0`, and stopped safely when `20260813210000` returned `3`/SQLSTATE `P0001`; its transaction rolled back cleanly and no later migration, classification, history, or cleanup step ran. That database, its container, volume, secret, and log are now quarantine-only historical evidence: host-side selected metadata inspection is the sole permitted access. No runtime session, database query, replay, diagnostic, log read/hash, stop, restart, rename, removal, or other mutation is permitted in the retained lane.

- [x] **Step 1: Verify the approved design commit and every sealed prerequisite**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
design=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
cd "$repo"
git merge-base --is-ancestor f707279ad9028d452d871fddb39d4f0f767ca155 HEAD
test "$(sha256sum "$design" | awk '{print $1}')" = 8cec52675a8d409a5c8e449299aed773adcb05c537f5869396cdd45b2545f637
test "$(stat -c %a "$evidence_root")" = 700
test "$(find "$evidence_root" -maxdepth 1 -type f | wc -l)" -eq 44
test "$(find "$evidence_root" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
test "$(sha256sum "$evidence_root/database.full.dump" | awk '{print $1}')" = 8081b82535a7c0b513db5708f31a9eeaea58e312a62278500d56448b5766bc91
test "$(sha256sum "$evidence_root/public-history-schema.dump" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b
test "$(sha256sum "$evidence_root/source.sha256" | awk '{print $1}')" = ca2ce5704909e0fd09712aecb9da5e04df56b30ddca1e8ab028d2a381f277612
test "$(wc -l < "$evidence_root/source.sha256")" -eq 16
(cd "$evidence_root" && sha256sum -c PRECHANGE-SHA256SUMS >/dev/null)
(cd "$evidence_root" && sha256sum -c production-evidence.sha256 >/dev/null)
(cd "$repo" && sha256sum -c "$evidence_root/source.sha256" >/dev/null)
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/public-history-schema.dump" >/dev/null
```

Expected: every command exits `0`; the approved successor-design commit is an ancestor and the protected design bytes have SHA-256 `8cec526…f637`; all sixteen sources verify, both PostgreSQL-17 archives list successfully, and the 44 sealed top-level files remain root-only. Do not print archive contents.

- [x] **Step 2: Preserve the measured RED architecture evidence without repeating it**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
(cd "$evidence_root" && sha256sum -c ACLTEST-SHA256SUMS >/dev/null)
(cd "$evidence_root" && sha256sum -c TOCTEST-SHA256SUMS >/dev/null)
grep -Fx 'supabase_admin_socket_connection|false' "$evidence_root/ownertest-socket-check.tsv"
grep -Fx 'restore_status|1' "$evidence_root/acltest-red-reference.tsv"
grep -Fx 'failed_default_acl_items|3' "$evidence_root/acltest-red-reference.tsv"
grep -Fx 'green|schema_acl_entries|0' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|table_acl_entries|0' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|function_acl_entries|0' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|table_effective_privileges|147|588' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|function_effective_execute|56|56' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|schema_effective_privileges|2|8' "$evidence_root/acltest-grants.tsv"
grep -Fx 'test|public_default_acl_total|3' "$evidence_root/toctest-default-acl.tsv"
grep -Fx 'test|public_default_acl_supabase_admin|0' "$evidence_root/toctest-default-acl.tsv"
grep -Fx 'test|schema_acl_entries|5' "$evidence_root/toctest-grants.tsv"
cmp -s "$evidence_root/toctest-owner-production.tsv" "$evidence_root/toctest-owner-test.tsv" && exit 41 || true
```

Expected: retained evidence proves direct `supabase_admin` authentication was unavailable, exact shared-cluster restore failed three default ACLs, `--no-privileges` destroyed ACL/effective-privilege fidelity, and filtered TOC retained only five schema ACL entries with a non-identical owner fingerprint. No failed architecture is rerun.

- [x] **Step 3: Allocate one validated unique run identity without touching Docker**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
current_file="$evidence_root/isolated-run.current"
test ! -e "$current_file"
run_stamp=$(date -u +%Y%m%d%H%M%S)
run_suffix=$(openssl rand -hex 4)
run_id="${run_stamp}_${run_suffix}"
container_name="thoidai_phase0_pg_${run_id}"
volume_name="thoidai_phase0_pgdata_${run_id}"
bootstrap_role="phase0_boot_${run_suffix}"
bootstrap_db="phase0_bootstrap_${run_suffix}"
replay_db="thoidai_phase0_replay_${run_suffix}"
run_dir="$evidence_root/isolated-$run_id"
[[ "$run_id" =~ ^[0-9]{14}_[0-9a-f]{8}$ ]]
[[ "$container_name" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$volume_name" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$bootstrap_role" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$bootstrap_db" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$replay_db" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
test ${#container_name} -le 63
test ${#volume_name} -le 63
! docker container inspect "$container_name" >/dev/null 2>&1
! docker volume inspect "$volume_name" >/dev/null 2>&1
install -d -m 0700 "$run_dir"
printf '%s|%s|%s|%s|%s|%s\n' \
  "$run_id" "$container_name" "$volume_name" \
  "$bootstrap_role" "$bootstrap_db" "$replay_db" \
  > "$run_dir/names.tsv"
chmod 0600 "$run_dir/names.tsv"
printf '%s\n' "$run_dir" > "$current_file"
chmod 0600 "$current_file"
test "$(stat -c %a "$run_dir")" = 700
test "$(stat -c %a "$current_file")" = 600
```

Expected: one new root-only run directory and a validated names record exist; no container, volume, database, password, network, or production object has been created.

- [x] **Step 4: Capture fresh Git, resource, service, HTTP, and production baselines before container creation**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
cd "$repo"
test "$(git diff --cached --name-only | wc -l)" -eq 0
git rev-parse HEAD > "$run_dir/head.isolated.before"
git rev-parse HEAD^{tree} > "$run_dir/tree.isolated.before"
git status --porcelain=v1 --untracked-files=all > "$run_dir/root-status.isolated.before"
test "$(wc -l < "$run_dir/root-status.isolated.before")" -eq 358
test "$(sha256sum "$run_dir/root-status.isolated.before" | awk '{print $1}')" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active docker)" = active
test "$(systemctl is-active nginx)" = active
nginx -t >/dev/null 2>&1
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = true
docker exec supabase_db_thoidai-work pg_isready -q -U postgres -d postgres
test "$(docker ps --filter health=unhealthy -q | wc -l)" -eq 0
docker network inspect none >/dev/null
available_mib=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
free_kib=$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')
load_one=$(awk '{print $1}' /proc/loadavg)
test "$available_mib" -ge 2048
test "$free_kib" -ge 5242880
awk -v load_value="$load_one" 'BEGIN{exit !(load_value<4.0)}'
local_login=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/login)
public_login=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/login)
local_session=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/api/auth/session)
public_session=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/api/auth/session)
test "$local_login" = 200
test "$public_login" = 200
test "$local_session" = 401
test "$public_session" = 401
printf 'available_mib|%s\nfree_kib|%s\nload_one|%s\nrunning_containers|%s\nunhealthy_containers|0\n' \
  "$available_mib" "$free_kib" "$load_one" "$(docker ps -q | wc -l)" \
  > "$run_dir/resources.isolated.before.tsv"
printf 'local_login|%s\npublic_login|%s\nlocal_session|%s\npublic_session|%s\n' \
  "$local_login" "$public_login" "$local_session" "$public_session" \
  > "$run_dir/http.isolated.before.tsv"
systemctl show thoidai-work -p NRestarts --value > "$run_dir/nrestarts.isolated.before"
chmod 0600 "$run_dir"/*
```

Expected: index `0`, dirty count `358`, dirty fingerprint `20115c…97a`, at least 2 GiB available RAM, at least 5 GiB Docker-filesystem headroom, load below `4.0`, zero unhealthy containers, healthy production services/database, login `200`, session `401`, and no printed dirty paths.

- [x] **Step 5: Capture and seal fresh read-only production fingerprints before container creation**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select kind,schema_name,owner_name,object_count from (
 select 'SCHEMA'::text kind,n.nspname schema_name,pg_get_userbyid(n.nspowner) owner_name,count(*)::bigint object_count
 from pg_namespace n where n.nspname='public' group by n.nspname,n.nspowner
 union all
 select 'RELATION:'||c.relkind::text,n.nspname,pg_get_userbyid(c.relowner),count(*)::bigint
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','i','S') group by c.relkind,n.nspname,c.relowner
 union all
 select 'FUNCTION',n.nspname,pg_get_userbyid(p.proowner),count(*)::bigint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' group by n.nspname,p.proowner
) q order by kind,schema_name,owner_name;" > "$run_dir/production-owner.before.tsv"
cmp -s "$evidence_root/toctest-owner-production.tsv" "$run_dir/production-owner.before.tsv"
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
 (select count(*) from public.task_evaluation_checkpoints where total_score is distinct from rating*effort_weight),
 (select count(*) from public.job_titles),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id where su.job_title_id is not null and jt.id is null),
 (select count(*) from public.staff_users where list_order<0),
 (select count(*) from public.staff_users where list_order>0),
 (select count(distinct list_order) from public.staff_users where list_order>0);" \
  > "$run_dir/production-aggregates.isolated.before.tsv"
cmp -s "$evidence_root/aggregates.before.tsv" "$run_dir/production-aggregates.isolated.before.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version,expected) as (values
 ('20260813110000',1),('20260813155000',1),('20260813172000',0),('20260813184000',1),
 ('20260813210000',0),('20260813220000',0),('20260813230000',0),('20260813233000',0),
 ('20260813234500',0),('20260814070000',0),('20260814090000',1),('20260814102000',0),
 ('20260814113000',1),('20260814130000',0),('20260814160000',0),('20260814170000',0))
select target.version,target.expected,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version,target.expected order by target.version;" \
  > "$run_dir/production-history.isolated.before.tsv"
cmp -s "$evidence_root/history.before.tsv" "$run_dir/production-history.isolated.before.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint',
 'ensure_staff_password_hash','consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write','create_bulk_task_plan',
 'report_task_progress','review_task_completion','prepare_admin_password_reset',
 'finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" \
  > "$run_dir/production-functions.isolated.before.tsv"
cmp -s "$evidence_root/production-function-body.before.tsv" "$run_dir/production-functions.isolated.before.tsv"
sha256sum "$run_dir"/production-*.isolated.before.tsv "$run_dir/production-owner.before.tsv" \
  > "$run_dir/production-isolated-before.sha256"
chmod 0600 "$run_dir"/*
(cd "$run_dir" && sha256sum -c production-isolated-before.sha256 >/dev/null)
```

Expected: aggregate, history, function, and owner files are byte-identical to sealed production evidence. The owner distribution is five lines: public schema `pg_database_owner`, 21 tables/53 indexes/one sequence owned by `postgres`, and 14 public functions owned by `postgres`. No row identity or function body is emitted.

- [x] **Step 6: Prove the pinned image is local and scan exact source/extension dependencies without pulling**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
image_ref='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
read -r run_dir < "$evidence_root/isolated-run.current"
cd "$repo"
image_id=$(docker image inspect -f '{{.Id}}' "$image_ref")
repo_digest_count=$(docker image inspect -f '{{len .RepoDigests}}' "$image_ref")
pinned_repo_digest_match_count=$(docker image inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$image_ref" | grep -Fxc "$image_ref")
image_os=$(docker image inspect -f '{{.Os}}' "$image_ref")
image_architecture=$(docker image inspect -f '{{.Architecture}}' "$image_ref")
inspect_size_bytes=$(docker image inspect -f '{{.Size}}' "$image_ref")
printf 'image_id|%s\nrepo_digest_count|%s\npinned_repo_digest_match_count|%s\nos|%s\narchitecture|%s\ninspect_size_bytes|%s\n' \
  "$image_id" "$repo_digest_count" "$pinned_repo_digest_match_count" \
  "$image_os" "$image_architecture" "$inspect_size_bytes" \
  > "$run_dir/image-metadata.tsv"
chmod 0600 "$run_dir/image-metadata.tsv"
test "$(wc -l < "$run_dir/image-metadata.tsv")" -eq 6
grep -Fx 'image_id|sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d' "$run_dir/image-metadata.tsv"
grep -Fx 'repo_digest_count|1' "$run_dir/image-metadata.tsv"
grep -Fx 'pinned_repo_digest_match_count|1' "$run_dir/image-metadata.tsv"
grep -Fx 'os|linux' "$run_dir/image-metadata.tsv"
grep -Fx 'architecture|amd64' "$run_dir/image-metadata.tsv"
grep -Fx 'inspect_size_bytes|161234888' "$run_dir/image-metadata.tsv"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
mapfile -t source_paths < <(awk '{print $2}' "$evidence_root/source.sha256")
test "${#source_paths[@]}" -eq 16
count_matches() {
  local pattern=$1
  { grep -Eih -- "$pattern" "${source_paths[@]}" || true; } | wc -l
}
set_role_count=$(count_matches '(^|[^[:alnum:]_])set[[:space:]]+(local[[:space:]]+|session[[:space:]]+)?role([^[:alnum:]_]|$)')
session_auth_count=$(count_matches '(^|[^[:alnum:]_])set[[:space:]]+(local[[:space:]]+|session[[:space:]]+)?session[[:space:]]+authorization([^[:alnum:]_]|$)')
supabase_admin_count=$(count_matches '(^|[^[:alnum:]_])supabase_admin([^[:alnum:]_]|$)')
create_extension_count=$(count_matches '(^|[^[:alnum:]_])create[[:space:]]+extension([^[:alnum:]_]|$)')
pgcrypto_declaration_count=$(count_matches '(^|[^[:alnum:]_])create[[:space:]]+extension([[:space:]]+if[[:space:]]+not[[:space:]]+exists)?[[:space:]]+"?pgcrypto"?([^[:alnum:]_]|$)')
pgcrypto_call_count=$(count_matches '(^|[^[:alnum:]_])(crypt|gen_salt)[[:space:]]*\(')
archive_extension_count=$(docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/public-history-schema.dump" | awk '$4=="EXTENSION"{n++} END{print n+0}')
printf 'source_files|16\nset_role|%s\nsession_authorization|%s\nsupabase_admin|%s\ncreate_extension|%s\npgcrypto_declaration|%s\npgcrypto_calls|%s\narchive_extensions|%s\n' \
  "$set_role_count" "$session_auth_count" "$supabase_admin_count" \
  "$create_extension_count" "$pgcrypto_declaration_count" "$pgcrypto_call_count" "$archive_extension_count" \
  > "$run_dir/source-dependency-scan.tsv"
grep -Fx 'set_role|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'session_authorization|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'supabase_admin|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'create_extension|1' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'pgcrypto_declaration|1' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'pgcrypto_calls|2' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'archive_extensions|0' "$run_dir/source-dependency-scan.tsv"
printf 'plpgsql\npgcrypto\n' > "$run_dir/required-extensions.list"
chmod 0600 "$run_dir/source-dependency-scan.tsv" "$run_dir/required-extensions.list"
```

Expected: root-only `image-metadata.tsv` contains exactly six approved fields and proves the exact image ID, one RepoDigest with one pinned match, linux/amd64, and Docker image-inspect `.Size` value `161234888` bytes without dumping Config, Env, or history. The design baseline separately names the observed `docker image ls` display size `640 MB` and `docker system df -v` size/shared/unique metrics; they are not substituted for `.Size`. No pull command runs; the archive has zero extension TOC items; the sources reference one pgcrypto declaration and two pgcrypto call lines; and all sixteen sources have zero `SET ROLE`, `SET SESSION AUTHORIZATION`, and `supabase_admin` references.

- [x] **Step 7: Generate the isolated-only bootstrap secret directly into its root-only file**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
secret_file="$run_dir/bootstrap-password"
test ! -e "$secret_file"
openssl rand -base64 48 > "$secret_file"
chmod 0600 "$secret_file"
test "$(stat -c %a "$secret_file")" = 600
test "$(stat -c %s "$secret_file")" -ge 64
printf 'mode|%s\nbytes|%s\n' "$(stat -c %a "$secret_file")" "$(stat -c %s "$secret_file")" \
  > "$run_dir/secret-metadata.tsv"
chmod 0600 "$run_dir/secret-metadata.tsv"
```

Expected: the value is never read into a shell variable, printed, hashed, passed as an argument, placed in an environment value, or stored in a label. Only its path, mode, and byte length are used later.

- [x] **Step 8: Create the retained volume and container with the exact isolation/resource envelope**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
image_ref='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
secret_file="$run_dir/bootstrap-password"
test "$(systemctl is-active docker)" = active
test "$(docker ps --filter health=unhealthy -q | wc -l)" -eq 0
test "$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)" -ge 2048
test "$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')" -ge 5242880
awk 'NR==1{exit !($1<4.0)}' /proc/loadavg
docker volume create "$volume_name" >/dev/null
volume_driver=$(docker volume inspect -f '{{.Driver}}' "$volume_name")
volume_scope=$(docker volume inspect -f '{{.Scope}}' "$volume_name")
printf 'name|%s\ndriver|%s\nscope|%s\n' "$volume_name" "$volume_driver" "$volume_scope" \
  > "$run_dir/volume-metadata.tsv"
chmod 0600 "$run_dir/volume-metadata.tsv"
test "$(wc -l < "$run_dir/volume-metadata.tsv")" -eq 3
grep -Fx "name|$volume_name" "$run_dir/volume-metadata.tsv"
grep -Fx 'driver|local' "$run_dir/volume-metadata.tsv"
grep -Fx 'scope|local' "$run_dir/volume-metadata.tsv"
docker create --pull=never \
  --name "$container_name" \
  --hostname "$container_name" \
  --network none \
  --cpus 1 \
  --memory 1g \
  --memory-swap 1g \
  --pids-limit 256 \
  --restart no \
  --stop-timeout 30 \
  --mount "type=volume,src=$volume_name,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$secret_file,dst=/run/secrets/bootstrap-password,readonly" \
  --env "POSTGRES_USER=$bootstrap_role" \
  --env "POSTGRES_DB=$bootstrap_db" \
  --env 'POSTGRES_PASSWORD_FILE=/run/secrets/bootstrap-password' \
  --env 'POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8' \
  "$image_ref" > "$run_dir/container.id"
chmod 0600 "$run_dir/container.id"
test "$(docker inspect -f '{{.Id}}' "$container_name")" = "$(cat "$run_dir/container.id")"
```

Expected: root-only `volume-metadata.tsv` has exactly three lines proving the validated name, `local` driver, and `local` scope without recording the mountpoint. Docker uses the already-present digest because `--pull=never` is mandatory. The named volume and stopped container are retained even if a later gate fails; no user-created network is created.

- [x] **Step 9: Assert stopped-container security and required extension controls before initialization**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
secret_file="$run_dir/bootstrap-password"
container_state=$(docker inspect -f '{{.State.Status}}' "$container_name")
container_image_id=$(docker inspect -f '{{.Image}}' "$container_name")
network_mode=$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")
privileged=$(docker inspect -f '{{.HostConfig.Privileged}}' "$container_name")
pid_mode=$(docker inspect -f '{{.HostConfig.PidMode}}' "$container_name")
ipc_mode=$(docker inspect -f '{{.HostConfig.IpcMode}}' "$container_name")
nano_cpus=$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$container_name")
memory_bytes=$(docker inspect -f '{{.HostConfig.Memory}}' "$container_name")
memory_swap_bytes=$(docker inspect -f '{{.HostConfig.MemorySwap}}' "$container_name")
pids_limit=$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$container_name")
restart_policy=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$container_name")
auto_remove=$(docker inspect -f '{{.HostConfig.AutoRemove}}' "$container_name")
test "$container_state" = created
test "$container_image_id" = sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d
test "$network_mode" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
published_port_count=0
test "$privileged" = false
test "$pid_mode" != host
test "$ipc_mode" != host
pid_mode_not_host=true
ipc_mode_not_host=true
devices_json=$(docker inspect -f '{{json .HostConfig.Devices}}' "$container_name")
cap_add_json=$(docker inspect -f '{{json .HostConfig.CapAdd}}' "$container_name")
[[ "$devices_json" = '[]' || "$devices_json" = null ]]
[[ "$cap_add_json" = '[]' || "$cap_add_json" = null ]]
device_count=0
cap_add_count=0
test "$nano_cpus" -eq 1000000000
test "$memory_bytes" -eq 1073741824
test "$memory_swap_bytes" -eq 1073741824
test "$pids_limit" -eq 256
test "$restart_policy" = no
test "$auto_remove" = false
docker inspect -f '{{range .Mounts}}{{printf "%s|%s|%s|%s|%t\n" .Type .Name .Source .Destination .RW}}{{end}}' \
  "$container_name" | sed '/^$/d' > "$run_dir/mounts.assertion.tsv"
awk -F '|' -v volume="$volume_name" -v secret="$secret_file" '
 $1=="volume" && $2==volume && $4=="/var/lib/postgresql/data" && $5=="true" {data++}
 $1=="bind" && $2=="" && $3==secret && $4=="/run/secrets/bootstrap-password" && $5=="false" {password++}
 END {exit !(NR==2 && data==1 && password==1)}' "$run_dir/mounts.assertion.tsv"
! grep -Eq '/opt/thoidai-work|docker\.sock|supabase_db_thoidai-work' "$run_dir/mounts.assertion.tsv"
mount_count=$(wc -l < "$run_dir/mounts.assertion.tsv")
password_value_env_count=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container_name" | grep -c '^POSTGRES_PASSWORD=' || true)
password_file_path_env_count=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container_name" | grep -Fxc 'POSTGRES_PASSWORD_FILE=/run/secrets/bootstrap-password' || true)
test "$mount_count" -eq 2
test "$password_value_env_count" -eq 0
test "$password_file_path_env_count" -eq 1
printf 'state|%s\nimage_id|%s\nnetwork_mode|%s\npublished_port_count|%s\nprivileged|%s\npid_mode_not_host|%s\nipc_mode_not_host|%s\ndevice_count|%s\ncap_add_count|%s\nnano_cpus|%s\nmemory_bytes|%s\nmemory_swap_bytes|%s\npids_limit|%s\nrestart_policy|%s\nauto_remove|%s\nmount_count|%s\npassword_value_env_count|%s\npassword_file_path_env_count|%s\n' \
  "$container_state" "$container_image_id" "$network_mode" "$published_port_count" \
  "$privileged" "$pid_mode_not_host" "$ipc_mode_not_host" "$device_count" \
  "$cap_add_count" "$nano_cpus" "$memory_bytes" "$memory_swap_bytes" \
  "$pids_limit" "$restart_policy" "$auto_remove" "$mount_count" \
  "$password_value_env_count" "$password_file_path_env_count" \
  > "$run_dir/container-security.tsv"
chmod 0600 "$run_dir/container-security.tsv"
test "$(wc -l < "$run_dir/container-security.tsv")" -eq 18
grep -Fx 'state|created' "$run_dir/container-security.tsv"
grep -Fx 'image_id|sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d' "$run_dir/container-security.tsv"
grep -Fx 'network_mode|none' "$run_dir/container-security.tsv"
grep -Fx 'published_port_count|0' "$run_dir/container-security.tsv"
grep -Fx 'privileged|false' "$run_dir/container-security.tsv"
grep -Fx 'pid_mode_not_host|true' "$run_dir/container-security.tsv"
grep -Fx 'ipc_mode_not_host|true' "$run_dir/container-security.tsv"
grep -Fx 'device_count|0' "$run_dir/container-security.tsv"
grep -Fx 'cap_add_count|0' "$run_dir/container-security.tsv"
grep -Fx 'nano_cpus|1000000000' "$run_dir/container-security.tsv"
grep -Fx 'memory_bytes|1073741824' "$run_dir/container-security.tsv"
grep -Fx 'memory_swap_bytes|1073741824' "$run_dir/container-security.tsv"
grep -Fx 'pids_limit|256' "$run_dir/container-security.tsv"
grep -Fx 'restart_policy|no' "$run_dir/container-security.tsv"
grep -Fx 'auto_remove|false' "$run_dir/container-security.tsv"
grep -Fx 'mount_count|2' "$run_dir/container-security.tsv"
grep -Fx 'password_value_env_count|0' "$run_dir/container-security.tsv"
grep -Fx 'password_file_path_env_count|1' "$run_dir/container-security.tsv"
install -m 0600 /dev/null "$run_dir/extension-controls.tsv"
for extension_name in plpgsql pgcrypto; do
  docker cp "$container_name:/usr/share/postgresql/17/extension/$extension_name.control" - 2>/dev/null \
    | tar -tf - >/dev/null
  printf '%s|present\n' "$extension_name" >> "$run_dir/extension-controls.tsv"
done
grep -Fx 'plpgsql|present' "$run_dir/extension-controls.tsv"
grep -Fx 'pgcrypto|present' "$run_dir/extension-controls.tsv"
chmod 0600 "$run_dir/mounts.assertion.tsv" "$run_dir/container-security.tsv" "$run_dir/extension-controls.tsv"
```

Expected: root-only `container-security.tsv` has exactly eighteen approved aggregate lines proving created state, exact image ID, network mode `none`, zero published ports, exactly two mounts, no privileged/host PID/host IPC/device/cap-add access, exact 1 CPU/1 GiB/256 PID limits, restart `no`, auto-remove false, zero password-value environment keys, and one password-file-path key. It records no raw environment values or mount paths; both required PostgreSQL-17 control files are present before cluster initialization.

- [x] **Step 10: Start the retained container and verify the official-image initialization**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker start "$container_name" >/dev/null
ready=false
for attempt in $(seq 1 45); do
  if docker exec "$container_name" pg_isready -q -U "$bootstrap_role" -d "$bootstrap_db"; then
    ready=true
    break
  fi
  sleep 1
done
if test "$ready" != true; then
  printf 'ready|false\nlog_read|forbidden\nretained|true\n' > "$run_dir/init-readiness.failure.tsv"
  chmod 0600 "$run_dir/init-readiness.failure.tsv"
  exit 42
fi
docker exec "$container_name" postgres --version > "$run_dir/postgresql-version.tsv"
grep -Eq '^postgres \(PostgreSQL\) 17\.10 ' "$run_dir/postgresql-version.tsv"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c \
  "select current_user,session_user,current_database(),usesuper from pg_user where usename=current_user;" \
  > "$run_dir/bootstrap-session.tsv"
grep -Fx "$bootstrap_role|$bootstrap_role|$bootstrap_db|t" "$run_dir/bootstrap-session.tsv"
chmod 0600 "$run_dir"/*
```

Expected: PostgreSQL `17.10` is ready only on the container-local socket; the unique bootstrap role is the sole initial superuser session. Raw container logs are never printed, even on failure.

- [x] **Step 11: Bootstrap only the archive roles and guard the built-in role**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec -i "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -v ON_ERROR_STOP=1 <<'SQL'
do $guard$
begin
  if not exists (select 1 from pg_roles where rolname='pg_database_owner') then
    raise exception 'built-in database-owner role missing';
  end if;
  if exists (select 1 from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated','service_role')) then
    raise exception 'archive role collision';
  end if;
end
$guard$;
create role postgres nosuperuser inherit createrole createdb login replication bypassrls password null;
create role supabase_admin superuser inherit createrole createdb login replication bypassrls password null;
create role anon nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role authenticated nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role service_role nosuperuser inherit nocreaterole nocreatedb nologin noreplication bypassrls password null;
grant anon,authenticated,service_role,pg_create_subscription,pg_monitor,pg_read_all_data,pg_signal_backend
  to postgres with admin option;
SQL
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,
       rolpassword is null
from pg_authid where rolname in ('postgres','supabase_admin','anon','authenticated','service_role','pg_database_owner')
order by rolname;" > "$run_dir/archive-roles.tsv"
cat > "$run_dir/archive-roles.expected.tsv" <<'EOF'
anon|f|t|f|f|f|f|f|t
authenticated|f|t|f|f|f|f|f|t
pg_database_owner|f|t|f|f|f|f|f|t
postgres|f|t|t|t|t|t|t|t
service_role|f|t|f|f|f|f|t|t
supabase_admin|t|t|t|t|t|t|t|t
EOF
cmp -s "$run_dir/archive-roles.expected.tsv" "$run_dir/archive-roles.tsv"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'archive_roles',count(*) from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated','service_role');
select 'archive_usable_passwords',count(*) from pg_authid where rolname in ('postgres','supabase_admin','anon','authenticated','service_role') and rolpassword is not null;
select 'allowed_postgres_memberships',count(*) from pg_auth_members m join pg_roles member_role on member_role.oid=m.member join pg_roles granted_role on granted_role.oid=m.roleid where member_role.rolname='postgres' and granted_role.rolname in ('anon','authenticated','service_role','pg_create_subscription','pg_monitor','pg_read_all_data','pg_signal_backend') and m.admin_option;
select 'forbidden_supabase_service_roles',count(*) from pg_roles where rolname in ('authenticator','supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin');" \
  > "$run_dir/role-aggregates.tsv"
grep -Fx 'archive_roles|5' "$run_dir/role-aggregates.tsv"
grep -Fx 'archive_usable_passwords|0' "$run_dir/role-aggregates.tsv"
grep -Fx 'allowed_postgres_memberships|7' "$run_dir/role-aggregates.tsv"
grep -Fx 'forbidden_supabase_service_roles|0' "$run_dir/role-aggregates.tsv"
chmod 0600 "$run_dir"/*
```

Expected: `postgres` is the audited non-superuser replay role, `supabase_admin` has audited superuser attributes, the three API roles match production, `pg_database_owner` was not recreated, the seven allowed built-in/archive memberships exist, no unrelated Supabase service role exists, and every archive role has no usable password.

- [x] **Step 12: Create the exact replay database/extensions and remove only its empty template public schema**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec -i "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -v ON_ERROR_STOP=1 \
  -v replay_db="$replay_db" <<'SQL'
  create database :"replay_db" with owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale 'en-US' locale 'en_US.UTF-8';
SQL
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "create schema extensions authorization postgres;"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "create extension pgcrypto with schema extensions;"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select current_database(), (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public');" > "$run_dir/template-public.guard.tsv"
grep -Fx "$replay_db|0" "$run_dir/template-public.guard.tsv"
test "$replay_db" != postgres
test "$replay_db" != "$bootstrap_db"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "drop schema public;"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select d.datname,pg_get_userbyid(d.datdba),pg_encoding_to_char(d.encoding),d.datlocprovider,
       d.datcollate,d.datctype,d.datlocale
from pg_database d where d.datname='$replay_db';" > "$run_dir/database-locale.tsv"
awk -F '|' -v database="$replay_db" '
 $1==database && $2=="postgres" && $3=="UTF8" && $4=="i" &&
 $5=="en_US.UTF-8" && $6=="en_US.UTF-8" && $7=="en-US" {ok=1}
 END{exit !ok}' "$run_dir/database-locale.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select extname,extversion,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where extname in ('plpgsql','pgcrypto') order by extname;" > "$run_dir/extensions.tsv"
grep -Fx 'pgcrypto|1.3|extensions' "$run_dir/extensions.tsv"
grep -Fx 'plpgsql|1.0|pg_catalog' "$run_dir/extensions.tsv"
test "$(docker exec "$container_name" psql -X -U postgres -d "$replay_db" -Atqc 'show data_checksums')" = off
chmod 0600 "$run_dir"/*
```

Expected: one isolated database owned by non-superuser `postgres` has UTF8, ICU provider `i`, ICU locale `en-US`, `en_US.UTF-8` collation/type, checksums off, `plpgsql 1.0` in `pg_catalog`, and `pgcrypto 1.3` in `extensions`. Only the verified-empty public schema inside this isolated database is dropped, without `CASCADE`.

- [x] **Step 13: Stream the full archive as bootstrap superuser with ownership and privileges enabled**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
test "$(docker inspect -f '{{.HostConfig.Privileged}}' "$container_name")" = false
test "$(docker inspect -f '{{len .Mounts}}' "$container_name")" -eq 2
test "$(sha256sum "$evidence_root/public-history-schema.dump" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b
docker exec -i "$container_name" pg_restore --list \
  < "$evidence_root/public-history-schema.dump" >/dev/null
restore_hash_file="$run_dir/restore.output.sha256"
install -m 0600 /dev/null "$restore_hash_file"
set +e
docker exec -i "$container_name" pg_restore -U "$bootstrap_role" -d "$replay_db" \
  --exit-on-error --single-transaction \
  < "$evidence_root/public-history-schema.dump" 2>&1 \
  | sha256sum | awk '{print $1}' > "$restore_hash_file"
restore_pipeline=("${PIPESTATUS[@]}")
restore_status=${restore_pipeline[0]}
set -e
test "${restore_pipeline[1]}" -eq 0
test "${restore_pipeline[2]}" -eq 0
read -r restore_hash < "$restore_hash_file"
[[ "$restore_hash" =~ ^[0-9a-f]{64}$ ]]
printf 'restore_status|%s\noutput_sha256|%s\nowner_enabled|true\nprivileges_enabled|true\n' \
  "$restore_status" "$restore_hash" > "$run_dir/restore-status.tsv"
chmod 0600 "$run_dir/restore-status.tsv"
test "$restore_status" -eq 0
```

Expected: exact archive bytes stream over stdin, raw output is reduced to SHA-256/status, and restore exits `0` with no ignored errors. The command contains no `--no-owner`, `--no-privileges`, filtered TOC, or production credential and creates no migration copy in `/tmp` or the volume.

- [x] **Step 14: Apply the one guarded isolated-only public-schema ACL normalization**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
archive="$evidence_root/public-history-schema.dump"
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
test "$(sha256sum "$archive" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b

archive_counts="$run_dir/archive-public-schema-acl.counts.tsv"
{
  printf 'archive_sha256|674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b\n'
  docker exec -i "$container_name" pg_restore --list < "$archive" |
    awk '$4=="ACL" && $5=="-" && $6=="SCHEMA" && ($7=="public" || $7=="\"public\"") {n++}
         END {printf "schema_acl_toc_items|%d\n",n+0}'
  docker exec -i "$container_name" pg_restore --schema-only --file=- < "$archive" |
    awk '
      function normalize(value) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        gsub(/[[:space:]]+/, " ", value)
        return toupper(value)
      }
      {
        statement=normalize($0)
        if (statement ~ /^(GRANT|REVOKE) .* ON SCHEMA (PUBLIC|"PUBLIC") (TO|FROM) /) {
          commands++
          if (statement ~ /^GRANT /) grants++
          if (statement ~ /^REVOKE /) revokes++
          if (statement ~ /^GRANT .* TO PUBLIC;$/) public_grants++
          if (statement ~ /^GRANT (USAGE|ALL|ALL PRIVILEGES) ON SCHEMA (PUBLIC|"PUBLIC") TO PUBLIC;$/) public_usage++
        }
      }
      END {
        printf "public_schema_acl_commands|%d\n",commands+0
        printf "public_schema_grants|%d\n",grants+0
        printf "public_schema_revokes|%d\n",revokes+0
        printf "public_schema_grants_to_public|%d\n",public_grants+0
        printf "semantic_public_usage_grants|%d\n",public_usage+0
      }'
} > "$archive_counts"
chmod 0600 "$archive_counts"
grep -Fx 'schema_acl_toc_items|1' "$archive_counts"
grep -Fx 'public_schema_acl_commands|4' "$archive_counts"
grep -Fx 'public_schema_grants|4' "$archive_counts"
grep -Fx 'public_schema_revokes|0' "$archive_counts"
grep -Fx 'public_schema_grants_to_public|0' "$archive_counts"
grep -Fx 'semantic_public_usage_grants|0' "$archive_counts"

mapfile -d '' -t tdd_debug_files < <(
  find "$run_dir" -maxdepth 1 -type f -name 'schema-acl-transaction-debug-*.tsv' -print0
)
test "${#tdd_debug_files[@]}" -eq 1
tdd_debug=${tdd_debug_files[0]}
test "$(stat -c %a "$tdd_debug")" = 600
test "$(sha256sum "$tdd_debug" | awk '{print $1}')" = 9b784790cfbb06c6d641c2efdf3650d9d147e708dcc5128d6d7b6f542a62bb6c
grep -Fx 'status|PASS' "$tdd_debug"
grep -Fx 'green_default_acl|6/3/3' "$tdd_debug"
grep -Fx 'green_schema_acl|7' "$tdd_debug"
grep -Fx 'green_table_acl|653' "$tdd_debug"
grep -Fx 'green_function_acl|46' "$tdd_debug"
grep -Fx 'green_table_effective|571/588' "$tdd_debug"
grep -Fx 'green_function_effective|40/56' "$tdd_debug"
grep -Fx 'green_schema_effective|5/8' "$tdd_debug"
grep -Fx 'green_public_usage|1' "$tdd_debug"
grep -Fx 'rollback_schema_acl|6' "$tdd_debug"
grep -Fx 'rollback_public_usage|0' "$tdd_debug"
grep -Fx 'production_preserved|1' "$tdd_debug"
grep -Fx 'container_isolation_preserved|1' "$tdd_debug"

production_before="$run_dir/production-acl-normalization.before.tsv"
isolated_pre="$run_dir/isolated-acl-normalization.pre.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'production',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$production_before"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'isolated_pre',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$isolated_pre"
chmod 0600 "$production_before" "$isolated_pre"
grep -Fx 'production|7|1' "$production_before"
grep -Fx 'isolated_pre|6|0' "$isolated_pre"

normalization_hash_file="$run_dir/isolated-acl-normalization.output.sha256"
install -m 0600 /dev/null "$normalization_hash_file"
set +e
{
  docker exec -i "$container_name" psql -X -U postgres -d "$replay_db" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
do $pre_guard$
declare
  schema_acl_count bigint;
  public_usage_count bigint;
begin
  if current_user <> 'postgres' or (select rolsuper from pg_roles where rolname=current_user) then
    raise exception 'normalization must run as non-superuser postgres';
  end if;
  if not exists (
    select 1 from pg_database d join pg_roles r on r.oid=d.datdba
    where d.datname=current_database() and r.rolname='postgres'
  ) then
    raise exception 'postgres is not the replay database owner';
  end if;
  select count(*),count(*) filter(where e.grantee=0 and e.privilege_type='USAGE')
    into schema_acl_count,public_usage_count
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public';
  if schema_acl_count <> 6 or public_usage_count <> 0 then
    raise exception 'isolated public-schema ACL precondition mismatch';
  end if;
end
$pre_guard$;
GRANT USAGE ON SCHEMA public TO PUBLIC;
do $post_guard$
declare
  schema_acl_count bigint;
  public_usage_count bigint;
begin
  select count(*),count(*) filter(where e.grantee=0 and e.privilege_type='USAGE')
    into schema_acl_count,public_usage_count
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public';
  if schema_acl_count <> 7 or public_usage_count <> 1 then
    raise exception 'isolated public-schema ACL postcondition mismatch';
  end if;
end
$post_guard$;
COMMIT;
SQL
} 2>&1 | sha256sum | awk '{print $1}' > "$normalization_hash_file"
normalization_pipeline=("${PIPESTATUS[@]}")
set -e
normalization_status=${normalization_pipeline[0]}
test "${normalization_pipeline[1]}" -eq 0
test "${normalization_pipeline[2]}" -eq 0
read -r normalization_hash < "$normalization_hash_file"
[[ "$normalization_hash" =~ ^[0-9a-f]{64}$ ]]
printf 'normalization_status|%s\noutput_sha256|%s\ntransaction|single\nreplay_role|postgres\npre_guard|6/0\npost_guard|7/1\nproduction_mutation|false\n' \
  "$normalization_status" "$normalization_hash" \
  > "$run_dir/isolated-acl-normalization.status.tsv"
chmod 0600 "$run_dir/isolated-acl-normalization.status.tsv"
test "$normalization_status" -eq 0

isolated_post="$run_dir/isolated-acl-normalization.post.tsv"
production_after="$run_dir/production-acl-normalization.after.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'isolated_post',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$isolated_post"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'production',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$production_after"
chmod 0600 "$isolated_post" "$production_after" "$normalization_hash_file"
grep -Fx 'isolated_post|7|1' "$isolated_post"
grep -Fx 'production|7|1' "$production_after"
cmp -s "$production_before" "$production_after"
grep -Fx 'normalization_status|0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'transaction|single' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'replay_role|postgres' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'pre_guard|6/0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'post_guard|7/1' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'production_mutation|false' "$run_dir/isolated-acl-normalization.status.tsv"
test "$(find "$run_dir" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
```

Expected: aggregate-only archive evidence proves one schema-ACL TOC item, four public-schema grants, and zero PUBLIC/PUBLIC-USAGE grants; production is `7/1`; replay pre-state is `6/0`; and the retained TDD evidence has the exact approved hash/status, seven GREEN fidelity aggregates, and PUBLIC-USAGE `1`. Only isolated non-superuser database owner `postgres` runs one transaction containing the guarded `6/0` precondition, exactly `GRANT USAGE ON SCHEMA public TO PUBLIC`, guarded `7/1` postcondition, and commit. Raw output is reduced to SHA-256/status; persistent isolated post-evidence is `7/1`, production remains byte-identical `7/1`, every new file is `0600`, and any mismatch stops before the grant or before fidelity.

- [x] **Step 15: Prove every GREEN restore-plus-normalization fidelity gate before fixtures**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
grep -Fx 'normalization_status|0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'transaction|single' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'pre_guard|6/0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'post_guard|7/1' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'production_mutation|false' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'isolated_post|7|1' "$run_dir/isolated-acl-normalization.post.tsv"
cmp -s "$run_dir/production-acl-normalization.before.tsv" "$run_dir/production-acl-normalization.after.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i'),
 (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public');" \
  > "$run_dir/isolated-core-counts.tsv"
grep -Fx '21|53|96|5|39|14' "$run_dir/isolated-core-counts.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select kind,schema_name,owner_name,object_count from (
 select 'SCHEMA'::text kind,n.nspname schema_name,pg_get_userbyid(n.nspowner) owner_name,count(*)::bigint object_count
 from pg_namespace n where n.nspname='public' group by n.nspname,n.nspowner
 union all
 select 'RELATION:'||c.relkind::text,n.nspname,pg_get_userbyid(c.relowner),count(*)::bigint
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','i','S') group by c.relkind,n.nspname,c.relowner
 union all
 select 'FUNCTION',n.nspname,pg_get_userbyid(p.proowner),count(*)::bigint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' group by n.nspname,p.proowner
) q order by kind,schema_name,owner_name;" > "$run_dir/isolated-owner.tsv"
cmp -s "$run_dir/production-owner.before.tsv" "$run_dir/isolated-owner.tsv"
grep -Fx 'SCHEMA|public|pg_database_owner|1' "$run_dir/isolated-owner.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'default_acl',count(*),count(*) filter(where r.rolname='postgres'),count(*) filter(where r.rolname='supabase_admin')
from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace join pg_roles r on r.oid=d.defaclrole
where n.nspname='public';
select 'schema_acl',count(*) from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='public';
select 'table_acl',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname='public' and c.relkind='r';
select 'function_acl',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a where n.nspname='public';
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
tables as (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
select 'table_effective',count(*) filter(where has_table_privilege(role_name,oid,privilege_name)),count(*) from roles cross join privs cross join tables;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
funcs as (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
select 'function_effective',count(*) filter(where has_function_privilege(role_name,oid,'EXECUTE')),count(*) from roles cross join funcs;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('USAGE'),('CREATE'))
select 'schema_effective',count(*) filter(where has_schema_privilege(role_name,'public',privilege_name)),count(*) from roles cross join privs;" \
  > "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'default_acl|6|3|3' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'schema_acl|7' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'table_acl|653' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'function_acl|46' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'table_effective|571|588' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'function_effective|40|56' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'schema_effective|5|8' "$run_dir/isolated-acl-privileges.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.staff_users),
 (select count(*) from supabase_migrations.schema_migrations);" \
  > "$run_dir/isolated-zero-row-baseline.tsv"
grep -Fx '0|0' "$run_dir/isolated-zero-row-baseline.tsv"
chmod 0600 "$run_dir"/*
```

Expected GREEN: the isolated-only normalization status and post-evidence are exact, production ACL evidence is unchanged, core counts are `21/53/96/5/39/14`, default ACL is `6 (3+3)`, schema/table/function ACL is `7/653/46`, effective privileges are `571/588`, `40/56`, `5/8`, the five-line owner distribution is byte-identical, public owner is `pg_database_owner`, and staff/history rows are zero. Any mismatch stops before fixtures.

- [x] **Step 16: Seal Task 4 evidence while retaining the running isolated container and volume**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
docker volume inspect "$volume_name" >/dev/null
test "$(stat -c %a "$run_dir/bootstrap-password")" = 600
manifest_tmp="$evidence_root/.task4-$run_id.sha256.tmp"
find "$run_dir" -maxdepth 1 -type f \
  ! -name bootstrap-password ! -name TASK4-SHA256SUMS \
  -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$manifest_tmp"
chmod 0600 "$manifest_tmp"
mv -f -- "$manifest_tmp" "$run_dir/TASK4-SHA256SUMS"
test "$(find "$run_dir" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
(cd / && sha256sum -c "$run_dir/TASK4-SHA256SUMS" >/dev/null)
```

Expected: all non-secret Task-4 evidence—including archive normalization counts, retained TDD proof, transaction output/status, persistent `7/1` post-state, and production-preservation files—verifies automatically; every evidence file is `0600`; and the secret/container/volume are retained. The secret itself is deliberately excluded from checksum manifests.

## Task 5: Gate the committed handoff and build the new no-log replay lane

> **Quarantine boundary:** the retained Tasks 1–4 container, volume, databases, secret, and container log are historical evidence only. This task never opens a session in that container and never reads its log. Only selected host-side container/volume metadata may be inspected. All new database work occurs in a new container and a new volume.

**Files:**
- Verify only: canonical plan/design, committed execution package, sealed Tasks 1–4 evidence, production and quarantine metadata
- Create outside Git only after the immutable gate: one root-only v5 execution directory, new secret, new volume, new container, three new databases, safe evidence
- Modify no repository, production, service, nginx, application, provider/model, CLIProxyAPI, `9router`, retained resource, or history state

- [ ] **Step 1: Invoke the sealed full immutable gate before creating anything**

This gate is entirely read-only. A failure stops before an evidence directory, secret, volume, container, or database is created. The small bootstrap below authenticates the package and its single reusable `VERIFY.sh`; that helper then performs the complete approval/package/commit/canonical/unrelated-state validation. The exact same invocation is repeated in Step 6.

```bash
set -euo pipefail
repo=/opt/thoidai-work
handoff_pointer=/opt/thoidai-reconciliation/HANDOFF.current
invoke_full_immutable_gate() {
  local pointer=$1 package payload
  test -f "$pointer"
  test ! -L "$pointer"
  test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'
  test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
  IFS= read -r package < "$pointer"
  case "$package" in
    /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;;
    *) return 41 ;;
  esac
  test -d "$package"
  test ! -L "$package"
  test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
  printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - \
    <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
  for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do
    test -f "$package/$payload"
    test ! -L "$package/$payload"
    test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'
  done
  test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5
  awk 'NF!=2 || $1 !~ /^[0-9a-f]{64}$/ {exit 41}' "$package/SHA256SUMS"
  printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS")
  (cd "$package" && sha256sum -c SHA256SUMS >/dev/null)
  bash "$package/VERIFY.sh" "$pointer"
  printf '%s\n' "$package"
}
handoff_package=$(invoke_full_immutable_gate "$handoff_pointer")
test -n "$handoff_package"
```

Expected: the one sealed full gate rejects any pointer, package, payload, schema, approval, Git object, canonical byte, or unrelated-worktree ambiguity. `REVIEW.tsv` must have exactly the ten approved keys and no duplicate/conflicting/extra record; `COMMIT.tsv` must have exactly its complete bound schema. HEAD is a non-merge direct child of the authorized predecessor with exactly the two documentation paths; the index and canonical paths are clean against HEAD; reviewed, packaged, canonical, and committed bytes are identical.

- [ ] **Step 2: Record quarantine metadata and safe production/application baselines**

Only after Step 1 passes, create the execution directory. Quarantine inspection selects metadata fields and never inspects environment values, mounts containing secrets, database state, or log content.

```bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r old_run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r old_run_id quarantine_container quarantine_volume old_bootstrap old_bootstrap_db old_database < "$old_run_dir/names.tsv"
test -n "$quarantine_container"
test -n "$quarantine_volume"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
nonce=$(openssl rand -hex 6)
recovery_dir="/opt/thoidai-reconciliation/phase0-v5-execution-$stamp-$nonce"
install -d -m 0700 "$recovery_dir"
printf '%s\n' "$recovery_dir" > "$recovery_dir/self.path"
chmod 0600 "$recovery_dir/self.path"
pending_tmp=$(mktemp /opt/thoidai-reconciliation/.phase0-v5-execution.pending.XXXXXX)
printf '%s\n' "$recovery_dir" > "$pending_tmp"
chmod 0600 "$pending_tmp"
mv -T "$pending_tmp" /opt/thoidai-reconciliation/phase0-v5-execution.pending
docker inspect -f 'container_id|{{.Id}}{{println}}state|{{.State.Status}}{{println}}image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}privileged|{{.HostConfig.Privileged}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}' \
  "$quarantine_container" > "$recovery_dir/quarantine-container.before.tsv"
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$quarantine_volume" > "$recovery_dir/quarantine-volume.before.tsv"
printf 'runtime_session|forbidden\nlog_read|forbidden\ncontainer_mutation|false\nvolume_mutation|false\n' \
  > "$recovery_dir/quarantine-policy.tsv"
cd "$repo"
git rev-parse HEAD > "$recovery_dir/head.before"
git rev-parse HEAD^{tree} > "$recovery_dir/tree.before"
git status --porcelain=v1 --untracked-files=all > "$recovery_dir/root-status.before"
sha256sum "$recovery_dir/root-status.before" | awk '{print $1}' > "$recovery_dir/root-status.before.sha256"
test "$(git diff --cached --name-only | wc -l)" -eq 0
systemctl show thoidai-work -p ActiveState -p SubState -p MainPID -p NRestarts -p ExecMainStartTimestampMonotonic --value \
  > "$recovery_dir/application-systemd.before.tsv"
systemctl cat thoidai-work | sha256sum | awk '{print $1}' > "$recovery_dir/application-unit.before.sha256"
main_pid=$(systemctl show thoidai-work -p MainPID --value)
test "$main_pid" -gt 1
readlink -f "/proc/$main_pid/exe" | sha256sum | awk '{print $1}' > "$recovery_dir/application-exe-path.before.sha256"
sha256sum "$(readlink -f "/proc/$main_pid/exe")" | awk '{print $1}' > "$recovery_dir/application-exe.before.sha256"
sha256sum "$repo/.next/BUILD_ID" | awk '{print $1}' > "$recovery_dir/build-id.before.sha256"
stat -c '%d|%i|%s|%Y|%F' "$repo/.next" > "$recovery_dir/next-stat.before.tsv"
ss -H -lntup | awk '{print $1"|"$5"|"$7}' | LC_ALL=C sort | sha256sum | awk '{print $1}' \
  > "$recovery_dir/socket-topology.before.sha256"
docker ps --format '{{.Names}}|{{.Image}}' | LC_ALL=C sort | sha256sum | awk '{print $1}' \
  > "$recovery_dir/docker-topology.before.sha256"
printf 'provider_model_mutation_authorized|false\nprovider_model_mutation_count|0\nCLIProxyAPI_mutation_authorized|false\nCLIProxyAPI_mutation_count|0\n9router_mutation_authorized|false\n9router_mutation_count|0\nproc_environment_read|false\nprovider_secret_read_or_hash|false\n' \
  > "$recovery_dir/routing-preservation.before.tsv"
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
nginx -t
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = true
docker exec supabase_db_thoidai-work pg_isready -q -U postgres -d postgres
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/login > "$recovery_dir/login-http.before.tsv"
test "$(cat "$recovery_dir/login-http.before.tsv")" = 200
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/api/auth/session > "$recovery_dir/session-http.before.tsv"
test "$(cat "$recovery_dir/session-http.before.tsv")" = 401
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "begin read only;
select (select count(*) from supabase_migrations.schema_migrations),
       (select count(*) from supabase_migrations.schema_migrations where version in
       ('20260813172000','20260813210000','20260813220000','20260813230000','20260813233000','20260813234500','20260814070000','20260814102000','20260814130000','20260814160000','20260814170000'));
commit;" > "$recovery_dir/production-history.before.tsv"
grep -Fx '9|0' "$recovery_dir/production-history.before.tsv"
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-data.before.tsv"
begin read only;
select 'ADMIN_POLICY',count(*) filter(where r.code='admin'),
 count(*) filter(where r.code='admin' and rp.can_manage_users and rp.can_manage_permissions
   and rp.can_create_task and rp.can_edit_all_tasks and rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'TBT_POLICY',count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')),
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')
   and not rp.can_manage_users and not rp.can_manage_permissions
   and not rp.can_create_task and not rp.can_edit_all_tasks and not rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'JOB_TITLE',count(*),(select count(*) from public.staff_users where job_title_id is not null),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null)
from public.job_titles;
select 'LIST_ORDER',count(*) filter(where list_order<0),count(*) filter(where list_order>0),
 count(distinct list_order) filter(where list_order>0),
 coalesce(min(list_order) filter(where list_order>0),0),coalesce(max(list_order) filter(where list_order>0),0)
from public.staff_users;
commit;
SQL
test "$(sha256sum "$recovery_dir/production-data.before.tsv" | awk '{print $1}')" = 8a3630780d584b8d75c2ec87ec400d2f6262949e606c08c1465b97b769eaf807
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-functions.before.tsv"
begin read only;
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint',
 'ensure_staff_password_hash','consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write','create_bulk_task_plan',
 'report_task_progress','review_task_completion','prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);
commit;
SQL
test "$(sha256sum "$recovery_dir/production-functions.before.tsv" | awk '{print $1}')" = eeaf94c0015d930e3abf84f7309030ba5700fe6df8410430cf9bf6f6f0eddc52
chmod 0600 "$recovery_dir"/*
```

Expected: quarantine policy is explicit; selected metadata, Git, production history `9|0`, service, build, process, HTTP, and topology baselines are sealed. No environment or provider-secret bytes are read or hashed.

- [ ] **Step 3: Verify image/headroom, allocate unique names, and create a new secret**

```bash
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
approved_image='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
approved_image_id='sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
test "$(docker image inspect -f '{{.Id}}' "$approved_image")" = "$approved_image_id"
test "$(docker image inspect -f '{{.Os}}|{{.Architecture}}' "$approved_image")" = 'linux|amd64'
available_kib=$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')
available_mem_kib=$(awk '/MemAvailable:/{print $2}' /proc/meminfo)
test "$available_kib" -ge 5242880
test "$available_mem_kib" -ge 2097152
nonce=$(openssl rand -hex 6)
lane_container="thoidai_phase0_v3_$nonce"
lane_volume="thoidai_phase0_v3_data_$nonce"
fresh_db="phase0_fresh_$nonce"
diagnostic_db="phase0_diag_$nonce"
successor_db="phase0_successor_$nonce"
for safe_name in "$lane_container" "$lane_volume" "$fresh_db" "$diagnostic_db" "$successor_db"; do
  [[ "$safe_name" =~ ^[a-z][a-z0-9_]{5,62}$ ]]
done
! docker container inspect "$lane_container" >/dev/null 2>&1
! docker volume inspect "$lane_volume" >/dev/null 2>&1
secret_file="$recovery_dir/postgres-password.secret"
test ! -e "$secret_file"
openssl rand -base64 48 > "$secret_file"
chown root:root "$secret_file"
chmod 0600 "$secret_file"
test -s "$secret_file"
printf 'container|%s\nvolume|%s\nfresh_template|%s\ndiagnostic|%s\nsuccessor|%s\n' \
  "$lane_container" "$lane_volume" "$fresh_db" "$diagnostic_db" "$successor_db" \
  > "$recovery_dir/lane-names.tsv"
printf 'image_id|%s\nnetwork|none\nports|0\nlog_driver|none\ncpu_nano|1000000000\nmemory|1073741824\nmemory_swap|1073741824\npids|256\nrestart|no\nauto_remove|false\nprivileged|false\n' \
  "$approved_image_id" > "$recovery_dir/lane-policy.expected.tsv"
chmod 0600 "$recovery_dir/lane-names.tsv" "$recovery_dir/lane-policy.expected.tsv"
```

Expected: local pinned image and headroom pass; five noncolliding safe names and a new unread/unhashed secret are created. No image pull occurs.

- [ ] **Step 4: Create and start the new isolated container with logging disabled**

```bash
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
secret_file="$recovery_dir/postgres-password.secret"
approved_image='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
docker volume create "$lane_volume" >/dev/null
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$lane_volume" > "$recovery_dir/lane-volume.before.tsv"
docker create --name "$lane_container" \
  --network none \
  --log-driver none \
  --cpus 1 \
  --memory 1g \
  --memory-swap 1g \
  --pids-limit 256 \
  --restart no \
  --mount "type=volume,src=$lane_volume,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$secret_file,dst=/run/secrets/phase0-postgres-password,readonly" \
  --tmpfs /run/phase0:rw,noexec,nosuid,size=16m,mode=0700 \
  --env POSTGRES_USER=phase0_bootstrap \
  --env POSTGRES_DB=postgres \
  --env POSTGRES_PASSWORD_FILE=/run/secrets/phase0-postgres-password \
  --env 'POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8' \
  "$approved_image" \
  -c log_statement=none \
  -c log_min_error_statement=panic \
  -c logging_collector=off \
  -c log_destination=stderr \
  -c log_error_verbosity=terse >/dev/null
test "$(docker inspect -f '{{.Image}}' "$lane_container")" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$lane_container")" = none
test "$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$lane_container")" = none
test "$(docker inspect -f '{{.HostConfig.Privileged}}' "$lane_container")" = false
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$lane_container")" -eq 1000000000
test "$(docker inspect -f '{{.HostConfig.Memory}}' "$lane_container")" -eq 1073741824
test "$(docker inspect -f '{{.HostConfig.MemorySwap}}' "$lane_container")" -eq 1073741824
test "$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$lane_container")" -eq 256
test "$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$lane_container")" = no
test "$(docker inspect -f '{{.HostConfig.AutoRemove}}' "$lane_container")" = false
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$secret_file|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
docker inspect -f 'image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}ports|{{len .NetworkSettings.Ports}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}cpu_nano|{{.HostConfig.NanoCpus}}{{println}}memory|{{.HostConfig.Memory}}{{println}}memory_swap|{{.HostConfig.MemorySwap}}{{println}}pids|{{.HostConfig.PidsLimit}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}{{println}}privileged|{{.HostConfig.Privileged}}' \
  "$lane_container" > "$recovery_dir/lane-policy.actual.tsv"
cmp -s "$recovery_dir/lane-policy.expected.tsv" "$recovery_dir/lane-policy.actual.tsv"
docker start "$lane_container" >/dev/null
ready=false
for attempt in $(seq 1 45); do
  if docker exec "$lane_container" pg_isready -q -U phase0_bootstrap -d postgres; then
    ready=true
    break
  fi
  sleep 1
done
if test "$ready" != true; then
  printf 'ready|false\nlog_read|forbidden\nretained|true\n' > "$recovery_dir/lane-start.failure.tsv"
  chmod 0600 "$recovery_dir/lane-start.failure.tsv"
  exit 42
fi
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select name,setting from pg_settings where name in
   ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name;" \
  > "$recovery_dir/postgres-logging.actual.tsv"
cat > "$recovery_dir/postgres-logging.expected.tsv" <<'EOF'
log_destination|stderr
log_error_verbosity|terse
log_min_error_statement|panic
log_statement|none
logging_collector|off
EOF
cmp -s "$recovery_dir/postgres-logging.expected.tsv" "$recovery_dir/postgres-logging.actual.tsv"
chmod 0600 "$recovery_dir"/*
```

Expected: the container is running with exact image, network, port, log-driver, resource, privilege, restart, mount, tmpfs, and PostgreSQL logging controls. Readiness failure records only generic status and retains the container without restart or cleanup.

- [ ] **Step 5: Bootstrap roles, restore the fresh template, normalize, and clone two new lanes**

```bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
archive="$evidence_root/public-history-schema.dump"
test "$(sha256sum "$archive" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
old_run_dir="$evidence_root/isolated-20260814163047_c35634c9"
(cd "$old_run_dir" && sha256sum -c TASK4-SHA256SUMS >/dev/null)
docker exec -i "$lane_container" psql -X -U phase0_bootstrap -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $guard$
begin
  if not exists (select 1 from pg_roles where rolname='pg_database_owner') then raise exception 'built-in database-owner role missing'; end if;
  if exists (select 1 from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated','service_role')) then raise exception 'archive role collision'; end if;
end
$guard$;
create role postgres nosuperuser inherit createrole createdb login replication bypassrls password null;
create role supabase_admin superuser inherit createrole createdb login replication bypassrls password null;
create role anon nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role authenticated nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role service_role nosuperuser inherit nocreaterole nocreatedb nologin noreplication bypassrls password null;
grant anon,authenticated,service_role,pg_create_subscription,pg_monitor,pg_read_all_data,pg_signal_backend to postgres with admin option;
SQL
awk -F '|' 'BEGIN{OFS="|"}{print $1,$2,$3,$5,$4,$6,$7,$8,-1,$9}' "$old_run_dir/archive-roles.expected.tsv" > "$recovery_dir/role-manifest.expected.unsorted.tsv"
cat >> "$recovery_dir/role-manifest.expected.unsorted.tsv" <<'EOF'
phase0_bootstrap|t|t|t|t|t|t|t|-1|f
pg_create_subscription|f|t|f|f|f|f|f|-1|t
pg_monitor|f|t|f|f|f|f|f|-1|t
pg_read_all_data|f|t|f|f|f|f|f|-1|t
pg_signal_backend|f|t|f|f|f|f|f|-1|t
EOF
LC_ALL=C sort "$recovery_dir/role-manifest.expected.unsorted.tsv" > "$recovery_dir/role-manifest.expected.tsv"
rm -f "$recovery_dir/role-manifest.expected.unsorted.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolpassword is null
from pg_authid where rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role','pg_database_owner','pg_create_subscription','pg_monitor','pg_read_all_data','pg_signal_backend') order by rolname;" > "$recovery_dir/role-manifest.actual.tsv"
cmp -s "$recovery_dir/role-manifest.expected.tsv" "$recovery_dir/role-manifest.actual.tsv"
cat > "$recovery_dir/role-memberships.expected.tsv" <<'EOF'
anon|postgres|t|t|t
authenticated|postgres|t|t|t
pg_create_subscription|postgres|t|t|t
pg_monitor|postgres|t|t|t
pg_read_all_data|postgres|t|t|t
pg_signal_backend|postgres|t|t|t
service_role|postgres|t|t|t
EOF
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select granted_role.rolname,member_role.rolname,m.admin_option,m.inherit_option,m.set_option
from pg_auth_members m join pg_roles granted_role on granted_role.oid=m.roleid join pg_roles member_role on member_role.oid=m.member
where member_role.rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role') or granted_role.rolname in ('postgres','supabase_admin','anon','authenticated','service_role') order by 1,2,3,4,5;" > "$recovery_dir/role-memberships.actual.tsv"
cmp -s "$recovery_dir/role-memberships.expected.tsv" "$recovery_dir/role-memberships.actual.tsv"
install -m 0600 /dev/null "$recovery_dir/role-forbidden.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select rolname from pg_roles where rolname in ('authenticator','supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin') order by rolname;" > "$recovery_dir/role-forbidden.actual.tsv"
cmp -s "$recovery_dir/role-forbidden.expected.tsv" "$recovery_dir/role-forbidden.actual.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -c "create database :\"fresh_db\" with owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale 'en-US' locale 'en_US.UTF-8';" >/dev/null
docker exec "$lane_container" psql -X -U phase0_bootstrap -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "create schema extensions authorization postgres;" >/dev/null
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "create extension pgcrypto with schema extensions;" >/dev/null
test "$(docker exec "$lane_container" psql -X -U phase0_bootstrap -d "$fresh_db" -qAt -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';")" -eq 0
docker exec "$lane_container" psql -X -U phase0_bootstrap -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "drop schema public;" >/dev/null
set +e
docker exec -i "$lane_container" pg_restore -U phase0_bootstrap -d "$fresh_db" --no-comments --exit-on-error --single-transaction \
  < "$archive" >/dev/null 2>/dev/null
restore_status=$?
set -e
printf 'restore_status|%s\nraw_output_persisted|false\n' "$restore_status" > "$recovery_dir/restore.status.tsv"
test "$restore_status" -eq 0
old_run_dir="$evidence_root/isolated-20260814163047_c35634c9"
grep -Fx 'semantic_public_usage_grants|0' "$old_run_dir/archive-public-schema-acl.counts.tsv"
grep -Fx 'production|7|1' "$old_run_dir/production-acl-normalization.before.tsv"
grep -Fx 'production|7|1' "$old_run_dir/production-acl-normalization.after.tsv"
grep -Fx 'normalization_status|0' "$old_run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'pre_guard|6/0' "$old_run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'post_guard|7/1' "$old_run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'isolated_pre|6|0' "$old_run_dir/isolated-acl-normalization.pre.tsv"
grep -Fx 'isolated_post|7|1' "$old_run_dir/isolated-acl-normalization.post.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select count(*),count(*) filter(where a.grantee=0 and a.privilege_type='USAGE')
   from aclexplode(coalesce((select nspacl from pg_namespace where nspname='public'),
        acldefault('n',(select nspowner from pg_namespace where nspname='public')))) a;" \
  > "$recovery_dir/public-usage.pre.tsv"
grep -Fx '6|0' "$recovery_dir/public-usage.pre.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "begin; grant usage on schema public to public; commit;" >/dev/null
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select count(*),count(*) filter(where a.grantee=0 and a.privilege_type='USAGE')
   from aclexplode(coalesce((select nspacl from pg_namespace where nspname='public'),
        acldefault('n',(select nspowner from pg_namespace where nspname='public')))) a;" \
  > "$recovery_dir/public-usage.post.tsv"
grep -Fx '7|1' "$recovery_dir/public-usage.post.tsv"
capture_lane_fidelity() {
  local lane_db=$1
  local prefix=$2
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'COLUMN',table_name,column_name,data_type,is_nullable,
       case when column_default is null then 'no_default' else 'has_default' end,
       is_generated,md5(coalesce(generation_expression,''))
from information_schema.columns
where table_schema='public' and (
 (table_name='tasks' and column_name in ('plan_period','self_claimable','plan_batch_id'))
 or (table_name='staff_users' and column_name in ('password','password_hash','job_title_id','list_order','session_version'))
 or (table_name='task_evaluation_checkpoints' and column_name='total_score'))
union all
select 'TABLE',c.relname,'-',c.relkind::text,c.relrowsecurity::text,c.relforcerowsecurity::text,'-',
       md5((select string_agg(x.column_name||':'||x.data_type,',' order by x.ordinal_position)
            from information_schema.columns x where x.table_schema='public' and x.table_name=c.relname))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('job_titles','password_reset_tokens','password_reset_attempts')
order by 1,2,3;" > "$prefix.catalog.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'INDEX',c.relname,md5(pg_get_indexdef(c.oid))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='i' and c.relname in (
 'idx_tasks_self_claimable','idx_password_reset_tokens_user_created','idx_password_reset_tokens_expiry',
 'idx_password_reset_attempts_fingerprint_created','job_titles_code_lower_uidx','job_titles_name_lower_uidx',
 'staff_users_job_title_id_idx','idx_tasks_plan_batch_id','staff_users_list_order_idx')
union all
select 'CONSTRAINT',conname,md5(pg_get_constraintdef(oid,true)) from pg_constraint
where conname in ('tasks_plan_period_check','staff_users_list_order_nonnegative','staff_users_session_version_nonnegative')
union all
select 'TRIGGER',trigger_name,md5(string_agg(event_manipulation,',' order by event_manipulation))
from information_schema.triggers where trigger_schema='public' and trigger_name in (
 'validate_task_report_recipient','trg_staff_users_password_hash','job_titles_set_updated_at','staff_users_guard_job_title_write')
group by trigger_name
union all
select 'POLICY',policyname,md5(cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''))
from pg_policies where schemaname='public' and policyname in (
 'public read job_titles','protect_password_reset_audit_insert','protect_password_reset_audit_update','protect_password_reset_audit_delete')
order by 1,2;" >> "$prefix.catalog.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint','ensure_staff_password_hash',
 'consume_password_reset','can_administer_users','touch_job_titles_updated_at','guard_staff_job_title_write',
 'create_bulk_task_plan','report_task_progress','review_task_completion','prepare_admin_password_reset',
 'finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" > "$prefix.functions.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i'),
 (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public');" > "$prefix.core.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select kind,schema_name,owner_name,object_count from (
 select 'SCHEMA'::text kind,n.nspname schema_name,pg_get_userbyid(n.nspowner) owner_name,count(*)::bigint object_count
 from pg_namespace n where n.nspname='public' group by n.nspname,n.nspowner
 union all
 select 'RELATION:'||c.relkind::text,n.nspname,pg_get_userbyid(c.relowner),count(*)::bigint
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','i','S') group by c.relkind,n.nspname,c.relowner
 union all
 select 'FUNCTION',n.nspname,pg_get_userbyid(p.proowner),count(*)::bigint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' group by n.nspname,p.proowner
) q order by kind,schema_name,owner_name;" > "$prefix.owner.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'default_acl',count(*),count(*) filter(where r.rolname='postgres'),count(*) filter(where r.rolname='supabase_admin')
from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace join pg_roles r on r.oid=d.defaclrole where n.nspname='public';
select 'schema_acl',count(*) from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='public';
select 'table_acl',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname='public' and c.relkind='r';
select 'function_acl',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a where n.nspname='public';
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
tables as (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
select 'table_effective',count(*) filter(where has_table_privilege(role_name,oid,privilege_name)),count(*) from roles cross join privs cross join tables;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
funcs as (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
select 'function_effective',count(*) filter(where has_function_privilege(role_name,oid,'EXECUTE')),count(*) from roles cross join funcs;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('USAGE'),('CREATE'))
select 'schema_effective',count(*) filter(where has_schema_privilege(role_name,'public',privilege_name)),count(*) from roles cross join privs;" > "$prefix.acl.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select extname,extversion,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where extname in ('plpgsql','pgcrypto') order by extname;" > "$prefix.extensions.tsv"
  docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -v lane_db="$lane_db" -c "
select 'database',pg_get_userbyid(d.datdba),pg_encoding_to_char(d.encoding),d.datlocprovider,
       d.datcollate,d.datctype,d.datlocale,d.datallowconn from pg_database d where d.datname=:'lane_db';" > "$prefix.locale.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'data_checksums',current_setting('data_checksums');
select 'server_version_num',current_setting('server_version_num');" >> "$prefix.locale.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "select
 (select count(*) from public.roles),(select count(*) from public.role_permissions),
 (select count(*) from public.departments),(select count(*) from public.staff_users),
 (select count(*) from public.tasks),(select count(*) from public.audit_logs),
 (select count(*) from supabase_migrations.schema_migrations);" > "$prefix.zero.tsv"
  chmod 0600 "$prefix".*.tsv
}
fresh_prefix="$recovery_dir/fresh-fidelity"
capture_lane_fidelity "$fresh_db" "$fresh_prefix"
test "$(sha256sum "$evidence_root/production-catalog.before.tsv" | awk '{print $1}')" = f51be200ffe272d0a221302eb492ca3b1c7939b30a6e3e96ebef6750982722b5
test "$(sha256sum "$evidence_root/production-function-body.before.tsv" | awk '{print $1}')" = eeaf94c0015d930e3abf84f7309030ba5700fe6df8410430cf9bf6f6f0eddc52
test "$(sha256sum "$old_run_dir/production-owner.before.tsv" | awk '{print $1}')" = 47141fee0d6dab9edd6711e5b707f620225b7a36c931a2e1bef1addc7c747d98
cmp -s "$evidence_root/production-catalog.before.tsv" "$fresh_prefix.catalog.tsv"
cmp -s "$evidence_root/production-function-body.before.tsv" "$fresh_prefix.functions.tsv"
cmp -s "$old_run_dir/production-owner.before.tsv" "$fresh_prefix.owner.tsv"
grep -Fx '21|53|96|5|39|14' "$fresh_prefix.core.tsv"
grep -Fx 'default_acl|6|3|3' "$fresh_prefix.acl.tsv"
grep -Fx 'schema_acl|7' "$fresh_prefix.acl.tsv"
grep -Fx 'table_acl|653' "$fresh_prefix.acl.tsv"
grep -Fx 'function_acl|46' "$fresh_prefix.acl.tsv"
grep -Fx 'table_effective|571|588' "$fresh_prefix.acl.tsv"
grep -Fx 'function_effective|40|56' "$fresh_prefix.acl.tsv"
grep -Fx 'schema_effective|5|8' "$fresh_prefix.acl.tsv"
grep -Fx 'pgcrypto|1.3|extensions' "$fresh_prefix.extensions.tsv"
grep -Fx 'plpgsql|1.0|pg_catalog' "$fresh_prefix.extensions.tsv"
grep -Fx 'database|postgres|UTF8|i|en_US.UTF-8|en_US.UTF-8|en-US|t' "$fresh_prefix.locale.tsv"
grep -Fx 'data_checksums|off' "$fresh_prefix.locale.tsv"
grep -Fx 'server_version_num|170010' "$fresh_prefix.locale.tsv"
grep -Fx '0|0|0|0|0|0|0' "$fresh_prefix.zero.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c \
  "select 1/ case when (select count(*) from pg_stat_activity where datname=:'fresh_db')=0 then 1 else 0 end;
   create database :\"diagnostic_db\" with owner postgres template :\"fresh_db\";
   create database :\"successor_db\" with owner postgres template :\"fresh_db\";
   alter database :\"fresh_db\" allow_connections false;" >/dev/null
for lane_name in diagnostic successor; do
  if test "$lane_name" = diagnostic; then lane_db=$diagnostic_db; else lane_db=$successor_db; fi
  lane_prefix="$recovery_dir/$lane_name-fidelity"
  capture_lane_fidelity "$lane_db" "$lane_prefix"
  for surface in catalog functions core owner acl extensions locale zero; do
    cmp -s "$fresh_prefix.$surface.tsv" "$lane_prefix.$surface.tsv"
  done
done
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c "
with requested(lane,datname,expected_connections) as (values
 ('diagnostic',:'diagnostic_db',true),('successor',:'successor_db',true),('template',:'fresh_db',false))
select requested.lane,count(d.*),coalesce(min(pg_get_userbyid(d.datdba)),''),
       coalesce(bool_and(d.datallowconn=requested.expected_connections),false)
from requested left join pg_database d using(datname) group by requested.lane order by requested.lane;" \
  > "$recovery_dir/fresh-fidelity.database-lanes.tsv"
grep -Fx 'diagnostic|1|postgres|t' "$recovery_dir/fresh-fidelity.database-lanes.tsv"
grep -Fx 'successor|1|postgres|t' "$recovery_dir/fresh-fidelity.database-lanes.tsv"
grep -Fx 'template|1|postgres|t' "$recovery_dir/fresh-fidelity.database-lanes.tsv"
cat > "$recovery_dir/replay-owner.expected.tsv" <<'EOF'
diagnostic|postgres|f
fresh|postgres|f
successor|postgres|f
EOF
role_gate="$recovery_dir/verify-role-manifest"
cat > "$role_gate" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
lane_container=$1; recovery_dir=$2; fresh_db=$3; diagnostic_db=$4; successor_db=$5
(cd / && sha256sum -c "$recovery_dir/ROLE-EXPECTED-SHA256SUMS" >/dev/null)
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolpassword is null
from pg_authid where rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role','pg_database_owner','pg_create_subscription','pg_monitor','pg_read_all_data','pg_signal_backend') order by rolname;" | cmp -s - "$recovery_dir/role-manifest.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select granted_role.rolname,member_role.rolname,m.admin_option,m.inherit_option,m.set_option
from pg_auth_members m join pg_roles granted_role on granted_role.oid=m.roleid join pg_roles member_role on member_role.oid=m.member
where member_role.rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role') or granted_role.rolname in ('postgres','supabase_admin','anon','authenticated','service_role') order by 1,2,3,4,5;" | cmp -s - "$recovery_dir/role-memberships.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "select rolname from pg_roles where rolname in ('authenticator','supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin') order by rolname;" | cmp -s - "$recovery_dir/role-forbidden.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c "
with requested(lane,datname) as (values ('diagnostic',:'diagnostic_db'),('fresh',:'fresh_db'),('successor',:'successor_db')) select requested.lane,r.rolname,r.rolsuper from requested join pg_database d using(datname) join pg_authid r on r.oid=d.datdba order by requested.lane;" | cmp -s - "$recovery_dir/replay-owner.expected.tsv"
BASH
chmod 0600 "$role_gate"
sha256sum "$recovery_dir/role-manifest.expected.tsv" "$recovery_dir/role-memberships.expected.tsv" "$recovery_dir/role-forbidden.expected.tsv" "$recovery_dir/replay-owner.expected.tsv" "$role_gate" > "$recovery_dir/ROLE-EXPECTED-SHA256SUMS"
chmod 0600 "$recovery_dir/ROLE-EXPECTED-SHA256SUMS"
bash "$role_gate" "$lane_container" "$recovery_dir" "$fresh_db" "$diagnostic_db" "$successor_db"
printf 'roles|PASS\nattributes|exact\nmemberships|exact\nforbidden_roles|zero\nreplay_owner|postgres-nonsuperuser\n' > "$recovery_dir/ROLE-MANIFEST.COMPLETE"
sha256sum "$recovery_dir/role-manifest.expected.tsv" "$recovery_dir/role-manifest.actual.tsv" "$recovery_dir/role-memberships.expected.tsv" "$recovery_dir/role-memberships.actual.tsv" "$recovery_dir/role-forbidden.expected.tsv" "$recovery_dir/role-forbidden.actual.tsv" "$recovery_dir/replay-owner.expected.tsv" "$role_gate" "$recovery_dir/ROLE-EXPECTED-SHA256SUMS" "$recovery_dir/ROLE-MANIFEST.COMPLETE" > "$recovery_dir/ROLE-SHA256SUMS"
(cd / && sha256sum -c "$recovery_dir/ROLE-SHA256SUMS" >/dev/null)
printf 'fidelity|PASS\nroles|exact\ncore_objects|exact\nowners|exact\ndefault_acl|exact\nexplicit_acl|exact\neffective_privileges|exact\nfunctions_grants|13-exact\nextensions|exact\nlocale_settings|exact\nclone_count|2\n' \
  > "$recovery_dir/FIDELITY.COMPLETE"
find "$recovery_dir" -maxdepth 1 -type f \( -name '*-fidelity.*.tsv' -o -name 'FIDELITY.COMPLETE' \) -print0 \
  | LC_ALL=C sort -z | xargs -0 sha256sum > "$recovery_dir/FIDELITY-SHA256SUMS"
(cd / && sha256sum -c "$recovery_dir/FIDELITY-SHA256SUMS" >/dev/null)
chmod 0600 "$recovery_dir"/*
```

Expected: the sealed Task-4 archive-role expectation is extended into an exact eleven-role executable manifest covering bootstrap, archive, replay-owner, and membership-support roles. Every row includes superuser, inherit, database/role creation, login, replication, bypass-RLS, connection-limit, and password-null attributes; the seven allowed memberships and exact empty forbidden-role set compare byte-for-byte. Restore is zero with no raw-output evidence, and the sole normalization is guarded. Fresh-template catalog, core-object, owner, ACL/effective-privilege, thirteen-function/grant, extension, locale/settings, and zero-row evidence matches sealed production/Task-4 expectations; both clones reproduce it. Fresh, diagnostic, and successor are owned by exact non-superuser `postgres`. `ROLE-MANIFEST.COMPLETE`, `FIDELITY.COMPLETE`, and their manifests exist only after all comparisons pass; any mismatch stops before seal. The retained cluster is not queried.

- [ ] **Step 6: Seal Task 5 and publish only the new execution pointer**

The completion marker is the last evidence payload created. It is unreachable until the executable fidelity manifest, immutable package, all new-lane controls, and both quarantine metadata files reverify.

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
repo=/opt/thoidai-work
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
secret_file="$recovery_dir/postgres-password.secret"
(cd / && sha256sum -c "$recovery_dir/FIDELITY-SHA256SUMS" >/dev/null)
grep -Fx 'fidelity|PASS' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'roles|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'core_objects|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'owners|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'default_acl|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'explicit_acl|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'effective_privileges|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'functions_grants|13-exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'extensions|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'locale_settings|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'clone_count|2' "$recovery_dir/FIDELITY.COMPLETE"
test "$(docker image inspect -f '{{.Id}}|{{.Os}}|{{.Architecture}}' postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d)" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|linux|amd64'
test "$(docker inspect -f '{{.State.Running}}' "$lane_container")" = true
test "$(docker inspect -f '{{.Image}}' "$lane_container")" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$lane_container")" = none
port_bindings=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$lane_container")
[[ "$port_bindings" = '{}' || "$port_bindings" = null ]]
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$lane_container")" = none
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{.HostConfig.MemorySwap}}|{{.HostConfig.PidsLimit}}' "$lane_container")" = '1000000000|1073741824|1073741824|256'
test "$(docker inspect -f '{{.HostConfig.Privileged}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.AutoRemove}}' "$lane_container")" = 'false|no|false'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$secret_file|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test -f "$secret_file"
test ! -L "$secret_file"
test "$(stat -c '%U|%G|%a' "$secret_file")" = 'root|root|600'
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$lane_volume" > "$recovery_dir/lane-volume.after-task5.tsv"
cmp -s "$recovery_dir/lane-volume.before.tsv" "$recovery_dir/lane-volume.after-task5.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select name,setting from pg_settings where name in
   ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name;" \
  > "$recovery_dir/postgres-logging.after-task5.tsv"
cmp -s "$recovery_dir/postgres-logging.expected.tsv" "$recovery_dir/postgres-logging.after-task5.tsv"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
read -r old_run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r old_run_id quarantine_container quarantine_volume old_bootstrap old_bootstrap_db old_database < "$old_run_dir/names.tsv"
docker inspect -f 'container_id|{{.Id}}{{println}}state|{{.State.Status}}{{println}}image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}privileged|{{.HostConfig.Privileged}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}' \
  "$quarantine_container" > "$recovery_dir/quarantine-container.after-task5.tsv"
cmp -s "$recovery_dir/quarantine-container.before.tsv" "$recovery_dir/quarantine-container.after-task5.tsv"
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$quarantine_volume" > "$recovery_dir/quarantine-volume.after-task5.tsv"
cmp -s "$recovery_dir/quarantine-volume.before.tsv" "$recovery_dir/quarantine-volume.after-task5.tsv"
(cd / && sha256sum -c "$recovery_dir/ROLE-SHA256SUMS" >/dev/null)
role_gate="$recovery_dir/verify-role-manifest"
bash "$role_gate" "$lane_container" "$recovery_dir" "$fresh_db" "$diagnostic_db" "$successor_db"
grep -Fx 'roles|PASS' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'attributes|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'memberships|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'forbidden_roles|zero' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'replay_owner|postgres-nonsuperuser' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
handoff_pointer=/opt/thoidai-reconciliation/HANDOFF.current
invoke_full_immutable_gate() {
  local pointer=$1 package payload
  test -f "$pointer"; test ! -L "$pointer"; test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'; test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
  IFS= read -r package < "$pointer"; case "$package" in /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;; *) return 41 ;; esac
  test -d "$package"; test ! -L "$package"; test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
  printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
  for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$package/$payload"; test ! -L "$package/$payload"; test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'; done
  test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5; awk 'NF!=2 || $1 !~ /^[0-9a-f]{64}$/ {exit 41}' "$package/SHA256SUMS"
  printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS")
  (cd "$package" && sha256sum -c SHA256SUMS >/dev/null); bash "$package/VERIFY.sh" "$pointer"; printf '%s\n' "$package"
}
handoff_package=$(invoke_full_immutable_gate "$handoff_pointer")
test -n "$handoff_package"
printf 'phase|task5\nstatus|complete\nquarantine_runtime_session|false\nquarantine_log_read|false\nproduction_mutation|false\nhistory_write|false\nnew_lane_retained|true\n' \
  > "$recovery_dir/TASK5.COMPLETE"
find "$recovery_dir" -maxdepth 1 -type f ! -name 'postgres-password.secret' ! -name 'TASK5-SHA256SUMS' -print0 \
  | LC_ALL=C sort -z | xargs -0 sha256sum > "$recovery_dir/TASK5-SHA256SUMS"
chmod 0600 "$recovery_dir/TASK5.COMPLETE" "$recovery_dir/TASK5-SHA256SUMS"
(cd / && sha256sum -c "$recovery_dir/TASK5-SHA256SUMS" >/dev/null)
pointer_tmp=$(mktemp /opt/thoidai-reconciliation/.phase0-v5-execution.current.XXXXXX)
printf '%s\n' "$recovery_dir" > "$pointer_tmp"
chmod 0600 "$pointer_tmp"
mv -T "$pointer_tmp" /opt/thoidai-reconciliation/phase0-v5-execution.current
```

Expected: the one sealed full helper repeats the complete package/approval/commit/canonical/unrelated gate immediately before completion. The role helper re-queries exact attributes, memberships, forbidden-role absence, and three non-superuser `postgres` owners. Fidelity, image/platform, network/ports, logging, resources, privilege/namespaces/caps/devices, mounts/tmpfs, secret metadata, volume identity, and both quarantine metadata files remain exact. Only then is `TASK5.COMPLETE` created and the new execution pointer published. The secret and every container log remain outside all hashes; all resources remain retained.

## Task 6: Seed the successor and replay the two new isolated lanes

> **Lane boundary:** `diagnostic_db` is the new identity-free clone. `successor_db` alone receives synthetic fixtures. The retained Tasks 1–4 database is not a lane and is never queried.

**Files:**
- Verify: Task-5 seal, package, source manifest, new container policy
- Create outside Git: aggregate fixture, sanitized SQLSTATE, rollback, replay, terminal, idempotency, and Task-6 evidence
- Modify only the two bounded databases in the new container; no production or retained-resource mutation

- [ ] **Step 1: Verify the Task-5 seal and seed the successor through fd 0 binding**

The source parser must observe exactly two approved syntax occurrences resolving to one unique value without printing it. The source stays on fd 0; safe psql commands use fd 3. The value is bound, never interpolated.

```bash
set -euo pipefail
set +x
umask 077
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
(cd / && sha256sum -c "$recovery_dir/TASK5-SHA256SUMS" >/dev/null)
grep -Fx 'status|complete' "$recovery_dir/TASK5.COMPLETE"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
secret_file="$recovery_dir/postgres-password.secret"
(cd / && sha256sum -c "$recovery_dir/FIDELITY-SHA256SUMS" >/dev/null)
grep -Fx 'fidelity|PASS' "$recovery_dir/FIDELITY.COMPLETE"
test "$(docker image inspect -f '{{.Id}}|{{.Os}}|{{.Architecture}}' postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d)" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|linux|amd64'
test "$(docker inspect -f '{{.State.Running}}|{{.Image}}|{{.HostConfig.NetworkMode}}|{{.HostConfig.LogConfig.Type}}' "$lane_container")" = 'true|sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|none|none'
port_bindings=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$lane_container")
[[ "$port_bindings" = '{}' || "$port_bindings" = null ]]
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{.HostConfig.MemorySwap}}|{{.HostConfig.PidsLimit}}' "$lane_container")" = '1000000000|1073741824|1073741824|256'
test "$(docker inspect -f '{{.HostConfig.Privileged}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.AutoRemove}}' "$lane_container")" = 'false|no|false'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$secret_file|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test "$(stat -c '%U|%G|%a' "$secret_file")" = 'root|root|600'
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' "$lane_volume" \
  > "$recovery_dir/lane-volume.before-task6.tsv"
cmp -s "$recovery_dir/lane-volume.after-task5.tsv" "$recovery_dir/lane-volume.before-task6.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select name,setting from pg_settings where name in
   ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name;" \
  > "$recovery_dir/postgres-logging.before-task6.tsv"
cmp -s "$recovery_dir/postgres-logging.expected.tsv" "$recovery_dir/postgres-logging.before-task6.tsv"
(cd / && sha256sum -c "$recovery_dir/ROLE-SHA256SUMS" >/dev/null)
role_gate="$recovery_dir/verify-role-manifest"
bash "$role_gate" "$lane_container" "$recovery_dir" "$fresh_db" "$diagnostic_db" "$successor_db"
grep -Fx 'roles|PASS' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'attributes|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'memberships|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'forbidden_roles|zero' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'replay_owner|postgres-nonsuperuser' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
protected_source="$repo/supabase/migrations/20260813210000_password_reset_security.sql"
test "$(sha256sum "$protected_source" | awk '{print $1}')" = a87f815d5494eb733f525917053f1668875aa9d0c03b38c326387a9312a58212
test "$(grep -Ec 'lower[[:space:]]*\([[:space:]]*username[[:space:]]*\)[[:space:]]*=' "$protected_source")" -eq 2
! LC_ALL=C grep -q $'\x1e\|\x1f' "$protected_source"
source_gate="$recovery_dir/verify-source-gate"
test ! -e "$source_gate"
cat > "$source_gate" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
source_file=$1
repo=/opt/thoidai-work
manifest=/opt/thoidai-reconciliation/phase0-20260814T135943Z/source.sha256
protected_source="$repo/supabase/migrations/20260813210000_password_reset_security.sql"
case "$source_file" in "$repo"/supabase/migrations/*.sql) ;; *) exit 41 ;; esac
manifest_rel=${source_file#${repo}/}
test "$(awk -v file="$manifest_rel" '$2==file{n++} END{print n+0}' "$manifest")" -eq 1
expected_sha=$(awk -v file="$manifest_rel" '$2==file{print $1}' "$manifest")
[[ "$expected_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(sha256sum "$source_file" | awk '{print $1}')" = "$expected_sha"
! grep -Eqi '(^|;)[[:space:]]*(set[[:space:]]+role|set[[:space:]]+session[[:space:]]+authorization|\\connect)([[:space:];]|$)' "$source_file"
! grep -Eqi 'supabase_admin' "$source_file"
python3 - "$protected_source" "$source_file" <<'PY'
from pathlib import Path
import re
import sys
protected_path = Path(sys.argv[1]).resolve()
stream_path = Path(sys.argv[2]).resolve()
source = protected_path.read_text(encoding="utf-8", errors="strict")
stream = stream_path.read_text(encoding="utf-8", errors="strict")
matches = re.findall(r"lower\s*\(\s*username\s*\)\s*=\s*'([^']{1,128})'", source, flags=re.I)
if len(matches) != 2 or len(set(matches)) != 1:
    raise SystemExit(41)
candidate = matches[0]
if len(candidate) > 128 or len(candidate.encode("utf-8")) != len(candidate) or not re.fullmatch(r"[a-z0-9._@+-]+", candidate):
    raise SystemExit(41)
if source.count(candidate) != 3:
    raise SystemExit(41)
expected_stream_count = 3 if stream_path == protected_path else 0
if stream.count(candidate) != expected_stream_count:
    raise SystemExit(41)
PY
BASH
chmod 0600 "$source_gate"
sha256sum "$source_gate" > "$recovery_dir/verify-source-gate.sha256"
read -r -d '' client_script <<'PSQL' || true
\set ECHO none
\set QUIET on
\set VERBOSITY sqlstate
\o /dev/null
begin;
set local client_min_messages=error;
create temp table selector_source(ordinal bigint generated always as identity,line text not null) on commit drop;
\copy selector_source(line) from pstdin with (format csv, delimiter E'\x1f', quote E'\x1e', escape E'\x1e')
create temp table parsed_selector on commit drop as
with hits as (
  select m[1] selector from selector_source s
  cross join lateral regexp_matches(s.line,$rx$lower[[:space:]]*\([[:space:]]*username[[:space:]]*\)[[:space:]]*=[[:space:]]*'([^']{1,128})'$rx$,'g') m
)
select selector from hits;
do $guard$
declare occurrence_count integer; unique_count integer; broad_shape_count integer; candidate text;
begin
  select count(*),count(distinct selector),min(selector) into occurrence_count,unique_count,candidate from parsed_selector;
  select count(*) into broad_shape_count from selector_source where line ~ $rx$lower[[:space:]]*\([[:space:]]*username[[:space:]]*\)$rx$;
  if occurrence_count<>2 or unique_count<>1 or broad_shape_count<>2 then raise exception using errcode='P0001',message='rejected'; end if;
  if candidate is null or length(candidate)>128 or octet_length(candidate)<>length(candidate)
     or candidate ~ '[[:cntrl:]]' or candidate !~ '^[a-z0-9._@+-]+$' collate "C" then
    raise exception using errcode='P0001',message='rejected';
  end if;
  if (select count(*) from public.roles)<>0 or (select count(*) from public.role_permissions)<>0
     or (select count(*) from public.departments)<>0 or (select count(*) from public.staff_users)<>0
     or (select count(*) from supabase_migrations.schema_migrations)<>0 then
    raise exception using errcode='P0001',message='rejected';
  end if;
end
$guard$;
insert into public.roles(id,code,name,level) values
(gen_random_uuid(),'tong_bien_tap','Phase 0 synthetic TBT',4),
(gen_random_uuid(),'tbt_read_only','Phase 0 synthetic read only',0),
(gen_random_uuid(),'pho_tong_bien_tap','Phase 0 synthetic deputy',3),
(gen_random_uuid(),'phu_trach_phong_tri_su','Phase 0 synthetic manager A',3),
(gen_random_uuid(),'phu_trach_phong_phong_vien','Phase 0 synthetic manager B',3),
(gen_random_uuid(),'phu_trach_phong_bien_tap','Phase 0 synthetic manager C',3);
insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment)
select id,false,false,true,true,true from public.roles;
insert into public.departments(id,code,name,active)
values(gen_random_uuid(),'phase0_fixture_department','Phase 0 synthetic department',true);
select min(selector) as protected_selector from parsed_selector
\gset
insert into public.staff_users(id,full_name,username,role_id,department_id)
select gen_random_uuid(),'Phase 0 synthetic protected shell',$1,r.id,d.id
from public.roles r cross join public.departments d
where r.code='tbt_read_only' and d.code='phase0_fixture_department'
\bind :protected_selector
\g
select 1 / case when (select count(*) from public.staff_users where lower(username)=lower($1))=1 then 1 else 0 end
\bind :protected_selector
\g
\unset protected_selector
truncate parsed_selector,selector_source;
commit;
PSQL
(cd / && sha256sum -c "$recovery_dir/verify-source-gate.sha256" >/dev/null)
bash "$source_gate" "$protected_source"
set +e
docker exec -i "$lane_container" bash -c \
  'set +x; exec 3<<<"$1"; exec psql -X -U postgres -d "$2" -v ON_ERROR_STOP=1 -f /dev/fd/3 >/dev/null 2>/dev/null' \
  phase0-selector-client "$client_script" "$successor_db" < "$protected_source"
fixture_status=$?
set -e
unset client_script
printf 'status|%s\noccurrence_count|2\nunique_value_count|1\nsource_fd|0\nbinding|true\nselector_emitted|false\nraw_error_emitted|false\n' \
  "$fixture_status" > "$recovery_dir/selector-fixture.status.tsv"
test "$fixture_status" -eq 0
docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from public.roles),(select count(*) from public.role_permissions),
   (select count(*) from public.departments),(select count(*) from public.staff_users),
   (select count(*) from public.staff_users where email is not null or phone is not null or password is not null or job_title_id is not null),
   (select count(*) from public.tasks),(select count(*) from public.audit_logs),
   (select count(*) from supabase_migrations.schema_migrations);" > "$recovery_dir/successor-fixture.aggregate.tsv"
grep -Fx '6|6|1|1|0|0|0|0' "$recovery_dir/successor-fixture.aggregate.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$diagnostic_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from public.roles),(select count(*) from public.role_permissions),
   (select count(*) from public.departments),(select count(*) from public.staff_users),
   (select count(*) from supabase_migrations.schema_migrations);" > "$recovery_dir/diagnostic.aggregate.tsv"
grep -Fx '0|0|0|0|0' "$recovery_dir/diagnostic.aggregate.tsv"
chmod 0600 "$recovery_dir"/*
```

Expected: the sealed role manifest re-queries exact role attributes, memberships, forbidden-role absence, and non-superuser `postgres` ownership immediately before replay. Parser shape is `2/1`, successor aggregate is `6/6/1/1`, diagnostic remains empty, and no selector or raw error enters an argument value containing the selector, environment, file, terminal, evidence, hash input, or retained log.

- [ ] **Step 2: Require exact `P0001` and byte-identical rollback in the diagnostic clone**

The sanitizer runs inside bounded tmpfs. It accepts one exact SQLSTATE-form line and emits only `sqlstate|P0001`; it never stores or forwards raw stderr.

```bash
set -euo pipefail
set +x
umask 077
repo=/opt/thoidai-work
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
source_file="$repo/supabase/migrations/20260814130000_staff_list_order.sql"
source_gate="$recovery_dir/verify-source-gate"
fingerprint_sql="select (select count(*) from public.staff_users),(select count(*) from public.audit_logs),(select count(*) from public.staff_users where list_order>0),(select count(*) from pg_constraint where conrelid='public.staff_users'::regclass and conname='staff_users_list_order_nonnegative');"
docker exec "$lane_container" psql -X -U postgres -d "$diagnostic_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
  > "$recovery_dir/diagnostic-negative.before.tsv"
(cd / && sha256sum -c "$recovery_dir/verify-source-gate.sha256" >/dev/null)
bash "$source_gate" "$source_file"
set +e
docker exec -i "$lane_container" bash -ceu '
  set +x
  db=$1
  fifo=/run/phase0/diagnostic-error.fifo
  state=/run/phase0/diagnostic-state.tsv
  rm -f "$fifo" "$state"
  mkfifo -m 0600 "$fifo"
  awk '\''BEGIN{good=0;bad=0} /^ERROR:[[:space:]]+P0001[[:space:]]*$/{good++;next} {bad++} END{if(good==1&&bad==0){print "sqlstate|P0001";exit 0} exit 41}'\'' < "$fifo" > "$state" &
  sanitizer=$!
  set +e
  PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
  client=$?
  wait "$sanitizer"
  sanitized=$?
  set -e
  rm -f "$fifo"
  test "$client" -eq 3
  test "$sanitized" -eq 0
  grep -Fx "sqlstate|P0001" "$state" >/dev/null
  printf "client_status|%s\nsqlstate|P0001\n" "$client"
  rm -f "$state"
' phase0-diagnostic-negative "$diagnostic_db" < "$source_file" > "$recovery_dir/diagnostic-negative.status.tsv"
gate_status=$?
set -e
test "$gate_status" -eq 0
grep -Fx 'client_status|3' "$recovery_dir/diagnostic-negative.status.tsv"
grep -Fx 'sqlstate|P0001' "$recovery_dir/diagnostic-negative.status.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$diagnostic_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
  > "$recovery_dir/diagnostic-negative.after.tsv"
cmp -s "$recovery_dir/diagnostic-negative.before.tsv" "$recovery_dir/diagnostic-negative.after.tsv"
printf 'rollback|byte-identical\n' > "$recovery_dir/diagnostic-negative.rollback.tsv"
sha256sum "$recovery_dir/diagnostic-negative.status.tsv" "$recovery_dir/diagnostic-negative.rollback.tsv" \
  > "$recovery_dir/diagnostic-negative.safe.sha256"
chmod 0600 "$recovery_dir"/diagnostic-negative.*
```

Expected: psql status is exactly `3`, SQLSTATE is exactly `P0001`, and rollback fingerprint is byte-identical. Any other stderr line/state/status stops before successor replay.

- [ ] **Step 3: Replay the locked chain in the successor with sanitized channels**

For the fifteen expected-success files the sanitizer requires empty stderr and emits only generic status. For `20260814130000`, use the same exact-`P0001` gate as Step 2 and require its own byte-identical successor fingerprint.

```bash
set -euo pipefail
set +x
umask 077
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
source_gate="$recovery_dir/verify-source-gate"
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
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
test "${#chain[@]}" -eq 16
fingerprint_sql="select (select count(*) from public.staff_users),(select count(*) from public.audit_logs),(select count(*) from public.staff_users where list_order>0),(select count(*) from pg_constraint where conrelid='public.staff_users'::regclass and conname='staff_users_list_order_nonnegative');"
: > "$recovery_dir/successor-replay.status.tsv"
for migration in "${chain[@]}"; do
  version=${migration%%_*}
  source_file="$repo/supabase/migrations/$migration"
  if test "$version" = 20260814130000; then
    docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
      > "$recovery_dir/successor-negative.before.tsv"
    (cd / && sha256sum -c "$recovery_dir/verify-source-gate.sha256" >/dev/null)
    bash "$source_gate" "$source_file"
    set +e
    docker exec -i "$lane_container" bash -ceu '
      set +x
      db=$1
      fifo=/run/phase0/successor-error.fifo
      state=/run/phase0/successor-state.tsv
      rm -f "$fifo" "$state"
      mkfifo -m 0600 "$fifo"
      awk '\''BEGIN{good=0;bad=0} /^ERROR:[[:space:]]+P0001[[:space:]]*$/{good++;next} {bad++} END{if(good==1&&bad==0){print "sqlstate|P0001";exit 0} exit 41}'\'' < "$fifo" > "$state" &
      sanitizer=$!
      set +e
      PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
      client=$?
      wait "$sanitizer"
      sanitized=$?
      set -e
      rm -f "$fifo"
      test "$client" -eq 3
      test "$sanitized" -eq 0
      grep -Fx "sqlstate|P0001" "$state" >/dev/null
      printf "client_status|%s\nsqlstate|P0001\n" "$client"
      rm -f "$state"
    ' phase0-successor-negative "$successor_db" < "$source_file" > "$recovery_dir/successor-negative.status.tsv"
    negative_gate=$?
    set -e
    test "$negative_gate" -eq 0
    grep -Fx 'client_status|3' "$recovery_dir/successor-negative.status.tsv"
    grep -Fx 'sqlstate|P0001' "$recovery_dir/successor-negative.status.tsv"
    docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
      > "$recovery_dir/successor-negative.after.tsv"
    cmp -s "$recovery_dir/successor-negative.before.tsv" "$recovery_dir/successor-negative.after.tsv"
    printf '%s|3|P0001|rollback-byte-identical\n' "$version" >> "$recovery_dir/successor-replay.status.tsv"
  else
    (cd / && sha256sum -c "$recovery_dir/verify-source-gate.sha256" >/dev/null)
    bash "$source_gate" "$source_file"
    set +e
    docker exec -i "$lane_container" bash -ceu '
      set +x
      db=$1
      fifo=/run/phase0/success-error.fifo
      rm -f "$fifo"
      mkfifo -m 0600 "$fifo"
      awk '\''NF{bad=1} END{exit bad?41:0}'\'' < "$fifo" &
      sanitizer=$!
      set +e
      PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
      client=$?
      wait "$sanitizer"
      sanitized=$?
      set -e
      rm -f "$fifo"
      test "$client" -eq 0
      test "$sanitized" -eq 0
      printf "client_status|0\n"
    ' phase0-success "$successor_db" < "$source_file" > "$recovery_dir/success-$version.status.tsv"
    success_gate=$?
    set -e
    test "$success_gate" -eq 0
    grep -Fx 'client_status|0' "$recovery_dir/success-$version.status.tsv"
    printf '%s|0|none|committed\n' "$version" >> "$recovery_dir/successor-replay.status.tsv"
  fi
done
test "$(wc -l < "$recovery_dir/successor-replay.status.tsv")" -eq 16
test "$(awk -F '|' '$2==0{n++} END{print n+0}' "$recovery_dir/successor-replay.status.tsv")" -eq 15
test "$(awk -F '|' '$2!=0{print $1"|"$2"|"$3}' "$recovery_dir/successor-replay.status.tsv")" = '20260814130000|3|P0001'
sha256sum "$recovery_dir/successor-negative.status.tsv" "$recovery_dir/successor-replay.status.tsv" \
  > "$recovery_dir/successor-replay.safe.sha256"
chmod 0600 "$recovery_dir"/*
```

Expected: exactly fifteen success rows and one exact `20260814130000|3|P0001` rollback row. No raw replay output is emitted, persisted, or hashed.

- [ ] **Step 4: Verify terminal state, rerun the fifteen safe files, and seal Task 6**

```bash
set -euo pipefail
set +x
umask 077
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
source_gate="$recovery_dir/verify-source-gate"
safe_chain=(
  20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql
  20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql
  20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql
  20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql
  20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql
  20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql
  20260814113000_localize_role_names.sql 20260814160000_employee_password_reset_admin.sql
  20260814170000_employee_password_reset_hardening.sql
)
test "${#safe_chain[@]}" -eq 15
: > "$recovery_dir/successor-idempotency.status.tsv"
for migration in "${safe_chain[@]}"; do
  version=${migration%%_*}
  source_file="$repo/supabase/migrations/$migration"
  (cd / && sha256sum -c "$recovery_dir/verify-source-gate.sha256" >/dev/null)
  bash "$source_gate" "$source_file"
  set +e
  docker exec -i "$lane_container" bash -ceu '
    set +x
    db=$1
    fifo=/run/phase0/idempotency-error.fifo
    rm -f "$fifo"
    mkfifo -m 0600 "$fifo"
    awk '\''NF{bad=1} END{exit bad?41:0}'\'' < "$fifo" &
    sanitizer=$!
    set +e
    PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
    client=$?
    wait "$sanitizer"
    sanitized=$?
    set -e
    rm -f "$fifo"
    test "$client" -eq 0
    test "$sanitized" -eq 0
    printf "client_status|0\n"
  ' phase0-idempotency "$successor_db" < "$source_file" > "$recovery_dir/idempotency-$version.status.tsv"
  idempotency_gate=$?
  set -e
  test "$idempotency_gate" -eq 0
  printf '%s|0\n' "$version" >> "$recovery_dir/successor-idempotency.status.tsv"
done
test "$(wc -l < "$recovery_dir/successor-idempotency.status.tsv")" -eq 15
docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from public.staff_users),(select count(*) from public.staff_users where password_hash is not null),
   (select count(*) from public.password_reset_tokens),(select count(*) from public.password_reset_attempts),
   (select count(*) from public.tasks),(select count(*) from public.audit_logs),
   (select count(*) from supabase_migrations.schema_migrations);" > "$recovery_dir/successor-terminal.aggregate.tsv"
grep -Fx '1|1|0|0|0|0|0' "$recovery_dir/successor-terminal.aggregate.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select r.code,rp.can_manage_users,rp.can_manage_permissions,rp.can_create_task,rp.can_edit_all_tasks,rp.can_comment
   from public.roles r join public.role_permissions rp on rp.role_id=r.id
   where r.code in ('tong_bien_tap','tbt_read_only') order by r.code;" > "$recovery_dir/successor-terminal.tbt.tsv"
test "$(wc -l < "$recovery_dir/successor-terminal.tbt.tsv")" -eq 2
printf 'phase|task6\nstatus|complete\nnegative_sqlstate|P0001\nnegative_paths|2\nraw_error_evidence|false\nhistory_write|false\n' \
  > "$recovery_dir/TASK6.COMPLETE"
find "$recovery_dir" -maxdepth 1 -type f \
  \( -name '*negative*' -o -name '*replay*' -o -name '*idempotency*' -o -name '*terminal*' -o -name 'selector-fixture.status.tsv' -o -name 'verify-source-gate*' -o -name 'TASK6.COMPLETE' \) \
  -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$recovery_dir/TASK6-SHA256SUMS"
(cd / && sha256sum -c "$recovery_dir/TASK6-SHA256SUMS" >/dev/null)
chmod 0600 "$recovery_dir"/*
```

Expected: fifteen safe files are idempotent, terminal gates match, both negative paths are recorded only as status/SQLSTATE/rollback, and the running new lane remains retained.

## Task 7: Classify exactly four taxonomy classes and seal the mandatory STOP

**Files:**
- Verify: Task-5/6 manifests, production and lane-separated evidence
- Create outside Git: classification and STOP evidence
- No database, container, service, source, or history mutation

- [ ] **Step 1: Write the exact approved classification matrix**

```bash
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
(cd / && sha256sum -c "$recovery_dir/TASK5-SHA256SUMS" >/dev/null)
(cd / && sha256sum -c "$recovery_dir/TASK6-SHA256SUMS" >/dev/null)
cat > "$recovery_dir/classification.tsv" <<'EOF'
20260813172000|exact-applied|blocked-all-or-nothing
20260813210000|semantically-applied-but-source-differs|STOP
20260813220000|exact-applied|blocked-all-or-nothing
20260813230000|semantically-applied-but-source-differs|STOP
20260813233000|semantically-applied-but-source-differs|STOP
20260813234500|exact-applied|blocked-all-or-nothing
20260814070000|exact-applied|blocked-all-or-nothing
20260814102000|exact-applied|blocked-all-or-nothing
20260814130000|semantically-applied-but-source-differs|STOP
20260814160000|exact-applied|blocked-all-or-nothing
20260814170000|exact-applied|blocked-all-or-nothing
EOF
test "$(wc -l < "$recovery_dir/classification.tsv")" -eq 11
test "$(awk -F '|' '$2=="exact-applied"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 7
test "$(awk -F '|' '$2=="semantically-applied-but-source-differs"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 4
test "$(awk -F '|' '$2=="partially-applied"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 0
test "$(awk -F '|' '$2=="not-applied"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 0
for version in 20260813210000 20260813230000 20260813233000 20260814130000; do
  awk -F '|' -v version="$version" '$1==version && $2=="semantically-applied-but-source-differs" && $3=="STOP"{ok=1} END{exit !ok}' \
    "$recovery_dir/classification.tsv"
done
```

Expected: only the four approved class strings appear; seven rows are exact and four mandatory semantic-difference rows are STOP. `20260814130000` is not exact.

- [ ] **Step 2: Seal lane separation and all-or-nothing STOP**

```bash
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
grep -Fx 'sqlstate|P0001' "$recovery_dir/diagnostic-negative.status.tsv"
grep -Fx 'sqlstate|P0001' "$recovery_dir/successor-negative.status.tsv"
cmp -s "$recovery_dir/diagnostic-negative.before.tsv" "$recovery_dir/diagnostic-negative.after.tsv"
cmp -s "$recovery_dir/successor-negative.before.tsv" "$recovery_dir/successor-negative.after.tsv"
printf 'gate|STOP\nnon_exact_count|4\nproduction_replay|false\nhistory_write|false\ntask8|skipped_unreachable\n' \
  > "$recovery_dir/HISTORY-GATE.status"
grep -Fx 'gate|STOP' "$recovery_dir/HISTORY-GATE.status"
grep -Fx 'non_exact_count|4' "$recovery_dir/HISTORY-GATE.status"
sha256sum "$recovery_dir/classification.tsv" "$recovery_dir/HISTORY-GATE.status" \
  > "$recovery_dir/TASK7-SHA256SUMS"
(cd / && sha256sum -c "$recovery_dir/TASK7-SHA256SUMS" >/dev/null)
printf 'phase|task7\nstatus|complete\ngate|STOP\n' > "$recovery_dir/TASK7.COMPLETE"
chmod 0600 "$recovery_dir"/*
```

Expected: diagnostic and successor evidence stay separate. Synthetic replayability does not upgrade historical application, and the gate is irrevocably STOP for this run.

## Task 8: Record the unreachable history boundary with zero write SQL

**Files:**
- Verify: Task-7 STOP
- Create outside Git: one skip record
- No SQL implementation and no database session in this task

- [ ] **Step 1: Record the skip and stop**

```bash
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
(cd / && sha256sum -c "$recovery_dir/TASK7-SHA256SUMS" >/dev/null)
grep -Fx 'gate|STOP' "$recovery_dir/HISTORY-GATE.status"
printf 'phase|task8\nstatus|skipped_unreachable\nreason|four_non_exact_rows\nhistory_write|false\nproduction_replay|false\nwrite_sql_count|0\n' \
  > "$recovery_dir/TASK8.SKIPPED"
grep -Fx 'write_sql_count|0' "$recovery_dir/TASK8.SKIPPED"
chmod 0600 "$recovery_dir/TASK8.SKIPPED"
```

Expected: Task 8 creates only a root-only skip record and immediately stops. There is no history-write SQL in this task.

## Task 9: Verify production, application, quarantine, and new-lane preservation

**Files:**
- Verify read-only: Git, production, services, application build/process/topology, quarantine metadata, new-lane metadata and databases
- Create outside Git: safe post-run comparisons and final manifest
- No mutation or cleanup

- [ ] **Step 1: Reverify production, Git, services, provider/routing surfaces, and active build**

```bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
cd "$repo"
test "$(git rev-parse HEAD)" = "$(cat "$recovery_dir/head.before")"
test "$(git rev-parse HEAD^{tree})" = "$(cat "$recovery_dir/tree.before")"
test "$(git diff --cached --name-only | wc -l)" -eq 0
git status --porcelain=v1 --untracked-files=all > "$recovery_dir/root-status.after"
sha256sum "$recovery_dir/root-status.after" | awk '{print $1}' > "$recovery_dir/root-status.after.sha256"
cmp -s "$recovery_dir/root-status.before.sha256" "$recovery_dir/root-status.after.sha256"
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
nginx -t
systemctl show thoidai-work -p ActiveState -p SubState -p MainPID -p NRestarts -p ExecMainStartTimestampMonotonic --value \
  > "$recovery_dir/application-systemd.after.tsv"
cmp -s "$recovery_dir/application-systemd.before.tsv" "$recovery_dir/application-systemd.after.tsv"
systemctl cat thoidai-work | sha256sum | awk '{print $1}' > "$recovery_dir/application-unit.after.sha256"
cmp -s "$recovery_dir/application-unit.before.sha256" "$recovery_dir/application-unit.after.sha256"
main_pid=$(systemctl show thoidai-work -p MainPID --value)
readlink -f "/proc/$main_pid/exe" | sha256sum | awk '{print $1}' > "$recovery_dir/application-exe-path.after.sha256"
sha256sum "$(readlink -f "/proc/$main_pid/exe")" | awk '{print $1}' > "$recovery_dir/application-exe.after.sha256"
cmp -s "$recovery_dir/application-exe-path.before.sha256" "$recovery_dir/application-exe-path.after.sha256"
cmp -s "$recovery_dir/application-exe.before.sha256" "$recovery_dir/application-exe.after.sha256"
sha256sum "$repo/.next/BUILD_ID" | awk '{print $1}' > "$recovery_dir/build-id.after.sha256"
stat -c '%d|%i|%s|%Y|%F' "$repo/.next" > "$recovery_dir/next-stat.after.tsv"
cmp -s "$recovery_dir/build-id.before.sha256" "$recovery_dir/build-id.after.sha256"
cmp -s "$recovery_dir/next-stat.before.tsv" "$recovery_dir/next-stat.after.tsv"
ss -H -lntup | awk '{print $1"|"$5"|"$7}' | LC_ALL=C sort | sha256sum | awk '{print $1}' \
  > "$recovery_dir/socket-topology.after.sha256"
docker ps --format '{{.Names}}|{{.Image}}' | grep -v "^$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")|" \
  | LC_ALL=C sort | sha256sum | awk '{print $1}' > "$recovery_dir/docker-topology.after.sha256"
cmp -s "$recovery_dir/socket-topology.before.sha256" "$recovery_dir/socket-topology.after.sha256"
cmp -s "$recovery_dir/docker-topology.before.sha256" "$recovery_dir/docker-topology.after.sha256"
cp "$recovery_dir/routing-preservation.before.tsv" "$recovery_dir/routing-preservation.after.tsv"
cmp -s "$recovery_dir/routing-preservation.before.tsv" "$recovery_dir/routing-preservation.after.tsv"
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/login > "$recovery_dir/login-http.after.tsv"
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/api/auth/session > "$recovery_dir/session-http.after.tsv"
cmp -s "$recovery_dir/login-http.before.tsv" "$recovery_dir/login-http.after.tsv"
cmp -s "$recovery_dir/session-http.before.tsv" "$recovery_dir/session-http.after.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "begin read only;
select (select count(*) from supabase_migrations.schema_migrations),
       (select count(*) from supabase_migrations.schema_migrations where version in
       ('20260813172000','20260813210000','20260813220000','20260813230000','20260813233000','20260813234500','20260814070000','20260814102000','20260814130000','20260814160000','20260814170000'));
commit;" > "$recovery_dir/production-history.after.tsv"
grep -Fx '9|0' "$recovery_dir/production-history.after.tsv"
cmp -s "$recovery_dir/production-history.before.tsv" "$recovery_dir/production-history.after.tsv"
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-data.after.tsv"
begin read only;
select 'ADMIN_POLICY',count(*) filter(where r.code='admin'),
 count(*) filter(where r.code='admin' and rp.can_manage_users and rp.can_manage_permissions
   and rp.can_create_task and rp.can_edit_all_tasks and rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'TBT_POLICY',count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')),
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')
   and not rp.can_manage_users and not rp.can_manage_permissions
   and not rp.can_create_task and not rp.can_edit_all_tasks and not rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'JOB_TITLE',count(*),(select count(*) from public.staff_users where job_title_id is not null),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null)
from public.job_titles;
select 'LIST_ORDER',count(*) filter(where list_order<0),count(*) filter(where list_order>0),
 count(distinct list_order) filter(where list_order>0),
 coalesce(min(list_order) filter(where list_order>0),0),coalesce(max(list_order) filter(where list_order>0),0)
from public.staff_users;
commit;
SQL
cmp -s "$recovery_dir/production-data.before.tsv" "$recovery_dir/production-data.after.tsv"
test "$(sha256sum "$recovery_dir/production-data.after.tsv" | awk '{print $1}')" = 8a3630780d584b8d75c2ec87ec400d2f6262949e606c08c1465b97b769eaf807
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-functions.after.tsv"
begin read only;
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint',
 'ensure_staff_password_hash','consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write','create_bulk_task_plan',
 'report_task_progress','review_task_completion','prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);
commit;
SQL
cmp -s "$recovery_dir/production-functions.before.tsv" "$recovery_dir/production-functions.after.tsv"
test "$(sha256sum "$recovery_dir/production-functions.after.tsv" | awk '{print $1}')" = eeaf94c0015d930e3abf84f7309030ba5700fe6df8410430cf9bf6f6f0eddc52
chmod 0600 "$recovery_dir"/*
```

Expected: production history remains `9|0`; Git/index, service/restart identity, unit, process, executable, build, socket topology, original Docker topology, HTTP behavior, provider/model, CLIProxyAPI, and `9router` preservation gates are unchanged. No environment or provider secret is read or hashed.

- [ ] **Step 2: Reverify quarantine metadata and every new-lane control exactly**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
read -r old_run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r old_run_id quarantine_container quarantine_volume old_bootstrap old_bootstrap_db old_database < "$old_run_dir/names.tsv"
docker inspect -f 'container_id|{{.Id}}{{println}}state|{{.State.Status}}{{println}}image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}privileged|{{.HostConfig.Privileged}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}' \
  "$quarantine_container" > "$recovery_dir/quarantine-container.final.tsv"
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$quarantine_volume" > "$recovery_dir/quarantine-volume.final.tsv"
cmp -s "$recovery_dir/quarantine-container.before.tsv" "$recovery_dir/quarantine-container.final.tsv"
cmp -s "$recovery_dir/quarantine-volume.before.tsv" "$recovery_dir/quarantine-volume.final.tsv"
grep -Fx 'runtime_session|forbidden' "$recovery_dir/quarantine-policy.tsv"
grep -Fx 'log_read|forbidden' "$recovery_dir/quarantine-policy.tsv"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
test "$(docker inspect -f '{{.State.Running}}' "$lane_container")" = true
docker inspect -f 'image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}ports|{{len .NetworkSettings.Ports}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}cpu_nano|{{.HostConfig.NanoCpus}}{{println}}memory|{{.HostConfig.Memory}}{{println}}memory_swap|{{.HostConfig.MemorySwap}}{{println}}pids|{{.HostConfig.PidsLimit}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}{{println}}privileged|{{.HostConfig.Privileged}}' \
  "$lane_container" > "$recovery_dir/lane-policy.final.tsv"
cmp -s "$recovery_dir/lane-policy.expected.tsv" "$recovery_dir/lane-policy.final.tsv"
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$recovery_dir/postgres-password.secret|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
docker volume inspect "$lane_volume" >/dev/null
test "$(stat -c '%U|%a' "$recovery_dir/postgres-password.secret")" = 'root|600'
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c \
  "with requested(lane,datname) as (values ('diagnostic',:'diagnostic_db'),('successor',:'successor_db'),('template',:'fresh_db'))
   select requested.lane,count(d.*),coalesce(min(pg_get_userbyid(d.datdba)),'')
   from requested left join pg_database d using(datname) group by requested.lane order by requested.lane;" \
  > "$recovery_dir/lane-databases.final.tsv"
grep -Fx 'diagnostic|1|postgres' "$recovery_dir/lane-databases.final.tsv"
grep -Fx 'successor|1|postgres' "$recovery_dir/lane-databases.final.tsv"
grep -Fx 'template|1|postgres' "$recovery_dir/lane-databases.final.tsv"
chmod 0600 "$recovery_dir"/*
```

Expected: quarantine metadata is byte-identical without a runtime session or log read. The new lane is running and retained with exact image, logging, isolation, security, resource, mount, tmpfs, volume, secret-mode, and database-identity controls.

- [ ] **Step 3: Seal final evidence without secret or log inputs**

```bash
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.current
printf 'phase|task9\nstatus|complete\nproduction_history|9|0\nquarantine_log_read|false\nprovider_model_mutation|false\nCLIProxyAPI_mutation|false\n9router_mutation|false\nactive_build_mutation|false\nnew_lane|running_retained\nhistory_write|false\n' \
  > "$recovery_dir/TASK9.COMPLETE"
find "$recovery_dir" -maxdepth 1 -type f ! -name 'postgres-password.secret' ! -name 'FINAL-SHA256SUMS' \
  -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$recovery_dir/FINAL-SHA256SUMS"
(cd / && sha256sum -c "$recovery_dir/FINAL-SHA256SUMS" >/dev/null)
chmod 0600 "$recovery_dir/TASK9.COMPLETE" "$recovery_dir/FINAL-SHA256SUMS"
```

Expected: all safe evidence verifies. The new secret and every container log are excluded from hashing. Nothing is stopped, removed, truncated, or cleaned up.

## Task 10: Post-review, post-commit atomic execution-handoff publication

> **Ordering:** This documentation lifecycle task is completed after primary approval and the exact plan/design commit, but before any Task-5 runtime command. It publishes execution authority. At the current candidate-review boundary it remains unexecuted, and `HANDOFF.current` remains unchanged.

**Files:**
- Verify: exact committed canonical plan/design, empty index, clean canonical paths, exact primary approval, exact unrelated fingerprint
- Create outside Git: one root-only execution package containing the single reusable full gate
- Atomically update only `/opt/thoidai-reconciliation/HANDOFF.current` after that same gate passes immediately before publication
- No runtime, production, service, container, volume, database, source, or history mutation

- [ ] **Step 1: Require the exact v5 approval schema and committed candidate**

The approval is a root-owned regular mode-0600 file with exactly ten two-field records. Duplicate, conflicting, malformed, or extra records fail. The documentation commit is separately authorized; this task provides no staging or commit command.

```bash
set -euo pipefail
repo=/opt/thoidai-work
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
approval=/opt/thoidai-reconciliation/phase0-v5-primary-review.approved.tsv
test -f "$approval"; test ! -L "$approval"; test "$(stat -c '%U|%G|%a' "$approval")" = 'root|root|600'
awk -F '|' 'BEGIN{split("verdict scope critical_open important_open task5_execution_authorized authorized_predecessor review_package review_manifest_sha256 unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=10)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$approval"
test "$(awk -F '|' '$1=="verdict"{print $2}' "$approval")" = APPROVED
test "$(awk -F '|' '$1=="scope"{print $2}' "$approval")" = phase0-v5-plan-and-design
test "$(awk -F '|' '$1=="critical_open"{print $2}' "$approval")" = 0
test "$(awk -F '|' '$1=="important_open"{print $2}' "$approval")" = 0
test "$(awk -F '|' '$1=="task5_execution_authorized"{print $2}' "$approval")" = true
authorized_predecessor=$(awk -F '|' '$1=="authorized_predecessor"{print $2}' "$approval")
review_package=$(awk -F '|' '$1=="review_package"{print $2}' "$approval")
review_manifest_sha=$(awk -F '|' '$1=="review_manifest_sha256"{print $2}' "$approval")
approved_unrelated_count=$(awk -F '|' '$1=="unrelated_status_count"{print $2}' "$approval")
approved_unrelated_sha=$(awk -F '|' '$1=="unrelated_status_sha256"{print $2}' "$approval")
test "$authorized_predecessor" = f707279ad9028d452d871fddb39d4f0f767ca155; test "$approved_unrelated_count" = 358; test "$approved_unrelated_sha" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
review_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
test -d "$review_root" && test ! -L "$review_root" && test "$(stat -c '%U|%G|%a' "$review_root")" = 'root|root|700' && test "$(realpath -e -- "$review_root")" = "$review_root" || exit 41
review_basename=$(basename -- "$review_package")
[[ "$review_basename" =~ ^review-runbook-v[1-9][0-9]*-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]] || exit 41
test "$(dirname -- "$review_package")" = "$review_root" && test "$review_package" = "$review_root/$review_basename" || exit 41
test -d "$review_package" && test ! -L "$review_package" && test "$(realpath -e -- "$review_package")" = "$review_package" && test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700' || exit 41
test -d "$review_package"; test ! -L "$review_package"; test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700'
printf 'REVIEW-NOTES.md\nSHA256SUMS\nVALIDATION.tsv\ndesign.candidate.md\nrunbook.candidate.md\n' | cmp -s - <(find "$review_package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for payload in runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv SHA256SUMS; do test -f "$review_package/$payload"; test ! -L "$review_package/$payload"; test "$(stat -c '%U|%G|%a' "$review_package/$payload")" = 'root|root|600'; done
test "$(sha256sum "$review_package/SHA256SUMS" | awk '{print $1}')" = "$review_manifest_sha"; test "$(awk 'END{print NR+0}' "$review_package/SHA256SUMS")" -eq 4
printf 'runbook.candidate.md\ndesign.candidate.md\nREVIEW-NOTES.md\nVALIDATION.tsv\n' | cmp -s - <(awk '{print $2}' "$review_package/SHA256SUMS")
(cd "$review_package" && sha256sum -c SHA256SUMS >/dev/null)
cd "$repo"; test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2; test "$(git rev-parse HEAD^)" = "$authorized_predecessor"
printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)
test "$(git diff-tree --no-commit-id --name-only -r HEAD | wc -l)" -eq 2; git diff --cached --quiet; git diff --quiet -- "$plan_rel" "$design_rel"
git show "HEAD:$plan_rel" | cmp -s - "$repo/$plan_rel"; git show "HEAD:$design_rel" | cmp -s - "$repo/$design_rel"; git show "HEAD:$plan_rel" | cmp -s - "$review_package/runbook.candidate.md"; git show "HEAD:$design_rel" | cmp -s - "$review_package/design.candidate.md"
read -r unrelated_count unrelated_sha < <(git status --short --untracked-files=all -- . ':(exclude)docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md' ':(exclude)docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md' | python3 -c 'import hashlib,sys;data=sys.stdin.buffer.read();print(data.count(b"\n"),hashlib.sha256(data).hexdigest())')
test "$unrelated_count" = "$approved_unrelated_count"; test "$unrelated_sha" = "$approved_unrelated_sha"
```

Expected: approval mode and exact schema pass with one APPROVED verdict, v5 scope, zero open Critical/Important findings, true Task-5 authorization, the exact reviewed package/manifest, authorized predecessor, and unrelated fingerprint. HEAD/canonical/index/reviewed bytes form one exact clean two-document commit.

- [ ] **Step 2: Snapshot approval, bind immutable constants, build the package, and seal the reusable full gate**

The external approval is copied once into the new root-only package. Every constant is then rebound from that exact snapshot, cross-recorded in `COMMIT.tsv`, and sealed by the five-payload manifest. Later validation never trusts a newly replaced external approval.

```bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
approval=/opt/thoidai-reconciliation/phase0-v5-primary-review.approved.tsv
stamp=$(date -u +%Y%m%dT%H%M%SZ); nonce=$(openssl rand -hex 6); handoff_package="/opt/thoidai-reconciliation/phase0-execution-handoff-$stamp-$nonce"; install -d -m 0700 "$handoff_package"
cp -- "$approval" "$handoff_package/REVIEW.tsv"; chmod 0600 "$handoff_package/REVIEW.tsv"; test ! -L "$handoff_package/REVIEW.tsv"; test "$(stat -c '%U|%G|%a' "$handoff_package/REVIEW.tsv")" = 'root|root|600'
awk -F '|' 'BEGIN{split("verdict scope critical_open important_open task5_execution_authorized authorized_predecessor review_package review_manifest_sha256 unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=10)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$handoff_package/REVIEW.tsv"
readonly authorized_predecessor=$(awk -F '|' '$1=="authorized_predecessor"{print $2}' "$handoff_package/REVIEW.tsv"); readonly review_package=$(awk -F '|' '$1=="review_package"{print $2}' "$handoff_package/REVIEW.tsv"); readonly review_manifest_sha=$(awk -F '|' '$1=="review_manifest_sha256"{print $2}' "$handoff_package/REVIEW.tsv"); readonly approved_unrelated_count=$(awk -F '|' '$1=="unrelated_status_count"{print $2}' "$handoff_package/REVIEW.tsv"); readonly approved_unrelated_sha=$(awk -F '|' '$1=="unrelated_status_sha256"{print $2}' "$handoff_package/REVIEW.tsv"); readonly approval_sha=$(sha256sum "$handoff_package/REVIEW.tsv" | awk '{print $1}')
test "$(awk -F '|' '$1=="verdict"{print $2}' "$handoff_package/REVIEW.tsv")" = APPROVED; test "$(awk -F '|' '$1=="scope"{print $2}' "$handoff_package/REVIEW.tsv")" = phase0-v5-plan-and-design; test "$(awk -F '|' '$1=="critical_open"{print $2}' "$handoff_package/REVIEW.tsv")" = 0; test "$(awk -F '|' '$1=="important_open"{print $2}' "$handoff_package/REVIEW.tsv")" = 0; test "$(awk -F '|' '$1=="task5_execution_authorized"{print $2}' "$handoff_package/REVIEW.tsv")" = true
test "$authorized_predecessor" = f707279ad9028d452d871fddb39d4f0f767ca155; test "$approved_unrelated_count" = 358; test "$approved_unrelated_sha" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
cd "$repo"; git diff --cached --quiet; git diff --quiet -- "$plan_rel" "$design_rel"; test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2; test "$(git rev-parse HEAD^)" = "$authorized_predecessor"; printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)
git show "HEAD:$plan_rel" > "$handoff_package/plan.md"; git show "HEAD:$design_rel" > "$handoff_package/design.md"
cat > "$handoff_package/VERIFY.sh" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
pointer=$1; repo=/opt/thoidai-work; plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md; design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
test -f "$pointer"; test ! -L "$pointer"; test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'; test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
IFS= read -r package < "$pointer"; case "$package" in /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;; *) exit 41 ;; esac
test -d "$package"; test ! -L "$package"; test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$package/$payload"; test ! -L "$package/$payload"; test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'; done
test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5; awk 'NF!=2||$1!~/^[0-9a-f]{64}$/{exit 41}' "$package/SHA256SUMS"; printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS"); (cd "$package" && sha256sum -c SHA256SUMS >/dev/null)
awk -F '|' 'BEGIN{split("verdict scope critical_open important_open task5_execution_authorized authorized_predecessor review_package review_manifest_sha256 unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=10)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/REVIEW.tsv"
awk -F '|' 'BEGIN{split("head tree parent parent_count plan_blob design_blob review_package review_manifest_sha256 approval_sha256 authorized_predecessor unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=12)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/COMMIT.tsv"
rv(){ awk -F '|' -v key="$1" '$1==key{print $2}' "$package/REVIEW.tsv"; }; cv(){ awk -F '|' -v key="$1" '$1==key{print $2}' "$package/COMMIT.tsv"; }
test "$(rv verdict)" = APPROVED; test "$(rv scope)" = phase0-v5-plan-and-design; test "$(rv critical_open)" = 0; test "$(rv important_open)" = 0; test "$(rv task5_execution_authorized)" = true
authorized_predecessor=$(rv authorized_predecessor); review_package=$(rv review_package); review_manifest_sha=$(rv review_manifest_sha256); approved_unrelated_count=$(rv unrelated_status_count); approved_unrelated_sha=$(rv unrelated_status_sha256)
test "$authorized_predecessor" = f707279ad9028d452d871fddb39d4f0f767ca155; test "$approved_unrelated_count" = 358; test "$approved_unrelated_sha" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a; [[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
review_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
test -d "$review_root" && test ! -L "$review_root" && test "$(stat -c '%U|%G|%a' "$review_root")" = 'root|root|700' && test "$(realpath -e -- "$review_root")" = "$review_root" || exit 41
review_basename=$(basename -- "$review_package")
[[ "$review_basename" =~ ^review-runbook-v[1-9][0-9]*-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]] || exit 41
test "$(dirname -- "$review_package")" = "$review_root" && test "$review_package" = "$review_root/$review_basename" || exit 41
test -d "$review_package" && test ! -L "$review_package" && test "$(realpath -e -- "$review_package")" = "$review_package" && test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700' || exit 41
test -d "$review_package"; test ! -L "$review_package"; test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700'; printf 'REVIEW-NOTES.md\nSHA256SUMS\nVALIDATION.tsv\ndesign.candidate.md\nrunbook.candidate.md\n' | cmp -s - <(find "$review_package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for payload in runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv SHA256SUMS; do test -f "$review_package/$payload"; test ! -L "$review_package/$payload"; test "$(stat -c '%U|%G|%a' "$review_package/$payload")" = 'root|root|600'; done
test "$(sha256sum "$review_package/SHA256SUMS" | awk '{print $1}')" = "$review_manifest_sha"; test "$(awk 'END{print NR+0}' "$review_package/SHA256SUMS")" -eq 4; awk 'NF!=2||$1!~/^[0-9a-f]{64}$/{exit 41}' "$review_package/SHA256SUMS"; printf 'runbook.candidate.md\ndesign.candidate.md\nREVIEW-NOTES.md\nVALIDATION.tsv\n' | cmp -s - <(awk '{print $2}' "$review_package/SHA256SUMS"); (cd "$review_package" && sha256sum -c SHA256SUMS >/dev/null)
package_head=$(cv head); package_tree=$(cv tree); package_parent=$(cv parent); package_parent_count=$(cv parent_count); package_plan_blob=$(cv plan_blob); package_design_blob=$(cv design_blob); package_review=$(cv review_package); package_review_sha=$(cv review_manifest_sha256); package_approval_sha=$(cv approval_sha256); package_predecessor=$(cv authorized_predecessor); package_unrelated_count=$(cv unrelated_status_count); package_unrelated_sha=$(cv unrelated_status_sha256)
test "$package_parent_count" = 1; test "$package_review" = "$review_package"; test "$package_review_sha" = "$review_manifest_sha"; test "$package_predecessor" = "$authorized_predecessor"; test "$package_unrelated_count" = "$approved_unrelated_count"; test "$package_unrelated_sha" = "$approved_unrelated_sha"; test "$package_approval_sha" = "$(sha256sum "$package/REVIEW.tsv" | awk '{print $1}')"
cd "$repo"; git diff --cached --quiet; git diff --quiet -- "$plan_rel" "$design_rel"; test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2; test "$package_head" = "$(git rev-parse HEAD)"; test "$package_tree" = "$(git rev-parse HEAD^{tree})"; test "$package_parent" = "$(git rev-parse HEAD^)"; test "$package_parent" = "$authorized_predecessor"; test "$package_plan_blob" = "$(git rev-parse "HEAD:$plan_rel")"; test "$package_design_blob" = "$(git rev-parse "HEAD:$design_rel")"
printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort); test "$(git diff-tree --no-commit-id --name-only -r HEAD | wc -l)" -eq 2
cmp -s "$package/plan.md" "$repo/$plan_rel"; cmp -s "$package/design.md" "$repo/$design_rel"; git show "HEAD:$plan_rel" | cmp -s - "$package/plan.md"; git show "HEAD:$design_rel" | cmp -s - "$package/design.md"; git show "HEAD:$plan_rel" | cmp -s - "$review_package/runbook.candidate.md"; git show "HEAD:$design_rel" | cmp -s - "$review_package/design.candidate.md"
read -r current_unrelated_count current_unrelated_sha < <(git status --short --untracked-files=all -- . ':(exclude)docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md' ':(exclude)docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md' | python3 -c 'import hashlib,sys;data=sys.stdin.buffer.read();print(data.count(b"\n"),hashlib.sha256(data).hexdigest())'); test "$current_unrelated_count" = "$approved_unrelated_count"; test "$current_unrelated_sha" = "$approved_unrelated_sha"
BASH
chmod 0600 "$handoff_package/VERIFY.sh"
printf 'head|%s\ntree|%s\nparent|%s\nparent_count|1\nplan_blob|%s\ndesign_blob|%s\nreview_package|%s\nreview_manifest_sha256|%s\napproval_sha256|%s\nauthorized_predecessor|%s\nunrelated_status_count|%s\nunrelated_status_sha256|%s\n' "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$(git rev-parse HEAD^)" "$(git rev-parse "HEAD:$plan_rel")" "$(git rev-parse "HEAD:$design_rel")" "$review_package" "$review_manifest_sha" "$approval_sha" "$authorized_predecessor" "$approved_unrelated_count" "$approved_unrelated_sha" > "$handoff_package/COMMIT.tsv"
chmod 0600 "$handoff_package/plan.md" "$handoff_package/design.md" "$handoff_package/COMMIT.tsv"; (cd "$handoff_package" && sha256sum plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh > SHA256SUMS); chmod 0600 "$handoff_package/SHA256SUMS"
for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$handoff_package/$payload"; test ! -L "$handoff_package/$payload"; test "$(stat -c '%U|%G|%a' "$handoff_package/$payload")" = 'root|root|600'; done; (cd "$handoff_package" && sha256sum -c SHA256SUMS >/dev/null)
pending_tmp=$(mktemp /opt/thoidai-reconciliation/.phase0-execution-handoff.pending.XXXXXX); printf '%s\n' "$handoff_package" > "$pending_tmp"; chown root:root "$pending_tmp"; chmod 0600 "$pending_tmp"; mv -T "$pending_tmp" /opt/thoidai-reconciliation/phase0-execution-handoff.pending
bash "$handoff_package/VERIFY.sh" /opt/thoidai-reconciliation/phase0-execution-handoff.pending
```

Expected: the package contains committed bytes, the exact approval snapshot, the complete bound COMMIT schema, and the single full validator. Five payloads are manifest-sealed; `SHA256SUMS` excludes itself. The full gate passes against the pending pointer before the package can become publication input.

- [ ] **Step 3: Invoke the same full gate immediately before atomic publication**

No value is rebound from the external approval. The package path is read from the root-only pending pointer, the sealed helper performs the complete validation again, and that same validated path is the only value published.

```bash
set -euo pipefail
umask 077
pending_pointer=/opt/thoidai-reconciliation/phase0-execution-handoff.pending
invoke_full_immutable_gate() {
  local pointer=$1 package payload
  test -f "$pointer"; test ! -L "$pointer"; test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'; test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
  IFS= read -r package < "$pointer"; case "$package" in /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;; *) return 41 ;; esac
  test -d "$package"; test ! -L "$package"; test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
  printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
  for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$package/$payload"; test ! -L "$package/$payload"; test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'; done
  test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5; awk 'NF!=2||$1!~/^[0-9a-f]{64}$/{exit 41}' "$package/SHA256SUMS"; printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS")
  (cd "$package" && sha256sum -c SHA256SUMS >/dev/null); bash "$package/VERIFY.sh" "$pointer"; printf '%s\n' "$package"
}
handoff_package=$(invoke_full_immutable_gate "$pending_pointer"); test -n "$handoff_package"; test "$(cat "$pending_pointer")" = "$handoff_package"
pointer_tmp=$(mktemp /opt/thoidai-reconciliation/.HANDOFF.current.XXXXXX); printf '%s\n' "$handoff_package" > "$pointer_tmp"; chown root:root "$pointer_tmp"; chmod 0600 "$pointer_tmp"; test "$(stat -c '%U|%G|%a' "$pointer_tmp")" = 'root|root|600'
mv -T "$pointer_tmp" /opt/thoidai-reconciliation/HANDOFF.current; test ! -L /opt/thoidai-reconciliation/HANDOFF.current; test "$(cat /opt/thoidai-reconciliation/HANDOFF.current)" = "$handoff_package"; bash "$handoff_package/VERIFY.sh" /opt/thoidai-reconciliation/HANDOFF.current
```

Expected: the exact same full package/approval/commit/canonical/unrelated gate runs after packaging and immediately before publication. The validated immutable package path-not any re-read external approval value-is atomically published and then verifies once more through the final pointer.

### Current v5 review stop

For the present documentation turn: do not execute any Task-5 through Task-10 checkbox, do not stage or commit, do not create the primary approval or execution package, and do not update `HANDOFF.current`. Only static/live read-only validation and a separate root-only candidate review package are allowed.
