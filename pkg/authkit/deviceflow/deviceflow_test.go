package deviceflow_test

import (
	"context"
	"database/sql"
	"net/http/httptest"
	"net/netip"
	"strings"
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

	// An immediate poll is EARLY (next_poll_at is 5s out) and earns slow-down:
	// the interval grows to 10s and the window is pushed to now+10s.
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrSlowDown) {
		t.Fatalf("early poll: %v, want ErrSlowDown", err)
	}
	// The slow-down PUSHED the window, so 6 seconds in is still early; the
	// interval grows again, to 15s.
	h.now = h.now.Add(6 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrSlowDown) {
		t.Fatalf("pushed window: %v, want ErrSlowDown", err)
	}
	// The grown interval is durable (RFC 8628: slow_down applies to all
	// subsequent polls), not a one-poll penalty.
	record, err := h.flow.Get(ctx, params.ID, params.UserCodeHMAC)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if record.PollInterval != 15*time.Second {
		t.Fatalf("poll interval after two slow-downs = %v, want 15s", record.PollInterval)
	}

	// A polite poll before approval answers pending, and resets the window
	// from the GROWN interval.
	h.now = h.now.Add(16 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrPending) {
		t.Fatalf("pending poll: %v, want ErrPending", err)
	}
	h.now = h.now.Add(10 * time.Second)
	if _, err := h.flow.Consume(ctx, authkit.HashDeviceCode(deviceCode)); !errors.Is(err, deviceflow.ErrSlowDown) {
		t.Fatalf("poll at the retired 10s cadence: %v, want ErrSlowDown (interval stays grown)", err)
	}

	// The human approves; the record is only visible WITH the code HMAC.
	if _, err := h.flow.Get(ctx, params.ID, "wrong-hmac"); !errors.Is(err, deviceflow.ErrInvalid) {
		t.Fatalf("get with a wrong hmac: %v, want ErrInvalid", err)
	}
	if _, err := h.flow.Approve(ctx, params.ID, "usr-1", params.UserCodeHMAC); err != nil {
		t.Fatalf("Approve: %v", err)
	}

	// The next polite poll consumes: one token, correct scopes and expiry.
	// (The impatient poll above grew the interval to 20s and pushed the
	// window 20s out, so politeness now means waiting that long.)
	h.now = h.now.Add(25 * time.Second)
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

	denied, err := h.flow.Deny(ctx, params.ID, "usr-1", params.UserCodeHMAC)
	if err != nil {
		t.Fatalf("Deny: %v", err)
	}
	// The denier is audited, never recorded as an approver.
	if denied.ApprovedBy != "" {
		t.Fatalf("denial recorded approved_by = %q", denied.ApprovedBy)
	}
	if record, err := h.flow.Get(ctx, params.ID, params.UserCodeHMAC); err != nil || record.ApprovedBy != "" {
		t.Fatalf("stored denial: approved_by = %q, err = %v", record.ApprovedBy, err)
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
		"24h":  24 * time.Hour,
		"30d":  30 * 24 * time.Hour,
		"1.5d": 36 * time.Hour,
		"90s":  90 * time.Second,
	} {
		got, err := deviceflow.ParseExpiresIn(raw)
		if err != nil || got != want {
			t.Fatalf("ParseExpiresIn(%q) = %v, %v", raw, got, err)
		}
	}
	for _, raw := range []string{
		"", "0s", "-4h", "31d", "soon",
		// A day count large enough to overflow the ×24 must not wrap into an
		// accepted small duration.
		"213504d", "9000000000d",
		// Sub-second lifetimes truncate to a token that expires at mint time,
		// and sub-second remainders would be silently dropped by the integer
		// seconds column.
		"500ms", "90.5s",
	} {
		if _, err := deviceflow.ParseExpiresIn(raw); err == nil {
			t.Fatalf("ParseExpiresIn(%q) must refuse", raw)
		}
	}
}

func TestCreateRefusesLifetimesTheSchemaCannotHold(t *testing.T) {
	h := newHarness(t)
	for name, lifetime := range map[string]time.Duration{
		"sub-second":       500 * time.Millisecond,
		"fractional":       90*time.Second + 500*time.Millisecond,
		"beyond the bound": deviceflow.TokenMaxLifetime + time.Second,
	} {
		params, _ := h.start(t)
		params.ID, params.DeviceHash = "dev_"+name, "hash-"+name
		params.TokenLifetime = lifetime
		if _, err := h.flow.Create(context.Background(), params); err == nil {
			t.Fatalf("Create accepted a %s lifetime (%v)", name, lifetime)
		}
	}
}

func TestCreateCountsNameCharactersNotBytes(t *testing.T) {
	h := newHarness(t)
	params, _ := h.start(t)
	params.ID, params.DeviceHash = "dev_emoji", "hash-emoji"
	params.Name = strings.Repeat("🖥", 120) // 120 characters, 480 bytes
	if _, err := h.flow.Create(context.Background(), params); err != nil {
		t.Fatalf("a 120-character multibyte name must be accepted: %v", err)
	}
	params.ID, params.DeviceHash = "dev_long", "hash-long"
	params.Name = strings.Repeat("x", 121)
	if _, err := h.flow.Create(context.Background(), params); err == nil {
		t.Fatal("a 121-character name must be refused")
	}
}

func TestClientKeyWalksTheForwardedChain(t *testing.T) {
	trusted := []netip.Prefix{
		netip.MustParsePrefix("10.0.0.1/32"),
		netip.MustParsePrefix("10.0.0.2/32"),
	}
	for name, tc := range map[string]struct {
		remote, xff, want string
	}{
		"untrusted peer ignores the header": {
			remote: "203.0.113.7:4711", xff: "198.51.100.1", want: "203.0.113.7"},
		"one proxy": {
			remote: "10.0.0.1:80", xff: "198.51.100.1", want: "198.51.100.1"},
		"two proxies skip the intermediary": {
			remote: "10.0.0.2:80", xff: "198.51.100.1, 10.0.0.1", want: "198.51.100.1"},
		"client-supplied prefix is not consulted": {
			remote: "10.0.0.2:80", xff: "192.0.2.99, 198.51.100.1, 10.0.0.1", want: "198.51.100.1"},
		"all trusted falls back to the chain head": {
			remote: "10.0.0.2:80", xff: "10.0.0.1", want: "10.0.0.1"},
		"malformed entry ends the walk at the peer": {
			remote: "10.0.0.1:80", xff: "garbage", want: "10.0.0.1"},
		"empty header falls back to the peer": {
			remote: "10.0.0.1:80", xff: "", want: "10.0.0.1"},
	} {
		r := httptest.NewRequest("POST", "/v1/device/tokens", nil)
		r.RemoteAddr = tc.remote
		if tc.xff != "" {
			r.Header.Set("X-Forwarded-For", tc.xff)
		}
		if got := deviceflow.ClientKey(r, trusted); got != tc.want {
			t.Fatalf("%s: ClientKey = %q, want %q", name, got, tc.want)
		}
	}
}
