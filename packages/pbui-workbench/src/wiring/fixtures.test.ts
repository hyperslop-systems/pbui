import { describe, expect, it } from "vitest";
import { evaluatePort } from "@hyperslop-systems/pbui";
import { createWiringLab } from "../stories/WiringLab.stories";
import { linkRefsOf } from "../links/linkRef";

describe("truthful wiring fixtures", () => {
  for (const crowded of [false, true]) {
    it(`seeds real follow, derived, held and shared semantics (crowded=${crowded})`, () => {
      const wb = createWiringLab(crowded);
      const links = linkRefsOf(wb.linkSnapshot());
      expect(links.map(link => link.kind).sort()).toEqual(["derived", "follow", "follow", "follow", "held", "identity"]);
      const derived = links.find(link => link.kind === "derived")!;
      const held = links.find(link => link.kind === "held")!;
      wb.links.runtime.emit(derived.source, { type: "number", value: 5 });
      wb.links.runtime.emit(held.source, { type: "text", value: "changed" });
      expect(evaluatePort(derived.destination, wb.linkSnapshot(), wb.links.deps)).toMatchObject({ kind: "value", reference: { value: 10 } });
      expect(evaluatePort(held.destination, wb.linkSnapshot(), wb.links.deps)).toMatchObject({ kind: "value", reference: { value: "tick 0" } });
      const shared = links.find(link => link.kind === "identity")!;
      const classId = wb.linkSnapshot().aliases.get(shared.source)!;
      wb.links.runtime.emit(shared.destination, { type: "number", value: 17 }, { classId });
      expect(evaluatePort(shared.source, wb.linkSnapshot(), wb.links.deps)).toMatchObject({ kind: "value", reference: { value: 17 } });
      expect(evaluatePort(shared.destination, wb.linkSnapshot(), wb.links.deps)).toMatchObject({ kind: "value", reference: { value: 17 } });
    });
  }
});
