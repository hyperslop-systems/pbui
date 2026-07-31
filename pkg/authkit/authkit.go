// Package authkit holds the authentication primitives every hyperslop
// application server shares: API-token minting and parsing, browser-flow
// values, device pairing codes, and the OIDC relying party.
//
// The package is deliberately free of storage, HTTP, and product vocabulary,
// exactly as pkg/workbench is: a host wires these primitives into its own
// store and handlers. The subpackage deviceflow adds the device-authorization
// state machine on the same terms.
//
// HISTORY. These functions began life in datalab's pkg/auth, and agentlogic
// was about to hold the third copy when the package moved here. datalab's
// pkg/auth is expected to shrink to thin aliases of this package; the
// extraction is complete when it does.
package authkit

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/hex"
	"strings"

	"github.com/pkg/errors"
)

// Token mechanics.
//
//   - The credential is <prefix><id>_<secret>. The prefix names the product
//     ("ddp_", "alg_"), which is what makes a leaked credential greppable.
//   - The id is public: safe in an audit row and a log line, and it makes the
//     lookup a primary-key read rather than a scan over every hash.
//   - Base32 without padding: case-insensitive on the wire, no '+' or '/' for
//     a shell to mangle, unambiguous when read out of a terminal. Lowercase,
//     because SHOUTING CREDENTIALS are harder to transcribe.
const (
	tokenIDBytes     = 8  // 13 base32 characters
	tokenSecretBytes = 20 // 32 base32 characters, 160 bits
)

var tokenEncoding = base32.NewEncoding("abcdefghijklmnopqrstuvwxyz234567").WithPadding(base32.NoPadding)

// NewToken is a freshly minted credential. Secret exists on this struct for
// exactly as long as it takes to put it in the one HTTP response that ever
// carries it.
type NewToken struct {
	ID         string
	Secret     string
	SecretHash string
	// String is the full credential: prefix, id, secret. Shown once.
	String string
}

// MintToken generates a new API token under the product's prefix.
func MintToken(prefix string) (NewToken, error) {
	if err := validPrefix(prefix); err != nil {
		return NewToken{}, err
	}
	idBytes := make([]byte, tokenIDBytes)
	if _, err := rand.Read(idBytes); err != nil {
		return NewToken{}, errors.Wrap(err, "authkit: generate token id")
	}
	secretBytes := make([]byte, tokenSecretBytes)
	if _, err := rand.Read(secretBytes); err != nil {
		return NewToken{}, errors.Wrap(err, "authkit: generate token secret")
	}

	id := tokenEncoding.EncodeToString(idBytes)
	secret := tokenEncoding.EncodeToString(secretBytes)
	return NewToken{
		ID:         id,
		Secret:     secret,
		SecretHash: HashSecret(secret),
		String:     prefix + id + "_" + secret,
	}, nil
}

// HashSecret is how a token secret is stored.
//
// SHA-256 and not a slow KDF, deliberately: a KDF exists to make brute-forcing
// a low-entropy human-chosen secret expensive. This secret is 160 bits from
// crypto/rand — not brute-forceable at any cost — so a KDF would add tens of
// milliseconds to every API request and buy nothing. The rule for passwords is
// the opposite, and the difference is entropy.
func HashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// LooksLikeToken reports whether raw has the shape of a token under prefix. A
// shape test, never an acceptance test.
func LooksLikeToken(prefix, raw string) bool { return strings.HasPrefix(raw, prefix) }

// ParseToken splits a presented credential into its public id and its secret.
// It validates shape only: a well-formed token for an id that does not exist
// parses and then fails to resolve, which is the correct division of labour.
func ParseToken(prefix, raw string) (string, string, error) {
	if err := validPrefix(prefix); err != nil {
		return "", "", err
	}
	if !strings.HasPrefix(raw, prefix) {
		return "", "", errors.Errorf("authkit: not a %s token", strings.TrimSuffix(prefix, "_"))
	}
	rest := strings.ToLower(strings.TrimPrefix(raw, prefix))
	parts := strings.SplitN(rest, "_", 2)
	if len(parts) != 2 {
		return "", "", errors.Errorf("authkit: malformed token: expected %s<id>_<secret>", prefix)
	}
	id, secret := parts[0], parts[1]
	if err := validTokenPart(id, tokenIDBytes); err != nil {
		return "", "", errors.Wrap(err, "authkit: token id")
	}
	if err := validTokenPart(secret, tokenSecretBytes); err != nil {
		return "", "", errors.Wrap(err, "authkit: token secret")
	}
	return id, secret, nil
}

// VerifySecret compares a presented secret against a stored hash, in constant
// time.
func VerifySecret(secret, storedHash string) bool {
	return subtle.ConstantTimeCompare([]byte(HashSecret(secret)), []byte(storedHash)) == 1
}

func validPrefix(prefix string) error {
	if len(prefix) < 2 || !strings.HasSuffix(prefix, "_") {
		return errors.New("authkit: a token prefix names the product and ends with an underscore")
	}
	return nil
}

func validTokenPart(part string, wantBytes int) error {
	decoded, err := tokenEncoding.DecodeString(part)
	if err != nil {
		return errors.New("not base32")
	}
	if len(decoded) != wantBytes {
		return errors.Errorf("holds %d bytes and needs %d", len(decoded), wantBytes)
	}
	return nil
}

// NewSessionValue mints a browser session cookie value: 256 bits, base32.
func NewSessionValue() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.Wrap(err, "authkit: generate session value")
	}
	return tokenEncoding.EncodeToString(buf), nil
}

// NewFlowValue mints an OIDC state, nonce, PKCE verifier, or device code:
// 256 bits, base32.
func NewFlowValue() (string, error) { return NewSessionValue() }

// NewPrefixedID mints a random identifier such as "dev_..." or "usr_...".
// Not a secret; safe to log.
func NewPrefixedID(prefix string, n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.Wrap(err, "authkit: generate id")
	}
	return prefix + tokenEncoding.EncodeToString(buf), nil
}
