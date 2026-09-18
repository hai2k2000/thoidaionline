# Journalism Topics / Series - J5C Report

Status: **J5C DONE - J5D READY FOR OWNER APPROVAL**

Scope completed: approved Topics/Series management permissions, narrow structure authorization, atomic server-only Topic/Series create/update/archive RPCs, required audit events, server mutation routes, isolated PostgreSQL tests, and regression/build gates. No UI, association mutation, reorder, production migration, or deployment was performed.

## A. Branch and Worktree

- Branch: `journalism-j5c-structure-management`
- Worktree: `/opt/worktrees/journalism-j5c-structure-management`
- Base/J5B commit: `258ca393f82950591819827ad4b10e40d05fd775`
- Worktree was created separately from production; production checkout was not touched.

## B. Exact J5B Baseline

- J5A docs commit: `60cb188c8a7c0b364633ea2c55ec610aaf7e7eb9`
- J5B commit: `258ca393f82950591819827ad4b10e40d05fd775`
- J5B migration: `20260918130000_journalism_topics_series_j5_read.sql`
- J5B migration SHA-256: `7d85abec0110efb0421a79a4a95d2bd45914b203c00e0995defa22024b650517`
- J5B migration git blob: `a5b165612848e7f163166a050a5ef57e87a9180e`
- J5B migration was applied only to disposable PostgreSQL for verification.

## C. Files Changed

- `supabase/migrations/20260918140000_journalism_topics_series_j5_management.sql`
- `supabase/tests/journalism_topics_series_j5c_management.sql`
- `src/lib/journalismStructureAuthorization.ts`
- `src/lib/journalismStructureHandlers.ts`
- `src/app/api/journalism/topics/route.ts`
- `src/app/api/journalism/topics/[topicId]/route.ts`
- `src/app/api/journalism/topics/[topicId]/archive/route.ts`
- `src/app/api/journalism/series/route.ts`
- `src/app/api/journalism/series/[seriesId]/route.ts`
- `src/app/api/journalism/series/[seriesId]/archive/route.ts`
- `journalismStructureManagement.test.mjs`

No UI, Task association, reorder, grant-editing UI, or unrelated module was changed.

## D. Migration Filename / Version

- Filename: `20260918140000_journalism_topics_series_j5_management.sql`
- Version: strictly later than all repository migrations present at implementation time.

## E. Migration SHA / Blob

- SHA-256: `7f63d84075130634087f21e81380c55fe3a2734a2584dd312e660ee1c205b8fe`
- Git blob: `3619e959caad32b3cf9ff92d81a12e3c4e004d43`

## F. Permission Catalog Additions

Exactly two permissions were added:

- `journalism.structure.manage`
- `journalism.structure.assign`

No operation-specific Topic/Series permissions were added.

## G. Exact Grant Matrix

| Permission | Role | Scope |
|---|---|---|
| journalism.structure.manage | admin | all |
| journalism.structure.manage | tong_bien_tap | all |
| journalism.structure.manage | pho_tong_bien_tap | all |
| journalism.structure.manage | truong_phong | department |
| journalism.structure.manage | pho_truong_phong | department |
| journalism.structure.assign | admin | all |
| journalism.structure.assign | tong_bien_tap | all |
| journalism.structure.assign | pho_tong_bien_tap | all |
| journalism.structure.assign | truong_phong | department |
| journalism.structure.assign | pho_truong_phong | department |
| journalism.structure.assign | phong_vien | assigned |
| journalism.structure.assign | nhan_vien | assigned |

Isolated post-J5C totals: **21 permissions / 140 grants**. No self grants and no inactive compatibility-role grants.

## H. Isolated Canonical Grant Hash

Canonical serialization used the actual isolated 140-row set, sorted by UTF-8 `(role_code, permission_code, scope)`, LF-separated with no final newline.

- Byte length: `5354`
- SHA-256: `38001df3dfb0751f1288033bf415251a8314e0866caf5dfa231c10f7b0772638`
- This is a projected isolated J5C hash, not a production hash.

## I. Structure Authorization Model

`journalismStructureAuthorization.ts` evaluates effective grants against a structure-shaped resource containing only `departmentId`; it does not reuse or pretend that Topic/Series is a Task resource. `all` permits global or department structures. `department` permits only a non-null structure department equal to the actor department. Authorization is grant-based, not browser role-name based.

## J. Immutable Department Ownership

Create accepts `departmentId`. Topic and Series metadata update routes do not accept `departmentId`; unknown fields, including ownership-transfer attempts, are rejected. No ownership-transfer RPC exists.

## K. Topic API / RPC Contracts

- `POST /api/journalism/topics`: allowlist `name`, `description`, `departmentId`.
- `PATCH /api/journalism/topics/{topicId}`: allowlist `name`, `description`; partial update and true no-op semantics.
- `POST /api/journalism/topics/{topicId}/archive`: explicit active-to-archived action.
- RPCs lock target rows where mutation requires it, validate active actor/grant/scope, normalize bounded text, write audit in the same transaction, and return the authoritative row.
- No hard delete, restore, or reactivation.

## L. Series API / RPC Contracts

- `POST /api/journalism/series`: allowlist `name`, `description`, `departmentId`, `topicId`.
- `PATCH /api/journalism/series/{seriesId}`: allowlist `name`, `description`, `topicId`; no `departmentId`.
- `POST /api/journalism/series/{seriesId}/archive`: explicit active-to-archived action.
- No append, detach, move, or reorder operation.

## M. Archive Semantics

Archive is terminal for J5C management v1. Repeated archive and archived metadata update return conflict. Topic archive does not cascade to child Series.

## N. Topic / Series Compatibility

J5B compatibility triggers remain authoritative. A new or changed Series parent must be active. Global Topic is compatible with global or department Series; a department Topic is compatible only with the same department Series. Existing Series may retain an archived Topic historically.

## O. Active-Name Conflict Behavior

J5B partial unique indexes remain authoritative for normalized active names by ownership scope. Database conflicts map through the existing RPC error boundary to a safe conflict response; SQLSTATE, constraint names, and Postgres text are not returned to clients.

## P. Audit Contract / Atomicity

All six operations write `audit_logs` in the same transaction with module `journalism` and explicit entity/action values:

- `create_editorial_topic`, `update_editorial_topic`, `archive_editorial_topic`
- `create_editorial_series`, `update_editorial_series`, `archive_editorial_series`

Audit payloads contain bounded metadata and identifiers, not full long descriptions or secrets. Audit failure aborts the enclosing mutation transaction.

## Q. RPC Security

Every J5C helper/RPC uses a fixed safe `search_path = pg_catalog, public`, is owned by `postgres`, revokes execute from `public`, `anon`, and `authenticated`, and grants execute only to `service_role`. Routes resolve the session actor and never accept actor/role/scope/permission authority from request bodies.

## R. Concurrency

Update/archive RPCs lock target rows with `FOR UPDATE`; parent Topic validation uses a row lock/share lock and database active-name unique indexes remain the final concurrent-create guard. Concurrent conflict is mapped deterministically to safe conflict behavior.

## S. J5B Read Regression

Focused J5B read contract suite remained passing. No read DTO, filter, list pagination, historical archived read, or normal Task Journalism-null behavior was changed.

## T. J3 / J4 Regression

Focused Journalism mutation/read suite: **21/21 PASS**, including J3 mutation contracts, J4 publication/read contracts, J5B reads, J5C route/migration contracts, and Phase 1A workflow authorization.

## U. Task / RBAC / Module Regression

The complete source test run on this branch: **460 tests, 430 pass, 34 fail**. The 34 failures match the existing J5B baseline by test name; they are unrelated pre-existing UI/legacy characterization failures. No new J5C failure was observed. J5C isolated database totals are intentionally 21/140; production remains 19/128.

## V. Full-Suite Classification

Known baseline failures remain classified as pre-existing and outside J5C scope. The new J5C contract tests and isolated SQL tests pass. Any future new failure must be treated as NO-GO.

## W. TypeScript / Lint / Build

- `npm ci`: PASS, 0 vulnerabilities.
- `npx tsc --noEmit`: PASS.
- Changed-file ESLint: PASS, 0 errors and 0 warnings.
- `git diff --check`: PASS.
- Production-safe `npm run build -- --webpack` with non-secret dummy values: PASS, exit code 0. External font retry messages did not prevent successful build.

## X. Production = UNCHANGED

- No deployment, restart, migration application, systemd change, production data change, `supabase db push`, or `supabase db reset` was performed.
- `/opt/thoidai-work` dirty state was not reset, cleaned, stashed, or overwritten.
- Production remains application commit `e5f726dedd480929b6424db55fc083cd6a4afb26`, release `/opt/releases/thoidai-work/e5f726dedd480929b6424db55fc083cd6a4afb26-j4c-20260918T134200Z`, RBAC `19 permissions / 128 grants`, production grant hash `1e87d9404fef719a22f8a4369d871a09df1a93bb46a7d7512c22affe245943bc`.

## Y. Production Data Discrepancy

**PRODUCTION DATA OBSERVATION REQUIRES RECONCILIATION BEFORE J5F**. Earlier owner smoke retained a test Journalism Task while later read-only characterization observed `journalism_task_details = 0`. J5C did not mutate or repair production data.

## Z. Known Limitations

- No management UI or picker API (J5E scope).
- No Task↔Topic/Series association mutation, append, detach, or reorder (J5D scope).
- No restore/reactivation or ownership transfer.
- Existing known source-suite baseline failures remain outside J5C scope.

## AA. GO / NO-GO Recommendation for J5D

**J5C = DONE**

**J5D = READY FOR OWNER APPROVAL**

Production activation is not authorized by this report. Stop here and wait for owner review.
