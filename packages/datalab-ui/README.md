# `@hyperslop-systems/datalab-ui`

The complete Datalab React frontend: marketing page, interactive tour, device
approval, workbench, product applications, Redux state, Datadrop API transport,
DuckDB analysis runtime, fixtures, and product presentation descriptors.

The package imports no browser entry point and performs no mounting work:

```tsx
import { createRoot } from "react-dom/client";
import { DatalabApp } from "@hyperslop-systems/datalab-ui";
import "@hyperslop-systems/datalab-ui/styles.css";

createRoot(document.getElementById("root")!).render(<DatalabApp />);
```

For Vite shells, the package exports its reviewed DuckDB extension and icon
directory separately:

```ts
import { datalabPublicDir } from "@hyperslop-systems/datalab-ui/vite";

export default defineConfig({
  publicDir: datalabPublicDir,
});
```

`@hyperslop-systems/pbui` remains the domain-neutral presentation and component
package. Datalab UI owns product models, descriptors, verbs, stores, API
transport, routes, applications, pages, fixtures, and brand.

## Integration playbooks

- [Adding editing support to a PBUI application](../../docs/playbooks/adding-editing-support-to-a-pbui-application.md)
  explains document ownership, Redux edits, application registration, remote
  persistence, backend validation, agent mutations, and two-browser conflict
  testing.

## Workbench ownership

Since PBUI-DATALAB-WORKBENCH-1 the spatial model — workspaces, logical views,
placements and split trees — is `@hyperslop-systems/workbench-core`'s
`WorkbenchDocument`, rendered by `@hyperslop-systems/pbui-workbench`'s Surface.
Datalab keeps what is genuinely Datalab's above and beside it:

| Fact | Owner |
|---|---|
| workspace, view, placement, tree, active placement | workbench core (`src/store/runtime.ts`) |
| stages, workspace → stage, pinned, allow-lists, remembered workspace | the `navigation` slice (`src/store/navigation.ts`) |
| product policy in front of core commands (pinned, last-in-stage, close-view) | `src/store/controller.ts` |
| full `GraphicDocument`s, snapshots, pins, watch, trace | the `world` slice; the workbench holds identity stubs (`src/store/graphicSource.ts`) |
| the rich launcher, stage bar, stage-scoped strip, portable bundles | Datalab components and `src/store/bundles.ts` |
| what the server sees: the work stage with full documents | `src/remote/projection.ts` |

One `createDatalabWorkbench()` per workbench instance (`src/appkit/workbench.ts`);
components reach it through `DatalabWorkbenchProvider`. Local persistence is
version 6 (`src/store/persist.ts`): the workbench document as protobuf JSON
beside the world and the navigation metadata; version-5 payloads migrate.
