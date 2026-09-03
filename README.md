# `@hyperslop-systems/pbui`

PBUI is a domain-neutral React library for presenting typed objects and
resolving type-directed actions, help, acceptance, and links over them.
Applications own their value vocabulary, environment, verbs, state
management, and effects — and declare their presentation semantics ONCE, as
one compiled presentation (PBUI-KERNEL-1, since 0.11).

```tsx
const p = definePresentation<Values, Environment, Facts, Verb>();

export const presentation = p.create({
  id: "crm",
  types: [{ id: "person" }],
  knownScopes: ["global"],
  defaultActiveScopes: ["global"],
  revision: (facts) => facts.revision,          // a semantic token, never a serialization
  descriptors: { person: { label: (person) => person.name } },
  actions: [
    p.actions.exact("person", {
      id: "crm.person.email",
      action: "person.email",
      scopes: ["global"],
      metadata: { label: "Send email" },
      bind: ({ subject }) => ({ type: "emailPerson", personId: subject.value.id }),
    }),
  ],
});

const pbui = createPbui({
  presentation,
  defaultEnvironment,
  contextFor: (query, environment) => ({ facts: environment.facts }),
});

<pbui.Provider onPerform={performVerb} onRefuse={showRefusal}>
  <pbui.Presentation reference={{ type: "person", value: person }} />
  <pbui.ObjectMenu />
</pbui.Provider>
```

Types, known scopes, predicates, descriptors, action rules, relations, and
help rules are one declaration; shared packages contribute named
**fragments** (`createWorkbenchPresentationFragment`,
`createChatPresentationFragment`) the product `include`s, so it cannot take a
package's rules and forget its types. Construction validates the whole
declaration: an undeclared type, a descriptor for a type with no node, a
duplicate id across fragments, or a relation with no exposure is a
construction error, not a runtime surprise. The type world is closed — a
reference whose type is not declared is an error. `onRefuse` is required: a
menu row that fails fresh revalidation is always reported to the product.

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
export const presentation = p.create({
  ...,
  help: [
    p.help.exact("field", {
      id: "product.field.help",
      scopes: ["editor"],
      help: ({ subject, snapshot }) => [
        markdownHelp.create({ id: "field.meaning", order: 0,
          payload: { markdown: "A **field** is one column." } }),
        actionsHelp.create({ id: "field.actions", order: 10,
          // the REAL action resolution, displayed — never re-derived
          payload: { actions: presentation.actions.resolve({ subject, invocation: "menu" }, snapshot).actions } }),
      ],
    }),
  ],
});

const pbui = createPbui({
  presentation, defaultEnvironment, contextFor,
  helpRenderers: createHelpRendererRegistry([...builtinHelpItems, myCustomItem]),
});

<pbui.Provider onPerform={performVerb} onRefuse={showRefusal}>
  <App />
  <pbui.ObjectMenu />
  <pbui.ContextHelp />   {/* mount once, beside the menu */}
</pbui.Provider>
```

Authoring rules, briefly:

- Help rules are declared in the same compiled presentation as the action
  rules and reuse its type graph, scopes, conditions, named predicates, and
  immutable snapshot facts. They never compete: EVERY matching rule
  contributes items; type distance, scope nearness, and priority order the
  display only. Help is ON when `createPbui` receives `helpRenderers`.
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

## Link kernel: terms, programs, planners (PBUI-LINK-1, PBUI-KERNEL-2)

`@hyperslop-systems/pbui/presentation` also exports the pure link kernel the
workbench runs on: ports and contracts (`definePort`), the persisted binding
grammar (`terms.ambient/constant/follow/alias/derived/hold/unresolved`), the
evaluator (`evaluatePort`), the planners (`planFollow`, `planBind`,
`planDerive`, …) and the transition (`applyLinkVerb`). Nothing in it imports
React or a store.

Since PBUI-KERNEL-2 the persisted grammar is the wire format only. Internally
every term compiles to a binding program (source, relation application, held
state, broken state) that evaluation, dependency extraction and the static
checker all read. What the package exposes of that:

- `normalizeBinding(b)` — `bindingOf(programOf(b))`; idempotent, and the
  identity on every shape a planner writes.
- `dependenciesOfBinding(b, { includeSuspended })` — the ports, relations and
  link ids a term reads, as three sets; suspended wires count unless you say
  otherwise. `dependsOn(port, target, snapshot)` is the one transitive walk.
- `checkBinding(candidate, snapshot, deps, destination)` — structural
  admissibility: sources, contexts, cells and relations exist; relation
  domains and the destination type reach; no cycle. A relation that returns
  `empty` in the current world is still valid: partiality is a runtime fact.
- `candidateTermOf(verb)` — the exact term a `port.follow/bind/derive/ambient`
  verb persists. Planners check it; `applyLinkVerb` stores it.

A planner keeps only operation policy (existence, direction, self, document
slots, held, shared, already linked, which relations are legal) and takes the
rest of its verdict from the checker, so a refusal such as `Orders East ·
order already reads from Detail B · order; that would be a cycle` has one
source. The program's constructors (`programOf`, `bindingOf`, the
`BindingProgram` types) are internal to `src/presentation/links/`.

### Identity and port compatibility (PBUI-KERNEL-3)

Identity declarations are undirected edges between ports; the kernel exposes
them as a quotient of ports into logical cells. `quotientOf(snapshot)` returns
the cells a snapshot carries and `cellByPort`; `cellOf(port, snapshot)` names
a member's cell. `Alias(classId)` stays the wire representation and the
effective binding of a member. The partition is a function of the set of
admitted edges only: flipping, duplicating or reordering edges (or the port
map) changes nothing, and an untouched cell keeps its id across recompiles.

A port contract is a value contract (`valueType`, `semanticRole`,
`cardinality`) times a protocol (`mode`, `authorityDomain`, `updateAlgebra`,
`lifetime`), and the operations ask different questions of it:

| Question | Predicate | Consults |
|---|---|---|
| may a value flow into this port | `canFlow(from, into, graph)` | value reachability |
| may this reference be written here | `canAccept(reference, into, graph)` | value reachability |
| may two ports be one cell | `canShareCell(left, right)` | every field, value and protocol reported apart |
| do two endpoints combine writes alike | `canMergeUpdates(left, right)` | the update algebra |

Callers name the question: the checker and `legalRelations` ask `canFlow`,
`resolveShow` and the workbench "Link to…" family ask `canAccept`, identity
asks `canShareCell`. A subtype flows but cannot share a cell; a different
authority cannot share but flows; do not answer one question with the other's
test.

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
