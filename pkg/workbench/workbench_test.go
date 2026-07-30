package workbench

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	workbenchv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/workbench/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/structpb"
)

type testCatalog map[string]ApplicationDescriptor

func (c testCatalog) LookupApplication(_ context.Context, id string) (ApplicationDescriptor, bool) {
	app, ok := c[id]
	return app, ok
}

type testDocumentValidator struct{}

func (testDocumentValidator) ValidateDocument(_ context.Context, document *DocumentPayload) error {
	if document.Format != "datadrop.gog.document" || document.SchemaVersion != 1 {
		return errors.New("unsupported graphic document")
	}
	if document.Body == nil || document.Body.Fields["name"] == nil {
		return errors.New("graphic document body requires name")
	}
	return nil
}

func testDependencies() Dependencies {
	return Dependencies{
		Applications: testCatalog{
			"launcher": {ID: "launcher", DocumentBindings: map[string]BindingRule{}},
			"chart": {
				ID:               "chart",
				DocumentBindings: map[string]BindingRule{"primary": {Required: true}},
			},
			"table": {
				ID:               "table",
				DocumentBindings: map[string]BindingRule{"primary": {Required: true}},
			},
			"sources": {ID: "sources", Singleton: true, DocumentBindings: map[string]BindingRule{}},
		},
		Documents: testDocumentValidator{},
	}
}

func graphicDocument(t *testing.T, id string) *DocumentPayload {
	t.Helper()
	body, err := structpb.NewStruct(map[string]any{
		"name":       "Mass and yield",
		"sources":    map[string]any{},
		"transforms": map[string]any{},
		"views":      map[string]any{},
		"rootView":   "root",
		"parameters": map[string]any{},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &DocumentPayload{
		Id: id, Format: "datadrop.gog.document", SchemaVersion: 1, Body: body,
	}
}

func validDocument(t *testing.T) *Document {
	t.Helper()
	title := "Mass and yield"
	return &Document{
		Format:        Format,
		SchemaVersion: SchemaVersion,
		Id:            "workbench-1",
		Name:          "Production",
		Workspaces: []*Workspace{
			{Id: "workspace-a", Name: "Overview", Tree: leafNode("placement-a", "view-chart")},
			{Id: "workspace-b", Name: "Detail", Tree: leafNode("placement-b", "view-chart")},
		},
		Views: map[string]*AppView{
			"view-chart": {
				Id: "view-chart", AppId: "chart",
				Documents: map[string]string{"primary": "document-1"}, Title: &title,
			},
			"view-launcher": {
				Id: "view-launcher", AppId: "launcher", Documents: map[string]string{},
			},
		},
		ViewOrder: []string{"view-chart", "view-launcher"},
		Documents: map[string]*DocumentPayload{
			"document-1": graphicDocument(t, "document-1"),
		},
	}
}

func TestSharedFixtures(t *testing.T) {
	t.Parallel()
	root := filepath.Join("..", "..", "contracts", "workbench", "v1")
	valid, err := os.ReadFile(filepath.Join(root, "valid", "linked-view.json"))
	if err != nil {
		t.Fatal(err)
	}
	var document Document
	if err := (protojson.UnmarshalOptions{DiscardUnknown: false}).Unmarshal(valid, &document); err != nil {
		t.Fatal(err)
	}
	if err := Validate(context.Background(), &document, testDependencies(), DefaultLimits); err != nil {
		t.Fatalf("valid shared fixture: %v", err)
	}

	damaged, err := os.ReadFile(filepath.Join(root, "invalid", "view-key-mismatch.json"))
	if err != nil {
		t.Fatal(err)
	}
	document.Reset()
	if err := (protojson.UnmarshalOptions{DiscardUnknown: false}).Unmarshal(damaged, &document); err != nil {
		t.Fatal(err)
	}
	err = Validate(context.Background(), &document, testDependencies(), DefaultLimits)
	var validation *ValidationError
	if !errors.As(err, &validation) || validation.Code != "id_mismatch" {
		t.Fatalf("invalid shared fixture error = %v, want id_mismatch", err)
	}
}

func TestValidateAcceptsLinkedViewAcrossWorkspaces(t *testing.T) {
	t.Parallel()
	if err := Validate(context.Background(), validDocument(t), testDependencies(), DefaultLimits); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestValidateRejectsSecondLogicalSingletonView(t *testing.T) {
	t.Parallel()
	document := validDocument(t)
	document.Views["sources-1"] = &AppView{Id: "sources-1", AppId: "sources", Documents: map[string]string{}}
	document.Views["sources-2"] = &AppView{Id: "sources-2", AppId: "sources", Documents: map[string]string{}}
	document.ViewOrder = append(document.ViewOrder, "sources-1", "sources-2")

	err := Validate(context.Background(), document, testDependencies(), DefaultLimits)
	var validation *ValidationError
	if !errors.As(err, &validation) || validation.Code != "duplicate_singleton" {
		t.Fatalf("Validate() error = %v, want duplicate_singleton", err)
	}
}

func TestApplyMutationsCreatesIndependentAndLinkedPlacements(t *testing.T) {
	t.Parallel()
	document := validDocument(t)
	mutations := []*Mutation{
		{Body: &workbenchv1.Mutation_ViewClone{ViewClone: &workbenchv1.ViewClone{
			SourceViewId: "view-chart",
			NewViewId:    "view-copy",
			TitleChange:  &workbenchv1.ViewClone_SetTitle{SetTitle: "Mass and yield (copy)"},
		}}},
		{Body: &workbenchv1.Mutation_PlacementSplit{PlacementSplit: &workbenchv1.PlacementSplit{
			WorkspaceId: "workspace-a", PlacementId: "placement-a",
			Direction: workbenchv1.Direction_DIRECTION_ROW, Ratio: 0.5,
			SplitId: "split-independent", NewPlacement: leafNode("placement-copy", "view-copy"),
			Place: workbenchv1.PlacementPosition_PLACEMENT_POSITION_AFTER,
		}}},
		{Body: &workbenchv1.Mutation_PlacementSplit{PlacementSplit: &workbenchv1.PlacementSplit{
			WorkspaceId: "workspace-b", PlacementId: "placement-b",
			Direction: workbenchv1.Direction_DIRECTION_COLUMN, Ratio: 0.5,
			SplitId: "split-linked", NewPlacement: leafNode("placement-linked", "view-chart"),
			Place: workbenchv1.PlacementPosition_PLACEMENT_POSITION_AFTER,
		}}},
	}

	output, err := ApplyMutations(context.Background(), document, mutations, testDependencies(), DefaultLimits)
	if err != nil {
		t.Fatalf("ApplyMutations() error = %v", err)
	}
	if output.Views["view-copy"].Documents["primary"] != "document-1" {
		t.Fatal("independent view did not preserve the document binding")
	}
	if countViewPlacements(output, "view-chart") != 3 {
		t.Fatalf("linked view placement count = %d, want 3", countViewPlacements(output, "view-chart"))
	}
	if countViewPlacements(output, "view-copy") != 1 {
		t.Fatalf("independent view placement count = %d, want 1", countViewPlacements(output, "view-copy"))
	}
	if countViewPlacements(document, "view-chart") != 2 {
		t.Fatal("input document was mutated")
	}
}

func TestClosePlacementKeepsSharedView(t *testing.T) {
	t.Parallel()
	document := validDocument(t)
	document.Workspaces[1].Tree = &Node{
		Id: "split-b",
		Body: &workbenchv1.Node_Split{Split: &workbenchv1.Split{
			Direction: workbenchv1.Direction_DIRECTION_ROW,
			Ratio:     0.5,
			A:         leafNode("placement-b", "view-chart"),
			B:         leafNode("placement-launcher", "view-launcher"),
		}},
	}
	output, err := ApplyMutations(context.Background(), document, []*Mutation{
		{Body: &workbenchv1.Mutation_PlacementClose{PlacementClose: &workbenchv1.PlacementClose{
			WorkspaceId: "workspace-b", PlacementId: "placement-b",
		}}},
	}, testDependencies(), DefaultLimits)
	if err != nil {
		t.Fatalf("ApplyMutations() error = %v", err)
	}
	if _, exists := output.Views["view-chart"]; !exists {
		t.Fatal("closing one placement deleted the shared view")
	}
	if countViewPlacements(output, "view-chart") != 1 {
		t.Fatalf("shared view placement count = %d, want 1", countViewPlacements(output, "view-chart"))
	}
}

func TestDeleteDocumentFollowsViewBindings(t *testing.T) {
	t.Parallel()
	_, err := ApplyMutations(context.Background(), validDocument(t), []*Mutation{
		{Body: &workbenchv1.Mutation_DocumentDelete{DocumentDelete: &workbenchv1.DocumentDelete{
			DocumentId: "document-1",
		}}},
	}, testDependencies(), DefaultLimits)
	if err == nil || !strings.Contains(err.Error(), `view "view-chart" binding "primary"`) {
		t.Fatalf("ApplyMutations() error = %v, want bound-view error", err)
	}
}

func TestCloseViewRemovesEveryPlacementButKeepsDocument(t *testing.T) {
	t.Parallel()
	output, err := ApplyMutations(context.Background(), validDocument(t), []*Mutation{
		{Body: &workbenchv1.Mutation_ViewClose{ViewClose: &workbenchv1.ViewClose{
			ViewId: "view-chart", FallbackViewId: "view-launcher",
		}}},
	}, testDependencies(), DefaultLimits)
	if err != nil {
		t.Fatalf("ApplyMutations() error = %v", err)
	}
	if _, exists := output.Views["view-chart"]; exists {
		t.Fatal("closed view remains in view table")
	}
	if _, exists := output.Documents["document-1"]; !exists {
		t.Fatal("closing a view deleted its document")
	}
	for _, workspace := range output.Workspaces {
		if workspace.Tree.GetLeaf().ViewId != "view-launcher" {
			t.Fatalf("workspace %q fallback = %q, want view-launcher", workspace.Id, workspace.Tree.GetLeaf().ViewId)
		}
	}
}

func TestFailedBatchDoesNotMutateInput(t *testing.T) {
	t.Parallel()
	document := validDocument(t)
	_, err := ApplyMutations(context.Background(), document, []*Mutation{
		{Body: &workbenchv1.Mutation_WorkbenchRename{WorkbenchRename: &workbenchv1.WorkbenchRename{Name: "Changed"}}},
		{Body: &workbenchv1.Mutation_PlacementClose{PlacementClose: &workbenchv1.PlacementClose{
			WorkspaceId: "workspace-a", PlacementId: "placement-a",
		}}},
	}, testDependencies(), DefaultLimits)
	if err == nil {
		t.Fatal("ApplyMutations() error = nil")
	}
	if document.Name != "Production" {
		t.Fatalf("input name = %q, want Production", document.Name)
	}
}
