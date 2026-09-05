#!/usr/bin/env python3
"""Prepare a clean single-document bundle input without a filename-slug heading.
The canonical report remains in design-doc. All local images resolve absolutely.
"""
from pathlib import Path
import re
ticket = Path(__file__).resolve().parent.parent
report = next((ticket / "design-doc").glob("03-intern-*.md"))
body = report.read_text().split("---", 2)[2].lstrip()
body = re.sub(r"^# [^\n]+\n+", "", body, count=1)
body = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)",
              lambda m: "![" + m[1] + "](<" +
              str((report.parent / m[2]).resolve()) + ">)", body)
# Avoid narrow equal-width PDF columns for long technical file names.
lines = body.splitlines()
result = []
in_source_table = False
for line in lines:
    if line.startswith("| Ref | File and starting lines"):
        in_source_table = True
        continue
    if in_source_table and line.startswith("|---"):
        continue
    if in_source_table and line.startswith("| R"):
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        result.append("- **" + cells[0] + ".** " + cells[1] + " — " + cells[2])
        result.append("")
        continue
    if in_source_table:
        in_source_table = False
    result.append(line)
body = "\n".join(result) + "\n"
out = Path("/tmp/pbui-wiring-upload")
out.mkdir(exist_ok=True)
target = out / "PBUI Wiring Intern Review.md"
target.write_text(body)
print(target)

