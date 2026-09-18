# Journalism Topics / Series - J5B Report

Status: **J5B DONE - READY FOR OWNER APPROVAL OF J5C**

Scope completed: additive schema, integrity constraints, RLS/ACL posture, server-side Journalism read DTO composition, Topic/Series filters, and isolated tests. No mutation API/RPC, permission/grant, UI, production migration, or deployment was performed.

## A. Branch and Worktree

- Branch: `journalism-j5b-topics-series-read`
- Worktree: `/opt/worktrees/journalism-j5b-topics-series-read`
- Base: J5A commit `60cb188c8a7c0b364633ea2c55ec610aaf7e7eb9`
- Suggested feature commit: `feat: add journalism topics series read model`

## B. Baselines

- Runtime application baseline: `e5f726dedd480929b6424db55fc083cd6a4afb26`
- J4C report-only baseline: `309ff2d4d2a1a9f32557652ba30ccc09ed06212e`
- J5A docs baseline: `60cb188c8a7c0b364633ea2c55ec610aaf7e7eb9`
- Runtime -> J4C contained only the two approved J4 reports.
- J4C -> J5A contained only `JOURNALISM_TOPICS_SERIES_J5_CONTRACT.md` and `JOURNALISM_TOPICS_SERIES_J5A_REVIEW.md`.

## C. Files Changed

- `supabase/migrations/20260918130000_journalism_topics_series_j5_read.sql`
- `src/lib/taskContracts.ts`
- `src/lib/taskFilters.mjs`
- `src/lib/taskRepository.ts`
- `journalismTopicsSeriesJ5b.test.mjs`

No package, UI, route, permission, grant, or production file was changed.

## D. Migration Identity

- Filename: `20260918130000_journalism_topics_series_j5_read.sql`
- Version: strictly later than repository maximum `20260918120000`
- SHA-256: `7d85abec0110efb0421a79a4a95d2bd45914b203c00e0995defa22024b650517`
- Git blob: `a5b165612848e7f163166a050a5ef57e87a9180e`
- Migration was applied only to disposable PostgreSQL; never to production and never registered in the production ledger.

## E. Schema

Created additively:

- `editorial_topics`
- `editorial_series`
- `editorial_topic_tasks`
- `editorial_series_items`

Topics are 0..N per Journalism Task. Series are 0..1 per Journalism Task. Series may optionally reference one Topic. Normal Tasks remain ineligible; association rows reference `journalism_task_details(task_id)` and are additionally guarded by a narrow integrity trigger.

## F. Scoped Active-Name Uniqueness

Four partial unique indexes enforce `lower(btrim(name))` uniqueness only among active rows:

- global Topic;
- department-owned Topic;
- global Series;
- department-owned Series.

Archived rows may reuse names. Global and department-owned scopes may share names; different departments may share names.

## G. Series/Topic Department Invariant

The constraint trigger enforces the approved rule:

- no Topic parent means no parent compatibility check;
- global Topic may own global or department Series;
- department-X Topic requires department-X Series;
- global Series under department-owned Topic and cross-department Series/Topic combinations are rejected.

The same invariant is checked when a Topic department changes.

## H. Journalism-Only Association Invariant

Association rows have direct foreign keys to `journalism_task_details(task_id)` and narrow constraint triggers. Disposable DB tests reject a normal Task for both Topic and Series membership.

## I. Table Security

All four tables:

- enable RLS;
- revoke direct table access from `public`, `anon`, and `authenticated`;
- grant only `select, insert, update, delete` to `service_role`;
- expose no browser direct-table access.

Trigger functions use fixed `search_path = pg_catalog, public`, and execute is revoked from public client roles.

## J. RBAC Unchanged Proof

The migration contains no permission rows, no `role_permission_grants`, no RBAC RPCs, and no `journalism.structure.*` permissions. Production baseline remains **19 permissions / 128 grants**. Projected **21 / 140** remains future J5C arithmetic only.

## K. DTO Implementation

Journalism DTOs now include nested:

- detail `topics: []` sorted by Vietnamese case-insensitive display name, then ID;
- detail `series: object | null` with `position`, `topicId`, lifecycle and department fields;
- list compact `topicCount` and one Series summary.

Normal Tasks remain `journalism = null`. Journalism Tasks without memberships normalize to `topics=[]`, `series=null`.

## L. List Compactness Decision

Task list rows do not embed an unbounded Topic array. The primary Task query stays compact; a bounded server-side composition loads Topic counts and Series summaries for the returned page IDs. There is no per-row Topic/Series request loop.

## M. Deterministic Ordering

Detail Topics sort by `name.localeCompare(..., "vi", { sensitivity: "base" })`, then ascending ID. Series reads are singular and ordered by stored positive `position`. Series items enforce unique `(series_id, position)`.

## N. Topic/Series Filters

`topicId` and `seriesId` are parsed only when valid UUIDs. Either implies `journalism=only`; invalid values become absent and do not widen results. Repository filters use inner embedded relations, preserve count/pagination/order, and keep all existing Journalism filters.

## O. Authorization Boundary

No new authorization path was added. Existing server session and parent Task authorization remain the outer boundary. Topic/Series metadata is returned only as part of an authorized Journalism Task read and cannot widen Task visibility. No management picker or broad structure browsing API exists in J5B.

## P. PostgREST / Read Behavior

Disposable PostgREST v14.7 verified:

- nested Topic and Series reads through `journalism_task_details`;
- archived Topic/Series values remain readable;
- Topic inner filter returns one matching parent Task;
- Series inner filter returns one matching parent Task;
- anonymous direct Topic read returns `401`/permission denied;
- no duplicate parent rows.

## Q. Association DB Integrity Tests

Disposable PostgreSQL exact-migration tests passed for:

- valid global and department structures;
- blank/whitespace names and >200 names rejected;
- descriptions >5000 rejected;
- active scoped duplicates rejected;
- inactive duplicate names allowed;
- same names across departments/scopes allowed;
- all approved Series/Topic department combinations;
- invalid department combinations rejected;
- normal Task membership rejected;
- duplicate Topic membership rejected;
- one-Series-per-Task enforced;
- duplicate Series positions rejected;
- non-positive positions rejected.

## R. Archive/Historical Behavior

Archiving does not detach memberships. Disposable test output proved `ARCHIVE_TOPIC_MEMBERSHIP_OK` and `ARCHIVE_SERIES_MEMBERSHIP_OK`. No active picker or mutation flow was added.

## S. N+1 Evidence

List uses one parent Task query plus at most two bounded relation queries for the returned page IDs; detail uses one Task query with nested Topic/Series relations. Static tests reject a per-row relation fetch loop. No client post-pagination filtering was added.

## T. J2/J3/J4 Regression

Focused suite: **27/27 PASS**, covering J5B contract, Task filters, Journalism read behavior, J2 schema contract, J4 read-only UI contract, and Task Center URL behavior. Existing J3 mutation contract sources remain unchanged.

## U. Task/RBAC/Module Regression

The full source test baseline was compared before and after J5B:

| Run | Tests | Pass | Fail |
|---|---:|---:|---:|
| J5A baseline | 440 | 408 | 32 |
| J5B | 446 | 414 | 32 |

All 32 pre-existing failures matched by test name; J5B introduced no additional failures. The six added J5B tests all pass. No Task visibility, permission, grant, attendance, leave, schedule, online work, duty, evaluation, users, admin, or permission behavior was changed.

## V. TypeScript / Lint / Build

- `npm ci`: PASS, 0 vulnerabilities.
- `npx tsc --noEmit`: PASS.
- changed-file ESLint (`taskContracts.ts`, `taskFilters.mjs`, `taskRepository.ts`, `journalismTopicsSeriesJ5b.test.mjs`): PASS, 0 errors and 0 warnings.
- `git diff --check`: PASS.
- production-safe `npm run build -- --webpack` with dummy non-secret values: PASS, exit code 0.

## W. Production = UNCHANGED

- Production checkout `/opt/thoidai-work` was not used as a worktree for implementation.
- No deploy, restart, migration application, data mutation, systemd change, `supabase db push`, or `supabase db reset` was performed.
- Production remains on J4C release/application baseline with `TASK_RBAC_V2_ENABLED=true`.
- Production HEAD observed read-only: `8702827389e7e2452681c9e88c8d8ea899856a4c`; service remained active.
- Existing production dirty state was not reset, cleaned, stashed, or overwritten.

## X. Production Count Discrepancy

J5A's fresh read-only characterization observed `journalism_task_details = 0`, while earlier J4 owner smoke documentation said a designated test Task was retained. J5B did not mutate production or attempt to resolve this. **PRODUCTION DATA OBSERVATION REQUIRES RECONCILIATION BEFORE J5F.** This is not a J5B isolated schema/read blocker.

## Y. Migration Content Review

Migration content is limited to the four tables, FKs/checks/indexes, updated-at triggers, narrow integrity triggers, RLS and ACL posture. It contains no seeds, backfill, permissions, grants, RPC mutation functions, audit emitters, production IDs, or ledger repair.

## Z. Risks / Blockers

- Cross-department exposure: mitigated by parent Task authorization plus DB department compatibility.
- Scope ambiguity: no new scope vocabulary or authorization behavior in J5B.
- Reorder race: position uniqueness is schema-ready; reorder transaction belongs to J5D.
- Duplicate/stale structures: scoped partial unique indexes and inactive historical reads.
- N+1: bounded server composition and nested detail reads.
- Normal Task regression: direct Journalism-detail FK plus DTO null contract.
- Migration ledger: future application must remain explicit/per-file and strictly later than `20260918120000`.

## AA. J5C Recommendation

**READY FOR OWNER APPROVAL OF J5C; do not start J5C automatically.**

J5C may add only the owner-approved two permissions/grants and atomic Topic/Series management mutations after a separate approval. It must preserve the 19/128 J5B baseline until its own migration and authorization gates pass. Production remains unchanged and no Topic/Series UI or association mutation is enabled by this checkpoint.
