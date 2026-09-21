# JOURNALISM TASKS J4 UI CONTRACT

Status: J4A design-only; no UI implementation is authorized.

Baseline: J3 runtime commit `de5063c5155e3f25b10fdfa11271fc298370f1cb`; production release `/opt/releases/thoidai-work/de5063c5155e3f25b10fdfa11271fc298370f1cb-j3c-20260918T080957Z`.

## A. Existing UI characterization

- `src/components/TaskCenterShell.tsx` is the current Task list shell. It owns scope/status/deadline/department filters, server pagination links, desktop table rows, mobile cards, empty/error copy, and the existing orange/slate/white visual language.
- `src/components/TaskDetailShell.tsx` is the full Task detail shell. It uses a sticky header, compact status/action controls, two-column desktop layout, stacked mobile layout, native fields, inline sections, comments, attachments, and a collapsible `Lịch sử` area.
- `src/components/TaskAssignShell.tsx` is the normal `GIAO VIỆC` form. It uses native `select`, `date`, `time`, checkbox groups, inline status/error text, `ActionFeedbackProvider`, `responseErrorMessage`, and a disabled loading submit button.
- `TaskDetailModal.tsx` is the existing modal reference: `role="dialog"`, `aria-modal`, Escape close, focus on open, backdrop close, scrollable body, sticky header/footer, and mobile-safe sizing.
- `AppNav.tsx` has an existing responsive mobile navigation dialog with focus restoration. `ActionFeedbackProvider.tsx` provides the global `role=status` / `role=alert` toast pattern.
- Date display uses `Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })`; no project-wide custom DatePicker or component library was found. J4 should reuse native date/time controls unless J4B discovers a newer shared control.
- Existing actions use visible text buttons, native controls, `window.prompt` for simple reasons, inline `role=alert`, and `router.refresh()` after server-confirmed mutation.
- `taskFilters.mjs` already parses `journalism=only|exclude`, `workKind`, `publicationStatus`, `plannedFrom`, and `plannedTo`, and `taskRepository.ts` applies these filters server-side with exact count/pagination.
- `taskContracts.ts` already exposes nullable `journalism` list/detail DTOs with work kind, publication status, planned/published timestamps, location, URL, and editorial notes.

## B. Design principles

1. Journalism is a small extension of Task Management, not a newsroom shell.
2. Task remains the canonical resource. Department, assignee, reviewer, deadline, priority, description, comments, attachments, workflow, and evaluation remain parent Task UI.
3. A normal Task remains visually and behaviorally unchanged unless the user explicitly chooses a Journalism filter or opens a Journalism Task.
4. UI permission checks are convenience only. J3 API/RPC authorization remains authoritative.
5. Publication status is not Task workflow status: use a separate label, badge family, and heading.
6. Use progressive disclosure: Journalism fields appear in a clearly labeled section, while advanced publication actions appear only for the current state and effective permission.
7. All mutation state is server-confirmed; no optimistic publication transition.

## C. Create flow

### Entry point

Keep `/tasks/assign` as the familiar entry point. Add a visible choice immediately below the `GIAO VIỆC` heading and before the form:

- `Công việc thường` (current form, default)
- `Công việc nghiệp vụ báo chí` (Journalism form)

Recommended implementation shape for J4B: a small segmented choice or two links preserving normal form state only when safe; use an explicit `kind=journalism` URL state rather than hidden fields. Do not infer Journalism from a work-kind field and do not silently change the existing form.

### Journalism create form

Reuse all current Task assignment fields and conventions, then add a bordered `Nghiệp vụ báo chí` section:

- `Loại nghiệp vụ` — required controlled active master-data select.
- `Dự kiến xuất bản` — optional local date/time control; display Asia/Ho_Chi_Minh context where current app convention needs it.
- `Địa điểm` — optional text, max 500 characters.
- `Ghi chú biên tập` — optional textarea, max 10,000 characters.
- Informational badge: `Trạng thái xuất bản: Chưa xuất bản`; no editable status field.

Do not render `published_at`, `article_url`, withdrawal reason, CMS, Topics/Series, or recurrence fields in this form. Journalism create must call `POST /api/tasks/journalism/assign`, not the normal Task endpoint. The submit button is `Tạo công việc nghiệp vụ báo chí`; disable it while pending and route to the resulting Task detail after success.

## D. Task list treatment

Journalism rows receive a compact, non-primary indicator beside the title:

`Nghiệp vụ báo chí` icon/badge · `Bài viết` · `Đã lên lịch`

Use text plus a consistent vector icon; never rely on color alone. Keep Task workflow status in its existing column/badge. Show planned publication time only in the expanded row/mobile summary when space permits; do not add a new primary table column. Normal Tasks have no empty Journalism placeholder and keep the current layout.

## E. Filters

Add a compact Journalism filter group to the existing `TaskCenterShell` filter area, using the existing URL/query link behavior and server pagination:

- `Loại công việc`: `Tất cả`, `Công việc thường`, `Nghiệp vụ báo chí`.
- `Loại nghiệp vụ`: active/current work kinds only.
- `Trạng thái xuất bản`: `Chưa xuất bản`, `Đã lên lịch`, `Đã xuất bản`, `Đã gỡ`.
- `Dự kiến xuất bản từ`, `Dự kiến xuất bản đến`.

Exact URL semantics:

- `Tất cả`: omit Journalism filter parameters.
- `Công việc thường`: `journalism=exclude` (`journalism=is.null` in the repository); this preserves all normal Tasks without client filtering.
- `Nghiệp vụ báo chí`: `journalism=only`.
- Any Journalism-only subfilter automatically implies `journalism=only`.

When `Công việc thường` is selected, hide Journalism-only controls and clear them in the next URL. When `Tất cả` is selected, Journalism subfilters remain hidden until the user chooses `Nghiệp vụ báo chí`; this avoids surprising narrowing. Browser back/forward, server count, ordering, and pagination remain URL-driven. No client-side filtering after pagination.

The existing parser already supports `journalism`, `workKind`, `publicationStatus`, `plannedFrom`, and `plannedTo`. J4B should preserve those names and extend only the UI control layer if needed.

## F. Detail layout

Add a dedicated section inside the existing `TaskDetailShell` main content, after the Task overview and before comments/history:

`Nghiệp vụ báo chí`

Display only populated values (use `—` for a single missing value where that is the current convention):

- `Loại nghiệp vụ`
- `Trạng thái xuất bản`
- `Dự kiến xuất bản`
- `Đã xuất bản lúc`
- `Địa điểm`
- `URL bài đã xuất bản`
- `Ghi chú biên tập`

Use a two-column definition grid on desktop and one column on narrow screens. Long notes wrap with `whitespace-pre-wrap` and safe word breaking. The URL is a concise safe external link using `target="_blank" rel="noreferrer"`; render text as the URL/hostname, never raw HTML. Do not show an empty Journalism card for normal Tasks.

## G. Metadata edit

The `Nghiệp vụ báo chí` section shows `Chỉnh sửa thông tin` only when effective `journalism.metadata.update` and authorized parent Task scope are both true. View-only users see the same data read-only. Do not derive authority from role-name conditionals when effective permission metadata is available.

Use an existing dialog pattern (`TaskDetailModal` conventions) or a small inline expandable form if the current detail page favors inline editing. Fields:

- `workKindId`
- `plannedPublicationAt`
- `location`
- `editorialNotes`

Never include `articleUrl`, `publicationStatus`, or `publishedAt`. Call `PATCH /api/tasks/{id}/journalism`; on success refresh the Task detail and show `Đã cập nhật thông tin nghiệp vụ báo chí.`

State rules:

| Publication status | Planned publication UI |
|---|---|
| `not_published` | Editable and optional |
| `scheduled` | Editable and required |
| `published` | Read-only; explain that the planned time is locked |
| `withdrawn` | Read-only; explain that the planned time is locked |

Other metadata remains editable when permission allows. Do not submit a forbidden planned-date change silently.

## H. Publication controls

Show a publication action menu or compact action group only when effective `journalism.publication.manage` and parent Task scope are true. Metadata permission does not imply publication permission, and publication permission does not imply metadata edit.

Valid actions only:

| Current state | Action | API |
|---|---|---|
| `not_published` | `Lên lịch xuất bản` | `POST .../publication`, `scheduled` |
| `not_published` | `Đánh dấu đã xuất bản` | `POST .../publication`, `published` |
| `scheduled` | `Hủy lịch xuất bản` | `POST .../publication`, `not_published` |
| `scheduled` | `Đánh dấu đã xuất bản` | `POST .../publication`, `published` |
| `published` | `Gỡ bài` | `POST .../publication`, `withdrawn` |
| `withdrawn` | none | no mutation control |

Recommend an action menu on desktop and a full-width stacked action group on mobile; if existing Task controls are all visible buttons, use the same button hierarchy rather than introducing a new menu primitive. Do not render impossible transitions as disabled clutter.

### Schedule dialog

Title: `Lên lịch xuất bản`. Required date/time; use existing native date/time control and Asia/Ho_Chi_Minh display convention. Submit only after valid input. Success: `Đã lên lịch xuất bản.`

### Cancel schedule

Title: `Hủy lịch xuất bản`. Show current planned time and concise confirmation: `Hủy lịch xuất bản và đưa trạng thái về Chưa xuất bản?`. This is reversible and should not use the strongest destructive styling. Backend clears `plannedPublicationAt`.

### Publish dialog

Title: `Đánh dấu đã xuất bản`. Required `URL bài đã xuất bản`; validate absolute `http`/`https`, no credentials, max 2048 characters. Show current planned time read-only if present. Confirmation copy: `URL sẽ được lưu là URL bài đã xuất bản và không thể sửa trong phiên bản hiện tại.` Do not ask for `publishedAt`; server generates it.

### Withdraw dialog

Title: `Gỡ bài`. Show current URL read-only and required `Lý do gỡ bài` (trimmed, max 2,000 characters). Use stronger confirmation: `Gỡ bài khỏi trạng thái đã xuất bản? Lý do sẽ được ghi vào lịch sử.` Keep URL and published time visible after success. Do not add a normal detail field for withdrawal reason unless a future API exposes it.

## I. Permission-aware UI

| Effective capability | Journalism UI |
|---|---|
| View only | Read-only Journalism section |
| `journalism.metadata.update` + parent scope | Metadata edit control |
| `journalism.publication.manage` + parent scope | Valid publication actions |
| Both | Both control groups |

Approved backend scopes remain the source of truth: metadata grants for admin/TBT/PTBT/department leadership/reporters/staff as approved; publication grants only admin/TBT/PTBT/department leadership. `phong_vien` and `nhan_vien` do not receive publication controls. UI absence never substitutes for backend denial.

## J. Error, conflict, loading, and empty states

Use `responseErrorMessage`, `errorMessage`, inline `role=alert`, and `ActionFeedbackProvider`; never expose raw PostgREST/database text.

| Backend condition | UI copy |
|---|---|
| inactive work kind | `Loại nghiệp vụ này đã ngừng sử dụng. Hãy chọn loại khác.` |
| invalid input | `Dữ liệu gửi lên chưa hợp lệ. Kiểm tra lại các trường được đánh dấu.` |
| assignment forbidden | `Bạn không có quyền giao công việc này.` |
| metadata forbidden | `Bạn không có quyền chỉnh sửa thông tin nghiệp vụ.` |
| no Journalism detail | `Không tìm thấy thông tin nghiệp vụ báo chí.` |
| planned date locked | `Thời gian dự kiến xuất bản đã được khóa ở trạng thái này.` |
| scheduled date missing | `Cần nhập thời gian dự kiến xuất bản để lên lịch.` |
| invalid transition / same-state | `Trạng thái xuất bản hiện tại không cho phép thao tác này.` |
| invalid URL | `URL phải là địa chỉ http/https hợp lệ, không chứa thông tin đăng nhập.` |
| missing withdrawal reason | `Vui lòng nhập lý do gỡ bài.` |
| 409 conflict | `Trạng thái xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại.` |
| unexpected failure | `Không thể hoàn tất thao tác. Vui lòng thử lại.` |

For `409`, do not retry blindly: show the conflict message, `router.refresh()`, and recompute available actions. Disable the triggering control while a request is pending, show `Đang lưu…`/`Đang xử lý…`, then refresh only after server success.

## K. Mobile and responsive behavior

- Preserve the current `lg` desktop/table breakpoint and existing card fallback below it.
- Stack Journalism detail rows and mutation controls vertically on narrow screens.
- Keep all primary controls at least 44px high; do not rely on icon-only controls.
- Dialogs use the existing fixed backdrop, `max-h`, internal scroll, Escape handling, focus-on-open, and viewport padding patterns.
- Long URLs and editorial notes wrap; no horizontal overflow.
- Filters collapse into the existing mobile `<details>` filter panel; Journalism controls follow the dependency rules above.

## L. Accessibility

- Every form field has a visible Vietnamese label and a field-level error/helper message.
- Dialogs use `role=dialog`, `aria-modal`, labelled headings, focus placement, Escape close, and clear Cancel/primary buttons.
- Status is communicated by text and badge label, not color alone; publication and Task statuses have distinct headings/labels.
- Icon-only controls require accessible names; decorative icons use `aria-hidden`.
- Keyboard users can reach every filter, action, confirmation, and link; focus is not trapped behind sticky headers.
- Error summaries are announced with `role=alert`; success feedback uses the existing polite status toast.
- Respect existing reduced-motion preference and avoid layout-shifting transitions.

## M. Vietnamese copy

Labels: `Nghiệp vụ báo chí`, `Loại nghiệp vụ`, `Trạng thái xuất bản`, `Dự kiến xuất bản`, `Đã xuất bản lúc`, `URL bài đã xuất bản`, `Địa điểm`, `Ghi chú biên tập`.

Statuses: `Chưa xuất bản`, `Đã lên lịch`, `Đã xuất bản`, `Đã gỡ`.

Actions: `Tạo công việc nghiệp vụ báo chí`, `Chỉnh sửa thông tin`, `Lên lịch xuất bản`, `Hủy lịch xuất bản`, `Đánh dấu đã xuất bản`, `Gỡ bài`.

## N. Component reuse map

| J4 surface | Reuse target |
|---|---|
| create entry/form | `TaskAssignShell.tsx`, `Field`, `CheckGroup`, `ActionFeedbackProvider` |
| list indicator/filters | `TaskCenterShell.tsx`, `FilterFields`, `taskFilters.mjs`, `taskListHref` |
| detail card/actions | `TaskDetailShell.tsx`, `Section`, `Item`, existing header action row |
| edit/schedule/publish/withdraw dialogs | `TaskDetailModal.tsx` dialog/focus/backdrop conventions; native controls |
| feedback/errors | `ActionFeedbackProvider.tsx`, `actionFeedback.ts` |
| data | `TaskListDto` / `TaskDetailDto` Journalism fields, server repository |

No shared generic design framework is needed. Candidate new components are listed below only where repeated Journalism behavior would otherwise make `TaskDetailShell` too large.

## O. Narrow new component proposal

- `JournalismTaskSection`: read-only detail card plus permission-aware control slots.
- `PublicationStatusBadge`: one text mapping with a distinct publication color family and accessible label.
- `JournalismMetadataForm`: controlled four-field form used by the metadata dialog.
- `PublicationActionMenu` or `PublicationActions`: state-machine action selection and dialogs.
- `JournalismFilters`: filter controls that serialize through existing `TaskListQuery`/`taskListHref`.

Keep these components local to Journalism and avoid a generic workflow framework.

## P. API-client plan

- Create: `fetch("/api/tasks/journalism/assign", { method: "POST", headers: { "content-type": "application/json" }, body })`.
- Metadata: `PATCH /api/tasks/{id}/journalism` with only the four approved fields.
- Publication: `POST /api/tasks/{id}/journalism/publication` with only the state-specific payload.
- Use same-origin browser fetch with the existing session cookie; do not call Supabase tables/RPCs from browser code and do not expose service-role credentials.
- Use `responseErrorMessage` for safe error mapping, disable controls while pending, then `router.refresh()` after server confirmation.
- No one-request-per-row fetch: list DTO summary and detail DTO already compose Journalism data.

## Q. Performance

- Render Journalism summary from the existing list DTO; no N+1 fetch.
- Render detail from the existing Task detail DTO; no separate Journalism detail request.
- Filters remain server-side and preserve exact count/pagination/order.
- Only mutation controls issue network requests.

## R. Security

- Client visibility is not authorization; J3 API/RPC checks remain authoritative.
- No service-role access, secrets, direct table writes, or direct RPC calls in client code.
- Article URLs are rendered as safe external links, not HTML.
- Audit payloads are not rendered raw; only approved human-readable events may appear.
- Effective permission helpers are preferred over brittle role-name checks.

## S. Test plan

### List/detail

- Normal Task unchanged; Journalism indicator/status labels correct; inactive historical work kind displays with `Ngừng sử dụng`; empty Journalism card absent on normal Tasks.
- Filters serialize/restore through URL; back/forward works; type dependency is exact; server count/pagination/order are preserved; no client-side post-pagination filtering.

### Create

- Explicit normal vs Journalism choice; work kind required; only active kinds selectable; normal form has no Journalism requirement; recurrence unavailable; loading prevents double submit; safe backend errors.

### Metadata

- Permission-aware button; only four allowed fields; article URL/status/published time absent; planned-date lock rules; inactive historical kind readable but inactive replacement rejected.

### Publication

- Only valid next action shown; schedule date required; URL policy; cancel schedule clears date; withdraw reason validation; 409 refreshes without blind retry; reporters/staff see no publication action.

### Security/regression/responsive

- UI mismatch cannot bypass backend; anonymous/unauthorized behavior maps safely; normal Task list/detail/create and RBAC/modules regressions remain green; mobile dialogs, long URLs/notes, keyboard focus, and 44px controls are covered.

## T. Implementation phases

Recommend separate commits/checkpoints on one isolated J4 branch:

1. `J4B-1`: read-only list/detail indicator, Journalism card, filters, DTO characterization.
2. `J4B-2`: explicit Journalism create entry/form and create API client.
3. `J4B-3`: metadata edit form and state-lock behavior.
4. `J4B-4`: publication action state machine and dialogs.
5. `J4B-5`: integrated regression, responsive/accessibility polish, production-safe build gate.

Each slice should have focused tests, TypeScript/lint/build checks, and owner review before the next slice. No production activation is implied by a J4B code checkpoint.

## U. Textual wireframes

### Create

```text
[GIAO VIỆC]
[ Công việc thường ] [ Công việc nghiệp vụ báo chí ]

[Tên công việc] [Phòng ban] [Cách chọn người]
[Yêu cầu] [Người thực hiện] [Người duyệt] [Hạn hoàn thành]

[Nghiệp vụ báo chí]
  Loại nghiệp vụ *       [Bài viết v]
  Dự kiến xuất bản        [dd/mm/yyyy] [hh:mm]
  Địa điểm                [................]
  Ghi chú biên tập       [................]
  Trạng thái ban đầu: Chưa xuất bản

                         [Tạo công việc nghiệp vụ báo chí]
```

### List

```text
[Bộ lọc] Loại công việc [Tất cả v] Loại nghiệp vụ [...] Trạng thái [...]

Tên công việc                 Hạn        Trạng thái
Bài phỏng vấn · [Nghiệp vụ báo chí] [Bài viết] [Đã lên lịch]
                              20/09      Chưa hoàn thành
```

### Detail

```text
[Task header] [Task status] [Priority]

[Nghiệp vụ báo chí]                 [Chỉnh sửa thông tin]
  Loại nghiệp vụ        Bài viết
  Trạng thái xuất bản   Đã lên lịch
  Dự kiến xuất bản      20/09/2026 09:00
  Địa điểm              Hà Nội
  Ghi chú biên tập      ...
  [Hủy lịch xuất bản] [Đánh dấu đã xuất bản]

[Yêu cầu công việc] [Đính kèm] [Trao đổi] [Lịch sử]
```

### Publication dialogs

```text
[Lên lịch xuất bản]
  Thời gian dự kiến * [date] [time]
  [Hủy] [Lên lịch xuất bản]

[Đánh dấu đã xuất bản]
  URL bài đã xuất bản * [https://...]
  URL sẽ không thể sửa ở phiên bản hiện tại.
  [Hủy] [Xác nhận đã xuất bản]

[Gỡ bài]
  URL hiện tại: https://...
  Lý do gỡ bài * [................]
  [Hủy] [Gỡ bài]
```

## V. Owner decisions

1. **Creation entry placement** — Option A: two explicit choices inside `/tasks/assign` (recommended; preserves the existing mental model). Option B: separate `/tasks/journalism/new` page (cleaner isolation but duplicates navigation/form conventions).
2. **Planned time in list** — Option A: show only in expanded/mobile Journalism summary (recommended; protects table density). Option B: add a dedicated column (more discoverable but harms existing table width).
3. **Publication controls** — Option A: state-aware action menu (recommended when multiple actions exist). Option B: visible buttons in the existing header action row (more discoverable; can crowd mobile).
4. **Audit visualization** — Option A: include Journalism events in existing `Lịch sử` only if the existing safe history DTO can expose them (recommended). Option B: defer audit visualization to a later checkpoint (lower J4 scope/risk).

No decision blocks the documentation checkpoint. These choices should be confirmed before the corresponding J4B slice.

## W. Non-goals

CMS connector/integration, article editor, Topics, Series, media-library redesign, recurrence, notifications, KPI, AI, dashboard redesign, permission editor, post-publication URL correction, and normal Task → Journalism conversion are explicitly excluded.
