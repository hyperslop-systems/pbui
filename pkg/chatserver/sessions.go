package chatserver

import (
	"context"
	"database/sql"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"

	_ "modernc.org/sqlite"
)

// SessionRecord is what the index remembers about one session. It is
// deliberately thin: enough to draw a list, and nothing a client would be
// wrong to disbelieve.
type SessionRecord struct {
	ID             string    `json:"id"`
	CreatedAt      time.Time `json:"createdAt"`
	LastActivityAt time.Time `json:"lastActivityAt"`
	MessageCount   int       `json:"messageCount"`
	Title          string    `json:"title,omitempty"`
}

// SessionIndex is a list of the sessions this server has seen.
//
// It is a CONVENIENCE, not a source of truth. The hub and the hydration store
// remain authoritative for a session's events: a browser that knows a session
// id this index has never heard of — because the index is in memory and the
// process restarted — can still connect to it and hydrate its whole
// transcript. That is why the browser MERGES this list into its own records
// rather than replacing them, and why nothing here is required for a session
// to work.
//
// Titles live in the browser first for the same reason. The index stores one
// when a client sends it, so a second browser has something better than a
// uuid to show; it never overwrites what a person typed.
type SessionIndex interface {
	// Remember records a session that has just been created. Idempotent.
	Remember(ctx context.Context, id string, at time.Time) error
	// Touch records activity, counting a message when counted is true.
	Touch(ctx context.Context, id string, at time.Time, counted bool) error
	// Retitle sets a session's title. An empty title clears it.
	Retitle(ctx context.Context, id string, title string) error
	// List returns every session, most recently active first.
	List(ctx context.Context) ([]SessionRecord, error)
	Close() error
}

/* ---- memory --------------------------------------------------------------- */

type memorySessionIndex struct {
	mu      sync.Mutex
	records map[string]SessionRecord
}

// NewMemorySessionIndex keeps the list for the life of the process. Restarting
// the server empties it, which is a case every client has to handle anyway.
func NewMemorySessionIndex() SessionIndex {
	return &memorySessionIndex{records: map[string]SessionRecord{}}
}

func (m *memorySessionIndex) Remember(_ context.Context, id string, at time.Time) error {
	if id == "" {
		return errors.New("session id must not be empty")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.records[id]; ok {
		return nil
	}
	m.records[id] = SessionRecord{ID: id, CreatedAt: at, LastActivityAt: at}
	return nil
}

func (m *memorySessionIndex) Touch(_ context.Context, id string, at time.Time, counted bool) error {
	if id == "" {
		return errors.New("session id must not be empty")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	record, ok := m.records[id]
	if !ok {
		// A session the index never saw created — a client reconnecting to one
		// from before a restart. Recording it now is better than dropping it.
		record = SessionRecord{ID: id, CreatedAt: at}
	}
	record.LastActivityAt = at
	if counted {
		record.MessageCount++
	}
	m.records[id] = record
	return nil
}

func (m *memorySessionIndex) Retitle(_ context.Context, id string, title string) error {
	if id == "" {
		return errors.New("session id must not be empty")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	record, ok := m.records[id]
	if !ok {
		return errors.Errorf("no session %s", id)
	}
	record.Title = strings.TrimSpace(title)
	m.records[id] = record
	return nil
}

func (m *memorySessionIndex) List(_ context.Context) ([]SessionRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SessionRecord, 0, len(m.records))
	for _, record := range m.records {
		out = append(out, record)
	}
	sortSessions(out)
	return out, nil
}

func (m *memorySessionIndex) Close() error { return nil }

/* ---- sqlite --------------------------------------------------------------- */

type sqliteSessionIndex struct {
	db *sql.DB
}

// NewSQLiteSessionIndex opens (and creates) the sessions table at path. The
// table is rebuildable in principle — every field except the title is derivable
// from the event stream — so losing the file costs a list, not a transcript.
func NewSQLiteSessionIndex(ctx context.Context, path string) (SessionIndex, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, errors.Wrap(err, "open session index")
	}
	const schema = `
CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  message_count    INTEGER NOT NULL DEFAULT 0,
  title            TEXT NOT NULL DEFAULT ''
);`
	if _, err := db.ExecContext(ctx, schema); err != nil {
		_ = db.Close()
		return nil, errors.Wrap(err, "create sessions table")
	}
	return &sqliteSessionIndex{db: db}, nil
}

func (s *sqliteSessionIndex) Remember(ctx context.Context, id string, at time.Time) error {
	if id == "" {
		return errors.New("session id must not be empty")
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (id, created_at, last_activity_at) VALUES (?, ?, ?)
		 ON CONFLICT(id) DO NOTHING`,
		id, formatTime(at), formatTime(at))
	return errors.Wrap(err, "remember session")
}

func (s *sqliteSessionIndex) Touch(ctx context.Context, id string, at time.Time, counted bool) error {
	if id == "" {
		return errors.New("session id must not be empty")
	}
	delta := 0
	if counted {
		delta = 1
	}
	// One statement for both cases: a session the index never saw created is
	// inserted with the count it is being touched for.
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (id, created_at, last_activity_at, message_count) VALUES (?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
		                               message_count = sessions.message_count + ?`,
		id, formatTime(at), formatTime(at), delta, delta)
	return errors.Wrap(err, "touch session")
}

func (s *sqliteSessionIndex) Retitle(ctx context.Context, id string, title string) error {
	if id == "" {
		return errors.New("session id must not be empty")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE sessions SET title = ? WHERE id = ?`, strings.TrimSpace(title), id)
	if err != nil {
		return errors.Wrap(err, "retitle session")
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "retitle session")
	}
	if affected == 0 {
		return errors.Errorf("no session %s", id)
	}
	return nil
}

func (s *sqliteSessionIndex) List(ctx context.Context) ([]SessionRecord, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, created_at, last_activity_at, message_count, title FROM sessions`)
	if err != nil {
		return nil, errors.Wrap(err, "list sessions")
	}
	defer func() { _ = rows.Close() }()
	out := []SessionRecord{}
	for rows.Next() {
		var record SessionRecord
		var created, last string
		if err := rows.Scan(&record.ID, &created, &last, &record.MessageCount, &record.Title); err != nil {
			return nil, errors.Wrap(err, "scan session")
		}
		record.CreatedAt = parseTime(created)
		record.LastActivityAt = parseTime(last)
		out = append(out, record)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "list sessions")
	}
	sortSessions(out)
	return out, nil
}

func (s *sqliteSessionIndex) Close() error { return errors.Wrap(s.db.Close(), "close session index") }

/* ---- shared --------------------------------------------------------------- */

// Most recently active first, then by id so the order is total — two sessions
// created in the same millisecond must not swap places between requests.
func sortSessions(records []SessionRecord) {
	sort.Slice(records, func(i, j int) bool {
		if !records[i].LastActivityAt.Equal(records[j].LastActivityAt) {
			return records[i].LastActivityAt.After(records[j].LastActivityAt)
		}
		return records[i].ID < records[j].ID
	})
}

func formatTime(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

func parseTime(s string) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}
	}
	return parsed
}
