# Personal Plan Approval + HH:mm Design

Date: 2026-09-21  
Status: Approved design; implementation not started  
Branch: `feature/personal-plan-approval-time`

## 1. Objective and scope

Add an approval workflow and local start/end time precision for **Personal Plans**
served by `/work-schedule/staff` and `/api/work-schedule`. Personal Plans are
the creator-owned `work_schedules` records created through the staff flow. The
existing organization calendar/leadership records and unrelated
`work_schedules` consumers must not inherit the new approval requirement by
accident. Because the current table has no reliable discriminator, the
implementation must add one before applying approval predicates.

The implementation will:

- put new Personal Plans in `PENDING_APPROVAL`;
- resolve the creator's expected department approver at submission time;
- authorize department managers only within their department and allow the
  existing global approver roles (`admin`, `tong_bien_tap`,
  `pho_tong_bien_tap`) globally;
- prohibit self-approval;
- require `startTime` and `endTime` in `HH:mm` for new Personal Plans;
- validate the combined local date/time interval in `Asia/Ho_Chi_Minh` without
  UTC date parsing;
- preserve legacy Personal Plans as effective `APPROVED` records;
- retain approval history when an approved or rejected plan is edited and
  resubmitted.

Out of scope: unrelated calendar behavior, leave-request semantics, RBAC role
definitions, department-manager maintenance, Journalism/J6 work, database
cleanup unrelated to `work_schedules`, and any production migration or
activation during the specification phase.

## 2. Existing architecture and constraints

The current Personal Plan flow uses:

- `src/app/api/work-schedule/route.ts` for authenticated GET/POST/DELETE;
- `src/lib/workScheduleRepository.ts` for `work_schedules` reads/writes;
- `src/components/WorkSchedulePageShell.tsx` for staff and leadership UI;
- `work_schedules.work_date`, `end_date`, `plan_type`, `start_time`,
  `end_time`, `participant_ids`, and `created_by`;
- `departments.manager_id` as the configured department-manager source;
- `ServerAuthUser.department_id`, `role_code`, and
  `is_department_manager` for request authorization;
- leave-request RPCs and `audit_logs` as the closest existing approval/audit
  pattern.

The current `work_schedules` table does **not** reliably distinguish a staff
Personal Plan from an organization calendar record: `plan_type`,
`participant_ids`, and `created_by` are insufficient because organization
records can also have one participant or be created by a leader. Approval must
therefore be gated by a new persisted discriminator, not inferred from those
fields.

The repository currently contains unrelated uncommitted changes. The feature
branch must preserve them; implementation commits must include only files in
the approved feature scope.

## 3. Data model

### 3.1 Additive columns on `work_schedules`

Add one migration with idempotent `add column if not exists` operations:

| Column | Type | Default/constraint | Purpose |
| --- | --- | --- | --- |
| `approval_status` | `text` | legacy backfill `APPROVED`; new inserts `PENDING_APPROVAL` | Current state |
| `approver_id` | `uuid` | nullable FK to `staff_users(id)` | Expected department approver resolved at submission |
| `submitted_at` | `timestamptz` | nullable; set on new/resubmitted plans | Approval submission time |
| `reviewed_by` | `uuid` | nullable FK to `staff_users(id)` | Actor who approved/rejected the current submission |
| `reviewed_at` | `timestamptz` | nullable | Review time for the current submission |
| `review_note` | `text` | nullable | Mandatory rejection reason; optional approval note |
| `schedule_scope` | `text` | nullable for legacy rows; new values `personal` or `organization` | Exact approval boundary |
| `workflow_revision` | `bigint` | not null default `0` | Optimistic concurrency token for edits/reviews |

Add a check constraint allowing exactly `PENDING_APPROVAL`, `APPROVED`, or
`REJECTED`, plus indexes supporting creator/status and approver/status queues.
The existing date/time columns remain SQL `date` and SQL `time`; no UTC
timestamp column is introduced.

`schedule_scope = 'personal'` is the only value subject to this approval
workflow. `schedule_scope = 'organization'` is used by the existing leadership/
admin calendar flow and never receives Personal Plan approval requirements.
`NULL` means a legacy row whose historical origin cannot be proven from the
existing schema; it remains readable/effective and is treated as approved for
display, but is not placed in the Personal Plan approval queue. New routes must
always write an explicit value and must never default a new row to NULL.

The Personal Plan endpoint is the authoritative writer for
`schedule_scope = 'personal'`; the existing organization-calendar writer must
write `schedule_scope = 'organization'`. A client-supplied scope is ignored or
rejected unless it matches the server route/operation. This explicit column
and writer boundary are the discriminator that prevents unrelated
`work_schedules`, office calendar records, and `online_work_schedules` from
requiring approval.

### 3.2 Approval history

The existing `audit_logs` table is the durable history mechanism. Every create,
resubmission, approval, rejection, and material edit that changes approval
state must write an audit event containing the before/after row snapshots (or a
minimal equivalent JSON payload when the row is not yet present). The current
row's `reviewed_by`, `reviewed_at`, and `review_note` describe the latest
submission only; audit logs preserve earlier approvals and rejections.

Editing an approved plan must not be implemented as a silent destructive clear
of reviewer evidence. The update transaction writes an audit event first (or
atomically with the update), changes the row to pending, refreshes
`submitted_at`, reruns approver resolution, and clears only the current-row
review fields because the previous review remains in `audit_logs`.

### 3.3 Legacy backfill

The migration must:

1. add nullable approval columns and nullable `schedule_scope`;
2. set existing rows with no approval metadata to `APPROVED`;
3. set `workflow_revision = 0` for every existing row;
4. leave `schedule_scope` NULL for historical rows because the current data
   cannot prove whether each row came from the staff or organization flow;
5. leave existing dates, times, participants, creator, and notes unchanged;
6. add approval/status constraints and indexes for future rows;
7. avoid rejecting or deleting existing rows.

Legacy rows are readable/effective immediately and do not require a new review.
They may be edited by their existing authorized creator/admin rules. A legacy
row edited through the Personal Plan endpoint is explicitly promoted to
`schedule_scope = 'personal'`; a material edit then creates a new pending
submission and audit event. A legacy row edited through the organization
endpoint remains NULL/legacy and does not enter approval. This avoids silently
misclassifying historical organization rows while giving an explicitly opened
Personal Plan the new workflow.

## 4. Approval state machine

```text
                    material edit/resubmit
          +------------------------------------------+
          |                                          v
  create  |       +------------------+       +------------------+
 --------+------> | PENDING_APPROVAL | ----> | PENDING_APPROVAL |
                  +--------+---------+       +------------------+
                           | approve                 ^
                           v                          |
                  +------------------+                |
                  |     APPROVED    | --edit--------+
                  +--------+---------+
                           | reject is not valid from approved
                           |
                           v
                  +------------------+
                  |     REJECTED     | --edit/resubmit-->
                  +------------------+
```

Rules:

- New Personal Plan: `PENDING_APPROVAL` with `submitted_at = now()`.
- Pending can be approved or rejected exactly once per current submission.
- Rejection requires a non-empty reason of 3-1000 characters.
- Approved and rejected plans can be edited by the creator under existing
  ownership rules; any material field change returns the plan to pending.
- Resubmission refreshes `submitted_at`, reruns `approver_id`, and clears only
  current-row review fields (`reviewed_by`, `reviewed_at`, `review_note`).
- A no-op edit does not create a new submission or alter approval state.
- Delete behavior remains the current creator/admin behavior and is not an
  approval action.
- Self-approval is rejected even when the creator is a department manager.
- Approval/rejection of a non-pending row returns a conflict response.
- A review action must include the row's current `workflow_revision` observed by
  the reviewer. The locked review operation compares it and returns conflict
  on mismatch; a successful review increments the revision.
- Every material edit increments the revision. If an edit and review race, row
  locking plus the revision comparison makes exactly one operation win and the
  stale operation returns conflict rather than approving an older snapshot.

## 5. Approver resolution and authorization

### 5.1 Resolution at submission

At create/resubmission time, resolve the creator's active department and
`departments.manager_id` and store that UUID in `approver_id`. If the creator's
department has no manager, keep `approver_id` NULL and still create/resubmit as
pending. No individual is hardcoded as a fallback.

### 5.2 Review scope

The server must enforce all of the following, regardless of UI filtering:

- global approvers are `admin`, `tong_bien_tap`, and `pho_tong_bien_tap`;
- a department manager may review only rows whose creator belongs to the
  manager's active department and where the manager is the configured
  `departments.manager_id`;
- a reviewer cannot review their own plan;
- a global approver may review any pending Personal Plan;
- a manager cannot approve a plan merely because `approver_id` contains their
  ID if the current department configuration no longer authorizes them;
- rows with `approver_id IS NULL` are reviewable only by global approvers;
- inactive reviewers/creators fail normal actor checks.

Authorization must be implemented in the route/repository boundary and in the
transactional review RPC (or equivalent locked server-side operation), so a
crafted request cannot bypass the UI scope.

### 5.3 Audit actor

Audit events use the authenticated actor ID and include the action name,
entity ID, previous state, and new state. Rejection reasons are retained in the
audit payload even after a later resubmission.

The minimum required action names are:

- `create_personal_plan`;
- `submit_personal_plan` for a new or resubmitted pending revision;
- `edit_personal_plan` for a material or non-material edit;
- `approve_personal_plan`;
- `reject_personal_plan`;
- `promote_legacy_personal_plan` when a NULL-scope legacy row is first edited
  through the Personal Plan endpoint.

Each event records the workflow revision before and after the operation,
`schedule_scope`, approval status, actor ID, and any rejection/approval note.

## 6. Date/time model and validation

### 6.1 Request contract

New Personal Plan create/update requests require:

```json
{
  "planType": "work" | "business" | "event",
  "workDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "title": "...",
  "location": "...",
  "notes": "..."
}
```

The existing `id` field remains optional for create and identifies an edit.
Participant ownership behavior remains unchanged: non-admin Personal Plans are
owned by the authenticated creator; admin behavior remains as currently
implemented.

### 6.2 Local interval validation

Use a pure helper that parses date components and time components as integers
and compares a local tuple/epoch-day plus minutes. Do not call
`new Date("YYYY-MM-DD")`, `Date.parse("YYYY-MM-DDTHH:mm")`, or convert these
values through UTC. The helper's business-time contract is `Asia/Ho_Chi_Minh`.

Validation rules:

- dates must be real calendar dates, including leap years;
- times must match `^(?:[01]\\d|2[0-3]):[0-5]\\d$`;
- `endDate` cannot precede `workDate`;
- combined end date/time must be strictly after combined start date/time;
- same-day plans therefore require `endTime > startTime`;
- multi-day plans may use any valid times as long as the combined interval is
  positive;
- all four fields are required for new Personal Plans, including `business`
  and `event` plans;
- malformed or impossible values return `invalid_request` HTTP 400.

The helper must be shared by API validation and repository/RPC input checks so
the client cannot create a row that the server would later reject.

## 7. Database operations and API contract

### 7.1 Create/update

Use an explicit Personal Plan writer boundary (for example
`/api/work-schedule/personal`) for create/update. Keep the existing
organization-calendar writer separate and unchanged except for writing
`schedule_scope = 'organization'`. The Personal Plan route validates the
request, identifies the authenticated creator, and delegates to a transactional
repository/RPC operation that:

1. verifies ownership/admin scope for edits;
2. validates the date/time interval;
3. determines whether material fields changed;
4. verifies/sets the explicit `schedule_scope = 'personal'` discriminator;
5. resolves `approver_id` on new/resubmitted submissions;
6. compares the caller's expected `workflow_revision` for edits and returns
   conflict on mismatch;
7. sets or preserves approval state according to the state machine;
8. increments the revision and writes the row and audit event atomically.

Successful responses continue returning `{ row }`, with approval fields
included. Invalid input returns `{ code: "invalid_request" }` with HTTP 400.
Unauthorized review returns `forbidden` (403), unavailable/non-pending review
returns `not_found` or `conflict` (409) according to the existing API error
conventions.

### 7.2 Review

Add a focused Personal Plan review action without broadening the existing
delete contract:

```http
PATCH /api/work-schedule
Content-Type: application/json

{
  "id": "uuid",
  "action": "approve" | "reject",
  "workflowRevision": 7,
  "note": "required for reject"
}
```

The route obtains the authenticated actor, checks review eligibility, requires
a rejection note for `reject`, and calls the locked review operation. The
operation rechecks pending state, self-approval, current department manager
scope, and global-role scope before updating and auditing.

### 7.3 Read

`GET /api/work-schedule` remains compatible with existing range/scope query
parameters. Rows gain approval metadata and reviewer/approver display joins as
available. The Personal Plan view uses an explicit personal scope/filter; the
organization calendar view uses the organization scope/filter. The staff view
continues to return the creator's own plans when `scope=self`; leadership views
may receive a pending approval queue filtered by authorized
department/global scope. No unrelated calendar record is hidden or made
pending merely because it lacks Personal Plan approval metadata.

### 7.4 Error mapping

Use the existing API error conventions. Add only the mappings required for the
new workflow (invalid input, forbidden scope, conflict/non-pending state), and
do not alter unrelated RPC error mappings.

## 8. UI behavior

### 8.1 Personal Plan form

- Add required native `time` inputs for start and end to the Personal Plan
  form for every plan type.
- Preserve existing date, title, location, note, participant, and edit fields.
- Display server validation feedback without using browser-local UTC conversion.
- On successful create/edit, show pending status rather than implying immediate
  approval.

### 8.2 Status and review details

Each row displays a visible badge:

- `Ch? duy?t` for `PENDING_APPROVAL`;
- `?? duy?t` for `APPROVED`;
- `T? ch?i` for `REJECTED`;
- legacy rows render `?? duy?t` after migration backfill.

When present, show expected approver, reviewer, review time, and rejection
reason. A rejected plan remains editable by its creator and can be resubmitted.

### 8.3 Approval queue

Authorized leaders see only pending rows in their scope. The UI hides approve/
reject controls for creators reviewing their own row and for managers outside
the row's current department scope. The server remains authoritative.

## 9. Test matrix

### Unit/contract tests

- real date validation, including leap-day and invalid dates;
- `HH:mm` acceptance and rejection;
- same-day end-after-start;
- multi-day combined interval ordering;
- no UTC date shift for Vietnam-local dates;
- material-field detection;
- state transition table;
- legacy default/status mapping;
- rejection note minimum/maximum validation.

### Repository/API tests

- new Personal Plan creates pending with `submitted_at` and resolved manager;
- missing manager creates pending with `approver_id = NULL`;
- creator can create/view/edit own plan;
- manager sees only same-department pending rows;
- global approvers see and process all pending rows;
- self-approval is denied;
- manager scope is rechecked after department-manager changes;
- approved material edit becomes pending and writes audit history;
- rejected edit/resubmission becomes pending and retains prior rejection audit;
- non-material edit leaves approval state unchanged;
- review of non-pending row returns conflict;
- rejection requires and persists a reason;
- stale workflow revision returns 409;
- concurrent/double review permits only one success and preserves the winning
  audit event;
- unrelated calendar records remain unaffected.

### UI/regression tests

- status badges and review details render for all states;
- required start/end time fields are sent for business and event plans;
- rejected plan can be edited/resubmitted;
- creator does not see a self-approval action;
- existing staff/leadership schedule navigation and read scopes remain intact;
- TypeScript, ESLint, focused tests, and production build pass.

## 10. Rollout and rollback

Implementation will be delivered on the dedicated branch only. The migration
is additive and must be validated against a fresh backup/dry-run before any
production consideration. No migration is run during this specification
phase.

Rollout order after implementation approval:

1. focused tests and static checks;
2. local/staging schema validation and backfill rehearsal;
3. production artifact build with immutable release path;
4. isolated API/UI smoke tests;
5. only then a separately authorized production migration/activation.

Rollback is application-only where possible. If a schema rollback is required,
use the recorded backup and an explicitly reviewed reverse migration; do not
drop approval columns automatically because audit history must remain
recoverable. Existing legacy rows remain readable throughout.

## 11. Remaining design decisions

No owner decision remains for the approved scope. The following are explicit
implementation details to keep consistent with this specification:

- use the existing `audit_logs` mechanism for durable approval history;
- use `departments.manager_id` at submission time, with NULL allowed;
- allow only the three approved global roles to bypass department scope;
- gate approval exclusively on persisted `schedule_scope = 'personal'`; leave
  ambiguous legacy rows NULL and effective-approved until explicitly opened in
  the Personal Plan flow;
- use `workflow_revision` compare-and-swap plus row locking for stale/double
  review protection;
- keep unrelated `work_schedules` records outside the Personal Plan workflow;
- do not run migrations, deploy, or modify production as part of this spec
  task.
