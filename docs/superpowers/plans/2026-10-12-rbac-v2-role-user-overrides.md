# RBAC V2 Role Matrix and User Overrides Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Thoi Dai Work RBAC catalog so administrators can manage every role permission and explicit per-user inherit/allow/deny override with one server-authoritative effective-permission model.

**Architecture:** Keep `roles`, `permissions`, `role_permission_grants`, and `user_permission_grants` as the single data model. Add an additive `effect` column for user overrides, centralize precedence and scope resolution in one database RPC consumed by the server RBAC repository, and make `/api/permissions` plus the existing permission page use general catalog-driven contracts. Existing legacy `can_*` behavior and workflow guards remain for permissions without a proven RBAC equivalent.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL security-definer RPCs, Node `node:test`, SQL disposable migration rehearsal, Tailwind classes already used by the project.

**Spec:** `docs/superpowers/specs/2026-10-12-rbac-v2-role-user-overrides-design.md`

## Global Constraints

- Start from canonical `integration/production` SHA `bd4803933d6b98fd6996852992be566e6286ea67` on branch `codex/rbac-v2-role-user-overrides`.
- Do not merge, apply a production migration, change production grants, restart services, or deploy in this plan.
- Preserve all existing role grants and user grants; migration must be additive, idempotent, and must not seed new access.
- Effective precedence is explicit user deny > explicit user allow > active role grant > no grant.
- Inactive users have no effective permissions; active users with inactive roles may retain existing direct allow overrides.
- Every real permission mutation is audited; no-op writes create no audit record.
- Reject self-elevation and prevent removing the last active effective `permission.manage` holder.
- Serialize last-manager checks with a transaction advisory lock and recompute the candidate set immediately before writes.
- Unknown permission codes/scopes, inactive target roles, and ambiguous state fail closed.
- Feature RPCs must use the same effective resolver; UI checks never replace server authorization.
- Before any dependency install/build, run the host disk gate and stop if free space is below `21,474,836,480` bytes.
- Do not add dependencies, frameworks, or unrelated module refactors.

---

### Task 1: Freeze the effective-permission contract with failing tests

**Files:**
- Create: `src/lib/rbac/effectivePermissions.test.mjs`
- Modify: `src/lib/rbac/types.ts`
- Modify: `src/lib/rbac/authorization.ts`
- Modify: `src/lib/rbac/repository.ts`

**Interfaces:**
- Produce `type RbacGrantEffect = "allow" | "deny"`.
- Produce `type EffectivePermission = { permissionCode: string; roleScopes: RbacScope[]; userEffect: RbacGrantEffect | null; userScope: RbacScope | null; effectiveScopes: RbacScope[]; source: "role" | "user_allow" | "user_deny" | "none" }`.
- Produce `resolveEffectivePermission(input: { active: boolean; roleActive: boolean; roleScopes: readonly RbacScope[]; userEffect: RbacGrantEffect | null; userScope: RbacScope | null; }): EffectivePermission`.
- Preserve `hasPermission`, `scopesFor`, and `can` call compatibility by making them consume normalized effective grants.

- [x] **Step 1: Write failing unit tests for the precedence matrix.**
  - Assert role grant works for an active user with an active role.
  - Assert direct allow works without a role grant.
  - Assert active user plus inactive role keeps direct allow and drops role scopes.
  - Assert explicit deny removes both role and direct allow.
  - Assert no override on inactive role returns no scopes.
  - Assert inactive user returns no scopes even with direct allow.
  - Assert duplicate scopes normalize and resource scope checks remain unchanged.

- [x] **Step 2: Run the focused test and verify it fails for the missing resolver.**
  - Run: `node --test src/lib/rbac/effectivePermissions.test.mjs`
  - Expected: failure because the new resolver contract is not implemented.

- [x] **Step 3: Implement the smallest pure resolver and effective-grant normalization.**
  - Keep deny out of `RbacGrant[]` effective scopes so existing `can()` remains allow-only.
  - Preserve `RbacActor` fields used by current callers and add optional source metadata rather than replacing the existing shape.

- [x] **Step 4: Run the focused test and existing RBAC tests.**
  - Run: `node --test src/lib/rbac/effectivePermissions.test.mjs src/lib/rbacAuthorization.test.mjs src/lib/userPermissionMatrix.test.mjs`
  - Expected: PASS with no behavior change for existing allow-only fixtures.

- [x] **Step 5: Commit the contract and unit tests.**
  - Commit: `test: define RBAC v2 effective permission precedence`

---

### Task 2: Add the additive migration and transactional resolver/mutation RPCs

**Files:**
- Create: `supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql`
- Create: `supabase/tests/rbac_v2_role_user_overrides.sql`
- Create: `src/lib/rbacV2Migration.test.mjs`

**Interfaces:**
- Create `public.api_list_effective_permissions(p_actor_id uuid)` returning catalog rows with role scopes, user effect/scope, effective scopes, source, and active state.
- Create `public.api_replace_role_permissions(p_actor_id uuid, p_role_id uuid, p_grants jsonb)`.
- Create `public.api_set_user_permission_override(p_actor_id uuid, p_user_id uuid, p_permission_code text, p_effect text, p_scope text)`.
- Create `public.api_restore_user_permission_inheritance(p_actor_id uuid, p_user_id uuid)`.
- All mutation RPCs return `changed`, target identifiers, and an effective-permission summary.

- [x] **Step 1: Write migration contract tests before SQL implementation.**
  - Assert `effect` exists, defaults to `allow`, accepts only `allow|deny`, and old rows remain present.
  - Assert direct allow survives an inactive role, while role scopes disappear.
  - Assert deny wins over both sources.
  - Assert unsupported permission/scope, inactive target, self-target, and non-manager actor fail.
  - Assert replacing one role does not alter another role.
  - Assert concurrent last-manager mutations serialize and at least one manager remains.

- [x] **Step 2: Run the migration contract tests to confirm RED.**
  - Run: `node --test src/lib/rbacV2Migration.test.mjs`
  - Expected: failure because the migration file and SQL contracts are absent.

- [x] **Step 3: Add schema changes without data widening.**
  - Add `user_permission_grants.effect text not null default 'allow'` with a check constraint.
  - Keep the existing unique `(user_id, permission_id)`, scope constraint, RLS, and service-role-only table grants.
  - Do not insert new permissions, role grants, or user grants.

- [x] **Step 4: Implement the canonical read resolver.**
  - Return all catalog permissions for the actor.
  - Apply inactive-user and inactive-role rules exactly as the spec states.
  - Compute user deny before user allow before role grant.
  - Normalize scopes in SQL and return `source` for UI/session consumers.

- [x] **Step 5: Implement role replacement with concurrency-safe last-manager protection.**
  - Start a transaction and acquire `pg_advisory_xact_lock(hashtextextended('rbac.permission.manage', 0))`.
  - Lock the target role and all active users currently holding effective `permission.manage` with `FOR UPDATE`.
  - Validate actor authority, target role state, complete grant payload, no duplicates, known catalog codes, and supported scopes.
  - Reject adding a permission to the actor's own role when it would self-elevate.
  - Apply the exact role grant delta, recompute active effective managers, and reject if the count becomes zero.
  - Write one audit row per changed permission with old/new scope state.

- [x] **Step 6: Implement user override, restore, and last-manager checks.**
  - Acquire the same advisory lock for every mutation that can change `permission.manage`.
  - Reject actor self-targeting, inactive allow targets, invalid effects/scopes, and unknown users.
  - Upsert/delete only the targeted override row.
  - Recompute effective managers after the proposed change and reject lockout.
  - Write old/new override state to `audit_logs`; restore deletes all target overrides in one transaction.

- [x] **Step 7: Add SQL assertions and idempotence checks.**
  - Run: `psql ... -f supabase/tests/rbac_v2_role_user_overrides.sql` through the existing disposable migration harness.
  - Run the migration twice and assert the second run is clean and data-preserving.

- [x] **Step 8: Run migration tests and commit.**
  - Run: `node --test src/lib/rbacV2Migration.test.mjs scripts/production/safe-apply-migration.test.mjs`
  - Commit: `feat: add RBAC v2 override and role management RPCs`

---

### Task 3: Unify server RBAC loading and legacy compatibility

**Files:**
- Modify: `src/lib/rbac/types.ts`
- Modify: `src/lib/rbac/repository.ts`
- Modify: `src/lib/serverSession.ts`
- Modify: `src/lib/auth.tsx`
- Modify: `src/lib/permissions.ts`
- Modify: `src/lib/rbac/permissionCatalog.ts`
- Create: `src/lib/rbacCompatibilityV2.test.mjs`

**Interfaces:**
- `loadRbacActor(actor)` must consume `api_list_effective_permissions`, not union raw role/user grant tables.
- Add `loadEffectivePermissionCatalog(actor)` for management payloads.
- Add `isCatalogPermission(code)` and `supportedScopesForPermission(code)`.
- Keep `PermissionSet` and legacy `can_*` keys unchanged for unmapped behavior.

- [x] **Step 1: Write failing tests for session and client precedence.**
  - Assert `rbacPermissions` excludes denied codes.
  - Assert direct allow appears for active users with inactive roles.
  - Assert legacy fallback remains for unmapped `can_*` keys.
  - Assert mapped catalog codes do not regain access through role-name fallback.
  - Assert scope metadata is shared rather than duplicated in UI code.

- [x] **Step 2: Run the focused compatibility tests and verify RED.**

- [x] **Step 3: Replace raw grant loading with the canonical effective RPC.**
  - Preserve request-scoped caching.
  - Map only effective allow scopes into `RbacActor.grants`.
  - Preserve source/effect metadata for permission management and session diagnostics.

- [x] **Step 4: Update `serverSession.ts` and `auth.tsx`.**
  - Session returns effective catalog codes only.
  - Client `hasPermission` trusts catalog results first, then legacy normalized permissions.
  - Remove role-name fallback only for codes proven equivalent by the catalog; leave unrelated module policy unchanged.

- [x] **Step 5: Update direct feature authorization consumers.**
  - Replace raw union checks in Quick Report and asset permission RPC paths with the effective resolver.
  - Preserve existing workflow/RPC guards and scope checks.

- [x] **Step 6: Run tests and commit.**
  - Run: `node --test src/lib/rbacCompatibilityV2.test.mjs src/lib/rbacAuthorization.test.mjs src/lib/authorization.test.mjs src/lib/adminQuickReportPermissionManagement.test.mjs src/lib/assetPermissionManagement.test.mjs`
  - Commit: `feat: unify RBAC v2 server and legacy compatibility`

---

### Task 4: Generalize permission matrix data contracts

**Files:**
- Modify: `src/lib/permissionMatrix.ts`
- Create: `src/lib/permissionMatrixV2.test.mjs`

**Interfaces:**
- Add catalog-driven types for `PermissionMatrixPermission`, `PermissionMatrixModule`, `PermissionMatrixRole`, `PermissionMatrixUser`, `EffectivePermissionSource`, and `OverrideEffect`.
- Add `buildPermissionManagementPayload(rows)` which preserves module order, roles, users, role grants, direct overrides, effective scopes, source, and affected-user counts.
- Replace special-purpose `buildQuickReportUserPermissions`/asset-only transformations with compatibility adapters until consumers migrate.

- [x] **Step 1: Write failing tests for complete catalog payloads.**
  - Assert every database permission appears exactly once.
  - Assert modules include permissions with no current grants.
  - Assert role scope arrays preserve multiple scopes.
  - Assert user entries show inherit/allow/deny, effective scopes, source, role/department/status.
  - Assert affected-user counts include active users assigned to the selected role.

- [x] **Step 2: Run the test and verify RED.**

- [x] **Step 3: Implement pure payload builders and adapters.**
  - Keep data transformation independent of fetch/RPC logic.
  - Use literal fixtures covering inactive role, inactive user, direct allow, direct deny, and role-only access.

- [x] **Step 4: Run focused matrix tests and commit.**
  - Commit: `feat: generalize permission matrix contracts`

---

### Task 5: Generalize `/api/permissions` read and mutation contracts

**Files:**
- Modify: `src/app/api/permissions/route.ts`
- Create: `src/lib/permissionManagementRoute.test.mjs`

**Interfaces:**
- GET response:
  - `permissions: PermissionCatalogEntry[]`
  - `modules: PermissionModule[]`
  - `roles: PermissionManagementRole[]`
  - `users: PermissionManagementUser[]`
  - `scopeOptions: Record<string, RbacScope[]>`
- POST/PUT actions:
  - `replace_role_permissions`: `{ roleId, grants: [{ permissionCode, scopes }] }`
  - `set_user_override`: `{ userId, permissionCode, effect, scope }`
  - `restore_user_inheritance`: `{ userId }`

- [x] **Step 1: Write failing route contract tests.**
  - Assert unauthenticated, invalid-origin, and non-`permission.manage` requests fail.
  - Assert GET returns all catalog entries and source/effect data.
  - Assert malformed action, UUID, permission code, effect, and scope fail before RPC.
  - Assert successful actions call only the corresponding RPC and return effective summary.
  - Assert direct POST cannot bypass last-manager/self-elevation errors.

- [x] **Step 2: Run route tests and verify RED.**

- [x] **Step 3: Implement strict request parsing and RPC delegation.**
  - Keep `requireReadActor`/`requireMutationActor`.
  - Do not trust client actor, role, department, or effective values.
  - Map SQL error codes through existing `rpcFailure`.

- [x] **Step 4: Run route tests and commit.**
  - Commit: `feat: expose catalog-driven permission management API`

---

### Task 6: Build the role-management UI

**Files:**
- Modify: `src/app/permissions/page.tsx`
- Modify: `src/app/permissions/layout.tsx` only if route metadata/access needs the existing permission guard
- Create: `src/lib/permissionRoleUi.test.mjs`

**Interfaces:**
- Consume the GET payload from Task 5.
- Send `replace_role_permissions` with the complete desired grant set.
- Render one selected database role at a time; never mutate other roles.

- [x] **Step 1: Write failing UI contract tests for role selection and save payload.**
  - Assert all modules and permissions render, including permissions with no grants.
  - Assert checkbox state maps to scopes and supports multiple scopes.
  - Assert selected-role user count is visible before save.
  - Assert dirty state and `Lưu thay đổi` use the complete selected-role payload.
  - Assert inactive roles are inspectable but not editable.

- [x] **Step 2: Run UI contract tests and verify RED.**

- [x] **Step 3: Implement the role tab using existing page styling.**
  - Keep the orange/slate visual language.
  - Use module sections, compact permission rows, explicit scope controls, affected-user summary, and one save action.
  - Add keyboard-visible focus, mobile stacking, disabled pending state, and clear error/success messages.

- [x] **Step 4: Run focused UI tests and changed-file ESLint.**
  - Commit: `feat: add complete role permission matrix UI`

---

### Task 7: Build the user override UI

**Files:**
- Modify: `src/app/permissions/page.tsx`
- Create: `src/lib/permissionUserUi.test.mjs`

**Interfaces:**
- Consume `PermissionManagementUser` entries from Task 5.
- Send `set_user_override` and `restore_user_inheritance`.
- Render `inherit | allow | deny`, inherited scopes, effective scopes, and source.

- [x] **Step 1: Write failing UI contract tests for override behavior.**
  - Assert user search/selection displays role, department, and active state.
  - Assert each permission shows default role decision, override state, effective result, and source.
  - Assert deny is visible as a deliberate destructive state and takes precedence.
  - Assert restore sends the inheritance action and returns to role behavior.
  - Assert inactive users cannot receive allow overrides but can be inspected/restored.

- [x] **Step 2: Run UI tests and verify RED.**

- [x] **Step 3: Implement the user tab and effective-result presentation.**
  - Use a three-state control with explicit labels.
  - Show source badges `Vai trò`, `Cấp riêng`, `Chặn riêng`, or `Không có`.
  - Keep permission descriptions and scope controls catalog-driven.
  - Do not add client-only authorization logic.

- [x] **Step 4: Run focused UI tests and changed-file ESLint.**
  - Commit: `feat: add per-user RBAC override UI`

---

### Task 8: Add direct API/security and data-preservation regression coverage

**Files:**
- Modify: `src/lib/adminQuickReportPermissionManagement.test.mjs`
- Modify: `src/lib/assetPermissionManagement.test.mjs`
- Modify: `src/lib/rbacAuthorization.test.mjs`
- Create: `src/lib/rbacV2SecurityRegression.test.mjs`
- Modify: `supabase/tests/phase1a_rbac_core.sql` only for additive assertions if required

- [x] **Step 1: Write failing security regression tests.**
  - Direct Quick Report call denied by user deny despite role allow.
  - Direct asset-management call denied by user deny despite role allow.
  - Non-manager API and direct RPC calls fail with 403/42501.
  - Scope-limited grants cannot access another department/resource.
  - No migration path creates new grants.
  - Inactive role drops inherited access but direct allow remains.
  - Rollback compatibility fixture fails closed when an old resolver would widen a denied permission.

- [x] **Step 2: Run focused security tests and verify RED.**

- [x] **Step 3: Update feature consumers and test fixtures only where the canonical resolver requires it.**
  - Do not rewrite unrelated workflow authorization.
  - Preserve existing audit/status-history and task scope guards.

- [x] **Step 4: Run focused security suite and commit.**
  - Commit: `test: cover RBAC v2 server deny and rollback safety`

---

### Task 9: Full validation, migration rehearsal, disk gate, and project status

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/superpowers/plans/2026-10-12-rbac-v2-role-user-overrides.md` to mark completed steps only after evidence
- Create: `RBAC_V2_IMPLEMENTATION_REPORT.md`

- [x] **Step 1: Run focused Node tests once after source stabilization.**
  - Run the complete RBAC/permission subset:
    `node --test src/lib/rbac/*.test.mjs src/lib/*Permission*.test.mjs src/lib/*Rbac*.test.mjs src/lib/permission*test.mjs`
  - Record exact pass/fail counts and pre-existing failures separately.

- [x] **Step 2: Run disposable PostgreSQL rehearsal.**
  - Run `npm run migration:disposable` with the RBAC V2 migration included.
  - Apply the migration twice, run `supabase/tests/rbac_v2_role_user_overrides.sql`, and verify old role/user grant row counts and effective decisions.
  - Run rollback compatibility checks without touching production.

- [x] **Step 3: Run static validation.**
  - `npm exec tsc --noEmit`
  - `npx eslint <changed TypeScript files>`
  - `npm run check:routes`
  - `git diff --check`
  - Scan for secrets, `.env`, backups, build outputs, and untracked artifacts.

- [x] **Step 4: Run the disk budget gate before the production-like build.**
  - Use the existing host profile and storage guard; require free bytes >= `21,474,836,480`.
  - Create a bounded build workspace with `build-workspace.sh create`; clean only that build workspace after validation according to its lifecycle state.
  - Do not delete unrelated VPS data to make the build pass.

- [x] **Step 5: Run production-like build and standalone checks.**
  - `npm run check:baseline`
  - `npm run build`
  - `npm run package:standalone`
  - `npm run verify:standalone`
  - Record disk before/after and ensure no production service state changes.

- [x] **Step 6: Update project status with evidence.**
  - Record current phase, completed tasks, validation outputs, migration-not-applied status, production unchanged status, and remaining rollout blockers.
  - Do not claim production readiness until migration compatibility and live approval gates are separately completed.

- [x] **Step 7: Commit validation/status artifacts.**
  - Commit: `chore: validate RBAC v2 implementation`

---

### Task 10: Push branch and open the owner-review PR

**Files:**
- No source changes beyond validated implementation/status artifacts.

- [x] **Step 1: Verify branch cleanliness and ancestry.**
  - Run `git status --short --branch`.
  - Verify branch contains canonical baseline and all intended commits only.
  - Verify no production migration/deploy command was run.

- [x] **Step 2: Push the feature branch.**
  - Run `git push origin codex/rbac-v2-role-user-overrides`.
  - Confirm the remote branch SHA.

- [x] **Step 3: Create a PR targeting `integration/production`.**
  - Title: `feat: RBAC v2 role matrix and user overrides`.
  - Body must include architecture, permission precedence, migration/data impact, last-manager locking, test/build evidence, rollback compatibility gate, and explicit statement: no production migration or deployment.
  - Stop after PR creation and report branch, commit SHA, PR URL, tests, and rollout blockers.

## Definition of Done

- [x] Complete catalog-driven role matrix and user override UI are implemented.
- [x] Effective permission resolver enforces inactive-user, inactive-role, allow, deny, and scope rules consistently on server and client.
- [x] Direct feature RPCs honor explicit deny.
- [x] Last-manager protection is serialized and tested under concurrent updates.
- [x] Existing grants are preserved; no new permissions are auto-created.
- [x] Audit rows capture every real permission change.
- [x] Focused tests, migration rehearsal, TypeScript, ESLint, route manifest, disk gate, and production-like build pass.
- [x] Feature branch is pushed and PR targets `integration/production`.
- [x] No production migration, grant change, restart, merge, or deployment occurs.
