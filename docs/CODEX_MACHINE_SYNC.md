# Codex Sync Between Windows Machines

Use GitHub as the source archive and version-control record. For Thời Đại Work, the canonical VPS-FIRST build runs on the authorized VPS source workspace; do not copy local `.codex` state, credentials, `.env` files, `node_modules`, `.next`, backups, or runtime artifacts between machines.

1. On the source machine, commit and push the task branch.
2. On the other machine, fetch and create/update the same `codex/*` branch from GitHub.
3. Read repository `AGENTS.md` and the linked RuleCodex policy before editing.
4. Continue from the pushed commit; keep unrelated local work and `ops/` untracked files untouched.
5. Push follow-up commits so the next machine can resume from GitHub.

GitHub Actions is optional for Thời Đại Work and is not a deploy prerequisite. The VPS builds and verifies its own immutable release; production receives no external artifact transfer.
