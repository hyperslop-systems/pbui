/**
 * Programs used three ways: as engine-conformance fixtures, as the seed
 * library the demo ships, and as the worked examples the prompt quotes. One
 * source, three uses — they cannot drift from each other.
 */

/** vm-system's own minimal counter (`docs/plugin-authoring/examples.md`, Example 1), verbatim. */
export const COUNTER_PROGRAM = `
definePlugin(({ ui }) => ({
  id: "minimal-counter",
  title: "Minimal Counter",
  initialState: { value: 0 },
  widgets: {
    main: {
      render({ pluginState }) {
        const value = Number(pluginState?.value ?? 0);
        return ui.column([
          ui.text("Count: " + value),
          ui.row([
            ui.button("-", { onClick: { handler: "decrement" } }),
            ui.button("+", { onClick: { handler: "increment" } }),
          ]),
        ]);
      },
      handlers: {
        increment({ dispatchPluginAction, pluginState }) {
          dispatchPluginAction("state/merge", { value: Number(pluginState?.value ?? 0) + 1 });
        },
        decrement({ dispatchPluginAction, pluginState }) {
          dispatchPluginAction("state/merge", { value: Number(pluginState?.value ?? 0) - 1 });
        },
      },
    },
  },
}));
`;

/** The guide's §5.2 program: a bound object, a ref, a meter, and a product verb. */
export const DAYS_OF_COVER_PROGRAM = `
definePlugin(({ ui }) => ({
  id: "days-of-cover",
  title: "Days of cover",
  bindings: ["product"],
  initialState: { days: 30 },
  widgets: {
    main: {
      render({ pluginState, globalState }) {
        const product = globalState.shared.documents?.product;
        if (!product) return ui.callout({ variant: "warning", text: "bind this tile to a product" });
        const stock = Number(product.value?.stock ?? 0);
        const perDay = Number(product.value?.sold30d ?? 0) / 30;
        const days = Number(pluginState?.days ?? 30);
        const needed = Math.ceil(perDay * days);
        const covered = stock >= needed;
        return ui.column([
          ui.row([ui.ref(product), ui.badge(covered ? "covered" : "short")]),
          ui.input(String(days), { type: "number", placeholder: "days", onChange: { handler: "setDays" } }),
          ui.meter({ fraction: needed === 0 ? 1 : Math.min(1, stock / needed), value: stock + " / " + needed, label: "stock vs need" }),
          ui.button("Draft a reorder", { variant: "destructive", disabled: covered, onClick: { handler: "reorder" } }),
        ]);
      },
      handlers: {
        setDays({ dispatchPluginAction }, args) {
          dispatchPluginAction("state/merge", { days: Number(args?.value ?? 0) });
        },
        reorder({ dispatchVerb, globalState }) {
          const product = globalState.shared.documents?.product;
          if (product) dispatchVerb({ kind: "reorder", productId: product.id });
        },
      },
    },
  },
}));
`;

/** Two widgets, no handlers, no state. */
export const COLUMN_PROGRAM = `
definePlugin(({ ui }) => ({
  id: "column-demo",
  title: "Column Demo",
  widgets: {
    top: { render() { return ui.column([ui.text("top"), ui.text("bottom")]); }, handlers: {} },
    side: { render() { return ui.panel([ui.badge("side")], { title: "aside" }); }, handlers: {} },
  },
}));
`;

/** A render that throws — the error-tile fixture. */
export const BROKEN_RENDER_PROGRAM = `
definePlugin(({ ui }) => ({
  id: "broken",
  title: "Broken",
  widgets: {
    main: {
      render({ globalState }) {
        return ui.text(globalState.shared.documents.product.value.sold.reduce((a, b) => a + b, 0));
      },
      handlers: {},
    },
  },
}));
`;

/** A program that reaches for the DOM; must fail at load under every engine. */
export const DOM_PROGRAM = `
const title = document.title;
definePlugin(({ ui }) => ({ id: "dom", title: "DOM", widgets: { main: { render() { return ui.text(title); }, handlers: {} } } }));
`;

/** A render that returns a node kind no renderer has. */
export const UNKNOWN_KIND_PROGRAM = `
definePlugin(() => ({ id: "unknown", title: "Unknown", widgets: { main: { render() { return { kind: "image", src: "x.png" }; }, handlers: {} } } }));
`;

/** A product reference shaped like the demo world's, for tests and the prompt. */
export const PRODUCT_2049 = {
  type: "product",
  id: "2049",
  value: { name: "1oz American Gold Eagle 2024", stock: 3, reorderPoint: 5, sold30d: 75, metal: "gold" },
};
