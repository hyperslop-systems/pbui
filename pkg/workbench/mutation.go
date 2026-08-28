package workbench

import (
	"context"
	"fmt"
	"strings"

	workbenchv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/workbench/v1"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"
)

// ApplyMutations clones input, applies every generated command, then validates
// the complete graph once. The input is never modified.
func ApplyMutations(
	ctx context.Context,
	input *Document,
	mutations []*Mutation,
	deps Dependencies,
	limits Limits,
) (*Document, error) {
	if input == nil {
		return nil, invalid("document_required", "", "workbench is required")
	}
	output := Clone(input)
	for index, mutation := range mutations {
		if mutation == nil || mutation.Body == nil {
			return nil, invalid("invalid_mutation", fmt.Sprintf("mutations[%d]", index), "mutation body is required")
		}
		if err := applyMutation(output, mutation); err != nil {
			return nil, errors.Wrapf(err, "workbench: apply mutation at mutations[%d]", index)
		}
	}
	if err := Validate(ctx, output, deps, limits); err != nil {
		return nil, err
	}
	return output, nil
}

func applyMutation(document *Document, mutation *Mutation) error {
	switch body := mutation.Body.(type) {
	case *workbenchv1.Mutation_WorkbenchRename:
		if body.WorkbenchRename == nil {
			return invalid("invalid_mutation", "workbenchRename", "body is required")
		}
		document.Name = strings.TrimSpace(body.WorkbenchRename.Name)
		return nil

	case *workbenchv1.Mutation_WorkspaceCreate:
		value := body.WorkspaceCreate
		if value == nil || value.RootPlacement == nil {
			return invalid("invalid_mutation", "workspaceCreate", "workspace and root placement are required")
		}
		if workspaceByID(document, value.WorkspaceId) != nil {
			return invalid("duplicate_id", "workspaceCreate.workspaceId", "workspace %q already exists", value.WorkspaceId)
		}
		document.Workspaces = append(document.Workspaces, &Workspace{
			Id: value.WorkspaceId, Name: strings.TrimSpace(value.Name), Tree: cloneNode(value.RootPlacement),
		})
		return nil

	case *workbenchv1.Mutation_WorkspaceSetTree:
		value := body.WorkspaceSetTree
		if value == nil || value.RootPlacement == nil {
			return invalid("invalid_mutation", "workspaceSetTree", "root placement is required")
		}
		workspace := workspaceByID(document, value.WorkspaceId)
		if workspace == nil {
			return invalid("unknown_workspace", "workspaceSetTree.workspaceId", "workspace %q does not exist", value.WorkspaceId)
		}
		workspace.Tree = cloneNode(value.RootPlacement)
		return nil

	case *workbenchv1.Mutation_WorkspaceRename:
		value := body.WorkspaceRename
		if value == nil {
			return invalid("invalid_mutation", "workspaceRename", "body is required")
		}
		workspace := workspaceByID(document, value.WorkspaceId)
		if workspace == nil {
			return invalid("unknown_workspace", "workspaceRename.workspaceId", "workspace %q does not exist", value.WorkspaceId)
		}
		workspace.Name = strings.TrimSpace(value.Name)
		return nil

	case *workbenchv1.Mutation_WorkspaceDelete:
		value := body.WorkspaceDelete
		if value == nil {
			return invalid("invalid_mutation", "workspaceDelete", "body is required")
		}
		if len(document.Workspaces) <= 1 {
			return invalid("last_workspace", "workspaceDelete.workspaceId", "the last workspace cannot be deleted")
		}
		for index, workspace := range document.Workspaces {
			if workspace != nil && workspace.Id == value.WorkspaceId {
				document.Workspaces = append(document.Workspaces[:index], document.Workspaces[index+1:]...)
				return nil
			}
		}
		return invalid("unknown_workspace", "workspaceDelete.workspaceId", "workspace %q does not exist", value.WorkspaceId)

	case *workbenchv1.Mutation_DocumentPut:
		value := body.DocumentPut
		if value == nil || value.Document == nil {
			return invalid("invalid_mutation", "documentPut.document", "document is required")
		}
		if document.Documents == nil {
			document.Documents = map[string]*DocumentPayload{}
		}
		document.Documents[value.Document.Id] = proto.Clone(value.Document).(*DocumentPayload)
		return nil

	case *workbenchv1.Mutation_DocumentDelete:
		value := body.DocumentDelete
		if value == nil {
			return invalid("invalid_mutation", "documentDelete", "body is required")
		}
		if _, exists := document.Documents[value.DocumentId]; !exists {
			return invalid("unknown_document", "documentDelete.documentId", "document %q does not exist", value.DocumentId)
		}
		for _, view := range document.Views {
			if view == nil {
				continue
			}
			for binding, id := range view.Documents {
				if id == value.DocumentId {
					return invalid("document_in_use", "documentDelete.documentId", "view %q binding %q references document", view.Id, binding)
				}
			}
		}
		delete(document.Documents, value.DocumentId)
		return nil

	case *workbenchv1.Mutation_ViewCreate:
		value := body.ViewCreate
		if value == nil || value.View == nil {
			return invalid("invalid_mutation", "viewCreate.view", "view is required")
		}
		if _, exists := document.Views[value.View.Id]; exists {
			return invalid("duplicate_id", "viewCreate.view.id", "view %q already exists", value.View.Id)
		}
		if document.Views == nil {
			document.Views = map[string]*AppView{}
		}
		document.Views[value.View.Id] = proto.Clone(value.View).(*AppView)
		document.ViewOrder = append(document.ViewOrder, value.View.Id)
		return nil

	case *workbenchv1.Mutation_ViewConfigure:
		value := body.ViewConfigure
		if value == nil {
			return invalid("invalid_mutation", "viewConfigure", "body is required")
		}
		view, exists := document.Views[value.ViewId]
		if !exists || view == nil {
			return invalid("unknown_view", "viewConfigure.viewId", "view %q does not exist", value.ViewId)
		}
		if value.AppId != nil {
			view.AppId = strings.TrimSpace(*value.AppId)
		}
		switch title := value.TitleChange.(type) {
		case *workbenchv1.ViewConfigure_SetTitle:
			trimmed := strings.TrimSpace(title.SetTitle)
			view.Title = &trimmed
		case *workbenchv1.ViewConfigure_ClearTitle:
			view.Title = nil
		}
		if value.ReplaceDocuments != nil {
			view.Documents = cloneBindings(value.ReplaceDocuments.Values)
		}
		return nil

	case *workbenchv1.Mutation_ViewClone:
		value := body.ViewClone
		if value == nil {
			return invalid("invalid_mutation", "viewClone", "body is required")
		}
		source, exists := document.Views[value.SourceViewId]
		if !exists || source == nil {
			return invalid("unknown_view", "viewClone.sourceViewId", "view %q does not exist", value.SourceViewId)
		}
		if _, exists := document.Views[value.NewViewId]; exists {
			return invalid("duplicate_id", "viewClone.newViewId", "view %q already exists", value.NewViewId)
		}
		clone := proto.Clone(source).(*AppView)
		clone.Id = value.NewViewId
		switch title := value.TitleChange.(type) {
		case *workbenchv1.ViewClone_SetTitle:
			trimmed := strings.TrimSpace(title.SetTitle)
			clone.Title = &trimmed
		case *workbenchv1.ViewClone_ClearTitle:
			clone.Title = nil
		}
		document.Views[clone.Id] = clone
		document.ViewOrder = append(document.ViewOrder, clone.Id)
		return nil

	case *workbenchv1.Mutation_ViewDelete:
		value := body.ViewDelete
		if value == nil {
			return invalid("invalid_mutation", "viewDelete", "body is required")
		}
		if _, exists := document.Views[value.ViewId]; !exists {
			return invalid("unknown_view", "viewDelete.viewId", "view %q does not exist", value.ViewId)
		}
		if countViewPlacements(document, value.ViewId) > 0 {
			return invalid("view_in_use", "viewDelete.viewId", "view %q still has placements", value.ViewId)
		}
		removeViewRecord(document, value.ViewId)
		return nil

	case *workbenchv1.Mutation_ViewClose:
		value := body.ViewClose
		if value == nil {
			return invalid("invalid_mutation", "viewClose", "body is required")
		}
		if value.ViewId == value.FallbackViewId {
			return invalid("invalid_fallback", "viewClose.fallbackViewId", "fallback must differ from closed view")
		}
		if _, exists := document.Views[value.ViewId]; !exists {
			return invalid("unknown_view", "viewClose.viewId", "view %q does not exist", value.ViewId)
		}
		if _, exists := document.Views[value.FallbackViewId]; !exists {
			return invalid("unknown_view", "viewClose.fallbackViewId", "view %q does not exist", value.FallbackViewId)
		}
		for _, workspace := range document.Workspaces {
			if workspace == nil || workspace.Tree == nil {
				continue
			}
			rootID := workspace.Tree.Id
			next := removeViewPlacements(workspace.Tree, value.ViewId)
			if next == nil {
				workspace.Tree = leafNode(rootID, value.FallbackViewId)
			} else {
				workspace.Tree = next
			}
		}
		removeViewRecord(document, value.ViewId)
		return nil

	case *workbenchv1.Mutation_PlacementReplace:
		value := body.PlacementReplace
		if value == nil {
			return invalid("invalid_mutation", "placementReplace", "body is required")
		}
		if _, exists := document.Views[value.ViewId]; !exists {
			return invalid("unknown_view", "placementReplace.viewId", "view %q does not exist", value.ViewId)
		}
		node, err := placement(document, value.WorkspaceId, value.PlacementId)
		if err != nil {
			return err
		}
		node.Body = &workbenchv1.Node_Leaf{Leaf: &workbenchv1.Leaf{ViewId: value.ViewId}}
		return nil

	case *workbenchv1.Mutation_PlacementSplit:
		value := body.PlacementSplit
		if value == nil || value.NewPlacement == nil || value.NewPlacement.GetLeaf() == nil {
			return invalid("invalid_leaf", "placementSplit.newPlacement", "new placement must be a leaf")
		}
		workspace := workspaceByID(document, value.WorkspaceId)
		if workspace == nil {
			return invalid("unknown_workspace", "placementSplit.workspaceId", "workspace %q does not exist", value.WorkspaceId)
		}
		newViewID := value.NewPlacement.GetLeaf().ViewId
		if _, exists := document.Views[newViewID]; !exists {
			return invalid("unknown_view", "placementSplit.newPlacement.leaf.viewId", "view %q does not exist", newViewID)
		}
		target := findNode(workspace.Tree, value.PlacementId)
		if target == nil || target.GetLeaf() == nil {
			return invalid("unknown_placement", "placementSplit.placementId", "placement %q does not exist", value.PlacementId)
		}
		targetCopy := cloneNode(target)
		newCopy := cloneNode(value.NewPlacement)
		split := &workbenchv1.Split{Direction: value.Direction, Ratio: value.Ratio}
		switch value.Place {
		case workbenchv1.PlacementPosition_PLACEMENT_POSITION_BEFORE:
			split.A, split.B = newCopy, targetCopy
		case workbenchv1.PlacementPosition_PLACEMENT_POSITION_AFTER:
			split.A, split.B = targetCopy, newCopy
		case workbenchv1.PlacementPosition_PLACEMENT_POSITION_UNSPECIFIED:
			return invalid(
				"invalid_position",
				"placementSplit.place",
				"position must be BEFORE or AFTER",
			)
		default:
			return invalid(
				"invalid_position",
				"placementSplit.place",
				"unknown position %d",
				value.Place,
			)
		}
		*target = Node{Id: value.SplitId, Body: &workbenchv1.Node_Split{Split: split}}
		return nil

	case *workbenchv1.Mutation_PlacementClose:
		value := body.PlacementClose
		if value == nil {
			return invalid("invalid_mutation", "placementClose", "body is required")
		}
		workspace := workspaceByID(document, value.WorkspaceId)
		if workspace == nil {
			return invalid("unknown_workspace", "placementClose.workspaceId", "workspace %q does not exist", value.WorkspaceId)
		}
		next, removed := removePlacement(workspace.Tree, value.PlacementId)
		if !removed {
			return invalid("unknown_placement", "placementClose.placementId", "placement %q does not exist", value.PlacementId)
		}
		if next == nil {
			return invalid("last_placement", "placementClose.placementId", "the last placement cannot be closed")
		}
		workspace.Tree = next
		return nil

	case *workbenchv1.Mutation_SplitResize:
		value := body.SplitResize
		if value == nil {
			return invalid("invalid_mutation", "splitResize", "body is required")
		}
		workspace := workspaceByID(document, value.WorkspaceId)
		if workspace == nil {
			return invalid("unknown_workspace", "splitResize.workspaceId", "workspace %q does not exist", value.WorkspaceId)
		}
		node := findNode(workspace.Tree, value.SplitId)
		if node == nil || node.GetSplit() == nil {
			return invalid("unknown_split", "splitResize.splitId", "split %q does not exist", value.SplitId)
		}
		node.GetSplit().Ratio = value.Ratio
		return nil

	default:
		return invalid("invalid_mutation", "body", "unsupported mutation body %T", mutation.Body)
	}
}

func workspaceByID(document *Document, id string) *Workspace {
	for _, workspace := range document.Workspaces {
		if workspace != nil && workspace.Id == id {
			return workspace
		}
	}
	return nil
}

func placement(document *Document, workspaceID, placementID string) (*Node, error) {
	workspace := workspaceByID(document, workspaceID)
	if workspace == nil {
		return nil, invalid("unknown_workspace", "workspaceId", "workspace %q does not exist", workspaceID)
	}
	node := findNode(workspace.Tree, placementID)
	if node == nil || node.GetLeaf() == nil {
		return nil, invalid("unknown_placement", "placementId", "placement %q does not exist", placementID)
	}
	return node, nil
}

func findNode(node *Node, id string) *Node {
	if node == nil || node.Id == id {
		return node
	}
	split := node.GetSplit()
	if split == nil {
		return nil
	}
	if found := findNode(split.A, id); found != nil {
		return found
	}
	return findNode(split.B, id)
}

func removePlacement(node *Node, id string) (*Node, bool) {
	if node == nil {
		return nil, false
	}
	if node.GetLeaf() != nil {
		if node.Id == id {
			return nil, true
		}
		return node, false
	}
	split := node.GetSplit()
	if split == nil {
		return node, false
	}
	a, removedA := removePlacement(split.A, id)
	b, removedB := removePlacement(split.B, id)
	if !removedA && !removedB {
		return node, false
	}
	if a == nil {
		return b, true
	}
	if b == nil {
		return a, true
	}
	split.A, split.B = a, b
	return node, true
}

func removeViewPlacements(node *Node, viewID string) *Node {
	if node == nil {
		return nil
	}
	if leaf := node.GetLeaf(); leaf != nil {
		if leaf.ViewId == viewID {
			return nil
		}
		return node
	}
	split := node.GetSplit()
	if split == nil {
		return node
	}
	a := removeViewPlacements(split.A, viewID)
	b := removeViewPlacements(split.B, viewID)
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	split.A, split.B = a, b
	return node
}

func countViewPlacements(document *Document, viewID string) int {
	total := 0
	var count func(*Node)
	count = func(node *Node) {
		if node == nil {
			return
		}
		if leaf := node.GetLeaf(); leaf != nil {
			if leaf.ViewId == viewID {
				total++
			}
			return
		}
		if split := node.GetSplit(); split != nil {
			count(split.A)
			count(split.B)
		}
	}
	for _, workspace := range document.Workspaces {
		if workspace != nil {
			count(workspace.Tree)
		}
	}
	return total
}

func removeViewRecord(document *Document, viewID string) {
	delete(document.Views, viewID)
	next := document.ViewOrder[:0]
	for _, id := range document.ViewOrder {
		if id != viewID {
			next = append(next, id)
		}
	}
	document.ViewOrder = next
}

func cloneBindings(input map[string]string) map[string]string {
	output := make(map[string]string, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}

func cloneNode(node *Node) *Node {
	if node == nil {
		return nil
	}
	return proto.Clone(node).(*Node)
}

func leafNode(id, viewID string) *Node {
	return &Node{Id: id, Body: &workbenchv1.Node_Leaf{Leaf: &workbenchv1.Leaf{ViewId: viewID}}}
}
