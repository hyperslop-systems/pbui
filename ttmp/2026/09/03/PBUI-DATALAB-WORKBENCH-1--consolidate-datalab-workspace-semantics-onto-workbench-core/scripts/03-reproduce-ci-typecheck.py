#!/usr/bin/env python3
"""Reproduce CI's absent core/shell declarations, then verify dependency builds.

Run from the repository root with pnpm dependencies installed and PBUI/protocol
built, matching CI immediately before its Datalab checks. Existing core/shell
dist directories are backed up in /tmp; successful fresh builds are retained.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path.cwd()
backup = Path(tempfile.mkdtemp(prefix="pbui-pr25-declarations-"))
packages = ["workbench-core", "pbui-workbench"]
print(f"Previous build outputs: {backup}", flush=True)
try:
    for name in packages:
        dist = root / "packages" / name / "dist"
        if dist.exists():
            shutil.move(str(dist), str(backup / name))
    result = subprocess.run(
        ["pnpm", "--filter", "@hyperslop-systems/datalab-ui", "typecheck"],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    (backup / "missing-declarations.log").write_text(result.stdout)
    print(result.stdout, flush=True)
    assert result.returncode != 0, "Expected missing dependency declarations to fail"
    for name in packages:
        assert f"Cannot find module '@hyperslop-systems/{name}'" in result.stdout
    # Also remove PBUI/protocol outputs to verify the publish workflow from
    # a cold dependency tree, including the root workspace package.
    for name, dist in [("pbui", root / "dist"), ("workbench-protocol", root / "packages/workbench-protocol/dist")]:
        if dist.exists():
            shutil.move(str(dist), str(backup / name))
    subprocess.run(
        ["pnpm", "--include-workspace-root", "--filter", "@hyperslop-systems/datalab-ui^...", "build"],
        check=True,
    )
    subprocess.run(
        ["pnpm", "--filter", "@hyperslop-systems/datalab-ui", "typecheck"],
        check=True,
    )
    print("Fresh dependency builds fixed the complete Datalab typecheck.", flush=True)
finally:
    # Restore a previous output only if a build failed before recreating it.
    for name in [*packages, "pbui", "workbench-protocol"]:
        dist = root / "dist" if name == "pbui" else root / "packages" / name / "dist"
        old = backup / name
        if old.exists() and not dist.exists():
            shutil.move(str(old), str(dist))
