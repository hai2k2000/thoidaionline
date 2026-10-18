# CP2-B Legacy RLS Hardening Proposal

## Finding

`task_quick_report_idempotency` is created by `20261001090000_quick_report_task_v1.sql`, after the general backend hardening migration `20260901095000_backend_security_hardening.sql`. The table therefore retains the default table grants in the isolated baseline. The quick-report RPC is later revoked from client roles and granted to `service_role`, but the table itself is not revoked. In the disposable database, PostgREST returned HTTP 200 for an anon `SELECT` and service-role `SELECT`.

## Proposed additive remediation (owner approval required)

```sql
begin;
revoke all on table public.task_quick_report_idempotency from public, anon, authenticated;
grant select, insert, update, delete on table public.task_quick_report_idempotency to service_role;
notify pgrst, 'reload schema';
commit;
```

This proposal does not enable RLS without policies, does not change production, and does not alter the RPC contract. Before production use, run a disposable compatibility test covering: quick-report create, idempotent replay, concurrent request conflict, anon PostgREST denial, authenticated PostgREST denial, and service-role RPC success. The existing `task_quick_report_idempotency` rows contain request hashes and task IDs, so broad client table access is unnecessary.

Status: `OWNER_REQUIRED`; not applied in CP2-B.
