#!/usr/bin/env python3
"""Prepare the design and implementation handoff with embedded local images."""
from pathlib import Path
import re

root=Path.cwd()
ticket=Path(__file__).resolve().parent.parent
out=Path('/tmp/pbui-wiring-implementation-upload')
out.mkdir(exist_ok=True)
for number,name in enumerate(['04-wiring-scene-refactoring-architecture-and-intern-implementation-guide.md','05-implemented-wiring-architecture-and-validation-handoff.md'],1):
    source=ticket/'design-doc'/name
    body=source.read_text().split('---',2)[2].lstrip()
    def image(match):
        path=(source.parent/match[2].strip('<>')).resolve()
        if not path.exists(): raise FileNotFoundError(path)
        return f'![{match[1]}](<{path}>)'
    body=re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',image,body)
    target=out/(['Refactoring Design.md','Implemented Architecture and Validation.md'][number-1])
    target.write_text(body)
    print(target)
