# Worktree Lifecycle Operational Rule

Normal feature, recovery, build, and deploy work must not call `git worktree add` directly.

Use:

```bash
scripts/ops/worktree-lifecycle.sh create /opt/worktrees/<name> <branch> <purpose>
scripts/ops/worktree-lifecycle.sh status /opt/worktrees/<name>
scripts/ops/worktree-lifecycle.sh close /opt/worktrees/<name>
```

`deploy-release.sh` refuses unmanaged source worktrees. It accepts only explicit exceptions for the immutable build source or the verified production checkout. Unknown or copied lifecycle metadata fails closed. Existing worktrees are not auto-adopted; run `scripts/ops/worktree-adoption-audit.sh` and review each path before adding metadata.