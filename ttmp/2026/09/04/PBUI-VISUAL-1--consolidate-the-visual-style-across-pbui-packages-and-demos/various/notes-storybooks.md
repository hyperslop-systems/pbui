---
Title: 'Collector notes: static storybook sweep (583 shots)'
Ticket: PBUI-VISUAL-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - review
DocType: reference
Intent: short-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Raw working material for the visual audit; the design doc is the curated view."
LastUpdated: 2026-09-04T11:41:19.797959-04:00
WhatFor: ""
WhenToUse: ""
---

# Visual audit notes — pbui Storybooks

Screenshots captured with `$T/scripts/01-screenshot-storybook.mjs` against the 8 running Storybooks (tmux session `pbui-visual`). Every PNG was viewed with the Read tool. Format per line:

`NNN | story title / story name | what is visible | visual oddities`

Totals: core 162 (0 errors), datalab-ui 332 (0 errors after a clean re-run), pbui-chat 19 (0 errors), pbui-workbench 30 (1 story is a deliberate error-state render), pbui-sandbox 2 (0 errors), pbui-editor 5 (0 errors), pbui-plotscript 4 (0 errors), pbui-ecommerce 29 (0 errors). Grand total 583 screenshots.

---

## core (@hyperslop-systems/pbui, http://localhost:6006)

001 | Chrome/Kit / the five drop-zone previews | five dashed-border pink drop-zone tiles, three showing a bordered instruction box, one showing a small command box "# swap applications" | inconsistent inner-box placement across the five zones (top-aligned in one, bottom-aligned in others); dashed border color/weight looks uniform but box content type varies (text box vs command chip) with no visual grouping cue
002 | Chrome/Kit / the launcher shell | "Open a view" modal on blue-gray backdrop, white rounded card, search input, list rows with one highlighted pale-yellow selected row | consistent, no issues
003 | Chrome/Kit / tile frames with live drag/dock | two docked tile frames side by side, black window border, colored title bars with window-control icons | title bar background color differs per tile (pale sage green vs pale lavender) with no legend explaining the color meaning — reads as arbitrary/inconsistent accent choice
004 | Component Library/Molecules/Callout / The One Time Secret | black-border beige callout box, checkmark heading, monospace token line, "Copy"/"Done" as plain blue text links | "Copy" and "Done" render as bare blue links with no button chrome, inconsistent with bordered-button styling used elsewhere (e.g. InlineRename, MoreBar)
005 | Component Library/Molecules/Callout / The Three It Replaced | three stacked beige callout boxes (published/checkmark, warning/triangle, plain info), identical box styling | severity conveyed only by tiny glyph, not color — success, warning, and neutral info all share the same beige box/black border with no color differentiation
006 | Component Library/Molecules/Callout / Variants Survive Greyscale | three stacked boxes: Info, Done (check), Waiting (triangle), same beige/black-border box style | same issue as 005 — all three severities render as identical box color, differing only by leading glyph
007 | Component Library/Molecules/DiffHunk / Both Views | bordered "show split" label box, "UNIFIED" caption, diff table with red/green line highlighting | "show split" renders as a thin sharp-cornered bordered box that looks like a static label rather than an interactive toggle, no visual affordance distinguishing it as clickable
008 | Component Library/Molecules/DiffHunk / Capped | green-highlighted added lines followed by a tan/beige "34 more lines — click to show" collapsible bar | consistent, no issues
009 | Component Library/Molecules/DiffHunk / Empty | thin diff header bar "@@ -0,0 +0,0 @@" with no body content beneath | BLANK/NEEDS INTERACTION — only a header row renders, rest of frame is blank white
010 | Component Library/Molecules/DiffHunk / Split | two-column diff, red-tinted removed cell left, green-tinted added cells right, padded blank cells | consistent, no issues
011 | Component Library/Molecules/DiffHunk / Unified | single-column diff, red minus line then green plus lines | consistent, no issues
012 | Component Library/Molecules/DiffHunk / With Blank Lines | diff showing new const/blank line addition, green highlight | consistent, no issues
013 | Component Library/Molecules/EmptyState / The Real Cases | three stacked black-border white boxes (YOUR TOKENS, PUBLISH A DATASET, STREAMS) with blue inline links | box background here reads pure white rather than the beige/off-white used in Callout boxes (004-006) — inconsistent "boxed" surface color across components
014 | Component Library/Molecules/EmptyState / With And Without A Hint | plain unboxed text, "none yet" repeated with/without hint line below | no border/box at all, unlike the boxed EmptyState in 013 — inconsistent presence of box chrome between EmptyState stories
015 | Component Library/Molecules/FileDropZone / Disabled | "Choose files… or drop them below" label, solid-border beige box "choose a drop and name the dataset first" | box border is a plain thin solid line, not visually marked as disabled (no dimming/greyscale) compared to enabled variants
016 | Component Library/Molecules/FileDropZone / Dragging | "Choose files… or drop them below" label, solid-border beige box "drop files here, or click to choose", italic hint below | dragging state looks visually identical (same border weight/fill) to the Ready state (017) — no highlight/accent color indicating an active drag-over
017 | Component Library/Molecules/FileDropZone / Ready | "Choose CSV files… or drop them below" label, solid-border beige box "drop files here, or click to choose" | near-indistinguishable from Dragging (016) — border/fill unchanged between states, only surrounding text differs
018 | Component Library/Molecules/InlineRename / Does Not Shift The Row | three small bordered rectangular chips "welcome" / "explore" (thicker focus border) / "gallery" | chips have sharp square corners, not pill-shaped, inconsistent with rounder chip shapes seen elsewhere (e.g. Legend swatches, close buttons in Dialog)
019 | Component Library/Molecules/InlineRename / Live | single bordered "explore" chip plus olive-colored helper text below | consistent, no issues
020 | Component Library/Molecules/JsonBlock / Default | dark navy rounded code block with syntax-highlighted JSON (blue keys, tan strings) | consistent, no issues
021 | Component Library/Molecules/JsonBlock / Theme Overrides | dark navy code block, appears visually identical to Default | "Theme Overrides" story renders indistinguishably from Default — no visible theme change applied
022 | Component Library/Molecules/JsonBlock / Unserializable | dark navy box, warning triangle glyph, orange/red error text about BigInt | consistent color scheme with other JsonBlock states, no issues
023 | Component Library/Molecules/JsonBlock / Unstyled | plain white background, black monospace JSON text, no box or syntax coloring | drastic contrast vs Default/Theme Overrides (no dark background, no highlighting) — likely intentional "unstyled" demo but stands out sharply
024 | Component Library/Molecules/KindLegend / Default | horizontal bar rows (file/tool/system/memory) with colored swatches (sage green/blue/gray-purple/light purple) and counts | consistent, no issues
025 | Component Library/Molecules/KindLegend / Degenerate | "NO KINDS AT ALL" text plus "EVERY TOTAL IS ZERO" with two near-invisible thin-outline bars, "0 · 0" | bars render as near-invisible thin outlines with no fill — could be mistaken for a rendering failure
026 | Component Library/Molecules/KindLegend / Formatters | BYTES and DURATIONS sections, colored bars (green/blue/gray-purple, green/purple/orange) | "md" byte segment is a barely-visible sliver against the full-width "csv" bar — extreme scale disparity makes smallest bar effectively invisible
027 | Component Library/Molecules/KindLegend / Long Names | two bars, label "a-very-l…" truncated vs short label "short" | label column width is inconsistent between the long truncated label and the short label, so swatch/bar start position shifts between rows
028 | Component Library/Molecules/KindLegend / Sorts Itself | horizontal bars file/tool/system/memory, same styling as Default | consistent, no issues
029 | Component Library/Molecules/Legend / Empty | plain unboxed muted text "nothing above this line" | no box/border, inconsistent with boxed EmptyState (013)
030 | Component Library/Molecules/Legend / No Title | three colored square swatches with black outline (green/purple/orange) and labels, no header | consistent, no issues
031 | Component Library/Molecules/Legend / Overflowing | "STATION" header, 8 colored bordered swatches, "+52 more, not coloured" gray overflow text, footnote | consistent, no issues
032 | Component Library/Molecules/Legend / Populated | "STATION" header, 4 colored bordered swatches (north/south/east/west) | consistent, no issues
033 | Component Library/Molecules/Legend / With A Custom Entry Renderer | "STATION" header, 3 colored bordered swatches, identical layout to Populated | no visible difference from the default renderer — story doesn't visually demonstrate any customization
034 | Component Library/Molecules/MoreBar / Counts | six stacked pale-yellow bordered bars "— N more rows — click to show" | consistent, no issues
035 | Component Library/Molecules/MoreBar / Default | single pale-yellow bordered bar "— 1.2k more lines — click to show" | consistent, no issues
036 | Component Library/Molecules/MoreBar / Empty | label "HIDDEN = 0, AND HIDDEN = -5" then a plain white bordered box, "both rendered null" | box is plain white/unfilled rather than the pale-yellow used for populated MoreBar rows (034/035) — different treatment for the empty case
037 | Component Library/Molecules/MoreBar / In A List | four numbered file lines then a pale-yellow "— 36 more lines — click to show" bar | consistent, no issues
038 | Component Library/Molecules/ResultLog / Chaining | header text, two small blue-bordered number chips ("3"/"4"), a full-width plain gray-bordered "reset" bar | "reset" renders as a full-width flat gray bar resembling a MoreBar row rather than a compact button, inconsistent with the small chip-style number boxes above it
039 | Component Library/Molecules/ResultLog / Default | log lines with small blue-bordered inline value chips (data.temp_c, 7, 14) | consistent, no issues
040 | Component Library/Molecules/ResultLog / Echo | log line with blue chip "7", followed by muted italic tip text | consistent, no issues
041 | Component Library/Molecules/ResultLog / Empty | two plain unboxed text lines | no box chrome, inconsistent with the wider component set that boxes its empty states
042 | Component Library/Molecules/ResultLog / No Wrapper | describe/sum log identical in style to Default, chips inert | consistent, no issues
043 | Component Library/Molecules/ResultLog / Wrapping | sentence with inline bordered chips, mixing green-bordered and blue-bordered chips | mixed chip border colors (green vs blue) in the same sentence with no legend distinguishing meaning
044 | Component Library/Molecules/SegmentedBar / Composition Versus Budget | "NO TOTAL" borderless segmented bar vs "TOTAL 24000" black-bordered bar with hatched remainder | border presence inconsistent between the two bars shown together
045 | Component Library/Molecules/SegmentedBar / Default | single black-bordered segmented bar with gray/lavender/green/blue segments plus hatched remainder | consistent, no issues
046 | Component Library/Molecules/SegmentedBar / Degenerate | four stacked bars: empty, fully-hatched, "every weight zero", "negative weight" solid blue | the zero/negative-weight bars show an odd thin multicolor hairline sliver at the left edge, looking like a rendering artifact
047 | Component Library/Molecules/SegmentedBar / Density | three unbordered multi-segment bars (3/12/60 segments) | no outer border at all, unlike Default (045) and States (049) — inconsistent border treatment across SegmentedBar stories
048 | Component Library/Molecules/SegmentedBar / Overflow | three-segment bar (green/blue/purple) with a dark maroon/red outline and tiny "OVER" label | border color is dark red/maroon instead of black; "OVER" text is tiny/low-contrast against the purple segment
049 | Component Library/Molecules/SegmentedBar / States | single black-bordered bar, four equal segments divided by black lines | consistent, no issues
050 | Component Library/Molecules/SegmentedBar / With Legend | top bar "15k/24k · 62%" with hatched remainder (no border), KindLegend-style list below | top bar lacks the black border seen in Default (045) — same inconsistency as 044/047
051 | Component Library/Organisms/BackdropPanel / A Different Frame | tall vertical framed grid, scattered colored dot markers | consistent internally, no issues
052 | Component Library/Organisms/BackdropPanel / Default | basketball half-court diagram, green filled dots and red/orange hollow-circle markers | consistent, no issues
053 | Component Library/Organisms/BackdropPanel / Empty | same court diagram, no markers | consistent, correctly shows the empty variant
054 | Component Library/Organisms/BackdropPanel / Redundant Encoding | court diagram, markers plus header caption explaining fill+color encoding | consistent, no issues
055 | Component Library/Organisms/BackdropPanel / With Zone Summary | court diagram plus bold stat overlay top-left | consistent, no issues
056 | Component Library/Organisms/Dialog / Default | white rounded-corner modal card on blue-gray backdrop, bold title, bordered [x] close button, bordered textarea | consistent, no issues
057 | Component Library/Organisms/Dialog / Live Close | identical rendering to Default (056) | BLANK/NEEDS INTERACTION — static capture shows only the idle dialog, "live close" interaction not captured
058 | Component Library/Organisms/Dialog / Theme Overrides | dark navy modal card on blue-gray backdrop, light text, blue-bordered close button, textarea | textarea stays white/light-themed and does not inherit the dark navy card theme — inconsistent theming between dialog chrome and its input field
059 | Component Library/Organisms/Dialog / Unstyled | no card/backdrop/border at all, plain title, plain bordered close button and textarea | consistent with the intentional "unstyled" pattern (JsonBlock Unstyled)
060 | Component Library/Organisms/FileBrowser / A Failed Root | bordered tree box, "mini (fixture project)" with children, red error line "vendor: permission denied" | consistent, no issues
061 | Component Library/Organisms/FileBrowser / Deep Nesting | bordered tree box showing only a single collapsed row, large empty white space below | very sparse content for a "Deep Nesting" story
062 | Component Library/Organisms/FileBrowser / Loading | bordered box showing only "loading…" text, rest blank | BLANK/NEEDS INTERACTION — no spinner/skeleton content
063 | Component Library/Organisms/FileBrowser / No Roots | bordered box, "no file roots on this server" plus hint text | consistent with other plain-text empty states
064 | Component Library/Organisms/FileBrowser / Typical Project | tree list, bold folders, plain file text | consistent, no issues
065 | Component Library/Organisms/FileBrowser / Unicode Names | tree list with "Café.lean" appearing twice, "定理.lean", "δοκιμή.lean" | "Café.lean" listed twice in a row — reads as a duplicate rather than a distinct unicode test case
066 | Component Library/Organisms/FileBrowser / With Presentation | nested tree, caption "last verb: (none yet)" | file names under "Mini" render in blue/link-style text while sibling files elsewhere in the same tree render plain black — inconsistent file-name coloring within one tree
067 | Component Library/Organisms/InspectorPanel / Custom Renderer | bold "PERSON" header, plain unboxed key/value list | plain-text rendering, no box, quite different from the dark JsonBlock-style box used in Default (068) for the same object
068 | Component Library/Organisms/InspectorPanel / Default | bold "PERSON" header, dark navy JsonBlock-style box with syntax-highlighted JSON | consistent with JsonBlock Default (020), no issues
069 | Component Library/Organisms/InspectorPanel / Empty | plain unboxed text "Right-click an object and choose Inspect." | BLANK/NEEDS INTERACTION — no panel content, just a hint line
070 | Component Library/Organisms/InspectorPanel / Unstyled | header text "Person" (title case) followed by the same dark navy JSON box as Default | heading capitalization differs — "PERSON" all-caps in Default/Custom Renderer vs "Person" title-case here
071 | Component Library/Organisms/RadarPanel / Default | radar chart, 3 overlapping semi-transparent colored polygons, bordered legend rows | consistent, no issues
072 | Component Library/Organisms/RadarPanel / Edges | two stacked single-series radar charts, bordered legend box | consistent with Default, no issues
073 | Component Library/Organisms/RadarPanel / Refusals | three stacked plain-text refusal messages, no chart, no box | no chart drawn at all — appropriate given the refusals, but visually blank/text-only vs every other RadarPanel story
074 | Component Library/Organisms/RadarPanel / Single | single teal radar polygon with bordered legend row | consistent, no issues
075 | Component Library/Organisms/RadarPanel / Too Many Series | radar chart with 3 of 5 series drawn, orange/tan warning caption | consistent warning-glyph convention, no issues
076 | Component Library/Organisms/TransportBar / Bounds | four stacked transport bar rows, bordered playback buttons, scrubber tracks, counters | consistent, no issues
077 | Component Library/Organisms/TransportBar / Default | single bar, dark filled scrubber thumb mid-track, counter "14 / 31" | consistent, no issues
078 | Component Library/Organisms/TransportBar / Empty | single bar, faint/gray disabled-looking thumb, counter shows "–" | thumb/track render in notably lower-contrast gray than active Default (077); counter format switches from "N / 31" to a bare dash
079 | Component Library/Organisms/TransportBar / Interactive | bar, counter "5 / 8", bold caption "addFilter data.temp_c > 20" | consistent, no issues
080 | Component Library/Organisms/TransportBar / Single | bar, counter "1 / 1", caption "newDoc" in blue link-style text | caption styled as a blue link, inconsistent with plain black bold captions in other TransportBar stories
081 | Design System/Atoms/Button / Bare — the default | inline text row: "Commit" (black), "Discard" (orange/red), "Selected" (yellow-highlighted), "Disabled" (gray), "minting…" (gray italic) | only "Selected" gets a background highlight; others get none — inconsistent visual-state affordance (caption explains this is the intentionally unstyled catalog)
082 | Design System/Atoms/Button / Both sizes — the divergence that started this | tiny (9.5px) and small (10.5px) black-bordered square buttons side by side | caption itself flags the inconsistency: tiny vs small buttons use two different unreconciled font sizes (9.5px vs 10.5px)
083 | Design System/Atoms/Button / Framed | four buttons: "new doc" (black border/text), "remove" (red border/text), "selected" (solid pale-yellow fill, bold), "disabled" (faded gray) | consistent square corners; state conveyed by fill/color rather than shape
084 | Design System/Atoms/Button / Pressed Is Announced | two square buttons "on" (yellow/gold fill) and "off" (white) | consistent, no issues
085 | Design System/Atoms/CheckboxRow / Disabled | single grayed-out checked checkbox plus three grayed unchecked labels | consistent, no issues
086 | Design System/Atoms/CheckboxRow / Sizes | two rows, top checked (blue fill), bottom unchecked | titled "Sizes" but both checkboxes render at the same visual size — no size differentiation visible
087 | Design System/Atoms/CheckboxRow / The Scope Picker | one blue-filled checked box plus three unchecked boxes | consistent, no issues
088 | Design System/Atoms/Chip / Every Tone | 8 tone chips, each with a colored left-border stripe | consistent square-cornered chip shape across all tones
089 | Design System/Atoms/Chip / States | 5 chips: default (blue border), active (solid yellow fill), stale (dashed border), disabled (faded gray), strong (bold blue border) | consistent square corners; five materially different treatments by design
090 | Design System/Atoms/Chip / Truncation | single chip, truncated path with ellipsis | consistent, no issues
091 | Design System/Atoms/Chip / With Badges | "temp_c | q" chip with a vertical divider before its badge, and "station n · 12" chip with no divider | inconsistent badge separator: one chip has a vertical bar before the badge, the other none
092 | Design System/Atoms/CodeLine / Bare | plain JSON code text, blue/orange syntax coloring, no line numbers or border | consistent, no issues
093 | Design System/Atoms/CodeLine / Blame | code line with numbered gutter and small colored blame marks on the left edge | consistent, no issues
094 | Design System/Atoms/CodeLine / Blank Lines | diff hunk with two added blank lines highlighted pale green | consistent, no issues
095 | Design System/Atoms/CodeLine / Default | single numbered code line, plain monospace text | consistent, no issues
096 | Design System/Atoms/CodeLine / Ops | diff view, one red/pink removed line, three green added lines | consistent, no issues
097 | Design System/Atoms/IconButton / Bare | three small "x" icon buttons in a row, no borders | middle "x" glyph renders red/orange while the other two are black — unexplained color inconsistency
098 | Design System/Atoms/IconButton / Disabled | two square-bordered icon buttons (up/down arrows) | both render solid black with no dimming despite the "Disabled" story name
099 | Design System/Atoms/IconButton / The Glyphs In Use | row of 5 square icon buttons plus a "⋮" menu glyph | the two "x" glyph buttons differ in color — one black, one red-orange
100 | Design System/Atoms/LinkAction / Matches Button | "a LinkAction" and "a Button" render as identical square-bordered boxes | consistent, no issues
101 | Design System/Atoms/LinkAction / The Sign In Affordances | plain bold blue-black text links with arrow glyphs | consistent, no issues
102 | Design System/Atoms/Meter / Alarm | three meter pairs at 50%/80%/97%, default vs "alarm on" fill | at 80% the alarm-on bar renders pale green rather than a warning color; only 97% turns red — unintuitive color progression for an "alarm" state
103 | Design System/Atoms/Meter / Default | single gray-blue meter bar with "14.9k / 24k" label | consistent, no issues
104 | Design System/Atoms/Meter / Hostile Input | four meter rows for edge-case values (NaN, +Infinity, over-budget, negative) | consistent — clamps correctly, no broken layout
105 | Design System/Atoms/Meter / Sizes | small fixed-width meter set above a full-row-width meter | consistent, no issues
106 | Design System/Atoms/Meter / Tones | four colored fill bars (blue/green/purple/red) each with matching-color label | consistent, no issues
107 | Design System/Atoms/SelectInput / Disabled | single grayed-out select showing "reader" | consistent, no issues
108 | Design System/Atoms/SelectInput / Empty | select with placeholder "choose a drop…" plus helper text | consistent, no issues
109 | Design System/Atoms/SelectInput / Populated | two stacked selects | consistent, no issues
110 | Design System/Atoms/SelectInput / With Placeholder | single select, placeholder plus helper text | consistent, no issues
111 | Design System/Atoms/Sparkline / Default | small blue line chart in a thin black-bordered box | consistent, no issues
112 | Design System/Atoms/Sparkline / Degenerate | four boxes: empty, one point, flat/zero-range, all non-finite | the "flat — zero range" box has a distinctly blue-tinted border while the others use plain black borders
113 | Design System/Atoms/Sparkline / Gaps | single sparkline with a visible break where a sample is missing | consistent, no issues
114 | Design System/Atoms/Sparkline / Sizes | three sparklines of increasing box size | consistent, no issues
115 | Design System/Atoms/Sparkline / Threshold | two sparklines with dashed threshold line, one blue (under), one red (crosses) | consistent, no issues
116 | Design System/Atoms/Swatch / In A Legend Row | three small square color swatches with text labels | consistent, no issues
117 | Design System/Atoms/Swatch / Narrow Container | single red swatch with truncated label | consistent, no issues
118 | Design System/Atoms/Swatch / The Categorical Palette | row of 8 small color swatches, no labels | consistent, no issues
119 | Design System/Atoms/TextArea / Empty | large empty bordered textarea, JSON placeholder snippet top-left | consistent, no issues
120 | Design System/Atoms/TextArea / Invalid | dashed red border textarea containing CSV data | consistent, no issues
121 | Design System/Atoms/TextArea / One Long Line | bordered textarea, long JSON id string, visible resize handle | consistent, no issues
122 | Design System/Atoms/TextArea / With Bundle | bordered textarea, pretty-printed multi-line JSON, resize handle | consistent, no issues
123 | Design System/Atoms/TextInput / Disabled | grayed input with pale gray fill | consistent, no issues
124 | Design System/Atoms/TextInput / Empty | input showing placeholder text | consistent, no issues
125 | Design System/Atoms/TextInput / Invalid | dashed red border input, red error text below | consistent, no issues
126 | Design System/Atoms/TextInput / The Four It Replaced | four stacked inputs (text, text, email, password dots), same border/height | consistent, no issues
127 | Design System/Atoms/TextInput / Widths And Sizes | narrow, wide-empty, and wide-populated inputs | consistent — three explicit widths as intended
128 | Design System/Foundation/CodeText / Long Unbreakable Values | sha256 hash string wrapping across three lines in a bordered box | consistent, no issues
129 | Design System/Foundation/CodeText / Sizes | three code-text rows on a very light gray zebra background | consistent, no issues
130 | Design System/Foundation/CodeText / The Values It Marks | four label:value lines, colored monospace values inline in plain prose | consistent, no issues
131 | Design System/Foundation/Divider / Against A Border | bordered box, solid divider vs dashed divider, each labeled | consistent, no issues
132 | Design System/Foundation/Divider / Spacing | four dashed dividers, increasing gaps | consistent, no issues
133 | Design System/Foundation/Divider / Variants | "dashed separates sections" rule, then "dotted separates rows" label | the rule preceding the "dotted separates rows" caption renders as a plain solid line, not dotted — visual doesn't match its own label
134 | Design System/Foundation/Divider / Vertical | "left" and "right" text with a gap between them | no visible vertical rule renders between "left" and "right" — the divider itself doesn't appear
135 | Design System/Foundation/Kbd / In Prose | inline bordered key caps within a sentence, plus a standalone row of key caps | consistent square key-cap borders throughout
136 | Design System/Foundation/Text / On An Inverted Surface | dark navy bar, bold white heading text, faint gray secondary text | consistent, no issues
137 | Design System/Foundation/Text / Prose And Truncation | looser-leading paragraph, bordered box with truncated dotted path, caption below | consistent, no issues
138 | Design System/Foundation/Text / Section Labels | three uppercase, letter-spaced, gray section-label lines | consistent, no issues
139 | Design System/Foundation/Text / Sizes | five text rows at 8.5/9.5/10.5/11.5/13px, progressively larger | consistent, no issues
140 | Design System/Foundation/Text / Tones | two bordered panels ("ON PANE" white, "ON ALT" pale gray), each with default/faint/danger/ok tone text | consistent, no issues
141 | Design System/Foundation/Tokens / Tokens | full token reference sheet: surface/text swatches, presentation-type and field-type tone chips, 8-color categorical palette + gradient ramp, 5-step type scale, structure row (hairline/firm/raised/floating/selected/inverted/kbd), "THE TEN RULES" list (no border-radius anywhere, 1-2px solid borders, offset-never-blurred shadows, one monospace font, etc.) | this sheet documents the intended system and is the reference every other oddity in this audit should be checked against — e.g. the rounded "an action" buttons at 155 directly contradict Rule 01 here, and the flat/raised/floating surfaces at 151 don't show the promised offset shadow
142 | Design System/Foundation/VisuallyHidden / Live Region | only descriptive caption text visible, component is intentionally screen-reader-only | not a bug — expected behavior, no visible pixels by design
143 | Design System/Foundation/VisuallyHidden / Takes No Space | bordered box, "first line"/"second line" adjacent | consistent, no issues
144 | Design System/Layout/AppBody / Flush | pale cream/off-white background, "no padding" text | consistent, no issues
145 | Design System/Layout/AppBody / Scrolls | bordered box, header "A TILE" with divider, scrollable list rows 1-30 | consistent, no issues
146 | Design System/Layout/Stack / Directions | "column" and "row" stacks of the same two small pale chips | consistent, no issues
147 | Design System/Layout/Stack / Gaps | six rows of three small boxes with progressively increasing gap sizes | consistent, gap increases evenly
148 | Design System/Layout/Stack / Long Content Does Not Blow Out The Box | fixed-width "fixed" chip immediately followed by long truncating text | no visible gap between the "fixed" chip and adjacent truncated text — they appear to touch
149 | Design System/Layout/Stack / Wrapping | nine "item N" chips wrapping into two rows | consistent, no issues
150 | Design System/Layout/Surface / Borders | "none" (no box), thin-bordered "hair" box, thicker-bordered "firm" box | consistent progression, no issues
151 | Design System/Layout/Surface / Elevation | three boxes labeled "flat"/"raised"/"floating" | all three render with the same plain 1px black border and no visible drop shadow — no elevation differentiation despite the token sheet (141) specifying offset shadows
152 | Design System/Layout/Surface / Padding | four boxes pad-0/pad-2/pad-3/pad-4 | "pad-0" box has an orange/red-tinted border and text color, others plain black — inconsistent accent singled out on the zero-padding example
153 | Design System/Layout/Surface / Tones | four boxes: PANE/ALT/SELECTED/INVERTED, each with body + faint text | consistent, no issues
154 | Design System/Layout/Toolbar / Does Not Shrink | bordered box, full-width toolbar (label, select, "+" icon button) over scrolling body rows | consistent, no issues
155 | Design System/Layout/Toolbar / Variants | three boxes (DEFAULT/TIGHT/BORDERED), each with an "an action" button | the "an action" buttons render with visibly rounded/pill corners, unlike the sharp square corners used by every other button/chip/input in the package — directly contradicts the token sheet's "no border-radius, anywhere" rule (141); most notable inconsistency in core
156 | Presentation/Interaction (KERNEL-4) / Accept Chooser And Banner | gray "pick a person…" trigger bar, two square chips, status text | consistent, no issues
157 | Presentation/Interaction (KERNEL-4) / Explain The Menu | chip, blue-filled circular radio buttons, light-gray JSON code panel below | consistent, no issues
158 | Presentation/Interaction (KERNEL-4) / Stale Row Refusal | unchecked "directory locked" checkbox, chip, status text | consistent, no issues
159 | Presentation/PBUI Protocol / Default | two square chips on white background | consistent, no issues
160 | Presentation/PBUI Protocol / Theme Overrides | same two chips on dark navy inverted background with light text/borders | consistent, inverted theme applies correctly
161 | Presentation/PBUI Protocol / Two Isolated Providers | side-by-side light-theme and dark-theme panels rendering identical chip content | consistent, no issues
162 | Presentation/PBUI Protocol / With Contextual Help | two chips on white background | consistent, no issues

---

## datalab-ui (http://localhost:6013)

001 | Applications/Embedding / Authoring With Fixtures | stacked Encoding (gold header) + Chart (salmon header) tiles, doc pills, "loading plot…" | red "△ not in the pipeline output" warning text sits inline in a channel row with no spacing above it, crowds the row
002 | Applications/Embedding / Default | full 4-tile build workspace: Pipeline (purple), Encoding (gold), Chart (salmon), Table (green) | tile header colors are strong/saturated while body chrome stays plain black-on-white — high contrast jump between header bar and content
003 | Applications/Embedding / Scoped Applications | same 4-tile stack as Default | consistent, no issues
004 | Applications/Embedding / Two Instances | two full app instances side by side, split by a thin black divider | divider is a solid black bar with no padding, content nearly touches it on both sides
005 | Applications/Embedding / With Fixtures | Chart + Table tiles both showing "loading plot…" / "loading…" placeholders | BLANK/NEEDS INTERACTION — only loading-state text visible, no chart or table rendered
006 | Applications/Marketing/Page / Default | long scrolling marketing/landing page, monospace type, boxed feature sections, footer | very dense small monospace text with minimal visual hierarchy — headings barely differ in size from body copy
007 | Applications/Tiles / About | doc/glossary explainer with three example chips (blue field, green stream, red doc) | three chip styles shown side by side as "the glossary" — inconsistent outline colors for conceptually similar chip shapes
008 | Applications/Tiles / All Tiles | giant composite catalog of nearly every tile type stacked vertically | extremely long single-page stack with many repeated colored header bars — hard to parse where one tile group ends and the next begins
009 | Applications/Tiles / Brief | "0/5" progress counter, bulleted brief checklist, "I'm stuck" button | consistent, no issues
010 | Applications/Tiles / Brief Outside A Tour | plain two-line text "No brief here" | BLANK/NEEDS INTERACTION — only placeholder text, no chrome/border
011 | Applications/Tiles / Chart | rendered line chart, 4 colored series, legend right side | orange "roof" line spikes to a flat plateau while others hover much lower — dominates the chart with no annotation
012 | Applications/Tiles / Chart With No Document | empty doc dropdown, "no source" text | BLANK/NEEDS INTERACTION — empty doc selector, no chart content
013 | Applications/Tiles / Charts | blank canvas, "+ new document" button, one composition summary card at bottom | large empty white area above a single small card; card sits flush at bottom edge with no margin
014 | Applications/Tiles / Cheat | "OBJECTS" reference table | consistent, no issues
015 | Applications/Tiles / Cheat Outside A Tour | plain two-line text "No cheat sheet here" | BLANK/NEEDS INTERACTION — only placeholder text
016 | Applications/Tiles / Compare | "A empty"/"B empty" labels with "accept…" buttons | BLANK/NEEDS INTERACTION — nothing to compare yet
017 | Applications/Tiles / Encoding | full encoding panel, mark=line highlighted amber, mapped chips with blue outline | mapped-field chips use a blue focus-style outline even at rest, while unmapped rows use plain gray dashes — two different "field slot" treatments in one panel
018 | Applications/Tiles / Gallery | explainer text, "No snapshots. Use ⎙ in the charts tile." | BLANK/NEEDS INTERACTION — informational text only
019 | Applications/Tiles / Inspector | plain text "Nothing inspected yet…" | BLANK/NEEDS INTERACTION — instructional text only
020 | Applications/Tiles / Launcher | centered "OPEN A VIEW" search box with quick links | search box has a heavy black border and flat fill, everything else on the page is borderless text — stands out sharply
021 | Applications/Tiles / Launcher Scoped | same centered search layout, different quick-link set | consistent, no issues
022 | Applications/Tiles / Lessons | "0/4" step list, step 1 expanded with pale-yellow highlight band | pale-yellow tint is a distinct warm color not used consistently for "active" state elsewhere
023 | Applications/Tiles / Lessons Grammar | "0/6" step list, same expanded-step pattern | consistent with 022, no new issues
024 | Applications/Tiles / Lessons Outside A Tour | plain two-line text "No lessons here" | BLANK/NEEDS INTERACTION — only placeholder text
025 | Applications/Tiles / Modules | reference page: doc-bound and world-singleton chip rows, module description block | two rows of chips packed edge-to-edge with barely any gap — cramped vs. generous text spacing below
026 | Applications/Tiles / Pipeline | field-chip row with small amber type-badges | amber corner badges are tiny and low-contrast against the white chip background
027 | Applications/Tiles / Profile | plain text "not signed in" | BLANK/NEEDS INTERACTION — auth-gated empty state
028 | Applications/Tiles / Sign In | "SIGN IN" heading, paragraph, "Sign in →" link | consistent, no issues
029 | Applications/Tiles / Sign Up | "DATA LAB" wordmark, light-gray "This deployment is closed" notice box | notice box reuses the flat pale-gray fill also used for error/crash states — "deployment closed" reads visually identical to an error message
030 | Applications/Tiles / Sources | token input, DROP dropdown, STREAMS list, DATASETS dropdown | large empty vertical whitespace around a handful of small form controls
031 | Applications/Tiles / Table | full data grid, amber type-badges in every header cell, alternating row shading | badges repeat on every column, adding visual noise
032 | Applications/Tiles / Templates | "TEMPLATES 0 of 50 saved" header, "Import from clipboard" button, "No stored templates" | consistent, no issues
033 | Applications/Tiles / Tokens | plain text "not signed in" | BLANK/NEEDS INTERACTION — auth-gated, identical to 027
034 | Applications/Tiles / Trace | plain text "Nothing yet — map a field, add a step." | BLANK/NEEDS INTERACTION — instructional placeholder only
035 | Applications/Tiles / Tutorial 1 | numbered steps, one green action button, footer link | the single green action button is the only saturated-color element on an otherwise black/gray/blue page
036 | Applications/Tiles / Tutorial 2 | numbered steps, multiple green action buttons | green buttons vary in width to fit label text with no minimum width — ragged left-aligned edges
037 | Applications/Tiles / Tutorial 3 | numbered steps, green action buttons | same ragged-width button issue as 036
038 | Applications/Tiles / Tutorial 4 | numbered steps, green action buttons | same ragged-width button issue as 036/037
039 | Applications/Tiles / Upload | plain text "sign in to publish a dataset" | BLANK/NEEDS INTERACTION — auth-gated empty state
040 | Applications/Tiles / Watchlist | amber/tan filled "Watch… (accepts anything)" button, "Nothing watched…" caption | this is the only solid amber-filled button in the whole package — every other action button elsewhere is a text-link or green/white-outlined
041 | Applications/Tour/Band / Default | very long composite capture spanning quick-link chips and repeated tile groups | the amber-filled Watch button (40), pale-yellow lesson bands, and gray notice boxes all appear together, making the "special background" inconsistency very visible in one page
042 | Applications/Tour/Section / The Brief | "§ +" pill, "The brief" heading, gray error box "⚠ The workbench could not render — useAnalysisResultFor must be used inside AnalysisProvider" | component crash — the intended brief UI never appears, only the gray warning box with a "Try again" link
043 | Applications/Tour/Section / The Grammar | "§ C" pill, "The grammar of graphics" heading, same gray error box | same workbench-render crash as 042
044 | Applications/Tour/Section / With Rack | "§ D" pill, "The modules" heading, same gray error box | same crash — no rack layout appears
045 | Applications/Tour/Section / With Rail | "§ A" pill, "Objects and verbs" heading, same gray error box | same crash — 4 consecutive stories (042-045) all fail identically
046 | Applications/Workbench / Default | full app chrome: black top nav, workspace tabs, 4 colored tiles | bottom of the frame cuts off mid-tile with a visible scrollbar track and partial status text — capture appears clipped before full render
047 | Applications/Workbench/DeviceApprovalPage / Missing Pairing Link | gray "⚠ Invalid device approval link" notice box, "Open Datadrop" link | consistent with the gray notice-box style used elsewhere
048 | Component Library/Molecules/ChannelRow / Every Channel | 5 unmapped channel rows, "+"/"×" icon pairs, no container | no border/card wrapper around the row list, unlike CheatCard's framed variant (052)
049 | Component Library/Molecules/ChannelRow / Mapped | x/y chips mapped with "+"/"×" icons | consistent, no issues
050 | Component Library/Molecules/ChannelRow / Stale | y-channel shows orange/red "not in the pipeline output" warning text | warning text runs directly inline with the chip, no background tint or badge separation, relies entirely on color
051 | Component Library/Molecules/ChannelRow / With Live Presentations | x/y chips with dashed blue border and small "△" corner badge | dashed-blue "live" chip is a third distinct border treatment vs solid blue (049) and plain gray dash (048) for the same "mapped field" concept
052 | Component Library/Molecules/CheatCard / Framed | "OBJECTS" content inside a solid black-bordered box | consistent, no issues
053 | Component Library/Molecules/CheatCard / Objects | same content, only a thin top rule, no border box | framed (052) vs unframed (053) variants of identical content look like two different components
054 | Component Library/Molecules/CheatCard / Shell | "SHELL" content, thin top rule only | unframed like 053
055 | Component Library/Molecules/CheatCard / Short | "GRAMMAR" content, thin top rule only, shorter list | unframed like 053/054
056 | Component Library/Molecules/DocBar / Follows The Active Document | DOC strip, red-bordered "α" active pill, dropdown, "+" button | consistent, no issues
057 | Component Library/Molecules/DocBar / Two Tiles One Document | two identical stacked DOC strips | gap between the two bars but no divider/label distinguishing which tile each belongs to
058 | Component Library/Molecules/DraftResumeList / Cannot Resume Yet | tan/cream notice box, greyed "resume" text, orange "discard" link | tan/cream notice tint is a third distinct neutral-notice tone (vs gray crash boxes 042-045, pale-yellow lesson band 022) for similar semantic roles
059 | Component Library/Molecules/DraftResumeList / No Drafts | plain text "nothing above this line" | BLANK/NEEDS INTERACTION — minimal placeholder text only
060 | Component Library/Molecules/DraftResumeList / One Draft | tan notice box, active blue "resume" link, orange "discard" link | same tan/cream tint inconsistency as 058
061 | Component Library/Molecules/DraftResumeList / Several Drafts | tan notice box, 3 stacked draft rows | same tan/cream tint inconsistency as 058
062 | Component Library/Molecules/ErrorNotice / Carries Without Colour | orange/red "× could not mint the token" text plus accessibility caption | consistent, no issues
063 | Component Library/Molecules/ErrorNotice / The Real Messages | 4 stacked orange "×"-prefixed error lines | consistent, no issues
064 | Component Library/Molecules/GoalItem / A List | mixed list, green "✓" checked (greyed text) and plain "·" bullet pending items | consistent, checked vs unchecked clearly differentiated
065 | Component Library/Molecules/GoalItem / Not Yet | single plain "·" bullet item | consistent, no issues
066 | Component Library/Molecules/GoalItem / Satisfied | single item, green "✓" check, greyed text | consistent, no issues
067 | Component Library/Molecules/HintList / Exhausted | 5 hint bullet lines fully revealed | consistent, no issues
068 | Component Library/Molecules/HintList / Interactive | single bordered "I'm stuck — one hint" button, nothing else | BLANK/NEEDS INTERACTION — only trigger button rendered
069 | Component Library/Molecules/HintList / Two Revealed | 2 hint bullets shown, button still below | consistent, no issues
070 | Component Library/Molecules/HintList / Untouched | only the "I'm stuck" button | BLANK/NEEDS INTERACTION — identical bare-button state to 068
071 | Component Library/Molecules/LessonStep / As A Rail | 4-step list, three different step-status icon treatments (solid green check, muted grey check + "WATCHED" text, plain unstarted) | icon color coding isn't obviously explained without the accompanying text label
072 | Component Library/Molecules/LessonStep / Collapsed | single collapsed row, no border box | no chevron/arrow icon visible to signal it's collapsible
073 | Component Library/Molecules/LessonStep / Manual | step expanded, pale-yellow band, green "✓ got it" button | pale-yellow tint again differs from the gray notice-box tint used elsewhere
074 | Component Library/Molecules/LessonStep / Open | step expanded, pale-yellow band, black-bordered "▶ do it for me" button | two different action-button styles (solid green in 073 vs white/black-border here) for what represents the same primary CTA
075 | Component Library/Molecules/LessonStep / Self | dark-filled green check icon, pale-yellow band, no button | icon fill (solid dark green) differs slightly from the lighter check icon in 071
076 | Component Library/Molecules/LessonStep / Watched | green check icon, "WATCHED" label, pale-yellow band | consistent with 071/073-075 palette notes
077 | Component Library/Molecules/MemberInvite / Default | email input, role dropdown "reader", "add" link | consistent, no issues
078 | Component Library/Molecules/MemberInvite / Lookup Failed | input with dashed red border, orange error line | dashed-red input border is a distinct error language not used by ErrorNotice (062/063), which uses plain orange text with no border change
079 | Component Library/Molecules/MemberRow / As A Reader | 3 stacked green-bordered chip rows, read-only | consistent, no issues
080 | Component Library/Molecules/MemberRow / As An Admin | 2 rows with editable role dropdown and red "remove" link | only 2 of the 3 members from 079 shown — apples-to-oranges comparison between reader/admin views
081 | Component Library/Molecules/MemberRow / Only An Id | single row with dropdown + remove link | consistent, no issues
082 | Component Library/Molecules/MemberRow / The Owner | single row, greyed-out disabled dropdown and "remove" text | consistent — disabled state clearly greyed vs active red "remove" in 080/081
083 | Component Library/Molecules/ModuleCard / Mostly Empty | plain "INSPECTOR" heading with underline rule, description rows | no card border/box at all despite being named "ModuleCard" — CheatCard's framed variant (052) uses a solid border for comparable content
084 | Component Library/Molecules/ModuleCard / Narrow | text-only "UPLOAD" card, monospace rows, black status bar | no outer border box; large unused white space to the right of the narrow text column
085 | Component Library/Molecules/ModuleCard / Pipeline | same card layout, "PIPELINE" title | same missing-border pattern as 084
086 | Component Library/Molecules/ModuleCard / Table | same card layout, "TABLE" title | same missing-border pattern as 084/085
087 | Component Library/Molecules/PredictPrompt / The Geom Question | dashed-border question box, two sharp-cornered answer buttons | consistent, no issues
088 | Component Library/Molecules/PredictPrompt / Three Options | dashed-border box, three answer buttons | consistent, no issues
089 | Component Library/Molecules/PredictPrompt / Unanswered | dashed-border box, two answer buttons | consistent, no issues
090 | Component Library/Molecules/ScopeChecklist / All Selected | 4 native blue checkboxes, all checked | no outer border box around the row, unlike bordered molecules elsewhere
091 | Component Library/Molecules/ScopeChecklist / Default | 1 of 4 checked | same no-border pattern as 090
092 | Component Library/Molecules/ScopeChecklist / Disabled | checkboxes greyed/disabled, extra helper line | disabled checkboxes render pale washed-out blue rather than standard grey disabled style
093 | Component Library/Molecules/ScopeChecklist / None Selected | all 4 unchecked | consistent with siblings
094 | Component Library/Molecules/SpecDiff / Asymmetric Keys | two-column key/value diff table in a solid black-bordered box, orange-red highlights on differing rows | consistent, sharp corners, no issues
095 | Component Library/Molecules/SpecDiff / Differing | many rows highlighted orange-red | consistent with 094
096 | Component Library/Molecules/SpecDiff / Identical | all rows plain black | consistent, no issues
097 | Component Library/Molecules/SpecDiff / One Side Empty | right column all dashes, left column all flagged | consistent, no issues
098 | Component Library/Molecules/SpecSummary / A Specification | one-line summary in a tall bordered square box | text confined to top-left corner, ~90% of the box is empty whitespace
099 | Component Library/Molecules/SpecSummary / No Source | one-line summary | same large empty-space pattern as 098
100 | Component Library/Molecules/SpecSummary / Nothing Mapped | one-line summary, unmapped channels as em-dash placeholders | same large empty-space pattern
101 | Component Library/Molecules/SpecSummary / With A Row Budget | one-line summary text | same large empty-space pattern
102 | Component Library/Molecules/SpecSummary / With Steps | one-line summary text | same large empty-space pattern
103 | Component Library/Molecules/StepEditor / Derive | field/operator/field row, raw JSON debug line below, bordered box | consistent within the StepEditor family; large empty space under the JSON line
104 | Component Library/Molecules/StepEditor / Derive Log 10 | derive row with log10 op, JSON below | consistent with 103
105 | Component Library/Molecules/StepEditor / Filter | field/operator/value row, JSON below | consistent with 103/104
106 | Component Library/Molecules/StepEditor / Limit | numeric input, label, JSON below | consistent, no issues
107 | Component Library/Molecules/StepEditor / No Fields Available | "(no field)" disabled dropdown, value input | placeholder text is clipped/truncated at the input's right edge instead of eliding cleanly
108 | Component Library/Molecules/StepEditor / Sort | field dropdown + "desc" dropdown, JSON below | consistent, no issues
109 | Component Library/Molecules/StepEditor / Summarize | by/mean/field row, JSON below | consistent, no issues
110 | Component Library/Molecules/StepEditor / Summarize Count | by/count row, JSON below | consistent, no issues
111 | Component Library/Molecules/StepRow / Disabled | single unchecked FILTER row, monospace chip, buttons far right | unchecked/disabled step still shows the full-color chip — weak "disabled" signal
112 | Component Library/Molecules/StepRow / Every Kind | 5 stacked rows, all checked | consistent alignment and spacing
113 | Component Library/Molecules/StepRow / First Step | single checked FILTER row | consistent with 111/112
114 | Component Library/Molecules/StepRow / Narrow | DERIVE row wrapped onto 2 lines inside its own bordered box, controls pulled inside | this row grows an actual bordered box around itself when narrow, unlike 111-113's flat outside-the-row controls — different container style from its own siblings
115 | Component Library/Molecules/TokenRow / Every Scope | token name in blue-bordered input, 4 beige/tan scope chips, "admin" chip with a bold black outline | "admin" chip has a heavier border than the other 3 pale chips in the same row
116 | Component Library/Molecules/TokenRow / Not Revokable | token box + 2 tan chips, no revoke link | consistent chip styling with 115
117 | Component Library/Molecules/TokenRow / The Lifecycle | 4 stacked token rows | last row's token-name box uses a dashed purple border instead of the solid border used by the other 3 rows
118 | Component Library/Molecules/TruncationNotice / Both Strategies | two stacked tan/khaki notice boxes with red-orange left accent, green-bordered pill chip inline | chip pill has rounded corners while the notice box itself is sharp-cornered
119 | Component Library/Molecules/TruncationNotice / Not Truncated | plain grey text line, no box | mostly blank canvas below the single line; big style jump vs 118's colored box
120 | Component Library/Molecules/UploadItemRow / Every State | 6 plain text rows with tiny status glyphs, one row red for failure | no border box, glyphs low-contrast and easy to miss as the sole state indicator
121 | Component Library/Molecules/UploadItemRow / Long Path | single row, path truncated mid-string and wraps to 2 lines | text wrapping breaks the row into an oddly narrow 2-line stack instead of a clean single-line ellipsis
122 | Component Library/Molecules/UploadItemRow / Sizes | 4 rows with varying file sizes, amber/orange note about a size limit | note text is plain grey, no accent color despite being a caveat
123 | Component Library/Molecules/UploadQueueList / Empty | header, "no files in this batch" | mostly blank below header, no border box
124 | Component Library/Molecules/UploadQueueList / Partial Failure | header + 4 rows, one failed row in red with error detail | consistent with other UploadQueueList stories
125 | Component Library/Molecules/UploadQueueList / Picked | header + 3 queued rows | consistent, no issues
126 | Component Library/Molecules/UploadQueueList / Ready To Commit | header + 2 done rows + "Commit" action text | consistent, no issues
127 | Component Library/Molecules/UploadQueueList / Uploading | header + 5 rows, mixed states | consistent, no issues
128 | Component Library/Organisms/BriefChecklist / Complete | "4/4" counter, 4 checkmarked items, boxed callout, "I'm stuck" button | callout box has a solid border while the rest of the checklist has none — one nested bordered box inside an otherwise borderless card
129 | Component Library/Organisms/BriefChecklist / Untouched | "0/4" counter, 4 bullet items, no callout box | consistent bullet style; big empty space below the short list
130 | Component Library/Organisms/BriefChecklist / With Reset | "0/4" plus bordered "↺ reset" button top-right | reset button is the only bordered element on an otherwise border-free card
131 | Component Library/Organisms/BundleDialog / Empty | modal on grey overlay, dashed-border empty textarea, greyed "Replace tile" button | disabled button uses a muted sage-green fill that's very low-contrast against white, easy to mistake for enabled
132 | Component Library/Organisms/BundleDialog / Prefilled | modal, solid-border textarea, active olive-green button, green status dot | textarea border switches from dashed (empty state, 131) to solid (populated) — inconsistent border treatment tied to state
133 | Component Library/Organisms/BundleDialog / Rejected | textarea with pasted CSV, red "x" status line | consistent modal chrome with 131/132; error text color clear
134 | Component Library/Organisms/BundleDialog / Unknown Application | JSON textarea, amber warning triangle note, active button | warning uses a plain triangle glyph with no colored background box, weaker visual weight than red error cards seen elsewhere
135 | Component Library/Organisms/BundleDialog / Workspace | different dialog title, solid-border textarea, active button | consistent chrome, no issues
136 | Component Library/Organisms/BundleDialog / Wrong Kind | dashed-border textarea, red "x" error text, disabled button | consistent with 133's error styling
137 | Component Library/Organisms/ChartPanel / A Target Outside The Data | line chart, dashed orange "target" reference line at the top edge | "target" label crowds the top axis border, nearly touching the box's top inner edge
138 | Component Library/Organisms/ChartPanel / An Undrawable Reference | dashed empty-state placeholder plus 3 stacked red-bordered error cards | consistent red error-card style; visually heavy stack of near-identical boxes
139 | Component Library/Organisms/ChartPanel / Area | stacked area chart, colored legend swatches top-right | consistent with ChartPanel family
140 | Component Library/Organisms/ChartPanel / Bar | dense bar chart, same legend | consistent, no issues
141 | Component Library/Organisms/ChartPanel / Boxplot | box-and-whisker plot, shaded IQR bands | consistent, no issues
142 | Component Library/Organisms/ChartPanel / Density | 4 overlapping density curves | consistent, no issues
143 | Component Library/Organisms/ChartPanel / Faceted | 2x2 facet grid | in the top-right facet the "time" x-axis label sits directly against/overlapping the chart's outer right border — collision not present in other facets
144 | Component Library/Organisms/ChartPanel / Filtered | line chart, same style as 139 | consistent, no issues
145 | Component Library/Organisms/ChartPanel / Histogram | dark grey/near-black bars, no legend | bars use flat dark grey/black fill instead of the category palette used everywhere else in ChartPanel
146 | Component Library/Organisms/ChartPanel / Line | standard multi-series line chart | consistent, no issues
147 | Component Library/Organisms/ChartPanel / Loading | plain "loading plot…" text, otherwise blank box | BLANK/NEEDS INTERACTION — no spinner glyph, box ~95% empty
148 | Component Library/Organisms/ChartPanel / No Source | "no source" text, blank box | BLANK/NEEDS INTERACTION — mostly empty box
149 | Component Library/Organisms/ChartPanel / Nothing To Draw Yet | dashed empty placeholder + 2 red error cards | consistent red-card style with 138
150 | Component Library/Organisms/ChartPanel / Points | scatter plot, standard legend | consistent, no issues
151 | Component Library/Organisms/ChartPanel / Regression | scatter plus fitted regression lines with shaded confidence bands | consistent, no issues
152 | Component Library/Organisms/ChartPanel / Summarized By Station | dashed placeholder + 3 red error cards | consistent with 138/149's stacking pattern
153 | Component Library/Organisms/ChartPanel / Summary Intervals | error-bar/point chart by station | consistent, no issues
154 | Component Library/Organisms/ChartPanel / Truncated | tan/khaki truncation-notice banner stacked directly above the chart, inside the same outer border | banner sits flush against the chart's top border with no gap; bottom axis label sits right against the outer border/footer rule too — cramped top and bottom
155 | Component Library/Organisms/ChartPanel / With A Legend | line chart with legend | consistent, no issues
156 | Component Library/Organisms/ChartPanel / With Reference Lines | line chart, 3 dashed horizontal reference lines clustered on the right | the three reference-line labels overlap each other and the chart's own line — illegible cluster of text
157 | Component Library/Organisms/ChartsPanel / A Document With No Source | 3 stacked document cards, red square badge, editable title box, metadata line, action row | first card lacks a "set active" button (implying already-active) while the other two have it — inconsistent visual signal for active state vs 158/160
158 | Component Library/Organisms/ChartsPanel / Many Documents | 4 stacked document cards | one card's header is fully highlighted amber/gold for "active" state — a second, different encoding of the same state vs 157
159 | Component Library/Organisms/ChartsPanel / The Last Document | single document card | consistent card chrome with 157/158
160 | Component Library/Organisms/ChartsPanel / Two Documents | 2 stacked cards, second has a plain (not highlighted) "set active" button | reinforces that 158's amber-highlighted card is the outlier treatment
161 | Component Library/Organisms/ComparePanel / Both Pinned | header with two "accept…" buttons, diff table below with orange-red differing rows | consistent solid-border box and diff-highlight style, matches SpecDiff family
162 | Component Library/Organisms/ComparePanel / Identical Specs | diff table, mostly matching rows | consistent with 161
163 | Component Library/Organisms/ComparePanel / Neither Pinned | header only, helper text, no table | mostly blank body, consistent empty-state text styling
164 | Component Library/Organisms/ComparePanel / Only A Pinned | diff table, column A populated, column B all dashes | consistent with the "one side empty" dash pattern (097)
165 | Component Library/Organisms/EncodingPanel / Every Channel Mapped | ANALYSIS/MARK pill rows (selected amber/tan), CHANNELS list, Y SCALE/FACET SCALES pills | consistent amber-selected-pill treatment across all pill groups
166 | Component Library/Organisms/EncodingPanel / Geom Bar | same layout, unmapped channels as greyed placeholder boxes | unmapped channel boxes use the same blue border as mapped ones with just grey placeholder text — could be confused with a mapped-but-empty state
167 | Component Library/Organisms/EncodingPanel / Histogram Analysis | ANALYSIS/CHANNELS/FACET SCALES sections, amber "histogram" pill selected | consistent, no issues
168 | Component Library/Organisms/EncodingPanel / Log Scale Unavailable | point mark selected, "linear" y-scale pill amber, "log" greyed/disabled | consistent, no issues
169 | Component Library/Organisms/EncodingPanel / Mapped | same layout, linear/log both outlined | consistent, no issues
170 | Component Library/Organisms/EncodingPanel / Nothing Mapped | all channels show "— unmapped —" | consistent, no issues
171 | Component Library/Organisms/EncodingPanel / Stale Mapping | color channel shows orange warning triangle "not in the pipeline output" | warning glyph/orange text is the only accent-color deviation, otherwise consistent
172 | Component Library/Organisms/EncodingPanel / Summary Analysis | "summary" amber pill selected, SE/SD and multiplier toggle rows | consistent, no issues
173 | Component Library/Organisms/GalleryPanel / A Sourceless Snapshot | single card "from a deleted drop", green-outlined chip, pin/x buttons | pin buttons look like plain bordered boxes with no visual distinction between enabled/disabled
174 | Component Library/Organisms/GalleryPanel / Both Pinned | two snapshot cards, "pinned A"/"pinned B" | consistent, no issues
175 | Component Library/Organisms/GalleryPanel / Empty | italic instructional text only | mostly blank panel below text — expected empty state, not a bug
176 | Component Library/Organisms/GalleryPanel / Populated | two snapshot cards, no pinned labels | consistent, no issues
177 | Component Library/Organisms/LauncherDialog / Arrow Keys Move The Active Row | full-page modal, rows list, first row highlighted pale yellow | grey backdrop overlay is flat mid-grey rather than a translucent dark scrim
178 | Component Library/Organisms/LauncherDialog / Empty Query | same modal, empty search box | consistent, no issues (same grey backdrop)
179 | Component Library/Organisms/LauncherDialog / Missing Workspace | query typed, 0 results, explanatory message | consistent, no issues
180 | Component Library/Organisms/LauncherDialog / Navigate Creates By Splitting | "+chart" query, 2 results | consistent, no issues
181 | Component Library/Organisms/LauncherDialog / Navigate From Cold Load | default row list, first-row highlight | consistent, no issues
182 | Component Library/Organisms/LauncherDialog / New View Query | "+chart" query, 2 results | consistent, no issues
183 | Component Library/Organisms/LauncherDialog / No Results | 0 results, explanatory message | consistent, no issues
184 | Component Library/Organisms/LauncherDialog / Out Of Scope Target | "Replace this view" modal, one row greyed with explanatory text | greyed disabled row lacks a visual affordance beyond dim text to indicate non-actionable
185 | Component Library/Organisms/LauncherDialog / Replace Target | full row list, sources highlighted | consistent, no issues
186 | Component Library/Organisms/LauncherDialog / Workspace Query | 1 result with metadata line | consistent, no issues
187 | Component Library/Organisms/LessonRail / Default | numbered list 1-4, step 1 expanded in pale-yellow card, "✓ got it" green button, counter top-left | consistent, no issues
188 | Component Library/Organisms/LessonRail / One Step | single-step version, "0/1" counter | consistent, no issues
189 | Component Library/Organisms/LessonRail / With Reset | same as Default plus "↺ reset" button top-right | consistent, no issues
190 | Component Library/Organisms/MemberPanel / As A Writer | three green-outlined member chips, plain text note below | consistent, no issues
191 | Component Library/Organisms/MemberPanel / As An Admin | same chips, role dropdowns, "remove"/"admin" actions, add-member row | one "remove" link greyed/disabled while the other two are red — inconsistent link color/weight across rows in the same list
192 | Component Library/Organisms/MemberPanel / Lookup Failed | add-member input with dashed border, red error text | dashed input border differs from the solid-border inputs used throughout the rest of the package
193 | Component Library/Organisms/MemberPanel / Nobody Else | "nobody else has access" text, single add-member row | consistent, no issues
194 | Component Library/Organisms/MemberPanel / Unowned Drop | note, chips list, one dropdown greyed/disabled | consistent, no issues
195 | Component Library/Organisms/ModuleRack / Controlled | reference doc listing tile chips, "chart" chip selected orange, detail block below | chips mix orange, green, red, purple, yellow border colors by category — many distinct hues could read as inconsistent if not documented
196 | Component Library/Organisms/ModuleRack / Default | same chip list, none selected | consistent, no issues
197 | Component Library/Organisms/ModuleRack / Pipeline | list with "pipeline" chip active, detail block shown | consistent, no issues
198 | Component Library/Organisms/ModuleRack / Table | list with "table" chip active, detail block shown | consistent, no issues
199 | Component Library/Organisms/ModuleRack / Unknown Ids Dropped | reduced chip list, detail block shown | consistent, no issues
200 | Component Library/Organisms/PipelinePanel / A Chain | FILTER/SUMMARIZE/SORT step chips, field chip row below | consistent, no issues
201 | Component Library/Organisms/PipelinePanel / A Disabled Step | FILTER step unchecked/greyed, LIMIT step checked | disabled step's checkbox/label turn light grey but its type badge stays full color — inconsistent contrast between disabled row's badge and label
202 | Component Library/Organisms/PipelinePanel / Dropped Rows | single DERIVE step | consistent, no issues
203 | Component Library/Organisms/PipelinePanel / Empty | "No steps" message | consistent, no issues
204 | Component Library/Organisms/PipelinePanel / Every Step Kind | full step chain, all checked | consistent, no issues
205 | Component Library/Organisms/PipelinePanel / One Filter | single FILTER step | consistent, no issues
206 | Component Library/Organisms/ProfilePanel / No Drops Yet | identity card, "DROPS YOU CAN SEE: none yet", sign-out box | consistent, no issues
207 | Component Library/Organisms/ProfilePanel / No Name From The Provider | identity chip shows raw id instead of name, populated drops list with A/W/R badges | consistent, no issues
208 | Component Library/Organisms/ProfilePanel / No Other Sessions | populated layout, "no other sessions" | consistent, no issues
209 | Component Library/Organisms/ProfilePanel / Sessions Still Loading | same layout, "loading…" italic grey text | consistent, no issues
210 | Component Library/Organisms/ProfilePanel / Signed In | fully populated: identity chip, 3 drop chips, 2 session rows, sign-out box | consistent, no issues
211 | Component Library/Organisms/SignInPanel / Oidc With Signup | "SIGN IN" heading, "Sign in →" link, secondary sign-up link, issuer URL | consistent, no issues
212 | Component Library/Organisms/SignInPanel / Oidc Without Signup | same panel minus the secondary link | consistent, no issues
213 | Component Library/Organisms/SignInPanel / Provider Refused | grey warning box "⚠ Sign-in did not complete" above sign-in content | warning box uses plain grey fill with no red/orange accent despite being an error state — inconsistent error-severity color coding
214 | Component Library/Organisms/SignUpPanel / Closed | wordmark, grey warning box "This deployment is closed", "Sign in →" link | consistent, no issues
215 | Component Library/Organisms/SignUpPanel / Invitation | wordmark, feature bullet list, two action links | consistent, no issues
216 | Component Library/Organisms/SignUpPanel / Just Signed Up | wordmark, "WELCOME, ADA LOVELACE" heading, single paragraph, no CTA | large empty whitespace below single paragraph — sparse but likely intended terminal state
217 | Component Library/Organisms/SignUpPanel / Just Signed Up Anonymous | same layout, "YOUR ACCOUNT IS READY" heading | consistent, no issues
218 | Component Library/Organisms/SignUpPanel / Without Issuer | same feature list as 215, missing the identity-provider URL note | consistent, no issues
219 | Component Library/Organisms/SourcePanel / Could Not List Drops | token input, red error text, empty DROP dropdown | consistent, no issues
220 | Component Library/Organisms/SourcePanel / No Datasets | DROP set, 2 stream chips, "no datasets" message | consistent, no issues
221 | Component Library/Organisms/SourcePanel / No Drops At All | "no drops here yet" message with CLI hint text | consistent, no issues
222 | Component Library/Organisms/SourcePanel / No Files In The Version | dataset selected, "no files in version 3" | consistent, no issues
223 | Component Library/Organisms/SourcePanel / No Streams | "no streams" message, dataset populated with 2 file chips | consistent, no issues
224 | Component Library/Organisms/SourcePanel / Populated | fully populated: streams, dataset dropdown, 2 file chips | consistent, no issues
225 | Component Library/Organisms/SourcePanel / With A Token | same populated layout, token field masked with dots | consistent, no issues
226 | Component Library/Organisms/StageBar / Default | dark navy top nav bar, white workspace dropdown pill on right | nav bar is dark/black while nearly every other component in this range uses a white background with black border — sharp contrast in overall app chrome vs component panels
227 | Component Library/Organisms/StageBar / Single Stage | same nav bar, single pill instead of dropdown | consistent with 226
228 | Component Library/Organisms/TablePanel / Loading | plain "loading…" text, large empty whitespace | BLANK/NEEDS INTERACTION — loading-only state, minimal content
229 | Component Library/Organisms/TablePanel / No Rows | column-header chip row only, "the pipeline produced no rows" message | consistent, no issues
230 | Component Library/Organisms/TablePanel / No Source | "no source" message, otherwise blank | consistent, no issues
231 | Component Library/Organisms/TablePanel / Populated | data grid, id/drop/stream/seq/time/received_at columns, rows 1-15 | table content only fills the left ~636px of an 1280px-wide canvas, leaving a large blank white area to the right and below — content appears cut off rather than filling the viewport
232 | Component Library/Organisms/TablePanel / Sorted And Limited | identical visible rendering to 231 | same truncated-width issue as 231
233 | Component Library/Organisms/TablePanel / Summarized | identical visible rendering to 231/232 | same truncated-width issue; summarized state not visually distinguishable in the captured crop
234 | Component Library/Organisms/TablePanel / With A Derived Column | identical visible rendering to 231-233 | same truncated-width issue; derived column not visible in the captured crop
235 | Component Library/Organisms/TemplateTable / Empty | "TEMPLATES 0 of 50 saved" header, "Import from clipboard" button, empty instructions | consistent, no issues
236 | Component Library/Organisms/TemplateTable / Full | "50 of 50 saved" header, pale-yellow warning banner, 3 rows | consistent, no issues
237 | Component Library/Organisms/TemplateTable / Long Name | 3 rows, first has a long wrapped title growing its row height | long title wraps to 2 lines with awkward vertical centering of its Load button/date column relative to the taller row
238 | Component Library/Organisms/TemplateTable / Populated | 3 rows with type chips, uniform row height | consistent, no issues
239 | Component Library/Organisms/Tile / Default | "ABOUT / HELP" tile, pale amber/cream title bar, drag-handle icon, window controls | title bar background color (pale amber) — see 240-242/245/246 for the wider tile-header-color inconsistency
240 | Component Library/Organisms/Tile / Document Bound | "PIPELINE" tile, light purple/lavender title bar | title bar is purple here vs amber in 239 and salmon/coral elsewhere — tile header accent color varies by tile kind, unclear whether intentional coding or drift
241 | Component Library/Organisms/Tile / Independent Duplicate Flow | "YIELD BY STATION" tile, salmon/coral title bar, green "active" DOC chip | third distinct title-bar color (salmon/coral) for a chart-type tile
242 | Component Library/Organisms/Tile / Linked Duplicate Flow | identical rendering to 241 | same salmon/coral header, no visible distinction for "linked" vs "independent" in this crop
243 | Component Library/Organisms/Tile / Menu Opened By Context Click | right-click menu over the amber "ABOUT / HELP" tile, menu has a near-black header bar | menu's own header uses near-black background, a fourth distinct dark color contrasting with the amber tile behind it; disabled menu items are grey but otherwise identical typography to enabled items — weak disabled-state affordance
244 | Component Library/Organisms/Tile / Menu Opened By Left Click | left-click menu, same dark near-black header, first item highlighted pale yellow | same dark-menu-header contrast as 243; menu floats with no drop shadow separating it from the page
245 | Component Library/Organisms/Tile / Narrow | "ENCODING" tile, dark navy/black title bar, red "active" DOC chip variant | a fourth/fifth distinct title-bar color for the encoding tile kind; "active" chip color (red) here differs from the green-bordered amber-fill chip used in 241/242/246
246 | Component Library/Organisms/Tile / Narrow Long Title | salmon/coral title bar, title text abruptly clipped by tile width, no ellipsis | long title clips at the tile edge with no ellipsis or wrap affordance, unlike TemplateTable's long-name row (237) which wraps instead
247 | Component Library/Organisms/Tile / Rename From Menu | salmon/coral header, same layout as 241/242 | consistent with 241/242/249
248 | Component Library/Organisms/Tile / Renamed | identical rendering to 247 | consistent, no issues
249 | Component Library/Organisms/Tile / Replace From Menu | amber header, full help text content, no menu open | consistent with 239
250 | Component Library/Organisms/Tile / Unknown Application | title bar "AN-APP-THAT-WAS-REMOVED" with icon buttons, body entirely empty white | large blank content area below header, no placeholder text explaining the empty state — reads like a missing-content bug rather than an intentional empty state
251 | Component Library/Organisms/TokensPanel / Just Minted | "Copy this now" banner with token string, mint form, two existing tokens | consistent monospace styling, orange links match app accent color
252 | Component Library/Organisms/TokensPanel / Mint Failed | mint form, red inline error | error text sits directly under the link with no spacing box, otherwise consistent
253 | Component Library/Organisms/TokensPanel / Minting | mint form, "minting…" progress text | consistent, no issues
254 | Component Library/Organisms/TokensPanel / No Tokens Yet | mint form, "none yet" message | consistent, no issues
255 | Component Library/Organisms/TokensPanel / Not Mintable | disabled/greyed mint form, explanatory paragraph | disabled fields light grey vs dark explanatory text — subtle but readable contrast
256 | Component Library/Organisms/TokensPanel / Populated | mint form plus two active tokens, solid-border chips | consistent, no issues
257 | Component Library/Organisms/TokensPanel / Showing Revoked | one active (solid border) and one revoked (dashed border, muted text) token chip | revoked token uses a dashed border vs the active token's solid border — real shape inconsistency, though dashed borders elsewhere only appear on FieldChip "stale" (286)
258 | Component Library/Organisms/TracePanel / A Session | scrubber/playback controls, filter box, numbered event log with colored verb tags | verb tag colors are not obviously grouped by meaning (red used for both "doc_added" and "step_removed")
259 | Component Library/Organisms/TracePanel / An Unknown Type | scrubber layout, 4-entry log, one unknown-type tag in plain black/white outline | correctly distinguishes "unknown type" but creates mixed styling within one log
260 | Component Library/Organisms/TracePanel / At The Cap | long scrolled event log, no scrubber/filter header visible | top toolbar chrome present in sibling stories (258/259) is missing/scrolled out of view here — inconsistent chrome across TracePanel stories
261 | Component Library/Organisms/TracePanel / Empty | plain empty-state text | consistent, no issues
262 | Component Library/Organisms/UploadPanel / A Draft Is Waiting | publish form, warning box, two versions with resume/discard links | consistent, no issues
263 | Component Library/Organisms/UploadPanel / Batch Error | file list, red "413 Payload Too Large" error line, all files still queued | error text sits loose below the file list, no box/border around it unlike the warning panel in 262 — inconsistent treatment of error vs warning states
264 | Component Library/Organisms/UploadPanel / Files Picked | file list, 3 queued CSVs | consistent, no issues
265 | Component Library/Organisms/UploadPanel / No Writable Drops | disabled dropdown, greyed drop-zone text | consistent disabled-state styling
266 | Component Library/Organisms/UploadPanel / Not A Secure Context | drop zone, boxed warning message | warning box has a solid border and light grey fill, similar to 262's waiting box — consistent
267 | Component Library/Organisms/UploadPanel / Nothing Chosen | disabled dropdown + disabled drop zone | consistent, no issues
268 | Component Library/Organisms/UploadPanel / Partial Failure | 2 done (green check), 1 failed (red x) with message | consistent color coding
269 | Component Library/Organisms/UploadPanel / Published | success box "Published — version 4" with link, green checks on file rows | consistent, no issues
270 | Component Library/Organisms/UploadPanel / Ready | empty drop zone only | consistent, no issues
271 | Component Library/Organisms/UploadPanel / Ready To Commit | file list, 2 done files, "Commit" link in header row | consistent, no issues
272 | Component Library/Organisms/UploadPanel / Uploading | file list mixing done/sending/hashing/queued states, distinct glyphs per state | glyphs (check/half-circle/diamond/dot) are small and similar in weight, could be hard to distinguish at a glance
273 | Component Library/Organisms/ViewSwitcher / Existing And New Views | grid of colored view-type tiles (green/purple/orange/red/tan/plain white), teal "existing view" row | color coding across tiles is inconsistent with no clear grouping logic; several tiles plain white/black-border while most are filled color — visually noisy
274 | Component Library/Organisms/ViewSwitcher / Linked Singleton View | same colorful grid, one existing view shown | same tile-color inconsistency as 273
275 | Component Library/Organisms/ViewSwitcher / Only New Views | same colorful grid, no existing views | same tile-color inconsistency as 273
276 | Component Library/Organisms/ViewSwitcher / Select Existing View | same colorful grid, two existing views listed | same tile-color inconsistency as 273
277 | Component Library/Organisms/WatchlistPanel / An Undescribed Type | amber "Watch…" title box, one workspace row with dropdown + remove button | consistent, no issues
278 | Component Library/Organisms/WatchlistPanel / Empty | amber title box, empty-state text | consistent, no issues
279 | Component Library/Organisms/WatchlistPanel / Mixed Types | 6 rows of different watched-item types, each with a different border/accent color (mostly blue, but "doc" red and "cat" tan/orange) | inconsistent per-type accent-border colors without a visible legend — could read as errors given red is used elsewhere for failure states
280 | Component Library/Organisms/WatchlistPanel / One Entry | single field row | consistent, no issues
281 | Component Library/Organisms/WorkspaceStrip / Default | dark toolbar, tab buttons, green "+ workspace" button | no outer black border frame around the panel, unlike most other organism stories in this package — inconsistent story chrome
282 | Component Library/Organisms/WorkspaceStrip / On Both Surfaces | same toolbar on dark and on white background | no outer border frame here either; the two surfaces otherwise render identically as intended
283 | Design System/Atoms/DocChip / Active And Not | amber filled "α · active" chip next to plain white "β" chip with red left-accent bar | red left-accent bar convention differs from FieldChip's dashed-border pattern for a similar "inactive/stale" idea — no single visual language for it
284 | Design System/Atoms/FieldChip / Ambient | single chip with dashed border and small blue square icon, orange text | consistent with the documented stale/dashed pattern
285 | Design System/Atoms/FieldChip / Every Field In A Fixture | row of 12 field chips, each with a small colored type-letter badge | badges are tiny and low-contrast at this size, though colors/shapes are consistent across chips
286 | Design System/Atoms/FieldChip / Stale | single dashed-border chip in red/orange text | consistent with the documented "stale" convention
287 | Design System/Atoms/ProvenanceBadge / Every Source | 4 plain underlined abbreviation labels, no chip/box border at all | unlike sibling atoms (DocChip, FieldChip, RoleBadge, UserChip) which render as bordered boxes, this renders as bare underlined text — inconsistent treatment for what should be the same "chip family"
288 | Design System/Atoms/RoleBadge / Beside A Chip | three green-bordered chips, each paired with a small R/W/A square badge | the "A" (admin) square has a reddish/orange border while R/W squares are plain black-border — inconsistent accent color on the admin badge
289 | Design System/Atoms/RoleBadge / Every Role | R/W/A squares, black borders, labels, greyed "no membership" note | consistent, no issues
290 | Design System/Atoms/ScopeChip / Against The Old Rendering | "before" plain text list vs "after" bordered chip row, "admin" bold/black-outlined vs others plain grey fill | intentional comparison per caption, no unexpected issues
291 | Design System/Atoms/ScopeChip / Every Scope | 4 scope chips, "admin" bold with black border, other three grey/tan fill with no border | real shape/weight inconsistency within the same chip set, though documented as intentional
292 | Design System/Atoms/SourceChip / Stream And Dataset | 2 green-outlined "stream" chips + 2 teal-outlined "dataset" chips | dataset chips noticeably wider due to longer text, otherwise consistent
293 | Design System/Atoms/StateGlyph / As A Column | vertical list of small state icons next to filenames | consistent, no issues
294 | Design System/Atoms/StateGlyph / The Upload Lifecycle | 6 labeled state rows, distinct glyph per state | glyphs are small and similar (dot variants), low visual distinction between adjacent states but colors/labels consistent
295 | Design System/Atoms/Tick / A Column | vertical stack mixing checkmark squares with numeric-badge squares | mixing two different tick "modes" in one column feels inconsistent, may be intentional per story name
296 | Design System/Atoms/Tick / Pending | single amber-bordered square "3" | consistent, no issues
297 | Design System/Atoms/Tick / Self | single green filled square with checkmark | consistent, no issues
298 | Design System/Atoms/Tick / Watched | single grey/white square with checkmark outline (not filled) | check style differs from "Self" (297, solid green fill) — appears an intentional watched-vs-self distinction, but a subtle green-vs-grey inconsistency worth flagging
299 | Design System/Atoms/TokenChip / Lifecycle | 3 token chips, last one dashed-border red/orange text | consistent with the dashed-border-for-revoked convention seen at 257
300 | Design System/Atoms/TypeBadge / Overridden | small badges: plain "n" amber square, "n*" amber square, then chips with badges | override badge only differs by a tiny asterisk-like mark and border fill — subtle/low-contrast way to show "overridden" state
301 | Design System/Atoms/TypeBadge / The Three Types | 3 small colored letter squares plus explanatory text | consistent, no issues
302 | Design System/Atoms/UserChip / No Email | single chip with a red/orange left accent bar | accent bar color differs from the black-border convention used by most other atom chips
303 | Design System/Atoms/UserChip / Only An Id | single chip, red/orange left accent bar | same as 302, consistent between these two but different from the rest of the atom family
304 | Design System/Atoms/UserChip / Others And You | "ada · you" chip filled amber/tan (selected), "bob" chip plain white/black border | consistent with documented "your own row marked" behavior
305 | Design System/Brand/Lockup / Claim | plain text tagline plus nav-style labels, no logo/wordmark graphic shown | looks unusually bare/text-only compared to other Lockup variants (Hero, Masthead) which show the big wordmark
306 | Design System/Brand/Lockup / Footer | small wordmark only, no tagline/phase icons | consistent minimal footer treatment
307 | Design System/Brand/Lockup / Hero | large wordmark, eyebrow text, 4 phase icons+labels row | consistent, no issues
308 | Design System/Brand/Lockup / Masthead | mid-size wordmark plus eyebrow text, no icon row | consistent, no issues
309 | Design System/Brand/Lockup / On Ink | full lockup inverted white-on-dark-navy | consistent inversion, colors/spacing match the light version
310 | Design System/Brand/Lockup / Sheet | multiple lockup variants stacked on one page | inconsistent left-alignment/spacing rhythm between blocks, but appears to be an intentional "sheet" showcase
311 | Design System/Brand/PhaseIcon / Default | 4 black icons | consistent, no issues
312 | Design System/Brand/PhaseIcon / Ink | solid dark navy rectangle, no icons visible at all | icons are not rendering/inverting on the dark "ink" background — appears to be an actual bug (black-on-black), unlike Lockup's "On Ink" (309) which correctly inverts to white
313 | Design System/Brand/PhaseIcon / Large | 4 black icons, larger scale | consistent, no issues
314 | Design System/Brand/PhaseIcon / Monochrome | 4 black icons, same as Default | looks visually identical to "Default" (311) with no visible monochrome distinction — possibly a rendering bug or too-subtle difference
315 | Design System/Brand/PhaseIcon / Small | 4 black icons, smaller scale | consistent, no issues
316 | Design System/Brand/PhaseRule / Bars Only | completely blank content area, only footer/status bar visible | BLANK/NEEDS INTERACTION — nothing rendered at all, likely a real rendering bug
317 | Design System/Brand/PhaseRule / Icons And Labels | 4 icon+label pairs in a row | consistent, no issues
318 | Design System/Brand/PhaseRule / Labels On Ink | same row, white-on-dark-navy background | icons/labels correctly invert to white here (unlike PhaseIcon "Ink", 312, which failed) — inconsistency between PhaseIcon and PhaseRule ink handling
319 | Design System/Brand/PhaseRule / Labels On Paper | text-only labels row, white background | consistent, no issues
320 | Design System/Brand/PhaseRule / Narrow | icon+label row squeezed narrow, causing labels to wrap mid-word ("UNDERST/AND") | ugly text-wrapping bug, no hyphenation or truncation handling
321 | Design System/Brand/PhaseRule / Sizes | completely blank content area, only footer/status bar visible | BLANK/NEEDS INTERACTION — nothing rendered, same failure pattern as 316
322 | Design System/Brand/Wordmark / All Sizes | three stacked wordmarks at decreasing sizes | consistent, no issues
323 | Design System/Brand/Wordmark / Footer | small centered wordmark | consistent, no issues
324 | Design System/Brand/Wordmark / Hero | large centered wordmark | consistent, no issues
325 | Design System/Brand/Wordmark / In Context | wordmark plus grey tagline beside it | consistent, no issues
326 | Design System/Brand/Wordmark / Inverted | white wordmark on dark navy background | consistent inversion
327 | Design System/Brand/Wordmark / Masthead | centered mid-size wordmark | consistent, no issues
328 | Design System/PBUI/Playground / Accept Flow | full playground UI with a right-click context menu open over a field, listing verbs | the open context menu visually overlaps and hides part of the schema chip row and the "facet" encoding row behind it — expected for a menu screenshot, but the layered overlap obscures state
329 | Design System/PBUI/Playground / Accept In Progress | playground UI with a red "ACCEPTING…" banner, orange-highlighted candidate fields | consistent use of amber/orange for "candidate" state matching other accept-mode affordances
330 | Design System/PBUI/Playground / Layout Menus | 4 example tile rows, each with a colored left-accent bar (red-orange or teal) | left-accent bar color seems to encode "can be duplicated/closed" (red-orange) vs "cannot" (teal) here, but this red/teal accent convention isn't used the same way elsewhere (e.g. UserChip/ScopeChip use red/orange for unrelated meanings)
331 | Design System/PBUI/Playground / Playground | full playground UI, encoding rows fully mapped, schema chips | consistent, no issues
332 | Design System/PBUI/Playground / With Type Override | full playground UI, appears pixel-identical to "Playground" (331) | no visible difference from the base story despite the story name promising a "type override" — likely needs an interactive/hover state to show

---

## pbui-chat (http://localhost:6007)

001 | Apps/ChatApp / the conversation as a tile: transcript, composer, mouse-doc line | BLANK/NEEDS INTERACTION — fully white 320x120 canvas, nothing rendered
002 | Apps/PanelApp / inspector, watchlist and trace, each in the panel frame | BLANK/NEEDS INTERACTION — fully white canvas
003 | Apps/WidgetApp / documents.widget names the live instance | BLANK/NEEDS INTERACTION — fully white canvas
004 | Apps/WidgetApp / the widget left the timeline | BLANK/NEEDS INTERACTION — fully white canvas
005 | pbui-chat/Composer / Empty | textarea placeholder "ask the agent…", boxed "insert object…" button, "send" button, dark status bar with orange "READY" label | send button renders visibly greyed/lighter than the fully-bordered "insert object…" button — looks like a disabled-state treatment but nothing in the frame explains it
006 | pbui-chat/Composer / With Mention | transcript with a mention boxed in a light highlight | content is cut off right after the "AGENT" label — the 320x120 viewport appears to truncate the transcript mid-render, no closing content visible
007 | pbui-chat/Composer / With Transcript | BLANK/NEEDS INTERACTION — fully white canvas
008 | pbui-chat/PbuiMarkdown / Blocks | heading, bullet list with mention chips, shaded SQL code block, dark status bar | consistent, no issues
009 | pbui-chat/PbuiMarkdown / Resolved | body text with mention tokens boxed in a light highlight, dark status bar | mention-chip box has tighter vertical padding than the surrounding text line-height, chip looks slightly stretched/misaligned against the baseline
010 | pbui-chat/PbuiMarkdown / Unresolved | body text with two "unresolved" references boxed identically to resolved mentions | unresolved references use the exact same chip styling as resolved ones (009) — no color, strikethrough, or icon differentiates a broken reference
011 | pbui-chat/PbuiWidget / Form | "Reorder draft" card, purple left accent bar, boxed fields, "Price it" button with helper text about missing fields | "Price it" stays fully black-bordered/solid-looking even though required fields are missing per the helper text — no greyed/disabled treatment like the Composer's send button (005) uses
012 | pbui-chat/PbuiWidget / Health | "Gold Eagle health" card, purple accent bar, PRICE/STOCK stats with amber accents, sparkline, segmented bar chart, RELATED chips, action row | RELATED chips mix red-bordered and purple-bordered treatments for what look like the same chip type; "Teleport" button is dimmed with explanatory subtext — a disabled pattern that 011's "Price it" button doesn't use despite being similarly invalid
013 | pbui-chat/PbuiWidget / Invalid | small warning icon, bold "invalid widget document" heading, one detail line, dark status bar | bare grey/beige box with no red or orange accent despite being an error state
014 | pbui-chat/PbuiWidget / Nested | "Metals overview" card, purple accent bar, two nested sub-panels sitting inside the outer card border | nested sub-panel borders sit flush against the outer card border with no gap, producing a visible double-border seam
015 | pbui-chat/PbuiWidget / Server Error | small warning icon, bold "widget error" heading, one detail line, dark status bar | identical bare/uncolored treatment to "Invalid" (013) — consistent with each other, but both lack red accenting seen elsewhere (e.g. ProposalCard's "danger" chip)
016 | pbui-chat/PbuiWidget / Streaming Table | "Top sellers this week" card in a dashed purple border with "streaming" label, sortable table headers | this is the only dashed-border card observed in the set — every other widget/panel border sampled elsewhere is solid
017 | pbui-chat/ProposalCard / Approved | title bar with "danger" and "approved" badge chips, orange/red left accent, greyed "Approve" vs bordered "Reject" | two badge chips sit side by side with visibly different text weight (danger bold/colored vs approved plain) though both share the same square-cornered box shape
018 | pbui-chat/ProposalCard / Pending | same card shape with only a "danger" chip, both action buttons active | consistent, no issues
019 | pbui-chat/ProposalCard / Rejected | same card, "rejected" chip and left accent bar | consistent with 017/018's layout; no new issues beyond the chip-styling notes already flagged

---

## pbui-workbench (http://localhost:6008)

001 | Workbench/CoordinationInspector / the coordination tile beside a linked pair: ports, wires, contexts, invariants | BLANK/NEEDS INTERACTION — fully white 320x120 canvas
002 | Workbench/IdentityLab / Lab | BLANK/NEEDS INTERACTION — fully white canvas
003 | Workbench/Launcher / open: a placed singleton is "go to", the rest "place" | BLANK/NEEDS INTERACTION — fully white canvas
004 | Workbench/Launcher / per-pane: show something else in THIS tile | BLANK/NEEDS INTERACTION — fully white canvas
005 | Workbench/Launcher / slot: a product's rows model | "Open an application" modal (rounded white card, drop shadow) over a flat grey overlay, with a square-cornered COUNTER tile visible behind | modal uses rounded corners + shadow while the tile behind it uses sharp square corners and a flat border — two different chrome languages in one screenshot; the backdrop is flat grey rather than a translucent dark scrim
006 | Workbench/LinkAnnouncer / coordination announcements, coalesced per target | "COUNTER A" tile with a solid orange/gold header bar beside "NOTES" tile with a pale cream/tan header bar | the two tiles use visibly different header-bar colors for what should be the same tile-title-bar component
007 | Workbench/LinkLab / Lab | same COUNTER A (orange) / NOTES (cream) tiles, plus a plain-text instruction bar with boxed pin/link/resume/detach/clear buttons | header-color mismatch repeats from 006; button row otherwise internally consistent
008 | Workbench/PortBadge / every badge state, as it sits after a tile title | 8 badge chips in a vertical list, each with a different border treatment | dotted borders, solid thin borders, a bold/thick border, and a double-line border are all used across badges that are otherwise the same size/shape — many distinct border styles for one badge family
009 | Workbench/PortRail / a wire already declared: notes.subject follows counter.count | a floating tooltip/popover sits over faint, ghosted background text that's barely legible underneath it | the tooltip has no drop shadow, so it reads as part of the base layout rather than a floating overlay; underlying content is washed out almost to invisibility
010 | Workbench/PortRail / connect mode: every tile flips to its rail; drag the counter's ▸ count onto the notes' ◂ subject | same two-tile layout, no visible wire or drag-affordance drawn | the story name promises a visible wire/rail interaction but the static capture shows plain panel content with no graphic wire — needs interaction to render
011 | Workbench/RebalanceBadge / Broken Sliver | tiny red-orange-bordered chip "1 tile under minimum" floating next to plain status text, otherwise blank page | BLANK/NEEDS INTERACTION — badge appears orphaned with no surrounding tile/toolbar chrome
012 | Workbench/RebalanceBadge / Healthy | plain text "status bar …" only, otherwise blank page | BLANK/NEEDS INTERACTION
013 | Workbench/RebalanceDialog / Broken | "Rebalance workspace" modal over a grey overlay, comparison cards each with a diagram and stats, action row | three different affordance styles sit in one action row: a solid/filled button, an outline button, and a bare text link ("Undo") with no button chrome at all
014 | Workbench/RebalanceDialog / Shortcut Closed | one tile plus a second tile column cropped at the right edge of the viewport, text truncated mid-line | layout appears clipped by container width — right-hand panel headers/content are cut off by the image edge rather than wrapping
015 | Workbench/RebalanceLab / Lab | "LAYOUTS" toolbar with 9 boxed buttons (one selected/bold), status line, 3 orange-headed COUNTER tiles below | "REBALANCE · Ctrl+Shift+K" label sits top-right as bare unstyled text in the same row as the boxed layout buttons — inconsistent affordance styling within one toolbar
016 | Workbench/RebalanceSettings / Default | COUNTER tile (orange header) beside REBALANCE SETTINGS tile with a distinct blue-grey/slate header bar | a third tile-header color (slate-blue) appears here, on top of the orange/cream mismatch already seen in 006/007/018 — three different header colors now observed for the same tile-title-bar role
017 | Workbench/RelationPalette / the palette for notes.subject: two relations from the counter's count | "DERIVE…" modal over COUNTER A (orange)/NOTES (cream) tiles with a grey overlay; NOTES tile's JSON code block reads darker/greyer here than elsewhere | code-block background shade appears to shift under the modal dimming — unclear if that's the overlay or an actual inconsistent token
018 | Workbench/ShowChooser / a show with nothing on screen to take it: the chooser offers the spawnable notes tile at two placements | 4 tiles (COUNTER A/B/C orange, NOTES cream with a tag chip) | header-color mismatch (orange vs cream) persists across this grid
019 | Workbench/SplitPane / nested splits, each divider independently resizable | 2x2 nested tile grid, dotted drag-handle marks between panes | NOTES tile header (cream) again mismatched against the three COUNTER tiles (orange)
020 | Workbench/Surface / drag: centre swaps the two applications, an edge docks the source beside the target | COUNTER (orange) + NOTES (cream) side by side with instruction text above | same header-color mismatch as prior screenshots
021 | Workbench/Surface / launcher (⌘K / Ctrl+K) and serialize()/restore() | toolbar row with two boxed buttons plus a bare grey text stat with no chip/box | a bare text stat sits in the same row as two fully-bordered buttons — inconsistent control styling within one toolbar
022 | Workbench/Surface / placement mode: aim a document at a pane (5.E) | instruction bar with two filename buttons, both rendered with the same filled/bold background | both file-target buttons look equally "selected/active" at once, with no visual distinction for which is the current target
023 | Workbench/Surface / resize: drag the divider; it snaps at ¼ ⅓ ½ ⅔ ¾ and the arrow keys nudge it | NOTES (cream) + COUNTER (orange) tiles side by side | header-color mismatch persists; otherwise clean
024 | Workbench/Surface / three tiles: split, close, drag the ⠿ to swap or dock | 3 orange-headed tiles in an L-shaped split | consistent within this screenshot (all headers orange) — no NOTES tile present to contrast against
025 | Workbench/Tile / a view of an application this build lacks | rounded white card, red left-border accent, red bullet, bold error text | text is clipped by the small 320x120 viewport; this card uses rounded corners + drop shadow, a visually different "modern" style vs the sharp square-cornered tile chrome used everywhere else in the package
026 | Workbench/Tile / renderTitle: the product's own title presentation in the bar | COUNTER tile with "· 1 PLACE" appended as plain text in the orange header, NOTES tile (cream) with the same suffix | the annotation is bare text in the title bar rather than a badge/chip, unlike the dedicated badge-chip component shown for port states (008); header-color mismatch also persists
027 | Workbench/WireLayer / wire styles: dotted for a held (suspended) follow, dashed and labelled for derived | tiles with a floating tooltip overlapping faint ghosted background content | same ghosting/overlap issue as 009; no dotted/dashed wire graphic is actually visible in the static capture despite the story title promising wire styling
028 | workbench/WorkspaceStrip / Custom Row | tab strip: active tab boxed/bold, inactive tabs plain unboxed text | only the active tab gets a box; a different selection convention than the "LAYOUTS" toolbar (015) where every button stays boxed regardless of selection
029 | workbench/WorkspaceStrip / Default | tab strip, one boxed active tab, others plain text | same active-vs-inactive tab styling inconsistency as 028
030 | workbench/WorkspaceStrip / With Add | tab strip, "+" add control with no button chrome at all | bare plus glyph not visually distinguished as clickable compared to bordered buttons used elsewhere

Note: `workbench-tile--unknown-app` (screenshot 025 above) is the one manifest entry the harness flagged with an `error` field ("workbench-core: unknown_application… application 'retired-app' is not registered") — it is a deliberate error-state fixture, and a screenshot was still captured; described above.

---

## pbui-sandbox (http://localhost:6009)

001 | Sandbox/Devtools / playground: the draft in a CodeEditor, run live | BLANK/NEEDS INTERACTION — fully white 320x120 canvas
002 | Sandbox/Devtools / source: a read-only CodeEditor with versions and diff | BLANK/NEEDS INTERACTION — fully white canvas

---

## pbui-editor (http://localhost:6010)

001 | Editor/CodeEditor / diagnostics: an error on a token, a warning on a line, one clamped | small viewport showing 5 code lines with a red "×" diagnostic marker in the gutter on line 3 and a faint tint on that line | only one diagnostic marker is visible though the story promises an error, a warning, and one clamped diagnostic — the 320x120 viewport likely crops the other two out of view
002 | Editor/CodeEditor / fills a bounded container (the tile case) | BLANK/NEEDS INTERACTION — fully white canvas
003 | Editor/CodeEditor / JavaScript, sized by rows | full 19-line/836-char code block, syntax-highlighted, footer "836 chars · 19 lines · Mod+Enter runs" | consistent, no issues
004 | Editor/CodeEditor / JSON | BLANK/NEEDS INTERACTION — fully white canvas
005 | Editor/CodeEditor / read-only listing | same code as 003 but visibly cropped to 12 of 19 lines mid-statement, same footer text below | footer still reads "Mod+Enter runs" even though the story is titled "read-only" — implies an interactive/editable affordance that contradicts the read-only intent; content is cut off with no visible scrollbar or "more" indicator

---

## pbui-plotscript (http://localhost:6011)

001 | Plotscript/Tiles / a plot tile with no editor open still draws | BLANK/NEEDS INTERACTION — fully white 320x120 canvas
002 | Plotscript/Tiles / a script that returns the wrong shape: the guard's message in the pane, no plot yet | BLANK/NEEDS INTERACTION — fully white canvas
003 | Plotscript/Tiles / a script that throws: the engine's error in the pane | BLANK/NEEDS INTERACTION — fully white canvas
004 | Plotscript/Tiles / script tile beside plot tile, one document | BLANK/NEEDS INTERACTION — fully white canvas

---

## pbui-ecommerce (http://localhost:6012)

001 | Shop/Scenes / 1 · ambient (unlinked detail follows workspace order) | ORDERS table + ORDER DETAIL panel showing order #88213 unlinked | header link-badge pill next to "ORDER DETAIL" shows overlapping/garbled text inside a dashed border, hard to read vs. the clean solid-border badges elsewhere
002 | Shop/Scenes / 2a · follow (right-click order → Link to order detail) | ORDERS + ORDER DETAIL (#88214, badge "← ORDERS") + empty INSPECTOR panel below | INSPECTOR panel header has a pale cream/tan fill while the sibling ORDERS and ORDER DETAIL headers directly above are plain white — inconsistent header color within the same column
003 | Shop/Scenes / 2b · hold (detail pinned on #88213) | ORDERS + ORDER DETAIL pinned (badge "# #88213") + empty INSPECTOR panel | same cream/tan INSPECTOR header vs. white ORDERS/ORDER DETAIL headers as in 002
004 | Shop/Scenes / 3 · show with routing (detail A held, "Show details…" opens detail B) | ORDERS + two stacked order-detail panels (Detail A #88213, Detail B #88201), badges render clean | consistent, no issues
005 | Shop/Scenes / 3b · show with nothing to take it (spawns a detail beside the table) | only the ORDERS table is visible, no second/spawned detail panel present | BLANK/NEEDS INTERACTION — story description implies a spawned detail panel that never rendered, right-click interaction not captured
006 | Shop/Scenes / 4 · derived (customer detail derives through order.customer) | ORDERS + ORDER DETAIL + CUSTOMER DETAIL (J. Alvarez) three-panel layout | CUSTOMER DETAIL header badge text is truncated with an ellipsis, cut off mid-word unlike other badges which fit fully
007 | Shop/Scenes / 4b · the relation palette ("Derive through…") | ORDERS + empty CUSTOMER DETAIL + a "DERIVE customer detail…" modal over a dimmed gray backdrop | modal's highlighted relation row uses a solid tan/amber fill, a saturated color not used anywhere else in the flat white/black UI; backdrop dimming is flat gray rather than a translucent overlay
008 | Shop/Scenes / 5 · identity (orders table and plot share a selection) | ORDERS table + bar PLOT orders-by-status, 2 rows selected, one bar has a dashed top segment marking the selection | consistent, no issues — dashed selection marker matches the app's dashed "hold" badge convention
009 | Shop/Scenes / 5b · not identity-compatible (Ctrl-drag explains why) | two panels flipped into connect-mode "rail" view listing ports for ORDERS and PLOT revenue-by-category, orders table dimmed behind | consistent, no issues; port-card styling uniform between the two tiles
010 | Shop/Scenes / 6 · follow versus identity (orders filter follows plot category) | PLOT revenue-by-category (purple/green/gold bars) + ORDERS filtered with a filter chip | filter chip is a solid amber/tan filled pill, the only filled-color badge in the row — every other badge (order id, status) is white with a black outline, breaking the flat outline-badge convention
011 | Shop/Scenes / 7 · connect mode (every tile flips to its rail) | 4-tile connect-mode view with a wire arrow drawn from ORDERS to ORDER DETAIL | INSPECTOR header again pale cream/tan vs. plain white ORDERS/ORDER DETAIL headers; "no outputs" gray label floats top-right of each port card, visually disconnected from the card's border/content
012 | Shop/Scenes / 8 · the coordination inspector | ORDERS + ORDER DETAIL panels (left) + COORDINATION text panel (right) listing ports/wires/contexts | COORDINATION panel header uses a solid dark navy/slate-blue fill — a fourth distinct header color (besides white, cream, and orange elsewhere) with no other panel matching it
013 | Shop/Scenes / the seeded workbench (four workspaces) | top nav bar, ORDERS table + empty ORDER DETAIL + empty INSPECTOR (cream header) | link-badge pills again show garbled/overlapping placeholder text inside dashed borders, same glitch as 001/015/019/020/023
014 | Shop/Tiles/CustomerDetail / following (Northgate Capital, a fund) | CUSTOMERS table + CUSTOMER DETAIL panel showing Northgate Capital with 3 linked orders | consistent, no issues
015 | Shop/Tiles/CustomerDetail / waiting (nothing bound yet) | CUSTOMERS table + empty CUSTOMER DETAIL panel, "no customer yet" message | header badge pill text is garbled/overlapping in a dashed border, same defect family as 001/013/019/020/023
016 | Shop/Tiles/CustomersTable / alone (twelve customers) | single CUSTOMERS table, 12 rows, plain white header | consistent, no issues
017 | Shop/Tiles/Inspector / a product (fixed on the value) | CATALOG table + INSPECTOR panel (cream header) showing JSON for a SKU | CATALOG panel header is a solid saturated orange/amber fill, sharply different from every other table/panel header (plain white or pale cream) — the strongest color outlier across the whole set
018 | Shop/Tiles/Inspector / an order (subject follows orders.order) | ORDERS table + INSPECTOR panel (cream header) showing JSON for order #88213 | INSPECTOR's cream header again inconsistent with the plain white ORDERS header beside it
019 | Shop/Tiles/Inspector / waiting (nothing inspected yet) | single full-width INSPECTOR panel with cream/tan header, "nothing inspected yet" empty state | header badge pill text overlapping/garbled, plus the tan header fill unique among default (non-inspector) panel headers
020 | Shop/Tiles/OrderDetail / ambient (unlinked detail shows workspace order, badge ○) | ORDERS + ORDER DETAIL panel, order #88213 shown unlinked | header badge pill text overlapping/garbled, same defect as 001/013/015/019/023
021 | Shop/Tiles/OrderDetail / following (badge →) | ORDERS + ORDER DETAIL panel (order #88214, Northgate Capital), badge "← ORDERS" renders cleanly | consistent, no issues — badge text is crisp here, unlike the ambient/waiting states elsewhere
022 | Shop/Tiles/OrderDetail / held (badge ⏸, pinned on #88213) | ORDERS + ORDER DETAIL pinned on #88213, badge "# #88213" renders cleanly | consistent, no issues
023 | Shop/Tiles/OrderDetail / waiting (empty state names port and fallback) | ORDERS + empty ORDER DETAIL panel, "no order yet" message | header badge pill text overlapping/garbled, same recurring defect
024 | Shop/Tiles/OrdersTable / alone (sixty-five orders) | single ORDERS table, 65 rows, plain white header | consistent, no issues
025 | Shop/Tiles/ProductCatalog / alone (eight SKUs) | single CATALOG table with solid orange/amber header bar, "low"/"out" stock badges in dashed borders with orange/red text | same strong orange-header outlier as 017; stock warning badges use orange/red text on dashed borders while the orders table's "hold" status badges (same dashed-border style) use plain black/brown text — inconsistent color coding for similarly-styled warning badges
026 | Shop/Tiles/ShopPlot / orders-by-status (every segment is one order) | single bar PLOT panel, bars solid dark charcoal/grey with horizontal stripe texture, no per-category color | bars are monochrome dark grey while sibling ShopPlot stories (027, 028) use a green/purple/gold categorical palette — this chart doesn't apply the color coding used elsewhere in the same component
027 | Shop/Tiles/ShopPlot / revenue-by-category (stacked from daily cells) | bar PLOT, bars colored green (majority), purple, and gold/amber by metal | consistent internally (see 026 for the cross-story color inconsistency)
028 | Shop/Tiles/ShopPlot / revenue-by-day (coloured by metal) | scatter PLOT, dots colored green/purple/gold by metal, sparse distribution | consistent, palette matches 027
029 | Shop/Tiles/ShopPlot / three-up (all three) | three PLOT panels together: revenue-by-day (scatter, colorful), revenue-by-category (bar, colorful), orders-by-status (bar, monochrome dark grey) | orders-by-status is the only monochrome/uncolored chart sitting directly beside two colorful ones — clearest side-by-side evidence of the color-coding inconsistency flagged in 026

---

## Cross-package observations

- **Border-radius is violated by the system's own showcase.** core's token sheet (core 141) states "no border-radius, anywhere" as Rule 01, yet core's own Toolbar/Variants story shows pill-shaped rounded buttons (core 155), and Workbench's Launcher and RebalanceDialog modals use rounded corners + drop shadows (pbui-workbench 005, 013) while the tiles behind them stay sharp-square. Same split shows up in datalab-ui's Tile "Unknown Application" card (datalab-ui 025), which is rounded+shadowed against an otherwise flat square-cornered tile system.
- **Tile/panel title-bar color is not a stable convention across any package.** pbui-workbench cycles through at least four distinct header colors for what is meant to be one "tile title bar" component: orange (COUNTER, 006/007/016/018-020/023/024/026), pale cream/tan (NOTES, same screenshots), slate-blue (RebalanceSettings, 016), and near-black (context menu header, 025/243-244 in datalab-ui-style menus). datalab-ui's own Tile stories independently cycle amber (239, 249), purple (240), salmon/coral (241/242/246/247), and dark navy (245) for different tile *kinds* with no visible legend. pbui-ecommerce shows the same pattern at panel scale: white (ORDERS/ORDER DETAIL), cream/tan (INSPECTOR, 002/003/011/017-019), solid orange (CATALOG, 017/025), and dark navy/slate (COORDINATION, 012).
- **Error/warning/notice severity is inconsistently color-coded across every package.** core's Callout boxes render success, warning, and neutral info with identical beige/black-border styling, differentiated only by a tiny glyph (core 004-006). datalab-ui shows at least three distinct neutral "notice" tints doing the same semantic job: gray crash boxes (042-045), tan/cream draft-resume boxes (058/060/061), and pale-yellow lesson-highlight bands (022/073-076) — plus SignInPanel's "Provider Refused" state (213) uses the same plain grey fill as a genuine crash notice, with no red/orange accent for what is an actual error.
- **Chip "stale/inactive/revoked" state has no single visual language.** Solid outline (default), dashed border (datalab-ui FieldChip "Stale" 286, TokenChip "Lifecycle" 299, TokensPanel "Showing Revoked" 257), and a plain red/orange left-accent bar (UserChip 302/303, DocChip 283) are all used for conceptually similar "this thing is off/inactive/broken" states without a shared rule. pbui-workbench's PortBadge story (008) independently stacks dotted, solid-thin, bold, and double-line borders across 8 badges in one family.
- **Disabled-button/disabled-control treatment is inconsistent within single components.** pbui-chat's Composer send button greys out with no explanation (005) while the ProposalCard's "Approve" button in the Approved story is also greyed (017) — but pbui-chat's PbuiWidget "Price it" button (011) stays fully solid/active-looking despite the helper text saying required fields are missing, right beside "Teleport" (012) which does show a dimmed disabled treatment with explanatory subtext. datalab-ui's BundleDialog "Empty" disabled button (131) uses a muted sage-green fill so low-contrast it reads as enabled.
- **Dashed vs solid borders are overloaded with multiple unrelated meanings.** Dashed borders signal: drag-and-drop targets (core FileDropZone, 015-017), "stale" chips (datalab-ui FieldChip 284/286), "revoked" tokens (datalab-ui 257/299), form-validation errors (datalab-ui MemberInvite "Lookup Failed" 078, MemberPanel "Lookup Failed" 192), and "streaming" widget state (pbui-chat PbuiWidget "Streaming Table" 016) — five different semantics sharing one visual cue with no disambiguating color or icon in most cases.
- **The "unmapped/empty field slot" affordance differs by component even within one package (datalab-ui).** EncodingPanel renders unmapped channels as blue-outlined boxes with grey placeholder text (166), visually similar to *mapped* boxes (165) and easy to confuse; ChannelRow instead uses plain gray dashes for unmapped (048) vs solid blue border for mapped (049) vs dashed blue border with a corner badge for "live" (051) — three different border treatments for the mapped/unmapped axis of one conceptual control.
- **"Active/selected" state uses at least three different encodings within one package (datalab-ui ChartsPanel/DocChip family).** Omitting a "set active" button implies already-active (ChartsPanel "A Document With No Source", 157); a fully amber/gold-highlighted card header signals active in a sibling story (ChartsPanel "Many Documents", 158); and a plain amber-filled chip with a green/red accent bar does the same job for DocChip (283). No single component owns this state's visual definition.
- **Many stories across pbui-chat, pbui-workbench, pbui-sandbox, and pbui-plotscript render as a fully blank white canvas** (pbui-chat 001-004/007; pbui-workbench 001-004/011/012; pbui-sandbox 001/002; pbui-plotscript 001-004; pbui-editor 002/004). These are almost all top-level "Apps/…" or lab/devtools stories that likely need a real container size, a doc/document context, or a right-click/keyboard interaction to render — worth a follow-up interactive-capture pass before concluding they're broken.
- **Blank-canvas rate is drastically different by package.** pbui-chat, pbui-workbench, pbui-sandbox, and pbui-plotscript are dominated by top-level "app shell" stories that render blank without interaction, while core, datalab-ui, and pbui-ecommerce (which mostly showcase individual components/tiles rather than whole apps) render almost everything statically. This suggests the harness's static-goto approach systematically undercaptures a specific story *pattern* (bare `Apps/*` stories), not specific packages.
- **datalab-ui's PhaseIcon and PhaseRule brand components disagree on dark-background handling for the identical concept.** PhaseIcon's "Ink" story renders a solid dark rectangle with icons completely invisible (312) — an apparent black-on-black bug — while PhaseRule's "Labels On Ink" story correctly inverts icons+labels to white on the same dark background (318), and Lockup's "On Ink" story (309) also inverts correctly. Same "ink" surface, three different render outcomes.
- **datalab-ui's PhaseRule "Bars Only" and "Sizes" stories render completely blank** (316, 321) while sibling PhaseRule stories (317-320) render fine — an actual rendering failure, not a static-capture limitation, since other PhaseRule variants with similar content succeed.
- **Long/overflowing text is handled three different ways across components in the same package (datalab-ui).** TemplateTable wraps long titles to a second line (237); Tile clips long titles abruptly with no ellipsis (246); PhaseRule breaks words mid-syllable when narrow ("UNDERST/AND", 320). No shared truncation/wrap policy.
- **TablePanel's populated states in datalab-ui visibly fail to fill their declared viewport** (231-234): table content stops at ~636px of a 1280px-wide canvas, leaving roughly half the frame blank — this reproduces identically across four sibling stories (Populated/Sorted And Limited/Summarized/With A Derived Column), suggesting a genuine layout bug rather four independent screenshot crops.
- **pbui-ecommerce has a recurring header-badge text-garbling bug** that core/datalab-ui don't show: the small link-badge pill next to a panel's title (e.g. "← ORDERS", "⌐CUSTOMER ← NONE") renders with overlapping/garbled text inside a dashed border in "waiting"/"ambient"/empty states specifically (001, 013, 015, 019, 020, 023) but renders crisp and legible once a link resolves (021, 022) — points to a real rendering bug in the badge's empty/placeholder text path, not a screenshot artifact, since it's reproducible across five independent stories.
- **Categorical chart coloring is applied inconsistently within a single chart component, in two different packages.** pbui-ecommerce's ShopPlot renders "orders-by-status" as flat monochrome dark-grey bars (026, 029) while its sibling "revenue-by-category"/"revenue-by-day" stories use the green/purple/gold metal palette (027, 028) — same component, same app, one story ignores the categorical color system. datalab-ui's ChartPanel shows the identical pattern: "Histogram" renders flat dark grey/black bars (145) while every other ChartPanel story (Area/Bar/Line/Points/etc., 139-156) uses the green/purple/orange/red category palette.
- **The "danger/error" accent color itself is inconsistent even within pbui-chat alone.** ProposalCard uses an orange/red left-accent bar plus a bold "danger" chip for its warning state (017-019), but PbuiWidget's "Invalid" and "Server Error" states — arguably more severe, a hard render failure — use a bare grey/beige box with no red/orange accent at all (013, 015).
- **Reference/documentation-style "card" components render with a border in one place and without a border in another, within the same package (datalab-ui).** CheatCard's "Framed" story has a solid black border (052) while "Objects"/"Shell"/"Short" render the identical kind of content with only a thin top rule and no box (053-055); ModuleCard renders with no border at all in every story (083-086). Same visual "reference card" role, three different chrome outcomes.
- **Icon-button glyph color is inconsistent for what should be visually identical bare icon buttons, in core.** Two "x" close/remove glyph buttons render black in one instance and red-orange in another within the same story (core 097, 099) with no documented meaning for the color difference.
- **Toolbar control affordance (boxed button vs. bare text) is mixed within single toolbars across pbui-workbench.** The Surface "launcher" toolbar mixes two fully-bordered buttons with a bare, unboxed text stat (021); RebalanceLab's LAYOUTS toolbar mixes 9 boxed buttons with a bare-text keyboard-shortcut label (015); WorkspaceStrip boxes only the active tab and leaves inactive tabs as plain text (028-030) — three different rules for "is this control boxed or bare" inside the same package's chrome.
- **"Selected/active" pill and tab treatments diverge between core, datalab-ui, and pbui-workbench.** core's Chip "States" story treats "active" as a solid yellow fill (089); datalab-ui's EncodingPanel treats "selected" as an amber/tan-filled pill (165/167-172); pbui-workbench's WorkspaceStrip treats "active tab" as simply having a box border at all (028-030) rather than a fill color. Three different visual grammars for the same underlying concept of "the chosen one in a set."
- **Deep component-crash failures cluster in datalab-ui's Tour/Section stories**, where 4 consecutive stories (042-045) all fail identically with "useAnalysisResultFor must be used inside AnalysisProvider", each showing only a generic gray error box instead of the intended tour content — a systemic story-fixture/provider wiring gap rather than four unrelated bugs.
