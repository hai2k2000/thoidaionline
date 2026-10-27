# Thời Đại Work VPS-FIRST

> **Fallback only:** VPS-FIRST is an owner-approved exception when the default local-to-target path cannot be used. See `AGENTS.md` for the canonical RuleCodex 1.2.0 routing and approval gates.

RuleCodex `1.2.0` authorizes this profile only for the Thời Đại Work release family. The VPS is the build and verification target; GitHub remains source archive/version control.

## Flow

1. SSH to `vps-aylaspa` and use a separate source workspace under `/opt/worktrees` or `/opt/build`.
2. Keep the active release under `/opt/releases/thoidai-work/current` untouched while editing, testing and building.
3. Build an immutable standalone release with `scripts/production/deploy-vps-first.sh build <source-root> <absolute-staging-path>`.
4. Verify with `deploy-vps-first.sh verify-only <absolute-staging-path>`. This does not restart services or change release pointers.
5. Obtain one owner approval for the final staging release, then run `deploy-vps-first.sh activate <absolute-staging-path> <release-id>` with `THOIDAI_VPS_DEPLOY_APPROVED=1`.
6. The existing deployment gate keeps the deploy lock, 10 GiB disk floor, runtime-secret isolation, atomic pointers, health checks and automatic rollback.
7. Archive source and evidence to GitHub after the checkpoint; GitHub Actions, PRs, WSL2 and cross-machine lineage are not required for this profile.

## Required VPS configuration

- Node.js 22 and the repository lockfile.
- Public build variables are supplied by the approved VPS build environment; server secrets remain in `/opt/thoidai-work/.env.local` and `.env.production` and are never copied into releases.
- Disk guard config: `/opt/thoidai-work/deploy/disk-guard.conf` (hard floor 10 GiB after headroom).
- Service: `thoidai-work.service`; health: `http://127.0.0.1:3001/login`.
- Release pointers: `current`, `previous`, `rollback-1`, `rollback-2`.

The legacy external-artifact scripts and workflow remain available for historical verification only. They are not the default deployment entry point for this project.
