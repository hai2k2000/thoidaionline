# Local Artifact Deployment

`scripts/production/local-deploy.sh` is the standard build and transfer path. It installs dependencies, runs focused checks, TypeScript, ESLint, route validation, the production-like Next build, standalone packaging, provenance/checksum verification, and static secret scanning on the local build machine.

From a clean local checkout of the repository:

```bash
export NEXT_PUBLIC_SUPABASE_URL='(approved public URL)'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='(approved public anon key)'
THOIDAI_TARGET_COMMIT=399cb505f341ee9a5b4185b87ba39a6306b2d3cd bash scripts/production/local-deploy.sh --verify-only
```

The script creates a detached worktree from the canonical remote branch, never builds from a dirty VPS checkout, preserves hidden artifact metadata, verifies the archive checksum after transfer, and leaves production unchanged in verify-only mode. SSH uses the configured identity and strict host-key checking.

Artifacts produced by the local command are immutable handoff directories and contain no runtime environment files or production credentials. A production candidate must be built from the approved canonical commit with valid public Supabase configuration (`build_config=canonical-public`); runtime secrets remain injected only at activation time. Manually-run GitHub Actions artifacts are not required and are not an activation dependency.

Required artifact files:

- `.release-meta` with commit, branch, build, source worktree, integration baseline, artifact type, and lifecycle fields.
- `.artifact-manifest.json` and `.artifact-manifest.sha256` containing file-level SHA-256 evidence.
- `RELEASE_BASELINE_COMMIT`, `required-route-manifest.json`, and `MIGRATION_REFERENCE`.

The local handoff command is verify-only by default:

```bash
bash scripts/production/local-deploy.sh --verify-only
```

The existing deployment gate re-verifies the artifact before and after copying, requires the source and metadata SHA values to match, and fails closed below the 20 GiB free-space floor after estimated headroom. Runtime env is linked only inside that gate at activation time.

Activation is intentionally separate and requires the existing deployment gate plus explicit approval variables. GitHub Actions is retained only as a manually-triggered historical/regression workflow; it is not required for build, transfer, verification, or activation.
