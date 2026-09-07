#!/usr/bin/env python3
"""Verify capture hashes, successful physical receipts and local Markdown targets."""
import hashlib
import json
from pathlib import Path
import re
import yaml

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'various/screenshots/manifest.json').read_text())
for item in manifest['captures']:
    image = root / 'various/screenshots' / item['file']
    assert hashlib.sha256(image.read_bytes()).hexdigest() == item['sha256'], image
assert len(manifest['captures']) == 35
receipts = sorted((root / 'various/slips').glob('*-receipt.txt'))
assert len(receipts) == 7
for receipt in receipts:
    data = yaml.safe_load(receipt.read_text().split('\n---\n')[0])
    assert data['status_code'] == 200 and data['printed'] and not data['dry_run'], receipt
    assert data['printer_response']['ok'], receipt
links = 0
for doc in root.rglob('*.md'):
    body = re.sub(r'```.*?```', '', doc.read_text(), flags=re.S)
    for target in re.findall(r'\]\(([^)]+)\)', body):
        if '://' in target or target.startswith('#'):
            continue
        target = target.split('#')[0]
        assert (doc.parent / target).exists(), (doc, target)
        links += 1
index = yaml.safe_load((root / 'index.md').read_text().split('---')[1])
assert index['Status'] == 'complete'
result = {'capture_hashes_verified': 35, 'physical_receipts_verified': 7, 'local_markdown_targets_verified': links, 'ticket_status': 'complete'}
(root / 'various/validation/11-evidence-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
