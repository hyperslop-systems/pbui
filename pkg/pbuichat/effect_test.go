package pbuichat

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	chatv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/chat/v1"
)

func effectJSON(effectID, conversationID, outcome string) []byte {
	canonical := `{"placementId":"n1"}`
	digest := sha256.Sum256([]byte(canonical))
	return []byte(fmt.Sprintf(`{
		"effectId":%q,
		"invocationKey":"s1/tool-1",
		"actor":"agent",
		"conversationId":%q,
		"effectKind":"tile.close",
		"effectScope":"workbench",
		"canonicalInput":%s,
		"inputDigest":%q,
		"targetIds":["n1"],
		"referenceKeys":[],
		"beforeRevision":"r1",
		"afterRevision":"r2",
		"outcome":%q,
		"occurredAt":"2026-08-25T17:00:00.000Z"
	}`, effectID, conversationID, canonical, hex.EncodeToString(digest[:]), outcome))
}

func TestEffectCommandIsDurableAndIdempotent(t *testing.T) {
	plugin, err := New(Options{Vocabulary: loadDemoVocabulary(t)})
	if err != nil {
		t.Fatal(err)
	}
	cmd, err := EffectCommandFromJSON(effectJSON("effect-1", "s1", "performed"))
	if err != nil {
		t.Fatal(err)
	}
	pub := &fakePub{}
	sid := sessionstream.SessionId("s1")
	command := sessionstream.Command{Name: CommandEffectPerformed, Payload: cmd, SessionId: sid}
	if err := plugin.HandleEffectPerformed(context.Background(), command, nil, pub); err != nil {
		t.Fatal(err)
	}
	if err := plugin.HandleEffectPerformed(context.Background(), command, nil, pub); err != nil {
		t.Fatal(err)
	}
	if len(pub.events) != 1 {
		t.Fatalf("duplicate effect published %d events", len(pub.events))
	}
	entry, ok := pub.events[0].Payload.(*chatv1.TraceEntry)
	if !ok || entry.GetEffect().GetEffectId() != "effect-1" || entry.GetVerb().AsMap()["kind"] != "tile.close" {
		t.Fatalf("effect trace entry: %#v", pub.events[0].Payload)
	}
	timeline, handled, err := plugin.ProjectTimeline(context.Background(), pub.events[0], nil, nil)
	if err != nil || !handled || len(timeline) != 1 || timeline[0].Kind != TimelineEntityTrace {
		t.Fatalf("timeline projection: %#v handled=%v err=%v", timeline, handled, err)
	}
}

func TestEffectCommandRejectsConflictMismatchAndForgedDigest(t *testing.T) {
	plugin, err := New(Options{Vocabulary: loadDemoVocabulary(t)})
	if err != nil {
		t.Fatal(err)
	}
	cmd, err := EffectCommandFromJSON(effectJSON("effect-1", "s1", "performed"))
	if err != nil {
		t.Fatal(err)
	}
	pub := &fakePub{}
	sid := sessionstream.SessionId("s1")
	if err := plugin.HandleEffectPerformed(context.Background(), sessionstream.Command{Name: CommandEffectPerformed, Payload: cmd, SessionId: sid}, nil, pub); err != nil {
		t.Fatal(err)
	}
	conflict, err := EffectCommandFromJSON(effectJSON("effect-1", "s1", "rejected:stale"))
	if err != nil {
		t.Fatal(err)
	}
	if err := plugin.HandleEffectPerformed(context.Background(), sessionstream.Command{Name: CommandEffectPerformed, Payload: conflict, SessionId: sid}, nil, pub); err == nil {
		t.Fatal("expected conflicting effect id to fail")
	}
	wrongSession, err := EffectCommandFromJSON(effectJSON("effect-2", "other", "performed"))
	if err != nil {
		t.Fatal(err)
	}
	if err := plugin.HandleEffectPerformed(context.Background(), sessionstream.Command{Name: CommandEffectPerformed, Payload: wrongSession, SessionId: sid}, nil, pub); err == nil {
		t.Fatal("expected conversation/session mismatch to fail")
	}
	var forgedBody map[string]any
	if err := json.Unmarshal(effectJSON("effect-3", "s1", "performed"), &forgedBody); err != nil {
		t.Fatal(err)
	}
	forgedBody["inputDigest"] = strings.Repeat("0", 64)
	forged, err := json.Marshal(forgedBody)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := EffectCommandFromJSON(forged); err == nil {
		t.Fatal("expected forged digest to fail")
	}
}
