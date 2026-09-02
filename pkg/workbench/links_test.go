package workbench

import (
	"context"
	"strings"
	"testing"

	"google.golang.org/protobuf/types/known/structpb"
)

func linksPayload(t *testing.T, body map[string]any) *DocumentPayload {
	t.Helper()
	s, err := structpb.NewStruct(body)
	if err != nil {
		t.Fatal(err)
	}
	return &DocumentPayload{Id: "pbui.links", Format: LinksFormat, SchemaVersion: 1, Body: s}
}

func TestLinksValidatorAcceptsEveryTermKindAndIdentity(t *testing.T) {
	body := map[string]any{
		"bindings": map[string]any{
			"v-a/order":    map[string]any{"kind": "follow", "source": "v-east/order", "linkId": "L1"},
			"v-b/order":    map[string]any{"kind": "hold", "reference": map[string]any{"type": "order", "value": map[string]any{"id": "1042"}}, "suspended": map[string]any{"kind": "ambient", "key": "workspace.order"}},
			"v-c/customer": map[string]any{"kind": "derived", "relationId": "order.customer", "linkId": "L2", "source": map[string]any{"kind": "follow", "source": "v-east/order", "linkId": "L2"}},
			"v-d/order":    map[string]any{"kind": "unresolved", "diagnostic": map[string]any{"code": "unlinked", "message": "cut"}},
			"v-e/subject":  map[string]any{"kind": "constant", "reference": map[string]any{"type": "product", "value": "2049"}},
		},
		"identity": []any{map[string]any{"linkId": "I1", "left": "v-east/selection", "right": "v-plot/selection", "mergePolicy": "prefer-left"}},
		"classes":  []any{map[string]any{"id": "σ1", "members": []any{"v-east/selection", "v-plot/selection"}, "fingerprint": "valueType=datum"}},
		"history":  map[string]any{"v-east/selection": nil, "v-plot/selection": map[string]any{"type": "datum", "value": []any{}}},
	}
	if err := (LinksDocumentValidator{}).ValidateDocument(context.Background(), linksPayload(t, body)); err != nil {
		t.Fatalf("expected a valid payload, got %v", err)
	}
}

func TestLinksValidatorRefusesBadShapes(t *testing.T) {
	cases := map[string]map[string]any{
		"unknown term kind":       {"bindings": map[string]any{"v-a/order": map[string]any{"kind": "melt"}}},
		"not a port id":           {"bindings": map[string]any{"order": map[string]any{"kind": "ambient", "key": "k"}}},
		"follow without linkId":   {"bindings": map[string]any{"v-a/order": map[string]any{"kind": "follow", "source": "v-b/order"}}},
		"hold without suspended":  {"bindings": map[string]any{"v-a/order": map[string]any{"kind": "hold", "reference": map[string]any{"type": "order", "value": 1}}}},
		"identity merge policy":   {"identity": []any{map[string]any{"linkId": "I1", "left": "a/x", "right": "b/y", "mergePolicy": "coin-toss"}}},
		"class of one":            {"classes": []any{map[string]any{"id": "σ1", "members": []any{"a/x"}, "fingerprint": "f"}}},
		"history not a reference": {"history": map[string]any{"a/x": "nope"}},
		"unknown field":           {"values": map[string]any{}},
	}
	for name, body := range cases {
		err := (LinksDocumentValidator{}).ValidateDocument(context.Background(), linksPayload(t, body))
		if err == nil || !strings.HasPrefix(err.Error(), "pbui.links:") {
			t.Errorf("%s: expected a pbui.links error, got %v", name, err)
		}
	}
}

func TestLinksValidatorHandsOtherFormatsToNext(t *testing.T) {
	other := &DocumentPayload{Id: "d", Format: "test.doc", SchemaVersion: 1}
	if err := (LinksDocumentValidator{}).ValidateDocument(context.Background(), other); err != nil {
		t.Fatalf("no Next: other formats accepted, got %v", err)
	}
	// With a Next, a foreign format is Next's decision — the test stub only knows graphic documents.
	err := (LinksDocumentValidator{Next: testDocumentValidator{}}).ValidateDocument(context.Background(), other)
	if err == nil || err.Error() != "unsupported graphic document" {
		t.Fatalf("expected Next's refusal, got %v", err)
	}
}
