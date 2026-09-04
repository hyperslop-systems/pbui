#!/usr/bin/env python3
"""Append a detailed diary entry from a phase record supplied on stdin."""
from pathlib import Path
import json, shutil, subprocess, sys

ticket = Path(__file__).resolve().parent.parent
repo = Path(__file__).resolve().parents[6]
record = json.load(sys.stdin)
phase = record['phase']
archive = ticket / 'various' / 'phase-records'
archive.mkdir(parents=True, exist_ok=True)
(archive / f'p{phase}.json').write_text(json.dumps(record, indent=2)+'\n')
slips = ticket / 'various' / 'slips'
slips.mkdir(exist_ok=True)
for path in Path('/tmp').glob(f'pbui-wiring-p{phase}-*.yaml'):
    shutil.copyfile(path, slips/path.name)
prompt = ('Implement, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill). Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done.' if phase == 0 else '(see Step 13)')
body = f'\n## Step {13+phase}: Refactor P{phase} — {record["title"]}\n\n{record["narrative"]}\n\n### Prompt Context\n\n**User prompt (verbatim):** {prompt}\n\n**Assistant interpretation:** Implement this phase of design 04, validate its behavior, commit the result, and print start/completion slips.\n\n**Inferred user intent:** Complete the refactoring with inspectable progress, detailed technical history, and a physical record of each phase.\n\n**Commit (code):** {record["commit"]}\n'
for heading,key in [('What I did','did'),('Why','why'),('What worked','worked'),("What didn't work",'failed'),('What I learned','learned'),('What was tricky to build','tricky'),('What warrants a second pair of eyes','review'),('What should be done in the future','future'),('Code review instructions','instructions'),('Technical details','details')]:
    value=record[key]
    body += '\n### '+heading+'\n\n'+ ('\n'.join('- '+item for item in value) if isinstance(value,list) else value)+'\n'
diary=ticket/'reference/01-diary.md'
with diary.open('a') as stream: stream.write(body)
subprocess.run(['docmgr','task','check','--ticket','PBUI-WIRING-1','--id',record['task']],cwd=repo,check=True)
subprocess.run(['docmgr','changelog','update','--ticket','PBUI-WIRING-1','--entry',f'Refactor P{phase}: {record["title"]} (commit {record["commit"]}). '+record['summary']],cwd=repo,check=True)
