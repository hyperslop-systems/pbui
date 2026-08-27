import { beforeEach, describe, expect, test, vi } from "vitest";
import { chat } from "../../demo/src/chat";
import { demoActionRegistry, snapshotForDemo } from "../../demo/src/pbui/actions";
import { registry } from "../../demo/src/pbui/registry";
import { DEFAULT_ENVIRONMENT } from "../../demo/src/pbui/types";

/**
 * The object menu of a conversation — the product's door to the handoff.
 *
 * A conversation the browser knows offers *open*, *activate*, *hand something
 * to this agent*; one it does not know offers the same entries with a reason
 * they cannot be performed, because a menu that silently drops entries teaches
 * the user that the menu is unreliable.
 */

const KNOWN = "desc-a";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  for (const snapshot of chat.conversations.all()) chat.conversations.forget(snapshot.id);
  chat.conversations.setAutoConnect(false);
  chat.conversations.adopt(KNOWN, { title: "reorder desk" });
  chat.conversations.open(KNOWN);
});

function actionsFor(id: string) {
  // PBUI-ACTIONS-2 P4: conversation menus resolve through the demo's kernel;
  // the rows are adapted back so every assertion below reads as before.
  const query = {
    subject: { type: "conversation", value: { type: "conversation", id, value: { title: "?" } } },
    invocation: "menu",
  } as never;
  const result = demoActionRegistry.resolve(
    query,
    snapshotForDemo(query, DEFAULT_ENVIRONMENT),
  );
  return result.actions.map((action) => ({
    label: String(action.label),
    verb: action.verb,
    disabledBecause: action.status.kind === "unavailable" ? action.status.because : undefined,
  }));
}

function labelled(id: string, label: string) {
  return actionsFor(id).find((action) => action.label === label);
}

describe("the conversation descriptor", () => {
  test("labels a conversation by the registry's title, not by the value the agent mentioned", () => {
    const label = registry.labelFor(
      { type: "conversation", value: { type: "conversation", id: KNOWN, value: { title: "stale" } } } as never,
      DEFAULT_ENVIRONMENT,
    );
    expect(label).toBe("reorder desk");
  });

  test("describe reports what is true now, including what is waiting for the user", () => {
    const described = registry.describeFor(
      { type: "conversation", value: { type: "conversation", id: KNOWN, value: {} } } as never,
      DEFAULT_ENVIRONMENT,
    ) as Record<string, unknown>;
    expect(described.title).toBe("reorder desk");
    expect(described.open).toBe(true);
    expect(described.waitingForYou).toBe(0);
  });

  test("the handoff is offered on an open conversation and explained away on a closed one", () => {
    expect(labelled(KNOWN, "Hand something to this agent…")?.disabledBecause).toBeUndefined();

    chat.conversations.close(KNOWN);
    expect(labelled(KNOWN, "Hand something to this agent…")?.disabledBecause).toMatch(/open it first/);
  });

  test("a conversation this browser does not know says so on every entry rather than hiding them", () => {
    const actions = actionsFor("ghost");
    expect(actions.find((action) => action.label === "Open in a tile")?.disabledBecause).toMatch(/not in this browser/);
    expect(actions.find((action) => action.label === "Make it the active one")?.disabledBecause).toMatch(/not in this browser/);
    // Asking the agent about it is always possible — that is how a user finds
    // out what a conversation they cannot see was for.
    expect(actions.find((action) => action.label === "Ask about it")?.disabledBecause).toBeUndefined();
  });

  test("the active conversation cannot be activated again", () => {
    chat.conversations.activate(KNOWN);
    expect(labelled(KNOWN, "Make it the active one")?.disabledBecause).toMatch(/already the active/);
  });
});
