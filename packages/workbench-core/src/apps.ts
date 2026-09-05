import { definePorts, documentSlotsOf, type PortDeclaration, type PortDeclarationInput } from "@hyperslop-systems/pbui/link-kernel";

/**
 * The semantic half of an application (guide §8.1, §16.8): what the engine
 * needs to plan with, and nothing a renderer needs. The React half — title,
 * tone, component, launcher prose — is a separate projection that the shell
 * joins by `id`.
 */
export type ViewCardinality = "one" | "many";
export type DuplicatePlacement = "clone" | "link";

/**
 * One named document binding (design doc 04 §9.2): whether a view must
 * carry it, which document formats may fill it, and whether it is what the
 * application is a view OF (`primary`) or context it reads when present.
 * The same facts `pkg/workbench` validates as `BindingRule`.
 */
export interface WorkbenchBindingRule {
  readonly required: boolean;
  /** Document formats that may fill the binding; absent ⇒ any. */
  readonly formats?: readonly string[];
  /** Default `"primary"`. */
  readonly role: "primary" | "context";
}

/**
 * Bindings beyond the declared ones, for an application whose bindings are
 * named by what it binds (the sandbox's `script`: each program names its
 * own inputs). A typed policy, not a boolean: it says which formats those
 * extra documents may have. Go: `AdditionalBindings *BindingRule`.
 */
export interface WorkbenchAdditionalBindings {
  readonly formats?: readonly string[];
}

/**
 * Whether the launcher may create a view with no bindings: `"unbound"` (it
 * may; optional context is filled later or never), `"requires-bindings"`
 * (the application is a view OF something and must be opened from it),
 * `"hidden"` (never offered). Product/application policy, not a validation
 * rule — Go does not see it.
 */
export type LaunchPolicy = "unbound" | "requires-bindings" | "hidden";

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
  /** The legal `view.documents` keys and their rules. A `documentSlot` port implies one; a binding need not have a port. */
  readonly bindings: Readonly<Record<string, WorkbenchBindingRule>>;
  readonly additionalBindings?: WorkbenchAdditionalBindings;
  readonly launch: LaunchPolicy;
  /** Typed ports (PBUI-LINK-1). A `documentSlot` port is a key of `view.documents`. */
  readonly ports?: readonly PortDeclaration[];
}

export interface WorkbenchAppManifestInput {
  id: string;
  /** Default `"many"`. */
  viewCardinality?: ViewCardinality;
  /** Default: `"link"` for a `"one"` application, `"clone"` otherwise. */
  duplicatePlacement?: DuplicatePlacement;
  ports?: readonly PortDeclarationInput[];
  /** Rules for bindings; a `documentSlot` port declares a binding `{ required: false, role: "primary" }` unless a rule here says otherwise. */
  bindings?: Readonly<Record<string, Partial<WorkbenchBindingRule>>>;
  additionalBindings?: WorkbenchAdditionalBindings;
  /** Default: `"requires-bindings"` when any binding is primary, else `"unbound"`. */
  launch?: LaunchPolicy;
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
  const bindings: Record<string, WorkbenchBindingRule> = {};
  for (const slot of documentSlotsOf(ports)) bindings[slot] = { required: false, role: "primary" };
  for (const [name, rule] of Object.entries(input.bindings ?? {})) {
    if (!name || name.trim() !== name) throw new Error(`workbench-core: application "${input.id}" declares binding ${JSON.stringify(name)}; a binding name must be a non-empty, trimmed string`);
    bindings[name] = { required: rule.required ?? bindings[name]?.required ?? false, role: rule.role ?? bindings[name]?.role ?? "primary", ...(rule.formats ? { formats: [...rule.formats] } : bindings[name]?.formats ? { formats: bindings[name]!.formats } : {}) };
  }
  const primary = Object.values(bindings).some((rule) => rule.role === "primary");
  const launch = input.launch ?? (primary ? "requires-bindings" : "unbound");
  return {
    id: input.id,
    viewCardinality,
    duplicatePlacement,
    bindings: Object.freeze(bindings),
    ...(input.additionalBindings ? { additionalBindings: { ...(input.additionalBindings.formats ? { formats: [...input.additionalBindings.formats] } : {}) } } : {}),
    launch,
    ...(ports ? { ports } : {}),
  };
}

/** Is the application a view OF a document — does it declare a primary binding? */
export function isDocBound(app: WorkbenchAppManifest): boolean {
  return Object.values(app.bindings).some((rule) => rule.role === "primary");
}

/** The legal keys of `view.documents` for the application, in declaration order (ports first). */
export function bindingNames(app: WorkbenchAppManifest): string[] {
  return Object.keys(app.bindings);
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
