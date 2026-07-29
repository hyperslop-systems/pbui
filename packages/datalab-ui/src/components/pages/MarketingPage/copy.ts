/**
 * Every word on the marketing page, in one file.
 *
 * ## Where it comes from
 *
 * Lifted from the reference landing page the requester preferred
 * (`pbui-landing-duckdb.tsx:2861-3031`), with one substitution: that page says
 * "PBUI" and this one says "DATA LAB".
 *
 * That is a deliberate reading of "I like the copy from the pbui-landing-duckdb
 * more than what you have, so let's keep that for now" — keep the sentences,
 * change the product name. The alternative reading, *rewrite it in the brand's
 * voice*, is defensible and would produce a different page; §6.3 of the design
 * doc records the choice so it can be revisited rather than discovered.
 *
 * ## Two places the reference's words were NOT kept, and why
 *
 * Both are the reference describing a *different program* — it is accurate
 * about itself, and datadrop is a separate implementation with different data.
 * Keeping the instruction would have meant shipping something a visitor cannot
 * follow, and keeping the runtime cards would have meant shipping claims that
 * are false. Neither can be what "keep the copy" meant.
 *
 *  - **`HERO.tryIt`** told the reader to "keep one species". There is no
 *    species column in any datadrop fixture; the hero shows weather stations.
 *  - **`RUNTIME.cards`** — three of four described the prototype's runtime.
 *
 * Each is annotated at the declaration with what was checked. Everything else
 * is the reference's, verbatim, and the `FEATURES` comment records the claims
 * that were traced and found true.
 *
 * ## Why the copy is data rather than JSX
 *
 * The reference file keeps its prose inline in the markup, which makes it
 * unreviewable as prose: to check the page reads well you have to read past
 * `style={{ fontSize: "clamp(46px, 6.4vw, 78px)" }}` between every sentence.
 * Here the whole page can be read top to bottom in one screen, and edited by
 * someone who does not write React.
 */

export const HERO = {
  eyebrow: "Browser-native visual analysis",
  headline: "Explore data without losing the thread.",
  lede:
    "DATA LAB keeps the chart, table, pipeline and encoding in one live document. " +
    "Filter a mark, remap a field, inspect a transform, or branch the analysis " +
    "without leaving the workspace.",
  chips: ["DuckDB-Wasm worker", "visible SQL-shaped steps", "linked views"],
  /**
   * The one instruction on the page, so it has to work on the data beside it.
   *
   * The reference said "keep one species", which is its penguins dataset
   * showing through. **There is no species column in any datadrop fixture.**
   * The hero seeds `readings` — an event stream from four weather stations —
   * so a visitor following it looked for something that is not on screen, in
   * the single sentence telling them what to do.
   *
   * "Keep only" is the menu label verbatim (`pbui/descriptors/cat.ts:32`), and
   * `station` is a categorical column, which matters: only categorical columns
   * get keep/exclude, because "keep only temp_c = 21.4" is a filter nobody
   * wants (`descriptors/datum.ts:38`).
   */
  tryIt:
    "Try it: right-click a point, choose Keep only station = …, " +
    "then disable the new filter in the pipeline beside it.",
  primary: "Take the product tour",
  secondary: "See the runtime",
} as const;

export const WHY = {
  eyebrow: "Why the workbench feels different",
  headline: "One analysis. Several useful views.",
  lede:
    "The chart is not a dead-end render. It is one view over a document that also has " +
    "a relation, a pipeline, an encoding and a history of states worth keeping.",
} as const;

/**
 * Verified against the code, DATADROP-14 step 12.
 *
 *   01  presentations carry their value and type          pbui/types.ts, descriptors/*
 *   02  filter · derive · summarize · sort · limit        model/transformEditor.ts:7
 *   03  documents, workspaces and snapshots               store/world.ts, store/layout.ts
 *
 * Card 02's five names are exact rather than illustrative — `TransformKind` is
 * literally that union — and if a sixth transform is ever added this line is
 * wrong the day it lands.
 */
export const FEATURES = [
  {
    n: "01",
    title: "Edit from the evidence",
    body: "Marks, legend entries, fields and rows retain their data and type. Their menus act on the underlying document.",
  },
  {
    n: "02",
    title: "Keep computation visible",
    body: "Filters, derives, summaries, sorts and limits remain ordered, editable steps instead of disappearing behind a chart.",
  },
  {
    n: "03",
    title: "Branch without flattening",
    body: "Documents, workspaces and snapshots separate the analysis from its layout, so comparison does not require screenshots or duplicated files.",
  },
] as const;

export const TUTORIAL = {
  eyebrow: "Interactive tutorial",
  headline: "Learn it by answering a question.",
  lede:
    "These are not screenshots or a separate tutorial shell. Each exercise embeds the product, " +
    "observes the resulting state, and accepts any route that reaches the goal.",
  narrow:
    "The exercises work on small screens. Tile dragging and side-by-side comparison are easier on a desktop.",
} as const;

/**
 * THE ONE SECTION THAT IS NOT THE REFERENCE'S COPY, AND WHY.
 *
 * The reference page's four runtime cards describe the *prototype's* runtime,
 * which is a different implementation. Three of the four were false of datadrop
 * (DATADROP-14 OQ-3), and each was checked rather than assumed:
 *
 *   "The small JavaScript evaluator renders the first frame"
 *       — there is no JavaScript evaluator. `useTableFor` is documented as a
 *         "synchronous PBUI lookup of the latest current DuckDB result"; every
 *         document goes through DuckDB and shows a loading state until it does.
 *   "a second LRU stores built plot geometry"
 *       — no LRU exists anywhere in ui/src.
 *   "line and area series use LTTB decimation"
 *       — no decimation exists anywhere in ui/src.
 *
 * Before this was checked, the only file in the repository containing the
 * strings "LRU", "LTTB" and "decimat" was THIS ONE. That is the shape of the
 * failure: marketing copy that describes a system nobody built, in a file no
 * test reads.
 *
 * So these four cards say what datadrop's runtime actually does. Each is
 * traceable:
 *
 *   lazy worker          appkit/analysisCoordinator.ts — one lazily-created executor
 *   stale-while-fresh    analysisCoordinator.ts:76 — the latest-generation rule
 *   purge on principal   AnalysisProvider.tsx:45 — "changing it purges all data"
 *   bounded results      AnalysisProvider.tsx:23 — MVP_MAX_RESULT_ROWS, plus coverage
 *
 * The rule this section is under: **a claim here must name something a reader
 * could go and find.** If a card cannot be traced to a file, delete the card.
 */
export const RUNTIME = {
  eyebrow: "Frontend runtime",
  headline: "Fast enough to stay direct.",
  lede:
    "DATA LAB compiles the visible pipeline to SQL and executes it against DuckDB in a browser " +
    "worker. Nothing is sent anywhere to be computed.",
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
    "The final exercise removes the guided steps. Build a filtered summary, map it, save it, " +
    "and place the evidence beside the picture.",
} as const;

export const DESIGN_NOTE = {
  eyebrow: "Design note",
  headline: "A grammar of graphics with object-level interaction.",
  body:
    "DATA LAB combines a grammar-of-graphics document model with presentation-based interaction " +
    "inspired by Genera and CLIM. Rendered values retain their type and behavior, so the result " +
    "can be edited from the chart, table, pipeline or field browser without inventing a separate " +
    "command language for each view.",
} as const;

export const FOOTER = {
  tagline: "Local query execution · linked analytical views · editable chart specifications",
  back: "Back to the live demo ↑",
} as const;

/** The sticky header's sections, in page order. */
export const NAV = [
  { id: "product", label: "Product" },
  { id: "tutorial", label: "Tutorial" },
  { id: "runtime", label: "Runtime" },
] as const;

/** The one call to action that leaves the page. */
export const OPEN_WORKBENCH = "Open the workbench →";
