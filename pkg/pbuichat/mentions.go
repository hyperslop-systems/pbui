package pbuichat

import (
	"regexp"
	"strings"
)

// Mention is one [[type:id|label]] occurrence in model prose. The syntax is
// deliberately plain: it survives markdown, it is unambiguous to scan, and the
// browser can render a chip from the mention alone before the server has
// resolved the value.
type Mention struct {
	Type  string
	ID    string
	Label string
	// Start and End are byte offsets of the whole mention in the scanned text.
	Start, End int
}

// Key is the reference key used in a pbui.refs document: "<type>:<id>".
func (m Mention) Key() string { return m.Type + ":" + m.ID }

var mentionPattern = regexp.MustCompile(`\[\[([A-Za-z_][A-Za-z0-9_.-]*):([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]`)

// ScanMentions returns every mention in text, in order of appearance. Labels
// and ids are trimmed; a mention with an empty id is skipped.
func ScanMentions(text string) []Mention {
	matches := mentionPattern.FindAllStringSubmatchIndex(text, -1)
	if len(matches) == 0 {
		return nil
	}
	out := make([]Mention, 0, len(matches))
	for _, m := range matches {
		typ := text[m[2]:m[3]]
		id := strings.TrimSpace(text[m[4]:m[5]])
		if id == "" {
			continue
		}
		label := ""
		if m[6] >= 0 {
			label = strings.TrimSpace(text[m[6]:m[7]])
		}
		out = append(out, Mention{Type: typ, ID: id, Label: label, Start: m[0], End: m[1]})
	}
	return out
}

// UniqueMentions returns the first occurrence of each distinct key.
func UniqueMentions(mentions []Mention) []Mention {
	seen := map[string]struct{}{}
	out := make([]Mention, 0, len(mentions))
	for _, m := range mentions {
		if _, ok := seen[m.Key()]; ok {
			continue
		}
		seen[m.Key()] = struct{}{}
		out = append(out, m)
	}
	return out
}

// StripMentions replaces every mention with its label (or its id when it has
// none). Used where plain text is needed, for example a turn summary.
func StripMentions(text string) string {
	return mentionPattern.ReplaceAllStringFunc(text, func(s string) string {
		ms := ScanMentions(s)
		if len(ms) == 0 {
			return s
		}
		if ms[0].Label != "" {
			return ms[0].Label
		}
		return ms[0].ID
	})
}
