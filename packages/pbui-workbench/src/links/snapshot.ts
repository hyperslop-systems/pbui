import { DOCUMENT_VALUE_TYPE, portId, type ContextDefinition, type LinkSnapshot, type PortDefinition, type PortId, type SerializableReference } from "@hyperslop-systems/pbui";
import type { AppView, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { AppRegistry } from "../apps";
import { bindingsOf } from "./document";
import type { LinkRuntimeState } from "./runtime";

/**
 * Build the kernel's immutable facts from the three things the shell owns:
 * the document (views, their apps, their slots, the link payload), the app
 * registry (the port declarations), and the runtime (values). Cheap: ports
 * are enumerated once, values are read lazily through closures.
 */
export function buildLinkSnapshot(document: WorkbenchDocument, apps: AppRegistry, runtime: LinkRuntimeState, revision: string | number): LinkSnapshot {
  const ports = new Map<PortId, PortDefinition>();
  const documentSlots = new Map<PortId, SerializableReference>();
  const contexts = new Map<string, { key: string; valueType: string; doc: string; drivenBy: PortId[] }>();
  for (const view of Object.values(document.views)) {
    const app = apps.get(view.appId);
    if (!app?.ports) continue;
    const tileTitle = titleOf(view, app.titleFor, app.title);
    for (const declaration of app.ports) {
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
  return {
    documentRevision: revision,
    runtimeRevision: runtime.revision,
    ports,
    bindings: bindingsOf(document),
    documentSlots,
    contexts: contexts as ReadonlyMap<string, ContextDefinition>,
    values: {
      emitted: (port) => runtime.emitted.get(port),
      context: (key) => (runtime.contexts.has(key) ? runtime.contexts.get(key) : contexts.has(key) ? null : undefined),
      attended: (port) => runtime.attended.get(port),
    },
  };
}

function titleOf(view: AppView, titleFor: ((view: AppView) => string) | undefined, fallback: string): string {
  return view.title || titleFor?.(view) || fallback;
}
