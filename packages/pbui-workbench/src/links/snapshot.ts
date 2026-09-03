import { compileIdentity, DOCUMENT_VALUE_TYPE, portId, refineDeclaration, type ContextDefinition, type LinkSnapshot, type PortDefinition, type PortId, type SerializableReference } from "@hyperslop-systems/pbui";
import type { AppView, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { AppRegistry } from "../apps";
import { stateOf } from "./document";
import type { LinkRuntimeState } from "./runtime";

/**
 * Build the kernel's immutable facts from the three things the shell owns:
 * the document (views, their apps, their slots, the link payload), the app
 * registry (the port declarations, refined per view — Q7), and the runtime
 * (values). Identity classes are recompiled from the persisted declarations
 * with the persisted classes as the previous compile, so ids are stable.
 * Cheap: ports are enumerated once, values are read lazily through closures.
 */
export function buildLinkSnapshot(document: WorkbenchDocument, apps: AppRegistry, runtime: LinkRuntimeState, revision: string | number): LinkSnapshot {
  const ports = new Map<PortId, PortDefinition>();
  const documentSlots = new Map<PortId, SerializableReference>();
  const contexts = new Map<string, { key: string; valueType: string; doc: string; drivenBy: PortId[] }>();
  for (const view of Object.values(document.views)) {
    const app = apps.get(view.appId);
    if (!app?.ports) continue;
    const tileTitle = titleOf(view, app.titleFor, app.title);
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
  const state = stateOf(document);
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

function titleOf(view: AppView, titleFor: ((view: AppView) => string) | undefined, fallback: string): string {
  return view.title || titleFor?.(view) || fallback;
}
