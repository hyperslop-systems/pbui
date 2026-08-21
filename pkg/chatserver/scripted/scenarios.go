package scripted

import (
	"fmt"
	"strings"

	toolv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/frontendtools/v1"
	"github.com/hyperslop-systems/pbui/pkg/chatserver/demo"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
)

func frontendHumanMode() toolv1.ToolExecutionMode {
	return toolv1.ToolExecutionMode_TOOL_EXECUTION_MODE_FRONTEND_HUMAN
}

func frontendAutoMode() toolv1.ToolExecutionMode {
	return toolv1.ToolExecutionMode_TOOL_EXECUTION_MODE_FRONTEND_AUTO
}

// respond picks a scenario by keyword. The order matters: more specific
// intents first.
func (e *Engine) respond(t *turn) error {
	p := strings.ToLower(t.prompt)
	switch {
	case has(p, "hand this", "hand it", "other agent", "another agent", "ask the other"):
		return e.handoffScenario(t)
	case has(p, "what did i", "trace", "summar", "undo"):
		return e.traceScenario(t)
	case has(p, "program", "counter", "make me a", "build me", "tile that", "tile for", "days of cover", "define an action", "add an action"):
		return e.programScenario(t)
	case has(p, "reorder", "draft"):
		return e.reorderScenario(t)
	case has(p, "compare"):
		return e.compareScenario(t)
	case has(p, "health", "overview", "dashboard"):
		return e.healthScenario(t)
	case has(p, "form", "details"):
		return e.formScenario(t)
	case has(p, "error", "broken", "invalid"):
		return e.errorScenario(t)
	case has(p, "sql", "sellers", "top"):
		return e.sqlScenario(t)
	case has(p, "low", "stock", "eagle", "reorder"):
		return e.lowStockScenario(t)
	case has(p, "explain", "why", "history"):
		return e.explainScenario(t)
	default:
		return e.helpScenario(t)
	}
}

func has(p string, words ...string) bool {
	for _, w := range words {
		if strings.Contains(p, w) {
			return true
		}
	}
	return false
}

func mention(typ, id, label string) string { return fmt.Sprintf("[[%s:%s|%s]]", typ, id, label) }

func productMention(p demo.Product) string { return mention("product", p.ID, p.Name) }

func (e *Engine) helpScenario(t *turn) error {
	text := "I am the inventory assistant for this coin shop, speaking PBUI: every object I name is live. Try one of these:\n" +
		"- \"which gold eagles are low on stock?\" — mentions, a streaming table, next-step verbs\n" +
		"- \"show me the gold eagle health dashboard\" — a composed widget with meters, sparklines and verbs\n" +
		"- \"draft a reorder\" — I will ask you to pick a product (accept mode), then propose an order for approval\n" +
		"- \"compare\" two products you mention or pick\n" +
		"- \"top sellers\" — a tool result projected into a table\n" +
		"- \"reorder details form\" — a form whose fields accept objects\n" +
		"- \"what did I do?\" — I read the verb trace\n" +
		"- \"show an error\" — what a rejected widget looks like\n\n" +
		"For example, " + productMention(demo.Products[0]) + " sits in " + mention("category", "7", "American Gold Eagles") + " and is made of " + mention("metal", "gold", "gold") + ". Right-click either to see its verbs."
	if len(t.refs) > 0 {
		text += fmt.Sprintf("\n\nYou pointed at %d object(s): ", len(t.refs))
		for i, r := range t.refs {
			if i > 0 {
				text += ", "
			}
			text += fmt.Sprintf("[[%s:%s|%s]]", r.Type, r.ID, labelOf(r))
		}
		text += "."
	}
	return t.say(text)
}

func labelOf(r pbuichat.Reference) string {
	for _, k := range []string{"label", "name", "title"} {
		if s, ok := r.Value[k].(string); ok && s != "" {
			return s
		}
	}
	return r.Type + " " + r.ID
}

func (e *Engine) lowStockScenario(t *turn) error {
	low := demo.LowStock()
	var names []string
	for _, p := range low {
		names = append(names, fmt.Sprintf("%s (qty %d, reorder at %d)", productMention(p), p.Qty, p.ReorderAt))
	}
	intro := fmt.Sprintf("%d SKUs are at or below their reorder threshold: %s. Three of them are %s; the last sale was %s two days ago. Thresholds come from %s; quantities from %s.",
		len(low), strings.Join(names, ", "),
		mention("category", "7", "American Gold Eagles"),
		mention("order", "88213", "order 88213"),
		mention("source", "E1", "pricing policy §3"),
		mention("source", "E3", "inventory snapshot"))
	if err := t.say(intro); err != nil {
		return err
	}
	docID := "t-" + t.messageID
	columns := []pbuichat.TableColumn{{Name: "sku", Type: "n"}, {Name: "name", Type: "n"}, {Name: "metal", Type: "n"}, {Name: "qty", Type: "q"}, {Name: "reorder_at", Type: "q"}, {Name: "price", Type: "q"}}
	var rows [][]any
	for _, p := range low {
		rows = append(rows, []any{p.ID, p.Name, p.Metal, p.Qty, p.ReorderAt, p.Price})
	}
	if _, err := t.streamingTable("Low stock", docID, columns, rows); err != nil {
		return err
	}
	next := pbuichat.WidgetDocument{
		"format": pbuichat.WidgetFormat, "schema_version": float64(1), "title": "Next steps", "layout": "stack",
		"children": []any{map[string]any{"kind": "text", "text": "Suggested follow-ups — each chip performs a verb locally, no model round trip:"}},
		"verbs": []any{
			map[string]any{"label": "Filter table to qty < 2", "verb": map[string]any{"kind": "addFilter", "tableId": docID, "field": "qty", "op": "<", "value": "2"}},
			map[string]any{"label": "Sort by price", "verb": map[string]any{"kind": "sortBy", "tableId": docID, "field": "price", "dir": "desc"}},
			map[string]any{"label": "Watch " + low[0].Name, "verb": map[string]any{"kind": "watch", "ref": map[string]any{"type": "product", "id": low[0].ID}}},
			map[string]any{"label": "Draft a reorder", "verb": map[string]any{"kind": "askAgent", "template": "draft a reorder for {0}", "refs": []any{map[string]any{"type": "product", "id": low[0].ID}}}},
		},
	}
	_, err := t.widget(next)
	return err
}

func (e *Engine) healthScenario(t *turn) error {
	if err := t.say("Here is the " + mention("category", "7", "American Gold Eagles") + " health overview, built from " + mention("source", "E2", "last 30 days of orders") + " and " + mention("source", "E3", "today's snapshot") + "."); err != nil {
		return err
	}
	eagles := []demo.Product{}
	totalQty, totalReorder := 0, 0
	for _, p := range demo.Products {
		if p.Category == "7" {
			eagles = append(eagles, p)
			totalQty += p.Qty
			totalReorder += p.ReorderAt
		}
	}
	sales := make([]any, 12)
	for i := range sales {
		sum := 0
		for _, p := range eagles {
			sum += p.Sold30d[i]
		}
		sales[i] = sum
	}
	var worst []any
	for _, p := range eagles {
		worst = append(worst, map[string]any{"type": "product", "id": p.ID, "value": map[string]any{"name": p.Name, "qty": p.Qty}})
	}
	doc := pbuichat.WidgetDocument{
		"format": pbuichat.WidgetFormat, "schema_version": float64(1), "title": "Gold Eagle health", "layout": "stack", "tone": "accent",
		"children": []any{
			map[string]any{"kind": "meter", "label": "stock vs reorder floor", "value": float64(totalQty), "max": float64(totalReorder), "ref": map[string]any{"type": "category", "id": "7"}},
			map[string]any{"kind": "sparkline", "label": "units sold, last 12 periods", "values": sales},
			map[string]any{"kind": "segmented", "label": "stock value by metal", "parts": []any{
				map[string]any{"label": "gold", "value": float64(61), "tone": "accent"},
				map[string]any{"label": "silver", "value": float64(26), "tone": "neutral"},
				map[string]any{"label": "platinum", "value": float64(13), "tone": "positive"},
			}},
			map[string]any{"kind": "stat", "label": "spot gold", "value": "2 298.40", "unit": "USD/oz", "delta": "+0.8 %", "ref": map[string]any{"type": "metal", "id": "gold"}},
			map[string]any{"kind": "refs", "label": "worst first", "refs": worst},
			map[string]any{"kind": "callout", "tone": "warning", "text": "1/10oz AGE 2024 is out of stock; 4 sales per week at this size."},
		},
		"verbs": []any{
			map[string]any{"label": "Watch the category", "verb": map[string]any{"kind": "watch", "ref": map[string]any{"type": "category", "id": "7"}}},
			map[string]any{"label": "Show the low-stock table", "verb": map[string]any{"kind": "askAgent", "template": "which gold eagles are low on stock?", "refs": []any{}}},
			map[string]any{"label": "Reorder now (approver only)", "danger": true, "verb": map[string]any{"kind": "reorder", "productId": "2077"}},
		},
	}
	_, err := t.widget(doc)
	return err
}

func (e *Engine) reorderScenario(t *turn) error {
	var product *demo.Product
	for _, r := range t.refs {
		if r.Type == "product" {
			if p, ok := demo.ProductByID(r.ID); ok {
				product = &p
				break
			}
		}
	}
	if product == nil && t.focus != nil && t.focus.Reference != nil && t.focus.Reference.Type == "product" {
		if p, ok := demo.ProductByID(t.focus.Reference.ID); ok {
			product = &p
		}
	}
	if product == nil {
		if !t.hasHumanTool(pbuichat.ToolAccept) {
			return t.say("I would ask you to pick a product, but this client did not advertise " + pbuichat.ToolAccept + ". Mention a product instead, e.g. " + productMention(demo.Products[2]) + ".")
		}
		if err := t.say("Which product should I draft the reorder for? Click any product on screen — in this message, an earlier one, or a table."); err != nil {
			return err
		}
		result, status, err := t.humanTool(pbuichat.ToolAccept, map[string]any{"types": []any{"product"}, "prompt": "pick the product to reorder"})
		if err != nil {
			return err
		}
		if cancelled, _ := result["cancelled"].(bool); cancelled || status != "success" {
			return t.say("No product picked; nothing drafted.")
		}
		ref := pbuichat.ReferenceFromMap(asMap(result["reference"]))
		if ref == nil || ref.Type != "product" {
			return t.say("That was not a product, so I did not draft anything.")
		}
		p, ok := demo.ProductByID(ref.ID)
		if !ok {
			return t.say(fmt.Sprintf("I do not know product %s.", ref.ID))
		}
		product = &p
	}
	qty := product.ReorderAt*4 - product.Qty
	if qty < 1 {
		qty = product.ReorderAt
	}
	est := float64(qty) * product.Cost
	if err := t.say(fmt.Sprintf("Drafting a reorder for %s: %d units at cost %.2f (est. %.0f USD), based on %d sold in the last 30 days.", productMention(*product), qty, product.Cost, est, sum(product.Sold30d))); err != nil {
		return err
	}
	if !t.hasHumanTool(pbuichat.ToolPropose) {
		return t.say("This client cannot show proposals (" + pbuichat.ToolPropose + " not advertised), so I stop here.")
	}
	result, status, err := t.humanTool(pbuichat.ToolPropose, map[string]any{
		"id":     "reorder-" + product.ID + "-" + t.messageID,
		"title":  "Reorder " + product.Name,
		"body":   fmt.Sprintf("Order %d units from the usual supplier. Rationale: qty %d is below the reorder floor of %d; %d sold in 30 days.", qty, product.Qty, product.ReorderAt, sum(product.Sold30d)),
		"danger": true,
		"fields": []any{
			map[string]any{"label": "product", "value": product.Name},
			map[string]any{"label": "quantity", "value": fmt.Sprintf("%d", qty)},
			map[string]any{"label": "estimated cost", "value": fmt.Sprintf("%.0f USD", est)},
		},
	})
	if err != nil {
		return err
	}
	decision, _ := result["decision"].(string)
	if status != "success" || decision != "approve" {
		return t.say("Not approved — the draft is discarded. The decision is in the trace.")
	}
	log := pbuichat.WidgetDocument{
		"format": pbuichat.WidgetFormat, "schema_version": float64(1), "title": "Reorder submitted", "layout": "stack",
		"children": []any{
			map[string]any{"kind": "log", "entries": []any{
				map[string]any{"level": "info", "text": "proposal approved"},
				map[string]any{"level": "info", "text": fmt.Sprintf("purchase order drafted: %d × %s", qty, product.Name)},
				map[string]any{"level": "info", "text": "supplier notified (demo: no network call)"},
			}},
			map[string]any{"kind": "refs", "label": "objects", "refs": []any{map[string]any{"type": "product", "id": product.ID, "value": map[string]any{"name": product.Name}}}},
		},
	}
	if _, err := t.widget(log); err != nil {
		return err
	}
	return t.say("Approved. I drafted the purchase order for " + productMention(*product) + ".")
}

func (e *Engine) compareScenario(t *turn) error {
	var products []demo.Product
	for _, r := range t.refs {
		if r.Type == "product" {
			if p, ok := demo.ProductByID(r.ID); ok {
				products = append(products, p)
			}
		}
	}
	for len(products) < 2 {
		if !t.hasHumanTool(pbuichat.ToolAccept) {
			return t.say("Mention two products to compare, e.g. " + productMention(demo.Products[0]) + " and " + productMention(demo.Products[3]) + ".")
		}
		which := "first"
		if len(products) == 1 {
			which = "second"
		}
		result, status, err := t.humanTool(pbuichat.ToolAccept, map[string]any{"types": []any{"product"}, "prompt": "pick the " + which + " product to compare"})
		if err != nil {
			return err
		}
		if cancelled, _ := result["cancelled"].(bool); cancelled || status != "success" {
			return t.say("Comparison cancelled.")
		}
		ref := pbuichat.ReferenceFromMap(asMap(result["reference"]))
		if ref == nil {
			return t.say("That was not a product.")
		}
		if p, ok := demo.ProductByID(ref.ID); ok {
			products = append(products, p)
		}
	}
	a, b := products[0], products[1]
	docID := "cmp-" + t.messageID
	doc := pbuichat.WidgetDocument{
		"format": pbuichat.WidgetFormat, "schema_version": float64(1), "title": "Comparison", "layout": "stack",
		"children": []any{
			map[string]any{"kind": "refs", "label": "comparing", "refs": []any{
				map[string]any{"type": "product", "id": a.ID, "value": map[string]any{"name": a.Name}},
				map[string]any{"type": "product", "id": b.ID, "value": map[string]any{"name": b.Name}},
			}},
			map[string]any{"kind": "table", "docId": docID,
				"columns": []any{map[string]any{"name": "measure", "type": "n"}, map[string]any{"name": a.Name, "type": "q"}, map[string]any{"name": b.Name, "type": "q"}},
				"rows": []any{
					[]any{"qty", a.Qty, b.Qty},
					[]any{"reorder_at", a.ReorderAt, b.ReorderAt},
					[]any{"price", a.Price, b.Price},
					[]any{"cost", a.Cost, b.Cost},
					[]any{"margin %", pct(a), pct(b)},
					[]any{"sold 30d", sum(a.Sold30d), sum(b.Sold30d)},
				}},
			map[string]any{"kind": "sparkline", "label": a.Name, "values": toAny(a.Sold30d), "ref": map[string]any{"type": "product", "id": a.ID}},
			map[string]any{"kind": "sparkline", "label": b.Name, "values": toAny(b.Sold30d), "ref": map[string]any{"type": "product", "id": b.ID}},
		},
	}
	if _, err := t.widget(doc); err != nil {
		return err
	}
	return t.say(fmt.Sprintf("%s turns over %d units a month against %d for %s; margins are %.1f %% and %.1f %%.", productMention(a), sum(a.Sold30d), sum(b.Sold30d), productMention(b), pct(a), pct(b)))
}

func (e *Engine) formScenario(t *turn) error {
	doc := pbuichat.WidgetDocument{
		"format": pbuichat.WidgetFormat, "schema_version": float64(1), "title": "Reorder details", "layout": "stack",
		"children": []any{
			map[string]any{"kind": "form", "submitLabel": "Submit", "fields": []any{
				map[string]any{"name": "product", "label": "product", "input": "object", "accepts": []any{"product"}, "required": true},
				map[string]any{"name": "quantity", "label": "quantity", "input": "number", "required": true},
				map[string]any{"name": "priority", "label": "priority", "input": "select", "options": []any{"normal", "rush"}},
				map[string]any{"name": "note", "label": "note", "input": "text"},
			}},
		},
	}
	if _, err := t.widget(doc); err != nil {
		return err
	}
	return t.say("Fill in the form; the product field accepts an object — click “pick” and then click any product on screen.")
}

func (e *Engine) errorScenario(t *turn) error {
	if err := t.say("Here is what happens when I emit a widget the interface rejects: the failure is shown, not swallowed."); err != nil {
		return err
	}
	bad := pbuichat.WidgetDocument{"format": pbuichat.WidgetFormat, "schema_version": float64(1), "title": "Bad widget", "children": []any{map[string]any{"kind": "hologram", "text": "not a kind"}}}
	_, err := t.widget(bad)
	if err == nil {
		return t.say("Unexpectedly, the widget was accepted.")
	}
	return t.say("The interface rejected it: " + strings.TrimPrefix(err.Error(), "invalid widget document: ") + ".")
}

func (e *Engine) sqlScenario(t *turn) error {
	if err := t.say("Running the top-sellers query (" + mention("source", "E2", "sql: orders last 30 days") + ") and projecting the rows into a table:"); err != nil {
		return err
	}
	var rows []any
	for _, p := range demo.Products {
		rows = append(rows, map[string]any{"sku": p.ID, "name": p.Name, "sold": float64(sum(p.Sold30d)), "revenue": float64(sum(p.Sold30d)) * p.Price})
	}
	rule := pbuichat.RowsToTable("sql_query", "rows")
	doc, ok := rule.Project("sql_query", "tc-"+t.messageID, map[string]any{"rows": rows})
	if !ok {
		return t.say("The query returned no rows.")
	}
	if _, err := t.widget(doc); err != nil {
		return err
	}
	return t.say("Right-click a column header to sort or filter; right-click a row to inspect or watch it.")
}

func (e *Engine) explainScenario(t *turn) error {
	p := demo.Products[0]
	for _, r := range t.refs {
		if r.Type == "product" {
			if q, ok := demo.ProductByID(r.ID); ok {
				p = q
				break
			}
		}
	}
	return t.say(fmt.Sprintf("%s has sold %d units in 30 days with a peak of %d; stock is %d against a floor of %d, so it has been below threshold for about a week. Pricing follows %s: spot + 4.9 %% for %s. The last sale was %s.",
		productMention(p), sum(p.Sold30d), peak(p.Sold30d), p.Qty, p.ReorderAt, mention("source", "E1", "pricing policy §3"), mention("metal", p.Metal, p.Metal), mention("order", p.LastOrder, "order "+p.LastOrder)))
}

func (e *Engine) traceScenario(t *turn) error {
	entries := e.plugin.Trace(t.sid, 0, 20)
	if len(entries) == 0 {
		return t.say("The trace is empty: you have not performed any verb yet. Right-click an object and pick something, then ask again.")
	}
	var lines []string
	for _, en := range entries {
		verb := ""
		if en.GetVerb() != nil {
			verb, _ = en.GetVerb().AsMap()["kind"].(string)
		}
		target := ""
		if tg := en.GetTarget(); tg != nil {
			label := tg.GetId()
			if tg.GetValue() != nil {
				if n, ok := tg.GetValue().AsMap()["name"].(string); ok {
					label = n
				}
			}
			target = " on " + mention(tg.GetType(), tg.GetId(), label)
		}
		actor := strings.ToLower(strings.TrimPrefix(en.GetActor().String(), "ACTOR_"))
		lines = append(lines, fmt.Sprintf("- #%d %s performed %s%s (%s)", en.GetSeq(), actor, verb, target, en.GetOutcome()))
	}
	return t.say(fmt.Sprintf("Here is what happened, from the trace (%d entries):\n%s", len(entries), strings.Join(lines, "\n")))
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func sum(in []int) int {
	s := 0
	for _, v := range in {
		s += v
	}
	return s
}

func peak(in []int) int {
	m := 0
	for _, v := range in {
		if v > m {
			m = v
		}
	}
	return m
}

func pct(p demo.Product) float64 {
	if p.Price == 0 {
		return 0
	}
	return float64(int((p.Price-p.Cost)/p.Price*1000)) / 10
}

func toAny(in []int) []any {
	out := make([]any, len(in))
	for i, v := range in {
		out[i] = v
	}
	return out
}

// handoffScenario is the agent-to-agent gesture end to end: find out who else
// is on this workbench, ask the user to approve the exact message, then send
// it. Every refusal along the way is said out loud rather than retried
// silently, because the point of the scenario is to show what the gate does.
func (e *Engine) handoffScenario(t *turn) error {
	if !t.hasTool(pbuichat.ToolConversationList) {
		return t.say("This client has only one conversation — it did not advertise " + pbuichat.ToolConversationList + " — so there is nobody to hand this to.")
	}

	listed, status, err := t.frontendTool(pbuichat.ToolConversationList, map[string]any{})
	if err != nil {
		return err
	}
	if status != "success" {
		return t.say("I could not read the list of conversations.")
	}

	you, _ := listed["you"].(string)
	rows, _ := listed["conversations"].([]any)
	var target map[string]any
	for _, row := range rows {
		entry := asMap(row)
		id, _ := entry["conversationId"].(string)
		connected, _ := entry["connected"].(bool)
		if id == you || !connected {
			continue
		}
		target = entry
		break
	}
	if target == nil {
		return t.say("You only have this conversation open. Start another one — the launcher has a “new conversation” row — and ask me again.")
	}

	targetID, _ := target["conversationId"].(string)
	targetTitle, _ := target["title"].(string)
	message := t.prompt
	if err := t.say(fmt.Sprintf("I can hand this to %s. Sending a message there starts a run, so I will ask you first.",
		mention("conversation", targetID, targetTitle))); err != nil {
		return err
	}

	if !t.hasHumanTool(pbuichat.ToolPropose) {
		return t.say("This client cannot show proposals (" + pbuichat.ToolPropose + " not advertised), so I stop here.")
	}
	proposalID := "handoff-" + t.messageID
	result, status, err := t.humanTool(pbuichat.ToolPropose, map[string]any{
		"id":    proposalID,
		"title": "Hand this to " + targetTitle,
		"body":  "That agent will start a run and answer in its own conversation, not here.",
		"fields": []any{
			// The labels are not decoration: the browser's approval check
			// compares these against what is actually sent, so an approval
			// cannot be reused for a different message or a different agent.
			map[string]any{"label": "to", "value": targetID},
			map[string]any{"label": "message", "value": message},
		},
	})
	if err != nil {
		return err
	}
	decision, _ := result["decision"].(string)
	if status != "success" || decision != "approve" {
		return t.say("Not approved — nothing was sent. The decision is in the trace.")
	}

	sent, status, err := t.frontendTool(pbuichat.ToolConversationSend, map[string]any{
		"conversationId": targetID,
		"prompt":         message,
		"confirmationId": proposalID,
	})
	if err != nil {
		return err
	}
	if ok, _ := sent["ok"].(bool); !ok || status != "success" {
		reason, _ := sent["error"].(string)
		if reason == "" {
			reason = "the send was refused"
		}
		return t.say("I could not send it: " + reason)
	}
	return t.say(fmt.Sprintf("Sent to %s. Its answer lands in that conversation — open it to read the reply.",
		mention("conversation", targetID, targetTitle)))
}
