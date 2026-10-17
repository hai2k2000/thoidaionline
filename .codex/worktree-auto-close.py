#!/usr/bin/env python3
"""Codex lifecycle adapter for the existing worktree cleanup script."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

READY_MARKER = "WORKTREE_AUTO_CLOSE: READY"
PENDING_NAME = "worktree-auto-close.pending"


def run(args: list[str], cwd: str | None = None, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=False, timeout=timeout)


def emit(message: str) -> None:
    print(json.dumps({"systemMessage": message}, ensure_ascii=True))


def repo_paths(cwd: str) -> tuple[Path, Path]:
    worktree = Path(run(["git", "-C", cwd, "rev-parse", "--show-toplevel"]).stdout.strip()).resolve()
    common = Path(run(["git", "-C", cwd, "rev-parse", "--git-common-dir"]).stdout.strip())
    if not common.is_absolute():
        common = (worktree / common).resolve()
    return worktree, common.resolve()


def cleanup_script(repo: Path) -> Path:
    override = os.environ.get("THOIDAI_WORKTREE_CLEANUP_SCRIPT")
    return Path(override) if override else repo / "scripts/production/worktree-cleanup.sh"


def invoke_cleanup(repo: Path, worktree: Path) -> str:
    script = cleanup_script(repo)
    result = run(["bash", str(script), "--repo", str(repo), "--worktree", str(worktree), "--task-complete", "--apply"], cwd=str(repo))
    output = "\n".join(value for value in (result.stdout.strip(), result.stderr.strip()) if value)
    if result.returncode:
        raise RuntimeError(output or f"cleanup exited {result.returncode}")
    return output


def pending_path(common: Path) -> Path:
    return common / PENDING_NAME


def add_pending(common: Path, worktree: Path) -> None:
    target = pending_path(common)
    paths = set(target.read_text(encoding="utf-8").splitlines()) if target.exists() else set()
    paths.add(str(worktree))
    temporary = target.with_name(f".{target.name}.{os.getpid()}.tmp")
    temporary.write_text("\n".join(sorted(paths)) + "\n", encoding="utf-8")
    os.replace(temporary, target)


def consume_pending(common: Path) -> list[str]:
    target = pending_path(common)
    if not target.exists():
        return []
    paths = [line for line in target.read_text(encoding="utf-8").splitlines() if line]
    target.unlink()
    messages = []
    for raw_path in paths:
        path = Path(raw_path)
        try:
            output = invoke_cleanup(common.parent, path)
            messages.append(f"worktree auto-close: {path}: {output}")
        except Exception as exc:
            messages.append(f"worktree auto-close warning: {path}: {exc}")
    return messages


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        event = payload.get("hook_event_name")
        cwd = payload.get("cwd") or os.getcwd()
        worktree, common = repo_paths(cwd)
        messages: list[str] = []
        if event == "SessionStart":
            messages.extend(consume_pending(common))
        elif event == "Stop":
            message = payload.get("last_assistant_message") or ""
            if READY_MARKER not in message or "Status: COMPLETE" not in message:
                return 0
            output = invoke_cleanup(common.parent, worktree)
            if "reason=active-process" in output:
                add_pending(common, worktree)
                messages.append(f"worktree auto-close pending: {worktree}")
            else:
                messages.append(f"worktree auto-close: {output}")
        if messages:
            emit("\n".join(messages))
    except Exception as exc:
        emit(f"worktree auto-close warning: {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
