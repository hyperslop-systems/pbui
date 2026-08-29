import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { SelectionSnapshot } from "../../presentation/actions/types";
import type { ResolvedHelpItem } from "../../presentation/help/types";
import {
  actionsHelp,
  builtinHelpItems,
  fieldsHelp,
  markdownHelp,
  noticeHelp,
  textHelp,
} from "./builtins";
import { HelpContent } from "./HelpContent";
import { createHelpRendererRegistry, defineHelpItem } from "./registry";
import type { HelpRendererProps } from "./registry";

afterEach(cleanup);

/** Design doc §18 renderer tests: built-ins, registry, custom, unknown kinds. */

type Facts = { owner: string };

const subject = { type: "file", value: { id: "f1" } } as const;

const snapshot: SelectionSnapshot<Facts> = {
  revision: 1,
  scopes: ["global"],
  modes: new Set(),
  capabilities: new Set(),
  product: { owner: "me" },
};

const provenance = {
  ruleId: "test.rule",
  declaredType: "file",
  concreteType: "file",
  typeDistance: 0,
  scope: "global",
  scopeIndex: 0,
  priority: 0,
};

function resolved<Payload>(item: { id: string; kind: string; title?: string; payload: Payload }) {
  return { ...item, provenance } as ResolvedHelpItem;
}

function renderItems(items: readonly ResolvedHelpItem[], registry = defaultRegistry) {
  return render(
    <HelpContent
      resolution={{ items, diagnostics: [], snapshotRevision: 1, registryVersion: 1 }}
      subject={subject}
      snapshot={snapshot}
      renderers={registry}
    />,
  );
}

const defaultRegistry = createHelpRendererRegistry(builtinHelpItems);

describe("renderer registry", () => {
  test("duplicate kinds fail construction", () => {
    expect(() => createHelpRendererRegistry([textHelp, textHelp])).toThrow(
      /duplicate help renderer kind "help\.text"/,
    );
  });

  test("create() stamps the definition's kind so it cannot be misspelled", () => {
    const item = markdownHelp.create({ id: "x", payload: { markdown: "hi" } });
    expect(item.kind).toBe("help.markdown");
  });

  test("an unknown kind warns and omits the item without crashing the surface", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderItems([
      resolved({ id: "mystery", kind: "product.unregistered", payload: {} }),
      resolved({ id: "known", kind: "help.text", payload: { text: "still here" } }),
    ]);
    expect(container.textContent).toContain("still here");
    expect(container.querySelector('[data-help-kind="product.unregistered"]')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"product.unregistered"'));
    warn.mockRestore();
  });
});

describe("built-in renderers", () => {
  test("text renders one paragraph under its part", () => {
    const { container } = renderItems([
      resolved(textHelp.create({ id: "t", payload: { text: "plain words" } })),
    ]);
    expect(container.querySelector('[data-part="help-text"]')?.textContent).toBe("plain words");
  });

  test("markdown renders through the bounded subset", () => {
    const { container } = renderItems([
      resolved(markdownHelp.create({ id: "m", payload: { markdown: "a **field**" } })),
    ]);
    expect(container.querySelector('[data-part="help-markdown"] strong')?.textContent).toBe(
      "field",
    );
  });

  test("fields render as a description list of label/value pairs", () => {
    const { container } = renderItems([
      resolved(
        fieldsHelp.create({
          id: "f",
          payload: {
            fields: [
              { label: "Type", value: "number" },
              { label: "Target", value: "Prices" },
            ],
          },
        }),
      ),
    ]);
    const dl = container.querySelector('dl[data-part="help-fields"]');
    expect(dl?.querySelectorAll("dt")).toHaveLength(2);
    expect(dl?.textContent).toContain("Type");
    expect(dl?.textContent).toContain("Prices");
  });

  test("notice carries its tone as data and its message as text", () => {
    const { container } = renderItems([
      resolved(
        noticeHelp.create({
          id: "n",
          payload: { tone: "warning", message: "progress is stale" },
        }),
      ),
    ]);
    const notice = container.querySelector('[data-part="help-notice"]');
    expect(notice?.getAttribute("data-tone")).toBe("warning");
    expect(notice?.textContent).toBe("progress is stale");
  });

  test("actions render resolved labels and unavailable reasons, informationally", () => {
    const { container } = renderItems([
      resolved(
        actionsHelp.create({
          id: "a",
          payload: {
            actions: [
              { action: "file.open", label: "Open", danger: false, status: { kind: "available" } },
              {
                action: "file.delete",
                label: "Delete",
                danger: true,
                status: { kind: "unavailable", because: "this file is protected" },
              },
            ],
          },
        }),
      ),
    ]);
    const rows = container.querySelectorAll('[data-part="help-action"]');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.textContent).toContain("this file is protected");
    expect(rows[1]?.getAttribute("data-danger")).toBe("true");
    // Informational v1: nothing performable in the card.
    expect(container.querySelector("button")).toBeNull();
  });

  test("an item title renders as a header part", () => {
    const { container } = renderItems([
      resolved(textHelp.create({ id: "t", title: "Current context", payload: { text: "x" } })),
    ]);
    expect(container.querySelector('[data-part="help-title"]')?.textContent).toBe(
      "Current context",
    );
  });
});

describe("custom renderers", () => {
  interface SummaryPayload {
    name: string;
    target: string;
  }

  function SummaryHelp({ item }: HelpRendererProps<SummaryPayload>) {
    return (
      <div data-part="help-field-summary">
        <strong>{item.payload.name}</strong> → {item.payload.target} (via{" "}
        {item.provenance.ruleId})
      </div>
    );
  }

  const summaryHelp = defineHelpItem<SummaryPayload>("demo.field-summary", SummaryHelp);

  test("a custom typed renderer receives its payload and provenance", () => {
    const registry = createHelpRendererRegistry([...builtinHelpItems, summaryHelp]);
    const { container } = renderItems(
      [
        resolved(
          summaryHelp.create({ id: "s", payload: { name: "price", target: "Prices chart" } }),
        ),
      ],
      registry,
    );
    const summary = container.querySelector('[data-part="help-field-summary"]');
    expect(summary?.textContent).toBe("price → Prices chart (via test.rule)");
  });
});
