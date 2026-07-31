package workbench

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// parityFixture is one entry of the cross-language applier corpus in
// packages/workbench-protocol/fixtures/mutations. The TypeScript applier
// (workbench-protocol/client) asserts the same files from its side, so the
// two appliers can only drift by breaking a build (design DR-U5, section
// 5.3 of the PBUI-UNIFY-001 intern guide).
type parityFixture struct {
	Name      string          `json:"name"`
	Document  json.RawMessage `json:"document"`
	Mutation  json.RawMessage `json:"mutation"`
	Expected  json.RawMessage `json:"expected"`
	Error     bool            `json:"error"`
	ErrorCode string          `json:"errorCode"`
}

// TestApplierParityFixtures exercises the pure structural applier
// (applyMutation) directly: the corpus asserts mutation semantics, not the
// full-graph Validate pass, which the TypeScript client does not mirror.
func TestApplierParityFixtures(t *testing.T) {
	t.Parallel()
	dir := filepath.Join("..", "..", "packages", "workbench-protocol", "fixtures", "mutations")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading fixture directory: %v", err)
	}

	count := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		count++
		raw, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			t.Fatalf("reading %s: %v", entry.Name(), err)
		}
		var fixture parityFixture
		if err := json.Unmarshal(raw, &fixture); err != nil {
			t.Fatalf("decoding %s: %v", entry.Name(), err)
		}

		t.Run(fixture.Name, func(t *testing.T) {
			t.Parallel()
			strict := protojson.UnmarshalOptions{DiscardUnknown: false}

			var document Document
			if err := strict.Unmarshal(fixture.Document, &document); err != nil {
				t.Fatalf("decoding fixture document: %v", err)
			}
			var mutation Mutation
			if err := strict.Unmarshal(fixture.Mutation, &mutation); err != nil {
				t.Fatalf("decoding fixture mutation: %v", err)
			}

			output := Clone(&document)
			applyErr := applyMutation(output, &mutation)

			if fixture.Error {
				var validation *ValidationError
				if !errors.As(applyErr, &validation) {
					t.Fatalf("applyMutation() error = %v, want a ValidationError", applyErr)
				}
				if validation.Code != fixture.ErrorCode {
					t.Fatalf("applyMutation() code = %q, want %q", validation.Code, fixture.ErrorCode)
				}
				return
			}

			if applyErr != nil {
				t.Fatalf("applyMutation() error = %v", applyErr)
			}
			var expected Document
			if err := strict.Unmarshal(fixture.Expected, &expected); err != nil {
				t.Fatalf("decoding fixture expected document: %v", err)
			}
			if !proto.Equal(output, &expected) {
				got, _ := protojson.Marshal(output)
				want, _ := protojson.Marshal(&expected)
				t.Fatalf("applied document diverges from fixture\n got: %s\nwant: %s", got, want)
			}
		})
	}

	if count < 10 {
		t.Fatalf("parity corpus has %d fixtures, want at least 10", count)
	}
}
