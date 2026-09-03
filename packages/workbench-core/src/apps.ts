import { definePorts, documentSlotsOf, hasDocumentSlot, type PortDeclaration, type PortDeclarationInput } from "@hyperslop-systems/pbui/link-kernel";

/**
 * The semantic half of an application (guide §8.1, §16.8): what the engine
 * needs to plan with, and nothing a renderer needs. The React half — title,
 * tone, component, launcher prose — is a separate projection that the shell
 * joins by `id`.
 */
export type ViewCardinality = "one" | "many";
export type DuplicatePlacement = "clone" | "link";

export interface WorkbenchAppManifest {
  readonly id: string;
  /**
   * `"one"`: at most one logical view of this application may exist in the
   * document (what `pkg/workbench` enforces as `duplicate_singleton`).
   * `"many"`: any number.
   */
  readonly viewCardinality: ViewCardinality;
  /**
   * What a bare duplicate of a tile does: `"clone"` mints an independent
   * view with the same bindings; `"link"` places the same view a second time.
   * A `"one"` application can only link.
   */
  readonly duplicatePlacement: DuplicatePlacement;
  /** Typed ports (PBUI-LINK-1). A `documentSlot` port is a key of `view.documents`. */
  readonly ports?: readonly PortDeclaration[];
  /**
   * The application accepts bindings beyond its declared document slots.
   * For a host whose bindings are declared by the bound resource rather than
   * the manifest — the sandbox's `script` application, whose programs each
   * name their own — so `unknown_binding` is not reported for its views.
   * Every bound document must still exist. Default false.
   */
  readonly openBindings: boolean;
}

export interface WorkbenchAppManifestInput {
  id: string;
  /** Default `"many"`. */
  viewCardinality?: ViewCardinality;
  /** Default: `"link"` for a `"one"` application, `"clone"` otherwise. */
  duplicatePlacement?: DuplicatePlacement;
  ports?: readonly PortDeclarationInput[];
  /** Default false. */
  openBindings?: boolean;
}

/** Normalise a manifest so readers never branch on `undefined`, and refuse the contradiction `one` + `clone`. */
export function defineAppManifest(input: WorkbenchAppManifestInput): WorkbenchAppManifest {
  if (!input.id || input.id.trim() !== input.id) throw new Error(`workbench-core: application id ${JSON.stringify(input.id)} must be a non-empty, trimmed string`);
  const viewCardinality = input.viewCardinality ?? "many";
  const duplicatePlacement = input.duplicatePlacement ?? (viewCardinality === "one" ? "link" : "clone");
  if (viewCardinality === "one" && duplicatePlacement === "clone") {
    throw new Error(`workbench-core: application "${input.id}" declares viewCardinality "one" and duplicatePlacement "clone"; a single view cannot be cloned`);
  }
  const ports = input.ports && input.ports.length > 0 ? definePorts(input.ports) : undefined;
  return { id: input.id, viewCardinality, duplicatePlacement, ...(ports ? { ports } : {}), openBindings: input.openBindings ?? false };
}

/** Is the application a view OF a document — does it declare a document-slot port? */
export function isDocBound(app: WorkbenchAppManifest): boolean {
  return hasDocumentSlot(app.ports);
}

/** The keys of `view.documents` the application reads: its document-slot port names, in declaration order. */
export function documentSlots(app: WorkbenchAppManifest): string[] {
  return documentSlotsOf(app.ports);
}

export interface ManifestCatalog {
  get(id: string): WorkbenchAppManifest | null;
  list(): readonly WorkbenchAppManifest[];
}

/** An explicit list, never import-side-effect registration; a duplicate id fails construction. */
export function createManifestCatalog(manifests: readonly WorkbenchAppManifest[]): ManifestCatalog {
  const byId = new Map<string, WorkbenchAppManifest>();
  for (const manifest of manifests) {
    if (byId.has(manifest.id)) throw new Error(`workbench-core: application "${manifest.id}" is registered twice`);
    byId.set(manifest.id, manifest);
  }
  const list = Object.freeze([...byId.values()]);
  return { get: (id) => byId.get(id) ?? null, list: () => list };
}

export function isManifestCatalog(value: readonly WorkbenchAppManifest[] | ManifestCatalog): value is ManifestCatalog {
  return !Array.isArray(value) && typeof (value as ManifestCatalog).get === "function";
}
