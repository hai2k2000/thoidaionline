# RBAC V2 controlled deployment exception

This is a one-time, fail-closed exception for the approved RBAC V2 rollout only. It does not change the normal deployment path and it does not make authenticated smoke pass.

## Approval contract

The owner must create a root-owned mode `0600` JSON file outside the release artifact. The file is consumed by the activation gate and cannot be reused. Its `approved_commit` must equal the exact full SHA in the artifact metadata.

```json
{
  "schema_version": 1,
  "exception_id": "rbac-v2-smoke-waiver-YYYYMMDD",
  "approval_scope": "rbac-v2-authenticated-smoke-waiver",
  "owner_approved": true,
  "approved_commit": "<full canonical artifact SHA>",
  "approved_by": "<owner-id>",
  "approval_reference": "<owner approval reference>",
  "approved_at": "<ISO-8601 timestamp>",
  "expires_at": "<short ISO-8601 expiry>",
  "evidence_reference": "<change/evidence reference>"
}
```

The approval must be private, root-owned, not expired, not from the future, and scoped exactly as shown. The exception flag is never enabled by CI and must be set explicitly for the single approved activation. A wrong SHA, missing field, expired approval, reused file, or unsafe field fails closed.

## Gates that remain mandatory

Artifact provenance/checksum, backup and disposable restore, migration ledger/checksum, grants parity and last `permission.manage` manager, schema/RPC checks, database and application rollback compatibility, disk budget, deploy lock, systemd/HTTP health, release pointers, and recovery evidence all remain required. The waiver is consumed only after the rollback target gate passes and before release mutation.

## Evidence and manual acceptance

The gate writes a secret-free evidence file containing `AUTHENTICATED_SMOKE=WAIVED` and `approval_state=CONSUMED`. It must never be reported as smoke `PASS`. After activation, the owner must manually verify login, Permission Management, Role Matrix, User Overrides, effective permissions, explicit deny behavior, and the last `permission.manage` manager. `/login` HTTP 200 alone is not acceptance. If manual checks fail, use the verified compatibility-gated recovery procedure; do not improvise a database rollback.

Normal deployments still require the existing cookie/bearer authenticated contract and browser smoke. This exception is not a general bypass and is not enabled by the workflow.
