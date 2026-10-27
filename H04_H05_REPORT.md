# H-04 + H-05 Report

## Files changed

- `AGENTS.md`
- `PROJECT_STATUS.md`
- `docs/VPS_FIRST_DEPLOYMENT.md`
- `docs/EXTERNAL_ARTIFACT_CI.md`
- `scripts/package-standalone.mjs`
- `scripts/package-standalone.test.mjs`
- `scripts/production/deploy-gate.sh`
- `scripts/production/deploy-external-artifact.sh`
- `scripts/production/deploy-gate-fixture.test.sh`
- `scripts/production/vps-first-contract.test.sh`
- `scripts/external-artifact-contract.test.mjs`

## Gate behavior

| Artifact | Before | After |
| --- | --- | --- |
| high + `missing-or-invalid` | accepted by the gate | blocked before mutation |
| high + `automated-tests-pass` | accepted | accepted |
| low + missing evidence | blocked by the main gate only | blocked by both gates |
| low + `automated-tests-pass` | accepted | accepted |

Packaging runs an explicit auth/RBAC/migration-related Node test set before creating the artifact or writing `automated-tests-pass`. Authenticated smoke remains optional. The already-running production release is unchanged; the stricter gate applies on the next deployment. The selected tests add approximately 0.5 seconds in this local run (excluding build time).

## Validation

- `node --test scripts/standalone-packaging.test.mjs src/lib/anonAccessLockdown.test.mjs` — PASS (14/14).
- `node --test scripts/package-standalone.test.mjs` — PASS (3/3).
- Related risk/deploy contracts — PASS (16/16).
- `bash scripts/production/deploy-gate-fixture.test.sh` — SKIP on Windows (POSIX symlink semantics unavailable).
- `bash scripts/production/vps-first-contract.test.sh` — PASS.
- `git diff --check` — PASS.
