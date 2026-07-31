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
