import type { ComponentType } from "react";
import { createManifestCatalog, type ManifestCatalog } from "@hyperslop-systems/workbench-core";
import {
  defineWorkbenchApp,
  type AppProps as WorkbenchAppProps,
  type WorkbenchApp,
} from "@hyperslop-systems/pbui-workbench";
import { GRAPHIC_DOCUMENT_FORMAT } from "../store/graphicSource";
import { allApps, type AppDescriptor } from "./registry";

/**
 * Datalab's applications as workbench applications (design §6.1).
 *
 * The registry keeps registering by import side effect (§6.2): an
 * application touches one file, its own. What changes is that the workbench
 * wants an explicit array with no duplicate ids, so the array is built AFTER
 * `apps/all` has loaded, from the registry, rather than declared by hand.
 *
 * The mapping is the whole of the semantic translation:
 *
 *     singleton   → viewCardinality "one"   (the core refuses a second view)
 *     duplicable  → duplicatePlacement "clone" (a bare duplicate mints a view)
 *     docBound    → an optional `primary` binding of the graphic format
 *
 * `primary` is OPTIONAL, not required: a document-bound tile with no binding
 * follows the active document, which is a legal and common state (DocBar's
 * "+" and the launcher both produce it). `launch: "unbound"` for the same
 * reason — Datalab's own launcher decides what to bind — and because the
 * generic launcher is not mounted.
 */
export function toWorkbenchApp(descriptor: AppDescriptor): WorkbenchApp {
  return defineWorkbenchApp({
    manifest: {
      id: descriptor.id,
      viewCardinality: descriptor.singleton ? "one" : "many",
      duplicatePlacement: descriptor.duplicable && !descriptor.singleton ? "clone" : "link",
      bindings: descriptor.docBound
        ? { primary: { required: false, formats: [GRAPHIC_DOCUMENT_FORMAT], role: "primary" } }
        : {},
      launch: "unbound",
    },
    presentation: {
      title: descriptor.title,
      tone: descriptor.tone,
      // Datalab's AppProps names the same two fields; the view type converges
      // on the protocol's AppView at the Surface cutover.
      Component: descriptor.Component as unknown as ComponentType<WorkbenchAppProps>,
    },
  });
}

/** Every registered application, as the workbench sees it. Call after `apps/all` has loaded. */
export function datalabWorkbenchApps(): WorkbenchApp[] {
  return allApps().map(toWorkbenchApp);
}

export function datalabManifests(): ManifestCatalog {
  return createManifestCatalog(datalabWorkbenchApps().map((app) => app.manifest));
}
