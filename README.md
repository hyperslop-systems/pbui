# `@hyperslop-systems/pbui`

PBUI is a domain-neutral React library for presenting typed objects and
exposing descriptor-defined actions. Applications own their value vocabulary,
environment, verbs, state management, and effects.

```tsx
const registry = createPresentationRegistry<Values, Environment, Verb>({
  person: {
    label: (person) => person.name,
    actions: (person) => [{
      id: "email",
      label: "Send email",
      verb: { type: "emailPerson", personId: person.id },
    }],
  },
});

const pbui = createPbui({ registry, defaultEnvironment });

<pbui.Provider onPerform={performVerb}>
  <pbui.Presentation reference={{ type: "person", value: person }} />
  <pbui.ObjectMenu />
</pbui.Provider>
```

The package intentionally does not depend on Redux, RTK Query, Datadrop model
types, or application routing.

## What a consumer imports

```ts
import "@hyperslop-systems/pbui/styles.css"; // the whole design system
```

One stylesheet, since 0.4.0. It carries the token defaults, the presentation
fallbacks, every component's CSS, and the tile chrome. The granular subpaths —
`./components.css`, `./presentation-parts.css`, `./chrome.css` — still resolve,
for a product that deliberately styles one of those contracts itself; before
0.4.0 all four had to be imported in a documented order, and missing one
produced no error, just a component rendering bare.

```ts
// vite.config.ts — required when pbui is consumed through a `link:` override
import { pbuiVite } from "@hyperslop-systems/pbui/vite";
export default defineConfig({ ...pbuiVite(), plugins: [react()] });
```

Without it, the first pbui component to render throws `Cannot read properties
of null (reading 'useState')` from two React instances. `src/vite.ts` carries
the full mechanism. **Note the name collision:** this `./vite` subpath exports
a Vite *config preset*, while `@hyperslop-systems/datalab-ui`'s `./vite`
subpath exports that package's public asset directory. Same path, unrelated
jobs.

## Datalab UI workspace package

`packages/datalab-ui` contains `@hyperslop-systems/datalab-ui`, the complete
embeddable Datalab frontend. It depends on generic PBUI and owns the product
model, DuckDB analysis runtime, RTK Query API, Redux state, presentation
descriptors and verbs, DATA LAB brand, applications, pages, tours, and
fixtures.

Its root API exports `DatalabApp`, `WorkbenchInstance`, and the pure `routeFor`
classifier. The `./styles.css` subpath provides the complete ordered product
theme, and the Node-only `./vite` subpath exposes the package-owned public asset
directory for executable Vite consumers.

## Validate a clean consumer

`pnpm consumer:smoke` builds the package, packs the publishable files into a
tarball, creates a temporary React application, installs that tarball, and
runs strict TypeScript and Vite builds. The smoke imports the root API, the
`presentation` subpath, and both CSS exports; renders two isolated PBUI
instances; exercises descriptor-neutral molecules and organisms; and verifies
that the consumer resolves one React version.

## Publish to GitHub Packages

The manual **Publish PBUI** workflow targets
`https://npm.pkg.github.com` as `@hyperslop-systems/pbui`. It defaults to an
`npm publish --dry-run`, runs typecheck, tests, package build, Storybook, and
the clean-consumer smoke first, and skips an already-published immutable
version by default.

A real publication tagged `latest` additionally requires the operator to enter
`CONFIRM_LATEST`. Never force-overwrite a version; increment `version` in
`package.json` and regenerate the lockfile instead.

The separate **Publish Datalab UI** workflow applies the same gates to
`@hyperslop-systems/datalab-ui`. It uses `pnpm publish` so the packed manifest
rewrites the workspace PBUI dependency to a normal semver dependency before
uploading to GitHub Packages.

## Go and protocol development

The repository is also the canonical Go module for PBUI workbench validation,
typed mutation application, and protobuf JSON. The standard local gates are:

```bash
make ci-check
make protocol-check
```

`make ci-check` runs formatting, golangci-lint, logcopter drift, glazed command
lint, Go tests, generation, and compilation. The generators and glazed-lint are
pinned with Go's `tool` directive; they do not depend on an ambient `latest`
installation. Lefthook runs the focused Go checks before a commit and the full
Go/protocol checks before a push.

The generated TypeScript protocol package must be built before a clean
Datalab-only typecheck:

```bash
pnpm --filter @hyperslop-systems/workbench-protocol build
pnpm --filter @hyperslop-systems/datalab-ui typecheck
```

The PBUI CI workflow enforces this order after `buf generate`.
