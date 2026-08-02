/**
 * @hyperslop-systems/workbench-protocol/client — the pure TypeScript
 * workbench-document mutation layer: a local applier mirroring the Go one
 * (pkg/workbench), the verb builders, and the snap-ratio contract.
 *
 * React-free and store-free by design (DR-U5): products wire these into
 * whatever state layer they run.
 */
export * from "./apply.js";
export * from "./builders.js";
export * from "./ratios.js";
