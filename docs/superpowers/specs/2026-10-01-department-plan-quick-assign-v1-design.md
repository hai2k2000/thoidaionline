# Department Plan Quick Assign V1 Design

## Objective

Allow an authorized Department Plan manager to create one normal `STANDARD` Task from a persisted Department Plan item using a compact form. Reuse the existing Plan item to Task association and canonical Task assignment workflow.

## Scope

- Add `Giao việc nhanh` for eligible persisted Plan items.
- Ask only for an active assignee in the Plan department, due date/time, existing priority, and an optional short note.
- Derive Task title, department, creator, and Plan provenance from the locked Plan item and authenticated actor.
- Create and link the Task in one database transaction.
- Project the linked Task status into the Plan UI and expose `Xem công việc`.
- Preserve normal Task approval, mutation policy, and later editing in Task Management.

## Non-goals

- No batch or multi-assignee assignment.
- No new approval workflow, permission type, department inheritance, analytics, or unrelated refactor.
- No production or `/opt/thoidai-work` mutation during implementation.

## Design

Reuse `department_plan_items.linked_task_id` as the only relationship. Add an additive, service-role-only RPC that locks the Plan item, checks existing Department Plan scope and canonical Task assignment authority, validates the assignee against the Plan department, rejects an active linked Task, calls `api_assign_task_v2`, marks the normal Task source as `department_plan`, links the item, and writes the existing audit event atomically.

Add a thin authenticated route and repository method. A new compact dialog replaces the current full canonical assignment form for this entry point. The Plan read model includes linked Task status so linked rows display `Đã giao`, `Đang thực hiện`, `Hoàn thành`, or `Đã huỷ` from the real Task state instead of maintaining a duplicate status.

## Verification

Use TDD for authorization, atomicity, duplicate protection, `STANDARD` workflow, department filtering, status mapping, and navigation. Run the requested Department Plan, Task Assignment, Task Approval, Global Mutation Policy, TypeScript, changed-file lint, route, build, artifact, and disposable PostgreSQL gates.
