package deviceflow

import (
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

// RateLimiter is deliberately local to one process. The state machine's
// polling window is the cross-request correctness control; this limiter adds
// cheap abuse resistance for the single-replica deployment before an
// anonymous request reaches the database.
//
// Ported verbatim from datalab's device rate limiter, which is expected to
// delegate here (DR-37).
const rateLimitMaxEntries = 4096

type rateLimitEntry struct {
	count   int
	resetAt time.Time
}

type RateLimiter struct {
	mu        sync.Mutex
	entries   map[string]rateLimitEntry
	limit     int
	window    time.Duration
	nextSweep time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{entries: map[string]rateLimitEntry{}, limit: limit, window: window}
}

// Allow reports whether one more request from key may proceed, and how long
// the caller should wait when it may not.
func (l *RateLimiter) Allow(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.entries[key]
	if !exists {
		l.sweepExpired(now)
		if len(l.entries) >= rateLimitMaxEntries {
			l.evictOldest()
		}
		entry = rateLimitEntry{resetAt: now.Add(l.window)}
	} else if !now.Before(entry.resetAt) {
		entry = rateLimitEntry{resetAt: now.Add(l.window)}
	}
	if entry.count >= l.limit {
		return false, entry.resetAt.Sub(now)
	}
	entry.count++
	l.entries[key] = entry
	return true, 0
}

// sweepExpired avoids retaining one map entry for every anonymous address ever
// observed; the fixed cap is a second bound for a high-cardinality burst
// inside one window.
func (l *RateLimiter) sweepExpired(now time.Time) {
	if !l.nextSweep.IsZero() && now.Before(l.nextSweep) {
		return
	}
	for key, entry := range l.entries {
		if !now.Before(entry.resetAt) {
			delete(l.entries, key)
		}
	}
	l.nextSweep = now.Add(l.window)
}

func (l *RateLimiter) evictOldest() {
	var oldestKey string
	var oldest time.Time
	for key, entry := range l.entries {
		if oldestKey == "" || entry.resetAt.Before(oldest) {
			oldestKey, oldest = key, entry.resetAt
		}
	}
	if oldestKey != "" {
		delete(l.entries, oldestKey)
	}
}

// ClientKey derives an abuse-limiter key without accepting a forwarded address
// from an arbitrary peer. When the direct peer is a trusted proxy, the
// RIGHTMOST X-Forwarded-For value is that proxy's immediate client; earlier
// values may have been supplied by the client itself and are ignored.
func ClientKey(r *http.Request, trustedProxies []netip.Prefix) string {
	remote, ok := remoteAddr(r.RemoteAddr)
	if !ok {
		return "unknown"
	}
	if !isTrustedProxy(remote, trustedProxies) {
		return remote.String()
	}
	forwards := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(forwards) - 1; i >= 0; i-- {
		if candidate, err := netip.ParseAddr(strings.TrimSpace(forwards[i])); err == nil {
			return candidate.Unmap().String()
		}
	}
	return remote.String()
}

func remoteAddr(value string) (netip.Addr, bool) {
	addrPort, err := netip.ParseAddrPort(value)
	if err == nil {
		return addrPort.Addr().Unmap(), true
	}
	addr, err := netip.ParseAddr(value)
	if err != nil {
		return netip.Addr{}, false
	}
	return addr.Unmap(), true
}

func isTrustedProxy(addr netip.Addr, trustedProxies []netip.Prefix) bool {
	for _, prefix := range trustedProxies {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}
