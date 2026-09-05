#!/usr/bin/env python3
"""Verify the installed pre-push hook rejects the original CI formatting error.

Run from the repository root. Temporarily restores one file's formatting from
PR commit 38259d8, then restores current bytes even when the hook fails.
"""
from pathlib import Path
import subprocess
import tempfile

path = Path("packages/datalab-ui/test/remote-codec.test.ts")
current = path.read_bytes()
log = Path(tempfile.mkdtemp(prefix="pbui-prepush-lint-")) / "hook-output.txt"
try:
    original = subprocess.check_output(["git", "show", f"38259d8:{path}"])
    path.write_bytes(original)
    result = subprocess.run(
        ["lefthook", "run", "pre-push", "--force"],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    log.write_text(result.stdout)
    assert result.returncode != 0, "The pre-push hook accepted invalid formatting"
    assert "remote-codec.test.ts format" in result.stdout, result.stdout[-4000:]
    assert "frontend-check" in result.stdout
    assert "pnpm --workspace-root run test" not in result.stdout
    print(f"Pre-push rejected the original formatting error before frontend tests; output: {log}")
finally:
    path.write_bytes(current)
