# THỜI ĐẠI WORK Phase 1: Source Stabilization and Authorization Façade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first independently deployable THỜI ĐẠI WORK subproject: a reproducible clean source base, additive role/department authorization schema, canonical session permission contract, pure task/evaluation authorization decisions, and server-only task read/mutation façades without changing navigation or revoking anonymous access.

**Architecture:** Preserve the signed HttpOnly session and `session_version` epoch, derive the actor only on the server, and pass a minimal actor/task relationship snapshot into a pure authorization evaluator. Next.js route handlers use shared same-origin/session guards and a service-role repository; database RPC wrappers repeat mutation authorization and remain executable only by `service_role`. The application and schema remain backward-compatible so the current production UI can continue during the later UI cutover.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Node `node:test`, Supabase/PostgreSQL 15, SQL/PLpgSQL, systemd, nginx, Docker, PowerShell/SSH orchestration.

---

## Scope boundary

This plan implements only approved Phase 1:

- source/worktree stabilization;
- the five additive permission columns `can_assign_task`, `can_view_department_tasks`, `can_evaluate_step1`, `can_evaluate_step2`, and `can_manage_rubrics`;
- nullable `departments.manager_id` with same-department validation and deterministic safe backfill;
- `ServerAuthUser.role_level`, nullable `department_id`, and the full permission DTO;
- pure task and evaluation authorization;
- server task list/detail plus the currently exercised create/update/claim/report/review/legacy-evaluate/comment/bulk-plan mutation categories;
- same-origin/session guards, service-role-only RPC boundaries, disposable-database SQL tests, build/deploy, rollback, and production health gates.

The following are explicitly not part of this plan:

- Navigation, sidebar, `/tasks` homepage UI, redirects, responsive UI, or any other Phase 2 work.
- New task types, structured progress without percentages, deadline/status history, private attachments, watcher automation, recurrence, shared rubric tables, or the new 100-point evaluation workflow.
- Anonymous-policy revoke or RLS enforcement. Existing anonymous compatibility remains until Phase 8.
- Supabase Auth/JWT conversion, password-reset/session-epoch changes, provider/model changes, CLIProxyAPI changes, or the `9router` switch.
- Migration-history repair, `supabase db push`, bulk migration application, or direct edits to `supabase_migrations.schema_migrations`.

## Audited starting state and stop conditions

- Approved design commit: `18cd95fed7e09ce49bb66c9e5704d1b29a67dcda`.
- Approved design path: `docs/superpowers/specs/2026-08-14-thoidai-work-ui-refactor-design.md`.
- Starting tree: `515066f1b62e216ef7c07e4c0d6301e70982c58f`.
- Root worktree before planning: 358 `git status --porcelain=v1 --untracked-files=all` records with SHA-256 `20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a`; index empty.
- Production invariants are captured dynamically as aggregate-only, root-readable metadata immediately before migration and compared after migration. Never print task titles, staff identities, emails, password material, tokens, environment values, or provider payloads.
- Eleven source migration versions are absent from migration history: `20260813172000`, `20260813210000`, `20260813220000`, `20260813230000`, `20260813233000`, `20260813234500`, `20260814070000`, `20260814102000`, `20260814130000`, `20260814160000`, and `20260814170000`.
- Migration-history reconciliation is a separate approved runbook prerequisite. Stop before creating/applying the Phase-1 SQL migration until all eleven prior versions have been reconciled by checksum/object evidence. This plan never repairs history.
- The dirty root currently has a known pre-existing failing assertion in `src/lib/taskEvaluation.test.mjs:18-26` against `src/lib/taskEvaluation.ts:44-53`; TypeScript currently passes. Do not “fix” or import this unrelated dirty overlap into Phase 1. The isolated worktree must start from committed source plus only the exact canonical manifest below.
- Stop if the root index is non-empty, the status fingerprint changes unexpectedly, an overlap path is modified after its checksum is recorded, the employee-password-reset/session-epoch commits are absent, a required source file cannot be proven, or the production database cannot be identified without reading secrets.

## Locked file map

### Canonical baseline gate — pre-existing work, never feature-authored

The following 18 files are the only pre-existing untracked sources required by this plan. Their current SHA-256 values lock the review input:

| SHA-256 | Path |
|---|---|
| `386caf8e173fb1c9a827a540e2b0ef467bcc594f645627f1d8b6b0c44bc7b619` | `src/app/api/permissions/route.ts` |
| `e03aeea2666b35d2abd177c05c6b59a16754e056fbba184e82789c2fd6777190` | `src/app/api/planning/bulk/route.ts` |
| `84224353472f3f5fca324ad69fd85913888430d413623b32438563e1a42c9a37` | `src/app/api/tasks/claim/route.ts` |
| `0870047b9c632a744e6226a3c7b9be662838dc862ae98d691b175192f03c3688` | `src/app/api/tasks/evaluate/route.ts` |
| `3accf7f85179d84148cb3b768ea1d286b8ae761daa41f444480b928332ef29bf` | `src/app/api/tasks/report/route.ts` |
| `b312bbc64efd7c325405ab4ad3e69ed67e7c67ba639cab1394dbe6607a39e46a` | `src/app/api/tasks/review/route.ts` |
| `dfc8eee060abf1c9b1f7322521152ce123f304a2095493f6d70e26fe17785a3f` | `supabase/migrations/20260813172000_task_plans_recipients_self_claim.sql` |
| `6a412f010049c120d06167e6f1622e0923a73401f50dc234f4f1ae20b4353879` | `supabase/migrations/20260813184000_secure_task_rpc_execution.sql` |
| `0c605442e6b40f3114f931791b1620cd4f8c486b9a0557171b0fe83f04f36105` | `supabase/migrations/20260813220000_task_evaluation_total_score.sql` |
| `465b99f9333c52c55fd4ea0821fb0e1e151ff2e8f855610dbf1061124ff397e6` | `supabase/migrations/20260813230000_admin_role_user_policy.sql` |
| `064a215f15aa9855ec2568796adf9ceefb992d842d0b809ad341690219688978` | `supabase/migrations/20260813233000_tbt_evaluation_guard.sql` |
| `186b20cae2f1b940bb5ebabe3ef622daac852d15952b0f3903d735a1946f8d8b` | `supabase/migrations/20260813234500_creator_evaluation_guard.sql` |
| `f2d9e4e5ba2a627d70fcf45751e9a05bd8077e4eecc8fe5dab094c8624e293a7` | `supabase/migrations/20260814090000_task_priority_neutral_default.sql` |
| `b3ae48c9ede223f92823827a813fa6409a90c797d5b37eea45683b3f4b1a5931` | `supabase/migrations/20260814102000_bulk_task_plans.sql` |
| `dbc50b979dfc60124a275bd2b8b2a8c7b7ff05482bb6618678ac59dbd21afca3` | `supabase/tests/bulk_task_plan_smoke.sql` |
| `df3a89cd4fe976dba3a40ec667e89159676bcd26d9cd0cbada7f564191d0e579` | `supabase/tests/task_priority_compatibility.sql` |
| `93cada7b30461d99e7173a2c5bc2c5ad0b1d69daa820115ab3382e663605d397` | `supabase/tests/task_rpc_security.sql` |
| `70728a64ac3e8545feeb679aa1be2a28075daf3026ed4d0bf4abd0488cee8951` | `supabase/tests/task_workflow_smoke.sql` |

`src/lib/taskEvaluation.ts`, `src/lib/taskEvaluation.test.mjs`, every page component, backup artifact, mobile source, deployment config, and unrelated migration are excluded from this baseline manifest.

### Create during Phase 1

- `supabase/migrations/20260814190000_phase1_authorization_facade.sql`: additive columns, manager validation/backfill, deterministic permissions, and service-role-only façade RPCs.
- `supabase/tests/phase1_authorization_facade.sql`: transactional schema/backfill/grant/authorization assertions.
- `src/lib/permissions.ts`: canonical permission keys and zero-default normalization.
- `src/lib/authorization.ts`: pure task/evaluation decisions.
- `src/lib/authorization.test.mjs`: exhaustive actor/relationship matrix.
- `src/lib/apiResponse.ts`: pure private/no-store JSON and stable error responses.
- `src/lib/apiResponse.test.mjs`: runtime response-header and error-shape tests.
- `src/lib/serverApi.ts`: session, same-origin, UUID, and safe RPC error mapping helpers.
- `src/lib/serverApiSource.test.mjs`: source-contract tests for guard order and secret-safe errors.
- `src/lib/serverAudit.ts`: service-role audit writer for server-only routes.
- `src/lib/taskContracts.ts`: request/DTO/repository interfaces.
- `src/lib/legacyEvaluationValidation.ts`: strict Phase-1-owned validation for the legacy evaluation request.
- `src/lib/legacyEvaluationValidation.test.mjs`: pure score, boolean, completion, opinion, and calendar-date validation tests.
- `src/lib/taskRepository.ts`: service-role reads and façade RPC calls.
- `src/lib/taskHandlerFactory.ts`: dependency-injected authorization/application handlers.
- `src/lib/taskHandlers.ts`: production wiring for shared guards, repository, and handler factory.
- `src/lib/taskHandlers.test.mjs`: handler authorization and response tests with fakes.
- `src/app/api/tasks/route.ts`: list/create entry point.
- `src/app/api/tasks/[id]/route.ts`: detail/legacy update entry point.
- `src/app/api/tasks/[id]/comments/route.ts`: comment entry point.

### Modify during Phase 1

- `src/lib/serverSession.ts:13-22,38-70`: add department, role level, and normalized permissions without changing cookie/token/session-version behavior.
- `src/app/api/permissions/route.ts:23-49,33-41,48-75`: return/edit the five new permission flags through the existing Admin-only route.
- `src/app/api/tasks/claim/route.ts:1-13`: delegate to shared handlers and the new wrapper RPC.
- `src/app/api/tasks/evaluate/route.ts:1-59`: delegate strict Phase-1 validation, authorization, RPC, and error mapping without importing dirty `taskEvaluation.*` paths.
- `src/app/api/tasks/report/route.ts:1-18`: delegate to shared handlers and wrapper RPC.
- `src/app/api/tasks/review/route.ts:1-17`: delegate to shared handlers and wrapper RPC.
- `src/app/api/planning/bulk/route.ts:1-45`: delegate to shared guards/repository while preserving current request/response shape.
- `supabase/tests/task_rpc_security.sql:3-61`: assert every new wrapper is service-role-only.

### Verify but do not modify

- `src/lib/sessionToken.ts:1-69`, `src/lib/sessionToken.test.mjs:1-55`: preserve signed payload and legacy `sessionVersion=0` behavior.
- `src/app/api/auth/login/route.ts`, `forgot-password`, `reset-password`, `admin-reset`, `logout`, and `session`: preserve employee password reset and epoch enforcement.
- `src/lib/serverSupabase.ts:1-14`: preserve the server-only service-role singleton and never log its configuration.
- `src/lib/supabase.ts:1-6`: remains for compatibility UI until later cutover.
- `src/app/page.tsx:82-227`, `src/components/TaskStatusTablePage.tsx:51-69`, `src/app/tasks/[id]/page.tsx:83-277`, and `src/app/performance/page.tsx:95-184`: audited direct browser flows; Phase 1 does not edit them.
- `src/app/tasks/[id]/page.tsx:94-103,488-499`: current comments are direct anonymous reads/display only; there is no current comment composer.
- `src/app/planning/page.tsx:41-75` and `src/app/planning/reports/page.tsx:34-99`: current untracked planning list uses direct reads while claim/bulk mutations call the baseline wrappers; these UI pages remain excluded because Navigation/UI is Phase 2.
- `src/app/departments/page.tsx:21-38`: current browser department CRUD remains compatibility UI; Phase 1 adds `manager_id` but does not change this page.
- `DEPLOY_CHECKLIST.md`: dirty and obsolete for this deployment topology; do not stage it.
- systemd unit `thoidai-work.service`, nginx, provider/model, CLIProxyAPI, and `9router`: inspect and health-check only.

## Task 1: Prove and canonicalize the required source base

**Files:**
- Verify: `docs/superpowers/specs/2026-08-14-thoidai-work-ui-refactor-design.md`
- Baseline only: the exact 18-file manifest above
- Future worktree: `/opt/thoidai-worktrees/thoidai-phase1-authorization`

- [ ] **Step 1: Re-read the approved spec and prove root state**

Run on `vps-aylaspa`:

```bash
set -euo pipefail
cd /opt/thoidai-work
test "$(git rev-parse HEAD)" = "18cd95fed7e09ce49bb66c9e5704d1b29a67dcda"
test "$(git diff --cached --name-only | wc -l)" -eq 0
test "$(git status --porcelain=v1 --untracked-files=all | wc -l)" -eq 358
test "$(git status --porcelain=v1 --untracked-files=all | sha256sum | cut -d' ' -f1)" = "20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a"
git merge-base --is-ancestor 0752f61f0ea914555767595c4afe3901cb12efe4 HEAD
test -f docs/superpowers/specs/2026-08-14-thoidai-work-ui-refactor-design.md
```

Expected: all commands exit 0. Any mismatch is a stop, not permission to reset, stash, clean, or overwrite the root.

- [ ] **Step 2: Verify every baseline checksum and excluded overlap**

Run the exact manifest:

```bash
set -euo pipefail
cd /opt/thoidai-work
readarray -t baseline_manifest <<'EOF'
386caf8e173fb1c9a827a540e2b0ef467bcc594f645627f1d8b6b0c44bc7b619  src/app/api/permissions/route.ts
e03aeea2666b35d2abd177c05c6b59a16754e056fbba184e82789c2fd6777190  src/app/api/planning/bulk/route.ts
84224353472f3f5fca324ad69fd85913888430d413623b32438563e1a42c9a37  src/app/api/tasks/claim/route.ts
0870047b9c632a744e6226a3c7b9be662838dc862ae98d691b175192f03c3688  src/app/api/tasks/evaluate/route.ts
3accf7f85179d84148cb3b768ea1d286b8ae761daa41f444480b928332ef29bf  src/app/api/tasks/report/route.ts
b312bbc64efd7c325405ab4ad3e69ed67e7c67ba639cab1394dbe6607a39e46a  src/app/api/tasks/review/route.ts
dfc8eee060abf1c9b1f7322521152ce123f304a2095493f6d70e26fe17785a3f  supabase/migrations/20260813172000_task_plans_recipients_self_claim.sql
6a412f010049c120d06167e6f1622e0923a73401f50dc234f4f1ae20b4353879  supabase/migrations/20260813184000_secure_task_rpc_execution.sql
0c605442e6b40f3114f931791b1620cd4f8c486b9a0557171b0fe83f04f36105  supabase/migrations/20260813220000_task_evaluation_total_score.sql
465b99f9333c52c55fd4ea0821fb0e1e151ff2e8f855610dbf1061124ff397e6  supabase/migrations/20260813230000_admin_role_user_policy.sql
064a215f15aa9855ec2568796adf9ceefb992d842d0b809ad341690219688978  supabase/migrations/20260813233000_tbt_evaluation_guard.sql
186b20cae2f1b940bb5ebabe3ef622daac852d15952b0f3903d735a1946f8d8b  supabase/migrations/20260813234500_creator_evaluation_guard.sql
f2d9e4e5ba2a627d70fcf45751e9a05bd8077e4eecc8fe5dab094c8624e293a7  supabase/migrations/20260814090000_task_priority_neutral_default.sql
b3ae48c9ede223f92823827a813fa6409a90c797d5b37eea45683b3f4b1a5931  supabase/migrations/20260814102000_bulk_task_plans.sql
dbc50b979dfc60124a275bd2b8b2a8c7b7ff05482bb6618678ac59dbd21afca3  supabase/tests/bulk_task_plan_smoke.sql
df3a89cd4fe976dba3a40ec667e89159676bcd26d9cd0cbada7f564191d0e579  supabase/tests/task_priority_compatibility.sql
93cada7b30461d99e7173a2c5bc2c5ad0b1d69daa820115ab3382e663605d397  supabase/tests/task_rpc_security.sql
70728a64ac3e8545feeb679aa1be2a28075daf3026ed4d0bf4abd0488cee8951  supabase/tests/task_workflow_smoke.sql
EOF
printf '%s\n' "${baseline_manifest[@]}" | sha256sum -c -
manifest_file=/opt/thoidai-backups/thoidai-phase1-auth-baseline.sha256
install -m 0600 /dev/null "$manifest_file"
printf '%s\n' "${baseline_manifest[@]}" > "$manifest_file"
test "$(git status --porcelain=v1 -- src/lib/taskEvaluation.ts | cut -c1-2)" = " M"
test "$(git status --porcelain=v1 -- src/lib/taskEvaluation.test.mjs | cut -c1-2)" = " M"
```

Expected: 18 `OK` lines; the two excluded evaluation paths remain dirty and untouched.

- [ ] **Step 3: Create a root-only recoverable baseline backup**

```bash
set -euo pipefail
cd /opt/thoidai-work
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_root="/opt/thoidai-backups/thoidai-phase1-auth-$stamp"
install -d -m 0700 "$backup_root/source"
cp /opt/thoidai-backups/thoidai-phase1-auth-baseline.sha256 "$backup_root/baseline.sha256"
awk '{print $2}' "$backup_root/baseline.sha256" > "$backup_root/baseline.paths"
while IFS= read -r path; do
  install -D -m 0600 "$path" "$backup_root/source/$path"
done < "$backup_root/baseline.paths"
git status --porcelain=v1 --untracked-files=all > "$backup_root/root-status.txt"
sha256sum "$backup_root/root-status.txt" > "$backup_root/root-status.sha256"
(cd "$backup_root/source" && sha256sum -c "$backup_root/baseline.sha256")
printf '%s\n' "$backup_root" > /opt/thoidai-backups/thoidai-phase1-auth.latest
chmod 0600 /opt/thoidai-backups/thoidai-phase1-auth.latest
printf '%s\n' "$backup_root"
```

Expected: mode 0700 backup root, 18 source files, checksum pass, and no environment/credential file copied. Retain this backup; deleting it requires separate explicit confirmation.

- [ ] **Step 4: Stop for the already-approved source-stabilization authorization**

The source-stabilization approval permits only the manifest above, but execution must still show the owner the staged name/status/checksum evidence immediately before the baseline commit. If approval is not present in the active execution context, stop here. Do not treat this feature plan as new authorization to commit old work.

- [ ] **Step 5: Commit only the canonical baseline after approval**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r backup_root < /opt/thoidai-backups/thoidai-phase1-auth.latest
mapfile -t baseline_paths < "$backup_root/baseline.paths"
test "$(git diff --cached --name-only | wc -l)" -eq 0
git add -- "${baseline_paths[@]}"
test "$(git diff --cached --name-only | wc -l)" -eq 18
diff -u "$backup_root/baseline.paths" <(git diff --cached --name-only | sort)
git diff --cached --check -- "${baseline_paths[@]}"
git commit -m "chore: baseline task authorization dependencies" -- "${baseline_paths[@]}"
git status --porcelain=v1 --untracked-files=all > "$backup_root/post-baseline-status.txt"
sha256sum "$backup_root/post-baseline-status.txt" > "$backup_root/post-baseline-status.sha256"
```

Expected: one baseline-only commit with exactly 18 paths. It must not include a page, `taskEvaluation.*`, backup, mobile file, configuration file, or feature implementation. The post-baseline status manifest becomes the immutable unrelated-dirty-state proof for merge/deploy.

- [ ] **Step 6: Create and verify the isolated worktree**

At execution time invoke `superpowers:using-git-worktrees`, then run:

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r backup_root < /opt/thoidai-backups/thoidai-phase1-auth.latest
test ! -e /opt/thoidai-worktrees/thoidai-phase1-authorization
baseline_commit=$(git rev-parse HEAD)
git worktree add -b feat/thoidai-phase1-authorization /opt/thoidai-worktrees/thoidai-phase1-authorization "$baseline_commit"
cd /opt/thoidai-worktrees/thoidai-phase1-authorization
test -z "$(git status --porcelain=v1 --untracked-files=all)"
sha256sum -c "$backup_root/baseline.sha256"
npm ci
node --test src/lib/sessionToken.test.mjs src/lib/adminPasswordResetRoute.test.mjs
npx tsc --noEmit
```

Expected: clean feature worktree, 18 checksum passes, Node tests pass, and TypeScript exits 0. Do not copy any other dirty-root file into this worktree.

## Task 2: Build a disposable database gate and prove migration-history reconciliation

**Files:**
- Verify: `supabase/migrations/*.sql`
- Verify: `supabase/tests/*.sql`
- No source change

- [ ] **Step 1: Assert prior migration history is reconciled without editing it**

Use the canonical production DB container name only; never inspect its environment:

```bash
set -euo pipefail
cd /opt/thoidai-worktrees/thoidai-phase1-authorization
prod_db=supabase_db_thoidai-work
docker inspect "$prod_db" >/dev/null
missing=(
  20260813172000 20260813210000 20260813220000 20260813230000
  20260813233000 20260813234500 20260814070000 20260814102000
  20260814130000 20260814160000 20260814170000
)
for version in "${missing[@]}"; do
  test "$(docker exec "$prod_db" psql -X -U postgres -d postgres -Atqc "select count(*) from supabase_migrations.schema_migrations where version='$version'")" = "1"
done
```

Expected after the separate reconciliation runbook: all eleven checks equal `1`. Before that external prerequisite is complete, this task must stop here. No `insert`, `update`, `delete`, `supabase migration repair`, or migration-history DDL appears in this plan.

- [ ] **Step 2: Create a retained disposable database from a schema-only snapshot**

```bash
set -euo pipefail
stamp=$(date -u +%Y%m%d_%H%M%S)
suffix=$(openssl rand -hex 4)
test_root="/opt/thoidai-test/phase1-auth-$stamp"
test_db="thoidai_phase1_auth_${stamp}_${suffix}"
[[ "$test_db" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
install -d -m 0700 "$test_root"
for role in anon authenticated service_role; do
  test "$(docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -Atqc "select count(*) from pg_roles where rolname='$role'")" = "1"
done
docker exec supabase_db_thoidai-work pg_dump -X -U postgres -d postgres --schema=public --schema-only --format=custom --no-owner > "$test_root/public-schema.dump"
chmod 0600 "$test_root/public-schema.dump"
pg_restore --list "$test_root/public-schema.dump" >/dev/null
test "$(docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -Atqc "select count(*) from pg_database where datname='$test_db'")" = "0"
docker exec supabase_db_thoidai-work createdb -U postgres --template=template0 "$test_db"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c "create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;"
docker cp "$test_root/public-schema.dump" supabase_db_thoidai-work:/tmp/phase1-public-schema.dump
docker exec supabase_db_thoidai-work pg_restore -U postgres -d "$test_db" --no-owner /tmp/phase1-public-schema.dump
test "$(docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -Atqc "select count(*) from information_schema.tables where table_schema='public'")" -gt 0
test "$(docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -Atqc "select count(*) from public.staff_users")" = "0"
printf '%s\n' "$test_db" > "$test_root/database.name"
printf '%s\n' "$test_root/public-schema.dump" > "$test_root/source-dump.path"
printf '%s\n' "schema-only public restore; retained database" > "$test_root/restore-mode.txt"
printf '%s\n' "$test_root" > /opt/thoidai-test/phase1-auth.latest
chmod 0600 /opt/thoidai-test/phase1-auth.latest "$test_root/database.name" "$test_root/source-dump.path" "$test_root/restore-mode.txt"
```

Expected: a validated, dynamically named database exists inside the already-running `supabase_db_thoidai-work` container; the public schema exists and `staff_users` has zero rows before fixtures. The database, dump, and metadata are retained. This plan never drops the database, stops/removes a container, or deletes its dump; any later deletion requires immediate explicit confirmation.

- [ ] **Step 3: Seed deterministic synthetic authorization fixtures**

Run only against the retained disposable database:

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 <<'SQL'

insert into public.departments(id,code,name,active) values
('10000000-0000-4000-8000-000000000001','test-d1','Test D1',true),
('10000000-0000-4000-8000-000000000002','test-d2','Test D2',true),
('10000000-0000-4000-8000-000000000003','test-d3','Test D3',true),
('10000000-0000-4000-8000-000000000004','test-d4','Test D4',true),
('10000000-0000-4000-8000-000000000005','test-d5','Test D5',true);

insert into public.roles(id,code,name,level) values
('20000000-0000-4000-8000-000000000001','admin','Test Admin',5),
('20000000-0000-4000-8000-000000000002','tong_bien_tap','Test TBT',4),
('20000000-0000-4000-8000-000000000003','tbt_read_only','Test Read Only',0),
('20000000-0000-4000-8000-000000000004','pho_tong_bien_tap','Test Deputy',3),
('20000000-0000-4000-8000-000000000005','phu_trach_phong_tri_su','Test Manager A',3),
('20000000-0000-4000-8000-000000000006','phu_trach_phong_phong_vien','Test Manager B',3),
('20000000-0000-4000-8000-000000000007','phu_trach_phong_bien_tap','Test Manager C',3),
('20000000-0000-4000-8000-000000000008','phong_vien','Test Staff',1);

insert into public.role_permissions(
  role_id,can_manage_users,can_manage_permissions,
  can_create_task,can_edit_all_tasks,can_comment
)
select id,false,false,true,false,true from public.roles;

insert into public.staff_users(
  id,full_name,password,role_id,department_id,active
) values
('30000000-0000-4000-8000-000000000001','Synthetic Admin',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true),
('30000000-0000-4000-8000-000000000002','Synthetic TBT',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',true),
('30000000-0000-4000-8000-000000000003','Synthetic Read Only',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',true),
('30000000-0000-4000-8000-000000000004','Synthetic Manager A',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',true),
('30000000-0000-4000-8000-000000000005','Synthetic Manager B',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002',true),
('30000000-0000-4000-8000-000000000006','Synthetic Manager C',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000003',true),
('30000000-0000-4000-8000-000000000007','Synthetic Staff',
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
 '20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000004',true);

insert into public.tasks(
  id,title,description,status,assignee_id,owner_id,created_by,
  reviewer_id,department_id,due_date,assignment_mode,
  plan_period,self_claimable
) values (
  '40000000-0000-4000-8000-000000000001',
  '__phase1_fixture__','synthetic','in_progress',
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000004',
  current_date,'individual','ad_hoc',false
);
insert into public.task_assignees(task_id,user_id,assignment_role,status)
values(
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000007',
  'owner','in_progress'
);
SQL
```

Expected: `INSERT 0 ...` outputs only for synthetic fixtures; no production row data is present.

- [ ] **Step 4: Record pre-migration disposable invariants**

```bash
set -euo pipefail
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -AtF '|' -c "
select
  (select count(*) from public.roles),
  (select count(*) from public.role_permissions),
  (select count(*) from public.departments),
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='role_permissions'),
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='departments' and column_name='manager_id');" > "$test_root/pre-invariants.txt"
chmod 0600 "$test_root/pre-invariants.txt"
```

Expected: one aggregate-only row; the final field is `0`. No identity or business content is written.

## Task 3: Add the permission and primary-manager schema with SQL TDD

**Files:**
- Create: `supabase/tests/phase1_authorization_facade.sql`
- Create: `supabase/migrations/20260814190000_phase1_authorization_facade.sql`

- [ ] **Step 1: Write the failing schema/backfill/grant test**

Create `supabase/tests/phase1_authorization_facade.sql`:

```sql
\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_tbt record;
  v_read_only record;
  v_bad_managers integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_assign_task' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_assign_task'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_view_department_tasks' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_view_department_tasks'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_evaluate_step1' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_evaluate_step1'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_evaluate_step2' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_evaluate_step2'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_manage_rubrics' and data_type='boolean' and is_nullable='NO'
  ) then raise exception 'missing can_manage_rubrics'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='departments'
      and column_name='manager_id' and data_type='uuid'
  ) then raise exception 'missing departments.manager_id'; end if;

  if exists (
    select 1 from public.roles r
    left join public.role_permissions rp on rp.role_id=r.id
    where rp.role_id is null
  ) then raise exception 'role without permission row'; end if;

  select rp.* into v_tbt
  from public.roles r join public.role_permissions rp on rp.role_id=r.id
  where r.code='tong_bien_tap';
  if not v_tbt.can_comment
     or v_tbt.can_assign_task or v_tbt.can_view_department_tasks
     or v_tbt.can_evaluate_step1 or not v_tbt.can_evaluate_step2
     or v_tbt.can_manage_rubrics then
    raise exception 'TBT must be global-view/comment plus step2-only';
  end if;

  select rp.* into v_read_only
  from public.roles r join public.role_permissions rp on rp.role_id=r.id
  where r.code='tbt_read_only';
  if v_read_only.can_comment
     or v_read_only.can_assign_task or v_read_only.can_view_department_tasks
     or v_read_only.can_evaluate_step1 or v_read_only.can_evaluate_step2
     or v_read_only.can_manage_rubrics then
    raise exception 'tbt_read_only must remain compatibility read-only';
  end if;

  select count(*) into v_bad_managers
  from public.departments d
  join public.staff_users u on u.id=d.manager_id
  where u.department_id<>d.id or not u.active;
  if v_bad_managers<>0 then raise exception 'invalid primary manager'; end if;

  if not has_table_privilege('anon','public.tasks','SELECT') then
    raise exception 'Phase 1 must preserve anon compatibility';
  end if;
end
$test$;

rollback;
```

- [ ] **Step 2: Run the SQL test to verify it fails**

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker cp supabase/tests/phase1_authorization_facade.sql supabase_db_thoidai-work:/tmp/phase1_authorization_facade.sql
if docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/phase1_authorization_facade.sql; then
  echo "expected pre-migration SQL failure" >&2
  exit 1
fi
```

Expected: non-zero with `missing can_assign_task`; no transaction remains open.

- [ ] **Step 3: Write the additive schema and deterministic backfill**

Create the first section of `supabase/migrations/20260814190000_phase1_authorization_facade.sql`. The file intentionally has no `begin`/`commit`; every apply command in this plan uses `psql --single-transaction -v ON_ERROR_STOP=1`.

```sql
alter table public.role_permissions
  add column if not exists can_assign_task boolean not null default false,
  add column if not exists can_view_department_tasks boolean not null default false,
  add column if not exists can_evaluate_step1 boolean not null default false,
  add column if not exists can_evaluate_step2 boolean not null default false,
  add column if not exists can_manage_rubrics boolean not null default false;

alter table public.departments
  add column if not exists manager_id uuid
    references public.staff_users(id) on delete set null;

create index if not exists idx_departments_manager_id
  on public.departments(manager_id)
  where manager_id is not null;

create or replace function public.validate_department_manager()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $function$
begin
  if new.manager_id is not null and not exists (
    select 1
    from public.staff_users u
    where u.id=new.manager_id
      and u.department_id=new.id
      and u.active=true
  ) then
    raise exception 'Primary manager must be active and belong to the department.'
      using errcode='23514';
  end if;
  return new;
end
$function$;

drop trigger if exists validate_department_manager on public.departments;
create trigger validate_department_manager
before insert or update of manager_id on public.departments
for each row execute function public.validate_department_manager();

insert into public.role_permissions(role_id)
select id from public.roles
on conflict (role_id) do nothing;

update public.role_permissions rp
set can_comment = case
      when r.code='tong_bien_tap' then true
      when r.code='tbt_read_only' then false
      else rp.can_comment
    end,
    can_assign_task = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_view_department_tasks = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_evaluate_step1 = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_evaluate_step2 = r.code='tong_bien_tap',
    can_manage_rubrics = r.code='admin',
    updated_at=now()
from public.roles r
where r.id=rp.role_id;

with eligible as (
  select d.id as department_id,
         (array_agg(u.id order by u.id))[1] as manager_id
  from public.departments d
  join public.staff_users u on u.department_id=d.id and u.active=true
  join public.roles r on r.id=u.role_id
  where d.active=true
    and r.code in (
      'phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien',
      'phu_trach_phong_bien_tap'
    )
  group by d.id
  having count(*)=1
)
update public.departments d
set manager_id=e.manager_id
from eligible e
where d.id=e.department_id
  and d.manager_id is null;
```

- [ ] **Step 4: Apply once to the disposable DB and verify the schema test passes**

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker cp supabase/migrations/20260814190000_phase1_authorization_facade.sql supabase_db_thoidai-work:/tmp/phase1.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" --single-transaction -v ON_ERROR_STOP=1 -f /tmp/phase1.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/phase1_authorization_facade.sql
```

Expected: migration exits 0; SQL test ends with `ROLLBACK` and exit 0.

- [ ] **Step 5: Apply the same file a second time and check invariants**

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" --single-transaction -v ON_ERROR_STOP=1 -f /tmp/phase1.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -AtF '|' -c "
select
  (select count(*) from public.roles),
  (select count(*) from public.role_permissions),
  (select count(*) from public.departments),
  (select count(*) from public.departments where active and manager_id is null),
  (select count(*) from public.departments d join public.staff_users u on u.id=d.manager_id
    where u.department_id<>d.id or not u.active);"
```

Expected: second apply exits 0; role and department counts are unchanged; invalid-manager count is `0`. On the production-shaped snapshot, exactly two active departments remain without a manager; log only that aggregate.

- [ ] **Step 6: Commit the schema and failing-then-passing test**

```bash
git add -- supabase/migrations/20260814190000_phase1_authorization_facade.sql supabase/tests/phase1_authorization_facade.sql
git diff --cached --check
git commit -m "feat(db): add phase one authorization fields" -- supabase/migrations/20260814190000_phase1_authorization_facade.sql supabase/tests/phase1_authorization_facade.sql
```

Expected: exactly two paths in the commit.

## Task 4: Extend the canonical server-session permission contract with TDD

**Files:**
- Create: `src/lib/permissions.ts`
- Create: `src/lib/authorization.test.mjs`
- Modify: `src/lib/serverSession.ts:13-22,38-70`

- [ ] **Step 1: Write the failing permission-normalization and session-source tests**

Create `src/lib/authorization.test.mjs` with this initial content:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PERMISSION_KEYS,
  normalizePermissions,
} from "./permissions.ts";

test("permission normalization returns the complete stable contract", () => {
  const permissions = normalizePermissions({
    can_assign_task: true,
    can_evaluate_step2: 1,
  });

  assert.deepEqual(Object.keys(permissions), [...PERMISSION_KEYS]);
  assert.equal(permissions.can_assign_task, true);
  assert.equal(permissions.can_evaluate_step2, false);
  assert.equal(permissions.can_manage_rubrics, false);
  assert.equal(permissions.can_manage_users, false);
});

test("server session selects role level, department and every new permission", () => {
  const source = readFileSync(
    new URL("./serverSession.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /department_id/);
  assert.match(source, /department_id:\s*string\s*\|\s*null/);
  assert.doesNotMatch(source, /!row\.department_id/);
  assert.match(source, /role_level/);
  for (const key of [
    "can_assign_task",
    "can_view_department_tasks",
    "can_evaluate_step1",
    "can_evaluate_step2",
    "can_manage_rubrics",
  ]) {
    assert.match(source, new RegExp(key));
  }
  assert.match(source, /session\.sessionVersion\s*!==\s*row\.session_version/);
  assert.match(source, /normalizePermissions/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test src/lib/authorization.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `permissions.ts`.

- [ ] **Step 3: Add the complete canonical permission type**

Create `src/lib/permissions.ts`:

```typescript
export const PERMISSION_KEYS = [
  "can_manage_users",
  "can_manage_permissions",
  "can_create_task",
  "can_edit_all_tasks",
  "can_comment",
  "can_assign_task",
  "can_view_department_tasks",
  "can_evaluate_step1",
  "can_evaluate_step2",
  "can_manage_rubrics",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionSet = Record<PermissionKey, boolean>;

export function normalizePermissions(
  value: Partial<Record<PermissionKey, unknown>> | null | undefined,
): PermissionSet {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, value?.[key] === true]),
  ) as PermissionSet;
}
```

- [ ] **Step 4: Extend `ServerAuthUser` without touching token or cookie logic**

In `src/lib/serverSession.ts`, import the permission type/helper and replace only the user DTO/query mapping:

```typescript
import {
  normalizePermissions,
  type PermissionSet,
} from "@/lib/permissions";

export type ServerAuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  department_id: string | null;
  role_code: string;
  role_name: string;
  role_level: number;
  active: boolean;
  permissions: PermissionSet;
};

export async function getSessionUser(): Promise<ServerAuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const { data, error } = await serverSupabase
    .from("staff_users")
    .select(
      "id,full_name,email,username,department_id,active,session_version," +
      "roles(code,name,level,role_permissions(" +
      "can_manage_users,can_manage_permissions,can_create_task," +
      "can_edit_all_tasks,can_comment,can_assign_task," +
      "can_view_department_tasks,can_evaluate_step1," +
      "can_evaluate_step2,can_manage_rubrics))",
    )
    .eq("id", session.userId)
    .eq("active", true)
    .single();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    full_name: string;
    email: string | null;
    username: string | null;
    department_id: string | null;
    active: boolean;
    session_version: number;
    roles: {
      code: string;
      name: string;
      level: number;
      role_permissions: Partial<PermissionSet> | null;
    } | null;
  };
  if (session.sessionVersion !== row.session_version) return null;
  if (!row.roles) return null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    username: row.username,
    department_id: row.department_id,
    role_code: row.roles.code,
    role_name: row.roles.name,
    role_level: row.roles.level,
    active: row.active,
    permissions: normalizePermissions(row.roles.role_permissions),
  };
}
```

Do not change `secret()`, `createSessionToken`, `verifySessionToken`, `SESSION_COOKIE`, `isSameOriginRequest`, or `sessionCookieOptions`.

- [ ] **Step 5: Run the contract and password/session regressions**

```bash
node --test src/lib/authorization.test.mjs src/lib/sessionToken.test.mjs src/lib/adminPasswordReset.test.mjs src/lib/adminPasswordResetRoute.test.mjs src/lib/loginLegacyUpgrade.test.mjs
npx tsc --noEmit
```

Expected: all selected Node tests pass; TypeScript exits 0. The known module-type warning is non-fatal.

- [ ] **Step 6: Commit only the permission/session contract**

```bash
git add -- src/lib/permissions.ts src/lib/authorization.test.mjs src/lib/serverSession.ts
git diff --cached --check
git commit -m "feat(auth): expose canonical task permissions" -- src/lib/permissions.ts src/lib/authorization.test.mjs src/lib/serverSession.ts
```

Expected: exactly three paths.

## Task 5: Implement the pure task/evaluation authorization evaluator with TDD

**Files:**
- Create: `src/lib/authorization.ts`
- Modify: `src/lib/authorization.test.mjs`

- [ ] **Step 1: Append the exhaustive failing authorization matrix**

Append to `src/lib/authorization.test.mjs`:

```javascript
import {
  canAssignToDepartment,
  canEvaluationAction,
  canTaskAction,
} from "./authorization.ts";

const actor = (
  overrides = {},
) => ({
  id: "actor",
  departmentId: "dep-a",
  roleCode: "phong_vien",
  roleLevel: 1,
  permissions: normalizePermissions({ can_comment: true }),
  ...overrides,
});

const task = (
  overrides = {},
) => ({
  id: "task",
  departmentId: "dep-a",
  createdBy: "creator",
  ownerId: "owner",
  assigneeId: "assignee",
  reviewerId: "reviewer",
  selfClaimable: false,
  status: "in_progress",
  participants: [
    { userId: "assignee", assignmentRole: "assignee" },
    { userId: "watcher", assignmentRole: "watcher" },
  ],
  ...overrides,
});

test("related actors and scoped managers can view; unrelated staff cannot", () => {
  assert.equal(canTaskAction(actor({ id: "assignee" }), task(), "view"), true);
  assert.equal(canTaskAction(actor({ id: "watcher" }), task(), "view"), true);
  assert.equal(canTaskAction(actor({ id: "creator" }), task(), "view"), true);
  assert.equal(canTaskAction(actor({ id: "other" }), task(), "view"), false);
  assert.equal(canTaskAction(actor({
    id: "manager",
    permissions: normalizePermissions({
      can_view_department_tasks: true,
      can_comment: true,
    }),
  }), task(), "view"), true);
  assert.equal(canTaskAction(actor({
    id: "manager",
    departmentId: "dep-b",
    permissions: normalizePermissions({
      can_view_department_tasks: true,
      can_comment: true,
    }),
  }), task(), "view"), false);
});

test("TBT can view and comment organization-wide but cannot use other task mutations", () => {
  const tbt = actor({
    roleCode: "tong_bien_tap",
    roleLevel: 4,
    permissions: normalizePermissions({
      can_comment: true,
      can_evaluate_step2: true,
    }),
  });
  assert.equal(canTaskAction(tbt, task({ departmentId: "dep-z" }), "view"), true);
  assert.equal(canTaskAction(tbt, task({ departmentId: "dep-z" }), "comment"), true);
  assert.equal(canTaskAction(actor({
    roleCode: "tong_bien_tap",
    roleLevel: 4,
    permissions: normalizePermissions({ can_evaluate_step2: true }),
  }), task({ departmentId: "dep-z" }), "comment"), false);
  for (const action of [
    "assign", "update", "claim", "report",
    "review", "legacy_evaluate",
  ]) {
    assert.equal(canTaskAction(tbt, task(), action), false, action);
  }
});

test("compatibility tbt_read_only can view globally and mutate nothing", () => {
  const readOnly = actor({ roleCode: "tbt_read_only", roleLevel: 0 });
  assert.equal(canTaskAction(readOnly, task({ departmentId: "dep-z" }), "view"), true);
  assert.equal(canTaskAction(readOnly, task(), "comment"), false);
  assert.equal(canEvaluationAction(readOnly, {
    action: "step2",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), false);
});

test("assign, report, review, update and comment require explicit permission plus relationship", () => {
  const manager = actor({
    id: "manager",
    permissions: normalizePermissions({
      can_assign_task: true,
      can_view_department_tasks: true,
      can_evaluate_step1: true,
      can_comment: true,
    }),
  });
  assert.equal(canAssignToDepartment(manager, "dep-a"), true);
  assert.equal(canAssignToDepartment(manager, "dep-b"), false);
  assert.equal(canAssignToDepartment(actor({
    roleCode: "pho_tong_bien_tap",
    permissions: normalizePermissions({ can_assign_task: true }),
  }), "dep-b"), true);
  assert.equal(canTaskAction(manager, task(), "update"), true);
  assert.equal(canTaskAction(actor({ id: "assignee" }), task(), "report"), true);
  assert.equal(canTaskAction(actor({ id: "watcher" }), task(), "report"), false);
  assert.equal(canTaskAction(manager, task({ reviewerId: "manager" }), "review"), true);
  assert.equal(canTaskAction(manager, task({ reviewerId: "other" }), "review"), false);
  assert.equal(canTaskAction(actor({ id: "watcher" }), task(), "comment"), true);
  assert.equal(canTaskAction(actor({ id: "other" }), task(), "comment"), false);
});

test("null departments never create same-department authority", () => {
  const manager = actor({
    departmentId: null,
    permissions: normalizePermissions({
      can_assign_task: true,
      can_view_department_tasks: true,
      can_evaluate_step1: true,
    }),
  });
  assert.equal(canAssignToDepartment(manager, null), false);
  assert.equal(canTaskAction(manager, task({ departmentId: null }), "view"), false);
  assert.equal(canEvaluationAction(manager, {
    action: "step1",
    employeeId: "employee",
    employeeDepartmentId: null,
    managerId: "actor",
  }), false);
});

test("claim requires an available self-claimable task", () => {
  const staff = actor({ id: "staff" });
  assert.equal(canTaskAction(staff, task({
    selfClaimable: true,
    assigneeId: null,
    status: "new",
  }), "claim"), true);
  assert.equal(canTaskAction(staff, task({
    selfClaimable: false,
    assigneeId: null,
    status: "new",
  }), "claim"), false);
  assert.equal(canTaskAction(staff, task({
    selfClaimable: true,
    assigneeId: "other",
    status: "new",
  }), "claim"), false);
});

test("step1 follows primary-manager relationship and step2 is TBT-only", () => {
  const manager = actor({
    id: "manager",
    permissions: normalizePermissions({ can_evaluate_step1: true }),
  });
  assert.equal(canEvaluationAction(manager, {
    action: "step1",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), true);
  assert.equal(canEvaluationAction(manager, {
    action: "step1",
    employeeId: "manager",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), false);

  const tbt = actor({
    roleCode: "tong_bien_tap",
    permissions: normalizePermissions({ can_evaluate_step2: true }),
  });
  assert.equal(canEvaluationAction(tbt, {
    action: "step2",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), true);
  assert.equal(canEvaluationAction(manager, {
    action: "step2",
    employeeId: "employee",
    employeeDepartmentId: "dep-a",
    managerId: "manager",
  }), false);
});

test("only an explicitly permitted Admin manages shared rubrics", () => {
  assert.equal(canEvaluationAction(actor({
    roleCode: "admin",
    permissions: normalizePermissions({ can_manage_rubrics: true }),
  }), { action: "manage_rubrics" }), true);
  assert.equal(canEvaluationAction(actor({
    roleCode: "tong_bien_tap",
    permissions: normalizePermissions({
      can_evaluate_step2: true,
      can_manage_rubrics: true,
    }),
  }), { action: "manage_rubrics" }), false);
});
```

- [ ] **Step 2: Run the evaluator test to verify it fails**

```bash
node --test src/lib/authorization.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `authorization.ts`.

- [ ] **Step 3: Implement the complete pure evaluator**

Create `src/lib/authorization.ts`:

```typescript
import type { PermissionSet } from "./permissions";

export type AuthorizationActor = {
  id: string;
  departmentId: string | null;
  roleCode: string;
  roleLevel: number;
  permissions: PermissionSet;
};

export type TaskParticipant = {
  userId: string;
  assignmentRole: "owner" | "assignee" | "watcher";
};

export type TaskAccessSnapshot = {
  id: string;
  departmentId: string | null;
  createdBy: string | null;
  ownerId: string | null;
  assigneeId: string | null;
  reviewerId: string | null;
  selfClaimable: boolean;
  status: string;
  participants: TaskParticipant[];
};

export type TaskAction =
  | "view"
  | "assign"
  | "update"
  | "claim"
  | "report"
  | "review"
  | "comment"
  | "legacy_evaluate";

export type EvaluationDecision =
  | {
      action: "step1" | "step2";
      employeeId: string;
      employeeDepartmentId: string | null;
      managerId: string | null;
    }
  | { action: "manage_rubrics" };

const TASK_READ_ONLY_ROLES = new Set([
  "tong_bien_tap",
  "tbt_read_only",
]);
const ORGANIZATION_VIEW_ROLES = new Set([
  "admin",
  "tong_bien_tap",
  "tbt_read_only",
]);

export const hasOrganizationTaskView = (
  actor: AuthorizationActor,
) => ORGANIZATION_VIEW_ROLES.has(actor.roleCode);

const isParticipant = (
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
  includeWatcher = true,
) => task.participants.some(
  (participant) =>
    participant.userId === actor.id
    && (includeWatcher || participant.assignmentRole !== "watcher"),
);

const isRelated = (
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
) => [
  task.createdBy,
  task.ownerId,
  task.assigneeId,
  task.reviewerId,
].includes(actor.id) || isParticipant(actor, task);

const sameDepartment = (
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
) => actor.departmentId !== null
  && task.departmentId !== null
  && actor.departmentId === task.departmentId;

export function canAssignToDepartment(
  actor: AuthorizationActor,
  departmentId: string | null,
): boolean {
  if (TASK_READ_ONLY_ROLES.has(actor.roleCode)) return false;
  if (!actor.permissions.can_assign_task) return false;
  return actor.roleCode === "admin"
    || actor.roleCode === "pho_tong_bien_tap"
    || (
      actor.departmentId !== null
      && departmentId !== null
      && departmentId === actor.departmentId
    );
}

export function canTaskAction(
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
  action: TaskAction,
): boolean {
  if (action === "view") {
    return hasOrganizationTaskView(actor)
      || isRelated(actor, task)
      || (
        actor.permissions.can_view_department_tasks
        && sameDepartment(actor, task)
      );
  }

  if (actor.roleCode === "tbt_read_only") return false;
  if (actor.roleCode === "tong_bien_tap" && action !== "comment") {
    return false;
  }

  switch (action) {
    case "assign":
      return canAssignToDepartment(actor, task.departmentId);
    case "update":
      return actor.roleCode === "admin"
        || task.createdBy === actor.id
        || (
          actor.permissions.can_assign_task
          && sameDepartment(actor, task)
        );
    case "claim":
      return task.selfClaimable
        && task.status === "new"
        && task.assigneeId === null;
    case "report":
      return actor.roleCode === "admin"
        || task.ownerId === actor.id
        || task.assigneeId === actor.id
        || isParticipant(actor, task, false);
    case "review":
      return actor.roleCode === "admin"
        || task.createdBy === actor.id
        || (
          task.reviewerId === actor.id
          && actor.permissions.can_assign_task
        );
    case "comment":
      return actor.permissions.can_comment
        && canTaskAction(actor, task, "view");
    case "legacy_evaluate":
      return actor.roleCode === "admin"
        || (
          actor.permissions.can_evaluate_step1
          && (
            task.createdBy === actor.id
            || task.reviewerId === actor.id
          )
        );
  }
}

export function canEvaluationAction(
  actor: AuthorizationActor,
  decision: EvaluationDecision,
): boolean {
  if (decision.action === "manage_rubrics") {
    return actor.roleCode === "admin"
      && actor.permissions.can_manage_rubrics;
  }

  if (decision.action === "step2") {
    return actor.roleCode === "tong_bien_tap"
      && actor.permissions.can_evaluate_step2;
  }

  return actor.permissions.can_evaluate_step1
    && actor.id !== decision.employeeId
    && actor.id === decision.managerId
    && actor.departmentId !== null
    && decision.employeeDepartmentId !== null
    && actor.departmentId === decision.employeeDepartmentId;
}
```

- [ ] **Step 4: Run the pure matrix and TypeScript**

```bash
node --test src/lib/authorization.test.mjs
npx tsc --noEmit
```

Expected: all authorization tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit only the pure authorization unit**

```bash
git add -- src/lib/authorization.ts src/lib/authorization.test.mjs
git diff --cached --check
git commit -m "feat(auth): centralize task authorization decisions" -- src/lib/authorization.ts src/lib/authorization.test.mjs
```

Expected: exactly two paths.

## Task 6: Add shared server API guards and safe error mapping with TDD

**Files:**
- Create: `src/lib/apiResponse.ts`
- Create: `src/lib/apiResponse.test.mjs`
- Create: `src/lib/serverApi.ts`
- Create: `src/lib/serverApiSource.test.mjs`

- [ ] **Step 1: Write the failing source-contract test**

Create `src/lib/serverApiSource.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./serverApi.ts", import.meta.url),
  "utf8",
);
const responseSource = readFileSync(
  new URL("./apiResponse.ts", import.meta.url),
  "utf8",
);

test("mutation guard checks origin before signed session", () => {
  const mutationSource = source.slice(
    source.indexOf("export async function requireMutationActor"),
  );
  const originIndex = mutationSource.indexOf("isSameOriginRequest()");
  const sessionIndex = mutationSource.indexOf("getSessionUser()");
  assert.ok(originIndex >= 0);
  assert.ok(sessionIndex > originIndex);
  assert.match(source, /invalid_origin/);
  assert.match(source, /unauthenticated/);
});

test("API responses are private no-store and errors are stable", () => {
  assert.match(responseSource, /private, no-store/);
  for (const code of [
    "invalid_origin",
    "unauthenticated",
    "forbidden",
    "invalid_request",
    "not_found",
    "conflict",
    "operation_failed",
  ]) {
    assert.match(`${source}\n${responseSource}`, new RegExp(code));
  }
  assert.doesNotMatch(`${source}\n${responseSource}`, /error\.message/);
  assert.doesNotMatch(`${source}\n${responseSource}`, /console\.(?:log|warn|error)/);
});

test("server API has no unrelated UUID or authorization imports", () => {
  assert.doesNotMatch(source, /randomUUID|canAssignToDepartment|canTaskAction/);
});

test("UUID validation is centralized", () => {
  assert.match(source, /UUID_PATTERN/);
  assert.match(source, /export function asUuid/);
});
```

Create `src/lib/apiResponse.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { apiError, apiJson } from "./apiResponse.ts";

test("JSON responses are private no-store at runtime", async () => {
  const response = apiJson({ ok: true });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("cache-control") ?? "",
    /private, no-store/,
  );
  assert.deepEqual(await response.json(), { ok: true });
});

test("stable errors inherit private no-store headers", async () => {
  const response = apiError("forbidden", 403);
  assert.equal(response.status, 403);
  assert.match(
    response.headers.get("cache-control") ?? "",
    /private, no-store/,
  );
  assert.deepEqual(await response.json(), { error: { code: "forbidden" } });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test src/lib/apiResponse.test.mjs src/lib/serverApiSource.test.mjs
```

Expected: FAIL because `serverApi.ts` and `apiResponse.ts` do not exist.

- [ ] **Step 3: Implement the pure response helper and complete guard/error helper**

Create `src/lib/apiResponse.ts`:

```typescript
export type ApiErrorCode =
  | "invalid_origin"
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "operation_failed";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function apiJson(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function apiError(
  code: ApiErrorCode,
  status: number,
): Response {
  return apiJson({ error: { code } }, status);
}
```

Create `src/lib/serverApi.ts`:

```typescript
import "server-only";

import {
  apiError,
  apiJson,
  type ApiErrorCode,
} from "@/lib/apiResponse";
import {
  getSessionUser,
  isSameOriginRequest,
  type ServerAuthUser,
} from "@/lib/serverSession";

export { apiError, apiJson, type ApiErrorCode };

export type ActorGuard =
  | { ok: true; actor: ServerAuthUser }
  | { ok: false; response: Response };

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : null;
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

export async function requireReadActor(): Promise<ActorGuard> {
  const actor = await getSessionUser();
  return actor
    ? { ok: true, actor }
    : { ok: false, response: apiError("unauthenticated", 401) };
}

export async function requireMutationActor(): Promise<ActorGuard> {
  if (!(await isSameOriginRequest())) {
    return { ok: false, response: apiError("invalid_origin", 403) };
  }
  const actor = await getSessionUser();
  return actor
    ? { ok: true, actor }
    : { ok: false, response: apiError("unauthenticated", 401) };
}

export function rpcFailure(error: { code?: string | null }): Response {
  switch (error.code) {
    case "42501":
      return apiError("forbidden", 403);
    case "P0002":
      return apiError("not_found", 404);
    case "22023":
    case "22007":
    case "23514":
      return apiError("invalid_request", 400);
    case "23505":
    case "40001":
      return apiError("conflict", 409);
    default:
      return apiError("operation_failed", 500);
  }
}
```

- [ ] **Step 4: Run the source contract and TypeScript**

```bash
node --test src/lib/apiResponse.test.mjs src/lib/serverApiSource.test.mjs
npx tsc --noEmit
```

Expected: source-contract tests pass; TypeScript exits 0.

- [ ] **Step 5: Commit the shared guard**

```bash
git add -- src/lib/apiResponse.ts src/lib/apiResponse.test.mjs src/lib/serverApi.ts src/lib/serverApiSource.test.mjs
git diff --cached --check
git commit -m "feat(api): centralize private session and origin responses" -- src/lib/apiResponse.ts src/lib/apiResponse.test.mjs src/lib/serverApi.ts src/lib/serverApiSource.test.mjs
```

Expected: exactly four paths.

## Task 7: Move the existing permission API onto the canonical contract

**Files:**
- Create: `src/lib/serverAudit.ts`
- Modify: `src/app/api/permissions/route.ts:1-109`
- Modify: `src/lib/serverApiSource.test.mjs`

- [ ] **Step 1: Append a failing source contract for the permission route**

Append to `src/lib/serverApiSource.test.mjs`:

```javascript
const permissionsRoute = readFileSync(
  new URL("../app/api/permissions/route.ts", import.meta.url),
  "utf8",
);

test("permission API is Admin-only and exposes the five Phase-1 fields", () => {
  assert.match(permissionsRoute, /actor\.role_code\s*!==\s*["']admin["']/);
  assert.match(permissionsRoute, /PERMISSION_KEYS/);
  for (const key of [
    "can_assign_task",
    "can_view_department_tasks",
    "can_evaluate_step1",
    "can_evaluate_step2",
    "can_manage_rubrics",
  ]) {
    assert.match(permissionsRoute, new RegExp(key));
  }
  assert.match(permissionsRoute, /requireReadActor/);
  assert.match(permissionsRoute, /requireMutationActor/);
  assert.doesNotMatch(permissionsRoute, /\["admin",\s*"tong_bien_tap"/);
  assert.match(permissionsRoute, /logServerAudit/);
  assert.doesNotMatch(permissionsRoute, /services\/audit/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test src/lib/serverApiSource.test.mjs
```

Expected: FAIL because the route uses hard-coded old keys, allows TBT roles to read configuration, and imports the browser audit service.

- [ ] **Step 3: Add the service-role server audit writer**

Create `src/lib/serverAudit.ts`:

```typescript
import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type ServerAuditInput = {
  actorId: string;
  module: "admin" | "task" | "performance";
  entityType: string;
  entityId?: string | null;
  action: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function logServerAudit(
  input: ServerAuditInput,
): Promise<void> {
  const { error } = await serverSupabase.from("audit_logs").insert({
    actor_id: input.actorId,
    module: input.module,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
  });
  if (error) throw new Error("server_audit_failed");
}
```

- [ ] **Step 4: Refactor the permission route**

Replace the imports, response helper, row type, GET guard/select, and permission-key declaration in `src/app/api/permissions/route.ts` with:

```typescript
import { serverSupabase } from "@/lib/serverSupabase";
import { PERMISSION_KEYS, type PermissionSet } from "@/lib/permissions";
import {
  apiError,
  apiJson,
  readJsonObject,
  requireMutationActor,
  requireReadActor,
  rpcFailure,
} from "@/lib/serverApi";
import { logServerAudit } from "@/lib/serverAudit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PermissionRow = PermissionSet & {
  role_id: string;
  roles: {
    id: string;
    code: string;
    name: string;
    level: number;
  } | null;
};

const SELECT_FIELDS = [
  "role_id",
  ...PERMISSION_KEYS,
  "roles(id,code,name,level)",
].join(",");

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }
  const { data, error } = await serverSupabase
    .from("role_permissions")
    .select(SELECT_FIELDS)
    .order("role_id");
  if (error) return rpcFailure(error);
  return apiJson({
    permissions: (data ?? []) as unknown as PermissionRow[],
    can_rename: true,
  });
}

const text = (value: unknown) => typeof value === "string"
  ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
  : "";
```

Replace `PATCH` with the same current rename/update behavior but use the shared guard and stable keys:

```typescript
export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }

  const body = await readJsonObject(request);
  const roleId = text(body?.role_id);
  const name = text(body?.name);
  if (!roleId) return apiError("invalid_request", 400);

  const permission = typeof body?.permission === "string"
    ? body.permission
    : "";
  if (permission) {
    if (
      name
      || !PERMISSION_KEYS.includes(
        permission as (typeof PERMISSION_KEYS)[number],
      )
      || typeof body?.value !== "boolean"
    ) {
      return apiError("invalid_request", 400);
    }
    const { data: current, error: currentError } = await serverSupabase
      .from("role_permissions")
      .select(`role_id,${permission}`)
      .eq("role_id", roleId)
      .maybeSingle();
    if (currentError) return rpcFailure(currentError);
    if (!current) return apiError("not_found", 404);

    const value = body.value;
    const { error } = await serverSupabase
      .from("role_permissions")
      .update({ [permission]: value, updated_at: new Date().toISOString() })
      .eq("role_id", roleId);
    if (error) return rpcFailure(error);

    await logServerAudit({
      actorId: guard.actor.id,
      module: "admin",
      entityType: "role_permissions",
      entityId: roleId,
      action: "update",
      oldData: {
        [permission]:
          (current as unknown as Record<string, unknown>)[permission],
      },
      newData: { [permission]: value },
    });
    return apiJson({
      permission: { role_id: roleId, field: permission, value },
    });
  }

  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 120) {
    return apiError("invalid_request", 400);
  }
  const { data: before, error: beforeError } = await serverSupabase
    .from("roles")
    .select("id,code,name,level")
    .eq("id", roleId)
    .maybeSingle();
  if (beforeError) return rpcFailure(beforeError);
  if (!before) return apiError("not_found", 404);

  const { data, error } = await serverSupabase
    .from("roles")
    .update({ name })
    .eq("id", roleId)
    .select("id,code,name,level")
    .maybeSingle();
  if (error) return rpcFailure(error);
  if (!data) return apiError("not_found", 404);

  await logServerAudit({
    actorId: guard.actor.id,
    module: "admin",
    entityType: "role",
    entityId: data.id,
    action: "update",
    oldData: { name: before.name },
    newData: { name: data.name },
  });
  return apiJson({ role: data });
}
```

Do not touch `src/app/permissions/page.tsx`; Phase 2 will consume the expanded DTO.

- [ ] **Step 5: Run source, TypeScript, and existing permission-adjacent regressions**

```bash
node --test src/lib/serverApiSource.test.mjs src/lib/authorization.test.mjs src/lib/adminPasswordResetRoute.test.mjs
npx tsc --noEmit
```

Expected: tests pass; TypeScript exits 0.

- [ ] **Step 6: Commit only the permission API**

```bash
git add -- src/lib/serverAudit.ts src/app/api/permissions/route.ts src/lib/serverApiSource.test.mjs
git diff --cached --check
git commit -m "feat(api): expose phase one role permissions" -- src/lib/serverAudit.ts src/app/api/permissions/route.ts src/lib/serverApiSource.test.mjs
```

Expected: exactly three paths: the permission route, server audit writer, and source-contract test.

## Task 8: Define task façade contracts and service-role repository

**Files:**
- Create: `src/lib/taskContracts.ts`
- Create: `src/lib/taskRepository.ts`
- Create: `src/lib/taskHandlers.test.mjs`

- [ ] **Step 1: Write the failing repository source contract**

Create `src/lib/taskHandlers.test.mjs` with:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositorySource = readFileSync(
  new URL("./taskRepository.ts", import.meta.url),
  "utf8",
);

test("task repository is server-only and uses the service-role client", () => {
  assert.match(repositorySource, /import "server-only"/);
  assert.match(repositorySource, /serverSupabase/);
  assert.doesNotMatch(repositorySource, /from ["']@\/lib\/supabase["']/);
  assert.doesNotMatch(repositorySource, /select\(["']\*["']/);
});

test("task repository calls only Phase-1 wrapper RPCs for mutations", () => {
  for (const rpc of [
    "api_create_task",
    "api_update_task",
    "api_claim_task_plan",
    "api_report_task_progress",
    "api_review_task_completion",
    "api_save_task_evaluation_checkpoint",
    "api_add_task_comment",
    "api_create_bulk_task_plan",
  ]) {
    assert.match(repositorySource, new RegExp(rpc));
  }
  assert.doesNotMatch(
    repositorySource,
    /\.rpc\(["'](?:claim_task_plan|report_task_progress|review_task_completion|save_task_evaluation_checkpoint|create_bulk_task_plan)["']/,
  );
});

test("task repository selects allowlisted fields and paginates", () => {
  assert.match(repositorySource, /TASK_LIST_FIELDS/);
  assert.match(repositorySource, /TASK_DETAIL_FIELDS/);
  assert.match(repositorySource, /\.range\(from, to\)/);
  assert.match(repositorySource, /task_assignees/);
  assert.match(repositorySource, /task_comments/);
  assert.match(repositorySource, /task_progress_logs/);
  assert.match(repositorySource, /task_evaluation_checkpoints/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test src/lib/taskHandlers.test.mjs
```

Expected: FAIL because `taskRepository.ts` does not exist.

- [ ] **Step 3: Add complete request, DTO, and repository interfaces**

Create `src/lib/taskContracts.ts`:

```typescript
import type { AuthorizationActor, TaskAccessSnapshot } from "./authorization";

export type AssignmentRole = "owner" | "assignee" | "watcher";
export type LegacyTaskStatus =
  | "new"
  | "in_progress"
  | "pending_review"
  | "done"
  | "rejected";

export type TaskParticipantDto = {
  user_id: string;
  assignment_role: AssignmentRole;
  status: string;
  staff_users: { full_name: string | null } | null;
};

export type TaskListItemDto = {
  id: string;
  title: string;
  status: LegacyTaskStatus;
  progress_percent: number;
  due_date: string | null;
  assignee_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  reviewer_id: string | null;
  department_id: string | null;
  assignment_mode: string;
  plan_period: string;
  self_claimable: boolean;
  departments: { name: string } | null;
  task_assignees: TaskParticipantDto[];
};

export type TaskCommentDto = {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  staff_users: { full_name: string | null } | null;
};

export type TaskProgressLogDto = {
  id: string;
  old_progress: number | null;
  new_progress: number;
  note: string | null;
  created_at: string;
  user_id: string | null;
  staff_users: { full_name: string | null } | null;
};

export type LegacyEvaluationDto = {
  id: string;
  task_id: string;
  employee_id: string;
  reviewer_id: string | null;
  rating: number;
  effort_weight: number;
  total_score: number | null;
  completion: string;
  on_time: boolean;
  opinion: string | null;
  checkpoint_date: string;
  is_final: boolean;
  created_at: string;
};

export type TaskDetailDto = TaskListItemDto & {
  description: string | null;
  attachment_url: string | null;
  effort_weight: number | null;
  owner: { full_name: string | null } | null;
  reviewer: { full_name: string | null } | null;
  comments: TaskCommentDto[];
  progress_logs: TaskProgressLogDto[];
  legacy_evaluations: LegacyEvaluationDto[];
};

export type TaskListQuery = {
  status: string | null;
  search: string | null;
  page: number;
  pageSize: number;
};

export type TaskListResult = {
  items: TaskListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type LegacyCreateTaskInput = {
  title: string;
  description: string;
  departmentId: string | null;
  assigneeId: string;
  reviewerId: string;
  assignmentMode: "individual" | "multi_user" | "department" | "mixed";
  dueDate: string;
  collaboratorIds: string[];
};

export type LegacyUpdateTaskInput = {
  status?: "new" | "in_progress";
  dueDate?: string | null;
};

export type LegacyEvaluationInput = {
  employeeId: string;
  rating: number;
  effortWeight: number;
  completion: "not_done" | "done" | "excellent";
  onTime: boolean;
  opinion: string | null;
  checkpointDate: string;
  isFinal: boolean;
};

export type RepositoryError = { code?: string | null };
export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RepositoryError };

export interface TaskRepository {
  list(
    actor: AuthorizationActor,
    query: TaskListQuery,
  ): Promise<RepositoryResult<TaskListResult>>;
  access(taskId: string): Promise<RepositoryResult<TaskAccessSnapshot | null>>;
  detail(taskId: string): Promise<RepositoryResult<TaskDetailDto | null>>;
  create(
    actorId: string,
    input: LegacyCreateTaskInput,
  ): Promise<RepositoryResult<{ id: string }>>;
  update(
    actorId: string,
    taskId: string,
    input: LegacyUpdateTaskInput,
  ): Promise<RepositoryResult<{ id: string }>>;
  claim(actorId: string, taskId: string): Promise<RepositoryResult<unknown>>;
  report(
    actorId: string,
    taskId: string,
    progress: number,
    report: string,
    blockers: string | null,
  ): Promise<RepositoryResult<unknown>>;
  review(
    actorId: string,
    taskId: string,
    decision: "approve" | "reject",
    note: string | null,
  ): Promise<RepositoryResult<unknown>>;
  evaluate(
    actorId: string,
    taskId: string,
    input: LegacyEvaluationInput,
  ): Promise<RepositoryResult<unknown>>;
  comment(
    actorId: string,
    taskId: string,
    content: string,
  ): Promise<RepositoryResult<unknown>>;
  bulkPlan(
    actorId: string,
    input: {
      planPeriod: "daily" | "weekly";
      dueDate: string;
      reviewerId: string;
      description: string;
      items: { title: string }[];
      batchId: string;
    },
  ): Promise<RepositoryResult<unknown>>;
}
```

- [ ] **Step 4: Implement the service-role read scope and mutation calls**

Create `src/lib/taskRepository.ts`:

```typescript
import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import {
  hasOrganizationTaskView,
  type AuthorizationActor,
  type TaskAccessSnapshot,
  type TaskParticipant,
} from "@/lib/authorization";
import type {
  LegacyCreateTaskInput,
  LegacyEvaluationInput,
  LegacyUpdateTaskInput,
  RepositoryResult,
  TaskDetailDto,
  TaskListItemDto,
  TaskListQuery,
  TaskListResult,
  TaskRepository,
} from "@/lib/taskContracts";

const TASK_LIST_FIELDS = [
  "id",
  "title",
  "status",
  "progress_percent",
  "due_date",
  "assignee_id",
  "owner_id",
  "created_by",
  "reviewer_id",
  "department_id",
  "assignment_mode",
  "plan_period",
  "self_claimable",
  "departments(name)",
  "task_assignees(user_id,assignment_role,status,staff_users(full_name))",
].join(",");

const TASK_DETAIL_FIELDS = [
  TASK_LIST_FIELDS,
  "description",
  "attachment_url",
  "effort_weight",
  "owner:staff_users!tasks_owner_id_fkey(full_name)",
  "reviewer:staff_users!tasks_reviewer_id_fkey(full_name)",
].join(",");

type TaskAccessRow = {
  id: string;
  department_id: string | null;
  created_by: string | null;
  owner_id: string | null;
  assignee_id: string | null;
  reviewer_id: string | null;
  self_claimable: boolean;
  status: string;
  task_assignees: {
    user_id: string;
    assignment_role: TaskParticipant["assignmentRole"];
  }[] | null;
};

const ok = <T>(data: T): RepositoryResult<T> => ({ ok: true, data });
const fail = <T>(error: { code?: string | null }): RepositoryResult<T> => ({
  ok: false,
  error: { code: error.code ?? null },
});

const mutation = async <T>(
  name: string,
  args: Record<string, unknown>,
): Promise<RepositoryResult<T>> => {
  const { data, error } = await serverSupabase.rpc(name, args);
  return error ? fail(error) : ok(data as T);
};

const toAccess = (row: TaskAccessRow): TaskAccessSnapshot => ({
  id: row.id,
  departmentId: row.department_id,
  createdBy: row.created_by,
  ownerId: row.owner_id,
  assigneeId: row.assignee_id,
  reviewerId: row.reviewer_id,
  selfClaimable: row.self_claimable,
  status: row.status,
  participants: (row.task_assignees ?? []).map((participant) => ({
    userId: participant.user_id,
    assignmentRole: participant.assignment_role,
  })),
});

const scopeTerms = async (
  actor: AuthorizationActor,
): Promise<RepositoryResult<string[]>> => {
  if (hasOrganizationTaskView(actor)) {
    return ok([]);
  }
  const { data, error } = await serverSupabase
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", actor.id);
  if (error) return fail(error);
  const taskIds = (data ?? []).map((row) => row.task_id as string);
  const terms = [
    `created_by.eq.${actor.id}`,
    `owner_id.eq.${actor.id}`,
    `assignee_id.eq.${actor.id}`,
    `reviewer_id.eq.${actor.id}`,
  ];
  if (
    actor.permissions.can_view_department_tasks
    && actor.departmentId !== null
  ) {
    terms.push(`department_id.eq.${actor.departmentId}`);
  }
  if (taskIds.length > 0) {
    terms.push(`id.in.(${taskIds.join(",")})`);
  }
  return ok(terms);
};

export const taskRepository: TaskRepository = {
  async list(actor, query) {
    const scope = await scopeTerms(actor);
    if (!scope.ok) return scope;

    let dbQuery = serverSupabase
      .from("tasks")
      .select(TASK_LIST_FIELDS, { count: "exact" })
      .order("created_at", { ascending: false });
    if (scope.data.length > 0) dbQuery = dbQuery.or(scope.data.join(","));
    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    if (query.search) dbQuery = dbQuery.ilike("title", `%${query.search}%`);
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const { data, error, count } = await dbQuery.range(from, to);
    if (error) return fail(error);
    return ok({
      items: (data ?? []) as unknown as TaskListItemDto[],
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    });
  },

  async access(taskId) {
    const { data, error } = await serverSupabase
      .from("tasks")
      .select(
        "id,department_id,created_by,owner_id,assignee_id,reviewer_id," +
        "self_claimable,status,task_assignees(user_id,assignment_role)",
      )
      .eq("id", taskId)
      .maybeSingle();
    if (error) return fail(error);
    return ok(data ? toAccess(data as unknown as TaskAccessRow) : null);
  },

  async detail(taskId) {
    const [taskResult, commentResult, progressResult, evaluationResult] =
      await Promise.all([
        serverSupabase
          .from("tasks")
          .select(TASK_DETAIL_FIELDS)
          .eq("id", taskId)
          .maybeSingle(),
        serverSupabase
          .from("task_comments")
          .select("id,content,created_at,user_id,staff_users(full_name)")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false }),
        serverSupabase
          .from("task_progress_logs")
          .select(
            "id,old_progress,new_progress,note,created_at,user_id," +
            "staff_users!task_progress_logs_user_id_fkey(full_name)",
          )
          .eq("task_id", taskId)
          .order("created_at", { ascending: false }),
        serverSupabase
          .from("task_evaluation_checkpoints")
          .select(
            "id,task_id,employee_id,reviewer_id,rating,effort_weight," +
            "total_score,completion,on_time,opinion,checkpoint_date," +
            "is_final,created_at",
          )
          .eq("task_id", taskId)
          .order("checkpoint_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
    const error = taskResult.error
      ?? commentResult.error
      ?? progressResult.error
      ?? evaluationResult.error;
    if (error) return fail(error);
    if (!taskResult.data) return ok(null);
    return ok({
      ...(taskResult.data as unknown as Omit<
        TaskDetailDto,
        "comments" | "progress_logs" | "legacy_evaluations"
      >),
      comments: (commentResult.data ?? []) as unknown as TaskDetailDto["comments"],
      progress_logs:
        (progressResult.data ?? []) as unknown as TaskDetailDto["progress_logs"],
      legacy_evaluations:
        (evaluationResult.data ?? []) as unknown as TaskDetailDto["legacy_evaluations"],
    });
  },

  create: (actorId, input: LegacyCreateTaskInput) => mutation(
    "api_create_task",
    {
      p_actor_id: actorId,
      p_title: input.title,
      p_description: input.description,
      p_department_id: input.departmentId,
      p_assignee_id: input.assigneeId,
      p_reviewer_id: input.reviewerId,
      p_assignment_mode: input.assignmentMode,
      p_due_date: input.dueDate,
      p_collaborator_ids: input.collaboratorIds,
    },
  ),

  update: (actorId, taskId, input: LegacyUpdateTaskInput) => mutation(
    "api_update_task",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_status: input.status ?? null,
      p_due_date: input.dueDate ?? null,
      p_update_due_date: input.dueDate !== undefined,
    },
  ),

  claim: (actorId, taskId) => mutation(
    "api_claim_task_plan",
    { p_actor_id: actorId, p_task_id: taskId },
  ),

  report: (actorId, taskId, progress, report, blockers) => mutation(
    "api_report_task_progress",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_progress: progress,
      p_report: report,
      p_blockers: blockers,
    },
  ),

  review: (actorId, taskId, decision, note) => mutation(
    "api_review_task_completion",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_decision: decision,
      p_note: note,
    },
  ),

  evaluate: (actorId, taskId, input: LegacyEvaluationInput) => mutation(
    "api_save_task_evaluation_checkpoint",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_employee_id: input.employeeId,
      p_rating: input.rating,
      p_effort_weight: input.effortWeight,
      p_completion: input.completion,
      p_on_time: input.onTime,
      p_opinion: input.opinion,
      p_checkpoint_date: input.checkpointDate,
      p_is_final: input.isFinal,
    },
  ),

  comment: (actorId, taskId, content) => mutation(
    "api_add_task_comment",
    { p_actor_id: actorId, p_task_id: taskId, p_content: content },
  ),

  bulkPlan: (actorId, input) => mutation(
    "api_create_bulk_task_plan",
    {
      p_actor_id: actorId,
      p_plan_period: input.planPeriod,
      p_due_date: input.dueDate,
      p_reviewer_id: input.reviewerId,
      p_description: input.description,
      p_items: input.items,
      p_batch_id: input.batchId,
    },
  ),
};
```

- [ ] **Step 5: Run the source contract and TypeScript**

```bash
node --test src/lib/taskHandlers.test.mjs
npx tsc --noEmit
```

Expected: repository source tests pass and TypeScript exits 0. If Supabase inference rejects a relation cast, cast only the selected result through `unknown`; do not add `any`.

- [ ] **Step 6: Commit the contracts/repository unit**

```bash
git add -- src/lib/taskContracts.ts src/lib/taskRepository.ts src/lib/taskHandlers.test.mjs
git diff --cached --check
git commit -m "feat(tasks): add server task repository" -- src/lib/taskContracts.ts src/lib/taskRepository.ts src/lib/taskHandlers.test.mjs
```

Expected: exactly three paths.
## Task 9: Build dependency-injected task handlers and route entry points with TDD

**Files:**
- Create: `src/lib/legacyEvaluationValidation.ts`
- Create: `src/lib/legacyEvaluationValidation.test.mjs`
- Create: `src/lib/taskHandlerFactory.ts`
- Create: `src/lib/taskHandlers.ts`
- Modify: `src/lib/taskHandlers.test.mjs`
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/api/tasks/[id]/comments/route.ts`
- Modify: `src/app/api/tasks/claim/route.ts:1-13`
- Modify: `src/app/api/tasks/evaluate/route.ts:1-59`
- Modify: `src/app/api/tasks/report/route.ts:1-18`
- Modify: `src/app/api/tasks/review/route.ts:1-17`
- Modify: `src/app/api/planning/bulk/route.ts:1-45`

- [ ] **Step 1: Write the failing strict legacy-evaluation validator tests**

Create `src/lib/legacyEvaluationValidation.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";

const valid = {
  rating: 8,
  effortWeight: 3,
  completion: "done",
  onTime: true,
  opinion: "  useful  ",
  checkpointDate: "2026-08-14",
  isFinal: true,
};

test("strict legacy evaluation normalization returns a typed clean value", () => {
  assert.deepEqual(normalizeLegacyEvaluationInput(valid), {
    ...valid,
    opinion: "useful",
  });
});

test("strict legacy evaluation validation rejects malformed runtime values", () => {
  for (const overrides of [
    { rating: 7.5 },
    { rating: "8" },
    { effortWeight: 4 },
    { completion: "partial" },
    { onTime: 1 },
    { checkpointDate: "2026-02-30" },
    { isFinal: "true" },
    { opinion: { text: "unsafe" } },
    { opinion: "x".repeat(10001) },
  ]) {
    assert.throws(
      () => normalizeLegacyEvaluationInput({ ...valid, ...overrides }),
      RangeError,
    );
  }
});
```

- [ ] **Step 2: Run the validator test to verify it fails**

```bash
node --test src/lib/legacyEvaluationValidation.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `legacyEvaluationValidation.ts`.

- [ ] **Step 3: Implement the Phase-1-owned strict validator**

Create `src/lib/legacyEvaluationValidation.ts` without importing `taskEvaluation.ts`:

```typescript
import type { LegacyEvaluationInput } from "./taskContracts";

type NormalizedLegacyEvaluation = Omit<LegacyEvaluationInput, "employeeId">;

const RATINGS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const EFFORT_WEIGHTS = new Set([1, 2, 3, 5, 8]);
const COMPLETIONS = new Set(["not_done", "done", "excellent"]);

const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf())
    && parsed.toISOString().slice(0, 10) === value;
};

export function normalizeLegacyEvaluationInput(
  input: Record<string, unknown>,
): NormalizedLegacyEvaluation {
  if (!Number.isInteger(input.rating) || !RATINGS.has(input.rating as number)) {
    throw new RangeError("invalid_rating");
  }
  if (
    !Number.isInteger(input.effortWeight)
    || !EFFORT_WEIGHTS.has(input.effortWeight as number)
  ) {
    throw new RangeError("invalid_effort_weight");
  }
  if (typeof input.completion !== "string" || !COMPLETIONS.has(input.completion)) {
    throw new RangeError("invalid_completion");
  }
  if (typeof input.onTime !== "boolean" || typeof input.isFinal !== "boolean") {
    throw new RangeError("invalid_boolean");
  }
  if (!validDate(input.checkpointDate)) {
    throw new RangeError("invalid_checkpoint_date");
  }
  if (
    input.opinion !== undefined
    && input.opinion !== null
    && typeof input.opinion !== "string"
  ) {
    throw new RangeError("invalid_opinion");
  }
  const opinion = typeof input.opinion === "string"
    ? input.opinion.normalize("NFC").trim()
    : "";
  if ([...opinion].length > 10000) throw new RangeError("invalid_opinion");

  return {
    rating: input.rating as number,
    effortWeight: input.effortWeight as number,
    completion: input.completion as NormalizedLegacyEvaluation["completion"],
    onTime: input.onTime,
    opinion: opinion || null,
    checkpointDate: input.checkpointDate,
    isFinal: input.isFinal,
  };
}
```

- [ ] **Step 4: Run the pure validator and TypeScript**

```bash
node --test src/lib/legacyEvaluationValidation.test.mjs
npx tsc --noEmit
```

Expected: both validator tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit only the strict validator**

```bash
git add -- src/lib/legacyEvaluationValidation.ts src/lib/legacyEvaluationValidation.test.mjs
git diff --cached --check
git commit -m "feat(tasks): validate legacy evaluation requests" -- src/lib/legacyEvaluationValidation.ts src/lib/legacyEvaluationValidation.test.mjs
```

Expected: exactly two Phase-1-owned paths; neither dirty `taskEvaluation.*` path is staged.

- [ ] **Step 6: Append failing handler behavior tests with a fake repository**

Append to `src/lib/taskHandlers.test.mjs`:

```javascript
import { normalizePermissions } from "./permissions.ts";
import {
  canAssignToDepartment,
  canTaskAction,
} from "./authorization.ts";
import { apiError, apiJson } from "./apiResponse.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";

const makeActor = (overrides = {}) => ({
  id: "actor",
  full_name: "Actor",
  email: null,
  username: null,
  department_id: "dep-a",
  role_code: "phong_vien",
  role_name: "Staff",
  role_level: 1,
  active: true,
  permissions: normalizePermissions({ can_comment: true }),
  ...overrides,
});

const access = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000010",
  departmentId: "dep-a",
  createdBy: "creator",
  ownerId: "actor",
  assigneeId: "actor",
  reviewerId: "reviewer",
  selfClaimable: false,
  status: "in_progress",
  participants: [{ userId: "actor", assignmentRole: "owner" }],
  ...overrides,
});

const makeHarness = ({
  readActor = makeActor(),
  mutationActor = makeActor(),
  taskAccess = access(),
} = {}) => {
  const calls = [];
  const result = (data) => Promise.resolve({ ok: true, data });
  const repository = {
    list: (actor, query) => {
      calls.push(["list", actor.id, query]);
      return result({ items: [], total: 0, page: 1, pageSize: 25 });
    },
    access: (taskId) => result(taskAccess && { ...taskAccess, id: taskId }),
    detail: (taskId) => result(taskAccess
      ? { id: taskId, legacy_evaluations: [] }
      : null),
    create: (...args) => { calls.push(["create", ...args]); return result({ id: "new" }); },
    update: (...args) => { calls.push(["update", ...args]); return result({ id: args[1] }); },
    claim: (...args) => { calls.push(["claim", ...args]); return result({}); },
    report: (...args) => { calls.push(["report", ...args]); return result({}); },
    review: (...args) => { calls.push(["review", ...args]); return result({}); },
    evaluate: (...args) => { calls.push(["evaluate", ...args]); return result({}); },
    comment: (...args) => { calls.push(["comment", ...args]); return result({}); },
    bulkPlan: (...args) => { calls.push(["bulkPlan", ...args]); return result({}); },
  };
  const app = createTaskApplication({
    repository,
    readActor: async () => readActor
      ? { ok: true, actor: readActor }
      : { ok: false, response: apiError("unauthenticated", 401) },
    mutationActor: async () => mutationActor
      ? { ok: true, actor: mutationActor }
      : { ok: false, response: apiError("invalid_origin", 403) },
    json: apiJson,
    error: apiError,
    rpcFailure: () => apiError("operation_failed", 500),
    asUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
      ? value
      : null,
    canAssignToDepartment,
    canTaskAction,
    normalizeLegacyEvaluationInput,
    newUuid: () => "00000000-0000-4000-8000-000000000099",
  });
  return { app, calls };
};

const taskId = "00000000-0000-4000-8000-000000000010";
const employeeId = "00000000-0000-4000-8000-000000000011";

test("list requires a signed actor and delegates server-side pagination", async () => {
  const denied = makeHarness({ readActor: null });
  assert.equal((await denied.app.list(new Request("https://example.test/api/tasks"))).status, 401);

  const allowed = makeHarness();
  const response = await allowed.app.list(
    new Request("https://example.test/api/tasks?page=1&pageSize=25"),
  );
  assert.equal(response.status, 200);
  assert.equal(allowed.calls[0][0], "list");
});

test("detail denies an unrelated actor before loading the DTO", async () => {
  const harness = makeHarness({
    taskAccess: access({
      createdBy: "other",
      ownerId: "other",
      assigneeId: "other",
      reviewerId: "other",
      participants: [],
      departmentId: "dep-b",
    }),
  });
  assert.equal((await harness.app.detail(taskId)).status, 403);
});

test("TBT can read and comment globally but cannot call other task mutations", async () => {
  const tbt = makeActor({
    role_code: "tong_bien_tap",
    permissions: normalizePermissions({
      can_comment: true,
      can_evaluate_step2: true,
    }),
  });
  const harness = makeHarness({
    readActor: tbt,
    mutationActor: tbt,
    taskAccess: access({
      departmentId: "dep-z",
      createdBy: "other",
      ownerId: "other",
      assigneeId: "other",
      reviewerId: "other",
      participants: [],
    }),
  });
  assert.equal((await harness.app.detail(taskId)).status, 200);
  const request = new Request("https://example.test/api/tasks/report", {
    method: "POST",
    body: JSON.stringify({ taskId, progress: 20, report: "progress" }),
  });
  assert.equal((await harness.app.report(request)).status, 403);
  assert.equal(harness.calls.length, 0);
  const comment = new Request("https://example.test/api/tasks/comments", {
    method: "POST",
    body: JSON.stringify({ content: "global comment" }),
  });
  assert.equal((await harness.app.comment(comment, taskId)).status, 201);
  assert.equal(harness.calls[0][0], "comment");
});

test("mutation body cannot choose actor and assignee can report", async () => {
  const harness = makeHarness();
  const request = new Request("https://example.test/api/tasks/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actorId: "forged",
      taskId,
      progress: 50,
      report: "progress",
      blockers: "",
    }),
  });
  assert.equal((await harness.app.report(request)).status, 200);
  assert.deepEqual(harness.calls[0].slice(0, 3), ["report", "actor", taskId]);
});

test("watcher may comment but may not report", async () => {
  const watcherTask = access({
    ownerId: "owner",
    assigneeId: "assignee",
    participants: [{ userId: "actor", assignmentRole: "watcher" }],
  });
  const harness = makeHarness({ taskAccess: watcherTask });
  const report = new Request("https://example.test/api/tasks/report", {
    method: "POST",
    body: JSON.stringify({ taskId, progress: 10, report: "progress" }),
  });
  const comment = new Request("https://example.test/api/tasks/comments", {
    method: "POST",
    body: JSON.stringify({ content: "comment" }),
  });
  assert.equal((await harness.app.report(report)).status, 403);
  assert.equal((await harness.app.comment(comment, taskId)).status, 200);
});

test("legacy evaluation validates and never grants TBT step2 through the old path", async () => {
  const manager = makeActor({
    id: "reviewer",
    permissions: normalizePermissions({ can_evaluate_step1: true }),
  });
  const harness = makeHarness({
    mutationActor: manager,
    taskAccess: access({ reviewerId: "reviewer" }),
  });
  const invalid = new Request("https://example.test/api/tasks/evaluate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      employeeId,
      rating: 7.5,
      effortWeight: 3,
      completion: "done",
      onTime: "true",
      opinion: "",
      checkpointDate: "2026-02-30",
      isFinal: true,
    }),
  });
  assert.equal((await harness.app.evaluate(invalid)).status, 400);
  assert.equal(harness.calls.length, 0);
  const request = new Request("https://example.test/api/tasks/evaluate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      employeeId,
      rating: 8,
      effortWeight: 3,
      completion: "done",
      onTime: true,
      opinion: "",
      checkpointDate: "2026-08-14",
      isFinal: true,
    }),
  });
  assert.equal((await harness.app.evaluate(request)).status, 200);
  assert.equal(harness.calls[0][0], "evaluate");
});

test("list, detail and mutation responses are private no-store at runtime", async () => {
  const harness = makeHarness();
  const responses = [
    await harness.app.list(new Request("https://example.test/api/tasks")),
    await harness.app.detail(taskId),
    await harness.app.report(new Request("https://example.test/api/tasks/report", {
      method: "POST",
      body: JSON.stringify({ taskId, progress: 25, report: "progress" }),
    })),
  ];
  for (const response of responses) {
    assert.match(
      response.headers.get("cache-control") ?? "",
      /private, no-store/,
    );
  }
});
```

- [ ] **Step 7: Run the handler tests to verify they fail**

```bash
node --test src/lib/taskHandlers.test.mjs
```

Expected: FAIL because `taskHandlerFactory.ts` does not exist.

- [ ] **Step 8: Implement the dependency-injected application handlers**

Create `src/lib/taskHandlerFactory.ts`. Every mutation first calls `mutationActor`, loads the task access snapshot when applicable, checks the pure evaluator, and only then calls the repository:

```typescript
import type {
  AuthorizationActor,
  TaskAccessSnapshot,
  TaskAction,
} from "./authorization";
import type { ServerAuthUser } from "./serverSession";
import type {
  LegacyCreateTaskInput,
  LegacyEvaluationInput,
  TaskRepository,
} from "./taskContracts";

type Guard =
  | { ok: true; actor: ServerAuthUser }
  | { ok: false; response: Response };

type Dependencies = {
  repository: TaskRepository;
  readActor: () => Promise<Guard>;
  mutationActor: () => Promise<Guard>;
  json: (body: unknown, status?: number) => Response;
  error: (code: "forbidden" | "invalid_request" | "not_found", status: number) => Response;
  rpcFailure: (error: { code?: string | null }) => Response;
  asUuid: (value: unknown) => string | null;
  canAssignToDepartment: (
    actor: AuthorizationActor,
    departmentId: string | null,
  ) => boolean;
  canTaskAction: (
    actor: AuthorizationActor,
    task: TaskAccessSnapshot,
    action: TaskAction,
  ) => boolean;
  normalizeLegacyEvaluationInput: (
    input: Record<string, unknown>,
  ) => Omit<LegacyEvaluationInput, "employeeId">;
  newUuid: () => string;
};

const toActor = (user: ServerAuthUser): AuthorizationActor => ({
  id: user.id,
  departmentId: user.department_id,
  roleCode: user.role_code,
  roleLevel: user.role_level,
  permissions: user.permissions,
});

const bodyObject = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  const value = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

const cleanText = (value: unknown, max: number) => {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFC").trim();
  return [...normalized].length <= max ? normalized : "";
};

const dateValue = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;

export function createTaskApplication(deps: Dependencies) {
  const taskGuard = async (
    user: ServerAuthUser,
    taskId: string,
    action: TaskAction,
  ) => {
    const accessResult = await deps.repository.access(taskId);
    if (!accessResult.ok) return deps.rpcFailure(accessResult.error);
    if (!accessResult.data) return deps.error("not_found", 404);
    return deps.canTaskAction(toActor(user), accessResult.data, action)
      ? accessResult.data
      : deps.error("forbidden", 403);
  };

  const guardedBody = async (request: Request) => {
    const guard = await deps.mutationActor();
    if (!guard.ok) return guard.response;
    const body = await bodyObject(request);
    if (!body) return deps.error("invalid_request", 400);
    return { actor: guard.actor, body };
  };

  const authorizeMutation = async (
    actor: ServerAuthUser,
    taskIdValue: unknown,
    action: TaskAction,
  ) => {
    const taskId = deps.asUuid(taskIdValue);
    if (!taskId) return deps.error("invalid_request", 400);
    const access = await taskGuard(actor, taskId, action);
    if (access instanceof Response) return access;
    return taskId;
  };

  return {
    async list(request: Request) {
      const guard = await deps.readActor();
      if (!guard.ok) return guard.response;
      const url = new URL(request.url);
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "25");
      if (
        !Number.isInteger(page) || page < 1
        || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100
      ) return deps.error("invalid_request", 400);
      const result = await deps.repository.list(toActor(guard.actor), {
        status: cleanText(url.searchParams.get("status"), 40) || null,
        search: cleanText(url.searchParams.get("q"), 200) || null,
        page,
        pageSize,
      });
      return result.ok
        ? deps.json({ tasks: result.data })
        : deps.rpcFailure(result.error);
    },

    async detail(taskIdValue: unknown) {
      const guard = await deps.readActor();
      if (!guard.ok) return guard.response;
      const taskId = deps.asUuid(taskIdValue);
      if (!taskId) return deps.error("invalid_request", 400);
      const access = await taskGuard(guard.actor, taskId, "view");
      if (access instanceof Response) return access;
      const result = await deps.repository.detail(taskId);
      if (!result.ok) return deps.rpcFailure(result.error);
      if (!result.data) return deps.error("not_found", 404);
      const canViewAllLegacy = deps.canTaskAction(
        toActor(guard.actor),
        access,
        "legacy_evaluate",
      );
      return deps.json({
        task: {
          ...result.data,
          legacy_evaluations: canViewAllLegacy
            ? result.data.legacy_evaluations
            : result.data.legacy_evaluations.filter(
                (row) => row.employee_id === guard.actor.id,
              ),
        },
      });
    },

    async create(request: Request) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const actor = toActor(guard.actor);
      const body = await bodyObject(request);
      const title = cleanText(body?.title, 500);
      const description = cleanText(body?.description, 10000);
      const assigneeId = deps.asUuid(body?.assigneeId);
      const reviewerId = deps.asUuid(body?.reviewerId);
      const departmentId = body?.departmentId === null
        ? null
        : deps.asUuid(body?.departmentId);
      const dueDate = dateValue(body?.dueDate);
      const modes = ["individual", "multi_user", "department", "mixed"] as const;
      const assignmentMode = modes.find((value) => value === body?.assignmentMode);
      const collaboratorIds = Array.isArray(body?.collaboratorIds)
        ? [...new Set(body.collaboratorIds.map(deps.asUuid).filter(
            (value): value is string => value !== null && value !== assigneeId,
          ))]
        : [];
      if (
        !title || !description || !assigneeId || !reviewerId
        || !dueDate || !assignmentMode
        || (body?.departmentId !== null && !departmentId)
      ) return deps.error("invalid_request", 400);
      if (!deps.canAssignToDepartment(actor, departmentId)) {
        return deps.error("forbidden", 403);
      }
      const input: LegacyCreateTaskInput = {
        title,
        description,
        departmentId,
        assigneeId,
        reviewerId,
        assignmentMode,
        dueDate,
        collaboratorIds,
      };
      const result = await deps.repository.create(guard.actor.id, input);
      return result.ok
        ? deps.json({ task: result.data }, 201)
        : deps.rpcFailure(result.error);
    },

    async update(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const statuses = ["new", "in_progress"] as const;
      const status = statuses.find((value) => value === body?.status);
      const dueDate = body?.dueDate === null ? null : dateValue(body?.dueDate);
      if (
        !body
        || (body.status !== undefined && !status)
        || (body.dueDate !== undefined && body.dueDate !== null && !dueDate)
        || (body.status === undefined && body.dueDate === undefined)
      ) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, taskIdValue, "update");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.update(actor.id, taskId, {
        ...(status ? { status } : {}),
        ...(body.dueDate !== undefined ? { dueDate } : {}),
      });
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async claim(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const taskId = await authorizeMutation(
        guarded.actor, guarded.body.taskId, "claim",
      );
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.claim(guarded.actor.id, taskId);
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async report(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const progress = typeof body?.progress === "number"
        ? body.progress
        : Number(body?.progress);
      const report = cleanText(body?.report, 10000);
      const blockers = cleanText(body?.blockers, 10000) || null;
      if (!Number.isInteger(progress) || progress < 0 || progress > 100 || !report) {
        return deps.error("invalid_request", 400);
      }
      const taskId = await authorizeMutation(actor, body.taskId, "report");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.report(
        actor.id, taskId, progress, report, blockers,
      );
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async review(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const decision = body?.decision === "approve" || body?.decision === "reject"
        ? body.decision
        : null;
      const note = cleanText(body?.note, 10000) || null;
      if (!decision) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, body.taskId, "review");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.review(
        actor.id, taskId, decision, note,
      );
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async evaluate(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const employeeId = deps.asUuid(body?.employeeId);
      if (!employeeId) return deps.error("invalid_request", 400);
      let input: Omit<LegacyEvaluationInput, "employeeId">;
      try {
        input = deps.normalizeLegacyEvaluationInput({
          rating: body?.rating,
          effortWeight: body?.effortWeight,
          completion: body?.completion,
          onTime: body?.onTime,
          opinion: body?.opinion,
          checkpointDate: body?.checkpointDate,
          isFinal: body?.isFinal,
        });
      } catch {
        return deps.error("invalid_request", 400);
      }
      const taskId = await authorizeMutation(
        actor, body.taskId, "legacy_evaluate",
      );
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.evaluate(actor.id, taskId, {
        employeeId,
        rating: input.rating,
        effortWeight: input.effortWeight,
        completion: input.completion,
        onTime: input.onTime,
        opinion: input.opinion ?? null,
        checkpointDate: input.checkpointDate,
        isFinal: input.isFinal,
      });
      return result.ok ? deps.json({ ok: true }) : deps.rpcFailure(result.error);
    },

    async comment(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const content = cleanText(body?.content, 10000);
      if (!content) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, taskIdValue, "comment");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.comment(actor.id, taskId, content);
      return result.ok
        ? deps.json({ comment: result.data }, 201)
        : deps.rpcFailure(result.error);
    },

    async bulkPlan(request: Request) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const actor = toActor(guard.actor);
      if (
        ["tong_bien_tap", "tbt_read_only"].includes(actor.roleCode)
        || !actor.permissions.can_assign_task
      ) return deps.error("forbidden", 403);
      const body = await bodyObject(request);
      const planPeriod = body?.planPeriod === "daily" || body?.planPeriod === "weekly"
        ? body.planPeriod
        : null;
      const dueDate = dateValue(body?.dueDate);
      const reviewerId = deps.asUuid(body?.reviewerId);
      const description = cleanText(body?.description, 10000);
      const items = Array.isArray(body?.items)
        ? body.items.map((item) => ({
            title: cleanText(
              item && typeof item === "object"
                ? (item as Record<string, unknown>).title
                : null,
              500,
            ),
          }))
        : [];
      const batchId = deps.asUuid(body?.batchId) ?? deps.newUuid();
      if (
        !planPeriod || !dueDate || !reviewerId || !description
        || items.length < 1 || items.length > 100
        || items.some((item) => !item.title)
      ) return deps.error("invalid_request", 400);
      const result = await deps.repository.bulkPlan(guard.actor.id, {
        planPeriod,
        dueDate,
        reviewerId,
        description,
        items,
        batchId,
      });
      return result.ok
        ? deps.json({ batchId, tasks: result.data })
        : deps.rpcFailure(result.error);
    },
  };
}
```

- [ ] **Step 9: Wire production guards and repository**

Create `src/lib/taskHandlers.ts`:

```typescript
import "server-only";

import { randomUUID } from "node:crypto";

import {
  canAssignToDepartment,
  canTaskAction,
} from "@/lib/authorization";
import { normalizeLegacyEvaluationInput } from "@/lib/legacyEvaluationValidation";
import {
  apiError,
  apiJson,
  asUuid,
  requireMutationActor,
  requireReadActor,
  rpcFailure,
} from "@/lib/serverApi";
import { createTaskApplication } from "@/lib/taskHandlerFactory";
import { taskRepository } from "@/lib/taskRepository";

export const taskHandlers = createTaskApplication({
  repository: taskRepository,
  readActor: requireReadActor,
  mutationActor: requireMutationActor,
  json: apiJson,
  error: apiError,
  rpcFailure,
  asUuid,
  canAssignToDepartment,
  canTaskAction,
  normalizeLegacyEvaluationInput,
  newUuid: randomUUID,
});
```

- [ ] **Step 10: Add the list/create, detail/update, and comment routes**

Create `src/app/api/tasks/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = taskHandlers.list;
export const POST = taskHandlers.create;
```

Create `src/app/api/tasks/[id]/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: Context) {
  return taskHandlers.detail((await context.params).id);
}

export async function PATCH(request: Request, context: Context) {
  return taskHandlers.update(request, (await context.params).id);
}
```

Create `src/app/api/tasks/[id]/comments/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return taskHandlers.comment(request, (await context.params).id);
}
```

- [ ] **Step 11: Replace every current wrapper with a one-purpose delegate**

`src/app/api/tasks/claim/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";
export const POST = taskHandlers.claim;
```

`src/app/api/tasks/report/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";
export const POST = taskHandlers.report;
```

`src/app/api/tasks/review/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";
export const POST = taskHandlers.review;
```

`src/app/api/tasks/evaluate/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";
export const POST = taskHandlers.evaluate;
```

`src/app/api/planning/bulk/route.ts`:

```typescript
import { taskHandlers } from "@/lib/taskHandlers";
export const POST = taskHandlers.bulkPlan;
```

- [ ] **Step 12: Add route-source assertions and run red-to-green tests**

Append this route inventory assertion to `src/lib/taskHandlers.test.mjs`:

```javascript
test("route files are thin delegates with no Supabase client", () => {
  for (const relative of [
    "../app/api/tasks/route.ts",
    "../app/api/tasks/[id]/route.ts",
    "../app/api/tasks/[id]/comments/route.ts",
    "../app/api/tasks/claim/route.ts",
    "../app/api/tasks/report/route.ts",
    "../app/api/tasks/review/route.ts",
    "../app/api/tasks/evaluate/route.ts",
    "../app/api/planning/bulk/route.ts",
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /taskHandlers/);
    assert.doesNotMatch(source, /serverSupabase|@\/lib\/supabase|\.rpc\(/);
  }
});

test("production handler wiring imports every injected dependency from owned modules", () => {
  const source = readFileSync(
    new URL("./taskHandlers.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /randomUUID/);
  assert.match(source, /canAssignToDepartment/);
  assert.match(source, /canTaskAction/);
  assert.match(source, /normalizeLegacyEvaluationInput/);
  assert.doesNotMatch(source, /taskEvaluation/);
});
```

Run:

```bash
node --test src/lib/apiResponse.test.mjs src/lib/legacyEvaluationValidation.test.mjs src/lib/taskHandlers.test.mjs src/lib/authorization.test.mjs src/lib/serverApiSource.test.mjs
npx tsc --noEmit
```

Expected: handler/auth/source tests pass; TypeScript exits 0.

- [ ] **Step 13: Commit read routes separately**

```bash
git add -- src/lib/taskHandlerFactory.ts src/lib/taskHandlers.ts src/lib/taskHandlers.test.mjs src/app/api/tasks/route.ts 'src/app/api/tasks/[id]/route.ts'
git diff --cached --check
git commit -m "feat(tasks): add authorized task read facade" -- src/lib/taskHandlerFactory.ts src/lib/taskHandlers.ts src/lib/taskHandlers.test.mjs src/app/api/tasks/route.ts 'src/app/api/tasks/[id]/route.ts'
```

Expected: exactly five paths.

- [ ] **Step 14: Commit mutation route delegates separately**

```bash
git add -- 'src/app/api/tasks/[id]/comments/route.ts' src/app/api/tasks/claim/route.ts src/app/api/tasks/evaluate/route.ts src/app/api/tasks/report/route.ts src/app/api/tasks/review/route.ts src/app/api/planning/bulk/route.ts
git diff --cached --check
git commit -m "feat(tasks): guard legacy task mutations" -- 'src/app/api/tasks/[id]/comments/route.ts' src/app/api/tasks/claim/route.ts src/app/api/tasks/evaluate/route.ts src/app/api/tasks/report/route.ts src/app/api/tasks/review/route.ts src/app/api/planning/bulk/route.ts
```

Expected: exactly six paths. No page/UI file is included.

## Task 10: Add database-enforced mutation wrappers and SQL authorization tests

**Files:**
- Modify: `supabase/migrations/20260814190000_phase1_authorization_facade.sql`
- Modify: `supabase/tests/phase1_authorization_facade.sql`
- Modify: `supabase/tests/task_rpc_security.sql:3-61`

- [ ] **Step 1: Append failing wrapper privilege and behavior assertions**

Before the final `rollback;` in `supabase/tests/phase1_authorization_facade.sql`, add:

```sql
do $test$
declare
  v_functions text[] := array[
    'public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])',
    'public.api_update_task(uuid,uuid,text,date,boolean)',
    'public.api_claim_task_plan(uuid,uuid)',
    'public.api_report_task_progress(uuid,uuid,integer,text,text)',
    'public.api_review_task_completion(uuid,uuid,text,text)',
    'public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)',
    'public.api_add_task_comment(uuid,uuid,text)',
    'public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)'
  ];
  v_return_types regtype[] := array[
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.tasks'::regtype,
    'public.task_evaluation_checkpoints'::regtype,
    'public.task_comments'::regtype,
    'public.tasks'::regtype
  ];
  v_return_sets boolean[] := array[false,false,false,false,false,false,false,true];
  v_signature text;
  v_index integer;
  v_oid regprocedure;
  v_return_type oid;
  v_return_set boolean;
begin
  for v_index in 1..cardinality(v_functions) loop
    v_signature := v_functions[v_index];
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception 'missing wrapper %', v_signature;
    end if;
    select p.prorettype,p.proretset
    into v_return_type,v_return_set
    from pg_proc p where p.oid=v_oid;
    if v_return_type<>v_return_types[v_index]::oid
       or v_return_set<>v_return_sets[v_index] then
      raise exception 'wrapper return mismatch %', v_signature;
    end if;
    if has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('authenticated',v_oid,'EXECUTE')
       or exists (
         select 1
         from pg_proc p
         cross join lateral aclexplode(
           coalesce(p.proacl,acldefault('f',p.proowner))
         ) acl
          where p.oid=v_oid
           and acl.grantee=0
           and acl.privilege_type='EXECUTE'
       ) then
      raise exception 'non-service role can execute %', v_signature;
    end if;
    if not has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'service_role cannot execute %', v_signature;
    end if;
  end loop;
end
$test$;

do $test$
declare
  v_task public.tasks;
begin
  perform public.api_add_task_comment(
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'synthetic global TBT comment'
  );

  begin
    perform public.api_add_task_comment(
      '30000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000001',
      'must be denied'
    );
    raise exception 'tbt_read_only unexpectedly commented';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.api_save_task_evaluation_checkpoint(
      '30000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000007',
      8,3,'done',true,'must be denied',current_date,true
    );
    raise exception 'TBT unexpectedly used legacy evaluation';
  exception when insufficient_privilege then null;
  end;

  v_task := public.api_report_task_progress(
    '30000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000001',
    50,'synthetic report',null
  );
  if v_task.progress_percent<>50 then
    raise exception 'assigned reporter update failed';
  end if;

  perform public.api_add_task_comment(
    '30000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000001',
    'synthetic comment'
  );
end
$test$;
```

In `supabase/tests/task_rpc_security.sql`, replace the first transaction-level privilege `do` block with this exact old-plus-wrapper inventory. Keep the existing `set local role` runtime checks and final creator-guard contract unchanged:

```sql
do $$
declare
  v_functions regprocedure[] := array[
    'public.claim_task_plan(uuid,uuid)'::regprocedure,
    'public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure,
    'public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])'::regprocedure,
    'public.api_update_task(uuid,uuid,text,date,boolean)'::regprocedure,
    'public.api_claim_task_plan(uuid,uuid)'::regprocedure,
    'public.api_report_task_progress(uuid,uuid,integer,text,text)'::regprocedure,
    'public.api_review_task_completion(uuid,uuid,text,text)'::regprocedure,
    'public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'::regprocedure,
    'public.api_add_task_comment(uuid,uuid,text)'::regprocedure,
    'public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)'::regprocedure
  ];
  v_function regprocedure;
begin
  foreach v_function in array v_functions loop
    if has_function_privilege('anon',v_function,'EXECUTE')
       or has_function_privilege('authenticated',v_function,'EXECUTE')
       or exists (
         select 1
         from pg_proc p
         cross join lateral aclexplode(
           coalesce(p.proacl,acldefault('f',p.proowner))
         ) acl
         where p.oid=v_function
           and acl.grantee=0
           and acl.privilege_type='EXECUTE'
       ) then
      raise exception 'non-service role can execute %',v_function;
    end if;
    if not has_function_privilege('service_role',v_function,'EXECUTE') then
      raise exception 'service_role cannot execute %',v_function;
    end if;
  end loop;
end;
$$;
```

The two old RPCs and all eight wrappers therefore remain non-executable by `public`, `anon`, and `authenticated` while `service_role` keeps execute access.

- [ ] **Step 2: Run the SQL tests to verify they fail**

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker cp supabase/tests/phase1_authorization_facade.sql supabase_db_thoidai-work:/tmp/phase1_authorization_facade.sql
if docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/phase1_authorization_facade.sql; then
  echo "expected missing-wrapper failure" >&2
  exit 1
fi
```

Expected: non-zero with `missing wrapper public.api_create_task...`.

- [ ] **Step 3: Add the canonical database authorization assertion**

Append to `supabase/migrations/20260814190000_phase1_authorization_facade.sql`:

```sql
create or replace function public.api_assert_task_action(
  p_actor_id uuid,
  p_task_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_role_code text;
  v_department_id uuid;
  v_can_assign boolean;
  v_can_view_department boolean;
  v_can_step1 boolean;
  v_can_comment boolean;
  v_task public.tasks;
  v_allowed boolean := false;
begin
  select r.code,u.department_id,
         coalesce(rp.can_assign_task,false),
         coalesce(rp.can_view_department_tasks,false),
         coalesce(rp.can_evaluate_step1,false),
         coalesce(rp.can_comment,false)
  into v_role_code,v_department_id,v_can_assign,
       v_can_view_department,v_can_step1,v_can_comment
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;

  if v_role_code is null then
    raise exception 'Invalid actor.' using errcode='42501';
  end if;
  if v_role_code='tbt_read_only'
     or (v_role_code='tong_bien_tap' and p_action<>'comment') then
    raise exception 'Task operation is read-only for this role.'
      using errcode='42501';
  end if;
  if p_action in ('assign','bulk') then
    if not v_can_assign then
      raise exception 'Assignment permission required.' using errcode='42501';
    end if;
    return;
  end if;

  select * into v_task
  from public.tasks
  where id=p_task_id
  for update;
  if not found then
    raise exception 'Task not found.' using errcode='P0002';
  end if;

  case p_action
    when 'update' then
      v_allowed := v_role_code='admin'
        or v_task.created_by=p_actor_id
        or (v_can_assign and v_task.department_id=v_department_id);
    when 'claim' then
      v_allowed := v_task.self_claimable
        and v_task.status='new'
        and v_task.assignee_id is null;
    when 'report' then
      v_allowed := v_role_code='admin'
        or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id=p_task_id and ta.user_id=p_actor_id
            and ta.assignment_role<>'watcher'
        );
    when 'review' then
      v_allowed := v_role_code='admin'
        or v_task.created_by=p_actor_id
        or (v_task.reviewer_id=p_actor_id and v_can_assign);
    when 'comment' then
      v_allowed := v_can_comment and (
        v_role_code in ('admin','tong_bien_tap')
        or v_task.created_by=p_actor_id
        or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id
        or v_task.reviewer_id=p_actor_id
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id=p_task_id and ta.user_id=p_actor_id
        )
        or (v_can_view_department and v_task.department_id=v_department_id)
      );
    when 'legacy_evaluate' then
      v_allowed := v_role_code='admin'
        or (
          v_can_step1
          and (
            v_task.created_by=p_actor_id
            or v_task.reviewer_id=p_actor_id
          )
        );
    else
      raise exception 'Unknown task action.' using errcode='22023';
  end case;

  if not v_allowed then
    raise exception 'Task action forbidden.' using errcode='42501';
  end if;
end
$function$;
```

- [ ] **Step 4: Add create, restricted update, and comment RPCs**

Append:

```sql
create or replace function public.api_create_task(
  p_actor_id uuid,
  p_title text,
  p_description text,
  p_department_id uuid,
  p_assignee_id uuid,
  p_reviewer_id uuid,
  p_assignment_mode text,
  p_due_date date,
  p_collaborator_ids uuid[] default '{}'::uuid[]
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_user_id uuid;
  v_role_code text;
  v_actor_department_id uuid;
begin
  perform public.api_assert_task_action(p_actor_id,null,'assign');
  select r.code,u.department_id
  into v_role_code,v_actor_department_id
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v_role_code not in ('admin','pho_tong_bien_tap')
     and (
       p_department_id is null
       or v_actor_department_id is null
       or p_department_id<>v_actor_department_id
     ) then
    raise exception 'Assignment is outside actor scope.' using errcode='42501';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_due_date is null
     or p_assignment_mode not in ('individual','multi_user','department','mixed') then
    raise exception 'Invalid task input.' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.staff_users
    where id=p_assignee_id and active=true
  ) then raise exception 'Invalid assignee.' using errcode='22023'; end if;

  insert into public.tasks(
    title,description,department_id,assignee_id,owner_id,reviewer_id,
    created_by,assignment_mode,due_date,status,progress_percent,
    plan_period,self_claimable
  ) values (
    btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,
    p_assignee_id,p_reviewer_id,p_actor_id,p_assignment_mode,p_due_date,
    'new',0,'ad_hoc',false
  )
  returning * into v_task;

  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_assignee_id,'owner','todo')
  on conflict(task_id,user_id) do update
    set assignment_role='owner',status='todo';

  foreach v_user_id in array coalesce(p_collaborator_ids,'{}'::uuid[]) loop
    if v_user_id<>p_assignee_id and exists (
      select 1 from public.staff_users where id=v_user_id and active=true
    ) then
      insert into public.task_assignees(task_id,user_id,assignment_role,status)
      values(v_task.id,v_user_id,'assignee','todo')
      on conflict(task_id,user_id) do nothing;
    end if;
  end loop;

  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,new_data
  ) values (
    p_actor_id,'task','tasks',v_task.id,'create',
    jsonb_build_object('status',v_task.status,'assignment_mode',v_task.assignment_mode)
  );
  return v_task;
end
$function$;

create or replace function public.api_update_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_status text default null,
  p_due_date date default null,
  p_update_due_date boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select * into v_before from public.tasks where id=p_task_id;
  if p_status is not null and p_status not in ('new','in_progress') then
    raise exception 'Use report/review for completion transitions.'
      using errcode='22023';
  end if;
  if p_status is null and not p_update_due_date then
    raise exception 'No update supplied.' using errcode='22023';
  end if;
  update public.tasks
  set status=coalesce(p_status,status),
      due_date=case when p_update_due_date then p_due_date else due_date end,
      updated_at=now()
  where id=p_task_id
  returning * into v_after;
  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,old_data,new_data
  ) values (
    p_actor_id,'task','tasks',p_task_id,'update',
    jsonb_build_object('status',v_before.status,'due_date',v_before.due_date),
    jsonb_build_object('status',v_after.status,'due_date',v_after.due_date)
  );
  return v_after;
end
$function$;

create or replace function public.api_add_task_comment(
  p_actor_id uuid,
  p_task_id uuid,
  p_content text
)
returns public.task_comments
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_comment public.task_comments;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'comment');
  if nullif(btrim(p_content),'') is null or length(p_content)>10000 then
    raise exception 'Invalid comment.' using errcode='22023';
  end if;
  insert into public.task_comments(task_id,user_id,content)
  values(p_task_id,p_actor_id,btrim(p_content))
  returning * into v_comment;
  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,new_data
  ) values (
    p_actor_id,'task','task_comments',v_comment.id,'create',
    jsonb_build_object('task_id',p_task_id)
  );
  return v_comment;
end
$function$;
```

- [ ] **Step 5: Add wrappers around every existing service-only RPC**

The committed production catalog was rechecked before drafting: `claim_task_plan(uuid,uuid)`, `report_task_progress(uuid,uuid,integer,text,text)`, and `review_task_completion(uuid,uuid,text,text)` each return `tasks`; `save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)` returns `task_evaluation_checkpoints`; and `create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)` returns `SETOF tasks`. The wrapper signatures and scalar/set return declarations below preserve those contracts exactly.

Append:

```sql
create or replace function public.api_claim_task_plan(
  p_actor_id uuid,p_task_id uuid
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'claim');
  v_task := public.claim_task_plan(p_actor_id,p_task_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'claim',
    jsonb_build_object('status',v_task.status));
  return v_task;
end
$function$;

create or replace function public.api_report_task_progress(
  p_actor_id uuid,p_task_id uuid,p_progress integer,
  p_report text,p_blockers text default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'report');
  v_task := public.report_task_progress(
    p_actor_id,p_task_id,p_progress,p_report,p_blockers
  );
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'submit',
    jsonb_build_object('progress_percent',v_task.progress_percent,'status',v_task.status));
  return v_task;
end
$function$;

create or replace function public.api_review_task_completion(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_note text default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  v_task := public.review_task_completion(
    p_actor_id,p_task_id,p_decision,p_note
  );
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',p_task_id,
    case when p_decision='approve' then 'approve' else 'update' end,
    jsonb_build_object('decision',p_decision,'status',v_task.status));
  return v_task;
end
$function$;

create or replace function public.api_save_task_evaluation_checkpoint(
  p_actor_id uuid,p_task_id uuid,p_employee_id uuid,p_rating integer,
  p_effort_weight integer,p_completion text,p_on_time boolean,
  p_opinion text,p_checkpoint_date date,p_is_final boolean
) returns public.task_evaluation_checkpoints
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.task_evaluation_checkpoints;
begin
  perform public.api_assert_task_action(
    p_actor_id,p_task_id,'legacy_evaluate'
  );
  v_row := public.save_task_evaluation_checkpoint(
    p_actor_id,p_task_id,p_employee_id,p_rating,p_effort_weight,
    p_completion,p_on_time,p_opinion,p_checkpoint_date,p_is_final
  );
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_evaluation_checkpoints',v_row.id,'submit',
    jsonb_build_object('task_id',p_task_id,'is_final',p_is_final));
  return v_row;
end
$function$;

create or replace function public.api_create_bulk_task_plan(
  p_actor_id uuid,p_plan_period text,p_due_date date,p_reviewer_id uuid,
  p_description text,p_items jsonb,p_batch_id uuid
) returns setof public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  perform public.api_assert_task_action(p_actor_id,null,'bulk');
  if jsonb_typeof(p_items)<>'array' then
    raise exception 'Invalid bulk task items.' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_plan_batch',p_batch_id,'create',
    jsonb_build_object('plan_period',p_plan_period,'item_count',jsonb_array_length(p_items)));
  return query select * from public.create_bulk_task_plan(
    p_actor_id,p_plan_period,p_due_date,p_reviewer_id,
    p_description,p_items,p_batch_id
  );
end
$function$;
```

- [ ] **Step 6: Lock ownership, search path, and execute grants**

Append:

```sql
revoke all on function public.api_assert_task_action(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])
  from public,anon,authenticated;
revoke all on function public.api_update_task(uuid,uuid,text,date,boolean)
  from public,anon,authenticated;
revoke all on function public.api_claim_task_plan(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_report_task_progress(uuid,uuid,integer,text,text)
  from public,anon,authenticated;
revoke all on function public.api_review_task_completion(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)
  from public,anon,authenticated;
revoke all on function public.api_add_task_comment(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)
  from public,anon,authenticated;

grant execute on function public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])
  to service_role;
grant execute on function public.api_update_task(uuid,uuid,text,date,boolean)
  to service_role;
grant execute on function public.api_claim_task_plan(uuid,uuid)
  to service_role;
grant execute on function public.api_report_task_progress(uuid,uuid,integer,text,text)
  to service_role;
grant execute on function public.api_review_task_completion(uuid,uuid,text,text)
  to service_role;
grant execute on function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)
  to service_role;
grant execute on function public.api_add_task_comment(uuid,uuid,text)
  to service_role;
grant execute on function public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)
  to service_role;

alter function public.api_assert_task_action(uuid,uuid,text) owner to postgres;
alter function public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[]) owner to postgres;
alter function public.api_update_task(uuid,uuid,text,date,boolean) owner to postgres;
alter function public.api_claim_task_plan(uuid,uuid) owner to postgres;
alter function public.api_report_task_progress(uuid,uuid,integer,text,text) owner to postgres;
alter function public.api_review_task_completion(uuid,uuid,text,text) owner to postgres;
alter function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean) owner to postgres;
alter function public.api_add_task_comment(uuid,uuid,text) owner to postgres;
alter function public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid) owner to postgres;
```

`api_assert_task_action` deliberately has no execute grant: wrapper functions call it as their `postgres` owner.

- [ ] **Step 7: Re-apply on disposable DB and run all task SQL tests**

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker cp supabase/migrations/20260814190000_phase1_authorization_facade.sql supabase_db_thoidai-work:/tmp/phase1.sql
docker cp supabase/tests/phase1_authorization_facade.sql supabase_db_thoidai-work:/tmp/phase1_authorization_facade.sql
docker cp supabase/tests/task_rpc_security.sql supabase_db_thoidai-work:/tmp/task_rpc_security.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" --single-transaction -v ON_ERROR_STOP=1 -f /tmp/phase1.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/phase1_authorization_facade.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/task_rpc_security.sql
```

Expected: migration and both tests exit 0. TBT organization-wide comment succeeds, TBT legacy evaluation and `tbt_read_only` comment fail inside caught `insufficient_privilege` blocks, and the assigned synthetic employee report/comment succeed; the outer transaction rolls everything back.

- [ ] **Step 8: Prove idempotency and no anonymous revoke**

```bash
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" --single-transaction -v ON_ERROR_STOP=1 -f /tmp/phase1.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -AtF '|' -c "
select
  has_table_privilege('anon','public.tasks','SELECT'),
  has_table_privilege('anon','public.tasks','INSERT'),
  has_table_privilege('anon','public.task_comments','SELECT'),
  (select count(*) from public.departments where active and manager_id is null),
  (select count(*) from public.audit_logs);"
```

Expected: the compatibility privilege fields remain `true`; two synthetic active departments lack a manager; fixture test transactions leave audit count unchanged.

- [ ] **Step 9: Commit SQL wrappers and security tests**

```bash
git add -- supabase/migrations/20260814190000_phase1_authorization_facade.sql supabase/tests/phase1_authorization_facade.sql supabase/tests/task_rpc_security.sql
git diff --cached --check
git commit -m "feat(db): enforce task mutations through service role" -- supabase/migrations/20260814190000_phase1_authorization_facade.sql supabase/tests/phase1_authorization_facade.sql supabase/tests/task_rpc_security.sql
```

Expected: exactly three paths.
## Task 11: Verify, apply the exact migration, deploy, health-check, and preserve rollback

**Files:**
- Verify: every path in the locked file map
- Deploy source: `/opt/thoidai-worktrees/thoidai-phase1-authorization`
- Active source: `/opt/thoidai-work`
- Migration: `supabase/migrations/20260814190000_phase1_authorization_facade.sql`
- Service: `thoidai-work.service`

- [ ] **Step 1: Prove the feature diff contains only the locked paths**

```bash
set -euo pipefail
cd /opt/thoidai-worktrees/thoidai-phase1-authorization
baseline_commit=$(git merge-base HEAD main)
git diff --check "$baseline_commit"..HEAD
git diff --name-only "$baseline_commit"..HEAD | sort > /tmp/thoidai-phase1-feature.paths
cat > /tmp/thoidai-phase1-allowed.paths <<'EOF'
src/app/api/permissions/route.ts
src/app/api/planning/bulk/route.ts
src/app/api/tasks/[id]/comments/route.ts
src/app/api/tasks/[id]/route.ts
src/app/api/tasks/claim/route.ts
src/app/api/tasks/evaluate/route.ts
src/app/api/tasks/report/route.ts
src/app/api/tasks/review/route.ts
src/app/api/tasks/route.ts
src/lib/authorization.test.mjs
src/lib/authorization.ts
src/lib/apiResponse.test.mjs
src/lib/apiResponse.ts
src/lib/legacyEvaluationValidation.test.mjs
src/lib/legacyEvaluationValidation.ts
src/lib/permissions.ts
src/lib/serverApi.ts
src/lib/serverApiSource.test.mjs
src/lib/serverAudit.ts
src/lib/serverSession.ts
src/lib/taskContracts.ts
src/lib/taskHandlerFactory.ts
src/lib/taskHandlers.test.mjs
src/lib/taskHandlers.ts
src/lib/taskRepository.ts
supabase/migrations/20260814190000_phase1_authorization_facade.sql
supabase/tests/phase1_authorization_facade.sql
supabase/tests/task_rpc_security.sql
EOF
sort -o /tmp/thoidai-phase1-allowed.paths /tmp/thoidai-phase1-allowed.paths
diff -u /tmp/thoidai-phase1-allowed.paths /tmp/thoidai-phase1-feature.paths
test -z "$(git status --porcelain=v1 --untracked-files=all)"
```

Expected: no diff output; feature worktree clean. No UI page, navigation, password-reset file, service config, provider config, or unrelated dirty source is present.

- [ ] **Step 2: Run the full tracked Node test manifest**

```bash
set -euo pipefail
cd /opt/thoidai-worktrees/thoidai-phase1-authorization
npm ci
mapfile -t node_tests < <(git ls-files 'src/**/*.test.mjs' | sort)
test "${#node_tests[@]}" -gt 0
node --test "${node_tests[@]}"
```

Expected: all tracked Node tests pass with zero failures. The module-type reparsing warning is known and non-fatal. If an unrelated committed baseline test fails, stop; do not modify excluded dirty-root files.

- [ ] **Step 3: Run SQL, type, lint, and build gates in order**

```bash
set -euo pipefail
cd /opt/thoidai-worktrees/thoidai-phase1-authorization
read -r test_root < /opt/thoidai-test/phase1-auth.latest
read -r test_db < "$test_root/database.name"
docker cp supabase/tests/phase1_authorization_facade.sql supabase_db_thoidai-work:/tmp/phase1_authorization_facade.sql
docker cp supabase/tests/task_rpc_security.sql supabase_db_thoidai-work:/tmp/task_rpc_security.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/phase1_authorization_facade.sql
docker exec supabase_db_thoidai-work psql -X -U postgres -d "$test_db" -f /tmp/task_rpc_security.sql
npx tsc --noEmit
npm run lint

build_epoch=$(date -u +%Y%m%dT%H%M%SZ)
build_root="/opt/thoidai-builds/thoidai-phase1-$build_epoch"
build_source="$build_root/source"
install -d -m 0755 "$build_source"
git archive --format=tar HEAD | tar -xf - -C "$build_source"
cd "$build_source"
npm ci
for env_file in /opt/thoidai-work/.env.production /opt/thoidai-work/.env.local; do
  test "$(stat -c '%U:%G:%a' "$env_file")" = "root:root:600"
done
build_unit="thoidai-phase1-build-${build_epoch,,}"
[[ "$build_unit" =~ ^[a-z0-9][a-z0-9_.@-]{0,127}$ ]]
test "$(systemctl show "$build_unit.service" -p LoadState --value 2>/dev/null || true)" = "not-found"
set +e
systemd-run \
  --unit="$build_unit" \
  --property=Type=oneshot \
  --property=User=root \
  --property=Group=root \
  --property="WorkingDirectory=$build_source" \
  --property=EnvironmentFile=/opt/thoidai-work/.env.production \
  --property=EnvironmentFile=/opt/thoidai-work/.env.local \
  --wait --pipe --collect \
  /usr/bin/npm run build
build_exit=$?
set -e
test "$build_exit" -eq 0
test -f "$build_source/.next/BUILD_ID"
test "$(systemctl show "$build_unit.service" -p LoadState --value 2>/dev/null || true)" = "not-found"
printf '%s\n' "$build_source/.next" > "$build_root/candidate-next.path"
printf '%s\n' "$(git -C /opt/thoidai-worktrees/thoidai-phase1-authorization rev-parse HEAD)" > "$build_root/source-head.txt"
printf '%s\n' "$build_root" > /opt/thoidai-builds/thoidai-phase1.latest
chmod 0600 "$build_root/candidate-next.path" "$build_root/source-head.txt" /opt/thoidai-builds/thoidai-phase1.latest
```

Expected: each command exits 0, in that order. The retained disposable database is never dropped. The build runs in a validated transient unit, reads the two existing root-owned mode-600 environment files without copying or printing them, leaves no loaded transient unit, and creates the candidate `.next` only below `/opt/thoidai-builds`. A known baseline lint error was previously observed at `src/app/assets/new/page.tsx:111`; if it exists in the isolated committed baseline, stop and obtain separate authorization for that unrelated fix. Do not suppress the rule or deploy with a failing gate.

- [ ] **Step 4: Scan the feature diff for secret/log and forbidden-scope markers**

```bash
set -euo pipefail
cd /opt/thoidai-worktrees/thoidai-phase1-authorization
if git diff "$baseline_commit"..HEAD -- . ':!package-lock.json' | grep -E 'SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=|SESSION_SECRET[[:space:]]*=|BEGIN (RSA |OPENSSH )?PRIVATE KEY|console\.(log|warn|error)|NEXT_PUBLIC_SUPABASE_ANON_KEY[[:space:]]*=' >/dev/null; then
  echo "forbidden secret/log marker in feature diff" >&2
  exit 1
fi
if git diff --name-only "$baseline_commit"..HEAD | grep -E '^src/(app|components)/.*page\.tsx$|AppNav|appNavState|provider|9router|CLIProxyAPI' >/dev/null; then
  echo "forbidden UI/routing/provider path in Phase 1" >&2
  exit 1
fi
```

Expected: both scans exit 0 and print no matching content.

- [ ] **Step 5: Verify production preconditions and exact database target**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r backup_root < /opt/thoidai-backups/thoidai-phase1-auth.latest
test "$(systemctl is-active thoidai-work)" = "active"
test "$(systemctl is-active nginx)" = "active"
nginx -t
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = "true"
docker exec supabase_db_thoidai-work pg_isready -U postgres -d postgres
test "$(git diff --cached --name-only | wc -l)" -eq 0
read -r expected_status_hash _ < "$backup_root/post-baseline-status.sha256"
test "$(git status --porcelain=v1 --untracked-files=all | sha256sum | cut -d' ' -f1)" = "$expected_status_hash"
test "$(git merge-base HEAD feat/thoidai-phase1-authorization)" = "$(git rev-parse HEAD)"
```

Expected: services and DB are healthy; root unrelated state matches the post-baseline manifest; feature branch descends from current main.

- [ ] **Step 6: Create recoverable source, build, and full-database backups**

```bash
set -euo pipefail
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
deploy_backup="/opt/thoidai-backups/thoidai-phase1-deploy-$stamp"
install -d -m 0700 "$deploy_backup"
read -r build_root < /opt/thoidai-builds/thoidai-phase1.latest
case "$build_root" in /opt/thoidai-builds/thoidai-phase1-*) ;; *) exit 1 ;; esac
git -C /opt/thoidai-work bundle create "$deploy_backup/source.bundle" --all
tar -C /opt/thoidai-work --dereference -czf "$deploy_backup/active-next.tgz" .next
install -m 0600 /dev/null "$deploy_backup/database.full.dump"
docker exec supabase_db_thoidai-work pg_dump -X -U postgres -d postgres --format=custom > "$deploy_backup/database.full.dump"
pg_restore --list "$deploy_backup/database.full.dump" >/dev/null
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -c "
select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name in ('role_permissions','departments')
order by table_name,ordinal_position;
select p.proname,pg_get_function_identity_arguments(p.oid),
       pg_get_function_result(p.oid),p.prosecdef,
       pg_get_userbyid(p.proowner),coalesce(p.proacl::text,'')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'claim_task_plan','create_bulk_task_plan','report_task_progress',
    'review_task_completion','save_task_evaluation_checkpoint',
    'api_assert_task_action','api_create_task','api_update_task',
    'api_claim_task_plan','api_report_task_progress',
    'api_review_task_completion','api_save_task_evaluation_checkpoint',
    'api_add_task_comment','api_create_bulk_task_plan'
  )
order by p.proname,pg_get_function_identity_arguments(p.oid);
select table_name,grantee,privilege_type
from information_schema.table_privileges
where table_schema='public'
  and table_name in (
    'tasks','task_assignees','task_comments','task_progress_logs',
    'task_evaluation_checkpoints','roles','role_permissions','departments'
  )
order by table_name,grantee,privilege_type;" > "$deploy_backup/affected-object-inventory.txt"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -c "
select
  (select count(*) from public.tasks),
  (select count(*) from public.departments),
  (select count(*) from public.roles),
  (select count(*) from public.role_permissions),
  (select count(*) from public.departments d
    where d.active and nullif(to_jsonb(d)->>'manager_id','') is null),
  (select count(*) from public.departments d
    join public.staff_users u
      on u.id=nullif(to_jsonb(d)->>'manager_id','')::uuid
    where u.department_id<>d.id or not u.active);" > "$deploy_backup/pre-migration-invariants.txt"
IFS='|' read -r pre_tasks pre_departments pre_roles pre_permissions pre_manager_null pre_invalid_manager < "$deploy_backup/pre-migration-invariants.txt"
test "$pre_invalid_manager" -eq 0
systemctl show thoidai-work -p NRestarts --value > "$deploy_backup/nrestarts.before"
printf '%s\n' "$build_root" > "$deploy_backup/build-root.path"
chmod 0600 "$deploy_backup"/*
sha256sum \
  "$deploy_backup/source.bundle" \
  "$deploy_backup/active-next.tgz" \
  "$deploy_backup/database.full.dump" \
  "$deploy_backup/affected-object-inventory.txt" \
  "$deploy_backup/pre-migration-invariants.txt" \
  "$deploy_backup/nrestarts.before" \
  "$deploy_backup/build-root.path" > "$deploy_backup/SHA256SUMS"
chmod 0600 "$deploy_backup/SHA256SUMS"
(cd "$deploy_backup" && sha256sum -c SHA256SUMS)
printf '%s\n' "$deploy_backup" > /opt/thoidai-backups/thoidai-phase1-deploy.latest
chmod 0600 /opt/thoidai-backups/thoidai-phase1-deploy.latest
```

Expected: a mode-0700 backup root contains mode-0600 source/build artifacts, one verified full custom-format database dump, an affected column/function-signature inventory, dynamic aggregate invariants, restart baseline, and passing checksums. Never print or inspect dump contents, copy environment files, or delete this backup. Restoring the full dump is a separate dangerous operation requiring immediate explicit confirmation.

- [ ] **Step 7: Apply exactly one SQL file in one transaction**

Re-run the eleven history checks from Task 2 immediately before this step. Then:

```bash
set -euo pipefail
umask 077
candidate=/opt/thoidai-worktrees/thoidai-phase1-authorization
migration=20260814190000_phase1_authorization_facade.sql
read -r deploy_backup < /opt/thoidai-backups/thoidai-phase1-deploy.latest
test "$(find "$candidate/supabase/migrations" -maxdepth 1 -name '20260814190000_*.sql' | wc -l)" -eq 1
sha256sum "$candidate/supabase/migrations/$migration" | tee "$deploy_backup/phase1-migration.sha256"
chmod 0600 "$deploy_backup/phase1-migration.sha256"
docker cp "$candidate/supabase/migrations/$migration" "supabase_db_thoidai-work:/tmp/$migration"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres --single-transaction -v ON_ERROR_STOP=1 -f "/tmp/$migration"
```

Expected: exactly one file is copied/applied; psql exits 0. The migration does not edit `supabase_migrations.schema_migrations`; this plan therefore does not claim history reconciliation for the new operational patch and continues to prohibit automated migration runners until the separate history owner records/verifies it under an approved runbook.

- [ ] **Step 8: Verify production database invariants without identities**

```bash
set -euo pipefail
read -r deploy_backup < /opt/thoidai-backups/thoidai-phase1-deploy.latest
post_invariants="$deploy_backup/post-migration-invariants.txt"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -c "
select
  (select count(*) from public.tasks),
  (select count(*) from public.departments),
  (select count(*) from public.roles),
  (select count(*) from public.role_permissions),
  (select count(*) from public.departments where active and manager_id is null),
  (select count(*) from public.departments d join public.staff_users u on u.id=d.manager_id where u.department_id<>d.id or not u.active),
  (select count(*) from public.roles r left join public.role_permissions rp on rp.role_id=r.id where rp.role_id is null),
  (select count(*) from information_schema.columns where table_schema='public' and table_name='role_permissions' and column_name in ('can_assign_task','can_view_department_tasks','can_evaluate_step1','can_evaluate_step2','can_manage_rubrics'));" > "$post_invariants"
chmod 0600 "$post_invariants"
IFS='|' read -r pre_tasks pre_departments pre_roles pre_permissions pre_manager_null pre_invalid_manager < "$deploy_backup/pre-migration-invariants.txt"
IFS='|' read -r post_tasks post_departments post_roles post_permissions post_manager_null post_invalid_manager post_missing_permissions post_new_columns < "$post_invariants"
test "$post_tasks" -eq "$pre_tasks"
test "$post_departments" -eq "$pre_departments"
test "$post_roles" -eq "$pre_roles"
test "$post_permissions" -ge "$pre_permissions"
test "$post_manager_null" -le "$pre_manager_null"
test "$pre_invalid_manager" -eq 0
test "$post_invalid_manager" -eq 0
test "$post_missing_permissions" -eq 0
test "$post_new_columns" -eq 5
sha256sum "$post_invariants" >> "$deploy_backup/SHA256SUMS"
(cd "$deploy_backup" && sha256sum -c SHA256SUMS)
```

Expected: task, department, and role counts equal their captured pre-migration values; permission rows never decrease; active departments without a manager may only decrease; invalid managers and roles missing permission rows are zero; all five new columns exist. Any mismatch stops before application deployment; do not attempt a destructive down migration.

- [ ] **Step 9: Fast-forward source only after overlap proof**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r backup_root < /opt/thoidai-backups/thoidai-phase1-auth.latest
while IFS= read -r path; do
  test -z "$(git status --porcelain=v1 -- "$path")"
done < /tmp/thoidai-phase1-feature.paths
test "$(git diff --cached --name-only | wc -l)" -eq 0
git merge --ff-only feat/thoidai-phase1-authorization
test -z "$(git diff --name-only feat/thoidai-phase1-authorization HEAD)"
read -r expected_status_hash _ < "$backup_root/post-baseline-status.sha256"
test "$(git status --porcelain=v1 --untracked-files=all | sha256sum | cut -d' ' -f1)" = "$expected_status_hash"
```

Expected: fast-forward succeeds; main and feature branch match; unrelated dirty fingerprint is unchanged. Never use reset, checkout overwrite, clean, or stash.

- [ ] **Step 10: Swap only the verified build and restart the single slot**

```bash
set -euo pipefail
read -r deploy_backup < /opt/thoidai-backups/thoidai-phase1-deploy.latest
read -r build_root < "$deploy_backup/build-root.path"
read -r candidate_next < "$build_root/candidate-next.path"
read -r build_head < "$build_root/source-head.txt"
case "$build_root" in /opt/thoidai-builds/thoidai-phase1-*) ;; *) exit 1 ;; esac
case "$candidate_next" in "$build_root"/*/.next) ;; *) exit 1 ;; esac
test "$(git -C /opt/thoidai-work rev-parse HEAD)" = "$build_head"
test -f "$candidate_next/BUILD_ID"
rollback_root="$build_root/rollback"
install -d -m 0755 "$rollback_root"
test -f /opt/thoidai-work/.next/BUILD_ID
if test -L /opt/thoidai-work/.next; then
  previous_next=$(readlink -f /opt/thoidai-work/.next)
  case "$previous_next" in /opt/thoidai-builds/*) ;; *) exit 1 ;; esac
  previous_next_mode=link
elif test -d /opt/thoidai-work/.next; then
  previous_next="$rollback_root/.next"
  test ! -e "$previous_next"
  previous_next_mode=directory
else
  exit 1
fi
test "$previous_next" != "$candidate_next"
systemctl stop thoidai-work
if test "$previous_next_mode" = link; then
  unlink /opt/thoidai-work/.next
else
  mv /opt/thoidai-work/.next "$previous_next"
fi
test -f "$previous_next/BUILD_ID"
ln -s "$candidate_next" /opt/thoidai-work/.next
test "$(readlink -f /opt/thoidai-work/.next)" = "$candidate_next"
printf '%s\n' "$previous_next" > "$deploy_backup/previous-next.path"
printf '%s\n' "$candidate_next" > "$deploy_backup/active-next.path"
chmod 0600 "$deploy_backup/previous-next.path" "$deploy_backup/active-next.path"
sha256sum "$deploy_backup/previous-next.path" "$deploy_backup/active-next.path" >> "$deploy_backup/SHA256SUMS"
(cd "$deploy_backup" && sha256sum -c SHA256SUMS)
systemctl start thoidai-work
systemctl is-active --quiet thoidai-work
```

Expected: short single-slot downtime; the root contains only a `.next` symlink, while candidate, active, and epoch-aware rollback build directories all remain under `/opt/thoidai-builds`. Their exact paths are retained as root-only metadata. No `.next.pre-*` or `.next.failed-*` directory is created in the dirty Git root.

- [ ] **Step 11: Run public/local HTTP and authorization health gates**

```bash
set -euo pipefail
read -r deploy_backup < /opt/thoidai-backups/thoidai-phase1-deploy.latest
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/login)" = "200"
test "$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/login)" = "200"
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/api/auth/session)" = "401"
test "$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/api/auth/session)" = "401"
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/api/tasks)" = "401"
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:3001/api/tasks/report)" = "403"
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' -X POST -H 'origin: http://127.0.0.1:3001' -H 'host: 127.0.0.1:3001' -H 'content-type: application/json' --data '{}' http://127.0.0.1:3001/api/tasks/report)" = "401"
read -r nrestarts_before < "$deploy_backup/nrestarts.before"
nrestarts_after=$(systemctl show thoidai-work -p NRestarts --value)
[[ "$nrestarts_before" =~ ^[0-9]+$ && "$nrestarts_after" =~ ^[0-9]+$ ]]
test "$nrestarts_after" -eq "$nrestarts_before"
printf '%s\n' "$nrestarts_after" > "$deploy_backup/nrestarts.after"
chmod 0600 "$deploy_backup/nrestarts.after"
sha256sum "$deploy_backup/nrestarts.after" >> "$deploy_backup/SHA256SUMS"
(cd "$deploy_backup" && sha256sum -c SHA256SUMS)
test "$(journalctl -u thoidai-work --since '10 minutes ago' -p err --no-pager --output=cat | wc -l)" -eq 0
nginx -t
```

Expected: login 200 local/public; verified unauthenticated session/read contract 401; missing-origin mutation 403; same-origin unsigned mutation 401; `NRestarts` has not increased from its captured baseline; zero service error journal lines; nginx syntax valid.

- [ ] **Step 12: Report the complete VPS health matrix**

Collect and report only aggregates:

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

Report fields exactly: VPS, STATUS, CPU, RAM, DISK, LOAD, SERVICES, DOCKER, NGINX, DATABASE, WARNINGS, ERRORS, and RECOMMENDED ACTION. Mark unavailable components as not installed/not applicable. Never print log bodies, identities, task titles, or credentials.

- [ ] **Step 13: Execute immediate application rollback if any health gate fails**

Database changes are additive and remain in place. Roll back only the application build first:

```bash
set -euo pipefail
read -r deploy_backup < /opt/thoidai-backups/thoidai-phase1-deploy.latest
read -r candidate_next < "$deploy_backup/active-next.path"
read -r previous_next < "$deploy_backup/previous-next.path"
case "$candidate_next" in /opt/thoidai-builds/*) ;; *) exit 1 ;; esac
case "$previous_next" in /opt/thoidai-builds/*) ;; *) exit 1 ;; esac
test -L /opt/thoidai-work/.next
test "$(readlink -f /opt/thoidai-work/.next)" = "$candidate_next"
test -f "$previous_next/BUILD_ID"
systemctl stop thoidai-work
unlink /opt/thoidai-work/.next
ln -s "$previous_next" /opt/thoidai-work/.next
test "$(readlink -f /opt/thoidai-work/.next)" = "$previous_next"
printf '%s\n' "$previous_next" > "$deploy_backup/rollback-active-next.path"
chmod 0600 "$deploy_backup/rollback-active-next.path"
sha256sum "$deploy_backup/rollback-active-next.path" >> "$deploy_backup/SHA256SUMS"
(cd "$deploy_backup" && sha256sum -c SHA256SUMS)
systemctl start thoidai-work
systemctl is-active --quiet thoidai-work
test "$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/login)" = "200"
```

Expected: the retained epoch-aware pre-Phase-1 build under `/opt/thoidai-builds` recovers service while tolerating additive columns/functions. The failed candidate and every backup remain intact outside the dirty root. Source rollback is a separate reviewed action: use path-reviewed `git revert` of feature commits only after explicit authorization; never reset the dirty root. Full-database restore is not part of this automatic rollback and requires immediate explicit confirmation.

- [ ] **Step 14: Record final execution evidence**

Record:

- baseline commit ID and its exact 18-path manifest/checksums;
- each feature commit ID and path list;
- final HEAD/tree/BUILD_ID hashes;
- migration SHA-256 and psql single-transaction exit;
- disposable and production SQL test outputs containing only aggregates;
- Node test pass/fail totals, TypeScript/lint/build exits;
- root post-baseline status count/hash before and after merge/deploy;
- backup path/modes, full-dump `pg_restore --list`, affected-object inventory, and checksum verification without dump-content inspection;
- external active/candidate/rollback `.next` paths and BUILD_ID hashes;
- HTTP codes, service restart counts before/after, journal warning/error counts, and the full health matrix;
- confirmation that no UI/navigation, anonymous revoke, migration-history manipulation, password/session epoch, provider/model, CLIProxyAPI, or `9router` change occurred.

## Execution handoff

This draft must remain uncommitted until primary self-review approves its file map, SQL signatures, and deployment gates. After approval, execute by one of the required methods:

1. **Subagent-Driven (recommended):** invoke `superpowers:subagent-driven-development`, one fresh worker per task with two-stage review.
2. **Inline:** invoke `superpowers:executing-plans`, execute tasks in numbered batches with review checkpoints.

Do not begin Task 1 merely because this draft exists.
