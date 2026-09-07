#!/usr/bin/env python3
"""Link every changed file and the shared APIs that shaped the implementation."""
from pathlib import Path
import os
import subprocess

TICKET = Path(__file__).resolve().parents[1]
REPO = Path(subprocess.check_output(['git', '-C', str(TICKET), 'rev-parse', '--show-toplevel'], text=True).strip())
OUT = TICKET / 'various/validation/10-change-inventory.md'
lines = ['---', 'Title: Changed files and shared API references', 'Ticket: PBUI-STYLE-002', 'Status: complete', 'DocType: reference', 'Topics: [pbui, frontend, design]', '---', '', '# Changed-file inventory', '', 'Paths below link every file in the three implementation checkpoints. Generated build outputs are excluded by normal Git ignore rules; ticket evidence is linked from the index.', '']
for phase, commit in [('P1', 'cf4cf5a'), ('P2', '5e4970e'), ('P3', '46e3a30')]:
    lines += [f'## {phase}: {commit}', '']
    paths = subprocess.check_output(['git', '-C', str(REPO), 'diff-tree', '--no-commit-id', '--name-only', '-r', commit], text=True).splitlines()
    lines += [f'- [{path}]({os.path.relpath(REPO / path, OUT.parent)})' for path in paths]
    lines += ['']
lines += ['## Shared APIs and reference recipes', '']
for path in ['src/presentation/createPbui.tsx', 'src/components/foundation/Text/Text.tsx', 'src/components/layout/Surface/Surface.tsx', 'src/components/molecules/KeyValueList/KeyValueList.tsx', 'packages/pbui-sandbox/src/contracts.ts', 'packages/pbui-workbench/src/wiring/mounts.test.tsx', 'packages/datalab-ui/src/components/organisms/TablePanel/TablePanel.tsx']:
    lines += [f'- [{path}]({os.path.relpath(REPO / path, OUT.parent)})']
OUT.write_text('\n'.join(lines) + '\n')
print(OUT)
