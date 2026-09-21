# Event Assignment v1 Design

## Objective

Add a lightweight leadership workflow named "Phan cong su kien" for press conferences, conferences, field work, and similar events. A leadership user creates one organization event and assigns one or more active reporters directly; the event is effective immediately and never creates a full Task.

## Architecture

Reuse `public.work_schedules` as the calendar parent because existing calendar readers already understand date ranges, local times, organization scope, `created_by`, and `participant_ids`. Add an explicit leadership-event discriminator and status columns, plus a normalized `work_schedule_event_assignments` relation. The relation is authoritative for assignment integrity; `participant_ids` is maintained server-side as a compatibility projection for existing calendar readers.

Do not reuse Personal Plan approval columns. Existing organization schedule APIs remain unchanged; Event Assignment uses `/api/work-schedule/events` and dedicated security-definer RPCs.

## Data Model

Add nullable columns to `work_schedules`: `event_assignment_kind` (`leadership` when non-null), `event_type`, `creator_department_id`, and `event_status` (`SCHEDULED`, `COMPLETED`, `CANCELLED`). Leadership-event rows must use `schedule_scope='organization'`, `plan_type='event'`, `approval_status='APPROVED'`, and a server-derived creator department. Existing rows remain unchanged.

Create `work_schedule_event_assignments` with `id`, `event_id`, `staff_id`, `assigned_by`, `assigned_at`, and optional `note`. Enforce unique `(event_id, staff_id)` and foreign keys. Add indexes for event, reporter, date, and status. Do not change Task, Online Work, or Personal Plan tables.

## Authorization And Scope

- `admin`, `tong_bien_tap`, and `pho_tong_bien_tap` have global scope.
- A job title exactly equal to `truong_phong` may create and manage events in the actor's department.
- `pho_truong_phong` is excluded from v1.
- Reporters must be active and have a job title code beginning `phong_vien`, with the existing `phong_vien` role as fallback.
- Department managers may assign only reporters in their department; global roles may assign qualified reporters globally.
- Creator, creator department, `assigned_by`, participant projection, status, and approval fields are server-derived.
- Reporters cannot create, update, cancel, complete, or self-assign leadership events.

Update and status RPCs lock the event row, require the expected `workflow_revision`, and re-check creator/global authorization. Duplicate reporter ids are rejected before insert and protected by the unique constraint.

## State And Validation

New events start `SCHEDULED` and are immediately visible. Allowed transitions are `SCHEDULED -> COMPLETED` and `SCHEDULED -> CANCELLED`; terminal events are not reopened in v1.

Require title, event type, valid local `YYYY-MM-DD`, required `HH:mm`, and combined local end datetime strictly after start using the existing civil-date helper. Multi-day events are allowed. At least one and at most 50 reporters are required. Limits: title 500, event type 100, location 500, note 2000 characters.

## Calendar And UI

Leadership pages expose `Tao su kien / Phan cong su kien` with event type, title, start/end date and time, location, note, and active-reporter multi-select. Leadership cards show reporters and status controls. Reporter calendars merge assigned organization events into the personal view and display `Duoc phan cong`, assigner, location, description, and status. There is no reporter acceptance flow.

## Audit

Write `audit_logs` actions `create_event`, `update_event`, `assign_reporter`, `unassign_reporter`, `cancel_event`, and `complete_event`, including actor, event, affected reporter, timestamp, and before/after JSON where applicable.

## Compatibility And Rollback

The migration is additive and leaves existing organization schedules, Personal Plan approval RPCs, Online Work, Tasks, and J6 unchanged. Application rollback can restore the previous artifact; the additive migration is not automatically reversed.

## Acceptance Matrix

Tests cover creator roles and department scope, cross-department denial, global assignment, ordinary reporter denial, participant spoofing, duplicate assignments, assigned and unrelated visibility, local date/time validation, update/cancel authorization, audit actions, organization baseline preservation, Personal Plan isolation, Online Work isolation, and no Task creation.
