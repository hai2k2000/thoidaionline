# RBAC V2 Role Matrix and User Overrides Design

Date: 2026-10-12
Repository: `hai2k2000/thoidaionline`
Canonical baseline: `bd4803933d6b98fd6996852992be566e6286ea67`
Target branch: `integration/production`
Feature branch: `codex/rbac-v2-role-user-overrides`
Production migration/deployment: prohibited in this checkpoint

## Objective

Extend the existing RBAC implementation so administrators can manage the complete role-permission matrix and explicit per-user allow/deny overrides without creating a parallel authorization system or changing production data during this checkpoint.

The final effective permission order is:

```text
explicit user deny > explicit user allow > active role grant > deny
```

Scope remains part of a grant. Authorization decisions continue to require both an effective permission scope and the existing resource/workflow checks.

## Existing Architecture

The implementation reuses:

- `roles`, `permissions`, `role_permission_grants`, and `user_permission_grants`;
- `src/lib/rbac/*` and the request-scoped RBAC actor loader;
- `/permissions` and `/api/permissions`;
- service-role-only database RPCs and `audit_logs`;
- legacy workflow guards that are not yet represented by equivalent RBAC permissions.

Current limitations are:

- `user_permission_grants` represents allow only;
- role and user grants are unioned without source or precedence information;
- permission management is hard-coded to `asset.manage` and `task.quick_report.create`;
- client authorization still contains role-name fallbacks;
- feature RPCs can calculate permission independently of the TypeScript authorization path.

## Data Model

Add an `effect` column to `public.user_permission_grants`:

```sql
effect text not null default 'allow'
check (effect in ('allow', 'deny'))
```

Existing rows retain their current behavior because they become `allow`. The existing unique constraint on `(user_id, permission_id)` remains, so each user has at most one override decision for a permission. The existing `scope` column is retained:

- `allow` uses the selected scope;
- `deny` ignores scope during authorization but stores a normalized scope value for schema compatibility;
- deleting the row restores inheritance.

No role, permission, role grant, or user grant is seeded or expanded by the migration.

## Effective Permission Resolver

The database exposes one canonical read RPC returning all catalog permissions for an actor with:

- role scopes;
- optional user override effect and scope;
- effective scopes;
- source: `role`, `user_allow`, `user_deny`, or `none`.

Resolution rules:

1. Inactive users receive no effective grants.
2. An active user with an inactive role does not inherit role grants, but an existing direct user allow remains effective.
3. A user deny removes every role scope and direct allow for that permission.
4. A user allow replaces inherited role scopes with the explicit user scope, including when the user's role is inactive.
5. Without an override, active users inherit scopes only from an active role.
6. Duplicate effective scopes are normalized.

These rules preserve the current direct-grant behavior while making explicit deny authoritative. Regression tests must cover active users with inactive roles so the resolver does not silently remove existing direct access or restore denied access.

`loadRbacActor()` consumes this resolver. `RbacActor` retains effective grants for existing callers and gains source metadata for permission management/session display. Server APIs and database mutation RPCs use the same semantics.

## Role Matrix Management

The role tab lists active and inactive roles directly from the database. Selecting one role displays all permissions grouped by their `module` field.

Each permission row provides:

- an enabled checkbox;
- a scope selector when the permission supports scoped access;
- permission code, name, and description;
- an unchanged/changed indicator.

The client submits one complete desired grant set for the selected role. A transactional RPC validates every permission code and scope, computes the exact insert/delete delta, writes audit rows, and changes no other role.

Before saving, the UI displays the count of active users assigned to the selected role. Inactive roles are visible for inspection but cannot be modified.

The RPC rejects:

- actors without effective `permission.manage`;
- malformed or duplicate entries;
- inactive target roles;
- permission codes not present in the database catalog;
- attempts that remove the last active holder of `permission.manage`;
- attempts by an actor to expand permissions of the actor's own role.

An actor may remove permissions from their own role only when the last-manager safety check still passes. This avoids self-elevation while allowing deliberate restriction.

## User Override Management

The user tab provides searchable selection and displays:

- full name and username;
- active/inactive account state;
- role and role state;
- department;
- each catalog permission grouped by module;
- inherited role scopes;
- override state: inherit, allow, or deny;
- effective scopes and source.

`Inherit` deletes the override row. `Allow` upserts `effect='allow'` with a validated scope. `Deny` upserts `effect='deny'`. A restore action returns every permission for the selected user to inheritance by deleting that user's override rows transactionally.

The mutation RPC rejects:

- actors without effective `permission.manage`;
- granting or denying permissions for nonexistent users;
- adding allow overrides to inactive users;
- any override mutation targeting the actor's own account;
- changes that would leave no active effective holder of `permission.manage`.

Every changed permission produces an audit entry with previous override, next override, permission code, scope, target user, and actor. No-op requests do not create audit noise.

## API Contract

`GET /api/permissions` returns a general management payload rather than special arrays for two permission codes:

- permission catalog grouped by module;
- roles with grants and affected-user counts;
- users with role, department, state, role grants, overrides, and effective permissions;
- supported scope metadata.

Mutation actions are explicit:

- `replace_role_permissions` with one role and its complete desired grant set;
- `set_user_override` with one user, permission, effect, and optional scope;
- `restore_user_inheritance` for one user.

The route continues to require authentication, same-origin mutation protection, and effective `permission.manage`. It delegates all authoritative validation and audit writes to transactional service-role-only RPCs.

## Client and Legacy Compatibility

The session exposes effective RBAC permission codes only. Explicit deny therefore cannot be bypassed by `rbacPermissions`.

`src/lib/auth.tsx` changes its decision order:

1. For codes in the RBAC permission catalog, trust the effective RBAC list.
2. For legacy `can_*` keys, preserve `PermissionSet` behavior.
3. Keep role-name/module fallbacks only where no equivalent RBAC permission and regression mapping exists.

This checkpoint does not broadly replace navigation/module access rules. Permission-specific server enforcement remains authoritative, so hiding a client control is never treated as authorization.

Existing feature RPCs that directly inspect role/user grants are updated to use the canonical effective resolver, including Quick Report. Direct user deny must block the RPC even when the role grants access.

## Permission Scope Metadata

Scope choices are derived from permission behavior, not offered blindly:

- resource-scoped task permissions may support `self`, `assigned`, `department`, and `all` as already defined;
- permissions currently enforced as global capabilities use `all` only;
- existing stored scopes remain visible and round-trip safely;
- unknown or unsupported scope combinations fail closed and are not silently rewritten.

The scope-support mapping lives in one server/shared catalog helper and is covered by tests.

## UI Direction

The page keeps the established Thoi Dai Work orange/slate visual language. The redesign emphasizes an administrative control surface rather than a promotional dashboard:

- left selection rail for roles or users;
- a dense but readable permission workspace grouped by module;
- persistent dirty-change summary and a single `Lưu thay đổi` action;
- source badges for role, direct allow, and direct deny;
- explicit red deny treatment used only for destructive override state;
- responsive stacked cards on mobile instead of a compressed wide table.

The memorable interaction is the three-state user override control with the computed effective result displayed beside it, making precedence visible without requiring database knowledge.

## Audit and Safety

All mutation RPCs are `security definer`, set a fixed search path, accept the authenticated actor ID from the server session, and execute only for `service_role`.

Safety invariants:

- no mutation creates a permission not already in `permissions`;
- no migration auto-grants access;
- explicit deny is enforced server-side and in feature RPCs;
- self-elevation is rejected;
- the last active effective `permission.manage` holder cannot be removed;
- inactive users/roles never gain effective permissions;
- every real delta is audited;
- unrelated module workflow guards remain unchanged.

## Migration and Rollback

The migration is additive and idempotent:

1. add `effect` with default `allow` and a check constraint;
2. create effective-permission helper functions/RPCs;
3. create general role and user mutation RPCs;
4. update feature RPCs that currently union raw grant tables;
5. preserve all current rows and their effective behavior.

Rollback before production rollout is source-only because this checkpoint does not apply the migration. After explicit deny has been activated, rollback to an application version that does not understand deny is prohibited until a rollback compatibility gate proves that no effective permission would widen. Exporting deny rows and then deleting the column is not sufficient because the older resolver could restore role or direct access that deny had intentionally blocked.

The rollback compatibility gate must evaluate every deny row against the target application's authorization behavior. Rollback may proceed only when each denied permission remains denied under the target version, or after an owner-approved compensating change removes the underlying role/direct allow without broadening any user's access. Deny rows and the `effect` column remain in place until that validation passes; otherwise rollback stops and the deny-aware application version remains active.

## Testing

Required automated coverage:

1. Role inheritance grants effective access.
2. Explicit user allow grants access independently of the role.
3. Explicit user deny overrides a role grant.
4. Removing an override restores role inheritance.
5. Replacing role grants updates affected users' effective permissions.
6. Actors without `permission.manage` cannot read or mutate management data.
7. Effective scopes remain enforced for task resources.
8. Direct API/RPC calls are denied consistently.
9. Existing grants survive migration without widening access.
10. Self-override and self-role expansion are rejected.
11. Last-manager protection rejects lockout.
12. Inactive users and roles receive no effective permission.
13. Quick Report and asset permission regressions preserve allow behavior and honor deny.
14. Client legacy fallbacks remain only for unmapped legacy permissions.

Validation gates:

- focused Node authorization, matrix, route, and UI contract tests;
- disposable PostgreSQL migration applied twice;
- migration data-preservation and rollback rehearsal;
- TypeScript;
- changed-file ESLint;
- required route manifest;
- production-like build after disk budget PASS;
- `git diff --check` and secret/artifact scan.

## Deliverables

- additive RBAC V2 migration and tests;
- unified effective permission resolver;
- general permission-management repository/API contracts;
- redesigned role and user tabs;
- focused regression tests;
- updated project status/report;
- committed and pushed feature branch;
- pull request into `integration/production`;
- no merge, production migration, deployment, restart, or live grant changes.
