# RBAC V2 Implementation Report

## Architecture

- The existing `roles`, `permissions`, `role_permission_grants`, and `user_permission_grants` model remains the single RBAC data model.
- `user_permission_grants.effect` is additive and supports `allow` and `deny` without seeding new grants.
- `api_list_effective_permissions` is the canonical resolver consumed by server session loading, feature authorization, and permission-management summaries.
- Precedence is explicit deny, explicit allow, active role grant, then no grant. Inactive users have no effective permissions; active users with inactive roles retain direct allow overrides only.

## Supported Management

- The role matrix reads database roles and the full permission catalog, groups permissions by module, preserves scope arrays, and reports affected users before save.
- The user tab supports search, role/department/status display, inherited role decisions, explicit allow/deny, effective scopes, source labels, targeted inherit, and restore-all inheritance.
- The API accepts role replacement, targeted user override, targeted clear, and restore-all actions and authorizes every mutation server-side.

## Safety and Compatibility

- Role and user mutations use the same transaction advisory lock for `permission.manage`, lock affected rows, recompute the manager set immediately before commit, and reject removal of the last effective manager.
- Self-elevation and inactive-user allow mutations are rejected. Real changes write audit rows; no-op writes do not.
- Legacy Quick Report and asset mutation wrappers remain narrow compatibility paths and call the deny-aware effective resolver.
- `rbac_v2_assert_legacy_rollback_compatible()` fails closed when deny rows exist, preventing rollback to an application version that would widen access.

## Validation

- Focused RBAC/UI/route tests: 45/45 PASS.
- Broad RBAC/permission subset: 85/85 PASS.
- Migration runner tests: 24/24 PASS.
- TypeScript: PASS.
- Changed-file ESLint: 0 errors, 0 warnings.
- Required route manifest: PASS.
- `git diff --check`: PASS.
- Local embedded PostgreSQL full migration-chain rehearsal: PASS; RBAC V2 migration applied twice and resolver/mutation/rollback procedures verified.
- Production-like Next build: PASS with build-only Supabase environment values and canonical lineage override; disk gate recorded 27,792,584,704 free bytes, above the 21,474,836,480-byte floor.

## Rollout Status

- Production migration applied: NO.
- Production grants or data changed: NO.
- Production service restarted or deployed: NO.
- Feature branch: `codex/rbac-v2-role-user-overrides`.
- Rollout blocker: owner review and explicit production migration/deployment approval remain required.
