#!/usr/bin/env python3
"""Index ticket-owned PNGs; mtime is a capture-time proxy, not embedded provenance."""
import hashlib
import json
from pathlib import Path
import struct
from datetime import datetime, timezone

TICKET = Path(__file__).resolve().parents[1]
ROOT = TICKET / 'various' / 'screenshots'
BASE = {
    'coordination-before': (16011, 'visual-audit--coordination-inspector-content', 'bdc2dca baseline'),
    'coordination-after': (16011, 'visual-audit--coordination-inspector-content', 'cf4cf5a'),
    'coordination-narrow': (16011, 'workbench-coordinationinspector--narrow', 'cf4cf5a'),
    'sandbox-before': (16012, 'sandbox-devtools--playground', 'bdc2dca baseline'),
    'devtools-before': (16012, 'visual-audit-sandbox-devtools--all-devtools', 'bdc2dca baseline; tree tab'),
    'devtools-before-textarea-fix': (16012, 'visual-audit-sandbox-devtools--all-devtools', 'P1 intermediate; stale core dist / textarea overflow'),
    'devtools-narrow-before-textarea-fix': (16012, 'visual-audit-sandbox-devtools--narrow-devtools', 'P1 intermediate; stale core dist / textarea overflow'),
    'devtools-after': (16012, 'visual-audit-sandbox-devtools--all-devtools', 'cf4cf5a; tree tab; increment fired'),
    'devtools-narrow': (16012, 'visual-audit-sandbox-devtools--narrow-devtools', 'cf4cf5a; tree tab; increment fired'),
    'proposal-before': (16013, 'pbui-chat-proposalcard--pending', 'bdc2dca baseline'),
    'proposal-after': (16013, 'pbui-chat-proposalcard--pending', '5e4970e'),
    'proposal-approved-after': (16013, 'pbui-chat-proposalcard--pending', '5e4970e; Approve clicked'),
    'proposal-narrow': (16013, 'pbui-chat-proposalcard--narrow-long-fields', '5e4970e'),
    'tool-narrow': (16013, 'pbui-chat-toolcard--narrow-long-content', '5e4970e'),
    'reference-chip': (16013, 'pbui-chat-refpresentation--with-badge', '5e4970e'),
    'generated-severities': (16012, 'sandbox-generated-notices--severity-matrix', '5e4970e'),
    'final-coordination-inspector': (16011, 'workbench-coordinationinspector--narrow', '46e3a30; final dependency rebuild'),
    'final-sandbox-repl': (16012, 'visual-audit-sandbox-devtools--narrow-devtools', '46e3a30; final dependency rebuild; state tab'),
    'tools-filtered-expanded': (16013, 'pbui-chat-operational-panels--tools-narrow', '46e3a30; failed filter, input disclosure open'),
}
for panel in ('trace', 'runs', 'events', 'tools'):
    for width in ('wide', 'narrow'):
        BASE[f'{panel}-{width}-after'] = (16013, f'pbui-chat-operational-panels--{panel}-{width}', '46e3a30')
    BASE[f'{panel}-narrow-before'] = (16013, f'pbui-chat-operational-panels--{panel}-narrow', '5e4970e + new P3 fixtures, before style edits')
for state in ('before', 'after', 'keyboard', 'forced-colors'):
    BASE[f'select-{state}'] = (16014, 'design-system-atoms-selectinput--skin-comparison', '5e4970e + comparison fixture' if state == 'before' else f'46e3a30; {state}')

entries = []
for path in sorted(ROOT.glob('*.png')):
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path
    width, height = struct.unpack('>II', data[16:24])
    port, story, source = BASE[path.stem]  # Fail rather than silently catalogue an unknown state.
    entries.append(dict(file=path.name, width=width, height=height,
                        file_modified_at_utc=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                        sha256=hashlib.sha256(data).hexdigest(), source=source,
                        url=f'http://127.0.0.1:{port}/iframe.html?id={story}&viewMode=story'))
(ROOT / 'manifest.json').write_text(json.dumps({'timestamp_note': 'Filesystem mtime is a capture-time proxy; source labels describe the loaded build/fixture state.', 'captures': entries}, indent=2) + '\n')
lines = ['---', 'Title: Visual alignment capture catalogue', 'Ticket: PBUI-STYLE-002', 'Status: complete', 'DocType: reference', 'Topics: [pbui, frontend, design]', '---', '', '# Capture catalogue', '',
         'Original PNGs live in this ticket. SHA256, dimensions, source state and loopback story URLs are in [manifest.json](manifest.json). Timestamps are filesystem mtime proxies, not embedded capture metadata.', '',
         'All captures use synthetic fixtures. Counter/devtools execute a local eval-engine program. Chat auto-connect is disabled but metadata PATCH requests receive 501 from the static server. Images do not prove backend authorization, persistence, or complete accessibility.', '',
         'Run `scripts/01-browser-acceptance.js` through the Playwright tool for geometry, disclosure/filter, keyboard and forced-colors assertions. It expects rebuilt Storybooks on ports 16011–16014. Then rerun this catalogue script.', '',
         '| Image | Dimensions | Source / state |', '|---|---|---|']
lines += [f"| [{e['file']}]({e['file']}) | {e['width']}×{e['height']} | {e['source']} |" for e in entries]
(ROOT / '01-capture-catalog.md').write_text('\n'.join(lines) + '\n')
print(f'Catalogued {len(entries)} PNGs; all states mapped; hashes generated.')
