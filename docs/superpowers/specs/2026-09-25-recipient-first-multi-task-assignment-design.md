# Recipient-First Multi-Task Assignment Design

Status: approved architecture, pending implementation plan
Date: 2026-09-25

## Goal and Scope

Redesign `/tasks/assign` so an authorized manager selects one recipient once
and submits one or more normal tasks for that recipient in one atomic batch.
Journalism assignment/self-registration remain on their existing routes and
APIs. There is deliberately no `Ghi chú` field and no notes column.

Preserved workflows: Journalism, Task Approval, Task Summary separation,
Event Assignment, Personal Plan, Attendance, notifications, audit, and
assignment-source semantics.

## User Flow

The page first renders `CHỌN NGƯỜI NHẬN VIỆC`. Cards remain disabled until a
recipient is selected. The selected state shows `Đang giao việc cho: <Tên> ·
<Phòng ban>` and `Đổi người`. Changing recipient updates the shared recipient
without clearing card content.

`truong_phong` receives an inferred own-department scope, no department
selector, and only active staff in that department. The UI shows
`Phạm vi: <Tên phòng>`. `tong_bien_tap` and `pho_tong_bien_tap` default to Ban
Biên tập; `Chọn phòng ban khác` opens the existing authorized department and
employee selection. Server-side scope remains authoritative.

One blank card is shown after recipient selection. Cards are numbered `VIỆC
1`, `VIỆC 2`, etc. `+ Thêm việc` appends a blank card and focuses its title.
Cards after the first expose `Xóa việc`; removal renumbers without changing
remaining values. Submit is `Giao việc` for one card and `Giao N việc` for N.

Card fields use existing model mappings only:

- `Tên công việc` -> `title`
- `Mô tả` -> `description`
- `Yêu cầu` -> `evaluation_criteria`
- `Hạn hoàn thành` -> `due_date` and `due_time`
- `Người phối hợp`, watchers, recurrence, priority, and attachments -> their
  existing fields/endpoints where already supported

Recipient, department, actor, and batch ID are shared fields. No card repeats
recipient selection.

## API Contract

`POST /api/tasks/assign` continues accepting the existing single-task payload.
A batch is recognized only when `mode` is exactly `batch`; malformed single
requests are not reinterpreted.

```json
{
  "mode": "batch",
  "batchId": "uuid",
  "departmentId": "uuid",
  "assigneeId": "uuid",
  "tasks": [{
    "title": "string",
    "description": "string",
    "requirements": ["string"],
    "dueDate": "YYYY-MM-DD",
    "dueTime": "HH:mm",
    "priority": "low|normal|high|urgent",
    "collaboratorIds": ["uuid"],
    "watcherIds": ["uuid"],
    "recurrenceFrequency": "daily|weekly|monthly|null",
    "recurrenceEndsOn": "YYYY-MM-DD|null"
  }]
}
```

The API enforces 1..20 cards, UUID/date/time formats, participant shape, and
all card validation before mutation. Errors identify `taskIndex`, `field`, and
Vietnamese message, for example `Việc 2 chưa có Tên công việc`.

Success returns ordered results and replay state:

```json
{"batchId":"uuid","tasks":[{"id":"uuid","title":"..."}],"count":3,"replayed":false}
```

## Batch RPC and Transaction Boundary

The additive migration adds:

```text
public.api_assign_task_batch_v1(
  p_actor_id uuid,
  p_batch_id uuid,
  p_department_id uuid,
  p_assignee_id uuid,
  p_tasks jsonb
) returns jsonb
```

The function validates shape/count, locks on actor+batch, checks idempotency,
then invokes existing `api_assign_task_v2` for every normalized card. It
collects results by input ordinal, stores the ordered IDs, and commits only
after all cards succeed. Any exception rolls back all tasks, participants,
recurrence rows, audits, and the idempotency insert. No task-creation rules
are duplicated in the wrapper.

Before each invocation, the API normalizes the card exactly as the current
single-task path does: `description` remains the task description and the
requirements array is serialized into the existing evaluation-criteria value.
The RPC receives those normalized values; it does not invent a second field
mapping.

## Idempotency and Retry

Add `task_assignment_batch_idempotency` with `actor_id`, `batch_id`,
`request_hash`, ordered `task_ids uuid[]`, `task_count`, `created_at`, and
`completed_at`. A unique key on `(actor_id, batch_id)` scopes retries to the
authenticated actor. The row is written in the same transaction as task
creation, so failed/rolled-back batches leave no completed row.

The hash covers canonical shared and per-card data. Same actor + same batch +
same hash returns the original ordered IDs with `replayed: true`; a different
hash returns conflict. The client keeps the same batch ID across timeout/retry
and generates a new ID only for a genuinely new submission.

## Attachments

Task database records are atomic. Existing storage uploads remain a second
phase after task IDs are returned. Upload failure does not delete tasks; the
UI identifies the exact card/file, shows `Thử tải lại tệp`, and retries only
that upload using the existing task ID. Attachment retry never resubmits the
batch. Task success is reported separately from attachment warnings.

## Authorization and Compatibility

Existing `canAssignToDepartment`, RBAC, participant resolution, and
`api_assign_task_v2` checks remain authoritative. Forged department,
assignee, collaborator, watcher, or reviewer IDs are rejected server-side.
Journalism never uses this contract. The old single-task API shape and RPC
remain supported, so old releases continue working with the additive objects.

## Migration, Rollback, and Release Safety

Migration is additive/idempotent: only the idempotency table, constraints,
indexes, and batch RPC are added. No existing rows or statuses are rewritten.
Application rollback is an atomic release switch; do not drop the additive
objects during rollback. Preserve current and rollback releases.

## Test Matrix

Database/RPC: one and twenty cards, 21 rejected, card-2 rollback of card 1,
ordered results, same-payload replay, changed-payload conflict, actor scoping,
forged scope rejection, audit/status/notification/recurrence parity, and old
single-task compatibility.

UI/API: recipient gating, manager scope, global default/other-department flow,
add/remove/renumber/focus, submit labels, per-card validation, timeout retry,
duplicate-submit protection, and attachment retry without task duplication.

Regression: Journalism assignment/self-registration, Task Approval, Task
Summary, Event Assignment, Personal Plan, Attendance, notifications/audit,
TypeScript, touched-file lint, route manifest, canonical ancestry, production
build, standalone verification, and authenticated browser smoke.
