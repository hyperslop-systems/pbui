import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { LinkDeps, LinkSnapshot, PortDefinition } from "./snapshot";
import type { Binding, SerializableReference } from "./terms";
import { definePort, portId, type PortDeclarationInput, type PortId } from "./types";

/*
 * A small world for the kernel tests: an orders table (out `order`), two
 * details (in `order`, ambient fallback), an inspector (in `subject :
 * <inspectable>`), a plot (document slot + out `datum`), and a notes tile
 * (in `subject : <any>`). Values are set directly; nothing is React.
 */

export const graph = createPresentationTypeGraph([
  { id: "inspectable", abstract: true },
  { id: "order", parents: ["inspectable"] },
  { id: "customer", parents: ["inspectable"] },
  { id: "datum", parents: ["inspectable"] },
  { id: "document" },
]);

export const deps: LinkDeps = {
  graph,
  label: (reference) => (reference.type === "order" ? `#${(reference.value as { id: string }).id}` : `<${reference.type}>`),
};

export interface WorldOptions {
  bindings?: Record<PortId, Binding>;
  emitted?: Record<PortId, SerializableReference>;
  attended?: Record<PortId, SerializableReference>;
  contexts?: Record<string, SerializableReference | null>;
  documentSlots?: Record<PortId, SerializableReference>;
  /** Drop these views from the world (as if closed). */
  without?: string[];
}

const declare = (viewId: string, appId: string, tileTitle: string, input: PortDeclarationInput): PortDefinition => ({
  id: portId(viewId, input.name),
  viewId,
  appId,
  declaration: definePort(input),
  tileTitle,
});

export const ORDER_1042: SerializableReference = { type: "order", value: { id: "1042", customer: "Ada" } };
export const ORDER_1060: SerializableReference = { type: "order", value: { id: "1060", customer: "Sam" } };
export const CUSTOMER_ADA: SerializableReference = { type: "customer", value: { id: "c-ada", name: "Ada" } };

export const PORTS: readonly PortDefinition[] = [
  declare("v-east", "orders", "Orders East", { name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the clicked order", drivesContext: "workspace.order" }),
  declare("v-west", "orders", "Orders West", { name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the clicked order", drivesContext: "workspace.order" }),
  declare("v-a", "order-detail", "Detail A", { name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: "workspace.order" }),
  declare("v-b", "order-detail", "Detail B", { name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: "workspace.order", onSourceClose: "clear" }),
  declare("v-c", "order-detail", "Detail C", { name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", onSourceClose: "ambient", fallbackContext: "workspace.order" }),
  declare("v-insp", "inspector", "Inspector", { name: "subject", direction: "in", contract: "inspectable", doc: "anything", fallbackContext: "workspace.inspected" }),
  declare("v-plot", "plot", "Plot", { name: "plot", direction: "in", contract: { valueType: "document" }, doc: "the plot document", documentSlot: true }),
  declare("v-plot", "plot", "Plot", { name: "datum", direction: "out", contract: "datum", doc: "the activated mark" }),
  declare("v-notes", "notes", "Notes", { name: "subject", direction: "in", contract: "any", doc: "anything at all" }),
  declare("v-cust", "customer-detail", "Customer", { name: "customer", direction: "in", contract: "customer", doc: "the customer shown" }),
];

export function world(options: WorldOptions = {}): LinkSnapshot {
  const without = new Set(options.without ?? []);
  const ports = new Map<PortId, PortDefinition>();
  for (const definition of PORTS) if (!without.has(definition.viewId)) ports.set(definition.id, definition);
  const contexts = new Map<string, { key: string; valueType: string; doc: string; drivenBy: PortId[] }>();
  for (const definition of ports.values()) {
    const key = definition.declaration.fallbackContext ?? definition.declaration.drivesContext;
    if (!key) continue;
    const entry = contexts.get(key) ?? { key, valueType: definition.declaration.contract.valueType, doc: key, drivenBy: [] };
    if (definition.declaration.drivesContext === key) entry.drivenBy.push(definition.id);
    contexts.set(key, entry);
  }
  const emitted = new Map(Object.entries(options.emitted ?? {}));
  const attended = new Map(Object.entries(options.attended ?? {}));
  const cells = new Map(Object.entries(options.contexts ?? {}));
  const documentSlots = new Map(Object.entries(options.documentSlots ?? { "v-plot/plot": { type: "document", value: "revenue-by-day" } }));
  return {
    documentRevision: 1,
    runtimeRevision: 1,
    ports,
    bindings: new Map(Object.entries(options.bindings ?? {})),
    documentSlots,
    contexts,
    values: {
      emitted: (port) => emitted.get(port),
      context: (key) => (cells.has(key) ? cells.get(key) : contexts.has(key) ? null : undefined),
      attended: (port) => attended.get(port),
    },
  };
}

/** The same world with a different explicit-bindings map (what a handler produces). */
export function withBindings(s: LinkSnapshot, bindings: ReadonlyMap<PortId, Binding>): LinkSnapshot {
  return { ...s, bindings, documentRevision: Number(s.documentRevision) + 1 };
}
