# JOURNALISM J2P Runtime Environment Report

## Status

**AUDIT COMPLETE / NO PRODUCTION CHANGE**

J2P-E1 inspected the approved source commit and both release paths without restarting or deploying production. The failed J2 candidate was missing the release-local environment symlinks used by the working R3 release. An isolated candidate preflight was run on port `3102` using the existing protected production env source and passed (`/login=200`, protected `/api/tasks=401`).

## A. Runtime Environment Contract

Derived from `fad1124cad189a8e10e7f3aa1a07631e8ac31f72`:

| Variable | Classification | Required/optional |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public build/runtime | required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public build/runtime | required for browser Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime server-only | required for protected server Supabase client |
| `SESSION_SECRET` | runtime server-only | required; minimum 32 characters |
| `TASK_RBAC_V2_ENABLED` | runtime server-only feature flag | optional; defaults legacy/off when absent or invalid |
| `NEXT_PUBLIC_SITE_URL` | public runtime | optional for password-reset links |
| `ROLE_LIFECYCLE_ENABLED` | runtime server-only feature flag | optional |
| `TBT_DIRECT_EVALUATION_ENABLED` | runtime server-only feature flag | optional |
| `HR_UPLOAD_DIR` | runtime server-only path override | optional |
| `ATTENDANCE_BRIDGE_TOKEN` | runtime server-only | optional route-specific |
| `ATTENDANCE_DEVICE_ID` | runtime server-only | optional |
| `RECURRENCE_RUNNER_SECRET` | runtime server-only | optional job-specific |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | runtime server-only | optional notification integration |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` | runtime server-only | optional notification/password-reset integration |

No server-only variable is referenced from `.next/static` in the artifact scan.

## B. Working R3 Delivery

The active R3 release receives environment through Next.js release-local files:

- `.env.local -> /opt/thoidai-work/.env.local`
- `.env.production -> /opt/thoidai-work/.env.production`
- Both protected files are `root:thoidai-work`, mode `0640`.
- The service runs as `thoidai-work`; it can read the protected files through group permission.
- Systemd does not use `EnvironmentFile`; it provides only non-secret baseline variables and feature flags.

Required variable presence in the active process: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SECRET` = **PRESENT**, delivered by release-local symlinks resolved to `/opt/thoidai-work/`.

## C. Failed J2 Delivery

The failed J2 candidate had no `.env.local` or `.env.production` files. It therefore received only systemd variables (`NODE_ENV`, `PORT`, `HOME`, cache path, lifecycle flags, and `TASK_RBAC_V2_ENABLED`). The required Supabase service key and session secret were absent from the process.

## D. Exact Root Cause

Root cause is **B + D**:

1. The clean-release construction did not create the two environment symlinks present in R3.
2. Next.js server runtime loads the protected env files relative to the active release/working directory; systemd did not export the server secrets separately.

Evidence: R3 has both symlinks targeting `/opt/thoidai-work`; the J2 candidate has neither. Running the same candidate with the existing protected env files supplied before `next start` passed the protected route preflight on port `3102`. This is not an RBAC or schema defect.

## E. Canonical Mechanism

Use the existing release-independent protected source:

`/opt/thoidai-work/.env.local` and `/opt/thoidai-work/.env.production`

Each clean release should receive root-owned symlinks with the exact names `.env.local` and `.env.production`. Do not copy secret contents into releases. This preserves immutable source directories, reversible WorkingDirectory switching, and the established production convention.

## F-G. Required Retry Changes and Permissions

Before a future retry, create the two symlinks in the candidate release, verify they resolve to `/opt/thoidai-work/`, and verify mode/ownership remains `0640 root:thoidai-work`. Keep systemd `Environment=` limited to non-secret runtime flags. Preserve the existing `ReadWritePaths` entry for the candidate `.next/cache`, and verify writability as `thoidai-work`.

No systemd change is required for the environment fix. A release-construction correction is sufficient. Any future drop-in must remain reversible and must not expose values in logs or command history.

## H. Secret-Leak Prevention

Do not commit, print, log, or copy secret values. Do not place production env files in Git or `.next/static`. The isolated preflight log contained no secret values; only status codes were recorded.

## I. Isolated Preflight

Candidate: `fad1124cad189a8e10e7f3aa1a07631e8ac31f72` on port `3102`, with existing protected env files sourced for the process only.

- server config initialized: PASS
- `/login`: HTTP 200
- protected `/api/tasks`: HTTP 401
- production service port: untouched
- production service restart: none

## J. J2 Schema Health

Read-only production checks:

- `journalism_work_kinds`: present
- `journalism_task_details`: present
- exact 10 active seed rows: present
- `journalism_task_details` rows: `0`
- RLS enabled on both tables: true
- NULL-department tasks: `8`
- permissions: `17`
- grants: `116`
- active/inactive roles: `7 / 6`
- active/inactive departments: `4 / 4`
- canonical grant tuple hash: unchanged from approved baseline (`292d1d5863fe0e3bff05d4a37ce2bd7915eb0656a011a053e67912bfb57af0a6`)

Direct anon/authenticated table denial remains governed by the existing RLS/security configuration; no policy or grant was changed in this checkpoint.

## K. Migration State

- `20260918100000_journalism_tasks_j2_schema.sql` = **APPLIED MANUALLY/PER-FILE TO PRODUCTION**.
- Migration SHA-256 remains `9f707262958fee0f160f5beafb42dbdca302c59b65f7bc9120607d0763f05c45`.
- It is not registered in the migration ledger; it was not replayed or fake-registered here.
- `20260917200000_org_rbac_r2_tbt_label.sql` remains manually applied outside the ledger.
- No `supabase db push`, `supabase db reset`, replay, or ledger repair was performed.

## L. Rollback Design

Current production remains the R3 release:

`/opt/releases/thoidai-work/13067f564cd7c1988e0f189a00d3cac4c5ed8b1d-r3-retry-20260917T170751Z`

Rollback is the existing reversible systemd WorkingDirectory/drop-in switch. `/opt/thoidai-work` was not modified.

## M. Exact Retry Procedure

1. Build a new clean release from the approved fixed commit.
2. Add only the two protected-env symlinks described above.
3. Verify names, targets, owner/group, and mode without printing values.
4. Run `npm ci`, production build, artifact scan, and service-user cache write check.
5. Perform an isolated preflight before touching systemd.
6. Create a fresh backup and activation snapshot.
7. Switch via a new reversible systemd drop-in, keeping `TASK_RBAC_V2_ENABLED=true`.
8. Poll readiness and run the stability window.
9. Run zero-data Journalism reads and approved authenticated smoke.
10. Roll back immediately on any protected-route error; do not drop the additive schema.

## N. Recommendation

**J2P activation retry: NO-GO for this checkpoint.**

The environment root cause is identified and the isolated preflight passes, but this audit explicitly forbids deployment or restart. Wait for owner approval of the release-construction correction and a new controlled J2P activation attempt.
