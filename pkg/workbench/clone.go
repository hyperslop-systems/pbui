package workbench

import "google.golang.org/protobuf/proto"

// Clone returns a deep copy suitable for atomic mutation application.
func Clone(input *Document) *Document {
	if input == nil {
		return nil
	}
	return proto.Clone(input).(*Document)
}
