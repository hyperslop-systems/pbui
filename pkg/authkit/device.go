package authkit

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"strings"

	"github.com/pkg/errors"
)

// Device pairing codes.
//
// Two credentials with very different jobs:
//
//   - The DEVICE CODE is the agent's credential: 256 bits, never displayed,
//     stored only as a plain SHA-256 (its entropy needs no pepper).
//   - The USER CODE is what a human compares between terminal and browser:
//     eight characters from an alphabet without 0/O/1/I. It is deliberately
//     human-sized, so the server stores only a PEPPERED HMAC — a database
//     reader must not be able to enumerate the small code space — and
//     rate-limits its use.

const (
	deviceUserCodeBytes = 5
	deviceUserCodeChars = 8
)

var deviceUserCodeEncoding = base32.NewEncoding("ABCDEFGHJKLMNPQRSTUVWXYZ23456789").WithPadding(base32.NoPadding)

// NewDeviceUserCode generates a short code a person can compare with their
// terminal, displayed as XXXX-XXXX.
func NewDeviceUserCode() (string, error) {
	buf := make([]byte, deviceUserCodeBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.Wrap(err, "authkit: generate device user code")
	}
	encoded := deviceUserCodeEncoding.EncodeToString(buf)
	if len(encoded) != deviceUserCodeChars {
		return "", errors.Errorf("authkit: generated device user code has length %d", len(encoded))
	}
	return encoded[:4] + "-" + encoded[4:], nil
}

// NormalizeDeviceUserCode makes display separators and case irrelevant before
// keyed lookup. It accepts only the exact eight-character alphabet.
func NormalizeDeviceUserCode(raw string) (string, error) {
	value := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(raw), "-", ""))
	if len(value) != deviceUserCodeChars {
		return "", errors.New("authkit: device user code must contain eight characters")
	}
	if _, err := deviceUserCodeEncoding.DecodeString(value); err != nil {
		return "", errors.New("authkit: device user code is malformed")
	}
	return value, nil
}

// HashDeviceUserCode returns the keyed database representation of a displayed
// device code.
func HashDeviceUserCode(pepper, raw string) (string, error) {
	if strings.TrimSpace(pepper) == "" {
		return "", errors.New("authkit: device-code pepper is required")
	}
	value, err := NormalizeDeviceUserCode(raw)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, []byte(pepper))
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

// VerifyDeviceUserCode compares a displayed code to its stored keyed hash.
func VerifyDeviceUserCode(pepper, raw, storedHash string) bool {
	calculated, err := HashDeviceUserCode(pepper, raw)
	if err != nil {
		return false
	}
	return hmac.Equal([]byte(calculated), []byte(storedHash))
}

// NewDeviceAuthorizationID mints the identifier used in approval URLs and
// audit records. Not a bearer secret; the device code is.
func NewDeviceAuthorizationID() (string, error) { return NewPrefixedID("dev_", 16) }

// HashDeviceCode stores the high-entropy agent credential without retaining it.
func HashDeviceCode(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
