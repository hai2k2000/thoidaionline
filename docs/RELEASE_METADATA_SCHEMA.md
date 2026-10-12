# Managed Release Metadata Schema

New standalone artifacts use `.release-meta` as a line-oriented `key=value` record. Values must not contain secrets or newlines.

Required provenance fields:

`release_id`, `build_id`, `commit`, `branch`, `local_head`, `remote_head`, `artifact_source_commit`, `metadata_commit`, `integration_branch`, `integration_baseline`, `source_worktree`, `created_at`, `artifact_type`, `canonical_baseline`, `artifact_bytes`, `env_model`, `build_config`.

Required lifecycle fields:

`protection=managed`, `rollback_eligible=yes`, `health_status=pending`, `deploy_status=pending`, `deployed_at=`, `rollback_role=unassigned`.

`env_model=runtime-injected` is mandatory for external CI artifacts. Legacy releases with missing or older metadata remain `UNKNOWN`; Phase 1 does not backfill or delete them. Retention must preserve current, previous, rollback-1, rollback-2, references, evidence, `.keep`, and UNKNOWN records, with a seven-day grace period for managed historical releases.

`build_config=ci-placeholder` identifies the non-production CI artifact and is never activation-eligible. Only `build_config=canonical-public`, built from the approved canonical commit with valid public Supabase configuration, may cross the activation boundary. This distinction is required because `NEXT_PUBLIC_*` values are embedded during the Next.js build.

Artifact consumers must fail closed when provenance SHAs do not match, manifest coverage differs from the artifact tree, a checksum is invalid, or a reference scan cannot prove that a release is unused. The production disk gate defaults to 20 GiB free after estimated headroom.
