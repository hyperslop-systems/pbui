export { DatalabApp } from "./DatalabApp";
export type { DatalabAppProps } from "./DatalabApp";
export { WorkbenchInstance } from "./components/pages/WorkbenchInstance";
export type { InstanceConfig } from "./components/pages/WorkbenchInstance";
export { routeFor } from "./routes";
export type { Route } from "./routes";
// The escape hatch for shells whose build moves the wasm somewhere the
// zero-config derivation cannot follow (custom assetsDir, exotic dev
// topologies) — see its comment for when and what to pass.
export { setDuckDBExtensionRepository } from "./analysis/browser";
