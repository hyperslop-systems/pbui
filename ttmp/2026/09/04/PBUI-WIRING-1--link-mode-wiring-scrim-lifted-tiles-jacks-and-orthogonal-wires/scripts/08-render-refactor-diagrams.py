#!/usr/bin/env python3
"""Render standalone design diagrams; no product source changes."""
from pathlib import Path
import subprocess

out = Path(__file__).resolve().parent.parent / 'design-doc' / 'refactor-assets'
out.mkdir(exist_ok=True)
common = '''graph [rankdir=TB, bgcolor="white", pad="0.25", nodesep="0.3", ranksep="0.4"];
node [shape=box, style="rounded,filled", fillcolor="#edf3f8", color="#384b60", fontname="DejaVu Sans", fontsize=12, margin="0.15,0.12"];
edge [color="#42566b", fontname="DejaVu Sans", fontsize=10];'''
diagrams = {
'01-architecture': '''
core [label="Existing semantic core\ncommands, document, runtime, evaluation"];
projection [label="Relationship projection\nlogical IDs, kinds, descriptions"];
dom [label="Mounted surface\ntile frames, cards, clipping, live splits"];
measure [label="Surface geometry owner\nregistration + batched measurement"];
interaction [label="Connection controller\nsource / candidate / operation / selection"];
scene [label="Pure scene builder\nchoose anchors, route, arrange, validate"];
render [label="Declarative rendering\nframe jacks + SVG paths + labels + hit regions", fillcolor="#e4efe5"];
panel [label="Connection panel\nreadable lists, preview, inspect, reveal", fillcolor="#e4efe5"];
core -> projection;
dom -> measure;
projection -> scene;
measure -> scene;
interaction -> scene [label="selected relationship; preview"];
scene -> render;
projection -> panel;
interaction -> panel;
interaction -> core [label="preview / atomic execute"];
''',
'02-tile-ownership': '''
root [label="Surface: explicit routing inset + local stacking context"];
tile [label="TileFrame: positioned frame; obstacle registration"];
header [label="Header: title, badges, actions"];
body [label="Content region: bounded; overflow clipped"];
app [label="Application scrollport\napp stays mounted and inert in wiring"];
ports [label="Port workspace\nindependent vertical column scrollports"];
overlay [label="Frame overlay: sibling of content region\njacks from scene coordinates; no measurement"];
wires [label="Surface SVG overlay\npaths, labels and hits from same scene"];
root -> tile;
root -> wires;
tile -> header;
tile -> body;
tile -> overlay;
body -> app;
body -> ports;
''',
'03-update-protocol': '''
change [label="Input changes\nReact layout commit / scroll / resize / registration"];
dirty [label="Invalidate surface\nremove stale hit regions; record dirty reasons"];
read [label="Read one geometry snapshot\nframes + cards + clips + root origin"];
derive [label="Derive anchors and route graph\nno reading rendered jacks"];
solve [label="Build and validate complete scene\nretain stable topology only while valid"];
guard [shape=diamond, fillcolor="#fff4d9", label="Inputs and\nroot lifetime\nstill current?"];
install [label="Publish one immutable scene\njacks, routes, labels, selection targets", fillcolor="#e4efe5"];
retry [label="Discard result\nschedule current inputs", fillcolor="#f6e8e5"];
change -> dirty -> read -> derive -> solve -> guard;
guard -> install [label="yes"];
guard -> retry [label="no"];
retry -> read;
''',
'04-interaction': '''
idle [label="Idle / inspect relationships"];
source [label="Source chosen\noperation visible; source can change"];
candidate [label="Destination candidate\npreview complete command batch"];
commit [label="Commit\nexecute same intent against current state"];
success [label="Completed\nselect relationship; announce outcome", fillcolor="#e4efe5"];
refused [label="Refused\nkeep context; show planner explanation", fillcolor="#f6e8e5"];
idle -> source [label="click / keyboard / drag start"];
source -> candidate [label="choose or hover destination"];
candidate -> candidate [label="operation or relation changes"];
candidate -> commit [label="confirm / valid drop"];
commit -> success [label="ok"];
commit -> refused [label="refused or changed facts"];
refused -> candidate [label="change choice"];
success -> idle;
source -> idle [label="cancel"];
candidate -> idle [label="cancel"];
''',
}
for name, body in diagrams.items():
    path = out / (name + '.dot')
    path.write_text('digraph design {\n' + common + '\n' + body + '\n}\n')
    subprocess.run(['dot','-Tpng','-Gdpi=140',str(path),'-o',str(out/(name+'.png'))],check=True)
    print(name)
