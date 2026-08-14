# THỜI ĐẠI WORK Phase 0: Migration-History Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the exact application status of eleven THỜI ĐẠI WORK migration versions and reconcile them with `supabase_migrations.schema_migrations` only if every version becomes `exact-applied` under the all-or-nothing gate, without blindly replaying SQL, weakening password-reset/session protections, changing application routing, or exposing production identities or secrets.

**Architecture:** Preserve the sealed production/source evidence, then restore the exact schema archive into one uniquely named PostgreSQL 17 container that uses the pinned local image, Docker `none` networking, zero published ports, a retained named volume, and a root-only password-file secret. Bootstrap archive roles with a unique isolated superuser, restore ownership and privileges exactly, and replay the locked chain only as the isolated non-superuser `postgres`; production remains read-only except for the unreachable all-exact history transaction. Classify every target as `exact-applied`, `semantically-applied-but-source-differs`, `partially-applied`, or `not-applied`, with no production migration replay or rehearsal path.

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

Completed Tasks 1–3 are sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; their production dump, schema dump, manifests, and failed shared-cluster evidence are inputs and are never regenerated, weakened, or deleted. Task 4 creates one unique mode-0700 child run directory, one retained named volume, one retained network-isolated container, one root-only password file, one unique bootstrap role/database, and one unique replay database. No repository source file is created or modified by execution, and no image pull is permitted.

## Approved design coverage

| Design section | Implementation location |
|---|---|
| 1. Purpose | Scope boundary; Tasks 6–8 all-exact gate |
| 2. Observed baseline | Audited starting evidence; Task 4 Steps 1–6 and `image-metadata.tsv` |
| 3. Goals | Tasks 4–7 evidence lifecycle; Task 9 preservation |
| 4. Non-goals | Scope boundary; Task 7 production-execution prohibition |
| 5. Rejected alternatives | Task 4 Step 2 retained RED evidence |
| 6. Architecture | Task 4 isolated lifecycle, `volume-metadata.tsv`, `container-security.tsv`, and runtime assertions |
| 7. Secret handling | Task 4 Steps 7–9 |
| 8. Cluster and role bootstrap | Task 4 Steps 10–11 |
| 9. Extension compatibility | Task 4 Steps 6, 9, and 11 |
| 10. Schema restore and fidelity | Task 4 Steps 12–14 |
| 11. Synthetic state | Task 5 Step 1 |
| 12. Locked chronological replay | Task 5 Steps 2–5 |
| 13. Evidence flow | Tasks 4–7; Task 9 final index |
| 14. Error handling | Every hard-stop assertion; Task 7 retention |
| 15. Threat model | Task 4 persisted image/volume/container metadata plus runtime, mount, secret, and resource gates |
| 16. Rollback and cleanup | Task 7 Step 6; Task 8 Step 5 |
| 17. Testing strategy | Task 4 RED/GREEN; Task 5 replay/idempotency |
| 18. Exact success criteria | Task 6 Step 1; Task 9 preservation matrix |
| 19. Execution boundary | Task 10 inline `/root/aylaspa_thoidai` handoff |

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

- [ ] **Step 1: Verify the approved design commit and every sealed prerequisite**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
design=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
cd "$repo"
git merge-base --is-ancestor 9fab6a11600004d6b70da1f0530e0c215eafb1fc HEAD
test "$(git show 9fab6a11600004d6b70da1f0530e0c215eafb1fc:"$design" | sha256sum | awk '{print $1}')" = bbad7e6e0188ec2d802cb1111af3b2e3bce8646739d163d62a989ee392bb37cf
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

Expected: every command exits `0`; the design SHA is exact, all sixteen sources verify, both PostgreSQL-17 archives list successfully, and the 44 sealed top-level files remain root-only. Do not print archive contents.

- [ ] **Step 2: Preserve the measured RED architecture evidence without repeating it**

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

- [ ] **Step 3: Allocate one validated unique run identity without touching Docker**

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

- [ ] **Step 4: Capture fresh Git, resource, service, HTTP, and production baselines before container creation**

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
awk -v load="$load_one" 'BEGIN{exit !(load<4.0)}'
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

- [ ] **Step 5: Capture and seal fresh read-only production fingerprints before container creation**

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

- [ ] **Step 6: Prove the pinned image is local and scan exact source/extension dependencies without pulling**

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

- [ ] **Step 7: Generate the isolated-only bootstrap secret directly into its root-only file**

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

- [ ] **Step 8: Create the retained volume and container with the exact isolation/resource envelope**

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

- [ ] **Step 9: Assert stopped-container security and required extension controls before initialization**

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
  "$container_name" > "$run_dir/mounts.assertion.tsv"
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

- [ ] **Step 10: Start the retained container and verify the official-image initialization**

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
  docker logs "$container_name" 2>&1 | sha256sum | awk '{print $1}' > "$run_dir/init-log.output.sha256"
  chmod 0600 "$run_dir/init-log.output.sha256"
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

- [ ] **Step 11: Bootstrap only the archive roles and guard the built-in role**

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

- [ ] **Step 12: Create the exact replay database/extensions and remove only its empty template public schema**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -v ON_ERROR_STOP=1 \
  -v replay_db="$replay_db" -c \
  "create database :\"replay_db\" with owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale 'en-US' locale 'en_US.UTF-8';"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "create schema extensions authorization postgres;"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "create extension pgcrypto with schema extensions;"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select current_database(),count(*)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
group by current_database();" > "$run_dir/template-public.guard.tsv"
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

- [ ] **Step 13: Stream the full archive as bootstrap superuser with ownership and privileges enabled**

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

- [ ] **Step 14: Prove every GREEN restore-fidelity gate before fixtures**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
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

Expected GREEN: exact `21/53/96/5/39/14`, default ACL `6 (3+3)`, schema/table/function ACL `7/653/46`, effective privileges `571/588`, `40/56`, `5/8`, byte-identical five-line owner distribution, public owner `pg_database_owner`, and zero staff/history rows. Any mismatch stops before fixtures.

- [ ] **Step 15: Seal Task 4 evidence while retaining the running isolated container and volume**

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

Expected: all non-secret Task-4 evidence verifies, every evidence file is `0600`, and the secret/container/volume are retained. The secret itself is deliberately excluded from checksum manifests.

## Task 5: Seed synthetic metadata and replay the exact chain only as isolated `postgres`

**Files:**
- Verify only: `/opt/thoidai-work/supabase/migrations/*.sql` listed in the sealed sixteen-source manifest
- Create outside Git: replay, rollback, terminal-state, function-hash, and idempotency evidence in the isolated run directory
- Stream sources directly from the repository; create no migration copy in `/tmp`, the container, or the volume
- No production database write

- [ ] **Step 1: Seed exactly six synthetic role/permission fixture pairs and nothing else**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec -i "$container_name" psql -X -U postgres -d "$replay_db" \
  --single-transaction -v ON_ERROR_STOP=1 <<'SQL'
insert into public.roles(id,code,name,level) values
('71000000-0000-4000-8000-000000000001','tong_bien_tap','Synthetic TBT',4),
('71000000-0000-4000-8000-000000000002','tbt_read_only','Synthetic Read Only',0),
('71000000-0000-4000-8000-000000000003','pho_tong_bien_tap','Synthetic Deputy',3),
('71000000-0000-4000-8000-000000000004','phu_trach_phong_tri_su','Synthetic Manager A',3),
('71000000-0000-4000-8000-000000000005','phu_trach_phong_phong_vien','Synthetic Manager B',3),
('71000000-0000-4000-8000-000000000006','phu_trach_phong_bien_tap','Synthetic Manager C',3);

insert into public.role_permissions(
 role_id,can_manage_users,can_manage_permissions,
 can_create_task,can_edit_all_tasks,can_comment
)
select id,false,false,true,true,true from public.roles
where code in (
 'tong_bien_tap','tbt_read_only','pho_tong_bien_tap',
 'phu_trach_phong_tri_su','phu_trach_phong_phong_vien',
 'phu_trach_phong_bien_tap'
);
SQL
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.roles),
 (select count(*) from public.role_permissions),
 (select count(*) from public.staff_users),
 (select count(*) from public.tasks),
 (select count(*) from public.audit_logs),
 (select count(*) from supabase_migrations.schema_migrations);" \
  > "$run_dir/synthetic-fixtures.tsv"
grep -Fx '6|6|0|0|0|0' "$run_dir/synthetic-fixtures.tsv"
chmod 0600 "$run_dir/synthetic-fixtures.tsv"
```

Expected: exactly six synthetic role rows and six matching permission rows exist; staff, task, audit, and migration-history counts remain zero. No staff identifier, identity, email, password, token, or production row is created.

- [ ] **Step 2: Re-assert isolation, source integrity, source risk scan, and replay identity**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
test "$(wc -l < "$evidence_root/source.sha256")" -eq 16
grep -Fx 'set_role|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'session_authorization|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'supabase_admin|0' "$run_dir/source-dependency-scan.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
test "$(docker inspect -f '{{.HostConfig.Privileged}}' "$container_name")" = false
test "$(docker inspect -f '{{len .Mounts}}' "$container_name")" -eq 2
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$container_name")" -eq 1000000000
test "$(docker inspect -f '{{.HostConfig.Memory}}' "$container_name")" -eq 1073741824
test "$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$container_name")" -eq 256
docker exec "$container_name" pg_isready -q -U postgres -d "$replay_db"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c \
  "select current_user,session_user,usesuper from pg_user where usename=current_user;" \
  > "$run_dir/replay-session.tsv"
grep -Fx 'postgres|postgres|f' "$run_dir/replay-session.tsv"
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
docker exec supabase_db_thoidai-work pg_isready -q -U postgres -d postgres
test "$(docker ps --filter health=unhealthy -q | wc -l)" -eq 0
chmod 0600 "$run_dir/replay-session.tsv"
```

Expected: all source hashes remain exact; no source can change role/session authorization or name `supabase_admin`; the only replay role is isolated non-superuser `postgres`; container isolation/resources are unchanged; and production remains healthy and read-only.

- [ ] **Step 3: Stream the sixteen files chronologically, each in one transaction, and hash output/status**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
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
install -m 0600 /dev/null "$run_dir/replay-status.tsv"
for migration in "${chain[@]}"; do
  version=${migration%%_*}
  source_file="supabase/migrations/$migration"
  grep -Fq "  $source_file" "$evidence_root/source.sha256"
  if test "$version" = 20260814130000; then
    docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.staff_users),
 (select count(*) from public.audit_logs),
 (select count(*) from public.staff_users where list_order>0),
 (select count(*) from pg_constraint where conrelid='public.staff_users'::regclass and conname='staff_users_list_order_nonnegative');" \
      > "$run_dir/list-order.before.tsv"
    chmod 0600 "$run_dir/list-order.before.tsv"
  fi
  hash_file="$run_dir/replay-$version.output.sha256"
  install -m 0600 /dev/null "$hash_file"
  set +e
  docker exec -i "$container_name" psql -X -U postgres -d "$replay_db" \
    --single-transaction -v ON_ERROR_STOP=1 -f - \
    < "$source_file" 2>&1 | sha256sum | awk '{print $1}' > "$hash_file"
  replay_pipeline=("${PIPESTATUS[@]}")
  replay_status=${replay_pipeline[0]}
  set -e
  test "${replay_pipeline[1]}" -eq 0
  test "${replay_pipeline[2]}" -eq 0
  read -r output_hash < "$hash_file"
  [[ "$output_hash" =~ ^[0-9a-f]{64}$ ]]
  printf '%s|%s|%s\n' "$version" "$replay_status" "$output_hash" >> "$run_dir/replay-status.tsv"
  if test "$version" = 20260814130000; then
    test "$replay_status" -ne 0
    docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.staff_users),
 (select count(*) from public.audit_logs),
 (select count(*) from public.staff_users where list_order>0),
 (select count(*) from pg_constraint where conrelid='public.staff_users'::regclass and conname='staff_users_list_order_nonnegative');" \
      > "$run_dir/list-order.after.tsv"
    chmod 0600 "$run_dir/list-order.after.tsv"
    cmp -s "$run_dir/list-order.before.tsv" "$run_dir/list-order.after.tsv"
    grep -Fx '0|0|0|1' "$run_dir/list-order.after.tsv"
  else
    test "$replay_status" -eq 0
  fi
done
test "$(wc -l < "$run_dir/replay-status.tsv")" -eq 16
test "$(awk -F '|' '$2!=0{print $1}' "$run_dir/replay-status.tsv")" = 20260814130000
chmod 0600 "$run_dir"/*
```

Expected: fifteen migrations exit `0`; only `20260814130000` returns nonzero and its single transaction is byte-proven to leave the targeted aggregate/constraint fingerprint unchanged. Every raw stdout/error stream is reduced to one SHA-256, and no source body is copied or printed.

- [ ] **Step 4: Prove the terminal TBT state and thirteen function fingerprints**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select r.code,rp.can_manage_users,rp.can_manage_permissions,
       rp.can_create_task,rp.can_edit_all_tasks,rp.can_comment
from public.roles r join public.role_permissions rp on rp.role_id=r.id
where r.code in ('tong_bien_tap','tbt_read_only') order by r.code;" \
  > "$run_dir/terminal-tbt.tsv"
cat > "$run_dir/terminal-tbt.expected.tsv" <<'EOF'
tbt_read_only|f|f|f|f|f
tong_bien_tap|f|f|f|f|f
EOF
cmp -s "$run_dir/terminal-tbt.expected.tsv" "$run_dir/terminal-tbt.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
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
  > "$run_dir/isolated-functions.terminal.tsv"
test "$(wc -l < "$run_dir/isolated-functions.terminal.tsv")" -eq 13
cmp -s "$run_dir/production-functions.isolated.before.tsv" "$run_dir/isolated-functions.terminal.tsv"
chmod 0600 "$run_dir"/*
```

Expected: the two synthetic TBT rows end with all five audited booleans false, and the thirteen isolated function signature/body/owner/config/grant fingerprints are byte-identical to production. This proves terminal chronology, not historical execution.

- [ ] **Step 5: Re-run the fifteen safe files transactionally to prove technical idempotency**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
docker exec "$container_name" pg_isready -q -U postgres -d "$replay_db"
safe_chain=(
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
  20260814160000_employee_password_reset_admin.sql
  20260814170000_employee_password_reset_hardening.sql
)
test "${#safe_chain[@]}" -eq 15
install -m 0600 /dev/null "$run_dir/idempotency-status.tsv"
for migration in "${safe_chain[@]}"; do
  version=${migration%%_*}
  source_file="supabase/migrations/$migration"
  hash_file="$run_dir/idempotency-$version.output.sha256"
  install -m 0600 /dev/null "$hash_file"
  set +e
  docker exec -i "$container_name" psql -X -U postgres -d "$replay_db" \
    --single-transaction -v ON_ERROR_STOP=1 -f - \
    < "$source_file" 2>&1 | sha256sum | awk '{print $1}' > "$hash_file"
  idempotency_pipeline=("${PIPESTATUS[@]}")
  idempotency_status=${idempotency_pipeline[0]}
  set -e
  test "${idempotency_pipeline[1]}" -eq 0
  test "${idempotency_pipeline[2]}" -eq 0
  read -r output_hash < "$hash_file"
  [[ "$output_hash" =~ ^[0-9a-f]{64}$ ]]
  printf '%s|%s|%s\n' "$version" "$idempotency_status" "$output_hash" \
    >> "$run_dir/idempotency-status.tsv"
  test "$idempotency_status" -eq 0
done
test "$(wc -l < "$run_dir/idempotency-status.tsv")" -eq 15
test "$(awk -F '|' '$2!=0{bad++} END{print bad+0}' "$run_dir/idempotency-status.tsv")" -eq 0
chmod 0600 "$run_dir"/*
```

Expected: all fifteen safe files exit `0` on the second isolated pass. Idempotency is technical replay evidence only and never upgrades protected historical DML to `exact-applied`.

- [ ] **Step 6: Seal the replay evidence without stopping or removing retained resources**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
docker volume inspect "$volume_name" >/dev/null
sha256sum \
  "$run_dir/replay-status.tsv" \
  "$run_dir/list-order.before.tsv" \
  "$run_dir/list-order.after.tsv" \
  "$run_dir/terminal-tbt.tsv" \
  "$run_dir/isolated-functions.terminal.tsv" \
  "$run_dir/idempotency-status.tsv" \
  > "$run_dir/TASK5-SHA256SUMS"
chmod 0600 "$run_dir/TASK5-SHA256SUMS"
(cd / && sha256sum -c "$run_dir/TASK5-SHA256SUMS" >/dev/null)
```

Expected: all replay/rollback/terminal/idempotency evidence verifies. The running container, volume, and secret remain retained for classification review.

## Task 6: Classify every target from sealed production and isolated evidence

**Files:**
- Create outside Git: `$run_dir/classification.tsv`
- Create outside Git: `$run_dir/HISTORY-GATE.status`
- No production write

- [ ] **Step 1: Verify every isolated and production input before classification**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
(cd "$evidence_root" && sha256sum -c PRECHANGE-SHA256SUMS >/dev/null)
(cd "$evidence_root" && sha256sum -c production-evidence.sha256 >/dev/null)
(cd / && sha256sum -c "$run_dir/TASK4-SHA256SUMS" >/dev/null)
(cd / && sha256sum -c "$run_dir/TASK5-SHA256SUMS" >/dev/null)
grep -Fx '21|53|96|5|39|14' "$run_dir/isolated-core-counts.tsv"
grep -Fx 'default_acl|6|3|3' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'schema_acl|7' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'table_acl|653' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'function_acl|46' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'table_effective|571|588' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'function_effective|40|56' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'schema_effective|5|8' "$run_dir/isolated-acl-privileges.tsv"
cmp -s "$run_dir/production-owner.before.tsv" "$run_dir/isolated-owner.tsv"
test "$(awk -F '|' '$2!=0{print $1}' "$run_dir/replay-status.tsv")" = 20260814130000
test "$(awk -F '|' '$2!=0{bad++} END{print bad+0}' "$run_dir/idempotency-status.tsv")" -eq 0
cmp -s "$run_dir/production-functions.isolated.before.tsv" "$run_dir/isolated-functions.terminal.tsv"
```

Expected: classification consumes the exact isolated RED/GREEN, restore-fidelity, replay, rollback, idempotency, production, source, owner, ACL, and function evidence. A green isolated replay is necessary but not sufficient proof of historical production execution.

- [ ] **Step 2: Record the audited provisional classifications without upgrading unresolved versions**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
cat > "$run_dir/classification.tsv" <<'EOF'
20260813172000|exact-applied-candidate|history-only-after-all-exact|durable-catalog-and-terminal-chain-match
20260813210000|semantically-applied-but-source-differs|stop-forward-only-decision|required-protected-one-time-dml-unprovable
20260813220000|exact-applied-candidate|history-only-after-all-exact|generated-score-and-grant-match
20260813230000|semantically-applied-but-source-differs|stop-chain-decision|production-tbt-flags-differ-from-full-chain
20260813233000|semantically-applied-but-source-differs|stop-independent-apply-evidence|required-effect-superseded-without-apply-record
20260813234500|exact-applied-candidate|history-only-after-all-exact|terminal-function-and-grants-match
20260814070000|exact-applied-candidate|history-only-after-all-exact|catalog-policy-trigger-and-aggregate-match
20260814102000|exact-applied-candidate|history-only-after-all-exact|catalog-rpc-body-and-grants-match
20260814130000|exact-applied-candidate|stop-until-targeted-dml-proof|aggregate-footprint-matches-but-identity-free-replay-rolls-back
20260814160000|exact-applied|history-only-after-all-exact|trusted-transactional-apply-manifest-and-terminal-state
20260814170000|exact-applied|history-only-after-all-exact|trusted-transactional-apply-manifest-and-terminal-state
EOF
chmod 0600 "$run_dir/classification.tsv"
test "$(wc -l < "$run_dir/classification.tsv")" -eq 11
```

Expected: eleven rows preserve the committed taxonomy. `20260813210000`, `20260813230000`, `20260813233000`, and `20260814130000` remain unresolved STOP conditions; `exact-applied-candidate` is deliberately not a final category.

- [ ] **Step 3: Apply the exact all-or-nothing validator atomically**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
expected_versions='20260813172000,20260813210000,20260813220000,20260813230000,20260813233000,20260813234500,20260814070000,20260814102000,20260814130000,20260814160000,20260814170000'
test "$(cut -d'|' -f1 "$run_dir/classification.tsv" | sort -u | paste -sd, -)" = "$expected_versions"
test "$(awk -F '|' 'NF!=4{bad++} END{print bad+0}' "$run_dir/classification.tsv")" -eq 0
gate_file="$run_dir/HISTORY-GATE.status"
gate_tmp="$run_dir/HISTORY-GATE.status.tmp"
if test "$(awk -F '|' '$2!="exact-applied"{bad++} END{print bad+0}' "$run_dir/classification.tsv")" -ne 0; then
  printf '%s\n' 'STOP: at least one target is not exact-applied' > "$gate_tmp"
else
  printf '%s\n' 'EXACT: all eleven targets are exact-applied' > "$gate_tmp"
fi
chmod 0600 "$gate_tmp"
mv -f -- "$gate_tmp" "$gate_file"
grep -Fx 'STOP: at least one target is not exact-applied' "$gate_file"
```

Expected for the audited baseline: exact `STOP`. Task 8 remains unreachable, and production history remains unchanged.

- [ ] **Step 4: Enforce the independent-evidence rule for `exact-applied`**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
cd "$repo"
sha256sum -c "$evidence_root/source.sha256" >/dev/null
(cd / && sha256sum -c "$run_dir/TASK4-SHA256SUMS" >/dev/null)
(cd / && sha256sum -c "$run_dir/TASK5-SHA256SUMS" >/dev/null)
test "$(awk -F '|' '$2!=$3{bad++} END{print bad+0}' "$evidence_root/history.before.tsv")" -eq 0
test "$(awk -F '|' '$2=="exact-applied"{n++} END{print n+0}' "$run_dir/classification.tsv")" -eq 2
```

Expected at baseline: only `20260814160000` and `20260814170000` are final `exact-applied` because each has trusted independent production apply evidence. Isolated idempotency or terminal-state equivalence alone cannot upgrade another row.

- [ ] **Step 5: Enforce STOP behavior for semantic or partial application**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -F '|semantically-applied-but-source-differs|' "$run_dir/classification.tsv" \
  > "$run_dir/semantic-drift.list"
chmod 0600 "$run_dir/semantic-drift.list"
test "$(wc -l < "$run_dir/semantic-drift.list")" -eq 3
if grep -F '|partially-applied|' "$run_dir/classification.tsv" >/dev/null; then
  grep -Fx 'STOP: at least one target is not exact-applied' "$run_dir/HISTORY-GATE.status"
fi
grep -Fx 'STOP: at least one target is not exact-applied' "$run_dir/HISTORY-GATE.status"
```

Expected: semantic drift and any future partial row remain blocked. A forward-only decision/completion migration may be designed separately, but cannot change history without independent exact execution evidence.

- [ ] **Step 6: Enforce STOP behavior for `not-applied` and seal classification evidence**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
if grep -F '|not-applied|' "$run_dir/classification.tsv" >/dev/null; then
  grep -Fx 'STOP: at least one target is not exact-applied' "$run_dir/HISTORY-GATE.status"
fi
sha256sum "$run_dir/classification.tsv" "$run_dir/HISTORY-GATE.status" \
  "$run_dir/semantic-drift.list" > "$run_dir/TASK6-SHA256SUMS"
chmod 0600 "$run_dir/TASK6-SHA256SUMS"
(cd / && sha256sum -c "$run_dir/TASK6-SHA256SUMS" >/dev/null)
```

Expected: any `not-applied` row schedules a separate reviewed forward migration and leaves history untouched. The current classification and STOP gate are sealed.

## Task 7: Record protected-version decisions, prohibit production replay, and retain evidence

**Files:**
- Create outside Git: decision-only evidence in the isolated run directory
- Read production aggregates/history only
- Never stream a migration source to production; never rehearse a production migration transaction
- Retain the container, volume, password file, sealed archives, and all prior databases/evidence

- [ ] **Step 1: Keep `20260813210000` blocked by protected one-time-DML uncertainty**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -Fx '20260813210000|semantically-applied-but-source-differs|stop-forward-only-decision|required-protected-one-time-dml-unprovable' \
  "$run_dir/classification.tsv"
(cd "$evidence_root" && sha256sum -c PRECHANGE-SHA256SUMS >/dev/null)
test "$(awk -F '|' 'NF!=16 || $3!=0 || $4!=0 || $5!=0{bad++} END{print bad+0}' \
  "$evidence_root/aggregates.before.tsv")" -eq 0
printf '%s\n' \
  '20260813210000|STOP|current-postconditions-do-not-prove-historical-protected-dml' \
  > "$run_dir/decision-20260813210000.tsv"
chmod 0600 "$run_dir/decision-20260813210000.tsv"
```

Expected: zero missing password hashes, zero surviving legacy-password values, and zero invalid session epochs remain aggregate-only evidence, but cannot prove historical identity/credential DML. Resolution is a separately reviewed forward-only design plus independent exact evidence; no production replay is present here.

- [ ] **Step 2: Keep `20260813230000` blocked by the measured production/full-chain difference**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -Fx '20260813230000|semantically-applied-but-source-differs|stop-chain-decision|production-tbt-flags-differ-from-full-chain' \
  "$run_dir/classification.tsv"
test "$(awk -F '|' '$1=="TBT_POLICY"{print $3}' "$evidence_root/production-data-evidence.before.tsv")" -ne 2
cmp -s "$run_dir/terminal-tbt.expected.tsv" "$run_dir/terminal-tbt.tsv"
printf '%s\n' \
  '20260813230000|STOP|production-tbt-state-differs-from-isolated-full-chain' \
  > "$run_dir/decision-20260813230000.tsv"
chmod 0600 "$run_dir/decision-20260813230000.tsv"
```

Expected: exact chronological isolated replay leaves both TBT fixtures false while production differs. This remains a business/source-chain decision, not permission to replay or mark history.

- [ ] **Step 3: Keep `20260813233000` blocked despite exact isolated supersession**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -Fx '20260813233000|semantically-applied-but-source-differs|stop-independent-apply-evidence|required-effect-superseded-without-apply-record' \
  "$run_dir/classification.tsv"
awk -F '|' '$1=="20260813233000" || $1=="20260813234500" {if($2!=0) bad++; seen++} END{exit !(seen==2 && bad==0)}' \
  "$run_dir/replay-status.tsv"
cmp -s "$run_dir/production-functions.isolated.before.tsv" "$run_dir/isolated-functions.terminal.tsv"
printf '%s\n' \
  '20260813233000|STOP|terminal-supersession-without-independent-production-apply-record' \
  > "$run_dir/decision-20260813233000.tsv"
chmod 0600 "$run_dir/decision-20260813233000.tsv"
```

Expected: isolated order and terminal fingerprints are exact, but the earlier fully superseded version has no independent trusted production apply record. No production transaction rehearsal or execution is allowed.

- [ ] **Step 4: Keep targeted `20260814130000` blocked by the expected identity-free rollback**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -Fx '20260814130000|exact-applied-candidate|stop-until-targeted-dml-proof|aggregate-footprint-matches-but-identity-free-replay-rolls-back' \
  "$run_dir/classification.tsv"
awk -F '|' '$1=="20260814130000" && $2!=0{ok=1} END{exit !ok}' "$run_dir/replay-status.tsv"
cmp -s "$run_dir/list-order.before.tsv" "$run_dir/list-order.after.tsv"
grep -Fx '0|0|0|1' "$run_dir/list-order.after.tsv"
printf '%s\n' \
  '20260814130000|STOP|targeted-dml-needs-independent-nonidentifying-proof' \
  > "$run_dir/decision-20260814130000.tsv"
chmod 0600 "$run_dir/decision-20260814130000.tsv"
```

Expected: the identity-free replay fails only as designed and fully rolls back. Production aggregate footprint plus source checksum remains insufficient to prove targeted historical execution.

- [ ] **Step 5: Prove this plan produced decision evidence only and left production history unchanged**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -Fx 'STOP: at least one target is not exact-applied' "$run_dir/HISTORY-GATE.status"
test "$(awk -F '|' '$3 ~ /production-replay|production-rehearsal/{bad++} END{print bad+0}' \
  "$run_dir/classification.tsv")" -eq 0
printf 'production_migration_replay|0\nproduction_migration_rehearsal|0\nproduction_migration_execution|0\n' \
  > "$run_dir/production-migration-execution.count"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version,expected) as (values
 ('20260813110000',1),('20260813155000',1),('20260813172000',0),('20260813184000',1),
 ('20260813210000',0),('20260813220000',0),('20260813230000',0),('20260813233000',0),
 ('20260813234500',0),('20260814070000',0),('20260814090000',1),('20260814102000',0),
 ('20260814113000',1),('20260814130000',0),('20260814160000',0),('20260814170000',0))
select target.version,target.expected,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version,target.expected order by target.version;" \
  > "$run_dir/production-history.after-decisions.tsv"
cmp -s "$run_dir/production-history.isolated.before.tsv" "$run_dir/production-history.after-decisions.tsv"
sha256sum "$run_dir"/decision-*.tsv "$run_dir/production-migration-execution.count" \
  "$run_dir/production-history.after-decisions.tsv" > "$run_dir/TASK7-DECISIONS-SHA256SUMS"
chmod 0600 "$run_dir/production-migration-execution.count" \
  "$run_dir/production-history.after-decisions.tsv" "$run_dir/TASK7-DECISIONS-SHA256SUMS"
(cd / && sha256sum -c "$run_dir/TASK7-DECISIONS-SHA256SUMS" >/dev/null)
```

Expected: all three production migration counters are zero, all sixteen production history counts remain byte-identical, and the four unresolved decisions are sealed. Task 8 is still unreachable.

- [ ] **Step 6: Seal evidence first, then stop—but never remove—the isolated container**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
docker exec "$container_name" pg_isready -q -U postgres -d "$replay_db"
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
docker logs "$container_name" 2>&1 | sha256sum | awk '{print $1}' \
  > "$run_dir/container-log.output.sha256"
chmod 0600 "$run_dir/container-log.output.sha256"
prestop_tmp="$evidence_root/.prestop-$run_id.sha256.tmp"
find "$run_dir" -maxdepth 1 -type f \
  ! -name bootstrap-password ! -name PRESTOP-SHA256SUMS ! -name FINAL-ISOLATED-SHA256SUMS \
  -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$prestop_tmp"
chmod 0600 "$prestop_tmp"
mv -f -- "$prestop_tmp" "$run_dir/PRESTOP-SHA256SUMS"
(cd / && sha256sum -c "$run_dir/PRESTOP-SHA256SUMS" >/dev/null)
docker stop --time 30 "$container_name" >/dev/null
test "$(docker inspect -f '{{.State.Status}}' "$container_name")" = exited
docker volume inspect "$volume_name" >/dev/null
test -f "$run_dir/bootstrap-password"
test "$(stat -c %a "$run_dir/bootstrap-password")" = 600
printf 'container|retained|exited\nvolume|retained\nsecret|retained|0600\n' \
  > "$run_dir/retention.after.tsv"
chmod 0600 "$run_dir/retention.after.tsv"
final_tmp="$evidence_root/.final-$run_id.sha256.tmp"
find "$run_dir" -maxdepth 1 -type f \
  ! -name bootstrap-password ! -name FINAL-ISOLATED-SHA256SUMS \
  -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$final_tmp"
chmod 0600 "$final_tmp"
mv -f -- "$final_tmp" "$run_dir/FINAL-ISOLATED-SHA256SUMS"
test "$(find "$run_dir" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
(cd / && sha256sum -c "$run_dir/FINAL-ISOLATED-SHA256SUMS" >/dev/null)
```

Expected: evidence is checksum-sealed before the allowed stop; afterward the exact container exists in `exited` state, the named volume and secret remain retained, and the final non-secret evidence index verifies. Any earlier failure performs no automatic stop/retry/removal. Container/volume/secret/database/backup cleanup is a separate dangerous action requiring immediate explicit confirmation of exact targets.

## Task 8: Insert all eleven history rows in one transaction only after all evidence is exact

**Files:**
- Modify conditionally: production `supabase_migrations.schema_migrations`
- No schema, application, source, or service modification

- [ ] **Step 1: Enforce the all-exact precondition**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
grep -Fx 'EXACT: all eleven targets are exact-applied' "$run_dir/HISTORY-GATE.status"
test "$(wc -l < "$run_dir/classification.tsv")" -eq 11
expected_versions='20260813172000,20260813210000,20260813220000,20260813230000,20260813233000,20260813234500,20260814070000,20260814102000,20260814130000,20260814160000,20260814170000'
test "$(cut -d'|' -f1 "$run_dir/classification.tsv" | sort -u | paste -sd, -)" = "$expected_versions"
test "$(awk -F '|' '$2!="exact-applied"{bad++} END{print bad+0}' "$run_dir/classification.tsv")" -eq 0
grep -Fx 'production_migration_replay|0' "$run_dir/production-migration-execution.count"
grep -Fx 'production_migration_rehearsal|0' "$run_dir/production-migration-execution.count"
grep -Fx 'production_migration_execution|0' "$run_dir/production-migration-execution.count"
test "$(docker inspect -f '{{.State.Status}}' "$(cut -d'|' -f2 "$run_dir/names.tsv")")" = exited
docker volume inspect "$(cut -d'|' -f3 "$run_dir/names.tsv")" >/dev/null
test -f "$run_dir/bootstrap-password"
(cd / && sha256sum -c "$run_dir/FINAL-ISOLATED-SHA256SUMS" >/dev/null)
cd /opt/thoidai-work
sha256sum -c "$evidence_root/source.sha256" >/dev/null
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
(cd "$evidence_root" && sha256sum -c database.full.dump.sha256 >/dev/null && sha256sum -c PRECHANGE-SHA256SUMS >/dev/null)
```

Expected for the current audited baseline: this step stops because unresolved rows exist. History remains unchanged.

- [ ] **Step 2: Re-read history immediately before the write**

```bash
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version) as (values
 ('20260813172000'),('20260813210000'),('20260813220000'),
 ('20260813230000'),('20260813233000'),('20260813234500'),
 ('20260814070000'),('20260814102000'),('20260814130000'),
 ('20260814160000'),('20260814170000'))
select target.version,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version order by target.version;" > "$run_dir/history.immediate-before.tsv"
chmod 0600 "$run_dir/history.immediate-before.tsv"
test "$(awk -F '|' '$2!=0{bad++} END{print bad+0}' "$run_dir/history.immediate-before.tsv")" -eq 0
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
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select version,name,cardinality(statements)
from supabase_migrations.schema_migrations
where version in (
 '20260813172000','20260813210000','20260813220000',
 '20260813230000','20260813233000','20260813234500',
 '20260814070000','20260814102000','20260814130000',
 '20260814160000','20260814170000')
order by version;" > "$run_dir/history.after.tsv"
chmod 0600 "$run_dir/history.after.tsv"
test "$(wc -l < "$run_dir/history.after.tsv")" -eq 11
test "$(awk -F '|' '$3!=0{bad++} END{print bad+0}' "$run_dir/history.after.tsv")" -eq 0
```

Expected: eleven exact version/name rows with statement cardinality `0`.

- [ ] **Step 5: Define abort and rollback strategy without executing deletion**

Before commit, every failure aborts through the transaction automatically. After commit, do not delete history rows automatically. If read-back later proves wrong, stop migration runners, preserve all evidence, and request immediate explicit confirmation before either:

1. deleting only the eleven exact version/name/empty-statement rows in one reviewed transaction; or
2. restoring the full dump under a separately approved database-restore runbook.

Expected: no rollback action occurs during a successful Phase-0 run.

## Task 9: Verify production/Git/HTTP preservation, retained resources, and VPS health

**Files:**
- Create outside Git: post-run aggregate evidence in the isolated run directory
- Read production only except for the separately gated Task 8 history transaction
- No application source/build/config/service modification

- [ ] **Step 1: Re-capture production aggregates, history, owners, and functions**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
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
  > "$run_dir/production-aggregates.isolated.after.tsv"
cmp -s "$run_dir/production-aggregates.isolated.before.tsv" "$run_dir/production-aggregates.isolated.after.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version,expected_before) as (values
 ('20260813110000',1),('20260813155000',1),('20260813172000',0),('20260813184000',1),
 ('20260813210000',0),('20260813220000',0),('20260813230000',0),('20260813233000',0),
 ('20260813234500',0),('20260814070000',0),('20260814090000',1),('20260814102000',0),
 ('20260814113000',1),('20260814130000',0),('20260814160000',0),('20260814170000',0))
select target.version,target.expected_before,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version,target.expected_before order by target.version;" \
  > "$run_dir/production-history.isolated.after.tsv"
if grep -Fxq 'STOP: at least one target is not exact-applied' "$run_dir/HISTORY-GATE.status"; then
  cmp -s "$run_dir/production-history.isolated.before.tsv" "$run_dir/production-history.isolated.after.tsv"
else
  grep -Fx 'EXACT: all eleven targets are exact-applied' "$run_dir/HISTORY-GATE.status"
  test "$(awk -F '|' '$2==0 && $3!=1{bad++} $2==1 && $3!=1{bad++} END{print bad+0}' "$run_dir/production-history.isolated.after.tsv")" -eq 0
fi
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
) q order by kind,schema_name,owner_name;" > "$run_dir/production-owner.after.tsv"
cmp -s "$run_dir/production-owner.before.tsv" "$run_dir/production-owner.after.tsv"
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
  > "$run_dir/production-functions.isolated.after.tsv"
cmp -s "$run_dir/production-functions.isolated.before.tsv" "$run_dir/production-functions.isolated.after.tsv"
chmod 0600 "$run_dir"/*
```

Expected: protected aggregates, owner distribution, and thirteen function fingerprints are byte-identical. At the audited STOP baseline all sixteen history counts are also byte-identical; only a future successful Task 8 may change the eleven target counts from `0` to `1`.

- [ ] **Step 2: Prove Git/source preservation and retained isolated resources**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
cd "$repo"
test "$(git diff --cached --name-only | wc -l)" -eq 0
sha256sum -c "$evidence_root/source.sha256" >/dev/null
git rev-parse HEAD > "$run_dir/head.isolated.after"
git rev-parse HEAD^{tree} > "$run_dir/tree.isolated.after"
git status --porcelain=v1 --untracked-files=all > "$run_dir/root-status.isolated.after"
cmp -s "$run_dir/head.isolated.before" "$run_dir/head.isolated.after"
cmp -s "$run_dir/tree.isolated.before" "$run_dir/tree.isolated.after"
cmp -s "$run_dir/root-status.isolated.before" "$run_dir/root-status.isolated.after"
test "$(wc -l < "$run_dir/root-status.isolated.after")" -eq 358
test "$(sha256sum "$run_dir/root-status.isolated.after" | awk '{print $1}')" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
test "$(docker inspect -f '{{.State.Status}}' "$container_name")" = exited
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
docker volume inspect "$volume_name" >/dev/null
test -f "$run_dir/bootstrap-password"
test "$(stat -c %a "$run_dir/bootstrap-password")" = 600
chmod 0600 "$run_dir"/*
```

Expected: HEAD/tree/index/source and all 358 unrelated dirty records are unchanged, with fingerprint `20115c…97a`; dirty paths are never printed. The exact isolated container remains stopped, portless, and network-none while its volume and root-only secret remain retained.

- [ ] **Step 3: Compare HTTP behavior, restart count, services, and Docker health with preflight**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active docker)" = active
test "$(systemctl is-active nginx)" = active
nginx -t >/dev/null 2>&1
docker exec supabase_db_thoidai-work pg_isready -q -U postgres -d postgres
test "$(docker ps --filter health=unhealthy -q | wc -l)" -eq 0
local_login=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/login)
public_login=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/login)
local_session=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/api/auth/session)
public_session=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/api/auth/session)
printf 'local_login|%s\npublic_login|%s\nlocal_session|%s\npublic_session|%s\n' \
  "$local_login" "$public_login" "$local_session" "$public_session" \
  > "$run_dir/http.isolated.after.tsv"
cmp -s "$run_dir/http.isolated.before.tsv" "$run_dir/http.isolated.after.tsv"
systemctl show thoidai-work -p NRestarts --value > "$run_dir/nrestarts.isolated.after"
cmp -s "$run_dir/nrestarts.isolated.before" "$run_dir/nrestarts.isolated.after"
running_before=$(awk -F '|' '$1=="running_containers"{print $2}' "$run_dir/resources.isolated.before.tsv")
test "$(docker ps -q | wc -l)" -eq "$running_before"
chmod 0600 "$run_dir/http.isolated.after.tsv" "$run_dir/nrestarts.isolated.after"
```

Expected: local/public login remain `200`, unauthenticated session remains `401`, application restart count is unchanged, nginx/database are healthy, Docker has zero unhealthy containers, and stopping the retained isolated container returns the running-container count to its preflight value.

- [ ] **Step 4: Report the complete aggregate VPS health matrix**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
printf 'VPS=vps-aylaspa\n'
printf 'STATUS=%s\n' "$(systemctl is-system-running 2>/dev/null || true)"
printf 'CPU=%s vCPU\n' "$(nproc)"
free -m | awk '/^Mem:/ {printf "RAM=%d/%d MiB (%.1f%%)\n",$3,$2,100*$3/$2}'
df -hP /opt/thoidai-work | awk 'NR==2 {printf "DISK=%s/%s (%s), free=%s\n",$3,$2,$5,$4}'
awk '{print "LOAD="$1"/"$2"/"$3}' /proc/loadavg
printf 'SERVICES=thoidai-work:%s failed-units:%s\n' \
  "$(systemctl is-active thoidai-work)" "$(systemctl --failed --no-legend | wc -l)"
printf 'DOCKER=%s running=%s unhealthy=%s\n' \
  "$(systemctl is-active docker)" "$(docker ps -q | wc -l)" \
  "$(docker ps --filter health=unhealthy -q | wc -l)"
printf 'NGINX=%s config=ok\n' "$(systemctl is-active nginx)"
printf 'DATABASE='; docker exec supabase_db_thoidai-work pg_isready -U postgres -d postgres
printf 'WARNINGS=%s (60m)\n' \
  "$(journalctl -u thoidai-work --since '60 minutes ago' -p warning --no-pager --output=cat | wc -l)"
printf 'ERRORS=%s (60m)\n' \
  "$(journalctl -u thoidai-work --since '60 minutes ago' -p err --no-pager --output=cat | wc -l)"
if grep -Fxq 'STOP: at least one target is not exact-applied' "$run_dir/HISTORY-GATE.status"; then
  printf 'RECOMMENDED ACTION=retain evidence and resolve the four blocked versions; do not write history\n'
else
  printf 'RECOMMENDED ACTION=review Task 8 read-back and retained evidence before any later cleanup\n'
fi
```

Expected report fields exactly: VPS, STATUS, CPU, RAM, DISK, LOAD, SERVICES, DOCKER, NGINX, DATABASE, WARNINGS, ERRORS, and RECOMMENDED ACTION. Only counts/statuses are reported; journal bodies are never printed.

- [ ] **Step 5: Seal all final non-secret evidence**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
final_tmp="$evidence_root/.phase0-final-$run_id.sha256.tmp"
find "$run_dir" -maxdepth 1 -type f \
  ! -name bootstrap-password ! -name PHASE0-FINAL-SHA256SUMS \
  -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$final_tmp"
chmod 0600 "$final_tmp"
mv -f -- "$final_tmp" "$run_dir/PHASE0-FINAL-SHA256SUMS"
test "$(find "$run_dir" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
(cd / && sha256sum -c "$run_dir/PHASE0-FINAL-SHA256SUMS" >/dev/null)
```

Expected: the final root-only index covers source/history decisions, backup validation, restore/replay results, owner/ACL/privilege gates, classification, preservation, HTTP/restart evidence, Git fingerprint, and retained-resource state. The secret remains excluded and retained.

## Task 10: Execution handoff and current stop state

**Files:**
- Modify during planning review only: `docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md`
- No execution action in this task

- [ ] **Step 1: Honor the audited STOP while still completing preservation health checks**

The current evidence does not authorize history writes because `20260813210000`, `20260813230000`, `20260813233000`, and `20260814130000` lack exact independent production execution proof. Execute approved Tasks 4–7 sequentially, skip Task 8 when the exact STOP gate is present, then execute Task 9 preservation/health checks. Never treat isolated replay success as permission to write history.

Expected: the audited path completes Tasks 4–7 and Task 9, records exact STOP, and performs zero Task-8 history writes.

- [ ] **Step 2: Use the already selected inline execution method**

When primary review later authorizes implementation, continue inline through the existing matching custom agent `/root/aylaspa_thoidai` with `superpowers:executing-plans`. The one-VPS routing requirement overrides the generic fresh-worker option in the writing-plans header. Do not spawn another worker or parallelize backup, lifecycle, restore, replay, classification, history, or health steps.

Expected: one sequential execution context uses only the existing Aylaspa agent; no parallel or replacement VPS worker is created.

- [ ] **Step 3: Keep this rewritten plan modified, unstaged, and uncommitted for primary review**

```bash
set -euo pipefail
cd /opt/thoidai-work
plan=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
test "$(git status --porcelain=v1 --untracked-files=all -- "$plan")" = " M $plan"
test "$(git diff --cached --name-only | wc -l)" -eq 0
```

Expected during this writing-plans phase: exactly one unstaged modification for this tracked plan and an empty index. Do not commit or begin implementation until primary review explicitly approves the draft.
