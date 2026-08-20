---
Title: Diary
Ticket: PBUI-AGENT-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md
      Note: Playbook for new PBUI-family apps; section 6 states the presentation protocol rules
    - Path: repo://packages/datalab-ui/src/pbui/verbs.ts
      Note: Production example of verbs-as-data vocabulary
    - Path: repo://proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: Workbench document + mutation protocol an agent could drive
    - Path: repo://src/presentation/createPbui.tsx
      Note: The PBUI runtime (Provider, Presentation, ObjectMenu, accept mode, MouseDocLine) the agent UI binds to
    - Path: repo://src/presentation/types.ts
      Note: Presentation reference/descriptor/action contract every agent widget must satisfy
ExternalSources: []
Summary: 'Chronological implementation diary for PBUI-AGENT-1: workspace survey, PBUI contract analysis, feature showcase, and the chat-agent design.'
LastUpdated: 2026-08-20T10:54:07.856409214-04:00
WhatFor: Record what was investigated, decided, and left open while designing the PBUI-native chat agent, so a second engineer can resume without re-deriving it.
WhenToUse: Read before resuming work on PBUI-AGENT-1 or reviewing its design docs.
---


# Diary

## Goal

Capture, step by step, how the PBUI-AGENT-1 ticket was researched and designed: what the workspace packages contribute to a chat-agent stack, what PBUI's presentation contract actually is, which showcase features were proposed, and how the design doc for a PBUI-native chat agent with custom (PBUI-object-embodying) widgets was arrived at. Failures and dead ends are recorded verbatim.

## Step 1: Survey the workspace and pin down PBUI's presentation contract

The workspace at `/home/manuel/workspaces/2026-08-20/add-pbui-agent` is a `go.work` over eight repos (`pbui`, `coinvault`, `react-chat`, `sessionstream`, `pinocchio`, `geppetto`, `hyperslop-cli`, `datalab`), each a git worktree on branch `task/add-pbui-agent`. docmgr's root is `pbui/ttmp` (per `.ttmp.yaml`), so the ticket lives in the pbui repo. I created `PBUI-AGENT-1`, this diary, and then read PBUI's presentation core directly (types, registry, `createPbui`, chrome, workbench proto) while four explorer agents mapped the other packages in parallel.

The headline finding: PBUI is *not* a widget toolkit in the usual sense. It is a **presentation protocol** — typed values (`{type, value}` references) bound to descriptors (`label`, `describe`, `actions → serializable verbs`, `tone`) with a single object menu, an "accept mode" (a command asks for an object of type X; the user clicks any presentation of that type anywhere, across tiles), a Genera-style mouse-doc line, tile chrome (`TileFrame`, `LauncherShell`, drag/dock) and a protobuf workbench document model. So "chat widgets that embody PBUI objects" means: every structured thing the agent emits must be a *presentation reference* with a descriptor, so it gets the menu, the verbs, accept-mode participation and tile-ability for free — not a one-off React component.

### Prompt Context

**User prompt (verbatim):** "Analyze pbui and coinvault and the other packages in this workspace (do not look outside of it or work outside of it) and create a new docmgr ticket and design a pbui chat agent with custom widget capability so that we can create a full feature PBUI based (presentation based UI native) chat agent whose widgets can embody PBUI objects.

Before writing a design doc, suggest a list of features we can do that would showcase the whole power, and make a doc with the suggestions and how they would work and use little ascii screenshots to show what they would look like.

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)"

**Assistant interpretation:** Research the workspace packages (PBUI first, then coinvault's existing web-chat as the reference agent stack, plus react-chat / sessionstream / pinocchio / geppetto / datalab / hyperslop-cli), open a docmgr ticket, write (1) a feature-showcase document with ASCII mockups and (2) a design doc for a PBUI-native chat agent whose chat widgets are PBUI presentations. Keep a diary, commit as I go, stay inside the workspace.

**Inferred user intent:** Get a credible, well-grounded plan for a flagship "chat agent on PBUI" product that demonstrates what presentation-based UI buys over a conventional chat UI (object menus, accept mode, verbs as data, tiles/workbench), reusing the existing go-go-golems chat stack rather than inventing a new one.

### What I did
- Listed the workspace, read `AGENT.md`, `go.work`, `.ttmp.yaml`, `.wsm/wsm.json`; confirmed each repo is a worktree and noted its HEAD.
- `docmgr ticket create-ticket --ticket PBUI-AGENT-1 --title "PBUI-native chat agent with custom PBUI widgets" --topics pbui,chat,frontend,backend`; `docmgr doc add … --doc-type reference --title "Diary"`.
- Read `pbui/README.md`, `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` (all 695 lines), `src/presentation/{types,registry,createPbui}.ts(x)`, `src/chrome/{TileFrame,LauncherShell}.tsx`, `src/components/index.ts` + folder inventory, `proto/hyperslop/pbui/workbench/v1/workbench.proto`, `pkg/workbench/model.go`, and datalab-ui's binding layer (`packages/datalab-ui/src/pbui/{types,verbs,runtime}.ts(x)`, `descriptors/field.ts`, `appkit/registry.ts`, `apps/all.ts`).
- Launched four Explore agents: pbui (deep), coinvault (webchat), pinocchio + react-chat, sessionstream + geppetto + hyperslop-cli + datalab.

### Why
- The ticket's value hinges on understanding what PBUI's *protocol* is, not just its component list; the playbook and `createPbui.tsx` are where that protocol is stated and argued.
- coinvault is the only package with a shipped LLM web chat, so it is the reference for the backend/transport shape.

### What worked
- docmgr ticket creation and the diary scaffold worked first time; docmgr root resolves to `pbui/ttmp` so ticket commits go to the pbui worktree.
- Reading `createPbui.tsx` end to end gave the precise runtime surface: `Provider{onPerform,onAccept,environment}`, `Presentation{reference,activate,inComposite,doc}`, `ObjectMenu`, `MouseDocLine`, `AcceptBanner`, `usePbui(){accept,abortAccept,openMenu,perform,…}`, plus `conversions` (type coercion for accept) and `renderMenuHeader`.

### What didn't work
- `cat ttmp/2026/08/index.md` — `No such file or directory`; the ticket tree is `ttmp/YYYY/MM/DD/TICKET--slug/`, there is no month-level index.
- A chained `cd pbui && …` after an earlier `cd` produced `(eval):cd:1: no such file or directory: pbui` because the shell cwd had already moved into `pbui/`. Switched to absolute paths / `git -C`.

### What I learned
- PBUI's key types (`src/presentation/types.ts`): `PresentationReference<Values> = {type, value}`; `PresentationDescriptor{label, describe?, actions?, tone?}`; `PresentationAction{id,label,verb,description?,group?,danger?,disabledBecause?}` — **one field** for unavailability (the `disabled`/`disabledReason` pair is tombstoned as `never`).
- "Verbs are serializable data, never closures" (playbook §6) — this is exactly what makes an LLM able to *emit* and *receive* verbs: the agent can propose a verb as JSON and the product router performs it; the UI can report performed verbs back to the agent as a trace.
- Accept mode (`accept(request) → Promise<reference|null>`) reaches across tiles and workspaces — the natural shape for "agent asks the user to pick an object".
- A presentation value "carries what its menu needs to decide, resolved by the component that already knows it" (datalab `TileRef` comment). Agent-emitted objects must therefore carry enough state for their verbs to be decidable without a round trip.
- The workbench protocol (`workbench.proto`) models workspaces → split trees → `AppView{app_id, documents}` → `DocumentPayload{format, schema_version, Struct body}` with a `Mutation` oneof; the Go side (`pkg/workbench`) validates with host-provided `ApplicationCatalog` + `DocumentValidator`. An agent that can emit `Mutation`s can rearrange the user's workbench.
- Tile registry contract (`appkit/registry.ts`): `AppDescriptor{id,title,tone,docBound,duplicable,singleton,Component}` registered by side-effect import; a tile is a container that reads the store and hands data to an organism.

### What was tricky to build
- Nothing built yet; the tricky part was conceptual: separating "PBUI component" (Button, Meter, …) from "PBUI object" (a presentation reference with a descriptor). The user's phrase "widgets can embody PBUI objects" resolves to the latter — the design must make agent output *objects first*, with rendering as a consequence.

### What warrants a second pair of eyes
- Whether the ticket should live in `pbui/ttmp` (where docmgr points) or in a new product repo later. I kept it in pbui because that is the configured root and the design is PBUI-first.

### What should be done in the future
- Fold the explorer findings (coinvault/pinocchio/react-chat/sessionstream/geppetto) into Step 2 and relate the key files.

### Code review instructions
- Start with `pbui/src/presentation/createPbui.tsx` (the runtime), `pbui/src/presentation/types.ts` (the contract), `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` §6 (the argument). Then `packages/datalab-ui/src/pbui/verbs.ts` for a production verb vocabulary.
- Validate docmgr state: `docmgr doc list --ticket PBUI-AGENT-1`, `docmgr doctor --ticket PBUI-AGENT-1`.

### Technical details

The PBUI runtime surface a chat agent product will bind to:

```ts
const pbui = createPbui<Values, Environment, Verb>({ registry, defaultEnvironment, conversions?, renderMenuHeader? });
<pbui.Provider onPerform={(verb) => route(verb)} onAccept={(ref) => …} environment={env}>
  <pbui.Presentation reference={{type:"txn", value}} doc="a transaction" activate={{run, doc}} inComposite />
  <pbui.ObjectMenu /> <pbui.MouseDocLine ambient="…" /> <pbui.AcceptBanner />
</pbui.Provider>
const { accept, openMenu, perform, environment } = pbui.usePbui();
const picked = await accept({ types: ["field","txn"], prompt: "pick the field to group by", filter? });
```
