# ASSET MANAGEMENT V2 — DEPARTMENT-AWARE CUSTODY Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the existing Asset Management routes around department-aware custody, dedicated RBAC, transactional assignment history, and server-authoritative scoped access without importing inventory data or deploying production.

**Architecture:** Keep `assets` as the descriptive asset record and make `asset_assignments` the canonical custody/history ledger. A single PostgreSQL migration adds asset permissions, one-current-row and department invariants, immutable closed-history protection, server-only lifecycle RPCs, and browser-deny ACLs; server repositories/API routes resolve the actor and scope before reading or mutating. Existing pages are retained and upgraded with current assignment/history, transfer/return, navigation, and a server-backed profile asset view.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase PostgreSQL 17, SECURITY DEFINER PL/pgSQL RPCs, Node `node:test`, ESLint, standalone artifact scripts.

**Spec:** `docs/superpowers/specs/2026-10-09-asset-management-v2-design.md`

## Global Constraints

- `asset_assignments` is the canonical source for current custody and history.
- `assets.assigned_department_id` is a compatibility projection only and is written only by lifecycle operations.
- Every current assignment has `department_id`; `assignee_id` is optional and may coexist with it.
- A selected assignee must be active and belong to the selected active department.
- At most one `status = 'active' AND returned_at IS NULL` assignment exists per asset.
- Assign/transfer/return are transactional, preserve closed history, and never hard-delete assignments.
- Inactive departments are historical-only and cannot be selected for new/current assignments.
- Asset code must never use `can_edit_all_tasks`; only `asset.view` and `asset.manage` are valid gates.
- Browser code never queries asset tables/RPCs directly; server session determines actor identity.
- No inventory workbook import, backfill, unrelated RBAC change, or production deployment.
- Production remains unchanged throughout implementation.

---

### Task 1: Asset V2 migration and disposable PostgreSQL contract

**Files:**
- Create: `supabase/migrations/20261009100000_asset_management_v2.sql`
- Create: `src/lib/assetManagementV2Migration.test.mjs`
- Create: `scripts/fixtures/asset-management-v2-rehearsal.sql`

**Interfaces:**
- Produces permissions `asset.view` and `asset.manage` in the existing `permissions` catalog.
- Produces RPCs `api_asset_assign(uuid,uuid,uuid,uuid,timestamptz,text)`, `api_asset_transfer(uuid,uuid,uuid,uuid,timestamptz,text)`, and `api_asset_return(uuid,uuid,text)` returning `jsonb`.
- Produces the partial unique current-assignment index, active-department check, closed-history guard trigger, and service-role-only table/RPC ACLs.

- [ ] **Step 1: Write migration contract tests first.**

  Add Node tests that read the migration and assert: both permission codes; no `can_edit_all_tasks`; the partial unique index predicate; active `department_id` check; all three RPC names; `security definer`, fixed `search_path`, actor grant validation, `FOR UPDATE`; assignee/department validation; projection writes; `revoke all` from `public, anon, authenticated`; service-role grants; no inventory filename/import/backfill statements.

- [ ] **Step 2: Run the contract tests and confirm failure.**

  Run:

  ```powershell
  node --test src/lib/assetManagementV2Migration.test.mjs
  ```

  Expected: FAIL because the migration and rehearsal fixture do not exist.

- [ ] **Step 3: Write the migration.**

  Use one transaction. Upsert permissions and explicit compatibility grants; add the unique index with `where status = 'active' and returned_at is null`; add the current-row department check; add a `BEFORE UPDATE OR DELETE` trigger that rejects mutation/deletion of rows already closed (`returned_at is not null` or `status <> 'active'`); revoke old table ACLs/policies; define the three fixed RPCs as `SECURITY DEFINER SET search_path = public, pg_temp`; lock asset/current rows; validate actor `asset.manage`, active department, active assignee membership, and duplicate current state; close prior rows on transfer/return; synchronize `assets.assigned_department_id`; revoke public RPC execution and grant only `service_role`.

- [ ] **Step 4: Add the disposable rehearsal fixture.**

  Seed two active departments, one inactive department, admin, department manager, same-department employee, other-department employee, and one asset. Execute initial assign, mismatched-assignee rejection, inactive-department rejection, transfer, return, duplicate-current rejection, closed-row update/delete rejection, projection assertions, and service/anon ACL assertions. End with `rollback` and print `ASSET_MANAGEMENT_V2_REHEARSAL_PASS`.

- [ ] **Step 5: Run tests and the isolated PostgreSQL 17 rehearsal.**

  Run the contract test, then the existing disposable-db runner against a newly created PostgreSQL 17 container using only tmpfs/isolated network and `THOIDAI_DISPOSABLE_DB_TEST=1`. Expected: contract tests PASS and rehearsal PASS; production DB/ledger/service unchanged.

- [ ] **Step 6: Self-review and commit.**

  Run `git diff --check` and inspect the migration for broad grants, inventory import, hard deletes, role-name fallbacks, or missing locks. Commit:

  ```powershell
  git add supabase/migrations/20261009100000_asset_management_v2.sql src/lib/assetManagementV2Migration.test.mjs scripts/fixtures/asset-management-v2-rehearsal.sql
  git commit -m "feat(assets): add department-aware custody contract"
  ```

  **Checkpoint:** migration rehearsal must PASS before Task 2 starts.

### Task 2: RBAC catalog and pure scope model

**Files:**
- Modify: `src/lib/rbac/permissionCatalog.ts`
- Modify: `src/lib/rbac/types.ts`
- Modify: `src/lib/rbac/authorization.ts`
- Create: `src/lib/assetAuthorization.ts`
- Create: `src/lib/assetAuthorization.test.mjs`
- Modify: `src/lib/serverSession.ts`

**Interfaces:**
- `RbacPermissionCode` includes `asset.view` and `asset.manage`.
- `AssetVisibilityActor = { id: string; departmentId: string | null; isDepartmentManager: boolean; rbacPermissions: readonly string[] }`.
- `canViewAsset(actor, assignment)` and `canManageAssets(actor)` are pure, server-reusable predicates.

- [ ] **Step 1: Add failing scope tests.**

  Test employee self assignment, department-common assignment, coworker denial, manager department-wide visibility, `asset.manage` organization-wide access, null-department manager denial, and absence of any `can_edit_all_tasks` dependency.

- [ ] **Step 2: Run `node --test src/lib/assetAuthorization.test.mjs` and verify failure.**

- [ ] **Step 3: Implement the dedicated permission catalog and pure predicates.**

  Keep `scopesFor`/`hasPermission` canonical. `canViewAsset` must use the active assignment's `department_id`/`assignee_id`; `asset.manage` grants organization-wide access. Do not infer asset permissions from role names or legacy task flags.

- [ ] **Step 4: Wire `is_department_manager` and `rbacPermissions` into the actor adapter without changing session token behavior.**

- [ ] **Step 5: Run focused tests and self-review.**

  Run `node --test src/lib/assetAuthorization.test.mjs src/lib/permissionUiReadOnly.test.mjs`; inspect that no task permission is referenced.

- [ ] **Step 6: Commit.**

  ```powershell
  git add src/lib/rbac/permissionCatalog.ts src/lib/rbac/types.ts src/lib/rbac/authorization.ts src/lib/assetAuthorization.ts src/lib/assetAuthorization.test.mjs src/lib/serverSession.ts
  git commit -m "feat(auth): add asset permission scope model"
  ```

### Task 3: Server repository and transactional lifecycle adapter

**Files:**
- Create: `src/lib/assetRepository.ts`
- Modify: `src/lib/services/assets.ts`
- Create: `src/lib/assetRepository.test.mjs`
- Modify: `src/lib/serverSession.ts` only if the repository needs a typed actor projection from Task 2

**Interfaces:**
- `listAssetsForActor(actor): Promise<ServiceResult<AssetListPayload>>`
- `getAssetForActor(actor, assetId): Promise<ServiceResult<AssetDetailPayload>>`
- `createAssetForActor(actor, input): Promise<ServiceResult<Asset>>`
- `updateAssetForActor(actor, assetId, input): Promise<ServiceResult<Asset>>`
- `assignAssetForActor(actor, input): Promise<ServiceResult<AssetLifecyclePayload>>`
- `transferAssetForActor(actor, input): Promise<ServiceResult<AssetLifecyclePayload>>`
- `returnAssetForActor(actor, input): Promise<ServiceResult<AssetLifecyclePayload>>`

- [ ] **Step 1: Write repository tests with a mocked `serverSupabase`.**

  Assert scoped reads use current assignments rather than `assets.assigned_department_id`; options include active departments only; lifecycle calls pass `actor.id` from the server adapter; browser `actorId` input is ignored; RPC errors map to stable domain errors.

- [ ] **Step 2: Run the focused repository test and confirm failure.**

- [ ] **Step 3: Implement server-only repository functions.**

  Hydrate current assignment/history, preserve inactive historical department labels, and use RPC calls for all custody mutations. Metadata create/update is allowed only with `asset.manage`.

- [ ] **Step 4: Update service types and parsers.**

  Model `department_id` as required for current assignments, optional `assignee_id`, lifecycle status/history, and returned projection payloads. Remove the old XOR client validation.

- [ ] **Step 5: Run focused tests and commit.**

  ```powershell
  node --test src/lib/assetRepository.test.mjs
  git add src/lib/assetRepository.ts src/lib/services/assets.ts src/lib/assetRepository.test.mjs
  git commit -m "feat(assets): add scoped repository and lifecycle adapter"
  ```

### Task 4: API routes and asset-specific audit semantics

**Files:**
- Modify: `src/app/api/assets/route.ts`
- Modify: `src/app/api/assets/[id]/route.ts`
- Modify: `src/lib/serverAudit.ts`
- Create: `src/app/api/assets/assetsApi.test.mjs`

**Interfaces:**
- `GET /api/assets` returns only the actor-scoped assets plus hydrated current assignments/history.
- `GET /api/assets?options=1` returns active department/staff options only to `asset.manage`.
- `POST /api/assets` supports `create`, `assign`, `transfer`, and `return`; actor identity comes only from `getSessionUser()`.
- `PATCH /api/assets/[id]` updates descriptive metadata only; custody uses lifecycle actions.

- [ ] **Step 1: Write route tests first.**

  Cover 401/403, employee/manager/manage scopes, same-origin mutation, active department filtering, department+assignee acceptance, mismatched employee rejection, transfer/return response hydration, and rejection of `actorId` spoofing or task permission fallback. Assert audit module `assets` and actions `create`, `assign`, `transfer`, `return`, `update`.

- [ ] **Step 2: Run `node --test src/app/api/assets/assetsApi.test.mjs` and verify failure.**

- [ ] **Step 3: Refactor routes to call the Task 3 repository and dedicated authorization.**

  Keep existing HTTP paths; use explicit action parsing and stable errors. Never call Supabase from browser-facing route code with a client actor id.

- [ ] **Step 4: Extend `ServerAuditInput.module` with `assets` and retain existing modules unchanged.**

- [ ] **Step 5: Run focused route/security tests and commit.**

  ```powershell
  node --test src/app/api/assets/assetsApi.test.mjs src/lib/backendSecurityHardening.test.mjs
  git add src/app/api/assets/route.ts 'src/app/api/assets/[id]/route.ts' src/lib/serverAudit.ts src/app/api/assets/assetsApi.test.mjs
  git commit -m "feat(assets): enforce scoped server asset APIs"
  ```

### Task 5: Navigation and Asset Management UI

**Files:**
- Modify: `src/components/phase2Navigation.ts`
- Modify: `src/components/AppNav.tsx`
- Modify: `src/components/appNavState.ts`
- Modify: `src/app/assets/page.tsx`
- Modify: `src/app/assets/new/page.tsx`
- Modify: `src/app/assets/[id]/page.tsx`
- Create/modify: `src/components/assetManagement.test.mjs`

**Interfaces:**
- Navigation input exposes `canViewAssets` and `canManageAssets`; both desktop/mobile render one `/assets` item labelled `Quản lý tài sản`.
- Screens consume only `/api/assets` responses and show current department, optional custodian, history, transfer, and return state.

- [ ] **Step 1: Add failing navigation/UI tests.**

  Assert employee with `asset.view` sees the item, no grant does not; `asset.manage` sees management actions; desktop/mobile share `/assets`; active department selector excludes inactive departments; employee selection remains optional but department is required; successful lifecycle response updates the row without reload.

- [ ] **Step 2: Run the focused test and verify failure.**

- [ ] **Step 3: Implement navigation permission inputs and remove the hidden-assets filter only for the dedicated permission path.**

- [ ] **Step 4: Upgrade list/create/detail screens with scoped response hydration and assign/transfer/return controls.**

  Do not add direct Supabase imports, role workarounds, or workbook import UI.

- [ ] **Step 5: Run focused UI/security tests and commit.**

  ```powershell
  node --test src/components/assetManagement.test.mjs src/components/phase2Navigation.test.mjs src/lib/backendSecurityHardening.test.mjs
  git add src/components/phase2Navigation.ts src/components/AppNav.tsx src/components/appNavState.ts src/app/assets src/components/assetManagement.test.mjs
  git commit -m "feat(assets): restore department-aware management UI"
  ```

### Task 6: Profile server-authoritative asset view

**Files:**
- Create: `src/app/api/profile/assets/route.ts`
- Modify: `src/app/profile/page.tsx`
- Create: `src/app/api/profile/profileAssetsApi.test.mjs`

**Interfaces:**
- `GET /api/profile/assets` returns the authenticated actor's scoped current assets and assignment history; no user id query parameter is accepted.

- [ ] **Step 1: Write a failing test that rejects browser Supabase asset access and user-id spoofing.**

- [ ] **Step 2: Run the focused test and verify failure.**

- [ ] **Step 3: Implement the authenticated route using `listAssetsForActor` and replace only the profile asset query with `fetch('/api/profile/assets')`.**

  Leave task/profile data behavior unchanged.

- [ ] **Step 4: Run focused profile/security tests and commit.**

  ```powershell
  node --test src/app/api/profile/profileAssetsApi.test.mjs src/lib/backendSecurityHardening.test.mjs
  git add src/app/api/profile/assets/route.ts src/app/profile/page.tsx src/app/api/profile/profileAssetsApi.test.mjs
  git commit -m "fix(profile): use scoped asset API"
  ```

### Task 7: Full bounded verification and handoff

**Files:**
- Modify only tests/fixtures if a gate exposes an implementation defect; otherwise no source edits.

- [ ] **Step 1: Run all focused asset/RBAC/API/UI tests.**

  ```powershell
  node --test src/lib/assetManagementV2Migration.test.mjs src/lib/assetAuthorization.test.mjs src/lib/assetRepository.test.mjs src/app/api/assets/assetsApi.test.mjs src/components/assetManagement.test.mjs src/app/api/profile/profileAssetsApi.test.mjs src/lib/backendSecurityHardening.test.mjs src/components/phase2Navigation.test.mjs
  ```

- [ ] **Step 2: Run required repository gates.**

  ```powershell
  npm run check:routes
  npx tsc --noEmit
  npx eslint src/app/api/assets src/app/api/profile/assets src/app/assets src/app/profile/page.tsx src/components/AppNav.tsx src/components/phase2Navigation.ts src/components/appNavState.ts src/lib/assetAuthorization.ts src/lib/assetRepository.ts src/lib/serverAudit.ts src/lib/rbac/permissionCatalog.ts src/lib/rbac/types.ts src/lib/rbac/authorization.ts src/lib/serverSession.ts src/lib/services/assets.ts
  git diff --check
  ```

- [ ] **Step 3: Run production-like verification only after the disk gate is independently confirmed at >=20 GiB.**

  ```powershell
  npm run build
  npm run package:standalone
  npm run verify:standalone
  ```

  Verify `BUILD_ID`, route manifest, `.next/cache`, env symlink contract, ownership/modes, and provenance. Do not deploy.

- [ ] **Step 4: Self-review final diff and confirm non-goals.**

  Confirm no workbook import, no production mutation, no migration replay/ledger repair, no Docker/DB volume changes, no task permission usage, and no direct browser table/RPC access.

- [ ] **Step 5: Commit only any final test/fixture correction and report.**

  If no correction is needed, keep the seven task commits unchanged. Report migration rehearsal, scope/security/lifecycle tests, TypeScript, lint, routes, build/artifact, branch/HEAD, and `Production changed: NO`.

## Plan self-review checklist

- Spec coverage: migration/RLS/RBAC are Task 1–2; repository/API/audit are Task 3–4; navigation/UI/profile are Task 5–6; all verification is Task 7.
- No placeholders or unspecified interfaces remain; each task has concrete files, tests, commands, and commit boundaries.
- The RPC signatures and repository payload responsibilities are consistent across Tasks 1, 3, and 4.
- The plan intentionally stops before deployment and leaves inventory import to a later checkpoint.
