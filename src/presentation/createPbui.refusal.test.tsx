import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { available, unavailable } from "./actions";
import { createPbui } from "./createPbui";
import { definePresentation } from "./model";

/**
 * PBUI-KERNEL-4 P4 — refusal presentation through the real components: a
 * row that went stale between render and click is refused, the refusal
 * lands in context, RefusalNotice shows it with the row, the subject and
 * the product's reason, the next menu retires it, and a refusal nobody
 * observes is warned about.
 */

type Values = { file: { id: string } };
type Facts = { canOpen: boolean; version: number };
type Verb = { kind: string };

const p = definePresentation<Values, { name: string }, Facts, Verb>();

const open = p.actions.exact("file", {
  id: "files.open",
  action: "presentation.open",
  scopes: ["global"],
  test: ({ snapshot }) => (snapshot.product.canOpen ? available() : unavailable("locked now")),
  metadata: { label: "Open" },
  bind: () => ({ kind: "open" }),
});

const presentation = p.create({
  id: "test.refusal",
  types: [{ id: "file" }],
  knownScopes: ["global"],
  defaultActiveScopes: ["global"],
  revision: (facts) => facts.version,
  descriptors: { file: { label: (value) => `file ${value.id}` } },
  actions: [open],
});

function mount(facts: () => Facts, options: { notice?: boolean; onRefuse?: () => void } = {}) {
  const pbui = createPbui<Values, { name: string }, Verb, Facts>({
    presentation,
    defaultEnvironment: { name: "α" },
    contextFor: () => ({ facts: facts() }),
  });
  const onPerform = vi.fn();
  render(
    <pbui.Provider onPerform={onPerform} {...(options.onRefuse ? { onRefuse: options.onRefuse } : {})}>
      <pbui.Presentation reference={{ type: "file", value: { id: "f1" } }}>f1</pbui.Presentation>
      <pbui.ObjectMenu />
      {options.notice === false ? null : <pbui.RefusalNotice />}
    </pbui.Provider>,
  );
  return { onPerform };
}

afterEach(cleanup);

describe("RefusalNotice", () => {
  test("a stale row is refused and the notice names the row, the subject and the reason", () => {
    const facts = { canOpen: true, version: 1 };
    const { onPerform } = mount(() => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onPerform).not.toHaveBeenCalled();
    const notice = screen.getByRole("alert");
    expect(notice.getAttribute("data-code")).toBe("action-no-longer-available");
    expect(notice.textContent).toContain("“Open” is no longer available on file f1");
    expect(notice.textContent).toContain("locked now");
  });

  test("dismiss clears it; opening a menu again also clears it", () => {
    const facts = { canOpen: true, version: 1 };
    mount(() => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();

    facts.canOpen = true;
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.contextMenu(screen.getByText("f1"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("onRefuse still hears every refusal alongside the notice", () => {
    const facts = { canOpen: true, version: 1 };
    const onRefuse = vi.fn();
    mount(() => ({ ...facts }), { onRefuse });
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(onRefuse).toHaveBeenCalledWith(expect.objectContaining({ code: "action-no-longer-available", label: "Open", because: "locked now" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("a refusal that no notice and no handler observes is warned about, once per refusal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const facts = { canOpen: true, version: 1 };
    mount(() => ({ ...facts }), { notice: false });
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("action-no-longer-available");
    warn.mockRestore();
  });

  test("no warning when the notice is mounted and no handler is given", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const facts = { canOpen: true, version: 1 };
    mount(() => ({ ...facts }));
    fireEvent.contextMenu(screen.getByText("f1"));
    facts.canOpen = false;
    fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
