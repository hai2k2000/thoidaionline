# CP2 Legacy RLS Assessment (Disposable Local Database)

Scope: read-only inspection of the ten legacy tables named by CP2 in the isolated local PostgreSQL stack. No `ALTER TABLE`, policy mutation, production connection, or production migration was used.

| Table | RLS | anon/authenticated table grants | service_role table grants | Finding |
|---|---|---|---|---|
| evaluation_rubric_factors | OFF | none | full table privileges | Server-only path expected |
| evaluation_rubric_versions | OFF | none | full table privileges | Server-only path expected |
| performance_review_scores | OFF | none | full table privileges | Server-only path expected |
| task_attachments | OFF | none | full table privileges | Server-only path expected |
| task_deadline_history | OFF | none | full table privileges | Server-only path expected |
| task_progress_reports | OFF | none | full table privileges | Server-only path expected |
| task_quick_report_idempotency | OFF | full table privileges | full table privileges | Disposable compatibility risk; requires separate policy/compatibility review |
| task_recurrence_occurrences | OFF | none | full table privileges | Server-only path expected |
| task_recurrence_rules | OFF | none | full table privileges | Server-only path expected |
| task_status_events | OFF | none | full table privileges | Server-only path expected |

PostgREST probe evidence: `task_quick_report_idempotency` returned HTTP 200 for both local anon and service-role keys. This is disposable evidence only and must not be inferred as production state. The other nine tables had no anon/authenticated table grants in the inspected baseline. No remediation is included in CP2 because policies and compatibility tests were not approved.
