import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { available, unavailable } from "./actions";
import type { ActionContribution } from "./actions";
import { createPbui } from "./createPbui";
import { definePresentation } from "./model";
import type { PresentationRelation } from "./relations";

/**
 * PBUI-ACTIONS-2 P2 — the NEW capabilities, tested through the real
 * components. The pre-existing createPbui/instanceChrome suites are the
 * unchanged-behavior fence; this file covers what did not exist before:
 * a product-supplied kernel, the non-executable ambiguity row, and fresh
 * revalidation refusing a stale menu row.
 */

type Values = { file: { id: string } };
type Facts = { canOpen: boolean; version: number };
type Verb = { kind: string; version?: number };

const p = definePresentation<Values, { name: string }, Facts, Verb>();
const define = p.actions;
const ignoreRefuse = () => {};

/** One compiled presentation per test: the `file` type and the given rules. */
function presentationWith(contributions: readonly ActionContribution<Values, Facts, Verb>[]) {
  return p.create({
    id: "test.actions",
    types: [{ id: "file" }],
    knownScopes: ["global"],
    defaultActiveScopes: ["global"],
    revision: (facts) => facts.version,
    descriptors: { file: { label: (value) => value.id } },
    actions: contributions,
  });
}

function mount(
  contributions: readonly ActionContribution<Values, Facts, Verb>[],
  facts: () => Facts,
  onPerform = vi.fn(),
) {
  const pbui = createPbui<Values, { name: string }, Verb, Facts>({
    presentation: presentationWith(contributions),
    defaultEnvironment: { name: "α" },
    contextFor: () => ({ facts: facts() }),
  });
  render(
    <pbui.Provider onPerform={onPerform} onRefuse={ignoreRefuse}>
      <pbui.Presentation reference={{ type: "file", value: { id: "f1" } }}>
        f1
      </pbui.Presentation>
      <pbui.ObjectMenu />
    </pbui.Provider>,
  );
  return { onPerform };
}

afterEach(cleanup);

describe("a product-supplied kernel drives the menu", () => {
  const open = define.exact("file", {
    id: "files.open",
    action: "presentation.open",
    scopes: ["global"],
    test: ({ snapshot }) =>
      snapshot.product.canOpen ? available() : unavailable("locked now"),
    metadata: { label: "Open" },
    bind: ({ snapshot }) => ({ kind: "open", version: snapshot.product.version }),
  });
  const registry = () =>
    [open];

  test("clicking a resolved row delegates the FRESH verb", () => {
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(registry(), () => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    // State moves between menu render and click; the fresh verb carries it.
    facts.version = 2;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onPerform).toHaveBeenCalledWith({ kind: "open", version: 2 }, expect.objectContaining({ invocation: "menu" }));
  });

  test("a row that became unavailable after render is refused — onPerform never runs", () => {
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(registry(), () => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onPerform).not.toHaveBeenCalled();
  });

  test("an unavailable row is visible, disabled, and explains itself", () => {
    const { onPerform } = mount(registry(), () => ({ canOpen: false, version: 1 }));
    fireEvent.contextMenu(screen.getByText("f1"));
    const row = screen.getByRole("menuitem", { name: /Open/ });
    expect((row as HTMLButtonElement).disabled).toBe(true);
    expect(row.textContent).toContain("locked now");
    expect(onPerform).not.toHaveBeenCalled();
  });
});

describe("ambiguity is data in the menu", () => {
  test("a tie renders a non-executable diagnostic row, and nothing else for that action", () => {
    const contested = (id: string) =>
      define.exact("file", {
        id,
        action: "presentation.open",
        scopes: ["global"],
        test: () => available(),
        metadata: { label: "Open" },
        bind: () => ({ kind: "open", version: 0 }),
      });
    const registry = [contested("plugin-a.open"), contested("plugin-b.open")];
    const { onPerform } = mount(registry, () => ({ canOpen: true, version: 1 }));
    fireEvent.contextMenu(screen.getByText("f1"));

    expect(screen.queryByRole("menuitem", { name: /Open/ })).toBeNull();
    const note = document.querySelector('[data-part="menu-ambiguity"]');
    expect(note?.textContent).toContain("2 rules tie for presentation.open");
    expect(note?.tagName).not.toBe("BUTTON");
    fireEvent.click(note as Element);
    expect(onPerform).not.toHaveBeenCalled();
  });
});

describe("the primary invocation (PBUI-ACTIONS-3 A4)", () => {
  const primaryOpen = define.exact("file", {
    id: "files.primary-open",
    action: "presentation.open",
    scopes: ["global"],
    test: ({ snapshot }) =>
      snapshot.product.canOpen ? available() : unavailable("locked now"),
    metadata: { label: "Open", primary: true },
    bind: ({ snapshot }) => ({ kind: "open", version: snapshot.product.version }),
  });

  test("a left click performs the unique available primary action with the fresh verb", () => {
    const registry = [primaryOpen];
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(registry, () => ({ ...facts }));
    facts.version = 2;
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).toHaveBeenCalledWith({ kind: "open", version: 2 }, expect.objectContaining({ invocation: "primary" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("an unavailable primary falls back to opening the menu", () => {
    const registry = [primaryOpen];
    const { onPerform } = mount(registry, () => ({ canOpen: false, version: 1 }));
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeNull();
  });

  test("two available primaries open the menu — nothing guesses", () => {
    const second = define.exact("file", {
      id: "files.primary-preview",
      action: "presentation.preview",
      scopes: ["global"],
      test: () => available(),
      metadata: { label: "Preview", primary: true },
      bind: () => ({ kind: "preview" }),
    });
    const registry = [primaryOpen, second];
    const { onPerform } = mount(registry, () => ({ canOpen: true, version: 1 }));
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeNull();
  });
});

describe("typed accept and the chooser (PBUI-ACTIONS-2 P6)", () => {
  type AValues = {
    doc: { id: string };
    "image-doc": { id: string };
    tag: { name: string; docId: string };
  };
  type AFacts = Record<string, never>;
  type AVerb = { kind: string };

  const ap = definePresentation<AValues, Record<string, never>, AFacts, AVerb>();

  function mountAccept(relations: readonly PresentationRelation<AValues, AFacts>[]) {
    const pbui = createPbui<AValues, Record<string, never>, AVerb, AFacts>({
      presentation: ap.create({
        id: "test.accept",
        types: [{ id: "doc" }, { id: "image-doc", parents: ["doc"] }, { id: "tag" }],
        knownScopes: ["global"],
        defaultActiveScopes: ["global"],
        revision: () => 0,
        descriptors: {
          doc: { label: (value) => value.id },
          "image-doc": { label: (value) => value.id },
          tag: { label: (value) => value.name },
        },
        relations,
      }),
      defaultEnvironment: {},
      contextFor: () => ({ facts: {} }),
    });
    const onAccept = vi.fn();
    let acceptResult: unknown = "unset";
    function Trigger() {
      const context = pbui.usePbui();
      return (
        <button
          type="button"
          onClick={() => void context.accept({ types: "doc", prompt: "pick" }).then((r) => (acceptResult = r))}
        >
          want-doc
        </button>
      );
    }
    render(
      <pbui.Provider onPerform={vi.fn()} onAccept={onAccept} onRefuse={ignoreRefuse}>
        <Trigger />
        <pbui.Presentation reference={{ type: "image-doc", value: { id: "img-1" } }}>
          img-1
        </pbui.Presentation>
        <pbui.Presentation reference={{ type: "tag", value: { name: "urgent", docId: "d9" } }}>
          urgent
        </pbui.Presentation>
        <pbui.AcceptChooser />
      </pbui.Provider>,
    );
    return { onAccept, result: () => acceptResult };
  }

  test("a subtype satisfies the request with the ORIGINAL reference", () => {
    const { onAccept } = mountAccept([]);
    fireEvent.click(screen.getByText("want-doc"));
    fireEvent.click(screen.getByText("img-1"));
    expect(onAccept).toHaveBeenCalledWith({ type: "image-doc", value: { id: "img-1" } });
  });

  test("one relation settles; highlighting and clicking agree", () => {
    const { onAccept } = mountAccept([
      {
        id: "tag-to-doc",
        from: "tag",
        to: "doc",
        match: "exact",
        exposure: { acceptance: true },
        apply: (reference) =>
          reference.type === "tag" ? { type: "doc", value: { id: reference.value.docId } } : undefined,
      },
    ]);
    fireEvent.click(screen.getByText("want-doc"));
    const tag = screen.getByText("urgent").closest('[data-pbui="presentation"]');
    expect(tag?.getAttribute("data-state")).toBe("acceptable");
    fireEvent.click(screen.getByText("urgent"));
    expect(onAccept).toHaveBeenCalledWith({ type: "doc", value: { id: "d9" } });
  });

  test("two tied edges open the chooser; Escape keeps the accept pending; a pick settles", () => {
    const edge = (id: string, suffix: string): PresentationRelation<AValues, AFacts> => ({
      id,
      from: "tag",
      to: "doc",
      match: "exact",
      exposure: { acceptance: true },
      apply: (reference) =>
        reference.type === "tag" ? { type: "doc", value: { id: reference.value.docId + suffix } } : undefined,
    });
    const { onAccept } = mountAccept([edge("a.edge", "-a"), edge("b.edge", "-b")]);
    fireEvent.click(screen.getByText("want-doc"));
    fireEvent.click(screen.getByText("urgent"));

    // Nothing settled by itself; the chooser is on screen with both options.
    expect(onAccept).not.toHaveBeenCalled();
    const chooser = document.querySelector('[data-part="accept-chooser"]');
    expect(chooser).not.toBeNull();

    // Escape dismisses the chooser only — the accept request stays pending.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector('[data-part="accept-chooser"]')).toBeNull();
    expect(onAccept).not.toHaveBeenCalled();
    expect(
      screen.getByText("urgent").closest('[data-pbui="presentation"]')?.getAttribute("data-state"),
    ).toBe("acceptable");

    // Click again and pick the second option deliberately.
    fireEvent.click(screen.getByText("urgent"));
    const options = document.querySelectorAll('[data-part="accept-chooser-option"]');
    expect(options).toHaveLength(2);
    fireEvent.click(options[1] as Element);
    expect(onAccept).toHaveBeenCalledWith({ type: "doc", value: { id: "d9-b" } });
  });
});

describe("the perform envelope (PBUI-ACTIONS-3 B1)", () => {
  const open = define.exact("file", {
    id: "files.open-enveloped",
    action: "presentation.open",
    scopes: ["global"],
    test: () => available(),
    metadata: { label: "Open", primary: true },
    bind: ({ snapshot }) => ({ kind: "open", version: snapshot.product.version }),
  });
  const registry = () =>
    [open];

  function mountWithActor(actor?: string) {
    const onPerform = vi.fn();
    const pbui = createPbui<Values, { name: string }, Verb, Facts>({
      presentation: presentationWith(registry()),
      defaultEnvironment: { name: "α" },
      contextFor: () => ({ facts: { canOpen: true, version: 7 } }),
    });
    render(
      <pbui.Provider onPerform={onPerform} actor={actor} onRefuse={ignoreRefuse}>
        <pbui.Presentation reference={{ type: "file", value: { id: "f1" } }}>
          f1
        </pbui.Presentation>
        <ChromeButton pbui={pbui} />
        <pbui.ObjectMenu />
      </pbui.Provider>,
    );
    return onPerform;
  }

  function ChromeButton({ pbui }: { pbui: { usePbui(): { perform(verb: Verb): unknown } } }) {
    const context = pbui.usePbui();
    return (
      <button type="button" onClick={() => void context.perform({ kind: "chrome" })}>
        chrome
      </button>
    );
  }

  test("a menu click delivers the FRESH provenance beside the verb", () => {
    const onPerform = mountWithActor("human");
    fireEvent.contextMenu(screen.getByText("f1"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onPerform).toHaveBeenCalledWith(
      { kind: "open", version: 7 },
      {
        invocation: "menu",
        action: "presentation.open",
        candidateId: "files.open-enveloped",
        subject: { type: "file", value: { id: "f1" } },
        actor: "human",
      },
    );
  });

  test("a primary left click reports invocation 'primary'", () => {
    const onPerform = mountWithActor();
    fireEvent.click(screen.getByText("f1"));
    expect(onPerform).toHaveBeenCalledTimes(1);
    const [, envelope] = onPerform.mock.calls[0]!;
    expect(envelope.invocation).toBe("primary");
    expect(envelope.action).toBe("presentation.open");
    expect(envelope.actor).toBeUndefined();
  });

  test("chrome delegation is 'direct': no action, no subject, actor kept", () => {
    const onPerform = mountWithActor("agent:reviewer");
    fireEvent.click(screen.getByText("chrome"));
    expect(onPerform).toHaveBeenCalledWith(
      { kind: "chrome" },
      { invocation: "direct", actor: "agent:reviewer" },
    );
  });
});
