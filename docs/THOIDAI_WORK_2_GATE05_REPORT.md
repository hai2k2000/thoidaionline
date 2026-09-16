# Thoi Dai Work 2.0 - Gate 0.5 Reconciliation Report

Date: 2026-09-16 (Asia/Bangkok)

Scope: source/migration/baseline reconciliation only. No RBAC table, `work_kind`, Topic schema, workflow change, migration execution, deployment, or ledger repair was performed.

## A. Source reconciliation result

- Production: `/opt/thoidai-work`, HEAD `8702827389e7e2452681c9e88c8d8ea899856a4c`.
- Clean branch: `gate0-20260916`, based on GitHub `origin/main` at `fb1058b`.
- `src/components/AppNav.tsx`, `src/lib/workScheduleRepository.ts`, `src/lib/attendanceBridgeSignature.ts`, `src/lib/leaveApprovalRange.test.mjs`, and `supabase/migrations/20260915120000_personal_work_plans.sql` in production match the clean branch after line-ending normalization. They do not need blind copying.
- `deploy/systemd/thoidai-work.service` is a legitimate production hardening change: dedicated `thoidai-work` user/group, localhost binding, systemd sandboxing, and explicit writable paths. It is committed separately in this reconciliation branch; it was not deployed from this branch.
- `PROJECT_STATUS.md` has factual production-only history but also stale/conflicting claims. It is intentionally not auto-merged; manual editorial merge is required.
- `.next.before-20260915T083000Z/` and other build/runtime artifacts remain excluded from Git.

Dependency chain verified: attendance bridge signature -> `attendanceBridgeAuth` -> attendance sync routes -> Windows bridge tests; personal plans migration -> work-schedule repository/API/UI -> personal-work-schedule tests. No orphaned production-only code was found in the reviewed set.

## B. Commits to merge to `main`

1. `82dcee5` - Gate 0 report (already on branch).
2. This Gate 0.5 reconciliation commit - systemd non-root hardening and lockfile reconciliation.
3. `PROJECT_STATUS.md` should be merged manually after owner review; no automatic merge is proposed.

No production deployment is authorized by this report.

## C. Migration verification matrix

Live ledger ends at `20260901095000`. SQL SHA-256 hashes below were calculated from the clean branch files.

| version | filename | sql_hash | classification | objects_expected / verified | data expected / verified | superseded_by | safe_to_register | reason |
|---|---|---|---|---|---|---|---|---|
| 20260909110000 | attendance_sync.sql | `9a2a7d58...d341b2f8` | VERIFIED_APPLIED | attendance code/tables/indexes/RLS/ACL all verified | 24 mapped codes verified | 20260911170000, 20260911230000 | YES after second review | live objects and grants match combined final state |
| 20260909121500 | seed_online_work_september.sql | `63b86c78...48438cb90` | NEEDS_REVIEW | RPC path exists; exact seed result not attributable | 24 active + 48 cancelled September rows, exact payload not provable | later schedule changes | NO | one-time seed provenance unresolved |
| 20260909143000 | allow_hongninh_duty_editor.sql | `00f88d6b...de61928b9` | NEEDS_REVIEW | function/index behavior superseded by three-position version | embedded seed cannot be independently proven | 20260909170000 | NO | historical function version is superseded |
| 20260909170000 | three_position_duty_roster.sql | `78044fb8...37c0244` | VERIFIED_APPLIED | 3-position constraint/index/function verified | active duty rows use exactly 3 positions; cancelled legacy rows retained | later duty fixes | YES after second review | live state matches intended final objects |
| 20260910090000 | leave_requests.sql | `5967149c...e08204b6` | VERIFIED_APPLIED | table/indexes/RLS/ACL/create-review-cancel RPCs verified | 4 leave rows present | 20260910150000, 20260911133000 | YES after second review | complete object and API evidence |
| 20260910150000 | long_leave_tbt_approval.sql | `d8e9961c...6b251ab2e` | VERIFIED_APPLIED | review RPC contains 3+ day TBT rule | rule present in live definition | 20260911133000 | YES after second review | later function preserves rule |
| 20260911083000 | fix_first_login_default_password.sql | `9b7cf308...3f5aeb7` | NEEDS_REVIEW | trigger verified | exact one-time repair set not reconstructable; exact audit action count 0 | 20260911190000 | NO | historical data effect not provable |
| 20260911110000 | enable_deputy_department_assignment.sql | `216a8c59...fffbfcb3` | VERIFIED_APPLIED | deputy role permission row/flags verified | one qualifying permission row | 20260911180000 | YES after second review | live role permission matches |
| 20260911133000 | scope_leave_review_to_department.sql | `39d7c00b...7e0a985` | VERIFIED_APPLIED | review RPC scope verified | no additional seed | none | YES after second review | live definition matches |
| 20260911150000 | lock_task_completion_scores.sql | `cd5906ad...facb9135` | VERIFIED_APPLIED | RLS and public-role revoke verified; service role retained | none | none | YES after second review | ACL/RLS state matches |
| 20260911170000 | atomic_attendance_completion.sql | `f62078db...110f5bb` | VERIFIED_APPLIED | `completing` constraint and active index verified | none | 20260911230000 | YES after second review | live constraint/index match |
| 20260911180000 | align_deputy_assignment_reviewer.sql | `d7659e0f...fa4b2555` | VERIFIED_APPLIED | assignment RPC definition and service-role ACL verified | none | none | YES after second review | live function matches |
| 20260911190000 | enforce_first_login_password_change.sql | `35e6dc26...a1fb8bb2` | NEEDS_REVIEW | column/trigger/password RPCs verified | 20 users flagged now; historical target set not provable | none | NO | one-time update provenance unresolved |
| 20260911230000 | atomic_attendance_log_merge.sql | `035ec31e...c21a9829` | VERIFIED_APPLIED | merge RPC and service-role ACL verified | 44 logs present | none | YES after second review | live function matches |
| 20260915120000 | personal_work_plans.sql | `c59379e1...99555a1` | VERIFIED_APPLIED | columns, constraints and range index verified | 4 legacy rows normalized; no September rows in this table | none | YES after second review | live schema exactly contains migration effects |

`VERIFIED_APPLIED` means object/data evidence is sufficient for a proposed later ledger insert, not that the ledger was changed now. Four entries remain `NEEDS_REVIEW`; none is marked applied in the live ledger.

## D. Ledger repair proposal/result

Result: **no ledger repair performed**. Before any future repair, take fresh full dump/schema/ledger backups, record SQL hashes and verification evidence, then insert only independently verified versions. Do not replay SQL. Keep unresolved seed/one-time migrations unregistered. If current state needs correction, create a new forward-only reconciliation migration.

## E. Test failure triage

Current run: 352 tests, 319 pass, 33 fail.

- A - pre-existing/branch drift: navigation, evaluation UI, staff ordering, task-detail wording and login redirect contract failures. These reflect current `main` versus historical contract expectations and are not evidence to rewrite production behavior.
- B - obsolete tests: examples include `/uploads/:path*` matcher expectation and old login redirect literal; update tests only after owner confirms the current routing contract.
- C - behavior changed without test update: leave/online-work wording and newer schedule/navigation labels.
- D - actual bug candidates: lint errors in `public-evaluation-summary` (`any`), React effect state updates, and any authorization assertion that fails against intended behavior. These require separate fixes and targeted review.
- E - environment dependent: build without Supabase variables; resolved for baseline with non-secret dummy values. No production secret was used.

No test was changed merely to make the suite green. A per-test file triage is retained as the next engineering task; the failing list is recorded by the TAP run in the Gate 0.5 work log.

## F. Dependency/lockfile status

- No dependency versions were upgraded.
- `package.json` and lockfile were out of sync because optional platform packages were missing from `package-lock.json`.
- `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` regenerated only lock metadata for the already-declared dependency graph.
- Fresh `npm ci --ignore-scripts --no-audit --no-fund` now succeeds in the clean worktree.
- Lockfile diff contains optional platform packages; no application dependency version change is present.

## G. Clean build result

`npm run build` succeeds with non-secret build-safe values:

`NEXT_PUBLIC_SUPABASE_URL=https://example.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-build-value`, `SUPABASE_SERVICE_ROLE_KEY=dummy-build-value`, `SESSION_SECRET=dummy-build-session-secret`.

The build compiles and generates all 92 static pages. It emits three existing HR upload dynamic-filesystem tracing warnings. No production credential was logged or stored.

## H. Authenticated smoke baseline

Production unauthenticated probes remain healthy: `/login` is 200; protected task, attendance, leave and schedule APIs return 401. Authenticated role-by-role smoke was not executed because no test credentials/session were provided. Manual checklist is: employee, department manager, leadership and admin each verify login, task list/detail/assign/complete/return/resubmit/approve/score, personal/organization attendance and sync, leave/trip approval, duty/online/personal schedules, and forbidden cross-scope access.

## I. `audit_direct_assignment_start` grant review

Function is a `SECURITY DEFINER` trigger function on `tasks`; trigger `tasks.audit_direct_assignment_start` invokes it. The function itself is not an application RPC caller. PUBLIC/anon/authenticated execute grants are therefore unnecessary, but revoke safety should be proven in a staging clone before production change. Proposed separate migration: revoke execute from PUBLIC/anon/authenticated, retain owner/service role as required, then verify task insert/update trigger behavior. Not changed in Gate 0.5.

## J. Backup/checksum before metadata repair

Existing Gate 0 backup remains valid at `/opt/thoidai-work-backups/gate0-20260916T020734Z/`; no metadata repair was attempted, so a new pre-repair backup was not required. Before any future ledger insert, create a fresh timestamped backup set and verify checksums again.

## K. Open risks and decision

- Four migration histories remain unresolved and must not be marked applied.
- Source status document needs manual merge.
- 33 contract/UI test failures and 25 lint errors remain.
- Authenticated production smoke evidence is absent.
- Public grant on the trigger function remains open.

**NO-GO for Phase 1A RBAC 2.0.** Stop here and await review approval.
