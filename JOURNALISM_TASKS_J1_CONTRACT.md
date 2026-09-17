# Journalism Tasks — Checkpoint J1 Contract and Characterization

Status: proposed final contract for owner review. This checkpoint changes documentation only. It does not create a migration, change schema/RBAC grants, implement UI, or deploy.

Date: 2026-09-17

Baseline reviewed: `abbb049fd39d425b9a5d1a52504598fdc31eff9d` plus the approved Journalism Tasks design updates on the current branch.

## A. Final v1 data contract

### Aggregate identity and unit of work

- `tasks` remains the canonical resource, workflow identity, authorization resource, and audit parent.
- A task is a Journalism Task if and only if a `journalism_task_details` row exists for its `tasks.id`.
- V1 adds no `task_domain`, `task_kind`, or other discriminator column to `tasks`.
- One Journalism Task represents one deliverable. Several independent deliverables require separate Journalism Tasks.
- Existing task title, description/brief, owner/assignee, reviewer, department, deadline, priority, comments, attachments, progress, scoring/evaluation, and audit/history remain authoritative.

### Work-kind master DTO

```ts
type JournalismWorkKindDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};
```

The initial candidate codes are `news`, `article`, `interview`, `reportage`, `photo`, `video`, `event_coverage`, `editing`, `translation`, and `other`. They are configurable seed data, not an enum. J2 must not seed them until this J1 contract, names, and ordering are owner-approved.

### Journalism detail DTOs

```ts
type PublicationStatus =
  | "not_published"
  | "scheduled"
  | "published"
  | "withdrawn";

type JournalismTaskDetailDto = {
  task_id: string;
  work_kind: JournalismWorkKindDto;
  publication_status: PublicationStatus;
  planned_publication_at: string | null; // ISO 8601 with offset/UTC
  published_at: string | null;           // ISO 8601 with offset/UTC
  location: string | null;
  article_url: string | null;             // public/published URL only
  editorial_notes: string | null;
  created_at: string;
  updated_at: string;
};

type JournalismTaskListSummaryDto = Pick<
  JournalismTaskDetailDto,
  "publication_status" | "planned_publication_at" | "published_at"
> & {
  work_kind: Pick<JournalismWorkKindDto, "id" | "code" | "name" | "is_active">;
};
```

Existing task list/detail DTOs should add `journalism: JournalismTaskListSummaryDto | null` for list results and `journalism: JournalismTaskDetailDto | null` for detail results. `null` means a normal task. The server must not accept a client-supplied discriminator.

### Creation input

A future dedicated Journalism assignment route should accept the existing assigned-task input plus:

```ts
type JournalismCreateInput = {
  workKindId: string;
  plannedPublicationAt: string | null;
  location: string | null;
  articleUrl: string | null;
  editorialNotes: string | null;
};
```

Creation always stores `publication_status = "not_published"` and `published_at = null`. The client cannot choose another initial publication status. Publication changes use a separate future endpoint and authorization decision.

### Field rules

| Field | V1 rule |
|---|---|
| `task_id` | Required UUID, primary key, FK to `tasks.id`. |
| `work_kind_id` | Required UUID, FK to an active work kind on create; inactive referenced kinds remain readable. |
| `publication_status` | Required; default `not_published`; four approved values only. |
| `planned_publication_at` | Optional `timestamptz`; canonical storage UTC, UI default `Asia/Ho_Chi_Minh`. |
| `published_at` | Optional `timestamptz`; required when status is `published`. |
| `location` | Optional trimmed text, proposed maximum 500 characters. |
| `article_url` | Optional public/published HTTP(S) URL, proposed maximum 2,048 characters; no CMS preview URL. |
| `editorial_notes` | Optional internal notes, proposed maximum 10,000 characters; must not contain protected source/contact data. |

Future only: content format, source/contact notes, external CMS fields, Topics/Series relations, and many-to-many related-task relations.

## B. Existing task create/read/update characterization

### Create

- `POST /api/tasks` is intentionally disabled and returns `410`; it must not be revived for Journalism Tasks.
- `POST /api/tasks/assign` is the current hardened assignment path.
- Its handler validates title, structured requirements, department, assignee, due date/time, priority, recurrence, collaborators, watchers, assignment scope, RBAC `task.assign`, legacy department rules, and participant resolution.
- `taskRepository.assign()` calls `api_assign_task_v2`.
- `api_assign_task_v2` is a security-definer database function that revalidates actor scope, active department/people/reviewer relationships and input constraints, then creates the task, participant rows, optional recurrence records, and audit entries in one database transaction.

### Read/list

- `GET /api/tasks` obtains the authenticated actor, applies RBAC/legacy-equivalent resource scope in the repository, then applies task filters and pagination.
- Current visibility considers creator, owner, assignee, reviewer, task participants, department scope, and organization scope. A Journalism join/filter must be applied within this already-authorized task query and must never add an alternative visibility path.
- `GET /api/tasks/:id` first obtains the Task access snapshot and authorizes `view`; only then does it load the composed detail.
- Journalism detail reads must follow the same order: authorize the parent Task, then return its detail row. A direct detail-table API is not allowed.

### Update and workflow mutations

- `PATCH /api/tasks/:id` currently changes only a narrow legacy set (`new`/`in_progress`, due date, priority) after the Task update guard and database RPC validation.
- Admin edit is a separate guarded route/RPC and does not bypass assigned-task submission, score, or completion invariants.
- Submit, return/approve, score, cancellation, deadline, attachment, comment, and evaluation each use their existing handler, RBAC base decision, legacy workflow guard, and RPC validation.
- Journalism metadata and publication status must not be added silently to generic `PATCH /api/tasks/:id` or admin edit. They require dedicated contracts, permissions, guards, and audit actions.

## C. Atomic creation strategy

### Recommended boundary

Add a dedicated future server route, for example `POST /api/tasks/journalism/assign`, which reuses the existing assignment parsing, participant resolution, `task.assign` RBAC base check, and legacy department guard. It calls one new database RPC, provisionally `api_assign_journalism_task_v1`.

The database RPC should:

1. validate `work_kind_id` exists and is active;
2. validate journalism-specific lengths, URL, and timezone-aware timestamps;
3. call the existing `api_assign_task_v2` function with the approved assigned-task fields;
4. insert the matching `journalism_task_details` row using the returned task ID;
5. insert a journalism-detail audit record;
6. return the created task/detail aggregate.

PostgreSQL function calls participate in the outer statement transaction. If detail creation or audit insertion fails, the task, participant, recurrence, and audit work performed by `api_assign_task_v2` must roll back with it. The route must never call `api_assign_task_v2` and then perform a second independent client-side insert.

No direct client insert into either new table is allowed. Function execute privileges should follow the existing service-role-only pattern.

### Recurrence boundary

Journalism recurrence is not enabled automatically in v1. The current recurrence engine creates later `tasks` rows without journalism details, which would violate the existence-based discriminator contract. The future Journalism create endpoint must reject non-null recurrence fields until a separately approved design extends recurrence rules with a complete journalism template and atomically creates details for each occurrence.

## D. Publication state transition contract

Task execution status and publication status are independent. No transition in either model automatically changes the other.

| Current | Allowed next state | Required data/behavior |
|---|---|---|
| `not_published` | `scheduled` | `planned_publication_at` is required. |
| `not_published` | `published` | Set `published_at` from an explicit timezone-aware value or server `now()`; public URL remains optional. |
| `scheduled` | `not_published` | Unschedule; clear `planned_publication_at` only when explicitly requested. |
| `scheduled` | `published` | Set `published_at`; retain planned time for schedule-versus-actual reporting. |
| `published` | `withdrawn` | A non-empty reason is required; preserve `published_at` and public URL as history unless a separate redaction action is approved. |
| `withdrawn` | none in v1 | Terminal in v1; restoration requires a later owner-approved transition. |

All other transitions are denied. Same-state requests should return a conflict rather than create duplicate audit events. `not_published` and `scheduled` require `published_at IS NULL`; `published` requires `published_at IS NOT NULL`; `withdrawn` may retain a previous publication time.

The mutation contract must use row locking (`FOR UPDATE`) and validate the transition against the stored current state to prevent concurrent lost updates. It should return `409` for stale/invalid transitions and must not infer publication approval from Task review or completion.

## E. Metadata write authorization proposal

### Reads

Read access is exactly the parent Task `view` decision. Journalism metadata never creates additional task visibility. Inactive work kinds remain visible only with an already-visible historical task.

### Creation

Journalism Task creation uses the existing assignment enforcement chain:

`task.assign` RBAC scope + legacy `canAssignToDepartment()` equivalent + participant/reviewer validation + RPC validation`.

`task.create` alone never grants Journalism assignment authority.

### Future updates

Do not map metadata writes to `task.view`. Before implementing update endpoints, add explicit permission catalog entries and owner-approved grants, proposed as:

- `journalism.metadata.update`
- `journalism.publication.manage`

Both should use the existing scopes (`self`, `assigned`, `department`, `all`) but still require a workflow/relationship guard and database validation. Having the permission/scope is necessary but not sufficient.

Proposed final checks:

- **General metadata update:** explicit `journalism.metadata.update` scope, parent Task visible, actor related through creator/owner/assignee/reviewer or allowed department/organization management relation, allowed field set, and RPC validation.
- **Publication transition:** explicit `journalism.publication.manage` scope, parent Task visible, actor is reviewer/department manager/authorized leadership/admin according to an owner-approved grant matrix, valid state transition, and RPC validation.
- Watcher status alone must not grant mutation.
- `task.edit_all`, `task.review`, or `task.view` must not be treated as implicit publication permission.
- No grants are added in J1. Until permission catalog and grants are explicitly approved, post-creation journalism metadata and publication-status endpoints remain unavailable.

## F. Audit requirements

Reuse `audit_logs` with `module = 'task'` and `entity_type = 'journalism_task_details'`. Do not write publication states into `task_status_events`, because that table represents execution workflow.

Required actions:

- `create_journalism_detail`
- `update_journalism_metadata`
- `change_publication_status`

Audit records must include actor ID, task/detail entity ID, timestamp, old values, new values, and a reason where required. Publication events must record old/new publication status and relevant timestamps. Withdrawal requires a reason. Metadata audit payloads should contain only changed fields and must not contain cookie, session, token, password, secret, or future protected source/contact data.

Work-kind lifecycle changes in a future administration checkpoint require separate audit actions (`create`, `update`, `activate`, `deactivate`) and a reference check before any deletion attempt.

## G. Proposed indexes and constraints

Design only; no SQL is created in J1.

### `journalism_work_kinds`

- UUID primary key.
- `code` non-empty, stable, unique, lowercase snake-case; proposed maximum 64 characters.
- `name` non-empty; proposed maximum 200 characters.
- optional `description`; proposed maximum 2,000 characters.
- `is_active boolean NOT NULL DEFAULT true`.
- `sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0)`.
- `created_at` and `updated_at` as `timestamptz NOT NULL DEFAULT now()`.
- indexes: unique `code`; display index on `(is_active DESC, sort_order, name)` if query plans justify it.

### `journalism_task_details`

- `task_id` UUID primary key and FK to `tasks(id)`; proposed `ON DELETE CASCADE` only because the detail cannot outlive its parent. Application workflows do not hard-delete tasks.
- `work_kind_id` UUID NOT NULL FK with `ON DELETE RESTRICT`.
- `publication_status` text NOT NULL DEFAULT `not_published`, checked against the four approved values.
- `planned_publication_at`, `published_at`, `created_at`, and `updated_at` use `timestamptz`.
- length and HTTP(S)-URL checks for optional text fields.
- consistency checks: scheduled requires planned time; published requires actual time; not-published/scheduled cannot have actual time.
- indexes: `(work_kind_id, task_id)`, `(publication_status, task_id)`, and partial `(planned_publication_at, task_id) WHERE planned_publication_at IS NOT NULL`.
- no duplicate index on `task_id`; the primary key already covers parent lookup.

An update trigger or RPC-owned update rule must maintain `updated_at`. Direct table writes from public, anon, and authenticated roles must be revoked; service-role access and security-definer RPC ownership/search path must match the hardened Task pattern.

## H. Migration plan

J1 creates no migration. If owner approves J2:

1. create the two additive tables and constraints;
2. seed only the owner-approved controlled work-kind catalog;
3. apply RLS/revokes and service-role-only grants before any application read/write path ships;
4. add no discriminator column and perform no automatic backfill of existing tasks;
5. add repository read composition and existence-based list filters;
6. keep all Journalism mutation endpoints disabled until their RPCs and authorization tests are approved;
7. add the atomic creation RPC in the authorized creation checkpoint, reusing `api_assign_task_v2` inside one database transaction;
8. release behind a server-only Journalism feature flag defaulting false if the implementation checkpoint introduces user-visible behavior.

Rollback is additive: disable application surfaces, preserve existing `tasks`, and use a separately approved rollback migration for the new tables only after confirming whether any Journalism data exists. Never reinterpret or delete normal tasks.

## I. Test plan

### Contract/schema

- work-kind code uniqueness, active/inactive behavior, length checks, stable historical join, and deletion restriction;
- detail one-to-one FK, allowed publication statuses, timestamp consistency, URL validation, and nullable optional fields;
- verify no `task_domain`/`task_kind` column is introduced;
- verify normal tasks require no detail row.

### Atomic creation

- successful assignment creates task, participants, audit, and exactly one detail row;
- invalid/inactive work kind creates no task or participant/audit residue;
- forced detail/audit failure rolls back the entire assignment;
- recurrence input is denied for Journalism creation in v1;
- `task.create` without `task.assign` cannot create/assign a Journalism Task;
- cross-department and invalid participant/reviewer direct API attempts are denied.

### Read isolation

- list/detail results return `journalism = null` for normal tasks and the authorized detail for Journalism Tasks;
- JOIN/EXISTS filters do not widen legacy/RBAC visibility;
- direct detail-table/API access cannot bypass parent Task visibility;
- inactive work kind displays on an authorized historical task but is absent from new-task choices.

### Publication and metadata security

- every allowed and denied state-transition edge;
- scheduled requires a planned time; published requires an actual time;
- withdrawal requires a reason and preserves publication history;
- concurrent/stale transitions fail safely;
- `task.view`, watcher relation, `task.create`, and `task.edit_all` alone do not grant metadata/publication mutation;
- scope and workflow guard must both allow; either denial produces final denial;
- audit entries contain correct old/new values and no sensitive authentication material.

### Regression gates

- Phase 1A critical authorization/workflow suite;
- flag-OFF/flag-ON task equivalence where applicable;
- TypeScript, changed-file ESLint, production build, normal task end-to-end, and owner role smoke;
- `SECURITY_CRITICAL_MISMATCH = 0` and `RESTRICTIVE_MISMATCH = 0` before any controlled activation.

## J. Risks and open blockers

| Item | Status/mitigation |
|---|---|
| Current recurrence engine cannot reproduce Journalism details | Block Journalism recurrence in v1; separate future design required. |
| Final work-kind Vietnamese names/order are not approved | Do not seed until owner approves J1 catalog presentation. |
| No approved grants for journalism writes | Keep update/publication endpoints unavailable; later owner decision required. |
| Publication restoration after withdrawal | Not allowed in v1; separate contract required. |
| Source/contact confidentiality | Field excluded from v1. |
| CMS preview URLs | Excluded from `article_url`; require future CMS authorization. |
| Existing task DTO/query breadth | Add nullable composed journalism object and test normal-task payload/regressions. |
| Transaction reuse could drift if `api_assign_task_v2` signature changes | Contract tests must verify the wrapper calls the current canonical signature. |

## K. GO/NO-GO recommendation for J2

**Recommendation: GO for owner review, then GO to J2 only after explicit owner approval of this contract.**

J2 scope should remain additive schema plus read path. It may create the two approved tables, constraints, approved seed rows, hardened read composition, and tests. It must not add `task_domain`/`task_kind`, enable Journalism mutations, change RBAC grants, implement UI, deploy production, or start CMS/Topics work.

The atomic creation RPC and all metadata/publication write endpoints remain design-only until the corresponding implementation checkpoint has an approved permission/grant matrix and transaction tests.
