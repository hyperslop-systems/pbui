import { Chip } from "@hyperslop-systems/pbui";

/**
 * One scope on a token.
 *
 * TokensApp rendered these as `token.scopes.join(" ")` — a single string, so
 * four scopes read as one long word and nothing could be pointed at. They are
 * four separate facts about what a credential may do, and the one that matters
 * most is `admin`.
 *
 * `Chip`, but not a *presentation*: it is the family's small labelled box
 * (PBUI-VISUAL-1 P4), used here purely for its geometry — there is still no
 * scope descriptor and no menu of scope verbs. `edge={false}` because a scope
 * carries no presentation type/tone to name on the 4px edge; `admin` is
 * distinguished with `strong`, not colour, for the same reason the original
 * comment gave: the tone scale already carries presentation type, and a red
 * scope chip would read as an error.
 */
export function ScopeChip({ scope }: { scope: string }) {
  // `admin` is the one worth a second look on a list of eight tokens.
  const privileged = scope === "admin";
  return (
    <Chip
      label={scope}
      size="tiny"
      fill="wash"
      edge={false}
      strong={privileged}
      title={privileged ? `${scope} — bypasses per-drop membership checks` : scope}
    />
  );
}
