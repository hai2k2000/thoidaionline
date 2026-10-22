# Thoi Dai Work VPS-FIRST Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt the RuleCodex 1.2.0 `thoidai-work-vps-first` profile without changing production or weakening release safety gates.

**Architecture:** The authorized VPS owns an isolated source workspace, Node.js 22 build and immutable release staging. Existing `deploy-gate.sh` remains the activation primitive for disk guard, lock, atomic pointers, health and rollback; a thin profile-aware wrapper removes only external-artifact/lineage prerequisites.

**Tech Stack:** Next.js standalone, Node.js 22, Bash, systemd, RuleCodex 1.2.0.

**Spec:** Owner task in `C:\Users\hai2k\.codex\attachments\aefa795d-326d-464c-aa4d-cda35642eb45\Pasted text.txt`.

## Global Constraints

- No production activation, restart, migration or cleanup APPLY during this conversion.
- Preserve the 10 GiB disk floor, deploy lock, checksum/provenance, secret isolation, atomic activation, health checks and rollback pointers.
- Preserve modified `AGENTS.md` content and untracked `-C`; never reset, clean or force-push.
- GitHub is source archive/version control only for this profile; WSL2, CI, PR and cross-machine lineage are optional.

### Task 1: Synchronize RuleCodex

**Files:** Managed Codex policy cache and skills only through the official installer.

- [x] Verify RuleCodex `main` resolves to `ad0778f1311a025096df0bf9c3df566590361a65`.
- [x] Run the official migration and sync tools.
- [x] Confirm installed policy `1.2.0` and project conflict report.

### Task 2: Convert project profile and scripts

**Files:** `AGENTS.md`, `package.json`, `scripts/check-release-baseline.mjs`, `scripts/package-standalone.mjs`, `scripts/verify-standalone-artifact.mjs`, `scripts/production/deploy-vps-first.sh`, `scripts/production/vps-first-contract.test.sh`.

- [x] Declare the canonical VPS profile and authorized paths while preserving Next.js-generated instructions.
- [x] Add profile-aware provenance and skip only cross-machine lineage in VPS-FIRST mode.
- [x] Keep `deploy-gate.sh` as the only activation primitive and fail closed for staging, approval and profile metadata.

### Task 3: Update runbooks and verify

**Files:** `docs/VPS_FIRST_DEPLOYMENT.md`, `docs/EXTERNAL_ARTIFACT_CI.md`, `docs/CODEX_MACHINE_SYNC.md`.

- [x] Document the VPS-first flow and mark external artifact CI as legacy compatibility.
- [ ] Run focused contract, TypeScript and packaging checks.
- [x] Run the VPS-FIRST dry-run and confirm production pointers/service are unchanged.

