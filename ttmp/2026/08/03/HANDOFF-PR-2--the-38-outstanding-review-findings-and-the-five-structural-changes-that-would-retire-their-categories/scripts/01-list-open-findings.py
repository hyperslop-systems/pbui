#!/usr/bin/env python3
"""
Every review finding across the four PRs that is not yet FIXED, from the API.

# Why this exists

The HANDOFF-PR-1 guide was written by reading the PRs by hand and reported
"21 findings" when the API says 32. Eleven findings — four of them P1 — went
unaddressed for a whole round because of that. Derive the list; do not count
it.

# The convention this relies on

A thread is FIXED when our reply begins with "**Fixed**". Anything else —
including "**Acknowledged — not addressed in this round**" — is still open.

That distinction matters and a naive "has a reply" test gets it wrong: the
first version of this script reported 27 open when the real number was 38,
precisely because acknowledging a finding looks identical to fixing one if
you only check whether somebody answered.

GitHub's own `isResolved` flag is not used, because nothing in these four PRs
has ever been marked resolved and a signal nobody sets is not a signal.

    python3 01-list-open-findings.py           # not yet fixed
    python3 01-list-open-findings.py --all     # every thread, with its state
"""
import collections
import json
import subprocess
import sys

PRS = {"turboproof": 3, "hyperblog": 1, "agentlogic": 3, "pbui": 9}
FIXED_MARKER = "**Fixed**"
SHOW_ALL = "--all" in sys.argv


def comments(repo: str, pr: int) -> list[dict]:
    out = subprocess.run(
        ["gh", "api", f"repos/hyperslop-systems/{repo}/pulls/{pr}/comments", "--paginate"],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


totals = collections.Counter()
for repo, pr in PRS.items():
    rows = comments(repo, pr)
    fixed = {
        c["in_reply_to_id"]
        for c in rows
        if c.get("in_reply_to_id") and c["body"].lstrip().startswith(FIXED_MARKER)
    }
    threads = [c for c in rows if c.get("in_reply_to_id") is None]
    shown = [c for c in threads if SHOW_ALL or c["id"] not in fixed]

    print(f"\n{'=' * 74}\n{repo} #{pr} — {len(shown)} shown of {len(threads)} threads\n{'=' * 74}")
    for c in sorted(shown, key=lambda c: (c["path"], c.get("line") or 0)):
        sev = "P1" if "P1-orange" in c["body"] else "P2"
        # line 3 of the body is the reviewer's one-line title
        title = c["body"].split("\n")[2].replace("**", "").strip()
        line = c.get("line") or c.get("original_line")
        state = "fixed" if c["id"] in fixed else "OPEN"
        print(f"  [{sev}] {state:5} {c['path']}:{line}")
        print(f"              {title[:96]}")
        if c["id"] not in fixed:
            totals[sev] += 1

print(f"\n{'=' * 74}")
print(f"NOT YET FIXED: {sum(totals.values())}  ({totals['P1']} P1, {totals['P2']} P2)")
