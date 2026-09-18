# JOURNALISM TASKS J3B REPORT

Date: 2026-09-18 (Asia/Bangkok)

## A. Scope and safety

- Branch/worktree: `journalism-tasks-j3b-mutations` at `/opt/worktrees/journalism-tasks-j3b-mutations`.
- Implementation baseline: `fad1124cad189a8e10e7f3aa1a07631e8ac31f72`.
- Approved contract/docs baseline: `aee1ea65482db0ef05e10499eac568d81933ecdb`.
- Production was not deployed, restarted, migrated, granted new permissions, or mutated.
- Production remained on `/opt/releases/thoidai-work/fad1124cad189a8e10e7f3aa1a07631f72-j2p-envretry-20260918T050842Z`, HEAD `8702827389e7e2452681c9e88c8d8ea899856a4c`, with `TASK_RBAC_V2_ENABLED=true`.

## B. Files changed

- `supabase/migrations/20260918120000_journalism_tasks_j3_mutations.sql`
- Journalism create, metadata, publication routes and authorization/validation helpers.
- `src/lib/rbac/permissionCatalog.ts`, `src/lib/taskContracts.ts`, and policy tests.
- `JOURNALISM_TASKS_J3B_REPORT.md`.

## C. Migration and grant safety

- Migration: `20260918120000_journalism_tasks_j3_mutations.sql`.
- SHA-256: `38a60fc0056a4c0479a5062c412fb5c3a065e15dac6aef30f957690a6efd4ad3`.
- Git blob ID: `137519213a90ca23144d19bae14549fc0bc5adcb`.
- Adds exactly two permissions: `journalism.metadata.update`, `journalism.publication.manage`.
- Adds exactly the approved 12 role/permission/scope tuples; no compatibility-role grants and no `journalism.create`.
- Disposable PostgreSQL gate: permissions `19`, grants `128`, J3 permissions `2`, J3 grants `12`, missing approved tuples `0`, extra J3 tuples `0`.
- New sorted grant tuple SHA-256: `0bc039d7110e1b420349589dfb9f822c766ec3886cfa2f04947e0acab4d4233f`.
- New RPCs are executable by `service_role` only; public/anon/authenticated execute count `0`, service-role count `4`.
- Direct Journalism table ACL for public/anon/authenticated: `0` grants.

## D. Atomic create

- Route: `POST /api/tasks/journalism/assign`.
- Wrapper: `api_assign_journalism_task_v1` reuses `api_assign_task_v2` in the same transaction, inserts detail and bounded audit data, and keeps normal task audit behavior.
- Disposable behavioral gate passed: valid parent/detail/audits, inactive work kind rollback, forced detail-insert rollback, and forced Journalism-audit rollback.
- Recurrence is rejected; initial publication state is always `not_published`; active work kind is required.
- Create remains conjunctive with existing `task.create`, `task.assign`, department/resource checks, participant validation, and RPC validation.

## E. Metadata mutation

- Route: `PATCH /api/tasks/{taskId}/journalism`.
- Allowed fields: `workKindId`, `plannedPublicationAt`, `location`, `editorialNotes`, and expected timestamp for concurrency checking.
- Parent Task access and `journalism.metadata.update` scope are both required; unauthorized Journalism existence is not disclosed.
- Inactive replacement work kinds are rejected; historical inactive kinds remain readable.
- Published/withdrawn planned dates are locked; scheduled tasks require a non-null planned date.
- Audits record only bounded metadata and note lengths; true no-op produces no audit.

## F. Publication mutation

- Route: `POST /api/tasks/{taskId}/journalism/publication`.
- Required permission: `journalism.publication.manage`; metadata permission does not authorize publication.
- Allowed transitions: `not_published -> scheduled/published`, `scheduled -> not_published/published`, `published -> withdrawn`; withdrawn is terminal.
- Scheduled publication requires a planned date; publication preserves planned date; server sets `published_at`; URL is absolute HTTP(S), credential-free, and max 2048 characters.
- Withdrawal requires a trimmed reason of at most 2000 Unicode characters and preserves publication fields.
- Same-state and forbidden transitions return HTTP 409 with `publication_state_conflict`.
- Publication audit failure rollback passed in the disposable gate.

## G. Concurrency and security proofs

- Publication row is locked with `FOR UPDATE` before authoritative state validation.
- Two-connection disposable race passed: first publication committed, incompatible loser received a publication-state conflict.
- Server derives actor from the validated session; browser-supplied actor/role fields are not trusted.
- Security-definer functions use fixed `search_path=public,pg_temp` and are server-only.

## H. Regression gates

- J3B policy + focused authorization/task/RBAC/J2 tests: `77/77 PASS`.
- Existing critical Phase 1A authorization/workflow suite: `55/55 PASS`.
- Module regression suite (attendance, leave, schedule/online work, duty, evaluation admin, permissions UI, admin boundaries): `83/83 PASS`.
- Exact J2 PostgREST read gate: PASS (`no_filter=4`, `only=3`, `exclude=1`, `work_kind=1`, `publication=1`, `planned=2`, `scoped=2`, `page=2`, nested detail normalized as object, count `4`).
- TypeScript: PASS (`npx tsc --noEmit`).
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- Production-safe Webpack build: PASS, exit code `0`, using non-secret dummy values; final BUILD_ID recorded in the worktree as `VjLnfinMG1bR9thHSguC3`.

## I. Known baseline failures

- The broader legacy module run still contains two pre-existing evaluation UI wording/capability contract failures (`evaluationUi.test.mjs`); they are unrelated to J3B and were not changed.
- No J3B security, migration, authorization, atomicity, concurrency, or build failure remains in the required focused gates.

## J. Production status and recommendation

- Production is unchanged and healthy; `/login` returned `200`, service remained active, and no production migration or restart was performed.
- J3B is implementation-complete for isolated review.
- Recommendation: **GO for owner review of J3B; NO production activation in this checkpoint.**
- Do not start J3C, deploy, apply the migration, or alter production grants without a separate owner approval.
