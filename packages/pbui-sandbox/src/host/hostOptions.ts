import type { ReactNode } from "react";
import type { UIReference, VerbLike } from "../contracts";
import type { ProgramEngine } from "../engine";
import type { InstanceRegistry } from "../instances";
import type { ProgramLibrary } from "../library";
import type { ProgramStateStore } from "../state";

/**
 * Everything a tile needs from the product to host programs — the script
 * tile and every devtool take this one object (guide §4.2). A product builds
 * it once; the demo's is in `demo/src/workbench.ts`.
 */
export interface SandboxHost {
  library: ProgramLibrary;
  engine: ProgramEngine;
  /** Program state, keyed by view id. */
  states: ProgramStateStore;
  /** Running instances, the timeline and the selected sandbox. */
  instances: InstanceRegistry;
  /** Resolve one of a view's bindings (`product: "2049"`) into a reference; null when it cannot. */
  resolve(key: string, id: string): UIReference | null;
  /** A hook: the product's descriptor environment, read live so `canApprove` flips re-render programs. */
  useEnv(): Record<string, unknown>;
  /** Perform a verb a program emitted; the product routes it with `actor: "human"` and the provenance. */
  perform(verb: VerbLike, options: { provenance: { programId: string } }): Promise<string>;
  /** The product's `<Presentation>` for a `ref` node. */
  renderReference(reference: UIReference, label: string): ReactNode;
  /** Hand something to the agent (a failing program, a draft). Omit for no such buttons. */
  askAgent?(template: string, refs: UIReference[]): void;
  /** Choices for a binding key in the playground's picker; omit (or return []) for a free-text id. */
  bindingChoices?(key: string): { id: string; label: string }[];
  /**
   * Are the devtools registered? Set by `createSandboxDevtools`; the script
   * tile shows its inspect/source buttons only when they would open something.
   */
  devtools?: boolean;
}
