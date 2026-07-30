// Package workbenchapi provides the canonical protobuf JSON boundary used by
// PBUI workbench HTTP clients and hosts.
package workbenchapi

import (
	"fmt"
	"io"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

var (
	marshalOptions = protojson.MarshalOptions{
		UseProtoNames:   false,
		EmitUnpopulated: false,
	}
	unmarshalOptions = protojson.UnmarshalOptions{
		DiscardUnknown: false,
	}
)

// Marshal emits canonical lower-camel protobuf JSON.
func Marshal(message proto.Message) ([]byte, error) {
	data, err := marshalOptions.Marshal(message)
	if err != nil {
		return nil, fmt.Errorf("workbench API: marshal protobuf JSON: %w", err)
	}
	return data, nil
}

// Unmarshal decodes protobuf JSON and rejects unknown fields.
func Unmarshal(data []byte, message proto.Message) error {
	if err := unmarshalOptions.Unmarshal(data, message); err != nil {
		return fmt.Errorf("workbench API: decode protobuf JSON: %w", err)
	}
	return nil
}

// Decode reads one size-limited protobuf JSON request.
func Decode(reader io.Reader, maxBytes int64, message proto.Message) error {
	if reader == nil {
		return fmt.Errorf("workbench API: request body is required")
	}
	if maxBytes <= 0 {
		return fmt.Errorf("workbench API: positive body limit is required")
	}
	data, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return fmt.Errorf("workbench API: read request: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return fmt.Errorf("workbench API: request exceeds %d bytes", maxBytes)
	}
	return Unmarshal(data, message)
}
