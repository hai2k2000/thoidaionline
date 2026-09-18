# JOURNALISM TOPICS / SERIES J5D REPORT

Status: J5D implementation and isolated verification complete. Production unchanged.

## A. Provenance reconciliation

- Approved J5C application commit: `9dbeecf0dd6d06d8b8813ad32c04b23f5d710b1a`.
- Approved J5C branch/report head: `e2643afbc5a363aecd0418950018f896e79d32b2`.
- Full J5C application commit: `539b671e34df1dc1d04922b95e465e10a0d80b11`.
- Diff from application commit to report head contained only `JOURNALISM_TOPICS_SERIES_J5C_REPORT.md`.
- J5D branch: `journalism-j5d-associations-ordering`.
- Worktree: `/opt/worktrees/journalism-j5d-associations-ordering`.

## B. Baseline-failure reconciliation

The exact J5C application-tree broad suite produced `464 tests / 430 pass / 34 fail`. The current J5D suite produced `467 tests / 433 pass / 34 fail`; the three additional passing tests are the J5D association contract tests. The exact 34 failing test names match the sealed pre-J5D baseline; no J5D regression was identified.

## C. Branch/worktree

The branch started clean from `e2643afbc5a363aecd0418950018f896e79d32b2`. Production `/opt/thoidai-work` was not used or modified.

## D. Exact J5C application baseline

J5B and J5C source, read model, structure management, and existing authorization behavior were preserved. J5D adds only association/order RPCs, server handlers/routes, and disposable tests.

## E. Files changed

- `supabase/migrations/20260918150000_journalism_topics_series_j5_associations.sql`
- `supabase/tests/journalism_topics_series_j5d_associations.sql`
- `src/lib/journalismAssociationHandlers.ts`
- `src/app/api/tasks/[id]/journalism/topics/route.ts`
- `src/app/api/tasks/[id]/journalism/topics/[topicId]/route.ts`
- `src/app/api/tasks/[id]/journalism/series/route.ts`
- `src/app/api/journalism/series/[seriesId]/order/route.ts`
- `journalismStructureAssociations.test.mjs`

No Journalism UI files were changed.

## F. Migration identity

- Filename: `20260918150000_journalism_topics_series_j5_associations.sql`
- SHA-256: `fa6bbc73eabd787c386df2d7861b0a996d618b0f5da00801afc0247fc5e198ba`
- Git blob ID: `4aeecfbecc46256cfa78eabf340f0157945d74db`

## G. RBAC unchanged

Disposable J5B -> J5C -> J5D verification returned exactly `21 permissions` and `140 grants`. The sorted UTF-8 tuple serialization remained `5354` bytes with canonical SHA-256 `38001df3dfb0751f1288033bf415251a8314e0866caf5dfa231c10f7b0772638`. J5D contains no permission or role-grant inserts.

## H. `journalism.structure.assign`

Association RPCs reuse the existing J3 parent-Task authorization and evaluate the J5C assign grant against the parent Task. `assigned` uses existing owner/assignee/reviewer/participant semantics. Structure department compatibility is checked after parent authorization.

## I. Task visibility boundary

Association permission does not expand Task visibility. Normal Tasks without `journalism_task_details` return a safe not-found error. Reorder checks `task.view` for every current Series item before any position write.

## J. Topic attach/detach

`POST /api/tasks/{id}/journalism/topics` accepts only `{ topicId }`. Attach requires an active Topic, compatible department, Journalism Task, parent Task access, and `structure.assign`. Duplicate attach maps to 409. `DELETE /api/tasks/{id}/journalism/topics/{topicId}` permits active or archived Topics, is idempotent, and writes no audit for a missing association.

## K. Series attach/detach

`PUT /api/tasks/{id}/journalism/series` accepts only `{ seriesId }`. Active Series membership appends atomically, same-Series PUT is an authoritative no-op without audit, and a different existing Series returns 409. `DELETE /api/tasks/{id}/journalism/series` permits archived membership removal, is idempotent, and compacts remaining positions to `1..N`.

## L. Append positioning

The parent Task row is locked before the Series row. Append position is calculated under the Series row lock; the browser cannot provide a position.

## M. Detach compaction

Detachment uses a positive temporary range, then assigns contiguous positions and audits only after the final order is valid.

## N. Reorder contract

`PUT /api/journalism/series/{seriesId}/order` accepts only `{ taskIds: string[] }`. It requires active Series, `structure.manage` against Series ownership, visibility of every current Task, and an exact UUID permutation. Duplicate/missing/extra/foreign/stale sets return conflict. Exact current order is a no-op with no audit.

## O. Locking/concurrency

- Association lock order: parent Task/Journalism boundary, then structure row.
- Ordering lock order: Series row, then Series item rows.
- Reorder uses a positive temporary range and never negative positions.
- Disposable concurrent append test passed with final positions `1,2,3`.
- Disposable same-Task concurrent attach-to-two-Series test passed with exactly one membership.

## P. Archived structures

Archived Topics/Series remain readable and detachable. Archived Topics/Series reject new attach. Archived Series rejects reorder.

## Q. Department compatibility

Global structures may attach to any otherwise-authorized Journalism Task. Department-owned structures require the parent Task department to match, including for all-scope actors.

## R. API/error boundary

All routes use `requireMutationActor`, UUID validation, exact body allowlists, private no-store response helpers, and stable `rpcFailure` mapping. No browse/picker endpoint was added.

## S. Audit/atomicity

Required actions are implemented: `attach_topic_to_journalism_task`, `detach_topic_from_journalism_task`, `attach_series_to_journalism_task`, `detach_series_from_journalism_task`, and `reorder_editorial_series`. Audit payloads are bounded and use `module='journalism'`; a disposable forced-audit-failure test proved relation rollback.

## T. RPC security

All J5D helpers/RPCs use a fixed safe search path, revoke execute from `public`, `anon`, and `authenticated`, and grant execute only to `service_role`. Disposable ACL verification returned false for browser roles and true for `service_role`.

## U. J5B read regression

J5B contract suite passed, including nested Topic/Series DTOs, inactive historical values, filtering, pagination/count behavior, and no per-row association query regression.

## V. J5C management regression

J5C structure contract suite passed, including management routes, scope authorization, lifecycle, immutable department ownership, and server-only RPC boundary.

## W. J3/J4 regression

J3 metadata/publication contract tests and J4-compatible Journalism contract tests passed. No workflow, publication, evaluation, or UI source was changed.

## X. Task/RBAC regression

RBAC tuple count/hash remained byte-identical in disposable verification. Association tests covered assigned, department, all, unauthorized, cross-department, normal Task, and visibility-denial paths.

## Y. Full-suite classification

Full discovery result: `467 tests / 433 pass / 34 fail`. The 34 exact failure names are the authoritative pre-J5D baseline; there are zero newly introduced J5D failures.

## Z. TypeScript/lint/build

- `npm ci`: PASS, 0 vulnerabilities reported by npm.
- `npx tsc --noEmit`: PASS.
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- Non-secret `next build --webpack`: PASS.

## AA. Production unchanged

No production migration, deploy, restart, systemd edit, database mutation, `supabase db push`, or `supabase db reset` was performed. `/opt/thoidai-work` remains untouched.

## AB. Production-data discrepancy

Continue the approved statement: `PRODUCTION DATA OBSERVATION REQUIRES RECONCILIATION BEFORE J5F`. J5D did not inspect or mutate production data.

## AC. Known limitations

- UI attachment controls, pickers, and drag/drop ordering remain deferred to J5E.
- Production migration and authenticated production smoke remain deferred to J5F.
- The broad suite retains the sealed 34 unrelated baseline failures listed in the J5D handoff.

## AD. Recommendation

`J5D = DONE`.

`J5E = READY FOR OWNER APPROVAL`.

No J5E UI or J5F production activation was started.
