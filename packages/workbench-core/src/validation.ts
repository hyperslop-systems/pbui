import { Direction, type Node, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { ManifestCatalog } from "./apps";
import { documentSlots } from "./apps";
import { diagnostic, type ValidationResult, type WorkbenchDiagnostic } from "./diagnostics";

/**
 * Essential local validation (guide §16, simplification S7): the structural
 * and catalog rules that decide whether the engine can plan over a document
 * at all. Codes and paths follow `pkg/workbench/validate.go` so a refusal
 * reads the same whichever side produced it. The server remains
 * authoritative; byte limits, credential sniffing, and product payload
 * validators are deliberately not reproduced here.
 */
export const WORKBENCH_FORMAT = "pbui.workbench";
export const WORKBENCH_SCHEMA_VERSION = 1;

/** The count/depth limits of `pkg/workbench.DefaultLimits`; byte limits are the server's. */
export interface WorkbenchLimits {
  workspaces: number;
  nodes: number;
  depth: number;
  views: number;
  documents: number;
  documentBindings: number;
}

export const DEFAULT_LIMITS: WorkbenchLimits = { workspaces: 32, nodes: 256, depth: 24, views: 128, documents: 128, documentBindings: 8 };

export interface ValidateOptions {
  /** The application catalog; omitted ⇒ catalog and binding rules are skipped (a parse without a definition). */
  apps?: ManifestCatalog;
  limits?: Partial<WorkbenchLimits>;
}

export function validateWorkbenchDocument(doc: WorkbenchDocument, options: ValidateOptions = {}): ValidationResult {
  const limits: WorkbenchLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const out: WorkbenchDiagnostic[] = [];
  const report = (code: string, path: string, detail: string) => out.push(diagnostic(code, path, detail));

  if (doc.format !== WORKBENCH_FORMAT) report("unsupported_format", "format", `got "${doc.format}", want "${WORKBENCH_FORMAT}"`);
  if (doc.schemaVersion !== WORKBENCH_SCHEMA_VERSION) report("unsupported_version", "schemaVersion", `got ${doc.schemaVersion}, want ${WORKBENCH_SCHEMA_VERSION}`);
  if (doc.workspaces.length === 0) report("workspace_required", "workspaces", "at least one workspace is required");
  if (doc.workspaces.length > limits.workspaces) report("limit_exceeded", "workspaces", `found ${doc.workspaces.length}; limit is ${limits.workspaces}`);
  const viewCount = Object.keys(doc.views).length;
  if (viewCount > limits.views) report("limit_exceeded", "views", `found ${viewCount}; limit is ${limits.views}`);
  const documentCount = Object.keys(doc.documents).length;
  if (documentCount > limits.documents) report("limit_exceeded", "documents", `found ${documentCount}; limit is ${limits.documents}`);

  // Workspaces and trees.
  const nodeIds = new Map<string, string>();
  const workspaceIds = new Set<string>();
  let nodeCount = 0;
  const visit = (node: Node | undefined, path: string, depth: number): void => {
    if (!node) {
      report("invalid_node", path, "node is required");
      return;
    }
    if (depth > limits.depth) {
      report("limit_exceeded", path, `tree depth exceeds ${limits.depth}`);
      return;
    }
    nodeCount += 1;
    if (nodeCount > limits.nodes) {
      report("limit_exceeded", path, `node count exceeds ${limits.nodes}`);
      return;
    }
    if (!node.id.trim()) report("required", `${path}.id`, "value is required");
    else if (nodeIds.has(node.id)) report("duplicate_id", `${path}.id`, `node ID "${node.id}" was already used at ${nodeIds.get(node.id)}`);
    else nodeIds.set(node.id, path);
    if (node.body.case === "leaf") {
      const viewId = node.body.value.viewId;
      if (!viewId) report("invalid_leaf", `${path}.leaf.viewId`, "leaf must reference a view");
      else if (!doc.views[viewId]) report("unknown_view", `${path}.leaf.viewId`, `view "${viewId}" does not exist`);
      return;
    }
    if (node.body.case === "split") {
      const split = node.body.value;
      if (split.direction !== Direction.ROW && split.direction !== Direction.COLUMN) report("invalid_split", `${path}.split.direction`, `got ${split.direction}`);
      if (!Number.isFinite(split.ratio) || split.ratio < 0.05 || split.ratio > 0.95) report("invalid_split", `${path}.split.ratio`, "ratio must be between 0.05 and 0.95");
      if (!split.a || !split.b) {
        report("invalid_split", `${path}.split`, "split requires exactly two children");
        return;
      }
      visit(split.a, `${path}.split.a`, depth + 1);
      visit(split.b, `${path}.split.b`, depth + 1);
      return;
    }
    report("invalid_node", `${path}.body`, "node body is required");
  };
  doc.workspaces.forEach((workspace, i) => {
    const path = `workspaces[${i}]`;
    if (!workspace.id.trim()) report("required", `${path}.id`, "value is required");
    else if (workspaceIds.has(workspace.id)) report("duplicate_id", `${path}.id`, `workspace ID "${workspace.id}" is duplicated`);
    else workspaceIds.add(workspace.id);
    if (!workspace.name.trim()) report("required", `${path}.name`, "value is required");
    visit(workspace.tree, `${path}.tree`, 1);
  });

  // Views and viewOrder: a bijection.
  if (doc.viewOrder.length !== viewCount) report("view_order_mismatch", "viewOrder", `contains ${doc.viewOrder.length} IDs for ${viewCount} views`);
  const ordered = new Set<string>();
  doc.viewOrder.forEach((id, i) => {
    if (ordered.has(id)) report("duplicate_id", `viewOrder[${i}]`, `view ID "${id}" occurs more than once`);
    else if (!doc.views[id]) report("unknown_view", `viewOrder[${i}]`, `view "${id}" does not exist`);
    ordered.add(id);
  });
  const singletons = new Map<string, string>();
  for (const [key, view] of Object.entries(doc.views)) {
    const path = `views["${key}"]`;
    if (key !== view.id) report("id_mismatch", `${path}.id`, `map key "${key}" disagrees with embedded ID "${view.id}"`);
    if (!ordered.has(key)) report("view_order_mismatch", path, "view is absent from viewOrder");
    if (!view.appId.trim()) report("required", `${path}.appId`, "value is required");
    if (view.title !== undefined && view.title.trim() !== view.title) report("noncanonical_title", `${path}.title`, "title must be trimmed");
    const bindingCount = Object.keys(view.documents).length;
    if (bindingCount > limits.documentBindings) report("limit_exceeded", `${path}.documents`, `found ${bindingCount} bindings; limit is ${limits.documentBindings}`);
    if (!options.apps) continue;
    const app = options.apps.get(view.appId);
    if (!app) {
      report("unknown_application", `${path}.appId`, `application "${view.appId}" is not registered`);
      continue;
    }
    if (app.viewCardinality === "one") {
      const first = singletons.get(app.id);
      if (first) report("duplicate_singleton", `${path}.appId`, `application "${app.id}" already has view "${first}"`);
      else singletons.set(app.id, view.id);
    }
    const slots = new Set(documentSlots(app));
    for (const [slot, documentId] of Object.entries(view.documents)) {
      const bindingPath = `${path}.documents["${slot}"]`;
      if (!slots.has(slot) && !app.openBindings) report("unknown_binding", bindingPath, `application "${app.id}" does not define binding "${slot}"`);
      if (!doc.documents[documentId]) report("unknown_document", bindingPath, `document "${documentId}" does not exist`);
    }
  }

  for (const [key, payload] of Object.entries(doc.documents)) {
    const path = `documents["${key}"]`;
    if (!key.trim()) report("required", path, "value is required");
    if (key !== payload.id) report("id_mismatch", `${path}.id`, `map key "${key}" disagrees with embedded ID "${payload.id}"`);
    if (!payload.body) report("invalid_document", `${path}.body`, "document body is required");
  }

  return out.length === 0 ? { ok: true } : { ok: false, diagnostics: out };
}
