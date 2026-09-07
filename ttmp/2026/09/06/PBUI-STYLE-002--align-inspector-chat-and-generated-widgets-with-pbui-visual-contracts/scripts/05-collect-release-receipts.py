#!/usr/bin/env python3
"""Collect immutable run results and registry readbacks; never publishes anything."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SHA = 'ed5b2a965fae6da1d8ec301c047b8b627547cb2b'
PACKAGES = [
    ('pbui', '0.12.1', 34077086318, 34077167380),
    ('pbui-workbench', '0.6.1', 34077087449, 34077248099),
    ('pbui-editor', '0.2.0', 34077088641, 34077249611),
    ('pbui-sandbox', '0.4.1', 34077089795, 34077323964),
    ('pbui-chat', '0.4.1', 34077091306, 34077377586),
]
def gh(*args):
    return subprocess.check_output(['gh', *args, '--repo', 'hyperslop-systems/pbui'], text=True)

results = []
for name, version, dry_id, real_id in PACKAGES:
    dry, real = [json.loads(gh('run', 'view', str(i), '--json', 'databaseId,headSha,status,conclusion,url,createdAt,updatedAt')) for i in (dry_id, real_id)]
    for run in (dry, real):
        assert run['status'] == 'completed' and run['conclusion'] == 'success', run
        assert run['headSha'] == SHA, run
    log = gh('run', 'view', str(real_id), '--log')
    lines = [line for line in log.splitlines() if '{"verified":' in line]
    assert len(lines) == 1, (name, lines)
    readback = json.loads(lines[0][lines[0].index('{"verified":'):])
    assert readback['verified'] == f'@hyperslop-systems/{name}@{version}' and readback['tag'] == 'latest', readback
    results.append({'package': f'@hyperslop-systems/{name}', 'version': version, 'dry_run': dry, 'publication': real, 'registry_readback': readback})

out = ROOT / 'various/validation/12-release-receipts.json'
out.write_text(json.dumps({'source_sha': SHA, 'source_tag': 'pbui-style-release-20260907', 'packages': results}, indent=2) + '\n')
print(f'Verified five dry runs, five real publications and five registry readbacks: {out}')
