import type { Me } from "../api/client";
import {
  appendTransform,
  createGraphicDocument,
  fieldRef,
  rootView,
  transformFieldRef,
} from "../model/graphicAuthoring";
import type { AuthoringTransform, GraphicDocument, Mark } from "../model/graphic";
import type { SourceRef } from "../model/table";

/**
 * The ids are versioned so a revision can mint new documents without mutating
 * anything persisted under the old ids. v2 (AGENTLOGIC-4) added the QC filter
 * to both climate documents and the defects document — every demo pipeline now
 * holds at least one visible step, because an empty pipeline tile beside a
 * finished chart teaches that the pipeline is decoration.
 */
export const WELCOME_DOC_IDS = {
  populationBars: "demo-v2-population-bars",
  populationScatter: "demo-v2-population-scatter",
  temperature: "demo-v2-temperature",
  humidity: "demo-v2-humidity",
  yieldByLine: "demo-v2-yield-by-line",
  massYield: "demo-v2-mass-yield",
  defectsByLine: "demo-v2-defects-by-line",
} as const;

type DemoDocId = (typeof WELCOME_DOC_IDS)[keyof typeof WELCOME_DOC_IDS];
type Welcome = NonNullable<Me["welcome"]>;

/**
 * Whether installing the shared demo catalog should also make its temperature
 * document ambiently active.
 *
 * Signed-in users keep their own active document. Anonymous users do too once
 * it points at any source; an empty source is the same first-arrival signal the
 * legacy welcome claim uses.
 */
export function shouldActivateWelcomeDemo(
  authenticated: boolean,
  activeDocId: string | null,
  activeSourceDrop: string,
): boolean {
  return !authenticated && (activeDocId === null || activeSourceDrop === "");
}

export interface WelcomeDemoInstallation {
  documents: Record<string, GraphicDocument>;
  activateDocId: DemoDocId | null;
}

/** Build the audience-independent documents and the optional arrival action. */
export function welcomeDemoInstallation(
  welcome: Welcome,
  authenticated: boolean,
  activeDocId: string | null,
  activeSourceDrop: string,
): WelcomeDemoInstallation {
  const documents = welcomeDemoDocuments(welcome);
  const complete = Object.keys(documents).length > 0;
  return {
    documents,
    activateDocId:
      complete && shouldActivateWelcomeDemo(authenticated, activeDocId, activeSourceDrop)
        ? WELCOME_DOC_IDS.temperature
        : null,
  };
}

function sourceFor(welcome: Welcome, dataset: string): SourceRef | null {
  const found = welcome.datasets?.find((candidate) => candidate.dataset === dataset);
  if (!found) return null;
  return {
    kind: "dataset",
    drop: welcome.drop,
    dataset: found.dataset,
    version: found.version,
    path: found.path,
  };
}

interface DocumentSpec {
  id: DemoDocId;
  name: string;
  source: SourceRef;
  mark: Mark;
  x: string;
  y: string;
  color?: string;
  transforms?: AuthoringTransform[];
  references?: Array<{ on: "x" | "y"; value: number; label: string; intent: "target" }>;
}

function demoDocument(spec: DocumentSpec): GraphicDocument {
  const document = createGraphicDocument(spec.id, spec.name, spec.source, 2_000);
  for (const transform of spec.transforms ?? []) appendTransform(document, transform);
  const reference = (name: string) => {
    const producer = [...Object.values(document.transforms)]
      .reverse()
      .find(
        (transform) =>
          (transform.kind === "core:extend" && transform.name === name) ||
          (transform.kind === "core:aggregate" &&
            transform.measures.some((measure) => measure.name === name)),
      );
    return producer ? transformFieldRef(producer.id, name) : fieldRef("source:root", name);
  };
  const view = rootView(document);
  view.mark = spec.mark;
  view.encodings = {
    x: reference(spec.x),
    y: reference(spec.y),
    ...(spec.color ? { color: reference(spec.color) } : {}),
  };
  if (spec.references) view.references = spec.references;
  return document;
}

function aggregate(
  id: string,
  group: string,
  output: string,
  fn: "mean" | "sum",
  field: string,
): AuthoringTransform {
  return {
    id,
    kind: "core:aggregate",
    input: { kind: "source", sourceId: "source:root" },
    enabled: true,
    state: "complete",
    groupBy: [fieldRef("source:root", group)],
    measures: [{ name: output, function: fn, field: fieldRef("source:root", field) }],
  };
}

/**
 * A `field = "value"` filter step, for the QC flags the seed data carries.
 *
 * The comparison goes through an explicit string cast because the field's
 * physical type is inferred from the rows on screen: boolean once data has
 * arrived, string while the table is still empty. A bare boolean literal
 * would type-check in one phase and fail in the other; the cast form is
 * valid in both, and DuckDB renders a boolean as 'true'/'false' under it.
 */
function filterEq(id: string, field: string, value: string): AuthoringTransform {
  return {
    id,
    kind: "core:filter",
    input: { kind: "source", sourceId: "source:root" },
    enabled: true,
    state: "complete",
    predicate: {
      kind: "call",
      function: "eq",
      arguments: [
        {
          kind: "cast",
          expression: { kind: "field", field: fieldRef("source:root", field) },
          to: { kind: "string" },
          onFailure: "null",
        },
        { kind: "literal", value },
      ],
    },
  };
}

/**
 * Build the finished analytical documents shown by the anonymous demo stage.
 *
 * Returns an empty object until the server advertises every required source.
 * A partially configured deployment should show ordinary empty/loading states,
 * never a chart silently pointed at the wrong dataset.
 */
export function welcomeDemoDocuments(welcome: Welcome): Record<string, GraphicDocument> {
  const census = sourceFor(welcome, "regional-census");
  const climate = sourceFor(welcome, "climate-readings");
  const production = sourceFor(welcome, "production-batches");
  if (!census || !climate || !production) return {};

  const documents = [
    demoDocument({
      id: WELCOME_DOC_IDS.populationBars,
      name: "Population by region",
      source: census,
      mark: "bar",
      x: "region",
      y: "population_total",
      color: "region",
      transforms: [
        aggregate("aggregate-population", "region", "population_total", "sum", "population"),
      ],
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.populationScatter,
      name: "Population and land area",
      source: census,
      mark: "point",
      x: "area_km2",
      y: "population",
      color: "region",
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.temperature,
      name: "Temperature by station",
      source: climate,
      mark: "line",
      x: "time",
      y: "temp_c",
      color: "station",
      // The climate readings carry a QC flag, and the demo starts the way a
      // real analysis of them would: failed readings filtered, visibly, as a
      // step the visitor can hover and disable.
      transforms: [filterEq("filter-qc-temperature", "ok", "true")],
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.humidity,
      name: "Humidity by station",
      source: climate,
      mark: "area",
      x: "time",
      y: "humidity",
      color: "station",
      transforms: [filterEq("filter-qc-humidity", "ok", "true")],
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.yieldByLine,
      name: "Yield by production line",
      source: production,
      mark: "bar",
      x: "line",
      y: "mean_yield",
      color: "line",
      transforms: [aggregate("aggregate-yield", "line", "mean_yield", "mean", "yield_pct")],
      references: [{ on: "y", value: 85, label: "85% target", intent: "target" }],
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.massYield,
      name: "Batch mass and yield",
      source: production,
      mark: "point",
      x: "mass_kg",
      y: "yield_pct",
      color: "line",
      references: [{ on: "y", value: 85, label: "85% target", intent: "target" }],
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.defectsByLine,
      name: "Defects by line",
      source: production,
      mark: "bar",
      x: "line",
      y: "total_defects",
      color: "line",
      transforms: [aggregate("aggregate-defects", "line", "total_defects", "sum", "defects")],
    }),
  ];

  return Object.fromEntries(documents.map((document) => [document.id, document]));
}
