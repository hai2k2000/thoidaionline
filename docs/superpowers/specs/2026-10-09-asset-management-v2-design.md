# ASSET MANAGEMENT V2 — DEPARTMENT-AWARE CUSTODY

## Status and scope

This document is the approved pre-code design for modernizing the existing
Asset Management module. It covers the data contract, permission boundary,
server-authoritative access, lifecycle operations, navigation, and focused
verification. It does not import the Q3 inventory workbook, backfill existing
rows, deploy production, or change unrelated Task, Department Plan, Quick
Report, Personal Plan, or Attendance semantics.

Production characterization found zero `assets` rows and zero
`asset_assignments` rows, so the architecture migration has no data migration
work. The supplied `30.9.2026 - BIÊN BẢN KIỂM KÊ TÀI SẢN Q3.2026.xls` remains a
later inventory mapping/import checkpoint.

## Characterized current state

- Existing routes are `/assets`, `/assets/new`, `/assets/[id]`,
  `/api/assets`, and `/api/assets/[id]`.
- Existing tables are `public.assets` and `public.asset_assignments`.
- `assets.assigned_department_id` and `asset_assignments.department_id` both
  exist; the current API treats employee and department assignment as XOR and
  does not validate employee/department consistency.
- Assignment currently inserts a row and then updates `assets.status` in a
  second operation. There is no transactional transfer/return lifecycle and
  no unique active-assignment invariant.
- Current asset administration uses `can_edit_all_tasks`; this is prohibited
  for V2.
- The current permission model already has canonical `permissions`,
  `role_permission_grants`, `user_permission_grants`, the
  `api_list_role_permission_grants` RPC, and server-session `rbacPermissions`.
  It can express dedicated asset permissions safely.
- Existing navigation has an asset group in legacy state but hides it; the
  phase-2 navigation has no asset item.
- Historical production characterization: 8 departments (4 active, 4
  inactive), 35 staff users (28 active), zero assets, zero assignments, zero
  orphans, and zero duplicate active assignments.
- The production service was healthy during characterization; no production
  data, schema, service, or release was modified.

## Locked invariants

### Canonical custody source

`asset_assignments` is the only source of truth for current custody and
history. A current assignment is the row with:

```text
status = 'active' AND returned_at IS NULL
```

There may be at most one such row per asset. A current row always has a
non-null `department_id`. `assignee_id` is optional and may coexist with
`department_id`.

If `assignee_id` is non-null, the referenced active employee must currently
belong to the selected department. An inactive employee or an employee from a
different department is rejected by the server lifecycle operation.

`assets.assigned_department_id` is a compatibility projection only. It is
written by lifecycle operations from the current assignment's
`department_id`, cleared on return, and never used to authorize or determine
current custody. Application reads join/hydrate the current assignment.

### Lifecycle

- Initial assignment validates the active department, optional employee, and
  one-current-row invariant in one transaction.
- Transfer locks the asset and current assignment, closes the current row
  with transfer timestamp/note, inserts a new active row, and updates the
  compatibility projection in one transaction.
- Return locks the asset/current row, closes it as `returned`, clears the
  compatibility projection, and updates the asset state in one transaction.
- No lifecycle operation deletes an assignment. Closed history is retained.
- A database trigger prevents deletion and prevents changes to already closed
  assignment rows; only closure of the active row is permitted.
- Active departments are selectable for new assignments. Inactive departments
  remain readable through historical rows but are rejected for new/current
  assignments.

### Asset status

The lifecycle RPC owns the assignment-related status projection: an assigned
asset is `in_use`; a successfully returned asset is `available` unless a
future, explicitly approved status policy says otherwise. Editing descriptive
asset fields cannot mutate custody or the projection.

## Permission and visibility model

The migration adds these canonical permission records:

- `asset.view` — access to the module and scoped reads.
- `asset.manage` — organization-wide asset CRUD and assignment lifecycle.

Permission resolution uses the existing RBAC catalog/grant tables and
`rbacPermissions`. No role-name fallback and no `can_edit_all_tasks` check is
allowed in Asset Management.

The server computes resource scope after permission resolution:

| Actor | Visible current assets | Mutations |
| --- | --- | --- |
| Employee with `asset.view` | Current assignments where `assignee_id = actor.id`, plus department-common assignments where `department_id = actor.department_id` and `assignee_id IS NULL` | None |
| Department manager with `asset.view` | Every current assignment in `actor.department_id`, including direct custodians and department-common assets | None unless also granted `asset.manage` |
| Actor with `asset.manage` | All assets and all assignment history organization-wide | Create/update asset metadata, assign, transfer, return |

The department-manager flag is read from the canonical server session
(`is_department_manager`) and combined with the actor's department id. A
manager with no department id receives no department-scoped rows. Historical
rows are readable only through the same asset visibility boundary; their
inactive department names are never remapped.

Initial compatibility grants are explicit and limited to the roles already
represented in the canonical RBAC matrix: operational staff and department
manager roles receive `asset.view`; `admin` receives `asset.manage` and
`asset.view`. No grant is inferred from task permissions. Any additional
organization-wide manager grant must be an explicit RBAC change, not a code
workaround.

## Server-authoritative boundary

Browser code calls application routes only. It never queries `assets`,
`asset_assignments`, or lifecycle RPCs directly. Each route obtains the actor
from the authenticated server session, resolves the dedicated permission, and
passes that server-derived actor id to the repository/RPC.

The migration removes public/anon/authenticated table DML and permissive
policies for `assets` and `asset_assignments`. Service-role access remains
available to server code. Lifecycle RPCs revoke public execution and are
executable only by the service role used by the existing server-side client.

## Migration contract

Use one architecture migration:

```text
supabase/migrations/20261009100000_asset_management_v2.sql
```

It must contain only:

1. Idempotent `asset.view` and `asset.manage` permission catalog rows and the
   explicit compatibility grants described above.
2. A partial unique index enforcing one current assignment per asset.
3. A check constraint requiring `department_id` for active/current rows.
4. The closed-history guard trigger.
5. SECURITY DEFINER lifecycle RPCs with fixed `search_path`:
   `api_asset_assign`, `api_asset_transfer`, and `api_asset_return`.
6. Public execution revocation and service-role execution grants for those
   RPCs.
7. Removal of anon/authenticated table grants and all permissive policies for
   `assets` and `asset_assignments`.

The RPC signatures are fixed for repository/API planning:

```sql
api_asset_assign(
  p_actor_id uuid,
  p_asset_id uuid,
  p_department_id uuid,
  p_assignee_id uuid default null,
  p_expected_return_at timestamptz default null,
  p_handover_note text default null
) returns jsonb

api_asset_transfer(
  p_actor_id uuid,
  p_asset_id uuid,
  p_department_id uuid,
  p_assignee_id uuid default null,
  p_expected_return_at timestamptz default null,
  p_handover_note text default null
) returns jsonb

api_asset_return(
  p_actor_id uuid,
  p_asset_id uuid,
  p_return_note text default null
) returns jsonb
```

The RPCs validate the actor's `asset.manage` grant, active department,
optional active assignee membership, current-row state, and row locks before
mutating. They return the asset plus current assignment needed to hydrate the
UI. The browser cannot invoke them directly.

Migration rehearsal must run against disposable PostgreSQL 17 before any
repository/API implementation. The rehearsal covers constraints, grants,
RLS hardening, assignment/transfer/return transactionality, assignee
validation, projection synchronization, history guard, and permission denial.

## Application design

### Repository/service

Add server-only asset repository functions for:

- scoped list/detail with current assignment and history hydration;
- active department and active staff option loading;
- metadata create/update guarded by `asset.manage`;
- assign/transfer/return calls to the fixed RPCs.

All reads derive scope from the actor; client-provided actor ids are ignored.

### API

Refactor `/api/assets` and `/api/assets/[id]` to use the repository. Preserve
existing route shapes and response compatibility where practical, but remove
the old XOR validation and all `can_edit_all_tasks` checks. Add explicit
assign/transfer/return actions with validation errors that distinguish an
inactive department, mismatched employee, duplicate current assignment, and
forbidden actor.

### Audit

Extend the existing server audit type to support module `assets`. Record
`create`, `update`, `assign`, `transfer`, and `return` with bounded old/new
payloads. Do not change unrelated audit modules.

### Navigation and UI

Add “Quản lý tài sản” to phase-2 navigation when the actor has `asset.view` or
`asset.manage`; desktop and mobile use the same item/path `/assets`. The
server page guard uses the same dedicated permission.

The list/detail/create screens retain their existing structure while adding:

- current department and optional custodian display;
- assignment history;
- transfer and return actions for `asset.manage`;
- active-department-only selectors;
- employee filtering/validation against the chosen department;
- immediate hydration from the server response after lifecycle actions.

Profile removes its browser-side Supabase query for `asset_assignments` and
uses a server-authoritative scoped endpoint/service. Task data and unrelated
profile behavior remain unchanged.

## Explicit non-goals

- No inventory workbook import or mapping in this migration/implementation.
- No data backfill or remapping; production has no assets/assignments.
- No changes to canonical Task semantics, Department Plan, Quick Report,
  Personal Plan approval, RBAC outside asset permissions, or Attendance.
- No production deployment in the implementation phase.

## Acceptance gates

Before deployment approval, the branch must pass focused asset tests,
permission/scope tests, migration rehearsal, TypeScript, changed-file lint,
`git diff --check`, route check, production-like build, standalone packaging,
and standalone runtime verification. Production remains unchanged throughout
implementation.
