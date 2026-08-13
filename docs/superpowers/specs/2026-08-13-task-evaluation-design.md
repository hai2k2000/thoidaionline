# Task Evaluation Design

## Goal

Replace browser-local task scoring with durable, role-controlled evaluations for `thoidai.online`. Employees can see their results, while only the editor-in-chief and an administrator role can save evaluations.

## Chosen approach

Use a dedicated `task_evaluation_checkpoints` table and a small pure TypeScript aggregation module. Each task keeps an `effort_weight` from the fixed Fibonacci-like scale `1, 2, 3, 5, 8`; old tasks default to `1`. This is preferable to extending the unrelated HR performance-review tables because task evaluations have different lifecycle, assignee and checkpoint semantics.

The existing app authenticates by storing a staff id in local storage and accesses Supabase as `anon`. Direct writes to the checkpoint table will be revoked. A security-definer RPC will check that the supplied active staff member has role code `tong_bien_tap` or the existing `can_manage_users=true` administrator permission, validate that the evaluated employee is assigned to the task, update the task weight, and insert a checkpoint. This materially narrows accidental writes, but the caller can still impersonate another staff id under the current custom-auth model; fixing that fully requires migrating to Supabase Auth and is outside this feature.

## Data model

`tasks.effort_weight` is a non-null integer with allowed values `1, 2, 3, 5, 8` and default `1`.

`task_evaluation_checkpoints` stores task, employee and reviewer ids; integer rating from 1 to 10; completion level and on-time flag; an effort-weight snapshot; opinion; checkpoint date; final/mid-period status; and creation timestamp.

There may be many checkpoints for a task and employee. Mid-period checkpoints preserve feedback but never add a second full task score. Aggregation selects only the latest final checkpoint for each task and employee, ordered by checkpoint date then creation time.

## Authorization and visibility

The UI uses one explicit role helper: only `tong_bien_tap` or users with `can_manage_users=true` see editable fields and the save action. Other assigned employees see their own latest result as read-only content. For multi-assignee tasks, the evaluator chooses the employee being reviewed; a regular employee sees only their own checkpoint rows.

The database permits anonymous reads to match the existing application, denies direct anonymous insert/update/delete on checkpoint rows, and exposes only the guarded save RPC. Because read RLS is still permissive and identity is custom, confidentiality is application-level rather than cryptographically enforced.

## Scoring and fairness

For each employee, the list reports assigned task count, completed task count, not-completed task count, total evaluated weight, weighted points (`sum(latest_final_rating * checkpoint_weight)`) and weighted average (`weighted_points / total_evaluated_weight`).

The weighted average is the fair comparison number: receiving many small tasks cannot automatically outrank one large task. Weighted points remain visible as workload-adjusted output and are never calculated from the removed legacy checkboxes.

## UI

The task detail evaluation card contains employee target (for evaluators on multi-assignee work), rating 1-10, effort weight, completion, on-time, opinion, checkpoint date and final/mid-period selection. Read-only viewers see the same result without form controls.

The `Đánh giá` entry moves into `Quản lý công việc`. `/performance` becomes an employee summary table. Clicking an employee opens a modal containing evaluated tasks, score, weight, weighted points, completion/status, checkpoint date and a short opinion. Clicking a task navigates to `/tasks/{id}`.

## Error handling and compatibility

Existing tasks receive weight `1`. No local-storage score is migrated because it is browser-specific, untrusted and not centrally enumerable; old checkbox values are ignored. RPC errors are shown in the existing page message area. Empty evaluation histories display an explicit no-data state.

## Testing and rollout

Node tests cover role edit visibility, the exact 1-10 options, removal/ignoring of legacy flags, opinion preservation, weighted fairness, latest-final checkpoint aggregation and modal task URLs. The migration is applied transactionally after a task-table data backup. Validation includes focused tests, all repository tests, ESLint, TypeScript, production build, migration row/default/permission queries, service restart, and localhost/public HTTP checks.
