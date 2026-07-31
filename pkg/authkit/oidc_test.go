package authkit_test

import (
	"context"
	"testing"
	"time"

	"github.com/hyperslop-systems/pbui/pkg/authkit"
)

func TestDiscoverWithRetryRefusesZeroAttempts(t *testing.T) {
	// A zero-attempt call must fail loudly: returning (nil, nil) would hand
	// the caller a nil Provider it will dereference on the first sign-in.
	for _, attempts := range []int{0, -1} {
		_, err := authkit.DiscoverWithRetry(context.Background(),
			"http://127.0.0.1:0", "client", "", "http://localhost/cb", nil,
			attempts, time.Millisecond)
		if err == nil {
			t.Fatalf("attempts=%d: want an error, got a nil provider", attempts)
		}
	}
}
