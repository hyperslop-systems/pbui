package authkit_test

import (
	"context"
	"testing"
	"time"

	"github.com/hyperslop-systems/pbui/pkg/authkit"
)

// A single failing attempt must return its error immediately: sleeping the
// retry delay after the FINAL attempt blocks startup for nothing, and a
// context that expires during that pointless sleep would displace the real
// discovery error.
func TestDiscoverWithRetrySkipsTheFinalWait(t *testing.T) {
	start := time.Now()
	_, err := authkit.DiscoverWithRetry(context.Background(),
		"http://127.0.0.1:0", "client", "", "http://localhost/cb", nil,
		1, time.Hour)
	if err == nil {
		t.Fatal("discovery against a dead issuer must fail")
	}
	if elapsed := time.Since(start); elapsed > 30*time.Second {
		t.Fatalf("a single attempt slept the retry delay (took %v)", elapsed)
	}
}

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
