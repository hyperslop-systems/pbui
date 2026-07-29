import type { Me } from "../api/client";
import { appendTransform, createGraphicDocument, rootView } from "../model/graphicAuthoring";
import type { AuthoringTransform, GraphicDocument, Mark } from "../model/graphic";
import type { SourceRef } from "../model/table";

export const WELCOME_DOC_IDS = {
  populationBars: "demo-v1-population-bars",
  populationScatter: "demo-v1-population-scatter",
  temperature: "demo-v1-temperature",
  humidity: "demo-v1-humidity",
  yieldByLine: "demo-v1-yield-by-line",
  massYield: "demo-v1-mass-yield",
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
  const view = rootView(document);
  view.mark = spec.mark;
  view.encodings = {
    x: { name: spec.x },
    y: { name: spec.y },
    ...(spec.color ? { color: { name: spec.color } } : {}),
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
    groupBy: [{ name: group }],
    measures: [{ name: output, function: fn, field: { name: field } }],
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
    }),
    demoDocument({
      id: WELCOME_DOC_IDS.humidity,
      name: "Humidity by station",
      source: climate,
      mark: "area",
      x: "time",
      y: "humidity",
      color: "station",
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
  ];

  return Object.fromEntries(documents.map((document) => [document.id, document]));
}
