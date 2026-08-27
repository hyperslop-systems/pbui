---
Title: 'The Backlog: What No-Legacy Affords and What Pulls Each Item'
Ticket: PBUI-ACTIONS-3
Status: active
Topics:
    - pbui
    - actions
    - architecture
DocType: analysis
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Twelve improvements to pbui unlocked by dropping backwards compatibility, grouped by kind, each annotated with the concrete consumer that pulls it. Only Phase A (deletions + primary-click unification) runs now; the rest waits until something needs it.
WhatFor: Keep the post-PBUI-ACTIONS-2 improvement ideas in one adjudicated place so they are pulled by real work instead of pursued speculatively.
WhenToUse: Consult before any pbui release, before starting OPTKIT-022 (Phase A must land first), and before starting OPTKIT-024 (Phase B is pulled by its tasks).
---

# The Backlog: What No-Legacy Affords and What Pulls Each Item

## Standing decisions

Two rulings by the user (2026-08-26) govern this ticket:

1. **No backwards compatibility.** pbui has no external obligations; in-repo
   and out-of-repo consumers (datalab-ui, pbui-chat demo, agentlogic,
   turboproof) are adapted rather than shimmed. This resolves the
   delete-versus-deprecate adjudication left open in PBUI-ACTIONS-2 (diary
   step 10): **delete**.
2. **Nothing is pursued beyond what the main optkit/rag-ttc work needs.**
   The main focus is the ragttc optimization workbench (OPTKIT-022/023/024).
   Each item below names its pulling consumer; an item with no puller waits.

Nothing on this list blocks OPTKIT-022 or 023 — both can be built on pbui
0.7.0 as shipped. The phasing exists to avoid writing new consumers against
mechanisms scheduled for deletion.

## Phase A — SHIPPED as pbui 0.8.0, commit 6efeaeb (2026-08-26)

These are cheapest exactly once: before the ragttc workbench becomes another
consumer to migrate.

**A1. Delete the compat surface.** Descriptor `actions()`, the automatic
legacy engine and `legacyDescriptorFamily` (`src/presentation/actions/legacy.ts`),
the `conversions` option, `registry.actionsFor`. Make `actions` + `snapshotFor`
required in `createPbui`, deleting the defaulted `LegacyFacts` fourth generic.
Adapt the core tests/stories that exercised the compat surface on purpose.

**A2. Delete the side-effect descriptor registry** (the pre-
`createPresentationRegistry` registration path datalab-ui still initializes
through). One construction path: descriptors are values passed to
constructors, never module-load side effects. Rationale recorded in
PBUI-ACTIONS-2: side-effect registration is what let the chat demo's module
cycle exist silently.

**A3. Finish the rename.** `PresentationDescriptorRegistry` becomes the only
name; the descriptor narrows to `{label, describe?, tone?}`.

**A4. Route primary click through the kernel.** AMENDED during
implementation: `activate` turned out not to be a descriptor-side legacy
mechanism — since 0.4.0 it is a per-instance JSX prop whose real job is
host-owned clicks (selection/expansion owned by the surrounding organism,
which a type-scoped rule cannot express). What shipped: the 0.4.0
`onActivate`/`activateDoc` tombstone props were deleted; `metadata.primary`
plus `invocation: "primary"` were added so a bare left click performs the
UNIQUE available primary action through fresh revalidation (zero or several
open the menu); `activate` stays as the instance-level override and wins
over the kernel primary when present. Pulled by OPTKIT-022: its
click-to-open behavior is declared as primary rules from day one.

## Phase B — just before OPTKIT-024 (small release)

Pulled directly by OPTKIT-024's task list ("vocabulary export build step with
golden JSON test"; "verb router delegation with actor attribution and verb
log"). Without these, 024 builds the same substance as product-local code.

**B1. Richer perform envelope.** `onPerform(verb, {action, candidateId,
invocation, subject, actor?})`. Provenance in the verb log becomes native;
the OPTKIT trace record shape `{seq, actor, verb, target, outcome}` (fixed in
OPTKIT-021 ADR K) stops being reconstructed from the verb. Signature break
for every consumer; adaptation is a parameter addition.

**B2. Vocabulary export from the registry.** Generate the agent-facing
vocabulary (types, actions, danger flags, examples) from the action registry +
type graph + descriptors (`listReachable`, rule metadata) instead of a
hand-maintained module. Renaming a rule then *is* the vocabulary bump;
"menu and agent disagree about what exists" becomes unrepresentable.

## Phase C — no puller; waits until something needs it

**C1. One condition system.** Wire a single predicate registry through
`createPbui`, shared by rules and translators (translator `when` currently
evaluates against an empty map — documented deferral in PBUI-ACTIONS-2 P6).
Puller: the first product declaring a conditional translator. The eight
OPTKIT translators are unconditional.

**C2. Refusal surfacing.** `onRefuse({code, because})` so products can toast
fresh-revalidation refusals (codes exist since P2; delivered nowhere).
Puller: first product wanting refusal UX beyond silent non-performance.

**C3. Product-definition builder.** `defineProduct<Values, Facts, Verb>()`
yielding pre-typed `define`/`graph`/`registry`/`translators`/`createPbui`;
collapses five generic-threading sites into one (the P4/P6 friction).
Ergonomics only; saves an afternoon per product, not a design.

**C4. Snapshot helper with derived revision.** `createSnapshot(...)`
computing the revision from a stable serialization of `product`, making
"revision moves iff facts move" structural instead of conventional.

**C5. Per-type order overrides on inherited rules.** `order: number |
(subjectType) => number`. Removes the recorded limitation that kept the chat
demo flat (one shared order value reorders menus whose Inspect positions
differ per type). Puller: first product wanting inheritance with per-type
menu positions; the ragttc vocabulary stays flat.

**C6. Introspection surface.** Dev-mode "why?" menu entry (invocation
`"introspection"` is reserved) rendering the same-branch trace: which rules
fired, who shadowed whom, which fact failed. Substitutes for the deferred
Storybook teaching artifacts.

## What is deliberately not on this list

The resolver ladder, four-state availability, ambiguity-as-data, fresh
revalidation semantics, the workbench mutation protocol with Go/TS parity,
and serializable verbs. These came out of the PBUI-ACTIONS-2 migration
validated; PBUI-ACTIONS-3 changes what surrounds the kernel, not the kernel.

## Consumer adaptation method

agentlogic, turboproof, and any other out-of-repo consumer adapt with the
same golden-fence method PBUI-ACTIONS-2 ran three times: freeze their menus
as golden fixtures, migrate descriptors to rules, review the diff filtered to
non-id/non-label lines (the only accepted semantic diff class:
`verb: undefined` on disabled rows). See the PBUI-ACTIONS-2 intern guide for
the protocol.

## Version plan

Phase A ships as pbui 0.8.0 (or 1.0.0 if the team prefers to declare the
shape final — Phase B's envelope break argues for holding 1.0.0 until B
lands). Phase B is the next minor after that. Phase C items ride whichever
release their puller appears in.
