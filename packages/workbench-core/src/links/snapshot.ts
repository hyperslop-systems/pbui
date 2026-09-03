import { compileIdentity, DOCUMENT_VALUE_TYPE, portId, refineDeclaration, type ContextDefinition, type LinkSnapshot, type PortDefinition, type PortId, type SerializableReference } from "@hyperslop-systems/pbui/link-kernel";
import type { AppView, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { ManifestCatalog } from "../apps";
import { stateOf } from "./document";
import type { LinkRuntimeState } from "./runtime";

/** How the collaborator names things for badges and candidates; the shell supplies presentation titles. */
export interface LinkLabels {
  view(view: AppView): string;
  app(appId: string): string;
}

export const DEFAULT_LINK_LABELS: LinkLabels = {
  view: (view) => view.title || view.appId,
  app: (appId) => appId,
};

/**
 * Build the kernel's immutable facts from the three things the core owns:
 * the document (views, their apps, their slots, the link payload), the
 * manifest catalog (the port declarations, refined per view), and the
 * runtime (values). Identity classes are recompiled from the persisted
 * declarations with the persisted classes as the previous compile, so ids
 * are stable. Cheap: ports are enumerated once, values are read lazily.
 */
export function buildLinkSnapshot(doc: WorkbenchDocument, apps: ManifestCatalog, runtime: LinkRuntimeState, revision: string | number, labels: LinkLabels = DEFAULT_LINK_LABELS): LinkSnapshot {
  const ports = new Map<PortId, PortDefinition>();
  const documentSlots = new Map<PortId, SerializableReference>();
  const contexts = new Map<string, { key: string; valueType: string; doc: string; drivenBy: PortId[] }>();
  for (const view of Object.values(doc.views)) {
    const app = apps.get(view.appId);
    if (!app?.ports) continue;
    const tileTitle = labels.view(view);
    for (const declared of app.ports) {
      const declaration = refineDeclaration(declared, view);
      const id = portId(view.id, declaration.name);
      ports.set(id, { id, viewId: view.id, appId: view.appId, declaration, tileTitle });
      if (declaration.documentSlot) {
        const bound = view.documents[declaration.name];
        if (bound) documentSlots.set(id, { type: DOCUMENT_VALUE_TYPE, value: bound });
      }
      for (const key of [declaration.fallbackContext, declaration.drivesContext]) {
        if (!key) continue;
        const entry = contexts.get(key) ?? { key, valueType: declaration.contract.valueType, doc: `the ${key} context`, drivenBy: [] };
        if (declaration.drivesContext === key) entry.drivenBy.push(id);
        contexts.set(key, entry);
      }
    }
  }
  const state = stateOf(doc);
  const compiled = compileIdentity(state.identity, ports, state.classes);
  const classes = new Map(compiled.classes.map((cls) => [cls.id, cls]));
  return {
    documentRevision: revision,
    runtimeRevision: runtime.revision,
    ports,
    bindings: state.bindings,
    identity: state.identity,
    classes,
    aliases: compiled.aliases,
    history: state.history,
    documentSlots,
    contexts: contexts as ReadonlyMap<string, ContextDefinition>,
    values: {
      emitted: (port) => runtime.emitted.get(port),
      context: (key) => (runtime.contexts.has(key) ? runtime.contexts.get(key) : contexts.has(key) ? null : undefined),
      attended: (port) => runtime.attended.get(port),
      classCell: (id) => (runtime.classes.has(id) ? runtime.classes.get(id) : classes.has(id) ? null : undefined),
    },
  };
}
