# Journalism Tasks Design

Status: design only; no implementation, migration, schema change, UI change, or deployment is included.

Date: 2026-09-17

## Scope and constraints

This document designs Journalism Tasks as an extension of the existing Task domain. It does not authorize implementation. Phase 1A remains the approved authorization baseline:

- baseline commit: `abbb049fd39d425b9a5d1a52504598fdc31eff9d`
- `TASK_RBAC_V2_ENABLED=true`
- permission editing remains disabled
- existing production release and rollback checkout remain untouched

Journalism Tasks design explicitly excludes CMS connector work, Topics/Series tables, KPI, dashboards, AI, permission editing, audit redesign, and changes to attendance, leave, or schedule modules.

## A. Current Task architecture summary

### Resource and workflow

The current system uses `tasks` as the resource identity and already supports assigned, personal, recurring, and duty-oriented work. Relevant identity and routing fields include `title`, `description`, `task_type`, `task_category`, `department_id`, `created_by`, `owner_id`, `assignee_id`, `reviewer_id`, `assignment_mode`, `start_date`, `due_date`, and `due_time`.

The current execution status vocabulary is:

`new`, `in_progress`, `blocked`, `waiting`, `pending_review`, `done`, `rejected`, and `cancelled`.

The established assigned-task path is broadly:

`assign -> in_progress -> submit -> pending_review -> return/rejected or approve/done`,

with existing support for resubmission, scoring, cancellation, deadline changes, comments, attachments, progress reports, and status history.

### Participants and related records

`task_assignees` stores participant relationships with `assignment_role` values `owner`, `assignee`, and `watcher`. Existing related records cover:

- `task_comments`
- `task_attachments`
- `task_progress_reports`
- `task_progress_logs`
- `task_status_events`
- `task_deadline_history`
- `task_completion_scores`
- `task_evaluation_checkpoints`
- `task_qualitative_evaluations`
- recurrence rules and occurrences

The detail repository composes the task row and these related records into the existing task list/detail DTOs. Journalism Tasks should reuse this composition rather than introduce a second task engine.

### Authorization

Phase 1A provides RBAC base permissions including `task.view`, `task.create`, `task.assign`, `task.comment`, `task.edit_all`, `task.review`, `task.score`, `task.evaluate.step1`, and `task.evaluate.step2`. Mutation authorization remains layered: RBAC base access plus legacy relationship/department/workflow guards plus RPC/database validation.

Current legacy-equivalent visibility is relationship and organization aware. It considers creator/owner/assignee/reviewer, `task_assignees`, department visibility, and leadership roles. The Journalism Task design must not infer a new visibility rule from a journalism-specific field.

## B. Journalism Task business concept

A Journalism Task is one assigned editorial work item or deliverable tracked through the existing Task workflow. It has the same execution lifecycle as a normal task, plus metadata describing newsroom intent and publication progress.

The design distinguishes three concepts:

1. **Task execution** — who is responsible, what is required, the due date, progress, review, score, and completion.
2. **Journalism metadata** — work kind, location, and editorial notes in v1; content format, source/contact notes, and editorial relationships are future extensions.
3. **Publication lifecycle** — not published, scheduled, published, or withdrawn.

These concepts must not be collapsed into one status column. A task may be `pending_review` while its publication status is `not_published`; a completed editorial task may later be `published` or `withdrawn` without changing the historical execution status.

### Unit of work

Version 1 should model one Journalism Task as one editorial deliverable or clearly bounded assignment. A single assignment that produces several independent deliverables should use separate tasks linked by a future related-task relationship, rather than encoding a many-output package into one row.

## C. Recommended data model

### Architecture options

| Criterion | Option A: extend `tasks` directly | Option B: `tasks` + `journalism_task_details` |
|---|---|---|
| Migration risk | Higher: adds many nullable columns to the central task table and touches its broad query surface. | Lower and additive: normal tasks have no detail row and keep their current shape. |
| Backward compatibility | Weaker: every task query/DTO inherits journalism fields even when irrelevant. | Stronger: existing reads remain valid; journalism composition is opt-in. |
| Query complexity | Simpler for a single row, but central selects become wider and domain logic leaks everywhere. | Requires a one-to-one join or a second detail query, but keeps boundaries explicit. |
| UI complexity | Conditional fields still required and are easy to mix into normal-task forms. | A conditional newsroom section/card maps cleanly to the detail object. |
| RBAC impact | Greater risk of generic task updates mutating editorial fields unintentionally. | Journalism mutations can have explicit endpoints/guards while retaining task visibility. |
| CMS readiness | Provider fields would accumulate in the central task table. | External identifiers/status remain isolated and provider-neutral. |
| Topics/Series readiness | Future relations are likely to further overload `tasks`. | Future relations can target the Journalism Task aggregate without changing normal tasks. |
| Rollback safety | Lower: removing or ignoring central columns affects all task records and queries. | Higher: feature surfaces can be disabled while normal tasks and workflow remain intact. |

**Recommendation: Option B.** It adds one bounded domain extension while preserving `tasks` as the resource identity, workflow owner, and RBAC target. Option A is not recommended because the current task table and repository already serve several task variants and many related workflows.

### Recommendation: `tasks` plus `journalism_task_details`

Keep `tasks` as the canonical resource and add a one-to-one optional detail record for journalism-specific data:

```text
tasks
  1 ---- 0..1 journalism_task_details
              |
              +---- journalism_work_kinds
```

Only a Journalism Task has a `journalism_task_details` row. Existing normal, personal, recurring, and duty tasks continue to work without one.

The canonical Journalism Task discriminator for v1 is the existence of a `journalism_task_details` row for the task. Do not add `task_domain` or `task_kind` to `tasks` in v1: a second discriminator would create two sources of truth. Journalism list/filter queries may use a join or `exists` predicate. Creation must create the task and required detail atomically so a partial task cannot be left behind.

### Controlled work kind master data

`journalism_work_kinds` is a controlled master-data table, not an enum and not free text. The proposed contract is:

| Field | Classification | Rule |
|---|---|---|
| `id` | REQUIRED | Stable primary key referenced by detail rows. |
| `code` | REQUIRED | Unique, stable machine identifier; do not rename casually. |
| `name` | REQUIRED | Display label. |
| `description` | OPTIONAL | Guidance for newsroom users. |
| `is_active` | REQUIRED | Inactive kinds cannot be selected for new tasks. |
| `sort_order` | REQUIRED | Stable UI ordering. |
| `created_at` | REQUIRED | Audit metadata. |
| `updated_at` | REQUIRED | Audit metadata. |

Rules:

- v1 seed rows are initial data, not an immutable enum.
- An inactive kind remains readable for historical tasks.
- A referenced kind cannot be hard-deleted; deactivation is the archival mechanism.
- New-task validation must reject inactive or unknown kind IDs.
- No work-kind administration UI is included in this design phase; it belongs to a later checkpoint.

The candidate v1 seed catalog for owner review is: `news`, `article`, `interview`, `reportage`, `photo`, `video`, `event_coverage`, `editing`, `translation`, and `other`. These rows are initial controlled data only. Names may be localized; codes should remain stable after use. The implementation must not seed the catalog until the newsroom confirms the list, naming, ordering, and whether any item should be split or merged.

### `journalism_task_details` proposed fields

The detail table should reference `tasks.id` one-to-one and `journalism_work_kinds.id`. It should contain only journalism-specific values; fields already authoritative on `tasks` must be reused.

| Field | Classification | Source/meaning |
|---|---|---|
| `task_id` | REQUIRED | One-to-one FK to `tasks`; primary key. |
| `work_kind_id` | REQUIRED | FK to controlled `journalism_work_kinds`; required for new Journalism Tasks. |
| `planned_publication_at` | OPTIONAL | Intended publication date/time; independent of task deadline. |
| `published_at` | OPTIONAL | Actual publication time, when known. |
| `publication_status` | REQUIRED for Journalism Tasks | Separate publication lifecycle with default `not_published`. |
| `location` | OPTIONAL | Coverage location or dateline. |
| `article_url` | OPTIONAL | Public/published article URL only; never a confidential CMS preview URL. |
| `editorial_notes` | OPTIONAL | Internal newsroom notes that are not source/contact data. |
| `content_format` | FUTURE | Use controlled master data if later approved; no duplicate taxonomy in v1. |
| `source_contact_notes` | FUTURE | Requires separate visibility, retention, and audit policy. |
| `external_system` | FUTURE | Provider-neutral external system key; no MasterCMS coupling in v1. |
| `external_content_id` | FUTURE | Provider-neutral CMS/content ID. |
| `external_status` | FUTURE | Last known provider status, distinct from local publication status. |
| `external_published_at` | FUTURE | Provider-reported publication time. |
| `topic/series relation` | FUTURE | Use a proper relation model capable of many-to-many relationships. |
| `related task relation` | FUTURE | Use a proper relation model; do not add a singular self-reference in v1. |

The following should be reused from `tasks` and not duplicated in the detail table: article/topic title (`tasks.title`), assignment brief (`tasks.description` and existing requirements representation), reporter/owner/assignee (`tasks.owner_id`/`assignee_id`), editor/reviewer (`tasks.reviewer_id`), department (`tasks.department_id`), deadline (`tasks.due_date`/`due_time`), priority (`tasks.priority`), attachments, comments, progress, score, and audit history.

## D. Field catalog decisions

### Required for v1

- `task_id`, `work_kind_id`, and `publication_status`
- existing task title and assignment brief
- existing owner/assignee/reviewer relationships
- existing department and deadline

### Optional for v1

- planned publication time
- actual publication time
- location
- article URL
- editorial notes

### Future

- content-format taxonomy as controlled master data, if needed
- source/contact notes under a separate restricted policy
- external CMS identifiers and provider status
- Topics and Series relationships
- many-to-many related-task/topic/series relations
- provider-synchronized author/editor fields
- richer format taxonomy if newsroom requirements exceed a simple controlled value
- publication scheduling integration

### Not needed as duplicate columns

- a second reporter field
- a second editor/reviewer field
- a second department field
- a second deadline field
- a second priority field
- a second attachment system
- a second comment or audit system

## E. Workflow mapping

### Reuse unchanged

Journalism Tasks should initially reuse the existing task mutations and guards for:

- create/assign
- participant and department validation
- accept/start and progress reporting
- submit completion
- reviewer return and approval
- resubmission
- deadline change
- comment
- attachment
- score/evaluation
- cancellation
- audit/status history

The same server-only RBAC flag and the same layered authorization contract apply. `task.view` is base resource access, not a mutation grant. No journalism action may infer `approve`, `score`, `update`, or `cancel` from `task.view`.

### Journalism-specific additions

Publication metadata changes need a separate design and authorization review. Until that review is approved, they should be treated as an explicit future mutation surface, not silently folded into generic task update. The eventual implementation must define:

- who may change publication status;
- which transitions are allowed;
- whether publication metadata updates require task visibility plus an additional workflow guard;
- whether external CMS updates are service-owned and audited separately.

## F. Publication-status model

Publication status is independent from task execution status. The v1 state set is:

`not_published`, `scheduled`, `published`, and `withdrawn`.

The default is `not_published`. `drafting`, `editing`, and `approved` are not publication states because they overlap the existing Task execution/review workflow. Detailed transition and authorization rules are defined in `JOURNALISM_TASKS_J1_CONTRACT.md` for owner review.

`planned_publication_at` and `published_at` are timezone-aware timestamps stored canonically as PostgreSQL `timestamptz`/UTC. The default UI presentation timezone is `Asia/Ho_Chi_Minh`; the system must not store ambiguous local timestamp values.

No publication status should change the existing task status automatically in v1 without an explicit, tested contract.

## G. Role/RBAC model

The first implementation should reuse existing task permissions and legacy guards. No new grants are seeded in this design phase.

| Role | View | Create | Assign | Submit | Review/return | Approve | Score/evaluate | Publication metadata |
|---|---|---|---|---|---|---|---|---|
| `phong_vien` | Own/assigned and legacy-equivalent scope | Existing `task.create` behavior | Only where existing task rules permit | Own assigned work | No generic reviewer bypass | No | Existing evaluator rules only | Read where task is visible; edits require future explicit policy |
| `bien_tap_vien` | Own/assigned and compatibility-role scope | Existing `task.create` behavior | Existing legacy scope only | Own assigned work | Only when selected as reviewer and legacy guard allows | No implicit approval | Existing evaluator rules only | Read where task is visible |
| `truong_phong` | Assigned/department scope | Existing `task.create` behavior | Department scope | Own assigned work | Existing reviewer/manager guard | Only through existing review path; no new bypass | `task.evaluate.step1` and existing stage rules | Read in visible scope; write policy future |
| `pho_truong_phong` | Assigned/department scope | Existing `task.create` behavior | Department scope where current policy allows | Own assigned work | Existing reviewer guard | Existing workflow guard only | Existing stage rules | Read in visible scope; write policy future |
| `pho_tong_bien_tap` | Existing leadership scope | Existing task behavior | Existing leadership scope | If assigned | Existing reviewer guard | Existing workflow guard only | Existing stage rules | Read in visible scope; publication write future |
| `tong_bien_tap` | Organization view per current role semantics | Existing role semantics | Existing role semantics | Only if assigned and allowed | Existing review path | No blanket mutation inference | Step 2 evaluator rules | Read in visible scope; publication policy must be explicit |
| `admin` | Existing admin/organization scope | Existing admin behavior | Existing admin behavior | Existing guards still apply | Existing admin/review guards | Existing guards still apply | Existing admin/evaluation rules | Administrative access only if explicitly added later |

Important constraints:

- Journalism metadata access must not widen task visibility.
- A role that can create a task does not automatically gain assignment scope.
- `task.edit_all` does not bypass legacy workflow guards.
- Evaluation retains evaluator, reviewer, and stage rules.
- Permission editing remains disabled.

## H. UI proposal

Extend the existing Task Center, assignment form, and task detail page rather than creating a parallel Journalism Tasks application.

### Creation/assignment form

Add a Journalism creation choice that results in an atomic task-plus-detail operation. The conditional Journalism section should initially contain only:

- controlled `work_kind` selector showing active kinds in `sort_order`;
- planned publication time;
- location;
- optional article URL;
- optional editorial notes.

Existing title, brief, assignee, reviewer, department, priority, deadline, collaborators/watchers, recurrence, and attachment controls remain the source of truth.

The form must reject inactive work kinds for new tasks and preserve the display of inactive kinds on historical tasks.

### List and filters

Reuse existing list authorization and filters. Add Journalism-specific filters only after query semantics are characterized:

- Journalism vs normal task domain;
- work kind;
- publication status;
- planned publication date.

Filters must be applied after the same RBAC/legacy resource scope. They must not turn an unauthorized task into a visible task.

### Detail page

Add a newsroom metadata card containing work kind, planned/actual publication time, location, publication status, and public article URL. Keep task status, progress, review, score, comments, attachments, and audit history in their existing sections. Content format, source/contact data, CMS preview links, related tasks, Topics, and Series remain future work.

### Mobile

Use the existing responsive task shells, stacked metadata rows, readable status badges, and non-destructive overflow for URLs/notes. Avoid a second dense matrix or desktop-only editorial panel.

## I. CMS compatibility

Design the local detail contract around provider-neutral fields:

- `external_system`
- `external_content_id`
- `external_status`
- `article_url` (public/published URL only)
- `external_published_at`

Do not name columns or APIs after MasterCMS. A later connector may map those fields to a provider adapter, but local task authorization and publication status must remain authoritative for local behavior until an explicit synchronization contract exists.

The connector, webhook handling, retry policy, conflict resolution, and service credentials are out of scope. Secrets must remain server-only and must never appear in reports or client DTOs.

## J. Topics / Series compatibility

The design reserves future many-to-many editorial organization without creating tables now. A Topic or Series may relate to many Journalism Tasks, and a Journalism Task may relate to multiple topics/series if the owner later approves that model.

The preferred future shape is a relation model rather than a single denormalized text field or singular self-reference. The exact cardinality, ordering, primary topic, and archive behavior require a separate design. No Topic, Series, or related-task key is added in v1.

## K. Migration design (design only)

No migration is to be created or applied in this phase. A future migration sequence should be additive and reversible:

1. Create `journalism_work_kinds` with unique `code`, active flag, ordering, timestamps, and protected references.
2. Create `journalism_task_details` with `task_id` as a one-to-one FK to `tasks` and `work_kind_id` as an FK to the master table.
3. Treat detail-row existence as the only v1 discriminator; add no `task_domain`/`task_kind` column.
4. Add indexes for work-kind filtering, publication status, and planned publication time; the detail primary key covers task lookup.
5. Backfill no existing task as Journalism unless an owner-approved characterization identifies it; normal task behavior must remain unchanged.
6. Add an atomic database creation boundary so task and detail either both commit or both roll back.
7. Add service-side read composition and validation before exposing new writes.
8. Add UI only after read and authorization tests pass.

Rollback should be metadata-safe: disable Journalism Task creation/read surfaces, retain existing normal task rows, and remove only newly created detail rows or tables in a separately approved rollback migration. Never drop or reinterpret existing task columns as part of Journalism rollback.

## L. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Duplicate identity fields drift from `tasks` | Reuse task title, people, department, deadline, priority, files, comments, and audit records. |
| Publication status is confused with task status | Keep separate columns, transitions, UI sections, and audit events. |
| Journalism filters widen visibility | Apply existing RBAC and legacy scope first; test direct APIs and list filtering. |
| Inactive work kinds break history | Soft-deactivate only; preserve FK and display name/code through historical joins. |
| Free-text taxonomy fragments reporting | Controlled master data with stable unique codes. |
| CMS coupling blocks future providers | Provider-neutral external fields and adapter boundary. |
| Admin/edit permission bypasses workflow | Preserve legacy guards and require explicit mutation authorization. |
| Existing normal tasks regress | Optional one-to-one detail row; no mandatory backfill or status reinterpretation. |
| Sensitive source/contact notes leak | Exclude them from v1 and design restricted visibility, retention, and audit before storing them. |

## M. Open questions requiring owner decision

1. Confirm the initial controlled `journalism_work_kinds` seed names, ordering, and ownership of future additions.
2. Approve the J1 publication transition and metadata-write authorization proposals before any grant or mutation implementation.
3. Define restricted visibility, retention, and audit policy before future source/contact data is stored.
4. Confirm whether and when work-kind administration enters a later checkpoint.

## N. Recommended implementation checkpoints

### Checkpoint J1 — Contract and characterization

- finalize the detail-row discriminator, work-kind seed codes, publication states, and role matrix;
- characterize existing task query/detail/mutation behavior;
- define DTO and audit requirements;
- no schema or production changes until owner approval.

### Checkpoint J2 — Additive schema and read path

- create controlled master data and one-to-one detail schema;
- add indexes and constraints;
- implement server-side read composition;
- verify normal tasks are unchanged;
- verify inactive work kinds remain readable but cannot be selected for new tasks.

### Checkpoint J3 — Authorized create/update path

- extend existing assignment/create flow with journalism metadata;
- preserve `task.create` versus `task.assign` separation;
- retain workflow guards, RPC validation, and audit behavior;
- add direct API negative tests and cross-scope tests.

### Checkpoint J4 — UI extension

- extend current form, list filters, and detail card;
- validate responsive/mobile behavior;
- keep CMS and Topics/Series as future integration markers only;
- run TypeScript, changed-file lint, critical authorization suite, and build gates.

### Checkpoint J5 — Controlled newsroom pilot review

- owner-authenticated role smoke;
- publication-status characterization;
- shadow comparison and mismatch review;
- no CMS connector, permission editing, or broad rollout without a separate approval.

## Non-goals and backlog

Not part of this design: CMS connector, Topics/Series implementation, KPI, Editor-in-Chief dashboard, AI, permission editing, audit redesign, attendance, leave, schedule changes, or production deployment.

Tracked separately as backlog: permission editing, `PROJECT_STATUS.md` reconciliation, stale workflow-download matcher test, and pre-existing full-repository lint/test debt.

## Decision record

Owner-approved decision: `work_kind` uses controlled lookup/master data via `journalism_work_kinds`; it is not a fixed enum and not free text. Codes are unique and stable; inactive kinds are unavailable for new tasks but remain valid for historical display; referenced kinds are not hard-deleted; no work-kind administration UI is included in this design phase.
