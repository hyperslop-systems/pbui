package deviceflow_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/pkg/errors"
	_ "modernc.org/sqlite"

	"github.com/hyperslop-systems/pbui/pkg/authkit"
	"github.com/hyperslop-systems/pbui/pkg/authkit/deviceflow"
)

// harness wires the flow to an in-memory database with a controllable clock —
// the slow-down and expiry rules are time arithmetic, and a test that sleeps
// is a test that flakes.
type harness struct {
	db      *sql.DB
	flow    *deviceflow.Flow
	now     time.Time
	minted  []deviceflow.Minted
	audited []string
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	// One connection: :memory: databases are per connection.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(deviceflow.Schema); err != nil {
		t.Fatalf("create the schema: %v", err)
	}

	h := &harness{db: db, now: time.Date(2026, 7, 31, 12, 0, 0, 0, time.UTC)}
	flow, err := deviceflow.New(deviceflow.Hooks{
		Begin:      func(ctx context.Context) (*sql.Tx, error) { return db.BeginTx(ctx, nil) },
		Now:        func() time.Time { return h.now },
		FormatTime: func(v time.Time) string { return v.UTC().Format(time.RFC3339Nano) },
		ParseTime:  func(v string) (time.Time, error) { return time.Parse(time.RFC3339Nano, v) },
		MintToken: func(_ context.Context, _ *sql.Tx, userID, name string, scopes []string, expiresAt time.Time) (deviceflow.Minted, error) {
			minted := deviceflow.Minted{
				Token: "alg_test_" + userID, TokenID: "tok-" + name,
				ExpiresAt: expiresAt, Scopes: scopes,
			}
			h.minted = append(h.minted, minted)
			return minted, nil
		},
		UserDisabled: func(_ context.Context, _ *sql.Tx, userID string) (bool, error) {
			return userID == "usr-disabled", nil
		},
		ValidateScopes: func(scopes []string) error {
			if len(scopes) == 0 {
				return errors.New("scopes are required")
			}
			for _, scope := range scopes {
				if scope != "read" && scope != "write" {
					return errors.Errorf("unknown scope %q", scope)
				}
			}
			return nil
		},
		Audit: func(_ context.Context, _ *sql.Tx, action string, _ map[string]any) error {
			h.audited = append(h.audited, action)
			return nil
		},
	})
	if err != nil {
		t.Fatalf("deviceflow.New: %v", err)
	}
	h.flow = flow
	return h
}

func (h *harness) start(t *testing.T) (deviceflow.CreateParams, string) {
	t.Helper()
	deviceCode, _ := authkit.NewFlowValue()
	userCode, _ := authkit.NewDeviceUserCode()
	hmac, err := authkit.HashDeviceUserCode("test-pepper", userCode)
	if err != nil {
		t.Fatalf("HashDeviceUserCode: %v", err)
	}
	id, _ := authkit.NewDeviceAuthorizationID()
	params := deviceflow.CreateParams{
		ID: id, DeviceHash: authkit.HashDeviceCode(deviceCode), UserCodeHMAC: hmac,
		Name: "coding agent", Scopes: []string{"read", "write"},
		TokenLifetime: 24 * time.Hour,
	}
	if _, err := h.flow.Create(context.Background(), params); err != nil {
		t.Fatalf("Create: %v", err)
	}
	return params, deviceCode
}

func TestPairingLifecycle(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	params, deviceCode := h.start(t)

	// An immediate poll is EARLY (next_poll_at is 5s out) and earns slow-down.
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrSlowDown) {
		t.Fatalf("early poll: %v, want ErrSlowDown", err)
	}
	// The slow-down PUSHED the window, so 6 seconds in is still early.
	h.now = h.now.Add(6 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrSlowDown) {
		t.Fatalf("pushed window: %v, want ErrSlowDown", err)
	}

	// A polite poll before approval answers pending.
	h.now = h.now.Add(10 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrPending) {
		t.Fatalf("pending poll: %v, want ErrPending", err)
	}

	// The human approves; the record is only visible WITH the code HMAC.
	if _, err := h.flow.Get(ctx, params.ID, "wrong-hmac"); !errors.Is(err, deviceflow.ErrInvalid) {
		t.Fatalf("get with a wrong hmac: %v, want ErrInvalid", err)
	}
	if _, err := h.flow.Approve(ctx, params.ID, "usr-1", params.UserCodeHMAC); err != nil {
		t.Fatalf("Approve: %v", err)
	}

	// The next polite poll consumes: one token, correct scopes and expiry.
	h.now = h.now.Add(10 * time.Second)
	token, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode))
	if err != nil {
		t.Fatalf("Consume: %v", err)
	}
	if token.Token == "" || len(token.Scopes) != 2 {
		t.Fatalf("token = %+v", token)
	}
	if want := h.now.Add(24 * time.Hour); !token.ExpiresAt.Equal(want) {
		t.Fatalf("expiry = %v, want %v (lifetime counts from CONSUMPTION)", token.ExpiresAt, want)
	}

	// Exactly once: the second consume finds a consumed record.
	h.now = h.now.Add(10 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrConsumed) {
		t.Fatalf("second consume: %v, want ErrConsumed", err)
	}
	if len(h.minted) != 1 {
		t.Fatalf("minted %d tokens, want 1", len(h.minted))
	}
	// And the approval cannot be re-run either.
	if _, err := h.flow.Approve(ctx, params.ID, "usr-2", params.UserCodeHMAC); !errors.Is(err, deviceflow.ErrConsumed) {
		t.Fatalf("re-approve: %v, want ErrConsumed", err)
	}
}

func TestDenialMintsNothing(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	params, deviceCode := h.start(t)

	if _, err := h.flow.Deny(ctx, params.ID, "usr-1", params.UserCodeHMAC); err != nil {
		t.Fatalf("Deny: %v", err)
	}
	h.now = h.now.Add(10 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrDenied) {
		t.Fatalf("consume after deny: %v, want ErrDenied", err)
	}
	if len(h.minted) != 0 {
		t.Fatalf("minted %d tokens after a denial", len(h.minted))
	}
}

func TestExpiryEndsThePairing(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	params, deviceCode := h.start(t)

	// Approval after the window is refused...
	h.now = h.now.Add(deviceflow.AuthorizationLifetime + time.Second)
	if _, err := h.flow.Approve(ctx, params.ID, "usr-1", params.UserCodeHMAC); !errors.Is(err, deviceflow.ErrExpired) {
		t.Fatalf("late approve: %v, want ErrExpired", err)
	}
	// ...and so is consumption, which also marks the record expired.
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrExpired) {
		t.Fatalf("late consume: %v, want ErrExpired", err)
	}
	// The sweep collects it after the retention day.
	h.now = h.now.Add(25 * time.Hour)
	deleted, err := h.flow.Sweep(ctx)
	if err != nil || deleted != 1 {
		t.Fatalf("Sweep: deleted=%d err=%v", deleted, err)
	}
}

func TestADisabledApproverMintsNothing(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	params, deviceCode := h.start(t)

	if _, err := h.flow.Approve(ctx, params.ID, "usr-disabled", params.UserCodeHMAC); err != nil {
		t.Fatalf("Approve: %v", err)
	}
	h.now = h.now.Add(10 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrInvalid) {
		t.Fatalf("consume for a disabled user: %v, want ErrInvalid", err)
	}
	if len(h.minted) != 0 {
		t.Fatal("a disabled user's approval minted a token")
	}
}

func TestCreateEnforcesTheHostVocabulary(t *testing.T) {
	h := newHarness(t)
	params, _ := h.start(t)
	params.ID = "dev_other"
	params.DeviceHash = "other-hash"
	params.Scopes = []string{"admin"}
	if _, err := h.flow.Create(context.Background(), params); err == nil {
		t.Fatal("an unknown scope must not create a pairing")
	}
}

func TestParseExpiresIn(t *testing.T) {
	for raw, want := range map[string]time.Duration{
		"24h": 24 * time.Hour,
		"30d": 30 * 24 * time.Hour,
		"90s": 90 * time.Second,
	} {
		got, err := deviceflow.ParseExpiresIn(raw)
		if err != nil || got != want {
			t.Fatalf("ParseExpiresIn(%q) = %v, %v", raw, got, err)
		}
	}
	for _, raw := range []string{"", "0s", "-4h", "31d", "soon"} {
		if _, err := deviceflow.ParseExpiresIn(raw); err == nil {
			t.Fatalf("ParseExpiresIn(%q) must refuse", raw)
		}
	}
}
