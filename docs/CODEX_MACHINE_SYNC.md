# Codex Sync Between Windows Machines

Use GitHub as the shared source of truth. Do not copy local `.codex` state, credentials, `.env` files, `node_modules`, `.next`, backups, or runtime artifacts between machines.

1. On the source machine, commit and push the task branch.
2. On the other machine, fetch and create/update the same `codex/*` branch from GitHub.
3. Read repository `AGENTS.md` and the linked RuleCodex policy before editing.
4. Continue from the pushed commit; keep unrelated local work and `ops/` untracked files untouched.
5. Push follow-up commits so the next machine can resume from GitHub.

The local build machine owns dependency installation, tests, packaging, and artifact evidence. GitHub stores and synchronizes source only. The production VPS receives only a verified artifact through the separately approved SSH/WireGuard deployment workflow.
