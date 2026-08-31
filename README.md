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

## Contextual help (PBUI-HELP-001)

Since 0.9, a product can register typed contextual help beside its action
kernel. Hovering a `Presentation` (350&nbsp;ms rest) or focusing it with the
keyboard shows one non-interactive card; both triggers resolve identical
content. **Migration-free:** with no `help`/`helpRenderers` configured,
nothing changes — no state, no timers, no DOM difference.

```tsx
const define = defineHelp<Values, ProductFacts>();

const help = createHelpRegistry({
  graph: actions.graph,              // the SAME type graph as the actions
  scopes: ["editor", "global"],
  contributions: [
    define.exact("field", {
      id: "product.field.help",
      scopes: ["editor"],
      help: ({ subject, snapshot }) => [
        markdownHelp.create({ id: "field.meaning", order: 0,
          payload: { markdown: "A **field** is one column." } }),
        actionsHelp.create({ id: "field.actions", order: 10,
          payload: { actions: actions.resolve({ subject, invocation: "menu" }, snapshot).actions } }),
      ],
    }),
  ],
});

const pbui = createPbui({
  registry, actions, snapshotFor, defaultEnvironment,
  help,
  helpRenderers: createHelpRendererRegistry([...builtinHelpItems, myCustomItem]),
});

<pbui.Provider onPerform={performVerb}>
  <App />
  <pbui.ObjectMenu />
  <pbui.ContextHelp />   {/* mount once, beside the menu */}
</pbui.Provider>
```

Authoring rules, briefly:

- Help rules reuse the action kernel's type graph, scopes, conditions, named
  predicates, and immutable `snapshotFor` facts. They never compete: EVERY
  matching rule contributes items; type distance, scope nearness, and
  priority order the display only.
- Rule ids, item ids, and renderer kinds are stable identities. Duplicate
  item ids in one resolution throw — an authoring defect, not a render state.
- Only `available` matches: a rule whose `when`/`test` is unavailable,
  inapplicable, or hidden contributes nothing. To EXPLAIN an unavailable
  action, emit an `actionsHelp` item — its rows come from the real action
  resolution, reasons included; never re-derive applicability in a help rule.
- Built-ins: `textHelp`, `markdownHelp` (bounded subset: paragraphs, breaks,
  `**strong**`, inline code, fences, lists, headings — no HTML, no links, no
  mentions), `fieldsHelp` (put user-controlled values here, not in Markdown),
  `noticeHelp`, `actionsHelp` (informational in v1). Domain visuals get a
  typed custom renderer via `defineHelpItem` + `createHelpRendererRegistry`.
- The surface is `role="tooltip"`, references the subject with
  `aria-describedby` while open, never steals focus, and closes on
  leave/blur/Escape; opening the object menu closes it. Style it through the
  `context-help` / `help-*` parts in `presentation-parts.css`.

`packages/datalab-ui/src/pbui/help.tsx` is the reference product
integration; the `WithContextualHelp` story shows the core wiring.

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

The package-specific **Publish Workbench Protocol**, **Publish PBUI
Workbench**, **Publish PBUI Sandbox**, and **Publish PBUI Chat** workflows use
the same immutable-version and `latest` confirmation gates. Publish a
coordinated package set in dependency order:

1. `@hyperslop-systems/pbui`
2. `@hyperslop-systems/workbench-protocol`
3. `@hyperslop-systems/pbui-workbench`
4. `@hyperslop-systems/pbui-sandbox`
5. `@hyperslop-systems/pbui-chat`

Run every workflow as a dry run first. Use a prerelease dist-tag such as
`next` while the package set is under integration review; promote with a new
immutable version rather than overwriting an artifact.

The separate **Publish Datalab UI** workflow applies the same gates to
`@hyperslop-systems/datalab-ui`. It uses `pnpm publish` so the packed manifest
rewrites the workspace PBUI dependency to a normal semver dependency before
uploading to GitHub Packages.

## PBUI chat agent (`pbui-chat`)

`cmd/pbui-chat` is a chat agent whose every structured output is a PBUI
presentation object: mentions in prose become live objects with verbs, widgets
are declarative documents of PBUI components, user actions are serialisable
verbs recorded in a trace. `pkg/pbuichat` is the pinocchio `chatapp.ChatPlugin`
and tool set; `pkg/chatserver` wires it behind `net/http`; `packages/pbui-chat`
is the React package (`@hyperslop-systems/pbui-chat`) with a demo product under
`packages/pbui-chat/demo` that the binary embeds.

```bash
pnpm install --filter '!@hyperslop-systems/datalab-ui'   # datalab-ui needs a GitHub Packages token
make chat-ui          # build pbui + the demo SPA into pkg/chatui/embed
make chat-serve       # scripted demo engine on http://127.0.0.1:8090
make chat-build       # single binary with the UI embedded: bin/pbui-chat
devctl up             # dev profile: go run + vite on :5174; `devctl up --profile prod` builds and runs bin/pbui-chat
GOWORK=off go run ./cmd/pbui-chat serve --real-runtime --profile <pinocchio-profile>
```

The design and diary live in
`ttmp/2026/08/20/PBUI-AGENT-1--pbui-native-chat-agent-with-custom-pbui-widgets/`.

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
