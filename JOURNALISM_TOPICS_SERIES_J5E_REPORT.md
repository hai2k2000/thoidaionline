# Journalism Topics / Series J5E Report

Status: J5E = DONE

JOURNALISM J5 IMPLEMENTATION = READY FOR OWNER PRODUCTION REVIEW

## A. Provenance

- J5D application baseline: `9e6fcd5e41b778949674331e785ad7d1004b5ed7`
- J5D branch/report head: `921bd2f42dba1019ac586aba15b3708c84c23204`
- Provenance diff after the application baseline was report/status documentation only.

## B. Branch / worktree

- Branch: `journalism-j5e-topics-series-ui`
- Worktree: `/opt/worktrees/journalism-j5e-topics-series-ui`
- Production was not touched.

## C. Backend baseline

- J5B/J5C/J5D migrations and mutation RPC contracts are consumed unchanged.
- No migration, schema, RPC, permission, grant, or production source change was made.

## D. Files changed

- Added scoped Journalism structure repository/read loaders.
- Added `/journalism/structures` management page and Series order view.
- Added Topic/Series association controls to Journalism Task detail.
- Added Topic/Series Task Center filter controls.
- Extended navigation and session RBAC permission projection for the approved read/render gate.
- Added J5E focused contract tests.

## E. Route / navigation

- Chosen route: `/journalism/structures`.
- Navigation is shown from effective `journalism.structure.manage`; the page also enforces server-side authorization.

## F. Management read scope

- `all` management scope sees global and department-owned structures.
- `department` management scope sees only structures owned by the actor's department.
- Other-department planning structures are not exposed as editable.

## G. Topic management UI

- List, create, edit name/description, and archive are available through existing same-origin APIs.
- Ownership is immutable during edit.
- Archived topics remain readable and show `Ngừng sử dụng`.

## H. Series management UI

- List, create, edit name/description/parent Topic, and archive are available.
- Parent Topic choices are active and department-compatible only.
- Archived Series remain readable and are not editable or reorderable.

## I. Task Topic UI

- Journalism Task detail shows attached Topics, including historical inactive labels.
- Attach/detach controls render only when effective `journalism.structure.assign` and parent Task access allow it.
- Existing J5D routes are used; successful mutations refresh authoritative server state.

## J. Task Series UI

- Journalism Task detail shows one Series membership and position.
- Existing membership has detach only; no replacement/move UI is introduced.
- Archived membership remains readable and detachable by an authorized actor.

## K. Task Center filters

- `topicId` and `seriesId` are URL-driven server-side filters.
- Options are scoped to approved global/department visibility and include inactive historical values where selected.
- Topic/Series filters imply Journalism-only mode.
- Switching to normal work clears Journalism subfilters.

## L. Series order UI

- Focused view: `/journalism/structures/{seriesId}`.
- Explicit keyboard-accessible `Lên` / `Xuống` controls are used; no drag/drop dependency.
- Each reorder submits one complete `taskIds` permutation to the existing J5D endpoint.

## M. Reorder visibility

- Reorder controls require structure manage permission and server-confirmed visibility of every member.
- If any member is outside Task visibility, the UI shows a safe Vietnamese message and does not expose hidden Task identity.
- Archived Series are read-only.

## N. Scoped read loaders / performance

- Management, picker, filter, and order data are composed in server-only loaders.
- No browser Supabase access, service-role leakage, or per-row browser fetch loop was added.

## O. Permission rendering

- Rendering uses effective RBAC permission codes and scope checks.
- Role-name checks were not added for J5E structure access.
- Backend mutation handlers remain authoritative.

## P. 409 / 403 handling

- Mutations show safe Vietnamese feedback.
- 403 stops the pending state and does not retry.
- Association conflicts refresh authoritative detail; order 409 refreshes without automatic retry.

## Q. Inactive historical behavior

- Existing attached inactive Topics/Series remain visible with `Ngừng sử dụng`.
- Inactive structures are excluded from new attach/create parent choices and archive mutations.

## R. Responsive / accessibility

- Existing application visual language is preserved.
- Forms, chips, actions, and order buttons wrap on narrow screens.
- Labels are visible, critical actions are not icon-only, and reorder controls are keyboard reachable.

## S. N+1 / query strategy

- Management and filter option reads use bounded server compositions.
- Series order uses one bounded membership/task query and server-side visibility evaluation.

## T. Client security

- No `SUPABASE_SERVICE_ROLE_KEY`, direct client table mutation, direct client RPC, raw SQL error, or `dangerouslySetInnerHTML` was added.
- Mutations use same-origin API routes only.

## U. J5B / J5C / J5D regressions

- Focused J5B/J5C/J5D contract and security tests: PASS.
- Existing association, append, compaction, reorder, concurrency, audit, and RPC security contracts remain unchanged.

## V. J3 / J4 regressions

- Focused Journalism create, metadata, publication, Task Center, normal Task compatibility, and permission UI tests: PASS.

## W. RBAC exactness

- J5E adds no permission or grant tuples.
- No migration or RBAC catalog file changed.

## X. Full-suite classification

- Baseline at `921bd2f...`: 467 tests / 433 pass / 34 fail.
- J5E branch: 472 tests / 438 pass / 34 fail.
- Exact failing test-name comparison: the same 34 sealed baseline failures; zero new J5E failures.
- The five additional J5E tests pass.

## Y. TypeScript / lint / build

- `npm ci`: PASS.
- `npx tsc --noEmit`: PASS.
- Changed-file ESLint: PASS with existing warnings only; 0 errors.
- `git diff --check`: PASS.
- Production-safe Webpack build: PASS (exit code 0).
- Exact command: `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret-012345678901234567890123456789 npx next build --webpack`.

## Z. Production unchanged

- No deploy, restart, migration, database mutation, systemd change, RBAC/grant change, or production worktree change was performed.

## AA. Production-data discrepancy

`PRODUCTION DATA OBSERVATION REQUIRES RECONCILIATION BEFORE J5F` remains unchanged.

## AB. Known limitations

- Owner authenticated production smoke and production activation remain deferred to separately approved J5F.
- Existing sealed baseline failures remain unrelated to J5E.

## AC. Recommendation

GO for owner production review of J5E. Do not deploy or start J5F without separate explicit owner approval.
