// Package deviceflow is the device-authorization state machine every
// hyperslop application server shares.
//
// The flow is RFC-8628-shaped: an agent with no browser starts a pairing,
// a human approves it in a signed-in browser, and the agent's poll consumes
// the approval into one scoped, expiring API token. The package owns the
// SEMANTICS — pending, slow-down, approval, single-use consumption, expiry —
// and none of the product: the host supplies its clock, its time format, its
// token minter, its scope vocabulary, and its audit sink through Hooks.
//
// The wire shapes mirror datalab's exactly (field for field), so one typed
// client can pair against any host; only the scope VALUES differ per product.
package deviceflow

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"strings"
	"time"

	"github.com/pkg/errors"
)

// The timing contract, shared by every host.
const (
	// AuthorizationLifetime is the maximum time an unattended agent may wait
	// for its human to approve it. Deliberately much shorter than the
	// credential it mints: a leaked user code is useful only during this
	// human-attended window.
	AuthorizationLifetime = 10 * time.Minute
	// PollInterval is the initial polling delay. The server grows it after an
	// early poll.
	PollInterval = 5 * time.Second
	// TokenMaxLifetime bounds unattended credentials independently of a
	// browser session's lifetime.
	TokenMaxLifetime = 30 * 24 * time.Hour
)

// State is where one pairing stands.
type State string

const (
	StatePending  State = "pending"
	StateApproved State = "approved"
	StateDenied   State = "denied"
	StateConsumed State = "consumed"
	StateExpired  State = "expired"
)

// Sentinel errors. The host's HTTP layer maps each one onto its problem shape.
var (
	ErrPending  = errors.New("device authorization pending")
	ErrSlowDown = errors.New("device authorization slow down")
	ErrExpired  = errors.New("device authorization expired")
	ErrDenied   = errors.New("device authorization denied")
	ErrConsumed = errors.New("device authorization consumed")
	ErrInvalid  = errors.New("device authorization invalid")
)

// Audit action names, shared so both products' audit logs read the same.
const (
	ActionStart   = "device_authorization.start"
	ActionApprove = "device_authorization.approve"
	ActionDeny    = "device_authorization.deny"
	ActionConsume = "device_authorization.consume"
)

// Schema is the table this package drives. A host copies it into its own
// migration system verbatim; the column set is part of the shared contract.
const Schema = `
CREATE TABLE device_authorizations (
    id               TEXT PRIMARY KEY,          -- "dev_..."; safe to log
    device_hash      TEXT NOT NULL UNIQUE,      -- SHA-256 of the agent's code
    user_code_hmac   TEXT NOT NULL,             -- peppered HMAC of the display code
    requested_name   TEXT NOT NULL,
    requested_scopes TEXT NOT NULL,             -- space-separated, host vocabulary
    expires_at       TEXT NOT NULL,             -- the pairing window
    token_expires_at TEXT NOT NULL,
    token_lifetime_s INTEGER NOT NULL,
    poll_interval_s  INTEGER NOT NULL,
    next_poll_at     TEXT NOT NULL,
    state            TEXT NOT NULL,
    approved_by      TEXT,
    approved_at      TEXT,
    denied_at        TEXT,
    consumed_at      TEXT,
    token_id         TEXT,
    created_at       TEXT NOT NULL
);
`

// Authorization is durable pairing state. It intentionally never carries the
// raw device code, the displayed user code, or the raw API token.
type Authorization struct {
	ID                   string        `json:"id"`
	RequestedName        string        `json:"requested_name"`
	RequestedScopes      []string      `json:"requested_scopes"`
	ExpiresAt            time.Time     `json:"expires_at"`
	TokenExpiresAt       time.Time     `json:"-"`
	TokenLifetime        time.Duration `json:"-"`
	TokenLifetimeSeconds int64         `json:"token_lifetime_seconds"`
	PollInterval         time.Duration `json:"poll_interval"`
	NextPollAt           time.Time     `json:"next_poll_at"`
	State                State         `json:"state"`
	ApprovedBy           string        `json:"approved_by,omitempty"`
	ApprovedAt           *time.Time    `json:"approved_at,omitempty"`
	DeniedAt             *time.Time    `json:"denied_at,omitempty"`
	ConsumedAt           *time.Time    `json:"consumed_at,omitempty"`
	TokenID              string        `json:"token_id,omitempty"`
	CreatedAt            time.Time     `json:"created_at"`
}

// The wire shapes, field for field as datalab serves them.

type StartRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresIn string   `json:"expires_in"`
}

type StartResponse struct {
	AuthorizationID         string `json:"authorization_id"`
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int64  `json:"expires_in"`
	Interval                int64  `json:"interval"`
}

type PollRequest struct {
	DeviceCode string `json:"device_code"`
}

type ApproveRequest struct {
	UserCode string `json:"user_code"`
}

type TokenResponse struct {
	Token     string     `json:"token"`
	TokenID   string     `json:"token_id"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Scopes    []string   `json:"scopes"`
}

// Minted is what the host's token minter returns.
type Minted struct {
	Token     string
	TokenID   string
	ExpiresAt time.Time
	Scopes    []string
}

// Hooks are the host-specific inputs. Every field except Audit is required.
type Hooks struct {
	// Begin opens the write transaction the host wants (datalab uses
	// BEGIN IMMEDIATE against SQLite).
	Begin func(ctx context.Context) (*sql.Tx, error)
	Now   func() time.Time
	// FormatTime and ParseTime are the host store's timestamp convention; the
	// two hosts' conventions differ, and rows must match their neighbours.
	FormatTime func(time.Time) string
	ParseTime  func(string) (time.Time, error)
	// MintToken creates the API token INSIDE the consuming transaction, so a
	// crash cannot mint without consuming or consume without minting.
	MintToken func(ctx context.Context, tx *sql.Tx, userID, name string, scopes []string, expiresAt time.Time) (Minted, error)
	// UserDisabled reports whether the approving account has been disabled
	// since it approved; a disabled user's approval mints nothing.
	UserDisabled func(ctx context.Context, tx *sql.Tx, userID string) (bool, error)
	// ValidateScopes enforces the host's vocabulary. It must refuse an empty
	// list and any scope a device must not hold (admin-equivalents).
	ValidateScopes func(scopes []string) error
	// Audit, when set, records an action inside the same transaction.
	Audit func(ctx context.Context, tx *sql.Tx, action string, detail map[string]any) error
}

func (h Hooks) check() error {
	if h.Begin == nil || h.Now == nil || h.FormatTime == nil || h.ParseTime == nil ||
		h.MintToken == nil || h.UserDisabled == nil || h.ValidateScopes == nil {
		return errors.New("deviceflow: every hook except Audit is required")
	}
	return nil
}

func (h Hooks) audit(ctx context.Context, tx *sql.Tx, action string, detail map[string]any) error {
	if h.Audit == nil {
		return nil
	}
	return h.Audit(ctx, tx, action, detail)
}

// Flow drives the device_authorizations table through its state machine.
type Flow struct {
	hooks Hooks
}

// New builds a Flow. It fails fast on missing hooks rather than at the first
// pairing attempt in production.
func New(hooks Hooks) (*Flow, error) {
	if err := hooks.check(); err != nil {
		return nil, err
	}
	return &Flow{hooks: hooks}, nil
}

// CreateParams describe one new pairing. The caller supplies hashes only.
type CreateParams struct {
	ID           string
	DeviceHash   string
	UserCodeHMAC string
	Name         string
	Scopes       []string
	// TokenLifetime is the requested credential duration, already validated
	// against TokenMaxLifetime by ParseExpiresIn.
	TokenLifetime time.Duration
}

// Create stores a pending pairing and returns its public record.
func (f *Flow) Create(ctx context.Context, p CreateParams) (Authorization, error) {
	if strings.TrimSpace(p.ID) == "" || strings.TrimSpace(p.DeviceHash) == "" || strings.TrimSpace(p.UserCodeHMAC) == "" {
		return Authorization{}, errors.New("deviceflow: identifiers are required")
	}
	if strings.TrimSpace(p.Name) == "" || len(p.Name) > 120 {
		return Authorization{}, errors.New("deviceflow: the requested name must hold 1 to 120 characters")
	}
	if err := f.hooks.ValidateScopes(p.Scopes); err != nil {
		return Authorization{}, err
	}
	if p.TokenLifetime <= 0 || p.TokenLifetime > TokenMaxLifetime {
		return Authorization{}, errors.New("deviceflow: the token lifetime must be positive and at most 30d")
	}

	now := f.hooks.Now()
	record := Authorization{
		ID:                   p.ID,
		RequestedName:        p.Name,
		RequestedScopes:      p.Scopes,
		ExpiresAt:            now.Add(AuthorizationLifetime),
		TokenExpiresAt:       now.Add(p.TokenLifetime),
		TokenLifetime:        p.TokenLifetime,
		TokenLifetimeSeconds: int64(p.TokenLifetime / time.Second),
		PollInterval:         PollInterval,
		NextPollAt:           now.Add(PollInterval),
		State:                StatePending,
		CreatedAt:            now,
	}

	tx, err := f.hooks.Begin(ctx)
	if err != nil {
		return Authorization{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO device_authorizations (
			id, device_hash, user_code_hmac, requested_name, requested_scopes,
			expires_at, token_expires_at, token_lifetime_s, poll_interval_s, next_poll_at, state, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.DeviceHash, p.UserCodeHMAC, p.Name, strings.Join(p.Scopes, " "),
		f.hooks.FormatTime(record.ExpiresAt), f.hooks.FormatTime(record.TokenExpiresAt),
		record.TokenLifetimeSeconds, int64(PollInterval/time.Second),
		f.hooks.FormatTime(record.NextPollAt), string(StatePending), f.hooks.FormatTime(now))
	if err != nil {
		return Authorization{}, errors.Wrap(err, "deviceflow: create the authorization")
	}
	if err := f.hooks.audit(ctx, tx, ActionStart, map[string]any{
		"device_authorization": p.ID, "scopes": strings.Join(p.Scopes, " ")}); err != nil {
		return Authorization{}, err
	}
	if err := tx.Commit(); err != nil {
		return Authorization{}, errors.Wrap(err, "deviceflow: commit the authorization")
	}
	return record, nil
}

// Get returns one pairing, and only to a caller who supplied the peppered
// display-code HMAC: the public id alone must not open the record.
func (f *Flow) Get(ctx context.Context, id, userCodeHMAC string) (Authorization, error) {
	tx, err := f.hooks.Begin(ctx)
	if err != nil {
		return Authorization{}, err
	}
	defer func() { _ = tx.Rollback() }()

	record, storedHMAC, err := f.scan(tx.QueryRowContext(ctx,
		selectColumns+` FROM device_authorizations WHERE id = ?`, id))
	if err != nil {
		return Authorization{}, mapScanErr(err)
	}
	if subtle.ConstantTimeCompare([]byte(userCodeHMAC), []byte(storedHMAC)) != 1 {
		return Authorization{}, ErrInvalid
	}
	if !record.ExpiresAt.After(f.hooks.Now()) {
		return Authorization{}, ErrExpired
	}
	return record, nil
}

// Approve records human approval. Single transition, pending only.
func (f *Flow) Approve(ctx context.Context, id, userID, userCodeHMAC string) (Authorization, error) {
	return f.settle(ctx, id, userID, userCodeHMAC, StateApproved)
}

// Deny records human refusal. Single transition, pending only.
func (f *Flow) Deny(ctx context.Context, id, userID, userCodeHMAC string) (Authorization, error) {
	return f.settle(ctx, id, userID, userCodeHMAC, StateDenied)
}

func (f *Flow) settle(ctx context.Context, id, userID, userCodeHMAC string, to State) (Authorization, error) {
	tx, err := f.hooks.Begin(ctx)
	if err != nil {
		return Authorization{}, err
	}
	defer func() { _ = tx.Rollback() }()

	record, storedHMAC, err := f.scan(tx.QueryRowContext(ctx,
		selectColumns+` FROM device_authorizations WHERE id = ?`, id))
	if err != nil {
		return Authorization{}, mapScanErr(err)
	}
	if subtle.ConstantTimeCompare([]byte(userCodeHMAC), []byte(storedHMAC)) != 1 {
		return Authorization{}, ErrInvalid
	}
	now := f.hooks.Now()
	if !record.ExpiresAt.After(now) {
		return Authorization{}, ErrExpired
	}
	if record.State != StatePending {
		return Authorization{}, stateError(record.State)
	}

	column, action := "approved_at", ActionApprove
	if to == StateDenied {
		column, action = "denied_at", ActionDeny
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE device_authorizations SET state = ?, approved_by = ?, `+column+` = ?
		WHERE id = ? AND state = ?`,
		string(to), userID, f.hooks.FormatTime(now), id, string(StatePending))
	if err != nil {
		return Authorization{}, errors.Wrap(err, "deviceflow: settle the authorization")
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return Authorization{}, ErrInvalid
	}
	if err := f.hooks.audit(ctx, tx, action, map[string]any{
		"device_authorization": id, "user": userID}); err != nil {
		return Authorization{}, err
	}
	if err := tx.Commit(); err != nil {
		return Authorization{}, errors.Wrap(err, "deviceflow: commit the settlement")
	}
	record.State = to
	record.ApprovedBy = userID
	if to == StateApproved {
		record.ApprovedAt = &now
	} else {
		record.DeniedAt = &now
	}
	return record, nil
}

// Consume redeems an approved pairing into one token. Exactly once: the state
// row moves to consumed inside the same transaction that mints.
//
// A poll before approval answers ErrPending, and an EARLY poll answers
// ErrSlowDown while pushing next_poll_at further out — the RFC-8628 pressure
// valve that keeps an impatient agent from hammering the endpoint.
func (f *Flow) Consume(ctx context.Context, deviceHash string) (TokenResponse, error) {
	tx, err := f.hooks.Begin(ctx)
	if err != nil {
		return TokenResponse{}, err
	}
	defer func() { _ = tx.Rollback() }()

	record, _, err := f.scan(tx.QueryRowContext(ctx,
		selectColumns+` FROM device_authorizations WHERE device_hash = ?`, deviceHash))
	if err != nil {
		return TokenResponse{}, mapScanErr(err)
	}
	now := f.hooks.Now()
	if !record.ExpiresAt.After(now) {
		if record.State == StatePending || record.State == StateApproved {
			_, _ = tx.ExecContext(ctx, `UPDATE device_authorizations SET state = ? WHERE id = ?`,
				string(StateExpired), record.ID)
			_ = tx.Commit()
		}
		return TokenResponse{}, ErrExpired
	}
	if now.Before(record.NextPollAt) {
		next := record.NextPollAt.Add(5 * time.Second)
		if _, err := tx.ExecContext(ctx, `UPDATE device_authorizations SET next_poll_at = ? WHERE id = ?`,
			f.hooks.FormatTime(next), record.ID); err != nil {
			return TokenResponse{}, errors.Wrap(err, "deviceflow: slow the poll")
		}
		if err := tx.Commit(); err != nil {
			return TokenResponse{}, errors.Wrap(err, "deviceflow: commit the slow-down")
		}
		return TokenResponse{}, ErrSlowDown
	}
	if record.State == StatePending {
		if _, err := tx.ExecContext(ctx, `UPDATE device_authorizations SET next_poll_at = ? WHERE id = ?`,
			f.hooks.FormatTime(now.Add(record.PollInterval)), record.ID); err != nil {
			return TokenResponse{}, errors.Wrap(err, "deviceflow: advance the poll window")
		}
		if err := tx.Commit(); err != nil {
			return TokenResponse{}, errors.Wrap(err, "deviceflow: commit the poll window")
		}
		return TokenResponse{}, ErrPending
	}
	if record.State != StateApproved {
		return TokenResponse{}, stateError(record.State)
	}

	disabled, err := f.hooks.UserDisabled(ctx, tx, record.ApprovedBy)
	if err != nil {
		return TokenResponse{}, err
	}
	if disabled {
		return TokenResponse{}, ErrInvalid
	}

	tokenExpiresAt := now.Add(record.TokenLifetime)
	minted, err := f.hooks.MintToken(ctx, tx, record.ApprovedBy, record.RequestedName,
		record.RequestedScopes, tokenExpiresAt)
	if err != nil {
		return TokenResponse{}, err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE device_authorizations SET state = ?, consumed_at = ?, token_id = ?, token_expires_at = ?
		WHERE id = ? AND state = ?`,
		string(StateConsumed), f.hooks.FormatTime(now), minted.TokenID,
		f.hooks.FormatTime(tokenExpiresAt), record.ID, string(StateApproved))
	if err != nil {
		return TokenResponse{}, errors.Wrap(err, "deviceflow: consume the authorization")
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return TokenResponse{}, ErrInvalid
	}
	if err := f.hooks.audit(ctx, tx, ActionConsume, map[string]any{
		"device_authorization": record.ID, "token": minted.TokenID}); err != nil {
		return TokenResponse{}, err
	}
	if err := tx.Commit(); err != nil {
		return TokenResponse{}, errors.Wrap(err, "deviceflow: commit the consumption")
	}
	expires := minted.ExpiresAt
	return TokenResponse{
		Token: minted.Token, TokenID: minted.TokenID, ExpiresAt: &expires, Scopes: minted.Scopes,
	}, nil
}

// Sweep removes expired pairings immediately and terminal records after one
// day. The audit log keeps the history; these are coordination rows.
func (f *Flow) Sweep(ctx context.Context) (int64, error) {
	tx, err := f.hooks.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	now := f.hooks.Now()
	cutoff := now.Add(-24 * time.Hour)
	result, err := tx.ExecContext(ctx, `DELETE FROM device_authorizations
		WHERE (state IN (?, ?) AND expires_at <= ?)
		   OR (state = ? AND denied_at <= ?)
		   OR (state = ? AND consumed_at <= ?)
		   OR (state = ? AND expires_at <= ?)`,
		string(StatePending), string(StateApproved), f.hooks.FormatTime(now),
		string(StateDenied), f.hooks.FormatTime(cutoff),
		string(StateConsumed), f.hooks.FormatTime(cutoff),
		string(StateExpired), f.hooks.FormatTime(cutoff))
	if err != nil {
		return 0, errors.Wrap(err, "deviceflow: sweep the authorizations")
	}
	deleted, _ := result.RowsAffected()
	return deleted, errors.Wrap(tx.Commit(), "deviceflow: commit the sweep")
}

// ParseExpiresIn reads a requested credential lifetime such as "24h" or "30d".
func ParseExpiresIn(raw string) (time.Duration, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, errors.New("deviceflow: expires_in is required")
	}
	// time.ParseDuration has no day unit, and "30d" is the natural way to ask
	// for the maximum.
	if strings.HasSuffix(value, "d") {
		days := strings.TrimSuffix(value, "d")
		parsed, err := time.ParseDuration(days + "h")
		if err != nil {
			return 0, errors.New("deviceflow: expires_in is malformed")
		}
		parsed *= 24
		if parsed <= 0 || parsed > TokenMaxLifetime {
			return 0, errors.New("deviceflow: expires_in must be between one second and 30d")
		}
		return parsed, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, errors.New("deviceflow: expires_in is malformed")
	}
	if parsed <= 0 || parsed > TokenMaxLifetime {
		return 0, errors.New("deviceflow: expires_in must be between one second and 30d")
	}
	return parsed, nil
}

const selectColumns = `SELECT id, requested_name, requested_scopes, expires_at, token_expires_at,
	token_lifetime_s, poll_interval_s, next_poll_at, state, approved_by, approved_at, denied_at,
	consumed_at, token_id, created_at, user_code_hmac`

type rowScanner interface{ Scan(...any) error }

func (f *Flow) scan(row rowScanner) (Authorization, string, error) {
	var (
		record                                                Authorization
		scopes, expiresAt, tokenExpiresAt, nextPollAt         string
		state, createdAt, codeHMAC                            string
		tokenLifetime, interval                               int64
		approvedBy, approvedAt, deniedAt, consumedAt, tokenID sql.NullString
	)
	if err := row.Scan(&record.ID, &record.RequestedName, &scopes, &expiresAt, &tokenExpiresAt,
		&tokenLifetime, &interval, &nextPollAt, &state, &approvedBy, &approvedAt, &deniedAt,
		&consumedAt, &tokenID, &createdAt, &codeHMAC); err != nil {
		return Authorization{}, "", err
	}
	var err error
	if record.ExpiresAt, err = f.hooks.ParseTime(expiresAt); err != nil {
		return Authorization{}, "", err
	}
	if record.TokenExpiresAt, err = f.hooks.ParseTime(tokenExpiresAt); err != nil {
		return Authorization{}, "", err
	}
	if record.NextPollAt, err = f.hooks.ParseTime(nextPollAt); err != nil {
		return Authorization{}, "", err
	}
	if record.CreatedAt, err = f.hooks.ParseTime(createdAt); err != nil {
		return Authorization{}, "", err
	}
	record.RequestedScopes = strings.Fields(scopes)
	record.TokenLifetime = time.Duration(tokenLifetime) * time.Second
	record.TokenLifetimeSeconds = tokenLifetime
	record.PollInterval = time.Duration(interval) * time.Second
	record.State = State(state)
	record.ApprovedBy = approvedBy.String
	record.TokenID = tokenID.String
	for _, pair := range []struct {
		value  sql.NullString
		target **time.Time
	}{{approvedAt, &record.ApprovedAt}, {deniedAt, &record.DeniedAt}, {consumedAt, &record.ConsumedAt}} {
		if pair.value.Valid && pair.value.String != "" {
			parsed, err := f.hooks.ParseTime(pair.value.String)
			if err != nil {
				return Authorization{}, "", err
			}
			*pair.target = &parsed
		}
	}
	return record, codeHMAC, nil
}

func stateError(state State) error {
	switch state {
	case StateDenied:
		return ErrDenied
	case StateConsumed:
		return ErrConsumed
	case StateExpired:
		return ErrExpired
	case StatePending, StateApproved:
		return ErrInvalid
	default:
		return ErrInvalid
	}
}

func mapScanErr(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalid
	}
	return errors.Wrap(err, "deviceflow: read the authorization")
}
