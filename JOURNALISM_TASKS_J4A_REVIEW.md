# JOURNALISM TASKS J4A REVIEW

Status: design-only review; no application implementation performed.

## 1. Inspected application baseline

- Runtime source baseline: `de5063c5155e3f25b10fdfa11271fc298370f1cb`.
- Existing production release: `/opt/releases/thoidai-work/de5063c5155e3f25b10fdfa11271fc298370f1cb-j3c-20260918T080957Z`.
- Final J3 report commit: `6fc51e600ba2c186e3bfaacd2dbe23d52e47e472`.
- Inspected actual files: `TaskCenterShell.tsx`, `TaskDetailShell.tsx`, `TaskAssignShell.tsx`, `TaskDetailModal.tsx`, `AppNav.tsx`, `ActionFeedbackProvider.tsx`, `actionFeedback.ts`, `taskFilters.mjs`, `taskRepository.ts`, `taskContracts.ts`, `auth.tsx`, and J3 Journalism route/validation files.
- Production source branch was clean before documentation work.

## 2. Production API/RBAC baseline

- Create: `POST /api/tasks/journalism/assign`.
- Metadata: `PATCH /api/tasks/{taskId}/journalism`.
- Publication: `POST /api/tasks/{taskId}/journalism/publication`.
- Read path: existing authorized Task list/detail DTOs compose nullable Journalism data; no browser-side direct table access.
- Publication states: `not_published`, `scheduled`, `published`, `withdrawn`.
- RBAC baseline: 19 permissions, 128 grants.
- Canonical grant hash: `1e87d9404fef719a22f8a4369d871a09df1a93bb46a7d7512c22affe245943bc`.
- Metadata scope grants: admin/TBT/PTBT/all; department leaders/department; reporters/staff/assigned.
- Publication scope grants: admin/TBT/PTBT/all; department leaders/department; no reporter/staff publication authority.
- UI must remain convenience-only; backend authorization, parent Task scope, RPC validation, and audit behavior remain authoritative.

## 3. Existing component findings

- Current Task list already has desktop table, mobile card fallback, server URL filters, exact count/pagination, empty/error states, and a compact orange/slate visual language.
- Current Task detail already has a sticky header/action row, two-column desktop layout, responsive stacking, comments, attachments, and collapsible history.
- Current Task creation is a single normal assignment form with native controls and an explicit submit loading state.
- Existing modal conventions include focus-on-open, Escape close, backdrop close, `aria-modal`, scrollable body, and responsive footer actions.
- Existing feedback uses global success/error toasts plus inline messages and safe backend error mapping.
- No parallel UI kit, shared date picker, or dedicated Journalism component was found; J4 should reuse native controls and local conventions.

## 4. Compatibility findings

- Normal Tasks remain nullable `journalism=null` and should not gain empty Journalism UI.
- Existing query parser/repository already supports Journalism-only/exclude, work-kind, publication-status, and planned-date filters server-side.
- Existing DTOs already include the Journalism summary/detail fields needed by the design, avoiding N+1 browser requests.
- Historical inactive work kinds remain readable through the DTO but must not be selectable for new or replacement writes.
- Parent Task fields and workflow remain separate from Journalism metadata/publication state.
- Current normal create form exposes recurrence; J4 Journalism create must explicitly hide recurrence because backend v1 rejects it.
- Existing permission metadata is available through session user permissions; J4B should use effective permission helpers and not add role-name security conditionals.

## 5. Risks and blockers

### Risks to control in J4B

- Accidentally reusing Task status colors/labels for publication state could mislead users.
- Adding client-side filtering after pagination could produce false totals; keep all Journalism filters server-side.
- Showing publication controls from `task.view` or role names would create a security/UX mismatch; require effective Journalism permission plus parent Task authorization.
- A generic status dropdown could expose invalid transitions; render only valid next actions.
- Article URL must remain read-only after publishing; do not create a correction path in J4.
- Dialogs and action rows can crowd small screens; reuse existing responsive modal/action patterns and maintain 44px targets.

### Current design-level read-path gap

- The inspected list/detail DTO carries current work-kind data, but no dedicated active-work-kind options endpoint was identified in the inspected UI files. J4B should obtain active master-data options through the existing server-side repository/page data path or a narrowly scoped read-only loader. This is not a J4A backend redesign blocker and must not become a browser Supabase call.

### Explicitly not blockers

- No schema/migration/RPC/grant change is required for the designed UI.
- No CMS, recurrence, Topics/Series, or normal-to-Journalism conversion is needed.

## 6. J4B recommendation

**GO for owner review of J4A documentation.**

Recommended implementation sequence:

1. J4B-1 read-only list/detail and filters.
2. J4B-2 explicit Journalism create entry/form.
3. J4B-3 metadata edit.
4. J4B-4 publication controls.
5. J4B-5 integrated regression/accessibility/responsive/build gate.

Each slice should be isolated, tested, reviewed, and kept separate from production activation. Do not implement UI, change backend contracts, deploy, restart, alter RBAC, or start J4B until owner approves these documents and selects any unresolved product choices.

## 7. Owner decisions surfaced

- Placement of the explicit Journalism creation choice.
- Whether planned publication time appears in the default Task list.
- Buttons versus action menu for publication controls.
- Whether Journalism audit events appear in the existing Task history during J4 or are deferred.

Recommended options and rationale are documented in `JOURNALISM_TASKS_J4_UI_CONTRACT.md`.

## 8. Scope validation

The J4A change set is documentation-only. The intended final commit must contain exactly:

- `JOURNALISM_TASKS_J4_UI_CONTRACT.md`
- `JOURNALISM_TASKS_J4A_REVIEW.md`

No `src/`, `supabase/`, package, ops, systemd, or production files may change.
