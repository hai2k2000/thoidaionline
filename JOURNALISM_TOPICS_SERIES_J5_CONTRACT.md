# Journalism Topics / Series - J5 Contract

Status: J5A design and characterization only. This document does not implement schema, migration, API, RPC, UI, RBAC, or production changes.

## A. Terminology

- **Topic**: a broad editorial subject, campaign, event, or coverage area. A Journalism Task may belong to zero or more Topics.
- **Series**: an ordered sequence of Journalism deliverables. A J5 v1 Task may belong to at most one Series.
- **Structure**: either a Topic or a Series.
- **Parent Task**: the existing canonical `tasks` row. Journalism identity remains `journalism_task_details(task_id)`.
- **Active**: selectable for new associations.
- **Archived**: retained for historical reads but rejected for new associations. UI may use the word archived; the storage contract uses `is_active`.

## B. Goals and Non-goals

Goals:

1. Organize existing Journalism Tasks without creating a competing task entity.
2. Support broad Topics, ordered Series, secure scoped visibility, and auditable atomic mutations.
3. Preserve all existing Task workflow, publication, evaluation, and RBAC behavior.
4. Keep the model compatible with a future CMS connector without making Topics or Series CMS taxonomy.

Non-goals for J5A and J5 v1:

- no schema or migration in J5A;
- no production data backfill or automatic classification;
- no CMS publishing, external IDs, or newsroom application shell;
- no Topic/Series lifecycle beyond active/inactive archival;
- no hard delete of referenced structures;
- no permission editing UI.

## C. Cardinality

| Relation | J5 v1 contract | Rationale |
|---|---|---|
| Task -> Topics | 0..N | A deliverable can cover several subjects. |
| Topic -> Tasks | 0..N | Topic is a broad grouping. |
| Task -> Series | 0..1 | Avoid ambiguous episode ownership in v1. |
| Series -> Tasks | 0..N | Membership is ordered. |
| Series -> Topic | 0..1, optional | A series can stand alone. |

If multiple Series per Task is required later, it must be an explicit owner decision and a new contract, not an implicit many-to-many table.

## D. Schema Proposal (design only)

The eventual migration should use the following names and constraints. No table is created by J5A.

### `editorial_topics`

- `id uuid primary key`;
- `name text not null`, trimmed and bounded to 200 characters;
- `description text null`, bounded to 5000 characters (or the final project-wide bound approved during J5B);
- `department_id uuid null` referencing `departments`, restrict on delete;
- `is_active boolean not null default true`;
- `created_by uuid null` referencing the existing staff user identity, using the existing project delete convention;
- `created_at`, `updated_at` timestamps;
- updated-at trigger and RLS/service-role access following J2 conventions.

### `editorial_series`

Same lifecycle/audit fields as Topics, plus nullable `topic_id uuid` referencing `editorial_topics` with restrict-on-delete semantics.

### `editorial_topic_tasks`

- `topic_id` and `task_id` foreign keys;
- `created_by`, `created_at`;
- primary key/unique `(topic_id, task_id)`;
- association is valid only when the Task already has `journalism_task_details`.

### `editorial_series_items`

- `series_id`, `task_id` foreign keys;
- positive integer `position`;
- `created_by`, `created_at`, `updated_at`;
- unique `(series_id, position)`;
- unique `task_id` to enforce one Series per Journalism Task in v1.

All association foreign keys should preserve historical rows. A referenced structure is archived, never hard-deleted.

## E. Lifecycle

Use `is_active`, matching the existing `journalism_work_kinds` convention. Active structures are eligible for new creation and association. Inactive structures remain readable through existing Task associations, are not returned by active pickers, and cannot receive new associations. Archiving never removes memberships. Hard delete is not exposed in v1.

## F. Department Ownership

`department_id = NULL` means organization-wide structure. A non-null value means department-owned structure. `leadership` must not be reused as a fake global department.

Department compatibility rule for v1:

- a global structure may be associated with any otherwise-authorized Journalism Task;
- a department-owned structure may contain only a Journalism Task whose `tasks.department_id` matches;
- even an `all` actor may manage all structures but may not use a department-owned structure to group another department's Task.

## G. Visibility

An actor who can view an authorized Journalism Task may see the attached Topic/Series names within that Task. Browsing selectable structures is a separate scoped read:

- organization-wide structures are available to organization-level actors with the relevant effective scope;
- department structures are available to actors in that department and authorized managers/assigners;
- an ordinary authenticated user must not receive a global list of all departmental planning structures by default;
- all reads are server-side repository/loaders; no browser direct-table query.

Association visibility never expands parent Task visibility.

## H. Authorization

J5 proposes exactly two effective permissions:

- `journalism.structure.manage`: create, update, archive Topics/Series and manage Series order;
- `journalism.structure.assign`: attach/detach authorized Journalism Tasks to/from Topics/Series.

Authorization is conjunctive:

1. authenticate the server session actor;
2. check the effective structure permission and its scope;
3. for association operations, check parent Task view/assignment authorization;
4. check structure department compatibility;
5. validate Journalism detail existence and mutation invariants in the transaction.

Do not add Task visibility from `structure.assign`. Do not trust actor, role, scope, or permission values from a request body. The current `RbacResource` type is Task-only; J5 implementation should add a narrow structure authorization abstraction rather than pretending a Topic or Series is a Task.

## I. Projected RBAC

Current production baseline is 19 permissions and 128 grants. If the recommended tuples are approved:

| Permission | Grants |
|---|---:|
| `journalism.structure.manage` | 5 |
| `journalism.structure.assign` | 7 |
| **Projected total** | **21 permissions / 140 grants** |

Recommended manage grants: admin/all, tong_bien_tap/all, pho_tong_bien_tap/all, truong_phong/department, pho_truong_phong/department. Recommended assign grants add phong_vien/assigned and nhan_vien/assigned. Inactive compatibility roles receive no grant. No production grant changes occur in J5A. A future canonical hash must be computed from the actual isolated post-migration tuples; it must not be invented here.

## J. Read DTO

Keep Topics/Series nested under `journalism`; normal Tasks retain `journalism = null` and do not receive empty arrays outside that object.

Detail shape:

```ts
journalism: {
  // existing J2/J3 fields
  topics: Array<{ id: string; name: string; isActive: boolean; departmentId: string | null }>;
  series: {
    id: string;
    name: string;
    isActive: boolean;
    departmentId: string | null;
    topicId: string | null;
    position: number;
  } | null;
}
```

List rows should remain compact: bounded Topic count/preview and Series name/position when present. Use nested server-side selections or a bounded repository loader; never add per-row N+1 queries.

Historical pre-J5 Journalism Tasks read as `topics: []` and `series: null`. No title, work kind, notes, department, or publication-state inference is allowed.

## K. Filters

J5 v1 adds server-side `topicId` and `seriesId` filters. They imply Journalism-only filtering, require UUID validation, use inner relation joins, and preserve existing Task authorization, count, pagination, and ordering. No client post-pagination filtering. `hasTopic` and `hasSeries` are deferred.

## L. Mutation API Contract (design only)

Candidate management routes:

- `POST /api/journalism/topics`
- `PATCH /api/journalism/topics/{topicId}`
- archive action following the existing route convention;
- equivalent Series routes;
- explicit reorder route, for example `PUT /api/journalism/series/{seriesId}/order`.

Parent-Task-centric association routes:

- `POST /api/tasks/{taskId}/journalism/topics`
- `DELETE /api/tasks/{taskId}/journalism/topics/{topicId}`
- `PUT /api/tasks/{taskId}/journalism/series`
- `DELETE /api/tasks/{taskId}/journalism/series`.

Exact method/status/error envelope must follow the current Next.js API conventions during J5B-J5D. Server session is the only actor source.

## M. Transaction and RPC Strategy

Required server-only mutation sequence: authenticate -> authorize -> lock/validate -> mutate -> append required audit row -> commit. Association and audit must not be split across HTTP requests. Future RPCs must use a fixed safe `search_path`, derive actor identity from validated server context, revoke execute from public/anon/authenticated, and grant only the intended server role. Audit failure rolls back the required mutation.

Every association RPC must atomically verify the parent `journalism_task_details` row. Client-side checks are advisory only.

## N. Series Ordering

Store a positive integer `position` from the beginning. New membership appends by default. Reordering is an explicit atomic operation; the UI may be deferred to J5E, but the schema/API contract is order-ready. Final positions are unique per Series and reads are ordered deterministically by position, then stable ID only as a defensive tie-breaker.

## O. Concurrency

Reorder runs in one transaction, locks the Series and its item rows, validates a complete permutation of current item IDs with positive contiguous positions, updates all positions, writes one audit event, and commits. It must reject stale/missing/duplicate IDs. Independent browser PATCH calls are not an acceptable reorder implementation.

Adding a Task already in another Series returns an explicit conflict. J5 v1 does not silently reparent. A future move operation may be a dedicated atomic detach-then-attach action.

## P. Audit

Reuse `audit_logs`, not `task_status_events`. Proposed explicit action names:

`create_editorial_topic`, `update_editorial_topic`, `archive_editorial_topic`, `create_editorial_series`, `update_editorial_series`, `archive_editorial_series`, `reorder_editorial_series`, `attach_topic_to_journalism_task`, `detach_topic_from_journalism_task`, `attach_series_to_journalism_task`, `detach_series_from_journalism_task`.

Payloads should contain IDs, changed field names, positions, and bounded lengths rather than full descriptions or secrets. Audit is part of the same transaction.

## Q. CMS Future Compatibility

Topics and Series are internal editorial organization. They are not CMS categories, publication channels, or article entities. Do not add CMS-specific fields now. A later connector may add an explicit mapping layer and external identifiers.

## R. Historical Behavior

Existing Journalism Tasks retain current workflow/publication/evaluation behavior and read as empty Topic membership plus null Series. Normal Tasks remain `journalism = null` and cannot be associated. No automatic backfill or classification is performed.

Topic/Series operations never change Task status, assignee, reviewer, deadline, score, evaluation, publication status, planned publication time, `published_at`, or `article_url`.

## S. UI Implications (design only)

Future surfaces remain inside Task Management: Task detail metadata shows Topic and Series; Task Center provides Topic/Series filters; a scoped management page handles structures; Series detail shows ordered Journalism Tasks. Controls are rendered from effective permissions, not role-name checks. No J5A UI is implemented.

## T. Test Plan

Future implementation must cover:

- schema FK, duplicate Topic, one-Series-per-Task, archive preservation, and normal Task rejection;
- manage all/department and assign all/department/assigned scopes;
- no reporter/staff manage grant, no cross-department escalation, and no visibility expansion;
- Topic create/update/archive/attach/detach and multiple Topics;
- Series create/update/archive/attach/detach, move conflict, order, and reorder concurrency;
- required audit and atomic rollback on audit failure;
- DTO defaults, filters, counts, pagination, no N+1, and normal Task null contract;
- J2 read, J3 mutation, J4 UI, Task/RBAC, and module regressions.

## U. Migration Plan (design only)

The eventual J5 migration must be strictly later than the highest repository migration version observed (`20260918120000`). It may add tables, constraints, indexes, permissions, grants, and server-only RPCs in an explicitly reviewed per-file migration. Production's special outside-ledger migration state must be preserved. J5A creates no migration and never runs `supabase db push` or `supabase db reset`.

## V. Implementation Phases

- **J5B**: additive schema, repository read model, DTO defaults, and filters; no mutation grants.
- **J5C**: the two permissions/grants plus atomic Topic/Series management RPCs.
- **J5D**: parent-Task associations, append/reorder concurrency, and association audit.
- **J5E**: scoped read/management UI and attachment controls; reorder UI can remain deferred until this phase.
- **J5F**: controlled production migration, read smoke, mutation smoke, flag/rollback evidence, and owner sign-off.

## W. Owner Decisions

1. **Multiple Topics per Task**: Option A yes (recommended); Option B one Topic. Choose A because Topics are broad cross-cutting subjects and the join table prevents duplication.
2. **Multiple Series per Task**: Option A one Series maximum (recommended); Option B many-to-many. Choose A to keep episode identity unambiguous in v1.
3. **Series-to-Topic**: Option A optional one Topic (recommended); Option B mandatory Topic. Choose A so independent series remain valid.
4. **Cross-department membership**: Option A forbid for department-owned structures (recommended); Option B allow for `all` actors. Choose A to preserve semantic ownership and avoid information leakage.
5. **Lifecycle**: Option A `is_active` active/archived (recommended); Option B status enum/text. Choose A because it matches `journalism_work_kinds` and historical read behavior.
6. **Ordering**: Option A schema/API-ready ordering with append now and UI reorder in J5E (recommended); Option B append-only forever. Choose A because editorial series are intrinsically ordered and atomic reorder can be safely deferred in UI.
7. **Permissions**: Option A two permissions manage + assign (recommended); Option B per-operation permissions. Choose A to avoid permission proliferation while retaining a clear mutation boundary.
8. **Names**: Option A no global uniqueness, with department context in UI (recommended); Option B case-insensitive uniqueness within active department scope. J5B should confirm whether duplicate active names cause picker ambiguity before adding a narrower index; IDs remain authoritative either way.

## X. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Cross-department exposure | Conjunctive parent Task auth, structure scope, and department compatibility. |
| Scope ambiguity | Evaluate `assigned`/`department` only against the parent Task; reuse existing meanings. |
| Reorder race | Lock Series/items, validate complete permutation, update and audit atomically. |
| Duplicate association | Unique `(topic_id, task_id)`, unique `task_id` for Series, and explicit conflict errors. |
| Inactive stale structures | Historical reads remain valid; active pickers and new associations reject inactive rows. |
| N+1 list reads | Nested server select or bounded repository loader with count/pagination preserved. |
| Audit payload growth | Store IDs, changed fields, positions, and bounded lengths, not full long text. |
| CMS taxonomy confusion | Keep internal model and future external mapping separate. |
| Permission proliferation | Exactly two permissions in the initial design. |
| Normal Task regression | DB-level Journalism-detail existence guard plus `journalism = null` DTO contract. |
| Migration-ledger safety | Strictly later version, explicit per-file application, no push/reset/replay. |

J5A conclusion: this contract is ready for owner review. It does not authorize J5B implementation.
