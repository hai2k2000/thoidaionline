# JOURNALISM TASKS J2 REPORT

Status: reconstructed on a fresh branch; awaiting owner review. No production deployment or migration was performed.

## A. Branch and base

- Worktree: `/opt/worktrees/journalism-tasks-j2-schema-read-v2`
- Branch: `journalism-tasks-j2-schema-read-v2`
- Exact base: `13067f564cd7c1988e0f189a00d3cac4c5ed8b1d`
- Base subject: `feat: implement narrow org rbac reconciliation r2`
- Frozen forensic reference: `/opt/worktrees/journalism-tasks-j2-schema-read`
- Frozen forensic HEAD: `656aa295bc49c07772abcfbc778a08f5fda7f590`

## B. Documentation integration

The exact documentation-only diff from `3b7f865b7722e9a67e17a7a4d845f1ccc8ede407` was inspected. Only these approved files were brought into the fresh branch:

- `JOURNALISM_TASKS_DESIGN.md`
- `JOURNALISM_TASKS_J1_CONTRACT.md`

No R2 production source was overwritten.

## C. Forensic worktree preservation and reuse accounting

The old worktree remains unchanged and dirty as evidence:

- Four original modified files remain modified.
- `src/lib/journalismTaskRead.test.mjs` remains untracked.
- HEAD and all five old-worktree SHA-256 values are unchanged.

| Concept/file | Disposition | Reason |
|---|---|---|
| Journalism DTO shapes | REUSED CONCEPT, REWRITTEN | Ported onto current R2 contracts; nullable normal-task behavior preserved. |
| Filter parsing/serialization | REUSED CONCEPT, REWRITTEN | Added bounded positive/invalid behavior tests on current baseline. |
| Repository composition | REWRITTEN | Preserved current R2 `scopeTerms`; added dynamic embedded relation and `!inner` only for parent-reducing Journalism filters. |
| Old migration `20260917190000...` | DISCARDED | Chronologically before R2; replaced with new post-R2 migration. |
| Old static schema/read tests | DISCARDED/REWRITTEN | Removed hard-coded worktree paths; added portable and isolated behavior coverage. |

## D. Files changed

Modified:

- `src/lib/taskContracts.ts`
- `src/lib/taskFilters.mjs`
- `src/lib/taskFilters.test.mjs`
- `src/lib/taskRepository.ts`

Added:

- `supabase/migrations/20260918100000_journalism_tasks_j2_schema.sql`
- `src/lib/journalismTaskSchema.test.mjs`
- `src/lib/journalismTaskFiltersBehavior.test.mjs`
- `src/lib/journalismTaskReadBehavior.test.mjs`
- `work/j2_isolated_schema_test.sql`
- `work/j2_isolated_read_test.sql`
- `work/j2_isolated_tests_README.md`

No Journalism UI, create endpoint, metadata mutation, publication mutation, RPC, grant, recurrence, CMS, Topics, or Series code was added.

## E. Migration

- Filename: `20260918100000_journalism_tasks_j2_schema.sql`
- SHA-256: `ab08481bcef699e3372209de701ed3a4c45e6c2f45ec3f905bdd7b79d2a1cab7`
- Version is strictly after manually applied R2 version `20260917200000`.
- Old `20260917190000_journalism_tasks_j2_schema.sql` was not reused.
- R2 `20260917200000_org_rbac_r2_tbt_label.sql` remains MANUALLY_APPLIED_OUTSIDE_LEDGER and was not replayed or registered.
- Unresolved legacy versions were not replayed.
- `supabase db push` and `supabase db reset` were not run.

## F. Schema and seeds

Created only:

- `public.journalism_work_kinds`
- `public.journalism_task_details`

The task remains the sole Journalism discriminator: a detail row exists or does not exist. No `task_domain`, `task_kind`, CMS, Topics, Series, or source/contact columns were introduced.

The migration seeds exactly ten deterministic rows:

`news`, `article`, `interview`, `reportage`, `photo`, `video`, `event_coverage`, `editing`, `translation`, `other` with sort orders 10 through 100 and the approved Vietnamese names.

## G. Constraints, indexes, and timestamps

- Code is unique, trimmed, lowercase snake_case, non-empty, max 64.
- Name is trimmed/non-empty, max 200.
- Description max 2000.
- Sort order is non-negative.
- Detail FK to `tasks(id) ON DELETE CASCADE`, matching approved J1 behavior.
- Work-kind FK is `ON DELETE RESTRICT`.
- Detail is one-to-one through primary key `task_id`.
- Publication states are `not_published`, `scheduled`, `published`, `withdrawn` with required timestamp invariants.
- Location max 500; editorial notes max 10000; article URL max 2048 and only non-null for published/withdrawn with safe HTTP/HTTPS minimum validation.
- Indexes: work kind, publication status, and partial planned-publication timestamp.
- No existing generic updated-at helper was present in current migrations; the migration introduces one generic `touch_journalism_updated_at()` helper with fixed `search_path`, used by both new tables.

## H. RLS and grants

- RLS enabled on both new tables.
- Direct `public`, `anon`, and `authenticated` table privileges revoked.
- CRUD granted only to `service_role`.
- Function execute access is revoked from public/anon/authenticated and granted to service role.
- No new RBAC permission or role grant was added.
- Parent Task authorization remains mandatory because service-role access bypasses RLS.

## I. DTO and read composition

- Task list adds `journalism: JournalismTaskListSummaryDto | null`.
- Task detail adds `journalism: JournalismTaskDetailDto | null`.
- Normal tasks normalize to `journalism = null`.
- Journalism detail is composed through the existing task repository.
- Detail handler order remains authenticate -> parent Task `view` guard -> repository detail -> response.
- No direct Journalism detail API exists.

## J. Parent-filter implementation

- Existing RBAC/legacy `scopeTerms` remains the outer visibility boundary.
- No Journalism filter creates a second visibility path.
- No filter: normal and Journalism tasks remain eligible under existing scope.
- `journalism=only`, work-kind, publication-status, and planned-time filters use a dynamic PostgREST embedded relation with `!inner`, so parent rows are reduced in the database.
- `journalism=exclude` uses the parent relation-null predicate.
- Ordering and `.range(from,to)` remain server-side.
- Child relation is normalized one-to-one; no per-task Journalism query loop is used.

## K. Isolated database proof

A disposable PostgreSQL 17 container was used; it was removed after each run. Production database was never used for test writes.

Schema/security behavior passed:

- Exact ten seeds.
- Trimmed blank code/name rejection.
- Invalid code rejection.
- Duplicate detail rejection.
- FK and referenced-kind delete restriction.
- Scheduled-state invariant.
- Anonymous read denial.
- Authenticated read/write denial.
- Service-role read path.
- Normal task requires no detail.

Read/filter behavior passed:

- No-filter parent count: 3.
- Journalism-only parent count: 2.
- Normal-only parent count: 1.
- Work-kind filter count: 1.
- Publication-status filter count: 1.
- Planned-date filter count: 1.
- Authorized owner scope count: 1.
- Pagination count, deterministic ordering, and no duplicate parent rows passed.

## L. Tests and regression

Targeted J2 + R2/task/attendance/leave/schedule/online-work/duty/evaluation/admin suite:

- 121 tests passed, 0 failed.

Focused post-compatibility repository gate:

- 24 tests passed, 0 failed.

Full repository test sweep:

- 347 tests total.
- 334 passed.
- 13 failed.
- Baseline comparison from clean R2 `13067f...`: 338 tests total, 325 passed, 13 failed.
- Therefore the 13 full-sweep failures are pre-existing baseline failures, not new J2 branch-only failures.

Baseline failures are separately identified in the execution log; they are unrelated legacy UI/login/staff-ordering/document-route tests. No new J2 failure was introduced.

## M. Validation gates

- `npm ci`: PASS, 0 vulnerabilities.
- TypeScript `npx tsc --noEmit`: PASS.
- Changed-file ESLint: PASS, 0 errors and 0 warnings.
- `git diff --check`: PASS.
- Production-safe Webpack build: PASS, exit code 0, 91/91 static pages generated.
- Build used only non-secret values:
  `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid`
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key`
  `SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key`
  `SESSION_SECRET=dummy-session-secret`

No production secret was copied into the worktree.

## N. R2 preservation

All required R2 files are present in the fresh branch:

- `src/app/api/users/route.ts`
- `src/app/users/page.tsx`
- `src/lib/userReconciliationValidation.mjs`
- `src/lib/orgRbacR2.test.mjs`
- `supabase/migrations/20260917200000_org_rbac_r2_tbt_label.sql`

R2 focused suite passed 9/9.

## O. Production state

Read-only production inspection returned no rows for:

- `public.journalism_work_kinds`
- `public.journalism_task_details`
- migration ledger version `20260918100000`

Therefore:

- Production migration: **NOT APPLIED**
- Production deployment: **NOT DEPLOYED**
- `/opt/thoidai-work`: untouched
- Production service/RBAC: unchanged

## P. Rollback design

J2 is additive. Before any future approved activation, disable application surfaces first and verify no Journalism data exists. Existing `tasks` rows remain authoritative. Any future schema rollback must be separately approved; do not reinterpret or delete normal tasks.

## Q. Risks and blockers

- Actual production activation is intentionally out of scope and not approved by this report.
- The PostgREST relation behavior is covered by isolated parent-row SQL characterization and the repository uses `!inner` for reducing filters; a future integration environment should still exercise the exact Supabase REST endpoint before production.
- Journalism creation and inactive-work-kind enforcement remain future mutation-checkpoint responsibilities; J2 exposes no creation path.
- Full repository sweep retains 13 known baseline failures; owner should keep them separate from J2 acceptance.

## R. GO/NO-GO

- J2 reconstruction/build/test gates: **GO for owner review**.
- Production schema approval: **WAIT FOR OWNER REVIEW**.
- Production migration/deployment: **NO-GO in this checkpoint**.
- J3: **NOT STARTED**.
