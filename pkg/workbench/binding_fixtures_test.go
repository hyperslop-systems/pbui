package workbench

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"google.golang.org/protobuf/encoding/protojson"
)

// The binding/catalog fixtures shared with the TypeScript core (design doc
// 04 §9.8, §12.5): contracts/workbench/v1/catalogs plus binding-valid and
// binding-invalid. packages/workbench-core/src/bindingFixtures.test.ts loads
// the same files; the two validators may differ in prose but not in the
// first diagnostic's code and path.

type bindingFixtureCatalog struct {
	Apps []struct {
		ID        string `json:"id"`
		Singleton bool   `json:"singleton"`
		Bindings  map[string]struct {
			Required bool     `json:"required"`
			Formats  []string `json:"formats"`
		} `json:"bindings"`
		AdditionalBindings *struct {
			Formats []string `json:"formats"`
		} `json:"additionalBindings"`
	} `json:"apps"`
}

type bindingFixture struct {
	Name     string          `json:"name"`
	Catalog  string          `json:"catalog"`
	Document json.RawMessage `json:"document"`
	Expected struct {
		OK   bool   `json:"ok"`
		Code string `json:"code"`
		Path string `json:"path"`
	} `json:"expected"`
}

// acceptAnyDocument stands in for a host's payload validators: the fixtures
// assert binding rules, not payload contents.
type acceptAnyDocument struct{}

func (acceptAnyDocument) ValidateDocument(_ context.Context, _ *DocumentPayload) error { return nil }

func loadBindingCatalog(t *testing.T, root, name string) ApplicationCatalog {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(root, "catalogs", name+".json"))
	if err != nil {
		t.Fatalf("reading catalog %s: %v", name, err)
	}
	var decoded bindingFixtureCatalog
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("decoding catalog %s: %v", name, err)
	}
	catalog := testCatalog{}
	for _, app := range decoded.Apps {
		rules := map[string]BindingRule{}
		for binding, rule := range app.Bindings {
			rules[binding] = BindingRule{Required: rule.Required, Formats: rule.Formats}
		}
		descriptor := ApplicationDescriptor{ID: app.ID, Singleton: app.Singleton, DocumentBindings: rules}
		if app.AdditionalBindings != nil {
			descriptor.AdditionalBindings = &BindingRule{Formats: app.AdditionalBindings.Formats}
		}
		catalog[app.ID] = descriptor
	}
	return catalog
}

func TestBindingFixtures(t *testing.T) {
	t.Parallel()
	root := filepath.Join("..", "..", "contracts", "workbench", "v1")
	for _, dir := range []string{"binding-valid", "binding-invalid"} {
		entries, err := os.ReadDir(filepath.Join(root, dir))
		if err != nil {
			t.Fatalf("reading %s: %v", dir, err)
		}
		if len(entries) == 0 {
			t.Fatalf("no fixtures under %s", dir)
		}
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}
			raw, err := os.ReadFile(filepath.Join(root, dir, entry.Name()))
			if err != nil {
				t.Fatalf("reading %s: %v", entry.Name(), err)
			}
			var fixture bindingFixture
			if err := json.Unmarshal(raw, &fixture); err != nil {
				t.Fatalf("decoding %s: %v", entry.Name(), err)
			}
			t.Run(dir+"/"+fixture.Name, func(t *testing.T) {
				t.Parallel()
				var document Document
				if err := (protojson.UnmarshalOptions{DiscardUnknown: false}).Unmarshal(fixture.Document, &document); err != nil {
					t.Fatalf("decoding fixture document: %v", err)
				}
				deps := Dependencies{Applications: loadBindingCatalog(t, root, fixture.Catalog), Documents: acceptAnyDocument{}}
				err := Validate(context.Background(), &document, deps, DefaultLimits)
				if fixture.Expected.OK {
					if err != nil {
						t.Fatalf("expected the document to validate, got %v", err)
					}
					return
				}
				var verr *ValidationError
				if !errors.As(err, &verr) {
					t.Fatalf("expected a ValidationError, got %v", err)
				}
				if verr.Code != fixture.Expected.Code || verr.Path != fixture.Expected.Path {
					t.Fatalf("expected %s at %s, got %s at %s (%v)", fixture.Expected.Code, fixture.Expected.Path, verr.Code, verr.Path, err)
				}
			})
		}
	}
}
