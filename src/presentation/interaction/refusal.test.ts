import { describe, expect, it } from "vitest";
import { describeRefusal } from "./refusal";

describe("describeRefusal", () => {
  it("names the row and the subject, and carries the product's reason", () => {
    expect(describeRefusal({ code: "action-no-longer-available", because: "the order has shipped", label: "Cancel", subjectLabel: "#88150" })).toEqual({
      headline: "“Cancel” is no longer available on #88150",
      detail: "the order has shipped",
      hint: "open the menu again to see what applies now",
    });
  });

  it("has a sentence for each fresh-revalidation code and a fallback that shows the code", () => {
    expect(describeRefusal({ code: "action-no-longer-resolves", label: "Open" }).headline).toBe("“Open” no longer applies");
    expect(describeRefusal({ code: "action-became-ambiguous", label: "Open" })).toMatchObject({ hint: "open the menu to choose between them" });
    expect(describeRefusal({ code: "action-implementation-changed" }).headline).toBe("that action changed while the menu was open");
    expect(describeRefusal({ code: "something-else" }).headline).toBe("that action was refused (something-else)");
  });

  it("detail is null when there is no reason", () => {
    expect(describeRefusal({ code: "action-no-longer-resolves" }).detail).toBeNull();
  });
});
