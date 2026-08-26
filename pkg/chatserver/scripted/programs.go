package scripted

import (
	"fmt"
	"strings"

	"github.com/hyperslop-systems/pbui/pkg/chatserver/demo"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
)

// counterProgram is vm-system's minimal counter, the smallest program that
// has state. The days-of-cover program comes from the prompt's own worked
// example (pbuichat.SandboxExampleProgram), so the scripted engine and the
// model are taught the same source.
const counterProgram = `definePlugin(({ ui }) => ({
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
}))`

// programScenario is the sandbox gesture without a model: test the program,
// store and open it, and — when asked — put an action for it into the
// product menu. Every step is the same bridged frontend tool a real runtime
// would call, so the browser, the trace and the tool-call entities are
// exercised end to end with no credentials.
func (e *Engine) programScenario(t *turn) error {
	for _, name := range []string{pbuichat.ToolSandboxTest, pbuichat.ToolSandboxCreateApp} {
		if !t.hasHumanTool(name) {
			return t.say("This client did not advertise " + name + ", so I cannot write programs here.")
		}
	}
	p := strings.ToLower(t.prompt)
	wantsAction := has(p, "action", "menu")

	// Which program, and for which product.
	title, source, bindings, documents := "Minimal Counter", counterProgram, []any{}, map[string]any{}
	product := t.productFromContext()
	if has(p, "cover", "stock", "reorder", "product") || product != nil {
		if product == nil {
			p := demo.Products[0]
			product = &p
		}
		title, source = "Days of cover · "+product.ID, pbuichat.SandboxExampleProgram
		bindings = []any{"product"}
		documents = map[string]any{"product": product.ID}
	}

	if err := t.say("Let me try the program first, before it reaches your screen."); err != nil {
		return err
	}
	tested, status, err := t.frontendTool(pbuichat.ToolSandboxTest, map[string]any{
		"source":    source,
		"documents": documents,
		"events":    []any{},
	})
	if err != nil {
		return err
	}
	if ok, _ := tested["ok"].(bool); status != "success" || !ok {
		return t.say(fmt.Sprintf("The program did not run: %v (phase %v). I would fix it and try again.", tested["error"], tested["phase"]))
	}
	nodes, _ := tested["nodeCount"].(float64)
	if err := t.say(fmt.Sprintf("It renders (%d nodes). Storing it and opening it beside the chat.", int(nodes))); err != nil {
		return err
	}

	created, status, err := t.frontendTool(pbuichat.ToolSandboxCreateApp, map[string]any{
		"title":     title,
		"source":    source,
		"bindings":  bindings,
		"documents": documents,
		"open":      true,
	})
	if err != nil {
		return err
	}
	if ok, _ := created["ok"].(bool); status != "success" || !ok {
		return t.say(fmt.Sprintf("Storing the program failed: %v", created["error"]))
	}
	programID, _ := created["programId"].(string)
	placementID, _ := created["placementId"].(string)
	where := "in a new tile"
	if placementID != "" {
		where = "in " + mention("tile", placementID, "its tile")
	}
	if warnings, ok := created["warnings"].([]any); ok && len(warnings) > 0 {
		where = fmt.Sprintf("but not opened: %v", warnings[0])
	}
	text := fmt.Sprintf("Done — %s is %s.", mention("program", programID, title), where)
	if product != nil {
		text += " It reads " + productMention(*product) + "'s stock and 30-day sales through its `product` binding; type a number of days and the meter compares stock to need, and the button performs the same *Draft a reorder* verb the product menu offers."
	} else {
		text += " The buttons change the program's own state through `state/merge` intents; nothing else can."
	}
	if err := t.say(text); err != nil {
		return err
	}

	if !wantsAction || !t.hasHumanTool(pbuichat.ToolSandboxDefineAction) {
		return nil
	}
	label := "Days of cover"
	types := []any{"product"}
	if product == nil {
		label, types = "Open the counter", []any{"product", "metal"}
	}
	defined, status, err := t.frontendTool(pbuichat.ToolSandboxDefineAction, map[string]any{
		"label":       label,
		"types":       types,
		"behaviour":   map[string]any{"kind": "openProgram", "programId": programID},
		"description": "opens the program bound to this object",
	})
	if err != nil {
		return err
	}
	if ok, _ := defined["ok"].(bool); status != "success" || !ok {
		return t.say(fmt.Sprintf("I could not add the action: %v", defined["error"]))
	}
	actionID, _ := defined["actionId"].(string)
	return t.say(fmt.Sprintf("And %s is now in the menu of every %s — right-click one and you will find it. It is saved in this browser, so it will be there tomorrow.",
		mention("action", actionID, label), strings.Join(stringsOf(types), " and ")))
}

// productFromContext is the product the user pointed at, if any: a typed
// reference on the message first, then the focus.
func (t *turn) productFromContext() *demo.Product {
	for _, r := range t.refs {
		if r.Type == "product" {
			if p, ok := demo.ProductByID(r.ID); ok {
				return &p
			}
		}
	}
	if t.focus != nil && t.focus.Reference != nil && t.focus.Reference.Type == "product" {
		if p, ok := demo.ProductByID(t.focus.Reference.ID); ok {
			return &p
		}
	}
	return nil
}

func stringsOf(values []any) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		out = append(out, fmt.Sprint(v))
	}
	return out
}
