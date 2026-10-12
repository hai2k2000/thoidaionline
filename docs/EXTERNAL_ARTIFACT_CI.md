# External Artifact CI (Phase 1)

GitHub Actions workflow `.github/workflows/production-artifact.yml` is the only Phase 1 build path for a production-shaped artifact. It installs dependencies, runs focused checks, TypeScript, ESLint, route validation, the production-like Next build, standalone packaging, provenance/checksum verification, and static secret scanning.

The uploaded artifact is immutable and contains no runtime environment files or production credentials. Its `.release-meta` uses `env_model=runtime-injected`; the deployment host supplies `.env.local` and `.env.production` only during an explicitly approved activation.

Required artifact files:

- `.release-meta` with commit, branch, build, source worktree, integration baseline, artifact type, and lifecycle fields.
- `.artifact-manifest.json` and `.artifact-manifest.sha256` containing file-level SHA-256 evidence.
- `RELEASE_BASELINE_COMMIT`, `required-route-manifest.json`, and `MIGRATION_REFERENCE`.

The VPS handoff command is verify-only by default:

```bash
bash scripts/production/deploy-external-artifact.sh /absolute/artifact/path <40-char-source-sha>
```

The existing deployment gate re-verifies the artifact before and after copying, requires the source and metadata SHA values to match, and fails closed below the 20 GiB free-space floor after estimated headroom. Runtime env is linked only inside that gate at activation time.

Activation is intentionally separate and requires the existing deployment gate plus an explicit approval variable. Phase 1 does not activate a release, apply a migration, restart production, or run retention APPLY.
