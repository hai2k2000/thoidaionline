# Journalism Topics / Series - J5A Review

Status: characterization and contract review only. No application, schema, migration, RBAC, production data, or service changes were made.

## 1. Inspected Source Baseline

The isolated branch is `journalism-j5a-topics-series-contract`, based on report-only commit `309ff2d4d2a1a9f32557652ba30ccc09ed06212e`. The diff from runtime commit `e5f726dedd480929b6424db55fc083cd6a4afb26` to that report commit was verified as documentation-only (`JOURNALISM_TASKS_J4B5_REPORT.md` and `JOURNALISM_TASKS_J4C_PRODUCTION_REPORT.md`).

Inspected conventions and locations:

- `supabase/migrations/20260918100000_journalism_tasks_j2_schema.sql`: `journalism_work_kinds`, `journalism_task_details`, UUID/FK/RLS/service-role patterns, validation, restrict behavior, and updated-at trigger.
- `supabase/migrations/20260918120000_journalism_tasks_j3_mutations.sql`: server-only atomic RPCs, actor checks, locks, active master-data checks, audit transaction pattern, fixed search path, and revoked public execute.
- `src/lib/taskRepository.ts`: nested Journalism list/detail selections, server-side filtering/count/pagination, work-kind loading, inactive historical handling, and no per-row fetch loop.
- `src/lib/taskContracts.ts` and `src/lib/taskFilters.mjs`: current DTO/filter shape and validation conventions.
- `src/lib/journalismAuthorization.ts`, `src/lib/taskAuthorization.ts`, `src/lib/rbac/authorization.ts`, `src/lib/rbac/repository.ts`, and `src/lib/rbac/types.ts`: conjunctive Journalism authorization, Task resource scopes, and the current Task-only `RbacResource` limitation.
- J3 route handlers under `src/app/api/tasks/[id]/journalism/`: server session and permission checks for metadata/publication mutations.
- `audit_logs` writes in J3 and existing server audit helpers: action/entity and bounded payload conventions.
- Department/role and server-side master-data loaders used by current Task and Journalism flows.

## 2. Current Production Baseline

- Application commit: `e5f726dedd480929b6424db55fc083cd6a4afb26`.
- Active release: `/opt/releases/thoidai-work/e5f726dedd480929b6424db55fc083cd6a4afb26-j4c-20260918T134200Z`.
- RBAC: 19 permissions, 128 grants.
- Canonical grant hash: `1e87d9404fef719a22f8a4369d871a09df1a93bb46a7d7512c22affe245943bc`.
- `TASK_RBAC_V2_ENABLED=true`.
- J3 backend and J4 UI are complete; production was not modified by J5A.

The following migration states remain untouched: `20260917200000`, `20260918100000`, and `20260918120000` were applied outside the normal ledger/per-file process; known unresolved historical versions remain `20260909121500`, `20260909143000`, `20260911083000`, and `20260911190000`. The highest repository migration version observed is `20260918120000`.

## 3. Actual Current Journalism Counts

A fresh read-only service-role REST characterization against the configured production target returned:

| Check | Observed result |
|---|---|
| `journalism_task_details` count | **0** at characterization time |
| `editorial_topics` relation | HTTP 404 / relation absent |
| `editorial_series` relation | HTTP 404 / relation absent |
| `editorial_topic_tasks` relation | HTTP 404 / relation absent |
| `editorial_series_items` relation | HTTP 404 / relation absent |
| Permission catalog count | 19 |

The count is an observation of the current configured target, not a design assumption. It does not contradict earlier owner smoke notes; the designated J4 test Task was not present in this fresh current REST count. No data was inserted, deleted, or changed to perform this check. Secrets and response bodies were not printed.

## 4. Existing Conventions Discovered

1. J2 uses `is_active`, stable codes, bounded text checks, restrict-on-delete foreign keys, RLS, service-role-only table access, and updated-at triggers. J5 should follow these conventions.
2. J3 uses atomic server-only RPCs and required `audit_logs` writes in the same transaction. Topic/Series mutations should use the same security posture.
3. The Task repository nests Journalism under the Task DTO, uses compact list selections and richer detail selections, performs server-side filtering, and avoids N+1 reads.
4. Existing Journalism authorization is parent Task view authorization plus effective Journalism permission and Task resource scope. An association permission must not create visibility.
5. Existing `assigned` scope includes owner, assignee, reviewer, and participant only where legacy behavior confirms the relation. J5 should evaluate assignment against the parent Task and not invent a new scope vocabulary.
6. `RbacResource` currently models Task resources. A future structure helper/resource model is needed; Topic/Series must not be misrepresented as Tasks.
7. Existing route and audit conventions derive actor identity from the server session and do not trust browser-supplied actor/role/scope values.

## 5. Proposed Model Summary

- Topics are many-to-many with Journalism Tasks.
- Series are one-to-many with Journalism Tasks in v1, with a unique Task membership and positive integer position.
- A Series may optionally reference one Topic.
- `department_id` is nullable: null is organization-wide, non-null is department-owned.
- `is_active` supports active selection and historical archived reads.
- Only Tasks with `journalism_task_details` can be associated.
- Normal Tasks remain unchanged (`journalism = null`).
- Topic/Series metadata never changes workflow, evaluation, or publication fields.

The full contract is in `JOURNALISM_TOPICS_SERIES_J5_CONTRACT.md`.

## 6. Authorization and Projected Counts

The minimal proposed surface is:

- `journalism.structure.manage`: 5 recommended grants;
- `journalism.structure.assign`: 7 recommended grants.

Projected post-approval catalog is **21 permissions / 140 grants**, calculated as 19 + 2 permissions and 128 + 12 grants. This is arithmetic only. No permission, grant, or hash was changed or seeded. The future canonical hash must be calculated from the actual isolated migration result.

The recommended matrix is:

| Role | Manage | Assign |
|---|---|---|
| admin | all | all |
| tong_bien_tap | all | all |
| pho_tong_bien_tap | all | all |
| truong_phong | department | department |
| pho_truong_phong | department | department |
| phong_vien | - | assigned |
| nhan_vien | - | assigned |
| inactive compatibility roles | - | - |

All assignment checks remain conjunctive with parent Task authorization and structure department compatibility.

## 7. Owner Decisions to Confirm

The genuine product decisions are recorded as Option A/Option B with a recommendation in the contract:

1. Multiple Topics per Task: recommend yes.
2. Multiple Series per Task: recommend no in v1.
3. Series Topic parent: recommend optional one.
4. Department-owned cross-department membership: recommend no, even for `all` actors.
5. Lifecycle: recommend active/inactive via `is_active`.
6. Ordering: recommend schema/API-ready atomic reorder with UI deferred to J5E.
7. Permission model: recommend exactly manage + assign.
8. Name uniqueness: recommend no global uniqueness; confirm whether active department-scoped uniqueness is needed to avoid picker ambiguity.

## 8. Blockers and Safety Findings

No blocker prevents a design-only J5A deliverable. The following are implementation gates, not reasons to change production now:

- future structure authorization must not overload the Task-only resource type;
- future migration version must be later than `20260918120000`;
- production migration application must remain explicit/per-file because of outside-ledger history;
- no association may bypass parent Task authorization or department compatibility;
- no hard delete, automatic backfill, or client-side direct-table reads;
- no permission/grant changes until an owner-approved implementation checkpoint.

## 9. J5B Recommendation

**GO for owner review of J5B design, but NO-GO to implement until owner approval.**

Recommended J5B scope is additive schema plus read model/filter contracts only. It should not add mutations, grants, or UI. Before J5B starts, owner should confirm the eight decisions above, especially Series cardinality, cross-department membership, and name uniqueness. J5A itself is complete when these documents are reviewed; J5B must not start automatically.

## 10. Validation Boundary

J5A final diff must contain only:

- `JOURNALISM_TOPICS_SERIES_J5_CONTRACT.md`
- `JOURNALISM_TOPICS_SERIES_J5A_REVIEW.md`

No `src/`, `supabase/`, migration, package, ops, systemd, or production data changes are authorized. No deploy, restart, `supabase db push`, or `supabase db reset` was performed.
