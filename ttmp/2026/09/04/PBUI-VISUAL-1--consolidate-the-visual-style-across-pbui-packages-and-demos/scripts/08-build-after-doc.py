#!/usr/bin/env python3
"""Build the before/after section of doc 03 from the two corpora.

  python3 08-build-after-doc.py > ../various/before-after.md

Pairs are matched by story id (storybooks), by slug (demos, interactions) and
by file name (workbench interactions), so renumbering between the sweeps does
not matter. Output paths are relative to design-doc/.
"""
import json, os, sys
T = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEFORE = os.path.join(T, "various", "screenshots")
AFTER = os.path.join(T, "various", "screenshots-after")
REL_B, REL_A = "../various/screenshots", "../various/screenshots-after"

def manifest(root, d):
    p = os.path.join(root, d, "manifest.json")
    return json.load(open(p)) if os.path.exists(p) else []

def by_key(rows, key):
    return {r.get(key): r for r in rows if r.get(key)}

# (heading, [(before-dir, after-dir, key, id)...]) — id is the story id or slug
EXHIBITS = [
  ("1 · One tile chrome, one shell", [
    ("demos/pbui-chat", "demos/pbui-chat", "slug", "shop-initial"),
    ("demos/pbui-plotscript", "demos/pbui-plotscript", "slug", "workspace-initial"),
    ("demos/pbui-ecommerce", "demos/pbui-ecommerce", "slug", "shop-initial"),
    ("demos/datalab-ui", "demos/datalab-ui", "slug", "workbench-initial"),
    ("workbench-audit", "pbui-workbench", "id", "visual-audit--tile-header-variants"),
  ]),
  ("2 · One chip", [
    ("workbench-audit", "pbui-workbench", "id", "visual-audit--port-badge-gallery"),
    ("workbench-audit", "pbui-workbench", "id", "visual-audit--port-rail-counts"),
    ("core", "core", "id", "design-system-atoms-chip--states"),
    ("datalab-ui", "datalab-ui", "id", "design-system-atoms-typebadge--the-three-types"),
    ("datalab-ui", "datalab-ui", "id", "component-library-organisms-workspacestrip--default"),
  ]),
  ("3 · Dialog and launcher on the menu recipe", [
    ("core", "core", "id", "chrome-kit--launcher"),
    ("interactions/core", "interactions/core", "slug", "launcher-filtered-query"),
    ("interactions/core", "interactions/core", "slug", "accept-chooser-open"),
    ("pbui-workbench", "pbui-workbench", "id", "workbench-rebalancedialog--broken"),
    ("demos/pbui-chat", "demos/pbui-chat", "slug", "launcher-open"),
  ]),
  ("4 · No nested double borders", [
    ("workbench-audit", "pbui-workbench", "id", "visual-audit--tile-header-variants"),
    ("workbench-interactions", "workbench-interactions", "file", "002-connect-mode-acceptable-highlighted.png"),
    ("pbui-chat", "pbui-chat", "id", "pbui-chat-proposalcard--pending"),
  ]),
  ("5 · Body padding on tiles", [
    ("workbench-audit", "pbui-workbench", "id", "visual-audit--surface-variants"),
    ("pbui-workbench", "pbui-workbench", "id", "workbench-tile--title-slot"),
  ]),
  ("6 · The selection tan un-overloaded", [
    ("interactions/core", "interactions/core", "slug", "accept-mode-banner"),
    ("interactions/pbui-sandbox", "interactions/pbui-sandbox", "slug", "timeline-with-entries"),
  ]),
  ("7 · One notice grammar", [
    ("core", "core", "id", "component-library-molecules-callout--variants-survive-greyscale"),
    ("interactions/core", "interactions/core", "slug", "refusal-notice"),
    ("pbui-chat", "pbui-chat", "id", "pbui-chat-pbuiwidget--invalid"),
    ("interactions/pbui-plotscript", "interactions/pbui-plotscript", "slug", "live-edit-error-diagnostic"),
  ]),
  ("8 · Tokens: fallbacks and missing definitions", [
    ("pbui-chat", "pbui-chat", "id", "pbui-chat-pbuiwidget--streaming-table"),
    ("core", "core", "id", "component-library-molecules-jsonblock--default"),
    ("core", "core", "id", "component-library-organisms-inspectorpanel--default"),
  ]),
  ("9 · One label idiom", [
    ("pbui-ecommerce", "pbui-ecommerce", "id", "shop-scenes--scene-1-ambient"),
    ("pbui-workbench", "pbui-workbench", "id", "workbench-coordinationinspector--tile"),
  ]),
  ("10 · Native controls", [
    ("core", "core", "id", "design-system-layout-toolbar--variants"),
    ("core", "core", "id", "presentation-interaction-kernel-4--explain-the-menu"),
    ("interactions/pbui-sandbox", "interactions/pbui-sandbox", "slug", "devtools-initial-content"),
  ]),
  ("Story hygiene", [
    ("datalab-ui", "datalab-ui", "id", "design-system-brand-phaseicon--ink"),
    ("datalab-ui", "datalab-ui", "id", "design-system-brand-phaserule--bars-only"),
    ("datalab-ui", "datalab-ui", "id", "applications-tour-section--the-brief"),
    ("workbench-audit", "pbui-workbench", "id", "visual-audit--wire-layer-styles"),
  ]),
]

def find(root, d, key, ident):
    rows = manifest(root, d)
    if key == "file":
        for r in rows:
            if r.get("file") == ident: return r
        return None
    return by_key(rows, key).get(ident)

print("## Before and after, by priority\n")
print("Left: the before-corpus (Step 2). Right: the after-corpus (Step 12), same story or scenario, matched by id. Missing halves are noted.\n")
for heading, items in EXHIBITS:
    print(f"### {heading}\n")
    for bd, ad, key, ident in items:
        b = find(BEFORE, bd, key, ident); a = find(AFTER, ad, key, ident)
        label = ident if key != "file" else ident.split("-",1)[1].rsplit(".",1)[0]
        print(f"**{label}**  ")
        print("| before | after |\n|---|---|")
        bi = f"![before]({REL_B}/{bd}/{b['file']})" if b else "_(no before shot)_"
        ai = f"![after]({REL_A}/{ad}/{a['file']})" if a else "_(no after shot)_"
        print(f"| {bi} | {ai} |\n")
