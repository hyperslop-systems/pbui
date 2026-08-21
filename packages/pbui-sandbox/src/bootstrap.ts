/**
 * The shim every engine evaluates BEFORE a program's source. It defines the
 * three things a program sees — `definePlugin`, the `ui.*` helpers handed to
 * its factory, and the handler context — and one thing the host calls,
 * `__pluginHost`, with `getMeta()`, `render()` and `event()`.
 *
 * Ported from vm-system `frontend/packages/plugin-runtime/src/runtimeService.ts`
 * (BOOTSTRAP_SOURCE, lines 13-127 at 37bd440). Differences, all deliberate:
 *
 *   - `ui.counter` is gone (no pbui atom; compose it from row/button/text);
 *   - `ui.select`, `ui.meter`, `ui.sparkline`, `ui.callout`, `ui.ref` are new;
 *   - `dispatchSharedAction` is gone and `dispatchVerb` is new — a program's
 *     only effect beyond its own state is a verb the product router performs;
 *   - `getMeta()` also reports `bindings`.
 *
 * It is a string, not code, so both engines evaluate exactly the same text.
 * It declares `__pluginHost` as a `const` and does NOT touch `globalThis`:
 * each engine appends its own epilogue (`return __pluginHost;` under eval,
 * `globalThis.__pluginHost = __pluginHost;` under QuickJS). That is what lets
 * the eval engine shadow `globalThis` to `undefined` without breaking the shim.
 */
export const BOOTSTRAP_VERSION = 1;

export const BOOTSTRAP_SOURCE = String.raw`
const __ui = {
  text(content, props) {
    const node = { kind: "text", text: String(content) };
    if (props && typeof props === "object") node.props = props;
    return node;
  },
  badge(text, props) {
    const node = { kind: "badge", text: String(text) };
    if (props && typeof props === "object") node.props = props;
    return node;
  },
  button(label, props = {}) {
    return { kind: "button", props: { label: String(label), ...props } };
  },
  input(value, props = {}) {
    return { kind: "input", props: { value: String(value ?? ""), ...props } };
  },
  select(value, props = {}) {
    const { options, ...rest } = props;
    return { kind: "select", props: { value: String(value ?? ""), options: Array.isArray(options) ? options : [], ...rest } };
  },
  row(children = []) {
    return { kind: "row", children: Array.isArray(children) ? children : [] };
  },
  column(children = []) {
    return { kind: "column", children: Array.isArray(children) ? children : [] };
  },
  panel(children = [], props) {
    const node = { kind: "panel", children: Array.isArray(children) ? children : [] };
    if (props && typeof props === "object") node.props = props;
    return node;
  },
  table(rows = [], props = {}) {
    return {
      kind: "table",
      props: {
        headers: Array.isArray(props.headers) ? props.headers.map(String) : [],
        rows: Array.isArray(rows) ? rows : [],
      },
    };
  },
  meter(props = {}) {
    return { kind: "meter", props: { ...props, fraction: Number(props.fraction ?? 0) } };
  },
  sparkline(props = {}) {
    return { kind: "sparkline", props: { ...props, points: Array.isArray(props.points) ? props.points.map(Number) : [] } };
  },
  callout(props = {}) {
    return { kind: "callout", props: { ...props, text: String(props.text ?? "") } };
  },
  ref(reference, label) {
    const node = { kind: "ref", props: { reference } };
    if (label !== undefined) node.props.label = String(label);
    return node;
  },
};

let __plugin = null;
let __dispatchIntents = [];

function definePlugin(factory) {
  if (typeof factory !== "function") {
    throw new Error("definePlugin requires a factory function");
  }
  if (__plugin !== null) {
    throw new Error("definePlugin must be called exactly once");
  }
  __plugin = factory({ ui: __ui });
}

const __pluginHost = {
  getMeta() {
    if (!__plugin || typeof __plugin !== "object") {
      throw new Error("Plugin did not register via definePlugin");
    }
    if (!__plugin.widgets || typeof __plugin.widgets !== "object") {
      throw new Error("Plugin widgets must be an object");
    }
    const bindings = Array.isArray(__plugin.bindings)
      ? __plugin.bindings.filter((b) => typeof b === "string" && b.length > 0)
      : [];
    return {
      declaredId: typeof __plugin.id === "string" ? __plugin.id : undefined,
      title: String(__plugin.title ?? "Untitled program"),
      description: typeof __plugin.description === "string" ? __plugin.description : undefined,
      initialState: __plugin.initialState,
      bindings,
      widgets: Object.keys(__plugin.widgets),
    };
  },

  render(widgetId, pluginState, globalState) {
    const widget = __plugin && __plugin.widgets ? __plugin.widgets[widgetId] : undefined;
    if (!widget || typeof widget.render !== "function") {
      throw new Error("Widget not found or render() is missing: " + String(widgetId));
    }
    return widget.render({ pluginState, globalState });
  },

  event(widgetId, handlerName, args, pluginState, globalState) {
    const widget = __plugin && __plugin.widgets ? __plugin.widgets[widgetId] : undefined;
    if (!widget) {
      throw new Error("Widget not found: " + String(widgetId));
    }
    const handler = widget.handlers ? widget.handlers[handlerName] : undefined;
    if (typeof handler !== "function") {
      throw new Error("Handler not found: " + String(handlerName));
    }

    __dispatchIntents = [];

    const dispatchPluginAction = (actionType, payload) => {
      __dispatchIntents.push({ scope: "plugin", actionType: String(actionType), payload });
    };

    const dispatchVerb = (verb) => {
      if (!verb || typeof verb !== "object" || typeof verb.kind !== "string") {
        throw new Error("dispatchVerb needs an object with a string kind");
      }
      __dispatchIntents.push({ scope: "verb", verb });
    };

    handler({ pluginState, globalState, dispatchPluginAction, dispatchVerb }, args);

    return __dispatchIntents.slice();
  },
};
`;
