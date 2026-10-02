# Department Plan Real Assignment + Multi-Assignee V2

## Objective

Make Department Plan assignment mean a real, immediately deliverable Task. A
Plan item may remain editable without a Task, but an explicit `Giao viec`
action must create one canonical `STANDARD` Task, link it to the item, and
deliver it to every selected employee. One Task is used for one Plan item.

## Confirmed current architecture

- `tasks.assignee_id` and `tasks.owner_id` represent the primary assignee.
- `task_assignees` already supports additional participants with
  `assignment_role` values `owner`, `assignee`, and `watcher`.
- `api_assign_task_v2` creates the Task, primary owner row, additional
  assignee rows, manager watcher, task audit, and the fields used by Task
  Center and derived notifications.
- `getTaskScopeTerms` includes `task_assignees` IDs, so additional assignees
  can see the same Task without widening a UI query.
- The current Department Plan generic save path accepts `assignment_state =
  assigned` and `assignee_id` without creating a Task. This is the confirmed
  production failure mode.

## Design

### 1. Canonical assignment service

Add an additive SQL migration containing a reusable Department Plan assignment
core and a V2 RPC. The core accepts an ordered `assignee_ids uuid[]` and:

1. Locks the Plan item.
2. Rejects a missing item, an existing link, an empty list, duplicate IDs that
   cannot be normalized, inactive users, or any user outside the Plan
   department.
3. Uses the first unique ID as the primary assignee/owner.
4. Passes the remaining IDs as `p_collaborator_ids` to the existing
   `api_assign_task_v2`; the existing manager watcher, audit, status, and
   notification-compatible rows remain authoritative.
5. Verifies the returned Task is `workflow_type = 'STANDARD'`.
6. Sets `assignment_source = 'department_plan'` and atomically links the Plan
   item, setting its primary `assignee_id` and `assignment_state = 'assigned'`.
7. Writes the Department Plan origin audit row and returns the Task.

The public V2 RPC is service-role-only and keeps the existing actor/scope
checks. The existing V1 RPC remains available for compatibility and delegates
through the same core with a one-element list, so current single-assignee
behavior is preserved.

### 2. Atomic create-and-assign

Add a second service-role-only RPC for an explicit create-and-assign action.
It inserts a Plan item and invokes the same assignment core in the same
transaction. A normal Plan-item create continues to insert only an unassigned
item. This gives the UI two explicit paths without ever persisting a claimed
assignment that has no Task.

### 3. Server/API contracts

- Generic item create/update rejects `assignment_state = 'assigned'` and
  non-null assignee metadata unless a linked Task already exists. It accepts
  content fields and leaves an unassigned item in the normal save path.
- Existing-item assignment accepts `assigneeIds: string[]` and uses the V2
  RPC. The array is deduplicated/validated server-side; every selected user is
  checked before any Task row is inserted.
- Draft create-and-assign accepts the Plan item fields plus `assigneeIds`, due
  date/time, priority, and note, and calls the atomic create-and-assign RPC.
- Direct API/RPC calls remain blocked for unauthenticated, out-of-scope, or
  inactive users. Mixed department selections fail the whole request.

### 4. UI

- Generic Plan editing no longer presents a selected employee as proof of
  assignment. Saving content alone produces `Chua giao`.
- The explicit assignment dialog uses a searchable multi-select picker with
  removable chips, duplicate prevention, and the existing department scope.
  The first chip is the primary owner; the rest are additional assignees.
- A new draft-row `Giao viec` action uses the atomic create-and-assign path;
  the existing `Luu` action remains Plan-only.
- Once linked, the Plan row shows compact assignee names derived from the
  linked Task and a `Xem cong viec` link. Assignees are read-only in Plan;
  Task Management remains the canonical place for later assignment edits.
- Status is derived from the linked Task. A legacy row with
  `assignment_state = assigned` and no link displays `Chua tao cong viec` and
  offers explicit `Giao viec`; it is never shown as successfully assigned.

### 5. Delivery and reporting

The Task remains one `STANDARD` row for counting/reporting. Every selected
employee receives an `owner` or `assignee` relation with the normal
`assigned_at` value, is included by the existing Task Center scope, and gets
the existing assignment-derived notification. No new notification system,
per-assignee status, or analytics model is introduced.

## Data safety and transaction rules

- No production data is backfilled and no legacy inconsistent item is changed
  automatically.
- All validation occurs before the canonical Task insert; any failure rolls
  back the Plan item, Task, link, participant rows, and audit rows together.
- No table or column is added. The migration changes only functions and
  grants; disposable PostgreSQL rehearsal is required.

## Acceptance tests

1. Plan-only create/edit creates no Task and leaves the item unassigned.
2. One valid assignee creates one linked `STANDARD` Task and is visible in
   Task Center immediately.
3. Three valid assignees create one Task with one owner and two assignee rows;
   all three users see it and receive the normal assignment-derived notice.
4. A mixed valid/foreign-department selection rolls back everything.
5. Duplicate IDs produce one participant row and never duplicate a Task.
6. Injected participant failure rolls back the complete transaction.
7. Legacy `assigned + NULL link` renders as not-created and exposes explicit
   assignment.
8. Normal Task Assignment and Department Plan assignment share all delivery
   invariants, with only `assignment_source = department_plan` differing.

## Non-goals

No automatic production backfill, batch assignment of multiple Plan items,
per-assignee completion, independent approval, new notification framework,
department restructure, or unrelated refactor.

## Migration expectation

One additive migration is expected for the new RPC/function definitions; no
new table or column is expected. Production migration is out of scope for
this implementation branch.
