# Projects reopen and close confirmation

Implemented offline on feature/projects-reopen, base ee09d3dbd9145585d990d8c2d8dc31f079bcd8c0. No commit, push, SSH, Docker, DB application or production activation. RuleCodex offline rule.md and GLOBAL_DEPLOY_POLICY.md read from the supplied snapshot. Existing Git HEAD is the recoverable baseline; tree was clean before this task.

## Validation

- New contracts initially failed: 5 failures / 1 existing visibility pass; then implemented.
- Requested targeted Node suite plus rpcErrorMapping: 45/45 PASS.
- Exact workflow Node command: 74/74 PASS (command below).
- Final changed SQL/dry-run contracts: 6/6 PASS after strengthening audit and assignment checks.
- npx.cmd tsc --noEmit: PASS, exit 0.
- npx.cmd eslint on all touched TS/TSX/MJS files: PASS, no warnings/errors.
- bash -n scripts/production/projects-reopen-dryrun.sh: PASS.
- git diff --check: PASS; Git emitted only line-ending normalization notices.
- Changed-file secret/runtime-artifact scan: PASS; no protected PR #132 files changed.
- npm.cmd run build with workflow CI placeholder environment: FAILED only on fetching Be Vietnam Pro and Geist Mono from Google Fonts. Required-route and release-lineage prebuild checks PASS. Existing databaseManagement/storage.ts tracing warnings are unrelated. No font workarounds or network escalation used. The requested build inherently attempted font requests, which failed offline.
- Node runtime: v24.13.1 on Windows, whereas CI pins 22.22.0 on Linux. No production-compatible release artifact is claimed.
- Live PostgreSQL behavior/revert/reapply NOT RUN (offline; no Docker/SSH). Claude must run the supplied disposable rehearsal. UI tests are source contracts, not browser interaction tests.

Exact workflow command:
```sh
node --test scripts/artifact-provenance.test.mjs scripts/artifact-manifest.test.mjs scripts/artifact-secret-scan.test.mjs scripts/ci-build-env.test.mjs scripts/canonical-build-env.test.mjs scripts/canonical-ref-preparation.test.mjs scripts/rbac-v2-scope-hotfix.test.mjs scripts/deploy-gate.test.mjs scripts/production/controlled-deploy-exception.test.mjs scripts/production/produce-rbac-readiness.test.mjs scripts/package-standalone.test.mjs scripts/standalone-packaging.test.mjs scripts/external-artifact-contract.test.mjs scripts/artifact-roundtrip.test.mjs scripts/classify-release-risk.test.mjs
```

Targeted command:
```sh
node --test src/lib/projectsReopen.test.mjs scripts/production/projects-reopen-dryrun.test.mjs scripts/standalone-packaging.test.mjs src/lib/projectApi.test.mjs src/lib/projectsV12Ui.test.mjs src/components/projectsUiPolish.test.mjs src/lib/rpcErrorMapping.test.mjs
```

## Findings and specification interpretation

ProjectsGrid already defaults to all statuses and offers the closed-status filter. projectRepository.list and /api/projects preserve closed rows within existing membership/admin visibility. No list edit was needed. isLead includes Admin; latest api_project_is_lead also grants active nonmember Admin authority.

Closing blocks new project assignment; it does NOT make the entire project read-only. Existing metadata/member/library operations are not globally disabled. The warning accurately states closed status and inability to assign new work, plus lead/Admin reopening.

SQLSTATE 55000 already maps through rpcFailure to conflict/409. The new control maps that reopen response to a friendly Vietnamese already-active message; the API error envelope remains unchanged.

The requested post/ path contains a read-only postcondition, matching projects-v1-2/post and safe-apply-migration.sh's contract. It is intentionally not a duplicate executable migration: copying mutation SQL there would violate the runner's postcondition contract.

Revert drops only the new function, retaining project statuses and audit history. Its ledger change is separate; the rehearsal deletes only its own version in the disposable restored DB. The rehearsal follows the existing restore-ACL normalization pattern and preserves disk/backup checksum/leftover-container guards.

No existing tests asserted the removed inline close-button markup. Existing migration definitions, api_close_project, api_assign_project_task, assignment UI, task POST, and due-date validation are unchanged. No changes to PROJECT_STATUS.md other than the appended handoff section.

## Files changed

- `scripts/package-standalone.mjs`: Include reopen migration in MIGRATION_REFERENCE.
- `scripts/standalone-packaging.test.mjs`: Assert reopen migration is referenced exactly once.
- `scripts/verify-standalone-artifact.mjs`: Require reopen migration in packaged references.
- `src/app/api/projects/[id]/route.ts`: Dispatch reopen through existing mutation/lead guards and rpcFailure.
- `src/components/ProjectDetailShell.tsx`: Import status control and replace only header close expression.
- `src/lib/projectRepository.ts`: Add only reopen RPC method next to close.
- `scripts/production/projects-reopen-dryrun.sh`: Disposable backup restore, apply, behavior, idempotency, revert and reapply rehearsal.
- `scripts/production/projects-reopen-dryrun.test.mjs`: Source contracts for rehearsal safety, SQL scenarios and postconditions.
- `scripts/production/projects-reopen-revert.sql`: Drop only reopen RPC; retain data and explain separate ledger reconciliation.
- `scripts/production/projects-reopen/post/20261105100000_projects_reopen.sql`: Read-only postcondition for signature, return type, definer, search path, owner and ACLs.
- `src/components/ProjectStatusControl.tsx`: Accessible native close/reopen dialogs, acknowledgement, busy/errors and closed date.
- `src/lib/projectsReopen.test.mjs`: Migration/UI source contracts, visibility and executable PATCH guard/dispatch tests.
- `supabase/migrations/20261105100000_projects_reopen.sql`: Locked authorized reopen RPC with active-state rejection and audit.
- `supabase/tests/projects_reopen_behaviour.sql`: Rollback fixtures for roles, missing/active state, assignment and audit.
- `docs/projects-reopen-report.md`: This report, exact header diff and validation limitations.
- `PROJECT_STATUS.md`: Append-only handoff status.

## Exact ProjectDetailShell diff hunks

```diff
diff --git a/src/components/ProjectDetailShell.tsx b/src/components/ProjectDetailShell.tsx
index 2b8b8e2..2f72da7 100644
--- a/src/components/ProjectDetailShell.tsx
+++ b/src/components/ProjectDetailShell.tsx
@@ -8,0 +9 @@ import ProjectLibrary from "@/components/ProjectLibrary";
+import ProjectStatusControl from "@/components/ProjectStatusControl";
@@ -63 +64 @@ export default function ProjectDetailShell({project,members,tasks,actorId,actorR
-  {isLead&&project.status==='active'?<button disabled={busy} onClick={()=>void mutate(`/api/projects/${project.id}`,'PATCH',{action:'close'})} className={`${button} mt-3 text-rose-700`}>Đóng dự án</button>:null}</header>
+  {isLead?<ProjectStatusControl project={project} disabled={busy}/>:null}</header>
```

## Handoff

Run the rehearsal on an approved disposable target with BUNDLE_DIR, POSTGRES_IMAGE and THOIDAI_PROJECTS_REOPEN_DRYRUN_APPROVED=1. It requires the existing V1/V1.1/V1.2 schema in the verified backup. No production migration/restart/activation is authorized by this offline implementation. Source remains intentionally uncommitted and unpushed per this task's explicit instructions.
