#!/usr/bin/env python3
"""Render the foundations diagrams adjacent to the canonical review."""
from pathlib import Path
import subprocess

assets = Path(__file__).resolve().parent.parent / "design-doc" / "review-assets"
diagrams = {
    "foundations-models": r'''digraph models {
      graph [rankdir=TB, bgcolor="white", pad="0.3", nodesep="0.3", ranksep="0.4"];
      node [shape=box, style="rounded,filled", fillcolor="#edf3f8", color="#3a4c60", fontname="DejaVu Sans", fontsize=12, margin="0.16,0.12"];
      edge [color="#42546a", fontname="DejaVu Sans", fontsize=10];
      semantic [label="Semantic model\nports, follows, identity classes\nChanges when commands or values change"];
      layout [label="Layout constraints\nminimum sizes, gutters, active mode\nMay be infeasible at narrow widths"];
      geometry [label="Mounted geometry snapshot\nplacement + side + anchor + clipping\nChanges during drag and scroll"];
      project [label="Visible relationship projection\nchoose anchor instances; represent hidden ports"];
      routing [label="Routing graph\nfree space + legal heading transitions\nCandidate paths with explicit costs"];
      validate [label="Final geometry validation\nexact endpoints, axis-aligned segments, clearance\nReject invalid reconstruction"];
      display [label="Rendered relationship\npath + label + hit target + accessible action", fillcolor="#e4efe5"];
      layout -> geometry;
      semantic -> project;
      geometry -> project;
      geometry -> routing;
      project -> routing;
      routing -> validate [label="search, reconstruct, arrange lanes"];
      validate -> display [label="valid path or explicit unresolved state"];
    }''',
    "foundations-freshness": r'''digraph freshness {
      graph [rankdir=TB, bgcolor="white", pad="0.3", nodesep="0.3", ranksep="0.4"];
      node [shape=box, style="rounded,filled", fillcolor="#edf3f8", color="#3a4c60", fontname="DejaVu Sans", fontsize=12, margin="0.16,0.12"];
      edge [color="#42546a", fontname="DejaVu Sans", fontsize=10];
      drag [label="Live split ratio / scroll / mount / size\nInvalidate geometry even before document commit"];
      semantic [label="Binding / view lifecycle change\nInvalidate semantic projection"];
      frame [label="Coalesce pending work per animation frame\nBatch DOM reads; publish immutable snapshot"];
      token [label="Capture generation key\n(semantic revision, geometry revision, policy revision)"];
      solve [label="Build paths and validate final geometry\nOptional asynchronous work must retain its key"];
      guard [shape=diamond, style=filled, fillcolor="#fff4d9", label="Captured key\nstill current?"];
      discard [label="Discard obsolete result\nSchedule work for current generation", fillcolor="#f6e8e5"];
      install [label="Install matching paths, labels and hit targets\nOne coherent rendered snapshot", fillcolor="#e4efe5"];
      drag -> frame;
      semantic -> frame;
      frame -> token -> solve -> guard;
      guard -> discard [label="no"];
      guard -> install [label="yes"];
      discard -> frame;
    }''',
}
for name, source in diagrams.items():
    dot = assets / (name + ".dot")
    png = assets / (name + ".png")
    dot.write_text(source)
    subprocess.run(["dot", "-Tpng", "-Gdpi=140", str(dot), "-o", str(png)], check=True)
    print(png)
