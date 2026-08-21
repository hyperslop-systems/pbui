---
Title: Diary
Ticket: PBUI-AGENT-3
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources:
    - https://github.com/go-go-golems/vm-system/
Summary: 'Investigation and writing diary for PBUI-AGENT-3: how the evidence was gathered across pbui, vm-system, react-chat and pinocchio, what was found about the as-built state of PBUI-AGENT-2, the scope changes the user added mid-flight, and how the intern guide was written, validated and delivered.'
LastUpdated: 2026-08-21T11:40:00-04:00
WhatFor: Let a second engineer resume this ticket without re-deriving which files were read and why, and give a reviewer the failure record that the finished guide hides.
WhenToUse: Read before continuing PBUI-AGENT-3 or before reviewing the guide; each step names where to start and how to validate.
---

# Diary

## Goal

Record how the PBUI-AGENT-3 research and design were done: which repositories and files were read, what was learned about the as-built agent and about vm-system's reactive sandbox, which scope changes arrived mid-flight, and how the intern guide was written, checked and uploaded.

## Step 1: Open the ticket, gather the evidence, settle the scope

This step is the investigation: before writing a line of design, read the two predecessor tickets, the code they produced, and the vm-system plugin runtime the user pointed at, and establish exactly what exists today. The single most important finding is that **PBUI-AGENT-2 is no longer a plan — it is built.** The pbui repo's `task/add-pbui-agent` branch carries B0–B3 (commits `13734a1`, `1c65426`, `531df03`, `668759d`, `dfbab54`) plus two review rounds (`84f175e`, `1be63cf`, `af8262e`): `describeWorkbench`/`specOf`, six browser-side workbench tools with a central policy door, the `tile`/`workspace`/`app` presentation types, twenty workbench verb kinds in the demo vocabulary, a `## The workspace` prompt section, and four demo tile types. The new ticket therefore designs on top of a working agent that can already read and rearrange the screen, not on top of the AGENT-2 guide's hypothetical.

The second finding is what the "vm-system reactive sandbox pattern" concretely is. It is not the Go daemon (goja sessions behind a REST API) — it is the **frontend plugin runtime** at `vm-system/frontend/packages/plugin-runtime`: a plugin calls `definePlugin(({ ui }) => ({ id, title, initialState, widgets: { main: { render, handlers } } }))`; `render` is a pure function from `(pluginState, globalState)` to a JSON `UINode` tree built with `ui.*` helpers; `handlers` never mutate anything, they emit `DispatchIntent`s (`{scope:"plugin"|"shared", actionType, payload}`) that the host reduces; the host then re-renders. All of it runs inside a QuickJS context in a Web Worker with memory, stack and time limits, and every state change is recorded in a bounded dispatch timeline with an outcome (`applied`/`denied`/`ignored`). That loop — pure render, intents as the only egress, host-owned state, JSON across the boundary — is the pattern this ticket borrows, and its engine (QuickJS vs. `eval`) is a pluggable detail, which the user confirmed mid-step ("if that makes it easier you can also just use eval()").

### Prompt Context

**User prompt (verbatim):** "https://github.com/go-go-golems/vm-system/

Create a new docmgr ticket, I want to 
Add  generative code generation to the pbui-agent (see previous diaries and design docs) so it can create tiles running JS apps with a UI DSL that is using the vm-system reactive sandbox pattern.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

Then ccommit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)"

**Mid-turn additions (verbatim):**
- "also allow creating new actions for certain types, and store them in local storage or so to be reused and laoded later on"
- "~/code/wesen/go-go-golems/vm-system here is the loca version"
- "if that makes it easier you can also just use eval()"

**Assistant interpretation:** Open `PBUI-AGENT-3` in `pbui/ttmp`, research the as-built PBUI chat agent (AGENT-1, AGENT-2, WORKBENCH-1/2) and vm-system's frontend plugin runtime, and write one long intern-level guide that (a) explains every subsystem a newcomer needs, (b) designs how the agent writes JavaScript programs in the `definePlugin` dialect that run in a sandbox and render as workbench tiles, (c) designs agent-defined *actions* on presentation types, persisted in `localStorage` and reloaded on boot, and (d) gives a phased, file-level implementation plan with pseudocode, sequences, API and file references. Keep a diary, commit at boundaries, upload the guide to reMarkable.

**Inferred user intent:** Close the loop the previous two tickets opened. AGENT-1 made the agent speak objects; AGENT-2 let it rearrange the screen; AGENT-3 lets it *make new things for the screen* — small interactive applications and new verbs — without a frontend deploy, safely enough to leave running, and durable enough to come back to tomorrow. The eval() remark says the user wants a working v1 over a perfectly isolated one.

### What I did

- Loaded the `ticket-research-docmgr-remarkable` and `diary` skills and their writing-style and checklist references.
- Mapped the workspace: `go.work` over eleven repos; docmgr root is `pbui/ttmp` (`/home/manuel/workspaces/2026-08-20/add-pbui-agent/.ttmp.yaml` and `pbui/.ttmp.yaml` agree); `pbui` is on `task/add-pbui-agent` with a clean tree.
- Read the predecessor tickets end to end: `PBUI-AGENT-1` design-doc/02 (775 lines: the object/verb/widget contract), `PBUI-AGENT-2` design-doc/01 (1303 lines: the workbench tool surface) and its diary (704 lines: B0–B3, two review rounds), `PBUI-WORKBENCH-2` index and tasks (Phases 1–2 done, 3–7 open).
- Read the as-built code the design must sit on:
  - `pbui/packages/pbui-workbench/src/{apps,types,createWorkbench,store,document,describe,tileDescriptor,index}.ts` — `AppDescriptor` (with `bindings`), `AppRegistry` (fixed list, throws on duplicate, `get`/`list` only), `Workbench`, `WorkbenchStore` (`mutate` with `onMutate`/`onRejected`/`onPostCommitError`), `LayoutSpec`, `specOf`, `describeWorkbench`.
  - `pbui/packages/pbui-chat/src/{createPbuiChat.tsx,types.ts,index.ts}`, `router/createVerbRouter.ts`, `tools/{acceptTool,proposeTool,workbenchTools}.ts(x)`, `vocabulary/{schemas,defineVocabulary}.ts`, `widget/{definitions,PbuiWidget}.tsx`, `apps/{createChatApps,WidgetApp}.tsx`.
  - `pbui/packages/pbui-chat/demo/src/{workbench,chat,App,world}.ts(x)`, `pbui/{registry,runtime,types,verbs,vocabulary}.ts`, `descriptors/{tile,widget,product}.ts`, `apps/{createDemoApps,NotesApp,SkuApp}.ts(x)`.
  - `pbui/src/presentation/{types,registry}.ts` and the exports of `createPbui.tsx` — the `PresentationDescriptor.actions()` contract and `createPresentationRegistry`'s closed descriptor map.
  - `pbui/pkg/pbuichat/{tools,prompt,widgetdoc,vocabulary,plugin}.go`, `pbui/pkg/chatserver/{real_runtime,options}.go`, `server.go` routes, `demo/tools.go`, `scripted/engine.go` (`humanTool`), `pkg/chatserver/demo/vocabulary.json` (15 types, 30 verbs).
  - `pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto` (`DocumentPayload{id, format, schema_version, body: Struct}`).
  - `react-chat/packages/chat-provider/src/tools/{toolRegistry,toolRuntime}.ts`, `widgets/widgetRegistry.ts` — `FrontendTool`/`HumanTool`, `available()`, `parseToolInput`, `z.toJSONSchema`.
- Read vm-system, local checkout at `/home/manuel/code/wesen/go-go-golems/vm-system` (HEAD `37bd440`):
  - `frontend/docs/README.md`, `architecture/{ui-dsl,dispatch-lifecycle,capability-model}.md`, `plugin-authoring/{quickstart,examples}.md`, `runtime/embedding.md`, `migration/changelog-vm-api.md`.
  - `frontend/packages/plugin-runtime/src/{runtimeService,contracts,hostAdapter,uiSchema,uiTypes,dispatchIntent}.ts`, `worker/{sandboxClient,runtime.worker}.ts`, `redux-adapter/store.ts` (all 624 lines), `runtimeService.integration.test.ts`.
  - `frontend/client/src/components/WidgetRenderer.tsx`, `pages/WorkbenchPage.tsx` (the host loop, lines 131–273), `lib/presetPlugins.ts`, `store/workbenchSlice.ts`, `vite.config.ts` (`worker.format: "es"`, `@runtime` alias), `package.json` (`quickjs-emscripten 0.23.0`), `tests/e2e/quickjs-runtime.spec.ts`.
  - The Go side only for orientation: `README.md`, `pkg/doc/vm-system-architecture.md`, `go.mod` (`dop251/goja`, `go-go-goja v0.8.3`), `pkg/vmexec/executor.go` head — relevant to an optional server-side dry-run, not to the browser pattern.
  - Ticket history headings: `WEBVM-001` design-docs 02/03 (why QuickJS in a worker, bridge API, limits).
- Inventoried pbui's component kit (`src/components/{atoms,molecules,organisms}`) to know what a UINode renderer can map to: `Button, Chip, CodeLine, Meter, SelectInput, Sparkline, TextArea, TextInput, Callout, EmptyState, ResultLog, SegmentedBar, DiffHunk`.
- Created the ticket and its two documents:

```bash
docmgr ticket create-ticket --ticket PBUI-AGENT-3 \
  --title "Generative tiles: agent-written JS apps and actions in a reactive sandbox" \
  --topics pbui,chat,frontend,backend,onboarding
docmgr doc add --ticket PBUI-AGENT-3 --doc-type design-doc \
  --title "Intern guide: generative tiles — agent-written JS apps and actions in a reactive sandbox"
docmgr doc add --ticket PBUI-AGENT-3 --doc-type reference --title "Diary"
```

### Why

- The AGENT-2 guide was written before WORKBENCH-2 Phase 1 existed and assumed product-named verbs (`switchWorkspace`); the build then deviated (tools emit `WorkbenchVerb`s unchanged, one policy door, `isApproved(id, verb)`). Designing AGENT-3 from the guide rather than the code would repeat every one of those deviations. Reading the diary's "what was tricky" sections was the cheapest way to inherit the lessons — the worked-example rule for tool descriptions, the `available()` closure for construction order, the `syncManifest()` on attach, the `dist`-not-source trap, the `localStorage` whole-document-write hazard.
- The user's phrase "vm-system reactive sandbox pattern" is ambiguous between the Go daemon and the browser plugin runtime; the frontend docs' own words ("a miniature operating system for UI widgets … each plugin gets its own process (a sandboxed JS context), its own memory (local state), and a controlled set of system calls (dispatch intents)") settled it, and the `definePlugin` dialect with its documented examples is exactly the kind of thing a model can be taught in a prompt.
- The mid-turn "actions" request changes the shape of the design materially: a program that renders in a tile is one artifact; a new verb on an existing type is a second, and PBUI's core rule — *a verb is serialisable data, never a closure* (`src/presentation/types.ts`, AGENT-1 §3) — means generated actions must be data that point at programs or existing verbs, not JavaScript installed into descriptors. That decision is only possible once the registry's closed shape (`createPresentationRegistry(descriptors)`, `registry.ts:51-67`) is in view.
- The "eval() is fine" remark resolves what would otherwise be the guide's hardest open question (ship `quickjs-emscripten` in a worker on day one, or not) in favour of a two-engine design behind one interface — vm-system already has that interface (`RuntimeHostAdapter`, `hostAdapter.ts`).

### What worked

- `docmgr` found the right root from the workspace directory (`root=…/pbui/ttmp`), so the ticket landed beside AGENT-1/2 under `pbui/ttmp/2026/08/21/`.
- vm-system's frontend docs are unusually good for this purpose: `ui-dsl.md` is already a model-facing reference, `examples.md` has five complete programs, and `embedding.md` documents the exact host loop (load → register → render → event → reduce → re-render) with a "using without Redux" variant that is the one pbui needs.
- The as-built pbui code already has every seam the design needs: `AppDescriptor.bindings` for a doc-bound `script` tile, `view.documents` to carry a program id, `FrontendTool.available()` for late-bound tools, `createVerbRouter` for tracing clicks inside generated UIs, `defineVocabulary`/`verbSpecsFromSchema` so two generic verb kinds regenerate the Go prompt, and `ProposalCard` for a `confirm` policy.

### What didn't work

- The first batch of reads failed because the shell's cwd resets between tool calls:

  ```
  (eval):1: no matches found: ttmp/2026/08/20/PBUI-AGENT-1*
  ```

  and later `(eval):cd:1: no such file or directory: pbui` — which also swallowed the first `docmgr doc add` pair. Re-ran with absolute paths; the second `doc add` pair created the two documents. Rule for the rest of the ticket: absolute paths, never a leading `cd`.
- `rg -il "reactive"` across vm-system returned nothing: the phrase "reactive sandbox" is the user's, not the repo's. The repo calls it the "Plugin Playground" / "plugin-runtime"; `rg -il "sandbox"` found it at once. Worth knowing for anyone searching later.
- Several reads exceeded the tool's output cap and were persisted to files (`bt3tv5mul.txt`, `bk26aopcj.txt`, `byoi7obhq.txt`, `b4l5zkhy1.txt`, `b5tr1le1w.txt`, `bhqsljj34.txt` under the session's `tool-results/`); I paged through them rather than re-running narrower greps, which cost context but guaranteed I saw the whole of `workbenchTools.ts` and `createPbuiChat.tsx` rather than the parts I expected to matter.

### What I learned

- **`createAppRegistry` is immutable and throws on a duplicate id** (`apps.ts:106-116`). A per-program `AppDescriptor` would need a mutable registry; one host app (`script`, doc-bound to `program`) needs nothing new in `pbui-workbench`.
- **`defaultLauncherRows` skips `docBound` apps** (`launcherRows.ts:104`), so programs will not appear in ⌘K unless the product supplies `rows` — the same surprise AGENT-2's diary records for `sku`/`notes`.
- **The vocabulary is closed on both sides.** `validateVerb` (Go `vocabulary.go:183`, TS `validate.ts`) rejects an unknown `kind`, and `createVerbRouter.perform` records it as `rejected:unknown verb …` before any handler runs. A generated action therefore cannot mint a verb kind; it must be a payload of a declared one.
- **The generic reducer is all pbui needs.** vm-system's `reduceGenericPlugin` (`store.ts:262-297`) implements `state/replace` and `state/merge`; the per-package reducers (`counter`, `calculator`, `greeter`) exist only for its presets. Programs the agent writes will use the generic pair, exactly as `examples.md` teaches.
- **The UINode vocabulary is small and typed** (`uiTypes.ts`: `panel|row|column`, `text|badge`, `button`, `input`, `counter`, `table`) and the validator (`uiSchema.ts`) is a 99-line structural check. A PBUI renderer is a switch over nine kinds plus whatever pbui-specific kinds are added (`ref`, `meter`, `callout`).
- **QuickJS limits in vm-system are 32 MB, 1 MB stack, 1000 ms load, 100 ms render/event**, enforced by `runtime.setInterruptHandler(() => Date.now() > vm.deadlineMs)` (`runtimeService.ts:145-151, 284`). None of that is available to an `eval` engine — an infinite loop under `eval` freezes the tab — which is the whole price of the user's shortcut and must be stated plainly in the guide.
- **Go's `Limits.WidgetBytes` is 256 KiB and `DefaultLimits` lives in `widgetdoc.go`**; the sandbox's source-size limit should sit beside it in spirit (a frontend limit, since the source never crosses the Go side in v1).

### What was tricky to build

- **Deciding what a "generated action" is.** The naive reading — the agent writes a JavaScript function and it is installed into `productDescriptor.actions` — breaks PBUI's foundational rule and would put closures into the trace, the vocabulary and the widget chips. The resolution came from reading `tileDescriptor.ts` and `registry.ts` together: `actions()` returns *data*, and the registry is an interface (`PresentationRegistry`) that can be wrapped. So an action is a stored record `{id, label, types, behaviour}` whose `behaviour` is one of three serialisable things (open a program bound to the target, perform an existing verb with the target substituted, ask the agent with a template), surfaced by a registry wrapper that appends `{kind:"action.run", actionId, ref}` to every matching type's menu. JavaScript, when needed, lives in the program the action opens — which is what the tile machinery already runs.
- **Where programs persist.** Two honest candidates: `WorkbenchDocument.documents` (a `DocumentPayload{format:"pbui.program"}`, already serialised with the layout, already written through `documentPut`, already demonstrated by `NotesApp`) versus a separate `localStorage` library. The document option loses on one fact found in `demo/src/workbench.ts:75-79`: `resetLayout()` replaces the whole document, so "reset layout" would delete every program the user kept. Programs and actions must outlive any one layout; they get their own store, and tiles bind to them by id through `view.documents.program` — the same binding mechanism `sku` uses for a product.
- **Keeping the engine swappable without designing two systems.** vm-system's `RuntimeHostAdapter` (`hostAdapter.ts:28-35`) is already the engine-agnostic surface; the eval engine and the QuickJS worker engine both implement it, and the `BOOTSTRAP_SOURCE` (the `definePlugin`/`__pluginHost` shim) is the same string evaluated by either. The guide adopts that shape verbatim so that Phase 5 (QuickJS) is a new file, not a rewrite.

### What warrants a second pair of eyes

- The claim that AGENT-2's Tier 4 (`isApproved` wiring, scripted scenario, undo widget) is *not* a prerequisite for this ticket. It is not for creating programs (policy `allow`), but it is for any `confirm`-policy sandbox tool (`sandbox_remove` of a pinned program). The guide says so; a reviewer should agree before Phase 3 starts.
- Whether `eval` in the *demo* is acceptable at all given that the demo runs `--real-runtime` against real model output. The guide recommends eval for development and the QuickJS engine before any product with real data, and records the prompt-injection risk explicitly.

### What should be done in the future

- N/A for this step beyond what the guide's phases schedule.

### Code review instructions

- Nothing to review in code yet. To check the evidence base, start with the files listed under *What I did*; the line anchors quoted above are from the current `task/add-pbui-agent` HEAD (`1c91964`) and vm-system `37bd440`.

### Technical details

The pattern, in the fewest lines that are still true, straight from `vm-system/frontend/packages/plugin-runtime/src/runtimeService.ts:13-127`:

```js
// evaluated once per plugin VM, before the plugin source
const __ui = { text(c){…}, button(label, props){…}, input(v, props){…}, row(ch){…}, column(ch){…}, panel(ch){…}, badge(t){…}, table(rows, props){…} };
let __plugin = null, __dispatchIntents = [];
function definePlugin(factory) { __plugin = factory({ ui: __ui }); }
globalThis.__pluginHost = {
  getMeta()                       { return { declaredId, title, description, initialState, widgets: Object.keys(__plugin.widgets) }; },
  render(widgetId, pluginState, globalState) { return __plugin.widgets[widgetId].render({ pluginState, globalState }); },
  event(widgetId, handler, args, pluginState, globalState) {
    __dispatchIntents = [];
    __plugin.widgets[widgetId].handlers[handler]({ pluginState, globalState,
      dispatchPluginAction: (t, p) => __dispatchIntents.push({ scope: "plugin", actionType: t, payload: p }),
      dispatchSharedAction: (d, t, p) => __dispatchIntents.push({ scope: "shared", domain: d, actionType: t, payload: p }) }, args);
    return __dispatchIntents.slice();
  },
};
```

The host side (`embedding.md`, "Using Without Redux") is the loop pbui will run per tile:

```ts
const plugin = await runtime.loadPlugin(packageId, instanceId, code);   // evaluates bootstrap + source, calls getMeta()
let state = plugin.initialState ?? {};
let tree  = runtime.render(instanceId, "main", state, globalState);     // validated UINode
// on click: intents = runtime.event(instanceId, "main", handler, args, state, globalState)
// reduce:   state/merge → {...state, ...payload};  state/replace → payload;   then re-render
```
