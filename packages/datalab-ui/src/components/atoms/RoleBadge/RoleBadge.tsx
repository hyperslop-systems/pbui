import { Chip } from "@hyperslop-systems/pbui";

export type Role = "reader" | "writer" | "admin" | "";

/**
 * What a caller may do to a drop, in one glyph.
 *
 * A badge rather than a colour: the tone scale is already carrying presentation
 * type, and stacking a second meaning on it would make both unreadable. §10.3's
 * rule that a tone is never the sole carrier of information applies here too.
 *
 * `edge={false}`: this badge names a role, not a presentation type, so it gets
 * no 4px tone edge — PBUI-VISUAL-1 P4.
 */
export function RoleBadge({ role }: { role: Role }) {
  if (!role) return null;
  return (
    <Chip
      label={role[0]?.toUpperCase() ?? ""}
      size="tiny"
      edge={false}
      // "an admin", not "a admin". A screen reader says this out loud.
      title={`you are ${role === "admin" ? "an" : "a"} ${role}`}
    />
  );
}
