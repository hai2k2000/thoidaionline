# Journalism Tasks J3 Contract

Status: J3A design only. No production mutation, permission, grant, schema, RPC, API route, or UI is implemented by this document.

## A. Architecture

`tasks` remains the canonical resource. A Journalism Task is a normal parent task plus exactly one `journalism_task_details(task_id)` row. There is no discriminator column, conversion endpoint, recurrence path, CMS field, Topics/Series model, or multi-deliverable wrapper in v1. Independent deliverables are independent Tasks.

The proposed write path is a dedicated server-only route backed by one PostgreSQL transaction:

`POST /api/tasks/journalism/assign` -> `api_assign_journalism_task_v1`

The wrapper calls the existing `api_assign_task_v2` logic, inserts the detail, and writes the Journalism audit event before commit. A failed validation or audit insert aborts the complete transaction, including the parent Task.

## B-C. Atomic Create and Authorization

The create path reuses the existing parent assignment contract: `task.create` plus `task.assign` and its current department, assignee, reviewer, participant, workflow-default, and RPC guards. It does not add `journalism.create`. The wrapper must not call a second independent assignment implementation.

Observed baseline: `api_assign_task_v2` is `SECURITY DEFINER`, validates `api_assert_task_action(..., 'assign')`, active actor/department/manager, assignee/reviewer eligibility, and writes the normal task audit in its transaction. A wrapper function call remains in the same PostgreSQL transaction; this is the required composition point. If a future implementation cannot preserve that property, it is a blocker.

Authorization order:

1. Authenticate server session.
2. Validate parent input and active work kind.
3. Apply existing `task.create` authorization.
4. Apply existing assignment scope and `api_assign_task_v2` validation.
5. Insert Journalism detail and required audit atomically.

Journalism creation cannot widen assignment scope. `task.create` does not imply `task.assign=all`; the existing assignment RPC remains authoritative.

## D-E. Metadata Mutation

Proposed route: `PATCH /api/tasks/{taskId}/journalism`.

Mutable metadata fields:

- `work_kind_id` (new target must be active)
- `planned_publication_at`
- `location`
- `editorial_notes`

`article_url` is excluded from metadata mutation and belongs to publication-management semantics because the database permits it only for `published` or `withdrawn` states.

Required sequence: authenticate -> resolve/authorize parent Task without revealing unauthorized existence -> check `journalism.metadata.update` and scope against the parent -> lock/load Journalism detail -> validate fields -> update -> write atomic audit -> respond.

The route rejects a normal Task (no detail row), an inactive replacement work kind, and a parent outside the caller's existing Task visibility. No direct client table write is allowed.

## F. Metadata Permission and Scope

New catalog permission proposed: `journalism.metadata.update`.

Scope uses the existing vocabulary and parent Task resource only:

- `self`: actor is `created_by` or `owner_id`.
- `assigned`: actor is owner, assignee, reviewer, or an existing participant relation confirmed by legacy behavior.
- `department`: actor department equals parent Task department under current active organization semantics.
- `all`: unrestricted parent scope, still subject to parent authorization and active actor rules.

Permission is conjunctive with parent authorization; it never creates visibility.

## G. Publication Contract

Proposed route: `POST /api/tasks/{taskId}/journalism/publication` with a dedicated `journalism.publication.manage` permission. Metadata permission alone never grants publication authority.

Publication state is stored only in the J2 detail row. Publication mutations never change parent Task workflow status, and Task workflow mutations never change publication status.

## H-I. State Machine and Timestamps

Only these states exist: `not_published`, `scheduled`, `published`, `withdrawn`.

| Current | Target | Rules |
|---|---|---|
| not_published | scheduled | `planned_publication_at` required; `published_at=NULL`; URL must be null |
| not_published | published | server sets `published_at=now()`; URL required |
| scheduled | not_published | clear `planned_publication_at`; `published_at=NULL`; URL null |
| scheduled | published | server sets `published_at=now()`; URL required |
| published | withdrawn | non-empty bounded reason required; preserve `published_at` and URL; reason stored in audit metadata |
| withdrawn | withdrawn | terminal; return conflict |

Same-state requests return HTTP `409` with `publication_state_conflict`; they do not create a fake transition. No other transitions are accepted.

Recommended v1 article URL policy: required and valid absolute HTTP(S) URL on publish; immutable after publish; preserved on withdrawal; never removed by a v1 mutation. A separate owner decision is required if product needs post-publication URL correction.

## J-K. Article URL and Withdrawal Reason

`article_url` is a public published URL only. Reject credentials, non-HTTP(S), excessively long, or malformed values. Do not accept `published_at` from clients. `published_at` is server-generated.

`published -> withdrawn` requires a trimmed non-empty reason, maximum 2000 Unicode characters (matching existing reason validation conventions). J2 has no `withdrawal_reason` column; store the bounded reason in the immutable `change_publication_status` audit `new_data`/context metadata. Adding a current-state column is an owner schema decision, not part of J3A.

## L. Concurrency

Publication mutation must run in one transaction and `SELECT ... FOR UPDATE` the `journalism_task_details` row before reading state. Validate the transition after the lock, update timestamps/URL, write audit, and commit. Concurrent incompatible transitions serialize; the loser receives HTTP 409.

Metadata currently has no observed optimistic version convention. Use the existing `updated_at` trigger and row lock for J3 v1; do not invent a version subsystem. A future lost-update requirement is an owner decision.

## M. Audit Contract

Reuse `audit_logs`, not `task_status_events`. Proposed values:

- module: `task`
- entity_type: `journalism_task_details`
- entity_id: parent task id
- action: `create_journalism_detail`, `update_journalism_metadata`, or `change_publication_status`
- actor_id: authenticated actor
- old_data/new_data: bounded JSONB before/after metadata

Audit write is part of the same SQL transaction. If audit insertion fails, the mutation rolls back. Do not use the existing standalone `logServerAudit` helper for the atomic RPC because it cannot make a separate HTTP call transactional.

Audit minimization: record changed field names and bounded values for ordinary metadata; for `editorial_notes`, prefer a changed marker plus bounded length/hash rather than full long text. Never store cookies, tokens, passwords, service keys, or secrets.

## N. Security Ordering and Errors

Authenticate -> authorize parent Task -> check Journalism permission/scope -> load/lock detail -> validate -> mutate -> audit -> respond. Unauthorized parent and absent detail use the project-standard non-leaking `404`/`403` behavior; do not expose whether a hidden Task is Journalism.

Recommended error mapping:

| Condition | Status | Code |
|---|---:|---|
| unauthenticated | 401 | `unauthorized` |
| malformed UUID/body | 400 | `invalid_request` |
| unauthorized parent/scope | 403 or non-leaking 404 | `forbidden` / `not_found` |
| normal Task/no detail | 404 | `not_found` |
| inactive work kind | 400 | `inactive_work_kind` |
| invalid URL/date/field | 400 | `invalid_request` |
| forbidden transition or same state | 409 | `publication_state_conflict` |
| concurrent state conflict | 409 | `conflict` |
| required audit/RPC failure | 503 | existing RPC/service error mapping |

## O. API DTOs

### Create

Request reuses the existing assigned-task parent fields (`title`, `description`, `departmentId`, `assigneeId`, `reviewerId`, `dueDate`, `dueTime`, criteria, priority, collaborators, watchers) plus:

```json
{
  "journalism": {
    "workKindId": "uuid",
    "plannedPublicationAt": "ISO-8601|null",
    "location": "string|null",
    "editorialNotes": "string|null"
  }
}
```

`publicationStatus` defaults to `not_published`; clients cannot submit `published_at`, `article_url`, or an arbitrary initial published/withdrawn state.

Success: HTTP 201, `{ "task": <existing task DTO with journalism detail> }`.

### Metadata update

```json
{
  "workKindId": "uuid",
  "plannedPublicationAt": "ISO-8601|null",
  "location": "string|null",
  "editorialNotes": "string|null"
}
```

Success: HTTP 200, `{ "taskId": "uuid", "journalism": <normalized detail> }`.

### Publication change

```json
{
  "status": "not_published|scheduled|published|withdrawn",
  "plannedPublicationAt": "ISO-8601|null",
  "articleUrl": "absolute-http-url|null",
  "reason": "string|null"
}
```

Success: HTTP 200 with normalized detail. `reason` is required only for withdrawal. Client timestamps are ignored/rejected.

## P-Q. Proposed Catalog and Grant Matrix

Add exactly two catalog permissions after owner approval:

- `journalism.metadata.update`
- `journalism.publication.manage`

Recommended metadata tuples (one per role):

| Role | Scope | Rationale |
|---|---|---|
| admin | all | system administration |
| tong_bien_tap | all | organization editorial authority |
| pho_tong_bien_tap | all | organization-wide deputy editorial authority; leadership-unit membership must not restrict parent department |
| truong_phong | department | department leadership |
| pho_truong_phong | department | deputy department/reviewer authority |
| phong_vien | assigned | own assigned Journalism work only |
| nhan_vien | assigned | own assigned Journalism work only |

Recommended publication tuples are narrower:

| Role | Scope | Rationale |
|---|---|---|
| admin | all | system administration |
| tong_bien_tap | all | organization publication authority |
| pho_tong_bien_tap | all | organization-wide deputy editorial authority |
| truong_phong | department | department publication authority |
| pho_truong_phong | department | deputy/reviewer publication authority |

No publication tuple is proposed for `phong_vien` or `nhan_vien` in v1. Inactive compatibility roles receive no tuple. Each tuple remains subject to parent Task authorization.

## R. Expected Counts

Current live baseline remains **17 permissions / 116 grants**. The finalized matrix produces **19 permissions / 128 grants** (7 metadata tuples + 5 publication tuples) after J3B implementation. No live count changes in J3A-R1.

## S. Migration Plan

Future J3 implementation may use a migration strictly later than `20260918100000` for the two catalog rows, approved grants, and any RPC definitions. It must be applied per-file using the established ledger-safe process; it must not replay unresolved history or either manually applied J2/R2 migration. No migration is created or applied in J3A.

## T. Test Matrix

Future implementation must cover:

- atomic create success and rollback on detail/audit failure
- inactive work-kind rejection and historical inactive read
- task.create/task.assign scope preservation and recurrence rejection
- metadata scope allow/deny, normal-task rejection, URL policy, audit atomicity
- every allowed/forbidden publication transition, same-state 409, dates, URL, withdrawal reason, server timestamp
- row-lock race with one winner and one 409 loser
- anon/authenticated direct table mutation denial
- no cross-department escalation or metadata leak
- normal Task workflow/assignment/evaluation and all J2 read regressions
- attendance, leave, schedule, online work, duty, evaluation, ORG/RBAC R2, Phase 1A

## U. Rollback and Non-goals

J3 v1 does not convert normal Tasks, add recurrence, add CMS/Topics/Series, change Task workflow from publication, add a generic `journalism.create`, modify current grants before approval, or expose direct table APIs. Rollback is code-only before schema changes; after an approved additive migration, disable routes/permissions rather than dropping J2 tables without a separate rollback migration.

## V. Owner Decisions

Owner decisions are final for J3B planning:

1. Metadata tuples are exactly: admin/all, tong_bien_tap/all, pho_tong_bien_tap/all, truong_phong/department, pho_truong_phong/department, phong_vien/assigned, nhan_vien/assigned.
2. Publication tuples are exactly: admin/all, tong_bien_tap/all, pho_tong_bien_tap/all, truong_phong/department, pho_truong_phong/department.
3. URL is required on publish, absolute HTTP(S), contains no credentials/userinfo, respects the existing DB maximum, is immutable after successful publication, and is preserved on withdrawal.
4. Withdrawal reason is audit-only, trimmed, non-empty, and at most 2000 Unicode characters; no `withdrawal_reason` column is added in J3 v1.
5. Publication and Task workflows remain independent; there is no post-publication URL correction workflow in J3 v1.

## W. Final Planned-Publication Rules

The metadata route may change `planned_publication_at` only while the current publication state is `not_published` or `scheduled`.

- `not_published`: planned time may be null, set, changed, or cleared.
- `scheduled`: planned time must be non-null and may be updated.
- `scheduled -> not_published`: clear planned time to null.
- `scheduled -> published`: preserve planned time as historical planned publication time.
- `not_published -> published`: preserve an existing planned time; otherwise leave it null.
- `published` and `withdrawn`: reject metadata attempts to change planned time.

Publishing never silently clears planned time. `work_kind_id`, `location`, and `editorial_notes` remain metadata-editable after publication or withdrawal when parent authorization, permission, scope, validation, and audit all pass. A replacement work kind must be active. `article_url` is never accepted by the metadata route.
