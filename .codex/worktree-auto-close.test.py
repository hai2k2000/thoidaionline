#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
from pathlib import Path


ROOT = Path("/opt/build/asset-management-v2-canonical")
HOOK = ROOT / ".codex/worktree-auto-close.py"
CLEANUP = Path("/opt/build/asset-management-v2-canonical/scripts/production/worktree-cleanup.sh")


def run(*args, cwd=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True)


with tempfile.TemporaryDirectory(dir="/opt/build") as raw:
    root = Path(raw)
    run("git", "init", "--bare", str(root / "remote.git"))
    run("git", "init", str(root / "main"))
    run("git", "-C", str(root / "main"), "config", "user.email", "test@example.invalid")
    run("git", "-C", str(root / "main"), "config", "user.name", "lifecycle-test")
    (root / "main" / "README").write_text("fixture\n")
    run("git", "-C", str(root / "main"), "add", "README")
    run("git", "-C", str(root / "main"), "commit", "-m", "init")
    run("git", "-C", str(root / "main"), "branch", "-M", "integration/production")
    run("git", "-C", str(root / "main"), "remote", "add", "origin", str(root / "remote.git"))
    run("git", "-C", str(root / "main"), "push", "-u", "origin", "integration/production")

    def task(name):
        path = root / name
        run("git", "-C", str(root / "main"), "worktree", "add", str(path), "-b", name)
        run("git", "-C", str(path), "push", "-u", "origin", name)
        return path

    def hook(event, path, message):
        payload = json.dumps({"hook_event_name": event, "cwd": str(path), "last_assistant_message": message})
        env = {**os.environ, "THOIDAI_WORKTREE_CLEANUP_SCRIPT": str(CLEANUP)}
        return subprocess.run(["python3", str(HOOK)], input=payload, text=True, capture_output=True, env=env, check=True).stdout

    complete = task("complete-task")
    complete_output = hook("Stop", complete, "Status: COMPLETE\nWORKTREE_AUTO_CLOSE: READY")
    print("COMPLETE_OUTPUT", complete_output)
    assert "DELETE " in complete_output
    assert not complete.exists()

    incomplete = task("incomplete-task")
    assert hook("Stop", incomplete, "Status: IN_PROGRESS") == ""
    assert incomplete.exists()

    active = task("active-task")
    process = subprocess.Popen(["sleep", "10"], cwd=active)
    try:
        output = hook("Stop", active, "Status: COMPLETE\nWORKTREE_AUTO_CLOSE: READY")
    finally:
        process.terminate()
        process.wait()
    assert "pending" in output
    assert active.exists()
    assert "DELETE " in hook("SessionStart", root / "main", "")
    assert not active.exists()

print("worktree auto-close hook lifecycle: PASS")
