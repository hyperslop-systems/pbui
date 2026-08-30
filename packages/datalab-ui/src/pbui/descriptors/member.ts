import type { PresentationDescriptor } from "../registry";
import type { MemberRef } from "../types";

/** `<member>` — one row of a drop's access list. */
export const memberDescriptor: PresentationDescriptor<MemberRef> = {
  ptype: "member",
  tone: "var(--pbui-tone-source)",

  label: (member) => `${member.user.name} — ${member.role} on ${member.drop}`,

  describe: (member) => ({
    presentationType: "member",
    drop: member.drop,
    user: member.user,
    role: member.role,
    isOwner: member.isOwner,
    can:
      member.role === "reader"
        ? "read events, tables, datasets and exports"
        : member.role === "writer"
          ? "everything a reader can, plus append events and publish datasets"
          : "everything a writer can, plus manage members and delete versions",
  }),
};
