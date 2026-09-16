# Phase 1A - Checkpoint 3.5 Workflow Authorization Characterization Report

Date: 2026-09-16
Baseline branch: `phase1a-checkpoint3`
Baseline commit: `a9abbf355090806a8e60e2a6db9719150f41b75b`
Characterization branch: `phase1a-checkpoint3.5`
Worktree: `/opt/worktrees/thoidai-phase1a-cp35`

## A. Scope and safety

- Characterization only; no architecture change, migration, grant seed, RPC change, database change, deployment, production restart, main merge, or production flag activation.
- Production `/opt/thoidai-work` was not modified.
- `TASK_RBAC_V2_ENABLED=true` is used only by injected test handlers. Production remains off/untouched.
- Workflow decisions remain `task.view` base access plus legacy workflow/resource guard plus existing RPC/database validation.

## B. Four-layer matrix

The matrix covers roles `admin`, `tong_bien_tap`, `truong_phong`, `phong_vien`, `nhan_vien`, and `tbt_read_only`; relations creator/owner/assignee/reviewer/participant/department-manager/other-department; states `new`, `in_progress`, `pending_review`, `rejected`, `done`, and `cancelled`; and actions submit, return, resubmit, approve, score, rescore, update, deadline change, cancel, reopen, and attachment.

| ROLE / RELATION | ACTION | TASK STATE | RESOURCE RELATION | LEGACY | RBAC BASE | WORKFLOW GUARD | FINAL FLAG-ON | CLASSIFICATION |
|---|---|---|---|---:|---:|---:|---:|---|
| characterized roles | submit/return/resubmit/approve/score/rescore | all characterized states | canonical task relation | evaluated | `task.view` | legacy action/state/reviewer rule | `RBAC BASE AND WORKFLOW` | MATCH_ALLOW / MATCH_DENY |
| characterized roles | update/deadline/reopen | all characterized states | canonical task relation | evaluated | `task.view` | legacy creator/department/status rule | `RBAC BASE AND WORKFLOW` | MATCH_ALLOW / MATCH_DENY |
| characterized roles | cancel | all characterized states | canonical task relation | evaluated | `task.view` | legacy creator/admin/status rule | `RBAC BASE AND WORKFLOW` | MATCH_ALLOW / MATCH_DENY |
| characterized roles | attachment | all characterized states | canonical task relation | evaluated | `task.view` | legacy resource/storage/RPC rule | `RBAC BASE AND WORKFLOW` | MATCH_ALLOW / MATCH_DENY |

Matrix output: `2772` rows, `918` MATCH_ALLOW, `1854` MATCH_DENY, `0` RESTRICTIVE_MISMATCH, `0` SECURITY_CRITICAL_MISMATCH.

## C. task.view base check

The explicit check found zero legacy-allowed workflow cases where `task.view` base denied. No actor relation required a new grant or mapping change. No permission was inferred from `task.view`; workflow guards remain independently evaluated.

## D. Evaluation

- `task.evaluate.step1`: characterized with legacy evaluator/creator/reviewer relationship and existing stage guard; final result is `task.evaluate.step1 base AND legacy evaluator guard`.
- `task.evaluate.step2`: characterized for TBT with the existing step-2 role/stage guard; final result is `task.evaluate.step2 base AND legacy evaluator guard`.
- No evaluation grant was added in this checkpoint.

## E. RPC/workflow validation preserved

Source characterization confirms existing functions still enforce their rules:

- progress/submit: `api_assert_task_action`, valid task type/status, report validation;
- return/approve: reviewer guard, `pending_review`, decision/reason validation;
- score: reviewer identity, pending-review state, requirement-count and score validation;
- fresh score: approve requires a score updated after the current submission;
- deadline/cancel: action guard, assigned-task type, terminal-state and date/reason checks;
- attachment: legacy owner/creator/assignee/non-watcher/department guard plus metadata/path limits.

No RPC was modified.

## F. Flag-ON end-to-end

The handler-level state machine passed:

`assign -> in_progress -> submit -> pending_review -> return -> rejected -> resubmit -> pending_review -> score -> approve -> done`

The test runs with `taskRbacEnabled: true` and enforces RBAC base access before the legacy guard. Final state is `done`.

## G. Direct API deny tests

All passed with HTTP 403:

- unrelated employee submit;
- employee approve/score attempt;
- manager from another department return;
- wrong reviewer approve;
- wrong evaluator step 1;
- `tbt_read_only` mutation;
- outsider attachment download by known task/attachment IDs.

Attachment upload by a legacy-authorized owner passed and storage architecture was unchanged. Client-supplied actor/department values are not used for authorization.

## H. Verification

- Checkpoint 3.5 characterization: `6/6` passed.
- Full critical authorization/workflow suite including Checkpoint 3 tests: `54/54` passed.
- `npx tsc --noEmit`: passed.
- Changed-file ESLint: passed with 0 errors.
- `git diff --check`: passed.
- Build command: `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret npx next build --webpack`.
- Build result: **BLOCKED** by external Google Fonts network timeout while fetching `Geist Mono`; compilation did not complete. No production secrets were used.

## I. Mismatch counts and decision

- `SECURITY_CRITICAL_MISMATCH`: **0**
- `RESTRICTIVE_MISMATCH`: **0**
- Owner-approved compatibility exception required: **none**

## J. Open risks

- This checkpoint characterizes the application handler and migration source rules; no production RPC invocation or production data mutation was performed.
- Real task IDs and role grants should be revalidated in a separately approved controlled test environment before activation.
- The worktree uses the existing external `node_modules` symlink; Webpack build was used because Turbopack rejects that pre-existing symlink.

## K. GO / NO-GO

**NO-GO for controlled activation.**

Authorization characterization itself is clean (`0` critical and `0` restrictive mismatch), but the required build gate is not green because the VPS could not reach Google Fonts. Re-run the exact non-secret build when network/font availability is restored; do not activate before it passes.

Not a production activation approval: do not deploy, restart production, enable `TASK_RBAC_V2_ENABLED`, merge `main`, or modify the database in Checkpoint 3.5. Stop here and wait for owner review.
