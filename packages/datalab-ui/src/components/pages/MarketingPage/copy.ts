/**
 * Every word on the marketing page, in one file.
 *
 * ## The rewrite (AGENTLOGIC-4)
 *
 * The previous copy was lifted from a prototype reference page with "PBUI"
 * substituted by "DATA LAB" — its own header flagged that choice as one to
 * revisit. This is the revisit: written from scratch, in the product's voice,
 * and ordered so a stranger meets the *idea* before the feature list.
 *
 * The narrative is: hook (the chart is not a picture) → the PBUI concept
 * (objects and verbs, tiles and documents, one world) → what DATA LAB builds
 * on top of it (visible pipeline, grammar of graphics, local execution) →
 * the tutorial → the runtime → the family (the same workbench idiom carries
 * other applications, agentlogic among them).
 *
 * ## The rule this file is under, kept from the previous version
 *
 * **A claim here must name something a reader could go and find.** If a card
 * cannot be traced to a file, delete the card. The previous copy shipped three
 * runtime claims that were true of a prototype and false of this product
 * ("JavaScript evaluator", "LRU geometry cache", "LTTB decimation" — none
 * existed anywhere in ui/src). Every card below carries its trace.
 *
 * ## Why the copy is data rather than JSX
 *
 * So the whole page reads top to bottom as prose, and can be edited by
 * someone who does not write React.
 */

export const HERO = {
  eyebrow: "A PBUI workbench for data analysis",
  headline: "The chart is not a picture.",
  lede:
    "Every mark, field, step and legend entry on this screen is a live object: it knows its " +
    "value, it knows its type, and it carries a menu of verbs that edit the analysis itself. " +
    "DATA LAB is built on that one idea — right-click anything, and the thing you point at " +
    "is the thing you change.",
  chips: ["DuckDB-Wasm worker", "visible pipeline steps", "linked views"],
  /**
   * The one instruction on the page, so it has to work on the data beside it.
   *
   * "Keep only" is the menu label verbatim (`pbui/descriptors/cat.ts:32`), and
   * `station` is a categorical column of the seeded `readings` stream, which
   * matters: only categorical columns get keep/exclude
   * (`descriptors/datum.ts:38`). The hero seed also ships one filter step
   * already in the pipeline (`tour/fixtures.ts:heroSeed`), so "the pipeline
   * beside it" is not an empty tile when the reader looks.
   */
  tryIt:
    "Try it: right-click a point, choose Keep only station = …, " +
    "then disable the new filter in the pipeline beside it.",
  primary: "Learn it in five exercises",
  secondary: "See the runtime",
} as const;

/**
 * The concept section: PBUI itself, before any product feature.
 *
 * Traceability:
 *   01  presentations carry value and type      pbui/src/types.ts, descriptors/*
 *   02  the accept protocol and its red banner  the §A tour cheat sheet teaches
 *       it live on this same page; Esc aborts
 *   03  tiles/documents/workspaces              store/world.ts, store/controller.ts;
 *       §B of the tour proves two tiles on one document move together
 *
 * The lineage sentence stays: Genera and CLIM are where presentation-based
 * interaction comes from, and naming the ancestry is more honest than
 * pretending the idea is new.
 */
export const CONCEPT = {
  eyebrow: "The idea underneath — PBUI",
  headline: "Presentation-based interaction.",
  lede:
    "Most interfaces flatten their objects into pixels the moment they draw them; from then on " +
    "you operate on the picture. In a PBUI application the rendered value stays attached to the " +
    "real object — an idea inherited from Genera and CLIM. Three consequences carry the whole " +
    "workbench:",
  cards: [
    {
      n: "01",
      title: "Objects, not pixels",
      body:
        "Whatever is displayed remains a first-class handle: a mark knows its row, a field " +
        "knows its type, a step knows its place. Hovering names the object; its menu lists " +
        "the verbs that type supports.",
    },
    {
      n: "02",
      title: "Verbs that can ask",
      body:
        "A command can pause and accept an argument you point at, anywhere on screen — the red " +
        "banner names what it wants, Esc aborts. No dialog boxes reconstructing what you were " +
        "already looking at.",
    },
    {
      n: "03",
      title: "Tiles are windows; documents are the thing",
      body:
        "Every pane is a view of one document or of the shared world. Two tiles pointed at the " +
        "same document move together, because they are not copies — and workspaces are layouts, " +
        "never data.",
    },
  ],
} as const;

/**
 * What DATA LAB builds on the concept. Traceability:
 *   01  filter · derive · summarize · sort · limit is the exact TransformKind
 *       union (model/transformEditor.ts:7) — a sixth transform makes this
 *       sentence wrong the day it lands
 *   02  the spec line is §C's cheat sheet, verbatim
 *   03  the DuckDB worker: appkit/analysisCoordinator.ts
 */
export const PRODUCT = {
  eyebrow: "What DATA LAB does with it",
  headline: "An analysis you can hold open.",
  lede:
    "Point the workbench at an event stream or a dataset version, and the chart, table, " +
    "pipeline and encoding stay four views of one live document — filter from the chart, " +
    "re-map from the encoding, disable a step from the pipeline, and every view answers.",
  cards: [
    {
      n: "01",
      title: "Computation stays visible",
      body:
        "Filters, derives, summaries, sorts and limits are ordered, editable steps — not " +
        "history that disappeared behind a render. Disable a step in place to A/B your own " +
        "transform.",
    },
    {
      n: "02",
      title: "A grammar, not a chart-type menu",
      body:
        "A chart is a composition — source ⊳ steps ↦ mapping · geom · scale — editable from " +
        "either end. Ask for a geometry the data cannot support and the chart says why, " +
        "instead of guessing.",
    },
    {
      n: "03",
      title: "Branch without flattening",
      body:
        "Documents, workspaces and snapshots separate the analysis from its layout, so " +
        "comparing two states never means screenshots or duplicated files.",
    },
  ],
} as const;

export const TUTORIAL = {
  eyebrow: "Interactive tutorial",
  headline: "Learn it by doing it, right here.",
  lede:
    "Five exercises, and every panel in them is the real product — the same workbench shell, " +
    "answering from committed fixtures instead of a server. Each exercise watches the world, " +
    "not your mouse: any route that reaches the goal counts, including one nobody wrote down.",
  narrow:
    "The exercises work on small screens. Tile dragging and side-by-side comparison are easier on a desktop.",
} as const;

/**
 * The four runtime claims, each traceable — kept from the verified set:
 *   lazy worker          appkit/analysisCoordinator.ts — one lazily-created executor
 *   stale-while-fresh    analysisCoordinator.ts:76 — the latest-generation rule
 *   purge on principal   AnalysisProvider.tsx:45 — "changing it purges all data"
 *   bounded results      AnalysisProvider.tsx:23 — MVP_MAX_RESULT_ROWS, plus coverage
 */
export const RUNTIME = {
  eyebrow: "Frontend runtime",
  headline: "Your data stays where you are.",
  lede:
    "The visible pipeline compiles to SQL and runs against DuckDB in a browser worker. " +
    "Nothing is sent anywhere to be computed — the server stores and serves bytes; the " +
    "analysis happens in your tab.",
  cards: [
    {
      title: "DuckDB-Wasm in a worker",
      body: "The database initializes lazily, on the first query rather than on page load. Sources are registered once and pipeline queries run off the main thread.",
    },
    {
      title: "The last good answer stays up",
      body: "Edits supersede in-flight queries rather than racing them. The previous result stays on screen, marked stale, until the new one lands.",
    },
    {
      title: "One runtime per workbench",
      body: "The worker, database and connection belong to a single workbench root, and changing who is signed in purges all of it. No result outlives the principal that was allowed to see it.",
    },
    {
      title: "Bounded, and honest about it",
      body: "Results are capped and every table reports its own coverage, so a truncated answer says so instead of quietly looking like a complete one.",
    },
  ],
} as const;

export const WORKFLOW = {
  eyebrow: "The full workflow",
  headline: "Bring a question. Keep the reasoning.",
  body:
    "The final exercise removes the guided steps: a question, a workbench, and five things " +
    "that must be true when you are done. Build the filtered summary, map it, save it, and " +
    "place the evidence beside the picture — the checks tick by watching the world.",
} as const;

/**
 * The family note replaces the old design-note section. The lineage sentence
 * moved up into CONCEPT; what remains at the bottom is the wider claim: the
 * workbench idiom is a library, and DATA LAB is one application of it.
 * agentlogic — the transcript workbench over coding-agent sessions — is
 * another, with the same tiles, the same verbs, the same accept protocol.
 */
export const FAMILY = {
  eyebrow: "One idiom, many backends",
  headline: "DATA LAB is one PBUI application.",
  body:
    "The presentation layer, the tile shell and the verb protocol live in a library, and this " +
    "product is one application of it. agentlogic applies the same workbench to a different " +
    "object entirely — the transcripts coding agents leave behind: the same tiles, the same " +
    "right-click, a different world underneath. Learning one is learning both.",
} as const;

export const FOOTER = {
  tagline: "Local query execution · linked analytical views · editable chart specifications",
  back: "Back to the live demo ↑",
} as const;

/** The sticky header's sections, in page order. */
export const NAV = [
  { id: "product", label: "Product" },
  { id: "concept", label: "The idea" },
  { id: "tutorial", label: "Tutorial" },
  { id: "runtime", label: "Runtime" },
] as const;

/** The one call to action that leaves the page. */
export const OPEN_WORKBENCH = "Open the workbench →";
