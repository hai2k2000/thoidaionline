# Unrelated Migration Classification + Scoped Apply Report

- Unrelated total: 56
- `FUTURE_FEATURE`: 0
- `ABANDONED_OR_SUPERSEDED`: 0
- `SCHEMA_EFFECT_ALREADY_PRESENT_BUT_LEDGER_MISSING`: 0 proven
- `UNKNOWN`: 56

Every local-only migration is retained as `UNKNOWN`: production ledger absence alone cannot prove whether its schema/data effect is already present or genuinely pending. No migration replay, ledger mutation, or production DDL/DML was used to resolve that ambiguity.

Approved migration dependency review: `YES` for dependencies existing in the current schema; `NO` direct dependency on any local-only migration. This does not remove the unrelated-history blocker.

Scoped bundle: NOT CREATED. Creating a 91-file bundle while 56 versions remain UNKNOWN would falsely represent production history and is therefore blocked.

Runner scoped preflight: NOT RUN in apply mode; no safe status proof exists until UNKNOWN classifications are resolved.

Production changed: NO

SAFE SCOPED APPLY METHOD IDENTIFIED: NO
SAFE TO RESUME GLOBAL MUTATION DEPLOY: NO

## 56 Unrelated Rows

| Version | File | Introducing commit | Classification |
|---|---|---|---|
| 20260826200000 | `20260826200000_harden_direct_assignment.sql` | `d4e44bcb1193` | `UNKNOWN` |
| 20260826210000 | `20260826210000_task_workflow_hardening.sql` | `a81e84d0e874` | `UNKNOWN` |
| 20260827160000 | `20260827160000_require_task_score_before_done.sql` | `9b5b086c5a75` | `UNKNOWN` |
| 20260829100000 | `20260829100000_require_fresh_task_score.sql` | `ba643f29f1b0` | `UNKNOWN` |
| 20260829110000 | `20260829110000_strict_fresh_task_score.sql` | `b47cc624e423` | `UNKNOWN` |
| 20260829120000 | `20260829120000_sync_progress_on_completion.sql` | `e19f6480d062` | `UNKNOWN` |
| 20260829130000 | `20260829130000_harden_admin_task_edit.sql` | `3ff73979e4b1` | `UNKNOWN` |
| 20260830100000 | `20260830100000_fix_leadership_assignment_scope.sql` | `831e11af03c9` | `UNKNOWN` |
| 20260830120000 | `20260830120000_revalidate_recurrence_membership.sql` | `579e739b4645` | `UNKNOWN` |
| 20260901095000 | `20260901095000_backend_security_hardening.sql` | `623166dc14cf` | `UNKNOWN` |
| 20260909110000 | `20260909110000_attendance_sync.sql` | `0e94b4ffc123` | `UNKNOWN` |
| 20260909121500 | `20260909121500_seed_online_work_september.sql` | `75a16cdf3d6b` | `UNKNOWN` |
| 20260909143000 | `20260909143000_allow_hongninh_duty_editor.sql` | `9ecd6fc2a149` | `UNKNOWN` |
| 20260909170000 | `20260909170000_three_position_duty_roster.sql` | `4cde0656485b` | `UNKNOWN` |
| 20260910090000 | `20260910090000_leave_requests.sql` | `c2ca305e6a76` | `UNKNOWN` |
| 20260910150000 | `20260910150000_long_leave_tbt_approval.sql` | `542c31c8fd92` | `UNKNOWN` |
| 20260911083000 | `20260911083000_fix_first_login_default_password.sql` | `798d0221e155` | `UNKNOWN` |
| 20260911110000 | `20260911110000_enable_deputy_department_assignment.sql` | `f90974c645ec` | `UNKNOWN` |
| 20260911133000 | `20260911133000_scope_leave_review_to_department.sql` | `64dbd0462dbb` | `UNKNOWN` |
| 20260911150000 | `20260911150000_lock_task_completion_scores.sql` | `70052592046c` | `UNKNOWN` |
| 20260911170000 | `20260911170000_atomic_attendance_completion.sql` | `c49a7554a7fd` | `UNKNOWN` |
| 20260911180000 | `20260911180000_align_deputy_assignment_reviewer.sql` | `ec7327bc0701` | `UNKNOWN` |
| 20260911190000 | `20260911190000_enforce_first_login_password_change.sql` | `65f4ed2f2272` | `UNKNOWN` |
| 20260911230000 | `20260911230000_atomic_attendance_log_merge.sql` | `7d6a18051945` | `UNKNOWN` |
| 20260915120000 | `20260915120000_personal_work_plans.sql` | `52a0c12cb3e4` | `UNKNOWN` |
| 20260916100000 | `20260916100000_phase1a_rbac_core.sql` | `67bdb9786fcd` | `UNKNOWN` |
| 20260916103000 | `20260916103000_phase1a_rbac_db_helper.sql` | `25b76412c6cc` | `UNKNOWN` |
| 20260916104500 | `20260916104500_phase1a_rbac_compatibility_completion.sql` | `25b76412c6cc` | `UNKNOWN` |
| 20260917200000 | `20260917200000_org_rbac_r2_tbt_label.sql` | `13067f564cd7` | `UNKNOWN` |
| 20260918100000 | `20260918100000_journalism_tasks_j2_schema.sql` | `3957d0b005ba` | `UNKNOWN` |
| 20260918120000 | `20260918120000_journalism_tasks_j3_mutations.sql` | `8841fb388465` | `UNKNOWN` |
| 20260918130000 | `20260918130000_journalism_topics_series_j5_read.sql` | `258ca393f829` | `UNKNOWN` |
| 20260918140000 | `20260918140000_journalism_topics_series_j5_management.sql` | `539b671e34df` | `UNKNOWN` |
| 20260918150000 | `20260918150000_journalism_topics_series_j5_associations.sql` | `fca071cb1fb5` | `UNKNOWN` |
| 20260919110000 | `20260919110000_journalism_manual_publication_reporting.sql` | `c8fbfef63d70` | `UNKNOWN` |
| 20260919120000 | `20260919120000_journalism_publication_verification.sql` | `664fd6232ab2` | `UNKNOWN` |
| 20260921150000 | `20260921150000_event_assignment_v1.sql` | `3e84274d9a52` | `UNKNOWN` |
| 20260922120000 | `20260922120000_journalism_content_department_scope.sql` | `3b228fa14bbb` | `UNKNOWN` |
| 20260922123000 | `20260922123000_journalism_department_code_alignment.sql` | `50359024fdd6` | `UNKNOWN` |
| 20260922130000 | `20260922130000_journalism_manual_publication_reconciliation.sql` | `2a1ecf59bea1` | `UNKNOWN` |
| 20260923110000 | `20260923110000_journalism_scope_hardening.sql` | `cdf9805ca033` | `UNKNOWN` |
| 20260923150000 | `20260923150000_journalism_admin_scope.sql` | `890c4d1508eb` | `UNKNOWN` |
| 20260924100000 | `20260924100000_attendance_reconciliation.sql` | `3e18b8429161` | `UNKNOWN` |
| 20260924120000 | `20260924120000_task_approval_gates.sql` | `620dc692d66c` | `UNKNOWN` |
| 20260924130000 | `20260924130000_task_assignment_semantics.sql` | `b90d244e4876` | `UNKNOWN` |
| 20260925100000 | `20260925100000_journalism_self_registration.sql` | `16e90485beb9` | `UNKNOWN` |
| 20260925110000 | `20260925110000_task_assignment_batch_idempotency.sql` | `4bc62e6f3c5b` | `UNKNOWN` |
| 20260925111000 | `20260925111000_task_assignment_batch_rpc.sql` | `440f59ef9d09` | `UNKNOWN` |
| 20260926140000 | `20260926140000_department_plans_v2.sql` | `97d02dd7bbd8` | `UNKNOWN` |
| 20260926150000 | `20260926150000_department_plan_to_task_v1.sql` | `d35651d5c60f` | `UNKNOWN` |
| 20260926160000 | `20260926160000_department_plan_assignment_v2.sql` | `d5b227a187f5` | `UNKNOWN` |
| 20260928140000 | `20260928140000_tbt_any_assignee.sql` | `12b2f97e0ae1` | `UNKNOWN` |
| 20260928140100 | `20260928140100_tbt_recurrence_without_manager.sql` | `12b2f97e0ae1` | `UNKNOWN` |
| 20260928160000 | `20260928160000_admin_edit_cancel_after_approval.sql` | `6f47cfc3c274` | `UNKNOWN` |
| 20260928160100 | `20260928160100_task_deadline_admin_override.sql` | `6f47cfc3c274` | `UNKNOWN` |
| 20260928160200 | `20260928160200_personal_deadline_approval_guard.sql` | `ddc1d90cf30b` | `UNKNOWN` |
| 20260930100000 | `20260930100000_global_creator_mutation_policy.sql` | `bb8d5a6be344` | `UNKNOWN` |
| 20260930110000 | `20260930110000_global_task_creator_mutation_policy.sql` | `bb8d5a6be344` | `UNKNOWN` |
| 20260930120000 | `20260930120000_global_mutation_cancelled_admin_guard.sql` | `bb8d5a6be344` | `UNKNOWN` |
