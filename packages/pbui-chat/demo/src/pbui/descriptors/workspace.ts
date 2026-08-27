import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const workspaceDescriptor: PresentationDescriptor<"workspace"> = {
  ptype: "workspace",
  tone: TONES.workspace,

  label: (ref) => ref.value?.name ?? `workspace ${ref.id}`,

  describe: (ref) => ({ presentationType: "workspace", id: ref.id, ...ref.value }),

};
