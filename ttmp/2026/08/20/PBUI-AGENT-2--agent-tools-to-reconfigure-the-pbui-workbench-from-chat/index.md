---
Title: Agent tools to reconfigure the PBUI workbench from chat
Ticket: PBUI-AGENT-2
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://pbui/packages/pbui-chat/src/createPbuiChat.tsx
      Note: Where the chat extension is assembled and attachWorkbench binds the workbench
    - Path: repo://pbui/packages/pbui-chat/src/router/createVerbRouter.ts
      Note: Verb families, vocabulary validation, and the POST that writes the trace
    - Path: repo://pbui/packages/pbui-workbench/src/document.ts
      Note: layout()/tile()/split(); must be split into buildLayout() plus specOf()
    - Path: repo://pbui/packages/pbui-workbench/src/verbs.ts
      Note: The tile verbs as data and their handlers; the four workspace verbs land here
    - Path: repo://pbui/pkg/pbuichat/prompt.go
      Note: The generated system-prompt section that gains the workspace paragraph
    - Path: repo://pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: The 15 mutations the whole design is a projection of
    - Path: repo://pinocchio/pkg/chatapp/frontendtools/bridge.go
      Note: 'RegisterManifestTools and BridgeExecutor: how a browser tool becomes model-visible'
    - Path: repo://react-chat/packages/chat-provider/src/tools/toolRuntime.ts
      Note: The browser executor that runs a frontend tool and posts its result
ExternalSources: []
Summary: 'Ticket for giving the PBUI chat agent tools that build and rearrange the user workspace: browser-side workbench tools over the existing verb handlers, the missing workspace verbs in pbui-workbench, tile/workspace/app presentation types, a safety envelope, and four demo tile types. Contains the intern guide.'
LastUpdated: 2026-08-20T17:43:08.453485767-04:00
WhatFor: Landing page for PBUI-AGENT-2; start here to find the intern guide and the work breakdown.
WhenToUse: When picking up or reviewing the agent workspace-control work.
---


# Agent tools to reconfigure the PBUI workbench from chat

## Overview

Today the PBUI chat agent can emit objects, publish widgets, ask the user to
pick something, propose consequential actions and read its own trace — but it
cannot change what is on screen. This ticket gives it that: a small set of
**browser-side (frontend) tools** that are thin, validated wrappers over the
same `WorkbenchVerb` handlers a mouse gesture calls, on the same local
`WorkbenchDocument`, reported to the same trace.

The target gesture is:

> "make me a workspace called Gold desk with the chat on the left, the metals
> board over the inventory on the right, and open the two lowest-stock gold
> SKUs as their own tiles"

Three things make it work: (1) the missing **workspace verbs** in
`@hyperslop-systems/pbui-workbench` — the protocol has `workspaceCreate`,
`workspaceRename` and `workspaceDelete` and the shell has never exposed them;
(2) a tool surface at three altitudes — a declarative `LayoutSpec`, verbs as
data, and a raw `MutationBatch` escape hatch mirroring `hyperslop ui mutate`,
shipped disabled; (3) `tile`, `workspace` and `app` as **presentation types**,
so the tile bar's object menu offers the same verbs the agent used.

**No new wire types and no changes in pinocchio, sessionstream, geppetto or
`pkg/chatserver`.** The tools reach the model through the existing frontend
tool manifest bridge.

**Read in this order**

1. [design-doc/01 — Intern guide](./design-doc/01-intern-guide-giving-the-pbui-chat-agent-tools-to-build-and-rearrange-workspaces.md): analysis (§1-4), design (§5), implementation (§6-7), sequences, failure modes, API and file references.

Background, not repeated here: `PBUI-AGENT-1` (the agent, the object/verb/widget
contract) and `PBUI-WORKBENCH-1` (the tiles, the workbench document, the shell).

**Sequencing: this ticket is blocked on `PBUI-WORKBENCH-2` Phase 1.** That ticket
(unify agentlogic, turboproof, hyperblog and datalab-ui around `pbui-workbench`)
reached the same workspace gap from the products' side and owns the API: its
§5.A adds store injection plus `onMutate`/`onRejected`, §5.B adds
`workspace.select/create/rename/delete/clone` and a `WorkspaceStrip`, §5.C adds
`tile.replace`/`tile.link`/`view.rebind` and a split policy. Four product
consumers beat one agent, and its Phase 1 acceptance gesture is already stated in
the pbui-chat demo. Building the verbs here would mint a divergent name
(`workspace.switch` against their `workspace.select`) and force a rename through
every consumer.

Status: design complete, no code written. **Next step is PBUI-WORKBENCH-2 Phase 1**;
this ticket then starts at Tier 1 of the guide's §6. Guide §6 Tier 0 lists exactly
what is consumed from that phase, the six points where the two designs disagreed
and who wins, and the one piece this ticket still owns in `pbui-workbench`
(`describeWorkbench`/`buildLayout`/`specOf`).

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- chat
- frontend
- backend
- onboarding

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
