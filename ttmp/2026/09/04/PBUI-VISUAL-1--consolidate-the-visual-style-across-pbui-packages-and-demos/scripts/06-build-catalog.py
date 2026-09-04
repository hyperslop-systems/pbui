#!/usr/bin/env python3
"""Build the numbered screenshot catalog (markdown) from the manifests and the
collector notes. Output goes to stdout; the design doc appends it.

  python3 06-build-catalog.py > ../various/catalog.md

Numbering: <CODE>-<NNN>, where CODE identifies the corpus directory and NNN is
the file's own number, so an id can always be resolved back to a file.
"""
import json, os, re, sys
from collections import OrderedDict

T = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(T, "various", "screenshots")
REL = "../various/screenshots"   # relative to design-doc/

# corpus dir -> (code, human title, notes file, notes section prefix)
CORPORA = [
    # storybooks (static sweep)
    ("core",            "C",  "Core library (`@hyperslop-systems/pbui`) storybook", "notes-storybooks.md", "core"),
    ("pbui-workbench",  "WB", "pbui-workbench storybook",                           "notes-storybooks.md", "pbui-workbench"),
    ("workbench-audit", "WA", "pbui-workbench: Visual Audit stories (new)",         "notes-workbench.md",  "workbench-audit"),
    ("workbench-interactions", "WI", "Workbench + linking: driven interactions",   "notes-workbench.md",  "workbench-interactions"),
    ("pbui-ecommerce",  "EC", "pbui-ecommerce storybook (gold-coin shop)",          "notes-storybooks.md", "pbui-ecommerce"),
    ("pbui-chat",       "CH", "pbui-chat storybook",                                "notes-storybooks.md", "pbui-chat"),
    ("pbui-plotscript", "PS", "pbui-plotscript storybook",                          "notes-storybooks.md", "pbui-plotscript"),
    ("pbui-sandbox",    "SB", "pbui-sandbox storybook",                             "notes-storybooks.md", "pbui-sandbox"),
    ("pbui-editor",     "ED", "pbui-editor storybook",                              "notes-storybooks.md", "pbui-editor"),
    ("datalab-ui",      "DL", "datalab-ui storybook",                               "notes-storybooks.md", "datalab-ui"),
    ("datalab-workbench","DW","datalab-ui: workbench page stories",                 "notes-workbench.md",  "datalab-workbench"),
]
INTERACTION_PKGS = ["core", "pbui-chat", "pbui-sandbox", "pbui-editor", "pbui-plotscript"]
DEMOS = ["datalab-ui", "pbui-chat", "pbui-plotscript", "pbui-ecommerce"]
DEMO_TITLES = {"datalab-ui": "datalab-ui demo (vite, :5173)", "pbui-chat": "pbui-chat demo (:5174, Go backend on :8090)",
               "pbui-plotscript": "pbui-plotscript demo (:5175)", "pbui-ecommerce": "pbui-ecommerce demo (:5176)"}

def load_notes(fname):
    """Return {section-key: {NNN: (visible, oddities)}} from a notes file."""
    path = os.path.join(T, "various", fname)
    out, section = {}, None
    if not os.path.exists(path):
        return out
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^## (.+)$", line)
        if m:
            section = m.group(1).strip()
            out.setdefault(section, {})
            continue
        m = re.match(r"^(\d{3}) \| (.*)$", line.rstrip("\n"))
        if m and section is not None:
            parts = [p.strip() for p in m.group(2).split(" | ")]
            # story-name | visible | oddities   (or slug | visible | oddities)
            visible = parts[1] if len(parts) > 1 else parts[0]
            odd = parts[2] if len(parts) > 2 else ""
            out[section][m.group(1)] = (visible, odd)
    return out

NOTES = {f: load_notes(f) for f in ["notes-storybooks.md", "notes-workbench.md", "notes-interactions.md", "notes-demos.md"]}

def section_for(notes, prefix):
    for k in notes:
        if k.startswith(prefix):
            return notes[k]
    return {}

def manifest(d):
    p = os.path.join(SHOTS, d, "manifest.json")
    return json.load(open(p)) if os.path.exists(p) else []

def md_escape(s):
    return s.replace("|", "\\|")

def emit_story_corpus(d, code, title, notes_file, prefix):
    rows = manifest(d)
    if not rows:
        return
    notes = section_for(NOTES[notes_file], prefix)
    print(f"\n### {title} — `{code}` ({len(rows)} shots)\n")
    print(f"Directory: `various/screenshots/{d}/` · manifest: `manifest.json`\n")
    groups = OrderedDict()
    for r in rows:
        key = r.get("title") or r.get("story") or d
        groups.setdefault(key, []).append(r)
    for g, items in groups.items():
        print(f"\n#### {g}\n")
        for r in items:
            n = f"{r['n']:03d}"
            name = r.get("name") or r.get("slug") or r.get("description", "")
            note = notes.get(n)
            err = f" ⚠ `{r['error'][:120]}`" if r.get("error") else ""
            print(f"**{code}-{n} · {md_escape(name)}**{err}  ")
            if r.get("description") and r.get("name") is None:
                print(f"{md_escape(r['description'])}  ")
            if note:
                vis, odd = note
                print(f"_{md_escape(vis)}_  ")
                if odd and not re.match(r"^(consistent, no issues|none|—|-)\s*\.?$", odd, re.I):
                    print(f"→ {md_escape(odd)}  ")
            print(f"![{code}-{n}]({REL}/{d}/{r['file']})\n")

print("## Screenshot catalog\n")
print("Every screenshot in the corpus, numbered `CODE-NNN` (the code names the corpus directory, the number is the file's own prefix). Under each image: what the collector saw in italics, and its noted oddity after an arrow. The images are relative links into `various/screenshots/`.\n")
print("\n### Reference — `REF`\n")
print("**REF-001 · pbui-agent-workbench artifact (the look to converge on, minus the hard shadows)**  ")
print(f"![REF-001]({REL}/reference/pbui-agent-workbench.png)\n")

print("\n## Part A — Demo apps\n")
for demo in DEMOS:
    d = f"demos/{demo}"
    rows = manifest(d)
    if not rows:
        continue
    code = {"datalab-ui": "D-DL", "pbui-chat": "D-CH", "pbui-plotscript": "D-PS", "pbui-ecommerce": "D-EC"}[demo]
    notes = section_for(NOTES["notes-demos.md"], demo)
    print(f"\n### {DEMO_TITLES[demo]} — `{code}` ({len(rows)} shots)\n")
    print(f"Directory: `various/screenshots/{d}/`\n")
    for r in rows:
        n = f"{r['n']:03d}"
        note = notes.get(n)
        print(f"**{code}-{n} · {md_escape(r['slug'])}** — {md_escape(r.get('description',''))}  ")
        if note:
            vis, odd = note
            print(f"_{md_escape(vis)}_  ")
            if odd:
                print(f"→ {md_escape(odd)}  ")
        print(f"![{code}-{n}]({REL}/{d}/{r['file']})\n")

print("\n## Part B — Workbench and linking\n")
for d, code, title, nf, prefix in CORPORA:
    if d in ("pbui-workbench", "workbench-audit", "workbench-interactions", "datalab-workbench", "pbui-ecommerce"):
        emit_story_corpus(d, code, title, nf, prefix)

print("\n## Part C — Interaction states (menus, accept mode, dialogs, devtools)\n")
for pkg in INTERACTION_PKGS:
    d = f"interactions/{pkg}"
    rows = manifest(d)
    if not rows:
        continue
    code = {"core": "I-C", "pbui-chat": "I-CH", "pbui-sandbox": "I-SB", "pbui-editor": "I-ED", "pbui-plotscript": "I-PS"}[pkg]
    notes = section_for(NOTES["notes-interactions.md"], pkg)
    print(f"\n### {pkg} interactions — `{code}` ({len(rows)} shots)\n")
    print(f"Directory: `various/screenshots/{d}/`\n")
    for r in rows:
        n = f"{r['n']:03d}"
        note = notes.get(n)
        print(f"**{code}-{n} · {md_escape(r['slug'])}** — {md_escape(r.get('description',''))}  ")
        if note:
            vis, odd = note
            print(f"_{md_escape(vis)}_  ")
            if odd:
                print(f"→ {md_escape(odd)}  ")
        print(f"![{code}-{n}]({REL}/{d}/{r['file']})\n")

print("\n## Part D — Core library components\n")
for d, code, title, nf, prefix in CORPORA:
    if d == "core":
        emit_story_corpus(d, code, title, nf, prefix)

print("\n## Part E — Chat, plotscript, sandbox, editor storybooks\n")
for d, code, title, nf, prefix in CORPORA:
    if d in ("pbui-chat", "pbui-plotscript", "pbui-sandbox", "pbui-editor"):
        emit_story_corpus(d, code, title, nf, prefix)

print("\n## Part F — datalab-ui storybook\n")
for d, code, title, nf, prefix in CORPORA:
    if d == "datalab-ui":
        emit_story_corpus(d, code, title, nf, prefix)
