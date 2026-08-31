import type { PresentationDescriptor } from "../registry";
import type { TokenRef } from "../types";

/**
 * `<token>` — an API credential, by id.
 *
 * Nothing here can reach a secret, because TokenRef has no field for one
 * (DR-28). `describe` feeds the inspector, which is exactly the surface that
 * would leak it.
 */
export const tokenDescriptor: PresentationDescriptor<TokenRef> = {
  ptype: "token",
  tone: "var(--pbui-tone-step)",

  label: (token) => `${token.name} · ${token.id}`,

  describe: (token) => ({
    presentationType: "token",
    id: token.id,
    name: token.name,
    scopes: token.scopes,
    expiresAt: token.expiresAt ?? "never",
    revokedAt: token.revokedAt ?? null,
    // Stated because it is the property people most often misunderstand about
    // scoped credentials.
    note: "scopes narrow what this token may do; they never grant more than its owner has",
  }),
};
