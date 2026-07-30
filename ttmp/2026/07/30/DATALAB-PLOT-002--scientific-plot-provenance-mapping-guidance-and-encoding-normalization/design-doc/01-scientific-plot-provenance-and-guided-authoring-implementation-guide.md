---
Title: Scientific plot provenance and guided authoring implementation guide
Ticket: DATALAB-PLOT-002
Status: active
Topics:
    - frontend
    - plotting
    - authoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - packages/datalab-ui/src/model/graphic.ts
    - packages/datalab-ui/src/model/graphicAuthoring.ts
    - packages/datalab-ui/src/appkit/plotAdapter.ts
    - packages/datalab-ui/src/apps/useTable.ts
    - packages/datalab-ui/src/apps/EncodingApp/EncodingApp.tsx
    - packages/datalab-ui/src/apps/InspectorApp/InspectorApp.tsx
    - packages/datalab-ui/src/components/organisms/EncodingPanel/EncodingPanel.tsx
    - packages/datalab-ui/src/components/organisms/ChartPanel/ChartPanel.tsx
    - packages/datalab-ui/test/fixtures.test.ts
    - packages/datalab-ui/test/store.test.ts
ExternalSources: []
Summary: A phased frontend design for visible statistical provenance, actionable recipe compatibility guidance, and deterministic normalization of redundant encodings.
LastUpdated: 2026-07-30
WhatFor: Implement the next PBUI scientific-plot authoring phases without changing the backend or duplicating plot-package logic.
WhenToUse: Read before changing analysis recipes, encoding actions, the plot adapter, chart inspection, or plot diagnostics in PBUI.
---

# Scientific plot provenance and guided authoring implementation guide

## Executive summary

PBUI can now author and render identity charts, histograms, summaries, ordinary least-squares regressions, boxplots, density estimates, facets, and reference rules through `@hyperslop-systems/plot`. The next work is not another rendering feature. It is an authoring-trust feature: the interface must explain which statistical computation produced the visible marks, identify invalid or questionable specifications, guide the user toward a compatible field mapping, and prevent the same field from being represented redundantly by both color and facet.

This guide proposes one small pure module, `plotAuthoring.ts`, as the center of that work. It derives an `AuthoringAssessment` from the current `AuthoringView` and pipeline fields. The assessment reports required channels, missing or incompatible mappings, candidate fields, and encoding conflicts. It does not execute rows and is not persisted. The existing plot outcome remains the authoritative source for runtime diagnostics and executed statistical metadata.

The user interface combines these two sources:

- The Encoding application uses the authoring assessment to show specific problems and launch PBUI's existing field-accept interaction.
- The plot inspector presents executed statistical metadata and plot diagnostics.
- The plot adapter consumes an effective mapping produced by the same normalization policy used by authoring, so legacy or externally loaded documents cannot emit redundant color and facet encodings.

Implementation should be delivered in four reviewable phases:

1. Add and test the pure assessment and normalization model.
2. Add statistical provenance and diagnostics to an explicitly inspected plot report.
3. Add actionable recipe guidance to Encoding.
4. Enforce the redundant-encoding invariant at authoring and adapter boundaries, then complete Storybook and browser acceptance.

No backend endpoint or response schema changes are required. No compatibility adapter or second plotting format should be introduced.

## 1. System context

### 1.1 The persisted authoring document

PBUI stores a canonical `GraphicDocument`. Its root `AuthoringView` contains the user-controlled chart state: mark, channel encodings, analysis recipe, y scale, facet scale policy, and references. The relevant types are in `packages/datalab-ui/src/model/graphic.ts`.

Conceptually:

```ts
interface AuthoringView {
  mark: Mark
  encodings: Partial<Record<Channel, AuthoringFieldRef>>
  analysis: AnalysisSpec
  yScale: "linear" | "log"
  facetScales: FacetScalePolicy
  references?: ReferenceSpec[]
}

type AnalysisSpec =
  | { kind: "identity" }
  | { kind: "histogram"; bins: number }
  | { kind: "summary"; interval: IntervalKind; multiplier: number }
  | { kind: "regression"; confidence: number }
  | { kind: "boxplot" }
  | { kind: "density"; points: number }
```

Redux actions in `packages/datalab-ui/src/store/world.ts` update mappings, analysis, and facet scales independently. This is useful for simple controls, but it means a recipe change may temporarily produce a specification whose mappings do not satisfy the new recipe.

The persisted document records user intent. It should not store computed compatibility messages, candidate fields, plot diagnostics, regression estimates, or density bandwidths. Those values depend on the current pipeline schema, current rows, plotting package version, and viewport.

### 1.2 Pipeline execution and field metadata

`useDocAnalysisResult()` in `packages/datalab-ui/src/apps/useTable.ts:95` resolves the document, source table, transformed rows, output fields, execution metrics, and errors. Its `pipeline.fields` is the correct schema for authoring checks because transforms can add, remove, or change available fields.

Each field has a PBUI field type:

- `q`: quantitative
- `n`: nominal
- `t`: temporal

The field descriptors already expose type provenance, and `ProvenanceBadge` distinguishes schema, envelope, sampled-value, and default inference. That field-level provenance is separate from statistical provenance. Statistical provenance describes the operation that generated plotted values, not how a source column received its semantic type.

### 1.3 The PBUI-to-plot boundary

`renderPbuiPlot()` in `packages/datalab-ui/src/appkit/plotAdapter.ts:48` is the only PBUI composition boundary into `@hyperslop-systems/plot`. It:

- builds a plot schema from mapped pipeline fields;
- converts PBUI field references to plot field references;
- lowers an analysis recipe into executable plot layers;
- adds annotation layers;
- passes rows, coverage, scales, facets, and viewport to `renderPlot()`.

The analytical recipes are lowered in one switch:

- histogram: bin statistic and bar geometry;
- summary: mean statistic with interval, rendered as error bars and points;
- regression: identity observations plus OLS interval and fit layers;
- boxplot: Tukey boxplot statistic and boxplot geometry;
- density: density statistic and line geometry;
- identity: selected source mark with identity statistic.

This boundary is the correct enforcement point for effective encodings because every PBUI chart must pass through it, including documents created before the new authoring invariant.

### 1.4 Plot output and scientific metadata

The plot package returns:

```ts
interface PlotOutcome {
  compiled: CompiledPlot | null
  plan: VisualPlan | null
  scene: SceneGraph | null
  diagnostics: readonly Diagnostic[]
}
```

`VisualPlan.statistics` is an array of `StatisticalMetadata`. Each entry includes:

- layer identifier;
- method: identity, mean, bin, OLS, boxplot, or density;
- grouping fields;
- input measure;
- output schema;
- invalid-value count;
- interval definition and assumptions;
- method parameters;
- OLS estimates, including slope, intercept, R², count, and residual standard error;
- density bandwidths;
- general assumptions.

The plot package therefore already computes the required scientific provenance. PBUI must present this result; it must not reimplement the calculations or infer them from layer names.

### 1.5 Current UI behavior

The current flow is:

```text
GraphicDocument
      |
      +--> useDocAnalysisResult ----> pipeline fields and rows
      |                                  |
      |                                  v
      +--> root AuthoringView ------> renderPbuiPlot
                                         |
                                         v
                                   PlotOutcome
                                         |
                                         v
                                     ChartPanel
```

`ChartPanel` currently renders fatal diagnostic messages when no chart can be drawn and otherwise passes all diagnostics to `PlotHost`. The metadata is not available as a durable textual report.

`EncodingApp` changes an analysis immediately. It changes the accepted x field types according to the selected recipe, but it does not evaluate whether the existing mapping became incompatible. `EncodingPanel` displays a static sentence such as “needs categorical x and quantitative y,” but it cannot identify the invalid channel, explain the current type, list compatible candidates, or launch a correction from the message.

`InspectorApp` is a singleton, non-document-bound container that displays `world.inspected`. The `inspect` verb writes `{title, value}` and the generic `InspectorPanel` renders JSON unless supplied a domain renderer. This generic behavior should remain intact.

## 2. Problems and invariants

### 2.1 Statistical results are visible but not inspectable

A regression line is scientifically incomplete if the interface cannot report the method, grouping, sample count, estimates, confidence setting, invalid input count, and assumptions that produced it. The chart may be visually correct while its computational provenance remains unavailable.

Required invariant:

> Every successfully planned statistical layer has a human-readable inspector representation derived from `VisualPlan.statistics`.

Diagnostics must appear in the same report even when they are warnings and the chart remains drawable.

### 2.2 Recipe changes can invalidate existing mappings

Summary and boxplot require categorical x and quantitative y. Histogram and density require quantitative x. Regression requires quantitative x and y. The current interface changes the recipe but leaves incompatible mappings in place. The plot package then reports a downstream compile diagnostic. That diagnostic is necessary, but it arrives after the authoring action and does not help the user choose a replacement.

Required invariant:

> A recipe compatibility problem is described at the authoring level with the channel, expected types, actual mapping, actual type, and compatible field candidates.

The user’s selected recipe should remain selected. Reverting it would discard intent. PBUI should guide the missing correction.

### 2.3 Color and facet can encode the same field

`plotAdapter.ts:90` currently adds color, group, and facet independently to analytical mappings. If color and facet reference the same field, the result contains separate facet panels and a color encoding that communicates no additional variable. It can also produce a redundant legend.

Required invariant:

> The effective plot mapping never contains the same field in both color and facet.

Facet takes precedence because it changes layout and panel scale semantics. The stored color mapping may remain in the document long enough for the UI to explain and correct it, but it must not reach generated plot layers.

## 3. Proposed architecture

### 3.1 Add a pure authoring-assessment module

Create:

`packages/datalab-ui/src/model/plotAuthoring.ts`

The module must have no React, Redux, PBUI interaction, row execution, or plot rendering dependency. It receives an analysis, mappings, and pipeline fields and returns stable structured facts.

Proposed API:

```ts
export type MappingIssueCode =
  | "mapping.required"
  | "mapping.incompatible-type"
  | "mapping.stale"
  | "encoding.redundant-color-facet"

export interface ChannelRequirement {
  readonly channel: Channel
  readonly required: boolean
  readonly acceptedTypes: readonly FieldType[]
  readonly reason: string
}

export interface MappingIssue {
  readonly code: MappingIssueCode
  readonly severity: "error" | "warning"
  readonly channel: Channel
  readonly message: string
  readonly mappedField: string | null
  readonly actualType: FieldType | null
  readonly acceptedTypes: readonly FieldType[]
  readonly candidates: readonly string[]
}

export interface EffectiveEncodings {
  readonly encodings: AuthoringView["encodings"]
  readonly suppressed: readonly {
    channel: Channel
    field: string
    reason: MappingIssueCode
  }[]
}

export interface AuthoringAssessment {
  readonly requirements: readonly ChannelRequirement[]
  readonly issues: readonly MappingIssue[]
  readonly effective: EffectiveEncodings
  readonly compatible: boolean
}

export function requirementsFor(
  analysis: AnalysisSpec,
): readonly ChannelRequirement[]

export function assessPlotAuthoring(
  view: AuthoringView,
  fields: readonly Field[],
): AuthoringAssessment

export function effectiveEncodings(
  encodings: AuthoringView["encodings"],
): EffectiveEncodings
```

The requirement table should be declarative:

```ts
const REQUIREMENTS = {
  identity: [],
  histogram: [{ channel: "x", types: ["q"], reason: "Bins require a quantitative x field." }],
  density: [{ channel: "x", types: ["q"], reason: "Density estimates require a quantitative x field." }],
  summary: [
    { channel: "x", types: ["n", "t"], reason: "Summary groups must be categorical or temporal." },
    { channel: "y", types: ["q"], reason: "Summary values must be quantitative." },
  ],
  regression: [
    { channel: "x", types: ["q"], reason: "OLS predictors must be quantitative." },
    { channel: "y", types: ["q"], reason: "OLS responses must be quantitative." },
  ],
  boxplot: [
    { channel: "x", types: ["n", "t"], reason: "Boxplot groups must be categorical or temporal." },
    { channel: "y", types: ["q"], reason: "Boxplot values must be quantitative." },
  ],
} satisfies Record<AnalysisKind, readonly RequirementDefinition[]>
```

Assessment pseudocode:

```text
function assessPlotAuthoring(view, fields):
    fieldsByName = index fields by name
    requirements = requirementsFor(view.analysis)
    issues = []

    for requirement in requirements:
        mapping = view.encodings[requirement.channel]
        if mapping is absent:
            add required issue with compatible candidates
            continue

        field = fieldsByName[mapping.name]
        if field is absent:
            add stale issue with compatible candidates
            continue

        if field.type is not accepted:
            add incompatible-type issue with compatible candidates

    if color and facet reference the same stable field identity:
        add redundant-color-facet warning

    return requirements, issues, effectiveEncodings(view.encodings)
```

Compare field identity by `fieldId` when both references contain one; otherwise compare names. This is consistent with the adapter’s current fallback identity. Do not compare display labels.

Candidate ordering should follow pipeline field order. Do not add automatic “best field” scoring in this ticket. A short deterministic list is easier to test and does not make an unsupported semantic choice.

### 3.2 Keep compile diagnostics and authoring issues separate

The two diagnostic classes answer different questions:

| Source | Question | Available before row execution? | Persisted? |
|---|---|---:|---:|
| `AuthoringAssessment.issues` | Can this recipe use these mappings? | Yes | No |
| `PlotOutcome.diagnostics` | Could the plot document compile and plan these rows? | No | No |
| `VisualPlan.statistics` | What computation produced the planned layers? | No | No |

Do not convert all three into one universal diagnostic type. Preserve their domain-specific payloads, then compose them in presentation.

### 3.3 Introduce a plot inspection report

Add a PBUI-local report type, preferably in the same model module or a sibling `plotInspection.ts`:

```ts
export interface PlotInspectionReport {
  readonly kind: "plot-inspection"
  readonly documentId: string
  readonly analysis: AnalysisSpec
  readonly mappings: Readonly<Record<Channel, string | null>>
  readonly coverage: {
    sourceRows: number
    validRows: number
    renderedRows: number
    bounded: boolean
  } | null
  readonly authoringIssues: readonly MappingIssue[]
  readonly diagnostics: readonly PlotDiagnostic[]
  readonly statistics: readonly StatisticalMetadata[]
}

export function buildPlotInspectionReport(args: {
  documentId: string
  view: AuthoringView
  assessment: AuthoringAssessment
  plot: PlotOutcome | null
}): PlotInspectionReport
```

This report is a snapshot. It may be placed in `world.inspected` through the existing `inspect` verb. It should not be added to the document model.

Add `PlotInspectionView.tsx` under `components/organisms` or `components/molecules`, depending on final visual size. Render it through `InspectorPanel.renderValue` when `value.kind === "plot-inspection"`; retain JSON rendering for all other inspected values.

Recommended sections:

- Specification: recipe, mapped fields, facet policy, effective suppressed channels.
- Coverage: source, valid, and rendered row counts; bounded/truncated status.
- Diagnostics: severity, stable code, message, and path or layer when present.
- Statistical operations: one card or definition list per `StatisticalMetadata`.
- Estimates: compact table for OLS group estimates.
- Parameters and assumptions: explicit values, not prose reconstructed by PBUI.

Rendering rules:

- Identity metadata may be shown as “raw values; no statistical transformation.”
- Mean must show grouping, measure, interval kind, multiplier, and assumptions.
- Bin must show bin count or resolved parameters.
- OLS must show confidence, estimates by group, R², and residual standard error.
- Boxplot must show Tukey whisker policy and invalid count.
- Density must show evaluation-point count and bandwidth by group.
- Zero is a valid value and must never be rendered as absent.
- Empty grouping means “all rows,” not “unknown.”
- Diagnostic codes should remain visible for support and testability.

### 3.4 Make plot inspection an explicit chart action

The generic Inspector is intentionally non-document-bound. Do not make it silently follow the active document; doing so would overwrite the user’s last explicitly inspected datum, category, field, or source.

Instead, wrap the chart’s report in a PBUI `Presentation` or add an explicit “inspect plot” control in `ChartPanel`. Activation should dispatch the existing inspection behavior with:

```ts
{
  title: `plot ${documentName}`,
  value: buildPlotInspectionReport(...)
}
```

The exact integration depends on whether a whole-SVG `Presentation` interferes with existing datum and legend presentations. The safe first implementation is a small textual “inspect plot” action adjacent to the truncation notice. Nested interactive SVG presentations remain unchanged.

Data flow:

```text
pipeline fields ---> assessPlotAuthoring ----+
                                             |
AuthoringView -------------------------------+--> PlotInspectionReport
                                             |             |
PlotOutcome.statistics + diagnostics --------+             v
                                                     world.inspected
                                                           |
                                                           v
                                                     InspectorApp
                                                           |
                                                           v
                                                  PlotInspectionView
```

### 3.5 Guide incompatible recipe mappings

`EncodingApp` should compute the assessment once from the current view and pipeline fields. Pass `assessment.issues` and requirements to `EncodingPanel`.

The panel should replace the current static requirement sentence with:

- a compact requirement summary when compatible;
- one actionable message per blocking issue when incompatible;
- a button such as `choose categorical x` that calls `onAccept(issue.channel)`;
- a short candidate count, not a large duplicate field list;
- a warning for redundant color/facet with a `clear color` action.

Example copy:

```text
Summary needs categorical x.
Current x “mass_kg” is quantitative. 3 compatible fields are available.
[choose categorical x]
```

When the recipe button is clicked:

```text
onAnalysisKind(kind):
    dispatch setAnalysis(defaultAnalysis(kind))
    compute next assessment from kind + current mappings + current fields
    firstBlocking = first required or incompatible issue
    if firstBlocking exists:
        begin PBUI accept for firstBlocking.channel
```

This immediate accept is useful, but it must not be the only recovery route. The durable issue and button remain visible if the user cancels the accept operation.

There is a React sequencing detail: dispatching the recipe and then reading the old `view` in the same callback produces a stale assessment. Construct `nextAnalysis` locally and call the pure assessment using `{...view, analysis: nextAnalysis}` before dispatch, or use an effect keyed by a deliberate guidance request. Prefer the local computation because it is explicit and cannot relaunch after unrelated renders.

Avoid opening more than one accept interaction. Guide the first blocking channel in recipe requirement order; after the user maps it, the derived assessment exposes the next issue.

### 3.6 Normalize redundant color and facet encodings

Use two layers of enforcement.

First, authoring behavior:

- Mapping facet to the current color field should map facet and clear color in one named Redux action.
- Mapping color to the current facet field should be rejected and leave facet intact, with a visible explanation.
- Loading an existing document with the conflict should show the warning and a `clear color` action.

Add an action that describes intent rather than dispatching two unrelated mutations:

```ts
setEncoding({
  docId,
  channel,
  field,
  normalizeRedundancy: true,
})
```

Reducer pseudocode:

```text
if channel is color and field equals current facet:
    do not change document
    trace rejected redundant color mapping
else:
    set requested mapping
    if channel is facet and field equals current color:
        clear color
    trace mapping and normalization
```

If the project prefers reducers never to reject actions, perform the color check in `EncodingApp` and reserve the reducer for the facet transaction. The important property is that the facet mapping and color removal appear as one undoable authoring operation when undo support is added.

Second, adapter defense:

```text
effective = effectiveEncodings(view.encodings)
build schema from effective mappings plus fields needed by annotations
build mapping from effective.encodings
lower every analysis layer from this mapping
```

When color equals facet, `effectiveEncodings()` suppresses color. Since group is currently derived from color for lines and analytical mappings, group must also be absent. Facet remains.

Do not mutate `view` inside `renderPbuiPlot()`. The adapter is a projection and should remain referentially transparent.

The plot package should not implement this PBUI authoring policy. The plot package correctly permits consumers to specify color and facet independently; another consumer may have a legitimate reason to do so. PBUI owns the decision that this combination is redundant in its current authoring product.

## 4. Delivery phases

### Phase 1: Pure model and contract tests

Create the declarative requirement table, assessment function, field-identity helper, and effective-encoding projection.

Tests should cover:

- every recipe requirement;
- missing x and y;
- incompatible quantitative versus categorical mappings;
- temporal x accepted by summary and boxplot;
- stale fields;
- deterministic candidates;
- same `fieldId` with different names;
- same name without field IDs;
- color/facet conflict;
- non-conflicting color and facet;
- input objects remain unmodified.

Exit condition: model tests establish all invariants without rendering React or executing plot rows.

### Phase 2: Inspector provenance and diagnostics

Add report construction, typed rendering, plot inspection action, and Storybook stories.

Story states:

- raw identity plot;
- summary with interval and grouping;
- regression with multiple groups and estimates;
- density with bandwidths;
- warning-only plot;
- compile error with no plan;
- bounded/truncated coverage;
- empty statistics before a plot is available.

Exit condition: a user can inspect the real PBUI chart and read method, parameters, estimates, assumptions, coverage, and diagnostic codes.

### Phase 3: Guided recipe correction

Compute assessment in `EncodingApp`, render issues in `EncodingPanel`, and start a single accept interaction after an incompatible recipe selection.

Component tests should prove:

- selecting summary with quantitative x retains summary;
- the message names x, the current field, and expected types;
- clicking the action requests x;
- cancellation leaves the issue visible;
- selecting a compatible field removes the issue;
- a second missing channel is offered only after the first is resolved.

Exit condition: summary and boxplot can be selected from a typical quantitative-x chart without leaving the user at an unexplained empty plot.

### Phase 4: Encoding normalization and integrated acceptance

Add the named authoring transaction and adapter defense. Update fixtures for redundant mappings. Test the real site and capture screenshots for all new states.

Acceptance cases:

1. A line chart has `station` as color; mapping `station` as facet produces facets without a redundant legend.
2. Loading a document already containing both mappings still produces a non-redundant plot and explains the suppression.
3. Mapping another field to color preserves both independent encodings.
4. Regression inspector values agree with plot-package fixture metadata.
5. Summary selection from quantitative x launches categorical-x guidance.
6. Boxplot selection follows the same requirement model and does not duplicate logic.
7. Existing datum and legend inspection still works.

Run:

```sh
pnpm --filter @hyperslop-systems/datalab-ui test
pnpm --filter @hyperslop-systems/datalab-ui typecheck
pnpm --filter @hyperslop-systems/datalab-ui lint
pnpm --filter @hyperslop-systems/datalab-ui build
pnpm --filter @hyperslop-systems/datalab-ui build-storybook
pnpm test
pnpm typecheck
pnpm build
```

Run Storybook and the real site in tmux. Capture the process output with `tmux capture-pane`. Use browser screenshots to compare typography, spacing, overflow, light and dark themes, compact panels, and inspector tables.

## 5. Detailed file plan

### Add

- `packages/datalab-ui/src/model/plotAuthoring.ts`: requirements, issues, candidates, and effective encodings.
- `packages/datalab-ui/src/model/plotAuthoring.test.ts`: pure contract tests.
- `packages/datalab-ui/src/model/plotInspection.ts`: report builder.
- `packages/datalab-ui/src/components/organisms/PlotInspectionView/PlotInspectionView.tsx`: typed report.
- `packages/datalab-ui/src/components/organisms/PlotInspectionView/PlotInspectionView.module.css`: compact definition lists and estimate tables.
- `packages/datalab-ui/src/components/organisms/PlotInspectionView/PlotInspectionView.stories.tsx`: scientific and diagnostic states.

### Modify

- `packages/datalab-ui/src/apps/EncodingApp/EncodingApp.tsx`: derive assessment, centralize accept prompts, guide the first invalid requirement.
- `packages/datalab-ui/src/components/organisms/EncodingPanel/EncodingPanel.tsx`: render actionable issues instead of static-only requirements.
- `packages/datalab-ui/src/appkit/plotAdapter.ts`: use effective encodings before schema and layer lowering.
- `packages/datalab-ui/src/apps/ChartApp/ChartApp.tsx`: construct or receive the inspection report.
- `packages/datalab-ui/src/components/organisms/ChartPanel/ChartPanel.tsx`: expose explicit plot inspection without disturbing hit-level presentations.
- `packages/datalab-ui/src/apps/InspectorApp/InspectorApp.tsx`: select the typed report renderer while retaining generic JSON fallback.
- `packages/datalab-ui/src/store/world.ts`: add one normalized encoding transaction if reducer enforcement is selected.
- `packages/datalab-ui/test/fixtures.test.ts`: verify effective mapping, statistics, and diagnostics together.
- `packages/datalab-ui/test/store.test.ts`: verify the facet-wins transaction and trace.

Do not add code to the backend, DuckDB pipeline, or `@hyperslop-systems/plot` unless implementation uncovers missing metadata that the package genuinely owns.

## 6. API and presentation details

### 6.1 Stable issue codes

Messages may change; tests and support tooling should use codes. Recommended codes:

```text
authoring.mapping.required
authoring.mapping.incompatible-type
authoring.mapping.stale
authoring.encoding.redundant-color-facet
```

The code namespace makes it clear these are PBUI authoring findings, not plot compiler diagnostics.

### 6.2 Accessibility

- Issue containers should use `role="status"` when a recipe action creates them.
- Error and warning text must not rely on color alone.
- Correction buttons need explicit labels such as “choose categorical x.”
- Estimate tables require column headers and captions.
- Diagnostic codes can use visually secondary text but must remain selectable.
- When `pbui.accept` begins, its existing prompt must name both the channel and the accepted semantic type.

### 6.3 Theme behavior

Use PBUI tokens and package components. Do not hard-code the Hyperslop palette in the new components. The plot is embedded in PBUI and both daylight and dark modes must inherit the active theme. Inspector tables should use:

- `var(--pbui-fg)` and faint text tokens;
- border and surface tokens;
- semantic warning/error tokens where available;
- the existing compact typography scale.

Test narrow inspector tiles. Long assumption text and diagnostic paths must wrap; numeric tables may scroll horizontally within their section, never expand the workspace tile.

### 6.4 Numeric formatting

The report should preserve raw numbers in its object value and format only at render time. Use one shared formatter:

```ts
formatEstimate(value):
    if not finite: return "—"
    if abs(value) >= 10000 or (abs(value) > 0 and abs(value) < 0.001):
        return exponential with 3 significant digits
    return locale string with at most 4 significant fractional digits
```

Do not round confidence, multiplier, counts, or bin settings through this generic formatter.

## 7. Testing strategy

Use the testing pyramid appropriate to the seams:

- Pure tests for requirements, issue generation, candidates, and normalization.
- Reducer tests for the normalized authoring transaction.
- Component tests for messages, actions, accessibility, and report formatting.
- Adapter fixture tests for generated plot behavior and scientific metadata.
- Storybook for visual states and themes.
- One real-site browser flow for the end-to-end authoring interaction.

Important assertions:

```ts
expect(assessment.issues).toContainEqual(
  expect.objectContaining({
    code: "authoring.mapping.incompatible-type",
    channel: "x",
    actualType: "q",
    acceptedTypes: ["n", "t"],
  }),
)

expect(effective.encodings.color).toBeUndefined()
expect(effective.encodings.facet?.name).toBe("station")
expect(view.encodings.color?.name).toBe("station") // projection did not mutate input

expect(report.statistics[0]).toMatchObject({
  method: "ols",
  invalidValueCount: 0,
})
```

Avoid wall-clock assertions. Verify structural behavior, dispatched actions, output contracts, and visible content.

## 8. Failure modes and controls

- **Duplicated requirement rules:** eliminate the conditional rule copy in `EncodingApp` and `EncodingPanel`; both must consume `requirementsFor()`.
- **Stale React state after recipe selection:** assess a locally constructed next view before dispatch.
- **Automatic accept loops:** launch only from the direct recipe action, never from a render effect that watches incompatibility.
- **Inspector replacing generic inspection:** use a discriminator and renderer fallback.
- **Adapter mutating the document:** normalize into a new effective mapping.
- **Suppressed color still becoming group:** derive group only after suppression.
- **Schema omits a required field:** build schema from effective layer inputs, with annotation requirements included separately.
- **Statistics duplicated for multi-layer recipes:** group inspector entries by semantic statistical operation when identical metadata appears on summary layers, while retaining layer IDs in an expandable detail.
- **Warnings hidden by a successful scene:** inspector always lists diagnostics, not only fatal errors.
- **Backend scope expansion:** use current pipeline fields and rows; do not request new backend fields.

## 9. Decisions and rejected alternatives

### Persist derived diagnostics in `GraphicDocument`

Rejected. Diagnostics and statistical results depend on current data and package execution. Persisting them would create stale scientific claims and migration work.

### Recompute statistics in PBUI

Rejected. The plot package already returns authoritative metadata from the computation that produced the plan. Recalculation can diverge.

### Make Inspector automatically follow the active chart

Rejected. Inspector currently preserves the last explicitly inspected PBUI object. Automatic document following would replace datum, category, field, and source inspection unexpectedly.

### Revert an incompatible recipe selection

Rejected. The selected recipe is the user’s intent. The system should retain it and guide the mapping correction.

### Automatically choose the first compatible field

Rejected for the current phase. Field type does not establish analytical meaning. The user must choose; the system may constrain and enumerate valid candidates.

### Allow redundant color and facet but hide the legend

Rejected. Hiding only the guide leaves redundant scale, grouping, layer, and interaction semantics. The effective mapping itself must be normalized.

### Add a general constraint-solving framework

Rejected. Six recipes and five channels require a declarative table and a pure evaluator, not a generalized solver.

## 10. Definition of done

The ticket is implemented when:

- statistical methods, parameters, estimates, assumptions, invalid counts, coverage, and diagnostics are readable in Inspector;
- generic PBUI inspection still works;
- every analysis recipe uses one declarative requirements source;
- incompatible recipe selections produce actionable, cancel-safe field guidance;
- the user’s selected recipe remains selected;
- color and facet cannot reach the plot as redundant mappings;
- legacy conflicting documents render with facet precedence and an explanatory warning;
- all unit, type, lint, build, Storybook, and real-site acceptance checks pass;
- screenshots show correct PBUI typography, compact layout, and both themes;
- the implementation diary records decisions, commands, failures, and verification evidence.

## References

- `packages/datalab-ui/src/model/graphic.ts`: persisted analysis, channel, view, field-provenance, and diagnostic contracts.
- `packages/datalab-ui/src/model/graphicAuthoring.ts:325`: current compact document facts.
- `packages/datalab-ui/src/apps/EncodingApp/EncodingApp.tsx:53`: duplicated recipe-specific x acceptance.
- `packages/datalab-ui/src/components/organisms/EncodingPanel/EncodingPanel.tsx:81`: static requirement copy.
- `packages/datalab-ui/src/appkit/plotAdapter.ts:40`: sole PBUI/plot composition boundary.
- `packages/datalab-ui/src/apps/useTable.ts:95`: current document analysis and plot hooks.
- `packages/datalab-ui/src/components/organisms/ChartPanel/ChartPanel.tsx:29`: fatal-diagnostic rendering.
- `packages/datalab-ui/src/apps/InspectorApp/InspectorApp.tsx:6`: generic inspection contract.
- `../plot/src/render.ts:15`: `PlotOutcome`.
- `../plot/src/plan.ts:190`: `VisualPlan`, including diagnostics and statistics.
- `../plot/src/stats.ts:18`: `StatisticalMetadata`.
- `packages/datalab-ui/test/fixtures.test.ts:185`: existing recipe-to-statistical-layer fixtures.
