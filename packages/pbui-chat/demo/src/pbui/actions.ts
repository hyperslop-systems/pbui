import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
  unavailable,
} from "@hyperslop-systems/pbui";
import type {
  ActionContribution,
  ActionQuery,
  Availability,
  SelectionSnapshot,
} from "@hyperslop-systems/pbui";
import type { TileRef } from "@hyperslop-systems/pbui-workbench";
import { workbenchTileContributions } from "@hyperslop-systems/pbui-workbench";
import { createGeneratedActionsFamily } from "@hyperslop-systems/pbui-sandbox";
import type { GeneratedActionFacts } from "@hyperslop-systems/pbui-sandbox";
import { fromPresentationReference } from "@hyperslop-systems/pbui-chat";
import { conversationRecord } from "./conversationFacts";
import { library } from "../sandbox";
import type { Environment, PresentationType, Values } from "./types";
import type { Verb } from "./verbs";

/**
 * The shop's action registry (PBUI-ACTIONS-2 P4). Every one of the nineteen
 * presentation types now declares its menu as kernel rules; the descriptors
 * keep label/describe/tone only, so there is no legacy family here at all.
 * The tile menu consumes the shared workbench fragment through a `project`
 * mapping (the chat layer's wire reference is not a `TileRef`), and the
 * sandbox's generated actions arrive as a family whose records ride in the
 * snapshot — live on the next resolution, no re-registration.
 *
 * Labels, reasons, verbs, and order are byte-identical to the descriptor
 * callbacks they replace; the golden tests are the fence. Rule ids are
 * `demo.<type>.<slug>`; action ids keep the P0 semantic derivation
 * (`<type>.<verb-kind>[.<discriminant>]`) so identity is continuous with the
 * frozen goldens.
 */

/* ---------------------------------------------------------------- facts --- */

interface ConversationFacts {
  known: boolean;
  active: boolean;
  open: boolean;
  pinned: boolean;
  archived: boolean;
  waiting: number;
}

interface ProgramFacts {
  exists: boolean;
  bindings: readonly string[];
  pinned: boolean;
}

export interface DemoFacts extends GeneratedActionFacts {
  /** For rules that need ambient product state beyond the derived facts. */
  environment: Environment;
  canApprove: boolean;
  /** conversation and chatEvent subjects: the referenced conversation. */
  conversation: ConversationFacts | null;
  /** program subjects. */
  program: ProgramFacts | null;
}

export function snapshotForDemo(
  query: ActionQuery<Values>,
  environment: Environment,
): SelectionSnapshot<DemoFacts> {
  let conversation: ConversationFacts | null = null;
  let program: ProgramFacts | null = null;

  const conversationId =
    query.subject.type === "conversation"
      ? query.subject.value.id
      : query.subject.type === "chatEvent"
        ? (query.subject.value.value?.conversationId ?? "")
        : null;
  if (conversationId !== null) {
    const snapshot = conversationId ? conversationRecord(conversationId) : null;
    conversation = snapshot
      ? {
          known: true,
          active: snapshot.active,
          open: snapshot.open,
          pinned: snapshot.pinned,
          archived: snapshot.archived,
          waiting: snapshot.waiting,
        }
      : { known: false, active: false, open: false, pinned: false, archived: false, waiting: 0 };
  }

  if (query.subject.type === "program") {
    const ref = query.subject.value;
    const record = library.getState().programs[ref.id];
    program = {
      exists: record !== undefined,
      bindings: record?.bindings ?? ref.value?.bindings ?? [],
      pinned: record?.pinned ?? ref.value?.pinned ?? false,
    };
  }

  const state = library.getState();
  const generatedActions = Object.values(state.actions);
  const generatedPrograms = new Set(Object.keys(state.programs));

  return {
    revision: JSON.stringify([
      environment.canApprove,
      conversation,
      program,
      generatedActions.map((record) => [record.id, record.updatedAt]),
      [...generatedPrograms],
    ]),
    scopes: ["shop", "workbench", "global"],
    modes: new Set(),
    capabilities: new Set(environment.canApprove ? ["approve"] : []),
    product: {
      environment,
      canApprove: environment.canApprove,
      conversation,
      program,
      generatedActions,
      generatedPrograms,
    },
  };
}

/* ---------------------------------------------------------------- rules --- */

const define = defineActions<Values, DemoFacts, Verb>();

/** The compact per-type rule builder: id `demo.<type>.<slug>`, sequential order. */
function rulesFor<Type extends PresentationType>(
  type: Type,
  entries: ReadonlyArray<{
    slug: string;
    action: string;
    label: string | ((context: { subject: { value: Values[Type] }; snapshot: SelectionSnapshot<DemoFacts> }) => string);
    description?: string;
    danger?: boolean;
    order?: number;
    test?(context: { subject: { type: Type; value: Values[Type] }; snapshot: SelectionSnapshot<DemoFacts> }): Availability;
    bind(context: { subject: { type: Type; value: Values[Type] }; snapshot: SelectionSnapshot<DemoFacts> }): Verb;
  }>,
): ActionContribution<Values, DemoFacts, Verb>[] {
  return entries.map((entry, index) =>
    define.exact(type, {
      id: `demo.${type}.${entry.slug}`,
      action: entry.action,
      scopes: ["shop"],
      ...(entry.test ? { test: entry.test } : {}),
      metadata: {
        label:
          typeof entry.label === "function"
            ? (context) =>
                (entry.label as (c: unknown) => string)({
                  subject: context.subject as unknown as { value: Values[Type] },
                  snapshot: context.snapshot,
                })
            : entry.label,
        ...(entry.description !== undefined ? { description: entry.description } : {}),
        ...(entry.danger ? { danger: true } : {}),
        order: entry.order ?? index,
      },
      bind: entry.bind,
    }),
  );
}

const gone = (facts: ConversationFacts | null): Availability =>
  facts && !facts.known
    ? unavailable("this conversation is not in this browser's list")
    : available();

const CONTRIBUTIONS: ActionContribution<Values, DemoFacts, Verb>[] = [
  /* ----- shop objects ---------------------------------------------------- */
  ...rulesFor("product", [
    { slug: "inspect", action: "product.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    { slug: "watch", action: "product.watch", label: "Add to watchlist", bind: ({ subject }) => ({ kind: "watch", ref: subject.value }) },
    {
      slug: "compare",
      action: "product.compareWith",
      label: "Compare with…",
      description: "pick another product to compare against",
      bind: ({ subject }) => ({ kind: "compareWith", left: subject.value }),
    },
    {
      slug: "ask-sales",
      action: "product.askAgent",
      label: "Ask the agent why it sells",
      bind: ({ subject }) => ({ kind: "askAgent", template: "why does {0} sell the way it does?", refs: [subject.value] }),
    },
    {
      slug: "reorder",
      action: "product.reorder",
      label: ({ subject }) => {
        const value = subject.value.value;
        const low =
          value?.stock !== undefined && value.reorderPoint !== undefined && value.stock <= value.reorderPoint;
        return low ? "Draft a reorder (stock is low)" : "Draft a reorder";
      },
      danger: true,
      test: ({ snapshot }) =>
        snapshot.capabilities.has("approve") ? available() : unavailable("needs approver role"),
      bind: ({ subject }) => ({ kind: "reorder", productId: subject.value.id }),
    },
  ]),

  ...rulesFor("category", [
    { slug: "inspect", action: "category.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "ask-sales",
      action: "category.askAgent",
      label: "Ask what sells here",
      bind: ({ subject }) => ({ kind: "askAgent", template: "what sells best in {0}?", refs: [subject.value] }),
    },
    {
      slug: "keep-only",
      action: "category.addFilter.category.=",
      label: "Keep only this category",
      test: ({ subject }) =>
        subject.value.value?.tableId ? available() : unavailable("the category is not shown in a table"),
      bind: ({ subject }) => ({
        kind: "addFilter",
        tableId: subject.value.value?.tableId ?? "",
        field: "category",
        op: "=",
        value: subject.value.value?.name ?? subject.value.id,
      }),
    },
  ]),

  ...rulesFor("metal", [
    { slug: "inspect", action: "metal.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "keep-only",
      action: "metal.addFilter.metal.=",
      label: "Keep only this metal",
      test: ({ subject }) =>
        subject.value.value?.tableId ? available() : unavailable("the metal is not shown in a table"),
      bind: ({ subject }) => ({
        kind: "addFilter",
        tableId: subject.value.value?.tableId ?? "",
        field: "metal",
        op: "=",
        value: subject.value.id,
      }),
    },
    {
      slug: "ask-spot",
      action: "metal.askAgent",
      label: "Ask about the spot price",
      bind: ({ subject }) => ({ kind: "askAgent", template: "how has the {0} spot price moved this month?", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("order", [
    { slug: "inspect", action: "order.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    { slug: "watch", action: "order.watch", label: "Add to watchlist", bind: ({ subject }) => ({ kind: "watch", ref: subject.value }) },
    {
      slug: "ask-status",
      action: "order.askAgent",
      label: "Ask where it is",
      bind: ({ subject }) => ({ kind: "askAgent", template: "what is the status of {0}?", refs: [subject.value] }),
    },
  ]),

  /* ----- layout ---------------------------------------------------------- */
  ...(workbenchTileContributions<Values, DemoFacts>({
    project: (ref) => {
      const value = ref.value;
      return {
        placementId: ref.id,
        viewId: value?.viewId ?? "",
        appId: value?.appId ?? "",
        title: value?.title ?? ref.id,
        ...(value?.customTitle ? { customTitle: value.customTitle } : {}),
        placementCount: value?.placementCount ?? 1,
        canClose: value?.canClose ?? false,
        duplicable: value?.duplicable ?? false,
      } satisfies TileRef;
    },
  }) as unknown as ActionContribution<Values, DemoFacts, Verb>[]),
  ...rulesFor("tile", [
    {
      slug: "ask-about",
      action: "tile.askAgent.about",
      label: "Ask the agent about this tile",
      order: 40,
      bind: ({ subject }) => ({ kind: "view.goTo", viewId: subject.value.value?.viewId ?? "" }),
    },
    {
      slug: "ask-rearrange",
      action: "tile.askAgent.rearrange",
      label: "Ask the agent to rearrange this",
      order: 41,
      bind: ({ subject }) => ({
        kind: "askAgent",
        template: "the tile showing {0} is in the wrong place — where would you put it?",
        refs: [subject.value],
      }),
    },
  ]),

  ...rulesFor("workspace", [
    {
      slug: "go-to",
      action: "workspace.workspace.select",
      label: "Go to it",
      test: ({ subject }) =>
        subject.value.value?.active ? unavailable("you are already here") : available(),
      bind: ({ subject }) => ({ kind: "workspace.select", workspaceId: subject.value.id }),
    },
    { slug: "duplicate", action: "workspace.workspace.clone", label: "Duplicate", bind: ({ subject }) => ({ kind: "workspace.clone", workspaceId: subject.value.id }) },
    {
      slug: "rename",
      action: "workspace.workspace.rename",
      label: "Rename…",
      bind: ({ subject }) => ({ kind: "workspace.rename", workspaceId: subject.value.id, name: subject.value.value?.name ?? "" }),
    },
    { slug: "delete", action: "workspace.workspace.delete", label: "Delete", danger: true, bind: ({ subject }) => ({ kind: "workspace.delete", workspaceId: subject.value.id }) },
    {
      slug: "ask-contents",
      action: "workspace.askAgent",
      label: "Ask the agent what is in it",
      bind: ({ subject }) => ({ kind: "askAgent", template: "what is in the workspace {0}?", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("app", [
    {
      slug: "place",
      action: "app.app.place",
      label: "Open it in a tile",
      test: ({ subject }) =>
        subject.value.value?.docBound
          ? unavailable("this application is a view OF something; open it from the object it shows")
          : available(),
      bind: ({ subject }) => ({ kind: "app.place", appId: subject.value.id }),
    },
    {
      slug: "ask-place",
      action: "app.askAgent",
      label: "Ask the agent to place it",
      bind: ({ subject }) => ({ kind: "askAgent", template: "put {0} somewhere sensible on my screen", refs: [subject.value] }),
    },
  ]),

  /* ----- the sandbox ------------------------------------------------------ */
  ...rulesFor("program", [
    {
      slug: "open",
      action: "program.program.open",
      label: "Open in a tile",
      test: ({ snapshot }) => {
        const facts = snapshot.product.program;
        if (!facts?.exists) return unavailable("this program is not in the library");
        if (facts.bindings.length > 0) {
          return unavailable(
            `needs ${facts.bindings.map((binding) => `a "${binding}" binding`).join(", ")}; open it from that object's menu or ask the agent`,
          );
        }
        return available();
      },
      bind: ({ subject }) => ({ kind: "program.open", programId: subject.value.id }),
    },
    { slug: "source", action: "program.inspect", label: "View source", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "pin",
      action: "program.program.pin",
      label: ({ snapshot }) =>
        snapshot.product.program?.pinned ? "Unpin" : "Pin (the agent must ask before changing it)",
      bind: ({ subject, snapshot }) => ({
        kind: "program.pin",
        programId: subject.value.id,
        pinned: !snapshot.product.program?.pinned,
      }),
    },
    { slug: "remove", action: "program.program.remove", label: "Remove", danger: true, bind: ({ subject }) => ({ kind: "program.remove", programId: subject.value.id }) },
    {
      slug: "ask-improve",
      action: "program.askAgent",
      label: "Ask the agent to improve it",
      bind: ({ subject }) => ({ kind: "askAgent", template: "improve the program {0}: ", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("action", [
    { slug: "inspect", action: "action.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    { slug: "remove", action: "action.action.remove", label: "Remove from menus", danger: true, bind: ({ subject }) => ({ kind: "action.remove", actionId: subject.value.id }) },
    {
      slug: "ask-change",
      action: "action.askAgent",
      label: "Ask the agent to change it",
      bind: ({ subject }) => ({ kind: "askAgent", template: "change the action {0}: ", refs: [subject.value] }),
    },
  ]),

  createGeneratedActionsFamily<Values, DemoFacts, Verb>({
    toVerb: (record, reference) => ({
      kind: "action.run",
      actionId: record.id,
      ref: fromPresentationReference(reference),
    }),
  }),

  /* ----- conversations ---------------------------------------------------- */
  ...rulesFor("conversation", [
    {
      slug: "open",
      action: "conversation.conversation.open",
      label: "Open in a tile",
      test: ({ snapshot }) => gone(snapshot.product.conversation),
      bind: ({ subject }) => ({ kind: "conversation.open", conversationId: subject.value.id }),
    },
    {
      slug: "activate",
      action: "conversation.conversation.select",
      label: "Make it the active one",
      description: "the trace, the events and the other singleton tiles follow it",
      test: ({ snapshot }) => {
        const facts = snapshot.product.conversation;
        if (facts && !facts.known) return gone(facts);
        return facts?.active ? unavailable("it is already the active conversation") : available();
      },
      bind: ({ subject }) => ({ kind: "conversation.select", conversationId: subject.value.id }),
    },
    {
      slug: "rename",
      action: "conversation.conversation.rename",
      label: "Rename…",
      test: ({ snapshot }) => gone(snapshot.product.conversation),
      bind: ({ subject }) => ({ kind: "conversation.rename", conversationId: subject.value.id }),
    },
    {
      slug: "pin",
      action: "conversation.conversation.pin",
      label: ({ snapshot }) =>
        snapshot.product.conversation?.pinned ? "Stop keeping it at the top" : "Keep it at the top",
      test: ({ snapshot }) => gone(snapshot.product.conversation),
      bind: ({ subject, snapshot }) => ({
        kind: "conversation.pin",
        conversationId: subject.value.id,
        pinned: !snapshot.product.conversation?.pinned,
      }),
    },
    {
      slug: "archive",
      action: "conversation.conversation.archive",
      label: ({ snapshot }) =>
        snapshot.product.conversation?.archived ? "Bring it back" : "Archive it",
      description: "out of the way; the transcript stays",
      test: ({ snapshot }) => gone(snapshot.product.conversation),
      bind: ({ subject, snapshot }) => ({
        kind: "conversation.archive",
        conversationId: subject.value.id,
        archived: !snapshot.product.conversation?.archived,
      }),
    },
    {
      slug: "disconnect",
      action: "conversation.conversation.close",
      label: "Disconnect it",
      description: "closes the socket; the record and the server's session stay",
      test: ({ snapshot }) => {
        const facts = snapshot.product.conversation;
        if (facts && !facts.known) return gone(facts);
        return facts?.open ? available() : unavailable("it is already disconnected");
      },
      bind: ({ subject }) => ({ kind: "conversation.close", conversationId: subject.value.id }),
    },
    {
      slug: "waiting",
      action: "conversation.view.open.chat-tools",
      label: ({ snapshot }) => {
        const waiting = snapshot.product.conversation?.waiting ?? 0;
        return waiting > 0 ? `Show what is waiting · ${waiting}` : "Show what is waiting";
      },
      description: "the tools tile, where a parked tool can be answered",
      test: ({ snapshot }) =>
        (snapshot.product.conversation?.waiting ?? 0) > 0
          ? available()
          : unavailable("nothing is waiting in this conversation"),
      bind: () => ({ kind: "view.open", appId: "chat-tools", documents: {} as Record<string, string> }),
    },
    {
      slug: "context",
      action: "conversation.view.open.conversation-context",
      label: "Show what it was told",
      description: "its tools, the last message it sent, its environment",
      test: ({ snapshot }) => gone(snapshot.product.conversation),
      bind: ({ subject }) => ({
        kind: "view.open",
        appId: "conversation-context",
        documents: { conversation: subject.value.id },
      }),
    },
    { slug: "inspect", action: "conversation.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "handoff",
      action: "conversation.conversation.send",
      label: "Hand something to this agent…",
      description: "sends a message to that conversation rather than this one",
      test: ({ snapshot }) => {
        const facts = snapshot.product.conversation;
        if (facts && !facts.known) return gone(facts);
        return facts?.open ? available() : unavailable("it is closed; open it first");
      },
      bind: ({ subject }) => ({
        kind: "conversation.send",
        conversationId: subject.value.id,
        template: "please take a look at this: ",
      }),
    },
    {
      slug: "ask-about",
      action: "conversation.askAgent",
      label: "Ask about it",
      bind: ({ subject }) => ({ kind: "askAgent", template: "what is the conversation {0} about?", refs: [subject.value] }),
    },
    {
      slug: "forget",
      action: "conversation.conversation.forget",
      label: "Drop it from the list",
      description: "this browser forgets it; the server keeps the session",
      danger: true,
      test: ({ snapshot }) => gone(snapshot.product.conversation),
      bind: ({ subject }) => ({ kind: "conversation.forget", conversationId: subject.value.id }),
    },
  ]),

  ...rulesFor("chatEvent", [
    { slug: "inspect", action: "chatEvent.inspect", label: "Inspect the raw frame", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "go-to",
      action: "chatEvent.conversation.select",
      label: "Go to its conversation",
      test: ({ snapshot }) => {
        const facts = snapshot.product.conversation;
        if (!facts || !facts.known) return unavailable("that conversation is not in this browser's list");
        return facts.active ? unavailable("it is already the active conversation") : available();
      },
      bind: ({ subject }) => ({
        kind: "conversation.select",
        conversationId: subject.value.value?.conversationId ?? "",
      }),
    },
    {
      slug: "ask-meaning",
      action: "chatEvent.askAgent",
      label: "Ask the agent what it means",
      bind: ({ subject }) => ({
        kind: "askAgent",
        template: "what does this event mean, and should I worry about it? {0}",
        refs: [subject.value],
      }),
    },
  ]),

  /* ----- tables, sources, tools ------------------------------------------ */
  ...rulesFor("field", [
    { slug: "inspect", action: "field.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "sort-asc",
      action: "field.sortBy.asc",
      label: "Sort ascending",
      bind: ({ subject }) => fieldSort(subject.value, "asc"),
    },
    {
      slug: "sort-desc",
      action: "field.sortBy.desc",
      label: "Sort descending",
      bind: ({ subject }) => fieldSort(subject.value, "desc"),
    },
    {
      slug: "hide-empty",
      action: "field.addFilter.ne-empty",
      label: "Hide empty values",
      bind: ({ subject }) => {
        const { tableId, field } = fieldParts(subject.value);
        return { kind: "addFilter", tableId, field, op: "!=", value: "" };
      },
    },
    {
      slug: "ask-meaning",
      action: "field.askAgent",
      label: "Ask what it means",
      bind: ({ subject }) => ({
        kind: "askAgent",
        template: "what does the {0} column mean, and how is it computed?",
        refs: [subject.value],
      }),
    },
  ]),

  ...rulesFor("row", [
    { slug: "inspect", action: "row.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    { slug: "watch", action: "row.watch", label: "Add to watchlist", bind: ({ subject }) => ({ kind: "watch", ref: subject.value }) },
    {
      slug: "ask-about",
      action: "row.askAgent",
      label: "Ask about this row",
      bind: ({ subject }) => ({ kind: "askAgent", template: "tell me more about {0}", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("source", [
    { slug: "inspect", action: "source.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "ask-quote",
      action: "source.askAgent",
      label: "Ask what it says",
      bind: ({ subject }) => ({ kind: "askAgent", template: "quote the relevant part of {0}", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("widget", [
    { slug: "inspect", action: "widget.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    { slug: "open", action: "widget.openInTile", label: "Open in tile", bind: ({ subject }) => ({ kind: "openInTile", widgetId: subject.value.id }) },
    {
      slug: "ask-explain",
      action: "widget.askAgent",
      label: "Ask the agent to explain it",
      bind: ({ subject }) => ({ kind: "askAgent", template: "explain what {0} shows", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("tool", [
    { slug: "inspect", action: "tool.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "rerun",
      action: "tool.rerunTool",
      label: "Re-run",
      test: ({ subject }) => {
        const status = subject.value.value?.status;
        return status && !["success", "finished", "failed"].includes(status)
          ? unavailable("the tool is still running")
          : available();
      },
      bind: ({ subject }) => ({ kind: "rerunTool", toolCallId: subject.value.id }),
    },
    {
      slug: "ask-why",
      action: "tool.askAgent",
      label: "Ask why it was called",
      bind: ({ subject }) => ({ kind: "askAgent", template: "why did you call {0}, and what did it return?", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("proposal", [
    { slug: "inspect", action: "proposal.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "approve",
      action: "proposal.resolveProposal.approve",
      label: "Approve",
      danger: true,
      test: ({ subject, snapshot }) => {
        const decision = subject.value.value?.decision;
        if (decision) return unavailable(`already ${decision.value}d`);
        return snapshot.capabilities.has("approve") ? available() : unavailable("needs approver role");
      },
      bind: ({ subject }) => ({ kind: "resolveProposal", id: subject.value.id, decision: "approve" }),
    },
    {
      slug: "reject",
      action: "proposal.resolveProposal.reject",
      label: "Reject",
      test: ({ subject }) => {
        const decision = subject.value.value?.decision;
        return decision ? unavailable(`already ${decision.value}d`) : available();
      },
      bind: ({ subject }) => ({ kind: "resolveProposal", id: subject.value.id, decision: "reject" }),
    },
    {
      slug: "ask-reasoning",
      action: "proposal.askAgent",
      label: "Ask for the reasoning",
      bind: ({ subject }) => ({ kind: "askAgent", template: "why are you proposing {0}?", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("traceEntry", [
    { slug: "inspect", action: "traceEntry.inspect", label: "Inspect", bind: ({ subject }) => ({ kind: "inspect", ref: subject.value }) },
    {
      slug: "ask-what",
      action: "traceEntry.askAgent",
      label: "Ask what happened",
      bind: ({ subject }) => ({ kind: "askAgent", template: "what happened at trace entry {0}?", refs: [subject.value] }),
    },
  ]),

  ...rulesFor("unresolved", [
    {
      slug: "ask-what",
      action: "unresolved.askAgent",
      label: "Ask the agent what this is",
      bind: ({ subject }) => ({
        kind: "askAgent",
        template: "what did you mean by {0}? I could not resolve it.",
        refs: [subject.value],
      }),
    },
  ]),
];

function fieldParts(ref: Values["field"]): { tableId: string; field: string } {
  return {
    tableId: ref.value?.tableId ?? ref.id.split(".")[0] ?? "",
    field: ref.value?.name ?? ref.id.split(".").slice(1).join("."),
  };
}

function fieldSort(ref: Values["field"], dir: "asc" | "desc"): Verb {
  const { tableId, field } = fieldParts(ref);
  return { kind: "sortBy", tableId, field, dir };
}

/* -------------------------------------------------------------- registry --- */

export const demoActionRegistry = createActionRegistry<Values, DemoFacts, Verb>({
  graph: createPresentationTypeGraph(
    (
      [
        "product", "category", "metal", "order", "tile", "workspace", "app",
        "program", "action", "conversation", "chatEvent", "field", "row",
        "source", "widget", "tool", "proposal", "traceEntry", "unresolved",
      ] as const
    ).map((id) => ({ id })),
  ),
  scopes: ["shop", "workbench", "global"],
  contributions: CONTRIBUTIONS,
});
