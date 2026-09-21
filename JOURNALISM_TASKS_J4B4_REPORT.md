# JOURNALISM TASKS J4B-4 REPORT

Date: 2026-09-18
Status: IMPLEMENTED ON ISOLATED BRANCH; NO PRODUCTION ACTION

## A. Branch / worktree

- Branch: `journalism-tasks-j4b4-publication-ui`
- Worktree: `/opt/worktrees/journalism-tasks-j4b4-publication-ui`
- Worktree created from the latest clean J4B-3 report branch state.
- Production worktree and service were not touched.

## B. Exact application baseline

- Application/runtime baseline: `c34e292aa6aea5c0d4f32335a08c4fc4bf42f061`
- This is the J4B-3 feature commit; no runtime/test changes were found after it.

## C. Report / provenance baseline

- J4B-3 provenance/report baseline: `cd49b407e6be031b1a30fd54da222b5ffd1f9c63`
- The diff from the application commit to that baseline was report/docs only.
- Production remains on `de5063c5155e3f25b10fdfa11271fc298370f1cb`.

## D. Files changed

- `src/app/tasks/[id]/page.tsx`
- `src/components/TaskDetailShell.tsx`
- `src/components/JournalismPublicationControls.tsx`
- `src/lib/journalismPublicationUi.mjs`
- `src/lib/journalismPublicationUi.test.mjs`
- `JOURNALISM_TASKS_J4B4_REPORT.md`

No backend route, schema, migration, RPC, grant, RBAC, audit/history UI, CMS connector, or production file changed.

## E. Permission implementation

The server task-detail page independently evaluates `authorizeJournalismPermission(user, task, "journalism.publication.manage")`. Publication UI is not inferred from metadata permission, task view, task edit, workflow status, or browser role names. The J3 backend remains authoritative.

## F. State / action mapping

- `not_published`: `Lên lịch xuất bản`, `Đánh dấu đã xuất bản`.
- `scheduled`: `Hủy lịch xuất bản`, `Đánh dấu đã xuất bản`.
- `published`: `Gỡ bài`.
- `withdrawn` and unknown states: no publication mutation controls.

## G. Schedule UX / request

The schedule dialog prefills existing planned time, requires complete Vietnam-local date/time, rejects impossible or past values, and sends exactly `{ status: "scheduled", plannedPublicationAt }`. Success refreshes authoritative server state.

## H. Cancel-schedule UX / request

The reversible confirmation dialog shows the existing planned time and sends exactly `{ status: "not_published" }`. The backend clears the planned time; the UI does not optimistically retain stale data.

## I. Publish UX / request

The publish dialog asks for `URL bài đã xuất bản`, explains that the URL is immutable in this version, and preserves any stored planned time as read-only context. It sends exactly `{ status: "published", articleUrl }` for either permitted source state.

## J. URL validation / immutability

Client validation requires a trimmed absolute `http:` or `https:` URL, no username/password, and at most 2048 characters. Backend validation remains authoritative. Published URLs remain read-only and are never exposed in the J4B-3 metadata editor. Existing safe URL rendering (`target="_blank"`, `rel="noreferrer"`) is reused in the withdraw context.

## K. Withdraw UX / request

The published-only `Gỡ bài` dialog uses stronger confirmation styling, explains that only Thời Đại Work state changes, shows the current URL read-only, and requires a trimmed reason of 1–2000 Unicode characters. It sends exactly `{ status: "withdrawn", reason }`; withdrawal reason is not rendered as a normal detail field.

## L. Conflict handling

HTTP 409 and `publication_state_conflict` close the stale dialog, show `Trạng thái xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại.`, call `router.refresh()`, and never retry. 403 and 404 are mapped to approved safe messages and refresh behavior.

## M. Loading / double-submit behavior

Every mutation uses a ref guard plus disabled controls while pending. A click produces at most one POST. Pending state is visible as `Đang xử lý...`; no optimistic status mutation occurs.

## N. Error mapping

Safe mappings cover forbidden, not-found, invalid schedule, invalid URL, withdrawal reason, conflict, and unexpected failures. Raw SQL, PostgREST, RPC, audit payloads, and stack traces are not shown.

## O. CMS-semantic safety

Copy consistently describes internal publication tracking in Thời Đại Work. It does not claim to publish, remove, or synchronize CMS content.

## P. Accessibility / responsive

Controls have visible text labels, keyboard-operable buttons, `role="dialog"`, `aria-modal="true"`, labelled headings, focus-on-open, field-level `aria-invalid`/`aria-describedby`, pending state, and distinct withdraw styling. Buttons stack/full-width on mobile; dialogs scroll within the viewport and long URLs wrap safely.

## Q. J4B-1 / J4B-2 / J4B-3 regression

Existing Journalism list/detail/filter/create and J4B-3 metadata tests pass. Metadata permission, partial PATCH, inactive work-kind behavior, no-op handling, planned-date locks, UTC+07 conversion, and article URL absence from the metadata editor remain intact.

## R. J3 regression

Existing J3 publication, authorization, conflict, URL/reason validation, metadata, audit-contract, atomic-create, and task-read coverage was rerun. No J3 backend source or contract changed.

## S. Test counts

- J4B-4 focused tests: **9/9 PASS**.
- Integrated J4B-1/J4B-2/J4B-3/J4B-4/J3/J2/RBAC suite: **113/113 PASS**.
- `git diff --check`: **PASS**.

## T. TypeScript / lint / build

- `npm ci`: completed; no vulnerabilities reported.
- `npx tsc --noEmit`: **PASS**.
- Changed-file ESLint: **0 errors**; 8 pre-existing unused-variable warnings in `TaskDetailShell.tsx`.
- Production-safe command:

  `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret TASK_RBAC_V2_ENABLED=false npx next build --webpack`

- Build: **PASS**, exit code **0**, static generation **92/92**. External font retries appeared in the log, but the build completed without source/config changes.

## U. Production = UNCHANGED

No deploy, restart, systemd change, migration, schema/RPC/grant/RBAC change, production data mutation, or `/opt/thoidai-work` modification was performed.

## V. Known limitations

- Publication actions remain dependent on the existing J3 API and backend authorization/state validation.
- Audit/history visualization, URL correction, CMS publishing, notifications, and future publication workflows remain intentionally out of scope.
- The existing unrelated lint warnings remain unchanged.

## W. GO / NO-GO recommendation for J4B-5

**GO FOR OWNER REVIEW OF J4B-5 DESIGN ONLY.** J4B-4 publication controls are complete on this isolated branch. Do not implement J4B-5 until separately approved.

## Final verification

- Feature/application commit: `1387efa4042d221c4e011d61b6c681e4cc9b22ec` (`feat: add journalism publication controls ui`).
- Initial report commit: `52c3567b9986cf03408dd2bad3bf1d80a1577bd2` (`docs: record journalism publication ui report`).
- Final report commit / branch HEAD: `a4e6eaebd34ef67abaf3caa573a6f3daf49d1e46` (`docs: finalize journalism publication ui provenance`).
- Local and remote branch match `a4e6eaebd34ef67abaf3caa573a6f3daf49d1e46`.
- Worktree is clean.
- The only commits after application commit `1387efa...` are report-only; application tree is unchanged.
