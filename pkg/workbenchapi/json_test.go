package workbenchapi

import (
	"strings"
	"testing"

	workbenchv1 "github.com/hyperslop-systems/pbui/gen/go/hyperslop/pbui/workbench/v1"
)

func TestDecodeMutationRejectsUnknownFields(t *testing.T) {
	t.Parallel()
	var batch workbenchv1.MutationBatch
	err := Decode(strings.NewReader(`{
		"mutations":[{"viewDelete":{"viewId":"v1","viewdId":"typo"}}]
	}`), 1024, &batch)
	if err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("Decode() error = %v, want unknown field", err)
	}
}

func TestDecodeConfigureDistinguishesOmittedAndClearTitle(t *testing.T) {
	t.Parallel()
	var batch workbenchv1.MutationBatch
	err := Decode(strings.NewReader(`{
		"mutations":[
			{"viewConfigure":{"viewId":"v1"}},
			{"viewConfigure":{"viewId":"v1","clearTitle":{}}}
		]
	}`), 2048, &batch)
	if err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if batch.Mutations[0].GetViewConfigure().TitleChange != nil {
		t.Fatal("omitted title was treated as present")
	}
	if _, ok := batch.Mutations[1].GetViewConfigure().TitleChange.(*workbenchv1.ViewConfigure_ClearTitle); !ok {
		t.Fatalf("clear title case = %T", batch.Mutations[1].GetViewConfigure().TitleChange)
	}
}

func TestRevisionUsesProtoJSONString(t *testing.T) {
	t.Parallel()
	data, err := Marshal(&workbenchv1.WorkbenchResource{Revision: 9007199254740993})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"revision":"9007199254740993"`) {
		t.Fatalf("Marshal() = %s", data)
	}
}
