#!/usr/bin/env python3
"""Prepare a standalone reMarkable input and validate the design's local links."""
from pathlib import Path
from urllib.parse import unquote
import json
import re

ticket = Path(__file__).resolve().parent.parent
report = ticket / 'design-doc' / '04-wiring-scene-refactoring-architecture-and-intern-implementation-guide.md'
text = report.read_text()
body = text.split('---', 2)[2].lstrip()
body = re.sub(r'^# [^\n]+\n+', '', body, count=1)
links = re.findall(r'!?\[[^\]]*\]\((<[^>]+>|[^)]+)\)', body)
links += re.findall(r'^\[[^\]]+\]:\s+(\S+)', body, re.M)
checked = 0
for link in links:
    link = link.strip('<>')
    if re.match(r'https?://|#', link):
        continue
    target = (report.parent / unquote(link.split('#')[0])).resolve()
    if not target.exists():
        raise ValueError(f'Missing local reference: {link}')
    checked += 1
body = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',
    lambda m: '![' + m[1] + '](<' + str((report.parent / m[2]).resolve()) + '>)', body)
out = Path('/tmp/pbui-wiring-refactor-upload')
out.mkdir(exist_ok=True)
target = out / 'PBUI Wiring Refactoring Guide.md'
target.write_text(body)
validation = {'local_links_checked':checked, 'missing_links':0,
              'words':len(body.split()), 'embedded_images':len(re.findall(r'!\[',body)),
              'product_code_changed':False}
(ticket/'design-doc/refactor-assets/document-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps(validation))
print(target)
